import { getChatGPTUser } from "../../chatgpt-auth";
import {
  buildPrompt,
  directions,
  getRuntimeEnv,
  hashIdentity,
  validateBrief,
} from "../../../lib/mvp-runtime";
import {
  countRows,
  insertRow,
  selectRows,
  updateRows,
} from "../../../lib/supabase";

type ProjectRow = {
  id: string;
  brand_name: string;
  status: string;
  selected_generation_id: string | null;
  created_at: number;
  updated_at: number;
};

type CloudflareImageResponse = {
  success?: boolean;
  result?: { image?: string };
  errors?: Array<{ message?: string }>;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = await selectRows<ProjectRow>("logo_projects", {
    select:
      "id,brand_name,status,selected_generation_id,created_at,updated_at",
    user_email: `eq.${user.email}`,
    order: "created_at.desc",
    limit: 12,
  });
  return Response.json({
    projects: rows.map((row) => ({
      id: row.id,
      brandName: row.brand_name,
      status: row.status,
      selectedGenerationId: row.selected_generation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to generate." }, { status: 401 });
  }

  const runtime = getRuntimeEnv();
  if (!runtime.CLOUDFLARE_ACCOUNT_ID || !runtime.CLOUDFLARE_API_TOKEN) {
    return Response.json(
      {
        error:
          "Concept generation is not configured. Add the Cloudflare account ID and Workers AI token.",
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
  const recent = await countRows("logo_projects", {
    user_email: `eq.${user.email}`,
    created_at: `gt.${now - 60 * 60 * 1000}`,
  });
  if (recent >= 3) {
    return Response.json(
      { error: "Hourly generation limit reached. Try again later." },
      { status: 429 },
    );
  }

  const projectId = crypto.randomUUID();
  await insertRow("logo_projects", {
    id: projectId,
    user_email: user.email,
    brand_name: brief.brandName,
    brief_json: brief,
    status: "generating",
    selected_generation_id: null,
    created_at: now,
    updated_at: now,
  });

  const userHash = await hashIdentity(user.email);
  const settled = await Promise.allSettled(
    directions.map(async (direction) => {
      const prompt = buildPrompt(brief, direction);
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-2-dev`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${runtime.CLOUDFLARE_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            width: 1024,
            height: 1024,
            steps: 12,
            seed: crypto.getRandomValues(new Uint32Array(1))[0],
          }),
        },
      );
      const payload = (await response.json()) as CloudflareImageResponse;
      const base64 = payload.result?.image;
      if (!response.ok || !base64) {
        throw new Error(
          payload.errors?.[0]?.message || "Cloudflare Workers AI returned no image.",
        );
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

      await insertRow("logo_generations", {
        id: generationId,
        project_id: projectId,
        user_email: user.email,
        direction_key: direction.key,
        direction_title: direction.title,
        prompt,
        object_key: objectKey,
        status: "completed",
        created_at: Date.now(),
      });

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

  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
    {
      status: generations.length ? "completed" : "failed",
      updated_at: Date.now(),
    },
  );

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
