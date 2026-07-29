import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  buildRefinementPrompt,
  ensureSchema,
  getRuntimeEnv,
} from "../../../../../lib/mvp-runtime";

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
  await ensureSchema(runtime.DB);
  if (!runtime.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI refinement is not configured." }, { status: 503 });
  }

  const { id: projectId } = await context.params;
  const { generationId } = (await request.json()) as { generationId?: string };
  const row = await runtime.DB.prepare(
    `SELECT g.id, g.object_key AS objectKey, g.direction_title AS directionTitle,
            p.brief_json AS briefJson
     FROM logo_generations g JOIN logo_projects p ON p.id = g.project_id
     WHERE g.id = ? AND g.project_id = ? AND g.user_email = ?`,
  )
    .bind(generationId ?? "", projectId, user.email)
    .first<{ id: string; objectKey: string; directionTitle: string; briefJson: string }>();
  if (!row) return Response.json({ error: "Selected concept not found." }, { status: 404 });

  const source = await runtime.FILES.get(row.objectKey);
  if (!source) return Response.json({ error: "Source image not found." }, { status: 404 });
  const sourceBytes = await source.arrayBuffer();
  const brief = JSON.parse(row.briefJson);

  const results = await Promise.allSettled(
    [1, 2].map(async (variant) => {
      const prompt = buildRefinementPrompt(brief, row.directionTitle, variant);
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
      await runtime.DB.prepare(
        `INSERT INTO logo_assets
          (id, project_id, user_email, parent_id, stage, label, provider, model,
           prompt, object_key, content_type, created_at)
         VALUES (?, ?, ?, ?, 'refine', ?, 'openai', 'gpt-image-2', ?, ?, 'image/png', ?)`,
      )
        .bind(id, projectId, user.email, row.id, `Refinement ${variant}`, prompt, objectKey, Date.now())
        .run();
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
  await runtime.DB.prepare(
    `UPDATE logo_projects SET status = 'refined', updated_at = ? WHERE id = ? AND user_email = ?`,
  ).bind(Date.now(), projectId, user.email).run();
  return Response.json({ assets }, { status: 201 });
}
