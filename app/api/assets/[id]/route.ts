import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureSchema, getRuntimeEnv } from "../../../../lib/mvp-runtime";

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
  const asset = await runtime.DB.prepare(
    `SELECT a.object_key AS objectKey, a.content_type AS contentType, a.label,
            p.brand_name AS brandName
     FROM logo_assets a JOIN logo_projects p ON p.id = a.project_id
     WHERE a.id = ? AND a.user_email = ?`,
  )
    .bind(id, user.email)
    .first<{ objectKey: string; contentType: string; label: string; brandName: string }>();

  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  const object = await runtime.FILES.get(asset.objectKey);
  if (!object?.body) {
    return Response.json({ error: "Asset data not found." }, { status: 404 });
  }

  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    "Content-Type": asset.contentType,
    ETag: object.httpEtag,
  });
  if (new URL(request.url).searchParams.get("download") === "1") {
    const name = `${asset.brandName}-${asset.label}`
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${name || "loopen-asset"}.${asset.contentType.includes("svg") ? "svg" : "png"}"`,
    );
  }
  return new Response(object.body, { headers });
}
