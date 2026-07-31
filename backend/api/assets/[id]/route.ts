import { getStudioUser } from "@/backend/auth/session";
import { applyCorsHeaders } from "@/backend/lib/cors";
import { deleteRows, selectOne, updateRows } from "@/backend/lib/supabase";
import { getObject, removeObjects } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401, headers: applyCorsHeaders(request, new Headers()) },
    );
  }

  const { id } = await context.params;
  const asset = await selectOne<{
    object_key: string;
    content_type: string;
    label: string;
    logo_projects: { brand_name: string };
  }>("logo_assets", {
    select: "object_key,content_type,label,logo_projects!inner(brand_name)",
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });

  if (!asset) {
    return Response.json(
      { error: "Asset not found." },
      { status: 404, headers: applyCorsHeaders(request, new Headers()) },
    );
  }

  const object = await getObject(asset.object_key);
  if (!object) {
    return Response.json(
      { error: "Asset data not found." },
      { status: 404, headers: applyCorsHeaders(request, new Headers()) },
    );
  }

  const headers = applyCorsHeaders(
    request,
    new Headers({
      "Cache-Control": "private, max-age=3600",
      "Content-Type": asset.content_type,
      ETag: object.etag,
    }),
  );
  if (new URL(request.url).searchParams.get("download") === "1") {
    const name = `${asset.logo_projects.brand_name}-${asset.label}`
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${name || "loopen-asset"}.${asset.content_type.includes("svg") ? "svg" : "png"}"`,
    );
  }
  return new Response(Buffer.from(object.body), { headers });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user?.email) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  const asset = await selectOne<{
    id: string;
    object_key: string;
    project_id: string;
    stage: string;
  }>("logo_assets", {
    select: "id,object_key,project_id,stage",
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  if (!asset) {
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  await deleteRows("logo_assets", {
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  await removeObjects([asset.object_key]);
  await updateRows(
    "logo_projects",
    { id: `eq.${asset.project_id}`, user_email: `eq.${user.email}` },
    { updated_at: Date.now() },
  );

  return Response.json({ ok: true, id: asset.id, stage: asset.stage });
}
