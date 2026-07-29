import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  getRuntimeEnv,
  sanitizeSvg,
} from "../../../../../lib/mvp-runtime";
import {
  insertRow,
  selectOne,
  updateRows,
} from "../../../../../lib/supabase";

type RecraftResponse = {
  image?: { b64_json?: string; url?: string };
  data?: Array<{ b64_json?: string; url?: string }>;
  detail?: string;
};

export const dynamic = "force-dynamic";

async function readRecraftSvg(payload: RecraftResponse) {
  const base64 = payload.image?.b64_json ?? payload.data?.[0]?.b64_json;
  if (base64) return atob(base64);
  const url = payload.image?.url ?? payload.data?.[0]?.url;
  if (!url) throw new Error(payload.detail || "Recraft returned no vector.");
  const response = await fetch(url);
  if (!response.ok) throw new Error("Recraft vector could not be downloaded.");
  return response.text();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  if (!runtime.RECRAFT_API_KEY) {
    return Response.json(
      { error: "Add RECRAFT_API_KEY to the production environment to create SVG files." },
      { status: 503 },
    );
  }

  const { id: projectId } = await context.params;
  const { assetId } = (await request.json()) as { assetId?: string };
  const asset = await selectOne<{ id: string; object_key: string }>(
    "logo_assets",
    {
      select: "id,object_key",
      id: `eq.${assetId ?? ""}`,
      project_id: `eq.${projectId}`,
      user_email: `eq.${user.email}`,
      stage: "eq.refine",
    },
  );
  if (!asset) return Response.json({ error: "Refined asset not found." }, { status: 404 });
  const source = await runtime.FILES.get(asset.object_key);
  if (!source) return Response.json({ error: "Refined image data not found." }, { status: 404 });
  const bytes = await source.arrayBuffer();

  const jobs = [
    {
      endpoint: "vectorize",
      fileField: "file",
      label: "Preserve original",
      model: "recraft-vectorize",
      fields: { response_format: "b64_json", svg_compression: "on", limit_num_shapes: "on", max_num_shapes: "64" },
    },
    {
      endpoint: "imageToImage",
      fileField: "image",
      label: "Clean reconstruction",
      model: "recraftv3_vector",
      fields: {
        prompt: "Clean minimal professional logo vector. Preserve the exact central symbol and silhouette. Simplify contours, remove raster artifacts, use flat black shapes only, no text, no background.",
        strength: "0.15",
        model: "recraftv3_vector",
        response_format: "b64_json",
      },
    },
  ] as const;

  const settled = await Promise.allSettled(
    jobs.map(async (job) => {
      const form = new FormData();
      form.append(job.fileField, new Blob([bytes], { type: "image/png" }), "refined.png");
      Object.entries(job.fields).forEach(([key, value]) => form.append(key, value));
      const response = await fetch(`https://external.api.recraft.ai/v1/images/${job.endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${runtime.RECRAFT_API_KEY}` },
        body: form,
      });
      const payload = (await response.json()) as RecraftResponse;
      if (!response.ok) throw new Error(payload.detail || `${job.label} failed.`);
      const svg = sanitizeSvg(await readRecraftSvg(payload));
      if (!svg.includes("<svg")) throw new Error(`${job.label} returned an invalid SVG.`);
      const id = crypto.randomUUID();
      const objectKey = `users/assets/${user.email.length}/${projectId}/${id}.svg`;
      await runtime.FILES.put(objectKey, svg, { httpMetadata: { contentType: "image/svg+xml" } });
      await insertRow("logo_assets", {
        id,
        project_id: projectId,
        user_email: user.email,
        parent_id: asset.id,
        stage: "vector",
        label: job.label,
        provider: "recraft",
        model: job.model,
        prompt:
          "prompt" in job.fields
            ? job.fields.prompt
            : "Raster-to-vector preservation",
        object_key: objectKey,
        content_type: "image/svg+xml",
        created_at: Date.now(),
      });
      return {
        id,
        parentId: asset.id,
        stage: "vector",
        label: job.label,
        provider: "recraft",
        model: job.model,
        contentType: "image/svg+xml",
        url: `/api/assets/${id}`,
        downloadUrl: `/api/assets/${id}?download=1`,
      };
    }),
  );

  const assets = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  const failure = settled.find((result) => result.status === "rejected");
  if (!assets.length) {
    return Response.json(
      { error: failure && failure.status === "rejected" ? String(failure.reason?.message ?? failure.reason) : "Vectorization failed." },
      { status: 502 },
    );
  }
  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
    { status: "vectorized", updated_at: Date.now() },
  );
  return Response.json({ assets }, { status: 201 });
}
