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

type CloudflareTextResponse = {
  success?: boolean;
  result?: { response?: string };
  errors?: Array<{ code?: number; message?: string }>;
};

const conceptModel = "@cf/black-forest-labs/flux-2-klein-4b";

export const dynamic = "force-dynamic";

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
    creativeDirections: [
      {
        key: "catalyst",
        title: "Brand Catalyst",
        thesis: `Translate “${brief.coreIdea}” into one active geometric relationship without illustrating the category.`,
      },
      {
        key: "counterform",
        title: "Ownable Counterform",
        thesis:
          "Build recognition through one surprising piece of negative space and a compact silhouette.",
      },
      {
        key: "constructive",
        title: "Constructive Tension",
        thesis:
          "Balance disciplined structure with one deliberate interruption that expresses the brand personality.",
      },
      {
        key: "human-system",
        title: "Human System",
        thesis:
          "Create a modular, precise symbol softened by one approachable and memorable gesture.",
      },
    ],
  };
}

async function researchStrategy(
  brief: ReturnType<typeof validateBrief>,
  runtime: ReturnType<typeof getRuntimeEnv>,
): Promise<BrandStrategy> {
  const fallback = fallbackStrategy(brief);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.1-8b-instruct-fast`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${runtime.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content:
                "You are a senior brand strategist. Return only valid compact JSON, never markdown.",
            },
            {
              role: "user",
              content: `Research a logo strategy from this brief:
${JSON.stringify(brief)}
Return exactly these keys:
categoryCodes (3 short strings), competitorRisks (2 short strings),
differentiation (one sentence), typography (one sentence),
palette (exactly 4 accessible hex colors), trademarkNotice (one sentence),
creativeDirections (exactly 4 objects with unique lowercase key, a 2-4 word
title, and a one-sentence thesis). Each direction must be specific to this brief,
visually distinct, non-literal and compatible with a text-free abstract symbol.
Do not claim a legal trademark search was performed.`,
            },
          ],
          max_tokens: 650,
          temperature: 0.25,
        }),
      },
    );
    const payload = (await response.json()) as CloudflareTextResponse;
    const text = payload.result?.response
      ?.replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "");
    if (!response.ok || !text) return fallback;
    const parsed = JSON.parse(text) as Partial<BrandStrategy>;
    return {
      categoryCodes:
        Array.isArray(parsed.categoryCodes) && parsed.categoryCodes.length
          ? parsed.categoryCodes.slice(0, 3)
          : fallback.categoryCodes,
      competitorRisks:
        Array.isArray(parsed.competitorRisks) && parsed.competitorRisks.length
          ? parsed.competitorRisks.slice(0, 2)
          : fallback.competitorRisks,
      differentiation: parsed.differentiation || fallback.differentiation,
      typography: parsed.typography || fallback.typography,
      palette:
        Array.isArray(parsed.palette) &&
        parsed.palette.length === 4 &&
        parsed.palette.every((color) => /^#[0-9a-f]{6}$/i.test(color))
          ? parsed.palette
          : fallback.palette,
      trademarkNotice: fallback.trademarkNotice,
      creativeDirections:
        Array.isArray(parsed.creativeDirections) &&
        parsed.creativeDirections.length === 4
          ? parsed.creativeDirections.map((direction, index) => {
              const candidate = direction as Partial<(typeof directions)[number]>;
              return {
                key:
                  String(candidate.key ?? `direction-${index + 1}`)
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, "") || `direction-${index + 1}`,
                title:
                  String(candidate.title ?? "").trim().slice(0, 60) ||
                  fallback.creativeDirections[index].title,
                thesis:
                  String(candidate.thesis ?? "").trim().slice(0, 240) ||
                  fallback.creativeDirections[index].thesis,
              };
            })
          : fallback.creativeDirections,
    };
  } catch {
    return fallback;
  }
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
  if (!user) {
    return Response.json({ error: "Sign in with ChatGPT to generate." }, { status: 401 });
  }

  const runtime = getRuntimeEnv();
  if (!runtime.CLOUDFLARE_ACCOUNT_ID || !runtime.CLOUDFLARE_API_TOKEN) {
    return Response.json(
      {
        error:
          "Concept generation is not configured. Add the Cloudflare account ID and Workers AI token.",
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
  const now = Date.now();
  if (!existingProjectId && process.env.NODE_ENV === "production") {
    const recent = await countRows("logo_projects", {
      user_email: `eq.${user.email}`,
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
      user_email: `eq.${user.email}`,
    });
    if (!project) {
      return Response.json({ error: "Project not found." }, { status: 404 });
    }
    existingConceptCount = await countRows("logo_generations", {
      project_id: `eq.${existingProjectId}`,
      user_email: `eq.${user.email}`,
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
    projectId = crypto.randomUUID();
    strategy = await researchStrategy(brief, runtime);
    enrichedBrief = { ...brief, strategy };
    await insertRow("logo_projects", {
      id: projectId,
      user_email: user.email,
      brand_name: brief.brandName,
      brief_json: enrichedBrief,
      status: "generating",
      selected_generation_id: null,
      created_at: now,
      updated_at: now,
    });
  }

  const userHash = await hashIdentity(user.email);
  const strategyDirections =
    enrichedBrief.strategy.creativeDirections?.length === 4
      ? enrichedBrief.strategy.creativeDirections
      : directions;
  const batchDirections = existingProjectId
    ? (() => {
        const direction =
          strategyDirections[existingConceptCount % strategyDirections.length];
        return [{
          ...direction,
          key: `${direction.key}-${existingConceptCount + 1}`,
          title: `${direction.title} — Alternate ${existingConceptCount - 3}`,
          thesis: `${direction.thesis} Explore a clearly different construction and silhouette.`,
        }];
      })()
    : strategyDirections;
  async function generateDirection(direction: (typeof batchDirections)[number]) {
    const startedAt = Date.now();
    const prompt = buildPrompt(enrichedBrief, direction);
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("width", "512");
    form.append("height", "512");
    form.append("seed", String(seed));

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
    const generationId = crypto.randomUUID();
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
      },
    });

    await insertRow("logo_generations", {
      id: generationId,
      project_id: projectId,
      user_email: user.email,
      direction_key: direction.key,
      direction_title: direction.title,
      prompt,
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
    });

    return {
      directionKey: direction.key,
      directionTitle: direction.title,
      rationale: direction.thesis,
      downloadUrl: `/api/images/${generationId}?download=1`,
      id: generationId,
      imageUrl: `/api/images/${generationId}`,
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
    { id: `eq.${projectId}`, user_email: `eq.${user.email}` },
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
    const safetyBlocked = failures.some(
      (failure) =>
        failure.includes("flagged") ||
        failure.includes("(3030)"),
    );
    return Response.json(
      {
        error: quotaExceeded
          ? "Cloudflare Workers AI daily quota is exhausted. Wait for the daily reset or enable the Workers Paid plan, then try again."
          : safetyBlocked
            ? "Cloudflare blocked the generated image. Loopen did not retry or make another paid image request."
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
