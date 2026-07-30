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
import {
  arrayBufferToBase64,
  assessLogoImage,
} from "../../../../../lib/logo-quality";

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
  try {
    const user = await getChatGPTUser();
    if (!user?.email) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const userEmail = user.email;
    const runtime = getRuntimeEnv();
    const { id: projectId } = await context.params;
    let assetId = "";
    try {
      const body = (await request.json()) as { assetId?: string };
      assetId = typeof body.assetId === "string" ? body.assetId : "";
    } catch {
      return Response.json({ error: "Invalid vectorize request." }, { status: 400 });
    }
    const asset = await selectOne<{
      id: string;
      object_key: string;
      content_type: string;
      logo_projects: { brief_json: { avoid?: string } };
    }>(
      "logo_assets",
      {
        select: "id,object_key,content_type,logo_projects!inner(brief_json)",
        id: `eq.${assetId}`,
        project_id: `eq.${projectId}`,
        user_email: `eq.${userEmail}`,
        stage: "eq.refine",
      },
    );
    if (!asset) return Response.json({ error: "Refined asset not found." }, { status: 404 });
    const source = await runtime.FILES.get(asset.object_key);
    if (!source) return Response.json({ error: "Refined image data not found." }, { status: 404 });
    const bytes = await source.arrayBuffer();
    if (
      asset.content_type === "image/svg+xml" ||
      asset.object_key.endsWith(".svg")
    ) {
      const svg = sanitizeSvg(new TextDecoder().decode(bytes));
      if (!svg.includes("<svg") || /<text\b|<image\b|<foreignObject\b/i.test(svg)) {
        return Response.json(
          { error: "The refined vector failed structural safety checks." },
          { status: 422 },
        );
      }
      const id = crypto.randomUUID();
      const objectKey = `users/assets/${userEmail.length}/${projectId}/${id}.svg`;
      await runtime.FILES.put(objectKey, svg, {
        httpMetadata: { contentType: "image/svg+xml" },
      });
      await insertRow("logo_assets", {
        id,
        project_id: projectId,
        user_email: userEmail,
        parent_id: asset.id,
        stage: "vector",
        label: "Production SVG",
        provider: "loopen",
        model: "native-vector",
        prompt: "Validated native-vector master",
        object_key: objectKey,
        content_type: "image/svg+xml",
        created_at: Date.now(),
      });
      await updateRows(
        "logo_projects",
        { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
        { status: "vectorized", updated_at: Date.now() },
      );
      return Response.json(
        {
          assets: [{
            id,
            parentId: asset.id,
            stage: "vector",
            label: "Production SVG",
            provider: "loopen",
            model: "native-vector",
            contentType: "image/svg+xml",
            url: `/api/assets/${id}`,
            downloadUrl: `/api/assets/${id}?download=1`,
          }],
        },
        { status: 201 },
      );
    }
    if (!runtime.RECRAFT_API_KEY) {
      return Response.json(
        { error: "Add RECRAFT_API_KEY to vectorize legacy raster refinements." },
        { status: 503 },
      );
    }
    try {
      const quality = await assessLogoImage(
        arrayBufferToBase64(bytes),
        {
          avoid:
            asset.logo_projects.brief_json.avoid ??
            "text, mockups and generic category clichés",
          direction: "the user-approved refined logo symbol",
          stage: "vector",
        },
        runtime,
      );
      if (!quality.approved) {
        return Response.json(
          {
            error: `This refinement is not safe to vectorize (${quality.score}/100): ${quality.reason}`,
          },
          { status: 422 },
        );
      }
    } catch (error) {
      // Moondream preflight is best-effort: when CF vision is down, do not 500
      // an empty body — the user already approved this refinement visually.
      console.warn({
        event: "logo_vector_review_unavailable",
        assetId: asset.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    const jobs = [
      {
        endpoint: "vectorize",
        fileField: "file",
        label: "Exact vector",
        model: "recraft-vectorize",
        fields: {
          response_format: "b64_json",
          svg_compression: "on",
          limit_num_shapes: "on",
          max_num_shapes: "64",
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
        let payload: RecraftResponse;
        try {
          payload = (await response.json()) as RecraftResponse;
        } catch {
          throw new Error(`${job.label} returned an invalid Recraft response.`);
        }
        if (!response.ok) throw new Error(payload.detail || `${job.label} failed.`);
        const svg = sanitizeSvg(await readRecraftSvg(payload));
        if (!svg.includes("<svg")) throw new Error(`${job.label} returned an invalid SVG.`);
        const id = crypto.randomUUID();
        const objectKey = `users/assets/${userEmail.length}/${projectId}/${id}.svg`;
        await runtime.FILES.put(objectKey, svg, { httpMetadata: { contentType: "image/svg+xml" } });
        await insertRow("logo_assets", {
          id,
          project_id: projectId,
          user_email: userEmail,
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
        {
          error:
            failure && failure.status === "rejected"
              ? String(failure.reason?.message ?? failure.reason)
              : "Vectorization failed.",
        },
        { status: 502 },
      );
    }
    await updateRows(
      "logo_projects",
      { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
      { status: "vectorized", updated_at: Date.now() },
    );
    return Response.json({ assets }, { status: 201 });
  } catch (error) {
    console.error({
      event: "logo_vectorize_failed",
      reason: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Vectorization could not be completed.",
      },
      { status: 500 },
    );
  }
}
