import { getStudioUser } from "@/backend/auth/session";
import { selectOne, updateRows } from "@/backend/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
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

  const generation = await selectOne<{ id: string }>("logo_generations", {
    select: "id",
    id: `eq.${generationId}`,
    project_id: `eq.${projectId}`,
    user_email: `eq.${user.email}`,
  });

  if (!generation) {
    return Response.json({ error: "Generation not found." }, { status: 404 });
  }

  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
    {
      selected_generation_id: generationId,
      status: "selected",
      updated_at: Date.now(),
    },
  );

  return Response.json({ ok: true });
}
