import { getChatGPTUser } from "../../../chatgpt-auth";
import { getRuntimeEnv } from "../../../../lib/mvp-runtime";
import { selectOne } from "../../../../lib/supabase";

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
  const generation = await selectOne<{
    object_key: string;
    direction_key: string;
    logo_projects: { brand_name: string };
  }>("logo_generations", {
    select: "object_key,direction_key,logo_projects!inner(brand_name)",
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });

  if (!generation) {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const object = await runtime.FILES.get(generation.object_key);
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
    const safeBrand = generation.logo_projects.brand_name
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeBrand || "loopen"}-${generation.direction_key}.png"`,
    );
  }

  return new Response(object.body, { headers });
}
