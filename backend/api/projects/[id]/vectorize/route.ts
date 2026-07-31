import { ensureStudioWallet, getStudioUser } from "@/backend/auth/session";
import {
  getRuntimeEnv,
  sanitizeSvg,
} from "@/backend/lib/mvp-runtime";
import {
  RATE_LIMITS,
  assertRateLimit,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import {
  InsufficientSignalsError,
  refundSignals,
  spendSignals,
} from "@/backend/lib/signals";
import {
  insertRow,
  selectOne,
  updateRows,
} from "@/backend/lib/supabase";
import { arrayBufferToBase64 } from "@/backend/lib/logo-quality";
import { reconstructArchitecturalLogoSvg } from "@/backend/lib/vector-art-direction";
import type { LogoBrief } from "@/backend/lib/mvp-runtime";
import { getObject, putObject } from "@/backend/lib/storage";

type RecraftResponse = {
  image?: { b64_json?: string; url?: string };
  data?: Array<{ b64_json?: string; url?: string }>;
  detail?: string;
};

type VectorSource = {
  id: string;
  object_key: string;
  content_type: string;
  brief: LogoBrief;
  kind: "refine" | "exploration";
};

type VectorAssetPayload = {
  id: string;
  parentId: string;
  stage: "vector";
  label: string;
  provider: string;
  model: string;
  contentType: "image/svg+xml";
  url: string;
  downloadUrl: string;
  qualityScore?: number;
  reviewReason?: string;
  reviewStatus?: string;
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

async function vectorizeWithRecraft(options: {
  apiKey: string;
  bytes: ArrayBuffer;
  projectId: string;
  userEmail: string;
  source: VectorSource;
}): Promise<VectorAssetPayload> {
  const { apiKey, bytes, projectId, userEmail, source } = options;
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "source.png");
  form.append("response_format", "b64_json");
  form.append("svg_compression", "on");
  form.append("limit_num_shapes", "on");
  form.append("max_num_shapes", "64");
  const response = await fetch(
    "https://external.api.recraft.ai/v1/images/vectorize",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    },
  );
  let payload: RecraftResponse;
  try {
    payload = (await response.json()) as RecraftResponse;
  } catch {
    throw new Error("Exact vector returned an invalid Recraft response.");
  }
  if (!response.ok) {
    throw new Error(payload.detail || "Exact vector failed.");
  }
  const svg = sanitizeSvg(await readRecraftSvg(payload));
  if (!svg.includes("<svg")) {
    throw new Error("Exact vector returned an invalid SVG.");
  }
  const id = crypto.randomUUID();
  const objectKey = `users/assets/${userEmail.length}/${projectId}/${id}.svg`;
  await putObject(objectKey, svg, { contentType: "image/svg+xml" });
  const label =
    source.kind === "exploration"
      ? "Exact vector from original concept"
      : "Exact vector from refinement";
  await insertRow("logo_assets", {
    id,
    project_id: projectId,
    user_email: userEmail,
    parent_id: source.id,
    stage: "vector",
    label,
    provider: "recraft",
    model: "recraft-vectorize",
    prompt: "Raster-to-vector silhouette preservation",
    object_key: objectKey,
    content_type: "image/svg+xml",
    created_at: Date.now(),
  });
  return {
    id,
    parentId: source.id,
    stage: "vector",
    label,
    provider: "recraft",
    model: "recraft-vectorize",
    contentType: "image/svg+xml",
    url: `/api/assets/${id}`,
    downloadUrl: `/api/assets/${id}?download=1`,
  };
}

