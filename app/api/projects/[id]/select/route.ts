import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  ensureSchema,
  getRuntimeEnv,
} from "../../../../../lib/mvp-runtime";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id: projectId } = await context.params;
  const input = (await request.json()) as { generationId?: unknown };
  const generationId =
    typeof input.generationId === "string" ? input.generationId : "";
  if (!generationId) {
    return Response.json(
      { error: "generationId is required." },
      { status: 400 },
    );
  }

  const { DB } = getRuntimeEnv();
  await ensureSchema(DB);
  const generation = await DB.prepare(
    `SELECT id FROM logo_generations
     WHERE id = ? AND project_id = ? AND user_email = ?`,
  )
    .bind(generationId, projectId, user.email)
    .first();

  if (!generation) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }

  await DB.prepare(
    `UPDATE logo_projects
     SET selected_generation_id = ?, status = 'selected', updated_at = ?
     WHERE id = ? AND user_email = ?`,
  )
    .bind(generationId, Date.now(), projectId, user.email)
    .run();

  return Response.json({ ok: true });
}
