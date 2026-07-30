import { getChatGPTUser } from "../../chatgpt-auth";
import {
  type BrandStrategy,
  buildPrompt,
  directions,
  getRuntimeEnv,
  hashIdentity,
  validateBrief,
} from "../../../lib/mvp-runtime";
import {
  countRows,
  insertRow,
  selectOne,
  selectRows,
  updateRows,
} from "../../../lib/supabase";
import { assessLogoImage } from "../../../lib/logo-quality";
import { createVectorConcepts } from "../../../lib/vector-art-direction";

type ProjectRow = {
  id: string;
  brand_name: string;
  status: string;
  selected_generation_id: string | null;
  created_at: number;
  updated_at: number;
};

type CloudflareImageResponse = {
  success?: boolean;
  result?: { image?: string };
  errors?: Array<{ code?: number; message?: string }>;
};

const conceptModel = "@cf/black-forest-labs/flux-2-klein-4b";

export const dynamic = "force-dynamic";

function isSafetyBlocked(message: string) {
  return message.includes("flagged") || message.includes("(3030)");
}

async function parseCloudflareResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as CloudflareImageResponse;
  } catch {
    throw new Error(
      `Cloudflare Workers AI returned ${response.status} with an invalid response.`,
    );
  }
}

function imageFormat(base64: string) {
  if (base64.startsWith("/9j/")) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (base64.startsWith("UklGR")) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return { contentType: "image/png", extension: "png" };
}

