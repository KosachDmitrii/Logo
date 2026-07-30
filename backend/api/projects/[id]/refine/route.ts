import { getChatGPTUser } from "@/backend/auth/chatgpt-auth";
import {
  buildRefinementPrompt,
  getRuntimeEnv,
} from "@/backend/lib/mvp-runtime";
import {
  insertRow,
  selectOne,
  updateRows,
} from "@/backend/lib/supabase";
import { refineVectorConcept } from "@/backend/lib/vector-art-direction";
import { arrayBufferToBase64 } from "@/backend/lib/logo-quality";
import {
  REFINE_RECOMMENDED_SCORE,
  refineAndReviewWithGemini,
} from "@/backend/lib/gemini-creative";

type ImageResponse = {
  result?: { image?: string };
  errors?: Array<{ message?: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  if (
    !runtime.OPENAI_API_KEY &&
    (!runtime.CLOUDFLARE_ACCOUNT_ID || !runtime.CLOUDFLARE_API_TOKEN)
  ) {
    return Response.json({ error: "Vector refinement is not configured." }, { status: 503 });
  }

  const { id: projectId } = await context.params;
  const body = (await request.json()) as {
    generationId?: string;
    generationIds?: string[];
    /** Failed-refine jury text keyed by exploration generation id — used on retry. */
    critiquesByGenerationId?: Record<string, string>;
  };
  const generationIds = Array.from(
    new Set(
      (body.generationIds ?? (body.generationId ? [body.generationId] : []))
        .filter((id): id is string => typeof id === "string" && Boolean(id)),
    ),
  ).slice(0, 1);
  const critiquesByGenerationId = body.critiquesByGenerationId ?? {};
  if (!generationIds.length) {
    return Response.json({ error: "Select one concept." }, { status: 400 });
  }
  const rows = await Promise.all(generationIds.map((generationId) => selectOne<{
    id: string;
    object_key: string;
    direction_title: string;
    prompt: string;
    logo_projects: { brief_json: Record<string, unknown> };
  }>("logo_generations", {
    select:
      "id,object_key,direction_title,prompt,logo_projects!inner(brief_json)",
    id: `eq.${generationId}`,
    project_id: `eq.${projectId}`,
    user_email: `eq.${user.email}`,
  })));
  if (rows.some((row) => !row)) {
    return Response.json({ error: "A selected concept was not found." }, { status: 404 });
  }

  // Sequential Pro 2K refine — parallel calls hit high-demand and AbortSignal timeouts.
  type RefineAsset = {
    id: string;
    parentId: string;
    stage: "refine";
    label: string;
    provider: string;
    model: string;
    contentType: string;
    qualityScore?: number;
    reviewReason?: string;
    reviewStatus?: string;
    url: string;
    downloadUrl: string;
  };
  const results: Array<PromiseSettledResult<RefineAsset>> = [];
  for (const [index, selectedRow] of rows.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    try {
      const startedAt = Date.now();
      const row = selectedRow!;
      const source = await runtime.FILES.get(row.object_key);
      if (!source) throw new Error("Source image not found.");
      const sourceBytes = await source.arrayBuffer();
      const brief = row.logo_projects.brief_json;
      let value: RefineAsset;
      if (
        source.httpMetadata?.contentType === "image/svg+xml" ||
        row.object_key.endsWith(".svg")
      ) {
        if (!runtime.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY is required for vector refinement.");
        }
        const sourceSvg = new TextDecoder().decode(sourceBytes);
        const refined = await refineVectorConcept(
          brief as Parameters<typeof refineVectorConcept>[0],
          runtime.OPENAI_API_KEY,
          sourceSvg,
          row.direction_title,
          index + 1,
        );
        const id = crypto.randomUUID();
        const objectKey = `users/assets/${user.email.length}/${projectId}/${id}.svg`;
        await runtime.FILES.put(
          objectKey,
          new TextEncoder().encode(refined.svg),
          { httpMetadata: { contentType: "image/svg+xml" } },
        );
        const prompt = [
          `[LOOPEN_VECTOR_NATIVE]`,
          `[LOOPEN_QC:${refined.score}]`,
          `[LOOPEN_REASON:${encodeURIComponent(refined.verdict)}]`,
          refined.rationale,
        ].join("");
        await insertRow("logo_assets", {
          id,
          project_id: projectId,
          user_email: user.email,
          parent_id: row.id,
          stage: "refine",
          label: `Vector refinement ${index + 1}`,
          provider: "openai",
          model: "gpt-5.6-terra",
          prompt,
          object_key: objectKey,
          content_type: "image/svg+xml",
          created_at: Date.now(),
        });
        value = {
          id,
          parentId: row.id,
          stage: "refine",
          label: `Vector refinement ${index + 1}`,
          provider: "openai",
          model: "gpt-5.6-terra",
          contentType: "image/svg+xml",
          qualityScore: refined.score,
          reviewReason: refined.verdict,
          reviewStatus: "Review",
          url: `/api/assets/${id}`,
          downloadUrl: `/api/assets/${id}?download=1`,
        };
      } else if (runtime.GEMINI_API_KEY && runtime.OPENAI_API_KEY) {
        const sourceMime = source.httpMetadata?.contentType ?? "image/png";
        const explorationCritique = decodeURIComponent(
          row.prompt.match(/\[LOOPEN_REASON:([^\]]*)\]/)?.[1] ?? "",
        );
        const retryCritique = critiquesByGenerationId[row.id]?.trim() ?? "";
        const critique =
          retryCritique ||
          explorationCritique ||
          "Improve optical balance and small-size clarity.";
        console.log({
          event: "logo_refine_critique_source",
          generationId: row.id,
          fromFailedRefine: Boolean(retryCritique),
          critiquePreview: critique.slice(0, 240),
        });
        const { refined, finalReview } = await refineAndReviewWithGemini(
          {
            gemini: runtime.GEMINI_API_KEY,
            openai: runtime.OPENAI_API_KEY,
          },
          brief as Parameters<typeof refineAndReviewWithGemini>[1],
          {
            base64: arrayBufferToBase64(sourceBytes),
            mimeType: sourceMime,
          },
          critique,
        );
        const recommended =
          finalReview.score >= REFINE_RECOMMENDED_SCORE ? "Recommended" : "Review";
        const id = crypto.randomUUID();
        const extension = refined.mimeType.includes("jpeg") ? "jpg" : "png";
        const objectKey = `users/assets/${user.email.length}/${projectId}/${id}.${extension}`;
        const bytes = Uint8Array.from(atob(refined.data), (character) =>
          character.charCodeAt(0),
        );
        await runtime.FILES.put(objectKey, bytes, {
          httpMetadata: { contentType: refined.mimeType },
        });
        await insertRow("logo_assets", {
          id,
          project_id: projectId,
          user_email: user.email,
          parent_id: row.id,
          stage: "refine",
          label: `Logo refinement ${index + 1}`,
          provider: "google",
          model: "gemini-3-pro-image",
          prompt: [
            `[LOOPEN_LOGO_REFINEMENT]`,
            `[LOOPEN_QC:${finalReview.score}]`,
            `[LOOPEN_STATUS:${recommended}]`,
            `[LOOPEN_REASON:${encodeURIComponent(finalReview.verdict)}]`,
            critique,
          ].join(""),
          object_key: objectKey,
          content_type: refined.mimeType,
          created_at: Date.now(),
        });
        value = {
          id,
          parentId: row.id,
          stage: "refine",
          label: `Logo refinement ${index + 1}`,
          provider: "google",
          model: "gemini-3-pro-image",
          contentType: refined.mimeType,
          qualityScore: finalReview.score,
          reviewReason: finalReview.verdict,
          reviewStatus: recommended,
          url: `/api/assets/${id}`,
          downloadUrl: `/api/assets/${id}?download=1`,
        };
      } else {
        const prompt = buildRefinementPrompt(
          brief as Parameters<typeof buildRefinementPrompt>[0],
          row.direction_title,
          index + 1,
        );
        console.log({
          event: "logo_refine_prompt",
          generationId: row.id,
          direction: row.direction_title,
          variant: index + 1,
          model: "flux-2-dev",
          prompt,
        });
        const form = new FormData();
        form.append("prompt", prompt);
        form.append("input_image_0", new Blob([sourceBytes], { type: "image/png" }), "concept.png");
        form.append("width", "1024");
        form.append("height", "1024");
        form.append("steps", "25");
        form.append("guidance", "3.5");
        form.append("safety_tolerance", "5");

        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-dev`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${runtime.CLOUDFLARE_API_TOKEN}` },
            body: form,
          },
        );
        const payload = (await response.json()) as ImageResponse;
        const inferenceMs = Date.now() - startedAt;
        const base64 = payload.result?.image;
        if (!response.ok || !base64) {
          throw new Error(
            payload.errors?.[0]?.message || "FLUX.2 Dev returned no refined image.",
          );
        }
        console.log({
          event: "logo_refinement_completed",
          generationId: row.id,
          inferenceMs,
          totalMs: Date.now() - startedAt,
        });
        const id = crypto.randomUUID();
        const objectKey = `users/assets/${user.email.length}/${projectId}/${id}.png`;
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
        await runtime.FILES.put(objectKey, bytes, {
          httpMetadata: { contentType: "image/png" },
        });
        await insertRow("logo_assets", {
          id,
          project_id: projectId,
          user_email: user.email,
          parent_id: row.id,
          stage: "refine",
          label: `High fidelity ${index + 1}`,
          provider: "cloudflare",
          model: "flux-2-dev",
          prompt,
          object_key: objectKey,
          content_type: "image/png",
          created_at: Date.now(),
        });
        value = {
          id,
          parentId: row.id,
          stage: "refine",
          label: `High fidelity ${index + 1}`,
          provider: "cloudflare",
          model: "flux-2-dev",
          contentType: "image/png",
          url: `/api/assets/${id}`,
          downloadUrl: `/api/assets/${id}?download=1`,
        };
      }
      results.push({ status: "fulfilled", value });
    } catch (error) {
      results.push({
        status: "rejected",
        reason: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const assets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = results.find((result) => result.status === "rejected");
  if (!assets.length) {
    const reason =
      failure && failure.status === "rejected"
        ? String(
            failure.reason instanceof Error
              ? failure.reason.message
              : failure.reason,
          )
        : "Refinement failed.";
    const timedOut = /timeout|timed out|aborted/i.test(reason);
    return Response.json(
      {
        error: timedOut
          ? "Gemini refinement timed out (high demand). Wait a moment and try again — preferably one concept at a time."
          : reason,
      },
      { status: timedOut ? 503 : 502 },
    );
  }
  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
    { status: "refined", updated_at: Date.now() },
  );
  return Response.json({ assets }, { status: 201 });
}
