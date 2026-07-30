import { getChatGPTUser } from "@/backend/auth/chatgpt-auth";
import {
  deleteRows,
  selectOne,
  selectRows,
  updateRows,
} from "@/backend/lib/supabase";
import { getObject, removeObjects } from "@/backend/lib/storage";

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

  const object = await getObject(generation.object_key);
  if (!object) {
    return Response.json({ error: "Image data not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const headers = new Headers({
    "Cache-Control": "private, max-age=3600",
    "Content-Type": object.contentType || "image/png",
    ETag: object.etag,
  });

  if (url.searchParams.get("download") === "1") {
    const safeBrand = generation.logo_projects.brand_name
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const extension =
      object.contentType === "image/svg+xml" ? "svg" : "png";
    headers.set(
      "Content-Disposition",
      `attachment; filename="${safeBrand || "loopen"}-${generation.direction_key}.${extension}"`,
    );
  }

  return new Response(Buffer.from(object.body), { headers });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }
  const { id } = await context.params;
  const generation = await selectOne<{
    object_key: string;
    project_id: string;
  }>(
    "logo_generations",
    {
      select: "object_key,project_id",
      id: `eq.${id}`,
      user_email: `eq.${user.email}`,
    },
  );
  if (!generation) {
    return Response.json({ error: "Concept not found." }, { status: 404 });
  }
  const assets = await selectRows<{ object_key: string }>("logo_assets", {
    select: "object_key",
    parent_id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  await deleteRows("logo_assets", {
    parent_id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  await deleteRows("logo_generations", {
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  await updateRows(
    "logo_projects",
    {
      id: `eq.${generation.project_id}`,
      user_email: `eq.${user.email}`,
      selected_generation_id: `eq.${id}`,
    },
    { selected_generation_id: null, updated_at: Date.now() },
  );
  await removeObjects([
    generation.object_key,
    ...assets.map((asset) => asset.object_key),
  ]);
  return new Response(null, { status: 204 });
}
