import { getChatGPTUser } from "../../../chatgpt-auth";
import {
  ensureSchema,
  getRuntimeEnv,
} from "../../../../lib/mvp-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const runtime = getRuntimeEnv();
  await ensureSchema(runtime.DB);

  const generation = await runtime.DB.prepare(
    `SELECT g.object_key AS objectKey, g.direction_key AS directionKey,
            p.brand_name AS brandName
     FROM logo_generations g
     JOIN logo_projects p ON p.id = g.project_id
     WHERE g.id = ? AND g.user_email = ?`,
  )
    .bind(id, user.email)
    .first<{
      brandName: string;
      directionKey: string;
      objectKey: string;
    }>();

  if (!generation) {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const object = await runtime.FILES.get(generation.objectKey);
  if (!object?.body) {
    return Response.json({ error: "Image data not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    "Content-Type": object.httpMetadata?.contentType ?? "image/png",
    ETag: object.httpEtag,
  });

  if (url.searchParams.get("download") === "1") {
    const safeBrand = generation.brandName
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeBrand || "loopen"}-${generation.directionKey}.png"`,
    );
  }

  return new Response(object.body, { headers });
}
