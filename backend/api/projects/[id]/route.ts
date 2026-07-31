import { getStudioUser } from "@/backend/auth/session";
import { directions } from "@/backend/lib/mvp-runtime";
import { deleteRows, selectOne, selectRows } from "@/backend/lib/supabase";
import { removeObjects } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const project = await selectOne<{
    id: string;
    brand_name: string;
    brief_json: Record<string, unknown>;
    status: string;
    selected_generation_id: string | null;
    created_at: number;
  }>("logo_projects", {
    select:
      "id,brand_name,brief_json,status,selected_generation_id,created_at",
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });

  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const [generations, assets] = await Promise.all([
    selectRows<{
      id: string;
      direction_key: string;
      direction_title: string;
      prompt: string;
      created_at: number;
    }>("logo_generations", {
      select: "id,direction_key,direction_title,prompt,created_at",
      project_id: `eq.${id}`,
      user_email: `eq.${user.email}`,
      order: "created_at.asc",
    }),
    selectRows<{
      id: string;
      parent_id: string;
      stage: "refine" | "vector";
      label: string;
      provider: string;
      model: string;
      content_type: string;
      prompt: string;
      created_at: number;
    }>("logo_assets", {
      select:
        "id,parent_id,stage,label,provider,model,content_type,prompt,created_at",
      project_id: `eq.${id}`,
      user_email: `eq.${user.email}`,
      order: "created_at.asc",
    }),
  ]);

  return Response.json({
    project: {
      id: project.id,
      brandName: project.brand_name,
      brief: project.brief_json,
      status: project.status,
      selectedGenerationId: project.selected_generation_id,
      createdAt: project.created_at,
    },
    generations: generations.map((item) => ({
      id: item.id,
      directionKey: item.direction_key,
      directionTitle: item.direction_title,
      rationale:
        (
          project.brief_json.strategy as
            | { creativeDirections?: Array<{ title: string; thesis: string }> }
            | undefined
        )?.creativeDirections?.find(
          (direction) => direction.title === item.direction_title,
        )?.thesis ??
        directions.find((direction) => direction.key === item.direction_key)
          ?.thesis ?? "A distinct strategic route for the brand.",
      createdAt: item.created_at,
      qualityScore: Number(item.prompt.match(/\[LOOPEN_QC:(\d+)\]/)?.[1]) || undefined,
      reviewStatus:
        item.prompt.match(/\[LOOPEN_STATUS:([^\]]+)\]/)?.[1] ?? "Review",
      reviewReason: decodeURIComponent(
        item.prompt.match(/\[LOOPEN_REASON:([^\]]*)\]/)?.[1] ??
          "Inspect this concept before refinement.",
      ),
      downloadUrl: `/api/images/${item.id}?download=1`,
      imageUrl: `/api/images/${item.id}`,
    })),
    assets: assets.map((item) => ({
      id: item.id,
      parentId: item.parent_id,
      stage: item.stage,
      label: item.label,
      provider: item.provider,
      model: item.model,
      contentType: item.content_type,
      createdAt: item.created_at,
      qualityScore: Number(item.prompt.match(/\[LOOPEN_QC:(\d+)\]/)?.[1]) || undefined,
      reviewStatus:
        item.prompt.match(/\[LOOPEN_STATUS:([^\]]+)\]/)?.[1] ?? "Review",
      reviewReason: decodeURIComponent(
        item.prompt.match(/\[LOOPEN_REASON:([^\]]*)\]/)?.[1] ??
          "Inspect this asset before production.",
      ),
      downloadUrl: `/api/assets/${item.id}?download=1`,
      url: `/api/assets/${item.id}`,
    })),
  });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const project = await selectOne<{ id: string }>("logo_projects", {
    select: "id",
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });
  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const [generations, assets] = await Promise.all([
    selectRows<{ object_key: string }>("logo_generations", {
      select: "object_key",
      project_id: `eq.${id}`,
      user_email: `eq.${user.email}`,
    }),
    selectRows<{ object_key: string }>("logo_assets", {
      select: "object_key",
      project_id: `eq.${id}`,
      user_email: `eq.${user.email}`,
    }),
  ]);

  await deleteRows("logo_projects", {
    id: `eq.${id}`,
    user_email: `eq.${user.email}`,
  });

  const objectKeys = [...generations, ...assets].map((item) => item.object_key);
  if (objectKeys.length) {
    try {
      await removeObjects(objectKeys);
    } catch (error) {
      console.error(
        "Project metadata was deleted, but storage cleanup failed:",
        error,
      );
    }
  }

  return new Response(null, { status: 204 });
}
