import { getChatGPTUser } from "../../chatgpt-auth";
import {
  buildPrompt,
  directions,
  ensureSchema,
  getRuntimeEnv,
  hashIdentity,
  validateBrief,
} from "../../../lib/mvp-runtime";

type OpenAIImageResponse = {
  data?: Array<{ b64_json?: string }>;
  error?: {
    code?: string;
    message?: string;
  };
};

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { DB } = getRuntimeEnv();
  await ensureSchema(DB);

  const result = await DB.prepare(
    `SELECT id, brand_name AS brandName, status, selected_generation_id AS selectedGenerationId,
            created_at AS createdAt
     FROM logo_projects
     WHERE user_email = ?
     ORDER BY created_at DESC
     LIMIT 12`,
  )
    .bind(user.email)
    .all();

  return Response.json({ projects: result.results });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to generate." }, { status: 401 });
  }

  const runtime = getRuntimeEnv();
  await ensureSchema(runtime.DB);

  if (!runtime.OPENAI_API_KEY) {
    return Response.json(
      {
        error:
          "Image generation is not configured yet. Add OPENAI_API_KEY to the production environment.",
      },
      { status: 503 },
    );
  }

  let brief;
  try {
    brief = validateBrief(await request.json());
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid brief." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const recent = await runtime.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM logo_projects
     WHERE user_email = ? AND created_at > ?`,
  )
    .bind(user.email, now - 60 * 60 * 1000)
    .first<{ count: number }>();

  if ((recent?.count ?? 0) >= 3) {
    return Response.json(
      { error: "Hourly generation limit reached. Try again later." },
      { status: 429 },
    );
  }

  const projectId = crypto.randomUUID();
  await runtime.DB.prepare(
    `INSERT INTO logo_projects
      (id, user_email, brand_name, brief_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'generating', ?, ?)`,
  )
    .bind(
      projectId,
      user.email,
      brief.brandName,
      JSON.stringify(brief),
      now,
      now,
    )
    .run();

  const userHash = await hashIdentity(user.email);
  const settled = await Promise.allSettled(
    directions.map(async (direction) => {
      const prompt = buildPrompt(brief, direction);
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${runtime.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-2",
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "medium",
            output_format: "png",
            moderation: "auto",
          }),
        },
      );
      const payload = (await response.json()) as OpenAIImageResponse;
      const base64 = payload.data?.[0]?.b64_json;
      if (!response.ok || !base64) {
        const detail =
          payload.error?.code === "moderation_blocked"
            ? "A concept was blocked by the safety filter. Revise the brief."
            : payload.error?.message || "OpenAI returned no image.";
        throw new Error(detail);
      }

      const generationId = crypto.randomUUID();
      const objectKey = `users/${userHash}/projects/${projectId}/${generationId}.png`;
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );

      await runtime.FILES.put(objectKey, bytes, {
        httpMetadata: { contentType: "image/png" },
        customMetadata: {
          direction: direction.key,
          project: projectId,
        },
      });

      await runtime.DB.prepare(
        `INSERT INTO logo_generations
          (id, project_id, user_email, direction_key, direction_title, prompt,
           object_key, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      )
        .bind(
          generationId,
          projectId,
          user.email,
          direction.key,
          direction.title,
          prompt,
          objectKey,
          Date.now(),
        )
        .run();

      return {
        directionKey: direction.key,
        directionTitle: direction.title,
        downloadUrl: `/api/images/${generationId}?download=1`,
        id: generationId,
        imageUrl: `/api/images/${generationId}`,
      };
    }),
  );

  const generations = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failures = settled.flatMap((result) =>
    result.status === "rejected"
      ? [
          result.reason instanceof Error
            ? result.reason.message
            : "Image generation failed.",
        ]
      : [],
  );

  await runtime.DB.prepare(
    `UPDATE logo_projects SET status = ?, updated_at = ? WHERE id = ?`,
  )
    .bind(generations.length ? "completed" : "failed", Date.now(), projectId)
    .run();

  if (!generations.length) {
    return Response.json(
      { error: failures[0] ?? "No concepts were generated.", projectId },
      { status: 502 },
    );
  }

  return Response.json(
    { failures, generations, projectId },
    { status: 201 },
  );
}
