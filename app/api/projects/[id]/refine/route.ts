import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  buildRefinementPrompt,
  getRuntimeEnv,
} from "../../../../../lib/mvp-runtime";
import {
  insertRow,
  selectOne,
  updateRows,
} from "../../../../../lib/supabase";

type ImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: { code?: string; message?: string };
};

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  if (!runtime.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI refinement is not configured." }, { status: 503 });
  }

  const { id: projectId } = await context.params;
  const { generationId } = (await request.json()) as { generationId?: string };
  const row = await selectOne<{
    id: string;
    object_key: string;
    direction_title: string;
    logo_projects: { brief_json: Record<string, unknown> };
  }>("logo_generations", {
    select:
      "id,object_key,direction_title,logo_projects!inner(brief_json)",
    id: `eq.${generationId ?? ""}`,
    project_id: `eq.${projectId}`,
    user_email: `eq.${user.email}`,
  });
  if (!row) return Response.json({ error: "Selected concept not found." }, { status: 404 });

  const source = await runtime.FILES.get(row.object_key);
  if (!source) return Response.json({ error: "Source image not found." }, { status: 404 });
  const sourceBytes = await source.arrayBuffer();
  const brief = row.logo_projects.brief_json;

  const results = await Promise.allSettled(
    [1, 2].map(async (variant) => {
      const prompt = buildRefinementPrompt(
        brief as Parameters<typeof buildRefinementPrompt>[0],
        row.direction_title,
        variant,
      );
      const form = new FormData();
      form.append("model", "gpt-image-2");
      form.append("image[]", new Blob([sourceBytes], { type: "image/png" }), "concept.png");
      form.append("prompt", prompt);
      form.append("size", "1024x1024");
      form.append("quality", "high");
      form.append("output_format", "png");

      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${runtime.OPENAI_API_KEY}` },
        body: form,
      });
      const payload = (await response.json()) as ImageResponse;
      const base64 = payload.data?.[0]?.b64_json;
      if (!response.ok || !base64) {
        throw new Error(
          payload.error?.code === "moderation_blocked"
            ? "A refinement was blocked by the safety filter."
            : payload.error?.message || "OpenAI returned no refined image.",
        );
      }
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
        label: `Refinement ${variant}`,
        provider: "openai",
        model: "gpt-image-2",
        prompt,
        object_key: objectKey,
        content_type: "image/png",
        created_at: Date.now(),
      });
      return {
        id,
        parentId: row.id,
        stage: "refine",
        label: `Refinement ${variant}`,
        provider: "openai",
        model: "gpt-image-2",
        contentType: "image/png",
        url: `/api/assets/${id}`,
        downloadUrl: `/api/assets/${id}?download=1`,
      };
    }),
  );

  const assets = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = results.find((result) => result.status === "rejected");
  if (!assets.length) {
    return Response.json(
      { error: failure && failure.status === "rejected" ? String(failure.reason?.message ?? failure.reason) : "Refinement failed." },
      { status: 502 },
    );
  }
  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
    { status: "refined", updated_at: Date.now() },
  );
  return Response.json({ assets }, { status: 201 });
}
