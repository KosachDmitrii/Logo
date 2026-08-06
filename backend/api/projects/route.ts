import {
  ensureStudioWallet,
  getStudioUser,
  isAdminRole,
} from "@/backend/auth/session";
import {
  type BrandStrategy,
  directions,
  getRuntimeEnv,
  hashIdentity,
  validateBrief,
} from "@/backend/lib/mvp-runtime";
import {
  RATE_LIMITS,
  assertRateLimit,
  clientIp,
  RateLimitError,
} from "@/backend/lib/rate-limit";
import {
  InsufficientSignalsError,
  refundSignals,
  spendSignals,
  type SignalAction,
} from "@/backend/lib/signals";
import {
  countRows,
  insertRow,
  selectOne,
  selectRows,
  updateRows,
} from "@/backend/lib/supabase";
import { arrayBufferToBase64 } from "@/backend/lib/logo-quality";
import { createCuratedConcepts } from "@/backend/lib/gemini-creative";
import { headObject, putObject } from "@/backend/lib/storage";

type ProjectRow = {
  id: string;
  brand_name: string;
  status: string;
  selected_generation_id: string | null;
  created_at: number;
  updated_at: number;
};

export const dynamic = "force-dynamic";

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
  const suppliedColors =
    (brief.brandColors || "").match(/#[0-9a-f]{6}\b/gi)?.map((color) => color.toUpperCase()) ??
    [];
  const mood = (brief.colorMood || "").toLowerCase();
  const moodPalette = /monochrome|black.?and.?white|minimal/.test(mood)
    ? ["#171716", "#F4F1E8", "#77736C", "#FFFFFF"]
    : /cool|blue|calm|technical/.test(mood)
      ? ["#182129", "#EDF1F2", "#326A78", "#AEBFC5"]
      : /vibrant|bright|bold|electric/.test(mood)
        ? ["#171716", "#F4F1E8", "#E64B2E", "#3159C7"]
        : ["#171716", "#F4F1E8", "#C84A32", "#A9B6A3"];
  const proposedPalette =
    brief.colorApproach === "existing" && suppliedColors.length
      ? [...suppliedColors.slice(0, 4), "#F4F1E8", "#FFFFFF"].slice(0, 4)
      : brief.colorApproach === "mood"
        ? moodPalette
        : ["#171716", "#F4F1E8", "#C84A32", "#A9B6A3"];
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
    differentiation: `${brief.coreIdea} should become one ownable visual mechanism rather than a literal illustration of ${brief.industry}. Brief language preference: ${brief.briefLocale ?? "en"}.`,
    typography:
      brief.logoType === "wordmark" || brief.logoType === "combination"
        ? "Begin with a restrained grotesk wordmark, then custom-draw distinctive letter details and spacing."
        : "Pair the symbol with a neutral, optically spaced grotesk wordmark so the symbol remains the hero.",
    palette: proposedPalette,
    trademarkNotice:
      "Automated similarity checks are directional only. A qualified trademark professional must clear the final identity in every intended market.",
    creativeDirections: directions,
  };
}

