import { ensureStudioWallet, getStudioUser } from "@/backend/auth/session";
import { getRuntimeEnv } from "@/backend/lib/mvp-runtime";
import {
  RATE_LIMITS,
  assertRateLimit,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import {
  InsufficientSignalsError,
  refundSignals,
  spendSignals,
} from "@/backend/lib/signals";
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
import { getObject, putObject } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  if (!runtime.OPENAI_API_KEY || !runtime.GEMINI_API_KEY) {
    return Response.json(
      { error: "Refinement requires OPENAI_API_KEY and GEMINI_API_KEY." },
      { status: 503 },
    );
  }

  const { id: projectId } = await context.params;
  let signalsSpent = false;
  try {
    await assertRateLimit(user.email, RATE_LIMITS.refineUser);
    await ensureStudioWallet(user.email);
    await spendSignals(user.email, "refine", projectId);
    signalsSpent = true;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof InsufficientSignalsError) {
      return Response.json(
        {
          error: error.message,
          code: error.code,
          required: error.required,
        },
        { status: 402 },
      );
    }
    throw error;
  }
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
    if (signalsSpent) await refundSignals(user.email, "refine", projectId);
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
    if (signalsSpent) await refundSignals(user.email, "refine", projectId);
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
      const source = await getObject(row.object_key);
      if (!source) throw new Error("Source image not found.");
      const sourceBytes = await source.arrayBuffer();
      const brief = row.logo_projects.brief_json;
      let value: RefineAsset;
      if (
        source.contentType === "image/svg+xml" ||
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
        await putObject(objectKey, new TextEncoder().encode(refined.svg), {
          contentType: "image/svg+xml",
        });
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
      } else {
        const sourceMime = source.contentType || "image/png";
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
            gemini: runtime.GEMINI_API_KEY!,
            openai: runtime.OPENAI_API_KEY!,
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
        await putObject(objectKey, bytes, {
          contentType: refined.mimeType,
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
    if (signalsSpent) {
      try {
        await refundSignals(user.email, "refine", projectId);
      } catch (refundError) {
        console.error({
          event: "signal_refund_failed",
          projectId,
          reason:
            refundError instanceof Error
              ? refundError.message
              : String(refundError),
        });
      }
    }
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
          ? "Gemini refinement timed out (high demand). Wait a moment and try again — preferably one concept at a time. Signals were returned."
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
