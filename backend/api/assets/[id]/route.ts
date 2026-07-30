import { getChatGPTUser } from "@/backend/auth/chatgpt-auth";
import { getRuntimeEnv } from "@/backend/lib/mvp-runtime";
import { selectOne } from "@/backend/lib/supabase";

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
    return Response.json({ error: "Asset not found." }, { status: 404 });
  }

  const object = await runtime.FILES.get(asset.object_key);
  if (!object?.body) {
    return Response.json({ error: "Asset data not found." }, { status: 404 });
  }

  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    "Content-Type": asset.content_type,
    ETag: object.httpEtag,
  });
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
  return new Response(object.body, { headers });
}