async function vectorizeWithGpt(options: {
  apiKey: string;
  bytes: ArrayBuffer;
  projectId: string;
  userEmail: string;
  source: VectorSource;
}): Promise<VectorAssetPayload> {
  const { apiKey, bytes, projectId, userEmail, source } = options;
  const master = await reconstructArchitecturalLogoSvg(source.brief, apiKey, {
    base64: arrayBufferToBase64(bytes),
    mimeType: source.content_type || "image/png",
  });
  const svg = sanitizeSvg(master.svg);
  const id = crypto.randomUUID();
  const objectKey = `users/assets/${userEmail.length}/${projectId}/${id}.svg`;
  await putObject(objectKey, svg, {
    contentType: "image/svg+xml",
  });
  const label =
    source.kind === "exploration"
      ? "SVG from original concept"
      : "Geometrically reconstructed SVG master";
  await insertRow("logo_assets", {
    id,
    project_id: projectId,
    user_email: userEmail,
    parent_id: source.id,
    stage: "vector",
    label,
    provider: "openai",
    model: "gpt-5.6-terra",
    prompt: [
      `[LOOPEN_GEOMETRIC_RECONSTRUCTION]`,
      `[LOOPEN_QC:${master.score}]`,
      `[LOOPEN_STATUS:${master.score >= 75 ? "Recommended" : "Review"}]`,
      `[LOOPEN_REASON:${encodeURIComponent(master.verdict)}]`,
      master.rationale,
    ].join(""),
    object_key: objectKey,
    content_type: "image/svg+xml",
    created_at: Date.now(),
  });
  return {
    id,
    parentId: source.id,
    stage: "vector",
    label,
    provider: "openai",
    model: "gpt-5.6-terra",
    contentType: "image/svg+xml",
    qualityScore: master.score,
    reviewReason: master.verdict,
    reviewStatus: master.score >= 75 ? "Recommended" : "Review",
    url: `/api/assets/${id}`,
    downloadUrl: `/api/assets/${id}?download=1`,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getStudioUser();
    if (!user?.email) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    const userEmail = user.email;
    const runtime = getRuntimeEnv();
    const { id: projectId } = await context.params;
    let assetId = "";
    let generationId = "";
    try {
      const body = (await request.json()) as {
        assetId?: string;
        generationId?: string;
      };
      assetId = typeof body.assetId === "string" ? body.assetId : "";
      generationId =
        typeof body.generationId === "string" ? body.generationId : "";
    } catch {
      return Response.json({ error: "Invalid vectorize request." }, { status: 400 });
    }
    if (!assetId && !generationId) {
      return Response.json(
        { error: "Select a concept or refinement to vectorize." },
        { status: 400 },
      );
    }

    let source: VectorSource | null = null;
    if (assetId) {
      const asset = await selectOne<{
        id: string;
        object_key: string;
        content_type: string;
        logo_projects: { brief_json: LogoBrief };
      }>("logo_assets", {
        select: "id,object_key,content_type,logo_projects!inner(brief_json)",
        id: `eq.${assetId}`,
        project_id: `eq.${projectId}`,
        user_email: `eq.${userEmail}`,
        stage: "eq.refine",
      });
      if (asset) {
        source = {
          id: asset.id,
          object_key: asset.object_key,
          content_type: asset.content_type,
          brief: asset.logo_projects.brief_json,
          kind: "refine",
        };
      }
    } else if (generationId) {
      const generation = await selectOne<{
        id: string;
        object_key: string;
        logo_projects: { brief_json: LogoBrief };
      }>("logo_generations", {
        select: "id,object_key,logo_projects!inner(brief_json)",
        id: `eq.${generationId}`,
        project_id: `eq.${projectId}`,
        user_email: `eq.${userEmail}`,
      });
      if (generation) {
        source = {
          id: generation.id,
          object_key: generation.object_key,
          content_type: generation.object_key.endsWith(".svg")
            ? "image/svg+xml"
            : "image/png",
          brief: generation.logo_projects.brief_json,
          kind: "exploration",
        };
      }
    }
    if (!source) {
      return Response.json(
        { error: "Selected image was not found." },
        { status: 404 },
      );
    }

    let signalsSpent = false;
    try {
      await assertRateLimit(userEmail, RATE_LIMITS.vectorizeUser);
      await ensureStudioWallet(userEmail);
      await spendSignals(userEmail, "vectorize", projectId);
      signalsSpent = true;
    } catch (error) {
      if (error instanceof RateLimitError) {
        return Response.json({ error: error.message }, { status: 429 });
      }
      if (error instanceof InsufficientSignalsError) {
        return Response.json(
          {
            error: error.message,
            code: error.code,
            required: error.required,
          },
          { status: 402 },
        );
      }
      throw error;
    }

    const refundIfNeeded = async () => {
      if (!signalsSpent) return;
      try {
        await refundSignals(userEmail, "vectorize", projectId);
      } catch (refundError) {
        console.error({
          event: "signal_refund_failed",
          projectId,
          reason:
            refundError instanceof Error
              ? refundError.message
              : String(refundError),
        });
      }
    };

    const file = await getObject(source.object_key);
    if (!file) {
      await refundIfNeeded();
      return Response.json({ error: "Image data not found." }, { status: 404 });
    }
    const bytes = await file.arrayBuffer();
    if (
      source.content_type === "image/svg+xml" ||
      source.object_key.endsWith(".svg")
    ) {
      const svg = sanitizeSvg(new TextDecoder().decode(bytes));
      if (!svg.includes("<svg") || /<text\b|<image\b|<foreignObject\b/i.test(svg)) {
        await refundIfNeeded();
        return Response.json(
          { error: "The selected vector failed structural safety checks." },
          { status: 422 },
        );
      }
      const id = crypto.randomUUID();
      const objectKey = `users/assets/${userEmail.length}/${projectId}/${id}.svg`;
      await putObject(objectKey, svg, {
        contentType: "image/svg+xml",
      });
      await insertRow("logo_assets", {
        id,
        project_id: projectId,
        user_email: userEmail,
        parent_id: source.id,
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
            parentId: source.id,
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

    // Recraft exact vectorize preserves the approved raster silhouette.
    // For refinements, never fall back to GPT — it invents a different mark.
    // GPT geometric rebuild is fallback only for exploration sources.
    let asset: VectorAssetPayload | null = null;
    let lastError: Error | null = null;

    if (runtime.RECRAFT_API_KEY) {
      try {
        asset = await vectorizeWithRecraft({
          apiKey: runtime.RECRAFT_API_KEY,
          bytes,
          projectId,
          userEmail,
          source,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn({
          event: "logo_vectorize_recraft_failed",
          sourceKind: source.kind,
          reason: lastError.message.slice(0, 240),
        });
      }
    } else if (source.kind === "refine") {
      await refundIfNeeded();
      return Response.json(
        {
          error:
            "Add RECRAFT_API_KEY to vectorize refinements into an exact SVG that matches the mark.",
        },
        { status: 503 },
      );
    }

    if (
      !asset &&
      source.kind === "exploration" &&
      runtime.OPENAI_API_KEY
    ) {
      try {
        asset = await vectorizeWithGpt({
          apiKey: runtime.OPENAI_API_KEY,
          bytes,
          projectId,
          userEmail,
          source,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (!asset) {
      await refundIfNeeded();
      if (!runtime.RECRAFT_API_KEY && !runtime.OPENAI_API_KEY) {
        return Response.json(
          {
            error:
              "Add RECRAFT_API_KEY (preferred) or OPENAI_API_KEY to vectorize raster logos.",
          },
          { status: 503 },
        );
      }
      return Response.json(
        {
          error:
            lastError?.message ??
            (source.kind === "refine"
              ? "Exact vectorization of the refinement failed."
              : "Vectorization failed."),
        },
        { status: 502 },
      );
    }

    await updateRows(
      "logo_projects",
      { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
      { status: "vectorized", updated_at: Date.now() },
    );
    return Response.json({ assets: [asset] }, { status: 201 });
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