function fallbackStrategy(brief: ReturnType<typeof validateBrief>): BrandStrategy {
  return {
    categoryCodes: [
      `Recognizable ${brief.industry} confidence`,
      "Simple geometry and controlled negative space",
      "A distinctive silhouette that works without explanation",
    ],
    competitorRisks: [
      brief.competitors
        ? `Avoid the dominant forms and typography used by ${brief.competitors}`
        : "No competitors supplied — manual category review is still recommended",
      `Avoid ${brief.avoid || "literal category symbols and stock-logo geometry"}`,
    ],
    differentiation: `${brief.coreIdea} should become one ownable visual mechanism rather than a literal illustration of ${brief.industry}.`,
    typography:
      brief.logoType === "wordmark" || brief.logoType === "combination"
        ? "Begin with a restrained grotesk wordmark, then custom-draw distinctive letter details and spacing."
        : "Pair the symbol with a neutral, optically spaced grotesk wordmark so the symbol remains the hero.",
    palette: ["#201F1E", "#F3F0EA", "#FFCF68", "#FFFFFF"],
    trademarkNotice:
      "Automated similarity checks are directional only. A qualified trademark professional must clear the final identity in every intended market.",
    creativeDirections: directions,
  };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = await selectRows<ProjectRow>("logo_projects", {
    select:
      "id,brand_name,status,selected_generation_id,created_at,updated_at",
    user_email: `eq.${user.email}`,
    order: "created_at.desc",
    limit: 12,
  });
  return Response.json({
    projects: rows.map((row) => ({
      id: row.id,
      brandName: row.brand_name,
      status: row.status,
      selectedGenerationId: row.selected_generation_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user?.email) {
    return Response.json({ error: "Sign in with ChatGPT to generate." }, { status: 401 });
  }
  const userEmail = user.email;

  const runtime = getRuntimeEnv();
  if (!runtime.OPENAI_API_KEY || !runtime.RECRAFT_API_KEY) {
    return Response.json(
      {
        error:
          "Professional concept generation is not configured. Add OPENAI_API_KEY and RECRAFT_API_KEY.",
      },
      { status: 503 },
    );
  }

  let input: Record<string, unknown>;
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid brief." },
      { status: 400 },
    );
  }

  const existingProjectId =
    typeof input.projectId === "string" ? input.projectId : "";
  const requestId =
    typeof input.requestId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.requestId,
    )
      ? input.requestId
      : "";
  const now = Date.now();
  if (!existingProjectId && process.env.NODE_ENV === "production") {
    const recent = await countRows("logo_projects", {
      user_email: `eq.${userEmail}`,
      created_at: `gt.${now - 60 * 60 * 1000}`,
      status: "neq.failed",
    });
    if (recent >= 3) {
      return Response.json(
        { error: "Hourly generation limit reached. Try again later." },
        { status: 429 },
      );
    }
  }

  let projectId = existingProjectId;
  let enrichedBrief: ReturnType<typeof validateBrief> & {
    strategy: BrandStrategy;
  };
  let strategy: BrandStrategy;
  let existingConceptCount = 0;

  if (existingProjectId) {
    const project = await selectOne<{
      brief_json: ReturnType<typeof validateBrief> & {
        strategy?: BrandStrategy;
      };
    }>("logo_projects", {
      select: "brief_json",
      id: `eq.${existingProjectId}`,
      user_email: `eq.${userEmail}`,
    });
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    existingConceptCount = await countRows("logo_generations", {
      project_id: `eq.${existingProjectId}`,
      user_email: `eq.${userEmail}`,
    });
    if (existingConceptCount >= 8) {
      return Response.json(
        { error: "This project already has the maximum of 8 concepts." },
        { status: 409 },
      );
    }
    strategy =
      project.brief_json.strategy ??
      fallbackStrategy(project.brief_json);
    enrichedBrief = { ...project.brief_json, strategy };
  } else {
    let brief;
    try {
      brief = validateBrief(input);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid brief." },
        { status: 400 },
      );
    }
    projectId = requestId || crypto.randomUUID();
    if (requestId) {
      const duplicate = await selectOne<{ id: string }>("logo_projects", {
        select: "id",
        id: `eq.${requestId}`,
        user_email: `eq.${userEmail}`,
      });
      if (duplicate) {
        return Response.json(
          {
            error:
              "This generation request was already accepted. No duplicate inference was started.",
            projectId: requestId,
          },
          { status: 409 },
        );
      }
    }
    // Deterministic strategy avoids a hidden LLM charge and guarantees four
    // structurally different construction recipes.
    strategy = fallbackStrategy(brief);
    enrichedBrief = { ...brief, strategy };
    await insertRow("logo_projects", {
      id: projectId,
      user_email: userEmail,
      brand_name: brief.brandName,
      brief_json: enrichedBrief,
      status: "generating",
      selected_generation_id: null,
      created_at: now,
      updated_at: now,
    });
  }

  const userHash = await hashIdentity(userEmail);
  const actionId =
    typeof input.actionId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.actionId,
    )
      ? input.actionId
      : "";
  if (existingProjectId && actionId) {
    const actionKey = `users/${userHash}/projects/${projectId}/actions/${actionId}`;
    if (await runtime.FILES.head(actionKey)) {
      return Response.json(
        { error: "This action was already accepted. No duplicate inference was started." },
        { status: 409 },
      );
    }
    await runtime.FILES.put(actionKey, new Uint8Array(), {
      customMetadata: { type: "generation-action" },
    });
  }

  // Concept creation is vector-native. A reasoning model first develops
  // brand-specific territories, then a separate design-director pass selects
  // and turns the strongest ideas into execution briefs for Recraft V4.1
  // Vector. Returned SVG is structurally validated before storage. This
  // eliminates pseudo-text, raster artifacts and literal prompt illustration
  // by construction instead of hoping a vision classifier catches them later.
  try {
    const previousRows = existingProjectId
      ? await selectRows<{ direction_title: string }>("logo_generations", {
          select: "direction_title",
          project_id: `eq.${projectId}`,
          user_email: `eq.${userEmail}`,
          order: "created_at.asc",
        })
      : [];
    const conceptCount: 1 | 4 = existingProjectId ? 1 : 4;
    const vectorConcepts = await createVectorConcepts(
      enrichedBrief,
      runtime.OPENAI_API_KEY,
      runtime.RECRAFT_API_KEY,
      conceptCount,
      previousRows.map((row) => row.direction_title),
    );
    const recommendedIndex = vectorConcepts.reduce(
      (best, concept, index, all) =>
        concept.score > all[best].score ? index : best,
      0,
    );
    const generations = await Promise.all(
      vectorConcepts.map(async (concept, index) => {
        const generationId =
          existingProjectId && actionId ? actionId : crypto.randomUUID();
        const objectKey = `users/${userHash}/projects/${projectId}/${generationId}.svg`;
        const reviewStatus =
          index === recommendedIndex && concept.score >= 90
            ? "Recommended"
            : concept.score >= 88
              ? "Curated"
              : "Review";
        await runtime.FILES.put(objectKey, new TextEncoder().encode(concept.svg), {
          httpMetadata: { contentType: "image/svg+xml" },
          customMetadata: {
            direction: concept.key,
            model: "gpt-5.6-terra-vector",
            project: projectId,
            score: String(concept.score),
          },
        });
        const prompt = [
          `[LOOPEN_VECTOR_NATIVE]`,
          `[LOOPEN_QC:${concept.score}]`,
          `[LOOPEN_STATUS:${reviewStatus}]`,
          `[LOOPEN_REASON:${encodeURIComponent(concept.verdict)}]`,
          concept.rationale,
        ].join("");
        await insertRow("logo_generations", {
          id: generationId,
          project_id: projectId,
          user_email: userEmail,
          direction_key: concept.key,
          direction_title: concept.title,
          prompt,
          object_key: objectKey,
          status: "completed",
          created_at: Date.now() + index,
        });
        return {
          directionKey: concept.key,
          directionTitle: concept.title,
          rationale: concept.thesis,
          downloadUrl: `/api/images/${generationId}?download=1`,
          id: generationId,
          imageUrl: `/api/images/${generationId}`,
          qualityScore: concept.score,
          reviewReason: concept.verdict,
          reviewStatus,
        };
      }),
    );
    const creativeDirections = vectorConcepts.map((concept) => ({
      key: concept.key,
      title: concept.title,
      thesis: concept.thesis,
    }));
    const updatedStrategy = {
      ...strategy,
      creativeDirections:
        existingProjectId
          ? [...(strategy.creativeDirections ?? []), ...creativeDirections]
          : creativeDirections,
    };
    await updateRows(
      "logo_projects",
      { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
      {
        brief_json: { ...enrichedBrief, strategy: updatedStrategy },
        status: "completed",
        updated_at: Date.now(),
      },
    );
    console.log({
      event: "vector_logo_batch_completed",
      projectId,
      count: generations.length,
      model: "gpt-5.6-terra",
      scores: vectorConcepts.map((concept) => concept.score),
    });
    return Response.json(
      { failures: [], generations, projectId, strategy: updatedStrategy },
      { status: 201 },
    );
  } catch (error) {
    console.error({
      event: "vector_logo_batch_failed",
      projectId,
      reason: error instanceof Error ? error.message : String(error),
    });
    await updateRows(
      "logo_projects",
      { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
      { status: "failed", updated_at: Date.now() },
    );
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Professional vector concept generation failed.",
        projectId,
      },
      { status: 502 },
    );
  }

  /*
   * Legacy FLUX concept path retained below temporarily for migration history.
   * It is unreachable while the vector-native pipeline above is active.
   */
  const strategyDirections =
    enrichedBrief.strategy.creativeDirections?.length === 4
      ? enrichedBrief.strategy.creativeDirections
      : directions;
  const batchDirections = existingProjectId
    ? (() => {
        const direction =
          strategyDirections[existingConceptCount % strategyDirections.length];
        const alternateNumber =
          Math.floor(existingConceptCount / strategyDirections.length) + 1;
        return [{
          ...direction,
          key: `${direction.key}-${existingConceptCount + 1}`,
          title: `${direction.title} — Alternate ${alternateNumber}`,
          thesis: `${direction.thesis} Explore a clearly different construction and silhouette.`,
        }];
      })()
    : strategyDirections;
  async function requestConceptImage(
    direction: (typeof batchDirections)[number],
    recoveryMode: boolean,
  ) {
    const startedAt = Date.now();
    const prompt = buildPrompt(enrichedBrief, direction, { recoveryMode });
    console.log({
      event: "logo_concept_prompt",
      direction: direction.key,
      recoveryMode,
      model: conceptModel,
      prompt,
    });
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "512");
    form.append("height", "512");
    form.append("seed", String(seed));
    form.append("guidance", "4.5");
    // BFL moderation: 0 = strictest, 5 = most permissive (default 2).
    // Undocumented on CF Klein docs, but accepted by the Workers AI multipart API
    // and required for abstract logo prompts that otherwise false-positive as 3030.
    form.append("safety_tolerance", "5");

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/${conceptModel}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.CLOUDFLARE_API_TOKEN}`,
        },
        body: form,
      },
    );
    const payload = await parseCloudflareResponse(response);
    const inferenceMs = Date.now() - startedAt;
    const base64 = payload.result?.image;
    if (!response.ok || !base64) {
      const cloudflareError = payload.errors?.[0];
      throw new Error(
        cloudflareError?.message
          ? `Cloudflare Workers AI [HTTP ${response.status}]: ${cloudflareError.message}${
              cloudflareError.code ? ` (${cloudflareError.code})` : ""
            }`
          : `Cloudflare Workers AI returned ${response.status} without an image.`,
      );
    }
    return { base64, inferenceMs, prompt, recoveryMode };
  }

  async function generateDirection(direction: (typeof batchDirections)[number]) {
    const startedAt = Date.now();
    async function requestWithSafetyRecovery(recoveryMode: boolean) {
      try {
        return await requestConceptImage(direction, recoveryMode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (recoveryMode || !isSafetyBlocked(message)) throw error;
        console.warn({
          event: "logo_concept_safety_recovery",
          direction: direction.key,
          reason: message.replace(/\s*\([0-9a-f-]{20,}\)\s*/gi, " ").slice(0, 280),
        });
        return requestConceptImage(direction, true);
      }
    }

    let image = await requestWithSafetyRecovery(false);
    let qualityScore: number | undefined;
    let reviewStatus = "Review";
    let reviewReason = "Automated review unavailable; inspect before refinement.";
    try {
      let quality = await assessLogoImage(
        image.base64,
        {
          avoid: enrichedBrief.avoid,
          direction: `${direction.title}: ${direction.thesis}`,
          stage: "concept",
        },
        runtime,
      );
      if (quality.containsText && !image.recoveryMode) {
        console.warn({
          event: "logo_concept_text_recovery",
          direction: direction.key,
          reason: quality.reason,
        });
        image = await requestWithSafetyRecovery(true);
        quality = await assessLogoImage(
          image.base64,
          {
            avoid: enrichedBrief.avoid,
            direction: `${direction.title}: ${direction.thesis}`,
            stage: "concept",
          },
          runtime,
        );
      }
      qualityScore = quality.score;
      reviewStatus = quality.approved
        ? "Recommended"
        : quality.containsText
          ? "Rejected · text detected"
          : "Review";
      reviewReason = quality.reason;
    } catch (error) {
      console.warn({
        event: "logo_review_unavailable",
        direction: direction.key,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    const { base64, inferenceMs, prompt, recoveryMode } = image;
    const generationId =
      existingProjectId && actionId ? actionId : crypto.randomUUID();
    const format = imageFormat(base64);
    const objectKey = `users/${userHash}/projects/${projectId}/${generationId}.${format.extension}`;
    const bytes = Uint8Array.from(atob(base64), (character) =>
      character.charCodeAt(0),
    );

    await runtime.FILES.put(objectKey, bytes, {
      httpMetadata: { contentType: format.contentType },
      customMetadata: {
        direction: direction.key,
        model: conceptModel,
        project: projectId,
        recovery: recoveryMode ? "1" : "0",
      },
    });

    await insertRow("logo_generations", {
      id: generationId,
      project_id: projectId,
      user_email: userEmail,
      direction_key: direction.key,
      direction_title: direction.title,
      prompt: `${prompt}\n\n[LOOPEN_QC:${qualityScore ?? 0}][LOOPEN_STATUS:${reviewStatus}][LOOPEN_REASON:${encodeURIComponent(reviewReason)}]`,
      object_key: objectKey,
      status: "completed",
      created_at: Date.now(),
    });
    console.log({
      event: "logo_concept_completed",
      direction: direction.key,
      inferenceMs,
      totalMs: Date.now() - startedAt,
      model: conceptModel,
      recoveryMode,
      reviewStatus,
    });

    return {
      directionKey: direction.key,
      directionTitle: direction.title,
      rationale: direction.thesis,
      downloadUrl: `/api/images/${generationId}?download=1`,
      id: generationId,
      imageUrl: `/api/images/${generationId}`,
      qualityScore,
      reviewReason,
      reviewStatus,
    };
  }

  const settled = await Promise.allSettled(
    batchDirections.map(generateDirection),
  );

  const generations = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failures = settled.flatMap((result) =>
    result.status === "rejected"
      ? [
          result.reason instanceof Error
            ? result.reason.message
            : "Image generation failed.",
        ]
      : [],
  );
  if (failures.length) {
    console.error("Cloudflare Workers AI concept failures:", failures);
  }

  await updateRows(
    "logo_projects",
    { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
    {
      status: generations.length ? "completed" : "failed",
      updated_at: Date.now(),
    },
  );

  if (!generations.length) {
    const quotaExceeded = failures.some(
      (failure) =>
        failure.includes("HTTP 429") ||
        failure.includes("daily free allocation") ||
        failure.includes("(4006)"),
    );
    const safetyBlocked = failures.some((failure) => isSafetyBlocked(failure));
    return Response.json(
      {
        error: quotaExceeded
          ? "Cloudflare Workers AI daily quota is exhausted. Wait for the daily reset or enable the Workers Paid plan, then try again."
          : safetyBlocked
            ? "Cloudflare blocked the generated image even after one neutral recovery attempt. Try More concept +1 again."
          : failures[0] ?? "No concepts were generated.",
        projectId,
      },
      { status: quotaExceeded ? 429 : safetyBlocked ? 422 : 502 },
    );
  }

  return Response.json(
    { failures, generations, projectId, strategy },
    { status: 201 },
  );
}
