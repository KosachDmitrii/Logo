import { getChatGPTUser } from "@/backend/auth/chatgpt-auth";
import { applyCorsHeaders } from "@/backend/lib/cors";
import { selectOne } from "@/backend/lib/supabase";
import { getObject } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
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
