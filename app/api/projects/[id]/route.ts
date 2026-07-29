import { getChatGPTUser } from "../../../chatgpt-auth";
import { ensureSchema, getRuntimeEnv } from "../../../../lib/mvp-runtime";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const { DB } = getRuntimeEnv();
  await ensureSchema(DB);
  const project = await DB.prepare(
    `SELECT id, brand_name AS brandName, brief_json AS briefJson, status,
            selected_generation_id AS selectedGenerationId, created_at AS createdAt
     FROM logo_projects WHERE id = ? AND user_email = ?`,
  )
    .bind(id, user.email)
    .first<Record<string, unknown>>();

  if (!project) {
    return Response.json({ error: "Project not found." }, { status: 404 });
  }

  const [generations, assets] = await Promise.all([
    DB.prepare(
      `SELECT id, direction_key AS directionKey, direction_title AS directionTitle,
              created_at AS createdAt
       FROM logo_generations WHERE project_id = ? AND user_email = ?
       ORDER BY created_at`,
    )
      .bind(id, user.email)
      .all(),
    DB.prepare(
      `SELECT id, parent_id AS parentId, stage, label, provider, model,
              content_type AS contentType, created_at AS createdAt
       FROM logo_assets WHERE project_id = ? AND user_email = ?
       ORDER BY created_at`,
    )
      .bind(id, user.email)
      .all(),
  ]);

  return Response.json({
    project: { ...project, brief: JSON.parse(String(project.briefJson)), briefJson: undefined },
    generations: generations.results.map((item) => ({
      ...item,
      downloadUrl: `/api/images/${item.id}?download=1`,
      imageUrl: `/api/images/${item.id}`,
    })),
    assets: assets.results.map((item) => ({
      ...item,
      downloadUrl: `/api/assets/${item.id}?download=1`,
      url: `/api/assets/${item.id}`,
    })),
  });
}