export async function GET() {
  const user = await getStudioUser();
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
  const user = await getStudioUser();
  if (!user?.email) {
    return Response.json({ error: "Sign in to generate." }, { status: 401 });
  }
  const userEmail = user.email;

  const runtime = getRuntimeEnv();
  if (!runtime.OPENAI_API_KEY || !runtime.GEMINI_API_KEY) {
    return Response.json(
      {
        error:
          "Professional concept generation is not configured. Add OPENAI_API_KEY and GEMINI_API_KEY.",
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
  const signalAction: SignalAction = existingProjectId
    ? "extraConcept"
    : "generateBatch";

  if (!isAdminRole(user.role)) {
    try {
      await assertRateLimit(userEmail, RATE_LIMITS.generateUser);
      await assertRateLimit(clientIp(request), RATE_LIMITS.generateIp);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return Response.json({ error: error.message }, { status: 429 });
      }
      throw error;
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
    if (await headObject(actionKey)) {
      return Response.json(
        { error: "This action was already accepted. No duplicate inference was started." },
        { status: 409 },
      );
    }
    await putObject(actionKey, new Uint8Array(), {
      contentType: "application/octet-stream",
    });
  }

  let signalsCharged = false;
  if (!isAdminRole(user.role)) {
    try {
      await ensureStudioWallet(userEmail);
      await spendSignals(userEmail, signalAction, projectId);
      signalsCharged = true;
    } catch (error) {
      if (error instanceof InsufficientSignalsError) {
        if (!existingProjectId) {
          await updateRows(
            "logo_projects",
            { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
            { status: "failed", updated_at: Date.now() },
          );
        }
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
  }

  // A reasoning model develops brand-specific territories and art-direction
  // briefs. Gemini explores each route visually; Gemini and GPT then judge the
  // candidates independently. Only candidates above the shared threshold are
  // stored. Recraft is reserved for final vectorization after user selection.
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
    let styleReference:
      | { base64: string; mimeType: string }
      | undefined;
    if (enrichedBrief.brandName.trim().toLowerCase() === "ketchup") {
      try {
        const referenceResponse = await fetch(
          new URL("/ketchup-logo-reference.png", request.url),
        );
        if (referenceResponse.ok) {
          styleReference = {
            base64: arrayBufferToBase64(
              await referenceResponse.arrayBuffer(),
            ),
            mimeType:
              referenceResponse.headers.get("content-type") ?? "image/png",
          };
        }
      } catch (referenceError) {
        console.warn({
          event: "logo_style_reference_unavailable",
          reason:
            referenceError instanceof Error
              ? referenceError.message
              : String(referenceError),
        });
      }
    }
    const curatedConcepts = await createCuratedConcepts(
      enrichedBrief,
      {
        openai: runtime.OPENAI_API_KEY,
        gemini: runtime.GEMINI_API_KEY,
      },
      conceptCount,
      previousRows.map((row) => row.direction_title),
      styleReference,
    );
    const recommendedIndex = curatedConcepts.reduce(
      (best, concept, index, all) =>
        concept.score > all[best].score ? index : best,
      0,
    );
    const generations = await Promise.all(
      curatedConcepts.map(async (concept, index) => {
        const generationId =
          existingProjectId && actionId ? actionId : crypto.randomUUID();
        const format = imageFormat(concept.base64);
        const objectKey = `users/${userHash}/projects/${projectId}/${generationId}.${format.extension}`;
        const reviewStatus =
          index === recommendedIndex && concept.score >= 90
            ? "Recommended"
            : concept.score >= 80
              ? "Curated"
              : "Review";
        const bytes = Uint8Array.from(atob(concept.base64), (character) =>
          character.charCodeAt(0),
        );
        await putObject(objectKey, bytes, {
          contentType: concept.mimeType || format.contentType,
        });
        const prompt = [
          `[LOOPEN_FLAT_LOGO_CONCEPT]`,
          `[LOOPEN_DUAL_JURY]`,
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
          rationale: concept.rationale || concept.thesis,
          downloadUrl: `/api/images/${generationId}?download=1`,
          id: generationId,
          imageUrl: `/api/images/${generationId}`,
          qualityScore: concept.score,
          reviewReason: concept.verdict,
          reviewStatus,
        };
      }),
    );
    const creativeDirections = curatedConcepts.map((concept) => ({
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
      event: "flat_logo_batch_completed",
      projectId,
      count: generations.length,
      model: "gemini-3.1-flash-image→gemini-3-pro-image(refine)",
      scores: curatedConcepts.map((concept) => concept.score),
    });
    return Response.json(
      { failures: [], generations, projectId, strategy: updatedStrategy },
      { status: 201 },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error({
      event: "vector_logo_batch_failed",
      projectId,
      reason,
    });
    if (signalsCharged) {
      try {
        await refundSignals(userEmail, signalAction, projectId);
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
    }
    await updateRows(
      "logo_projects",
      { id: `eq.${projectId}`, user_email: `eq.${userEmail}` },
      { status: "failed", updated_at: Date.now() },
    );
    const highDemand =
      /high demand|try again later|resource_exhausted|overloaded/i.test(reason);
    return Response.json(
      {
        error: highDemand
          ? "Gemini image generation is temporarily overloaded. Wait a minute and try again — no concepts were saved. Signals were returned."
          : reason || "Professional vector concept generation failed.",
        projectId,
      },
      { status: highDemand ? 503 : 502 },
    );
  }
}
