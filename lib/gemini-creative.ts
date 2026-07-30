import type { LogoBrief } from "./mvp-runtime";
import {
  createArtDirectionPlans,
  type ArtDirectionPlan,
} from "./vector-art-direction";

export type CreativeCandidate = {
  key: string;
  title: string;
  thesis: string;
  rationale: string;
  base64: string;
  mimeType: string;
  score: number;
  verdict: string;
};

type RawCandidate = CreativeCandidate & {
  candidateId: string;
  planKey: string;
  specification: string;
  referenceBase64?: string;
  referenceMimeType?: string;
};

function findImage(value: unknown): { data: string; mimeType: string } | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Record<string, unknown>;
  const data = typeof object.data === "string" ? object.data : "";
  const mimeType =
    typeof object.mime_type === "string"
      ? object.mime_type
      : typeof object.mimeType === "string"
        ? object.mimeType
        : "";
  if (data && mimeType.startsWith("image/")) return { data, mimeType };
  for (const nested of Object.values(object)) {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const found = findImage(item);
        if (found) return found;
      }
    } else {
      const found = findImage(nested);
      if (found) return found;
    }
  }
  return null;
}

function collectText(value: unknown, into: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    if (value.includes("{") && value.includes("}")) into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, into));
    return;
  }
  if (typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) =>
      collectText(item, into),
    );
  }
}

const GEMINI_FLASH_IMAGE = "gemini-3.1-flash-image";
const GEMINI_PRO_IMAGE = "gemini-3-pro-image";
const GEMINI_JURY_MODEL = "gemini-3-flash-preview";

function isTransientGeminiError(message: string, status?: number) {
  const lower = message.toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    lower.includes("high demand") ||
    lower.includes("try again later") ||
    lower.includes("resource_exhausted") ||
    lower.includes("unavailable") ||
    lower.includes("overloaded")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function geminiInteraction(
  apiKey: string,
  input: Array<Record<string, string>>,
  options: {
    model: string;
    responseFormat?: Record<string, string>;
    serviceTier?: "standard" | "priority";
    retries?: number;
  },
) {
  const retries = options.retries ?? 3;
  let lastError = "Gemini request failed.";
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        signal: AbortSignal.timeout(180_000),
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.model,
          input,
          ...(options.serviceTier ? { service_tier: options.serviceTier } : {}),
          ...(options.responseFormat
            ? { response_format: options.responseFormat }
            : {}),
        }),
      },
    );
    const payload = (await response.json()) as Record<string, unknown>;
    if (response.ok) return payload;

    lastError =
      (payload.error as { message?: string } | undefined)?.message ??
      `Gemini returned HTTP ${response.status}.`;
    if (!isTransientGeminiError(lastError, response.status) || attempt === retries - 1) {
      throw new Error(lastError);
    }
    const waitMs = 2500 * 2 ** attempt;
    console.warn({
      event: "gemini_high_demand_retry",
      model: options.model,
      attempt: attempt + 1,
      waitMs,
      reason: lastError.slice(0, 240),
    });
    await sleep(waitMs);
  }
  throw new Error(lastError);
}

async function generateImageWithFallback(
  apiKey: string,
  input: Array<Record<string, string>>,
  responseFormat: Record<string, string>,
  models: string[],
) {
  let lastError = new Error("Gemini image generation failed.");
  for (const model of models) {
    try {
      const payload = await geminiInteraction(apiKey, input, {
        model,
        responseFormat,
        // One quick retry, then switch model — long backoff on a dead model wastes minutes.
        retries: 2,
      });
      return { payload, model };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isTransientGeminiError(lastError.message)) throw lastError;
      console.warn({
        event: "gemini_model_fallback",
        failedModel: model,
        reason: lastError.message.slice(0, 240),
      });
      await sleep(800);
    }
  }
  throw lastError;
}

async function generateExploration(
  apiKey: string,
  brief: LogoBrief,
  plan: ArtDirectionPlan,
  variant: number,
) {
  // Docs: Flash Image is the high-volume workhorse; Pro is often capacity-constrained.
  const { payload, model } = await generateImageWithFallback(
    apiKey,
    [{
      type: "text",
      text: `Create exactly one architectural concept study. This is stage one of a
two-stage identity process: invent the architecture now; do NOT design or simplify a
logo yet.

BRAND CONTEXT
Industry: ${brief.industry}
Core idea: ${brief.coreIdea}
Personality: ${brief.personalities.join(", ")}
Positioning: ${brief.positioning}
Architectural territory: ${plan.title} — ${plan.thesis}
SPATIAL SPECIFICATION — FOLLOW EXACTLY
Outer silhouette: ${plan.silhouette}
Exact component count: ${plan.componentCount}
Construction: ${plan.construction}
Proportions: ${plan.proportions}
Counterspace: ${plan.counterspace}
Ownable signature move: ${plan.signatureMove}
Invalidating drift: ${plan.forbiddenDrift}
Controlled variation: ${variant}. Preserve the spatial idea and signature move.

Show one original, believable architectural object as a precise monochrome physical
study model, isolated on a warm-white seamless background. Use a three-quarter
axonometric view that clearly reveals mass, void, circulation, cantilever and structural
support. The object must feel authored by an exceptional contemporary architect:
spatially surprising, structurally coherent, buildable and specific to this brief.
This is an architectural maquette used to discover a future identity silhouette.

No logo, symbol, wordmark, letters, numbers or pseudo-text. No conventional house,
pitched roof, property-development imagery, generic office block, skyline, floor-plan
diagram, random sculpture, fantasy physics, people, trees, furniture, caption, border,
gradient or decorative texture. Do not flatten the object into a pictogram. Image only.`,
    }],
    { type: "image", aspect_ratio: "1:1", image_size: "1K" },
    [GEMINI_FLASH_IMAGE, GEMINI_PRO_IMAGE],
  );
  const image = findImage(payload);
  if (!image) throw new Error("Gemini returned no generated image.");
  console.log({ event: "gemini_exploration_model", model, direction: plan.key });
  return image;
}

type JuryScore = {
  candidateId: string;
  score: number;
  reject: boolean;
  reason: string;
};

function pickJuryScore(
  scores: JuryScore[],
  candidateId: string,
  index: number,
) {
  return (
    scores.find((item) => item.candidateId === candidateId) ??
    scores[index] ??
    null
  );
}

function mergeJuryVerdicts(
  candidate: RawCandidate,
  gemini: JuryScore | null,
  openai: JuryScore | null,
  stage: "exploration" | "final",
) {
  const parts = [gemini, openai].filter(Boolean) as JuryScore[];
  if (!parts.length) {
    return {
      ...candidate,
      score: 0,
      verdict: `${stage} jury returned no scores for ${candidate.candidateId}.`,
    };
  }
  // A generous juror may never hide a veto from the other juror.
  const score = Math.min(...parts.map((item) => item.score));
  const anyReject = parts.some((item) => item.reject);
  const reasons = [
    gemini ? `Gemini: ${gemini.reason}` : null,
    openai ? `OpenAI: ${openai.reason}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    ...candidate,
    score: anyReject ? Math.min(score, 59) : score,
    verdict: `${stage === "final" ? "Final dual jury" : "Dual jury"} — ${reasons}`.slice(
      0,
      500,
    ),
  };
}

async function geminiJury(
  apiKey: string,
  candidates: RawCandidate[],
  stage: "exploration" | "final" = "exploration",
) {
  const rubric = stage === "final"
    ? `You are an unforgiving senior identity-design jury. These are final flat logo
reductions derived from approved architectural maquettes. Reject text or pseudo-text,
letters, house/property icons, generic geometry, arbitrary abstraction, excessive
detail, weak counterspace, poor optical balance, loss of the architectural idea, or
anything that fails at 24px. Score fidelity to architectural idea 25, distinctiveness
25, formal craft 20, 24px clarity 15, brand fit 15.`
    : `You are an unforgiving architecture and identity creative director. These
are stage-one architectural maquettes, not finished logos. Review the labeled candidates
in order. Reject text/pseudo-text, conventional houses, property icons, generic blocks,
arbitrary sculpture, implausible structure, weak spatial hierarchy and forms without an
ownable architectural move. Reject any candidate that does not visibly match its supplied
spatial specification. Score architectural idea 25, spatial originality 25, structural
coherence 20, silhouette/reduction potential 15, brand fit 15.`;
  const input: Array<Record<string, string>> = [{
    type: "text",
    text: `${rubric}
Return ONLY JSON: {"scores":[{"candidateId":"...","score":0,"reject":true,"reason":"..."}]}
Specifications by candidate:
${candidates.map((item) => `${item.candidateId}: ${item.specification}`).join("\n")}`,
  }];
  candidates.forEach((candidate) => {
    if (candidate.referenceBase64 && candidate.referenceMimeType) {
      input.push({ type: "text", text: `${candidate.candidateId} — SOURCE ARCHITECTURAL MAQUETTE` });
      input.push({
        type: "image",
        mime_type: candidate.referenceMimeType,
        data: candidate.referenceBase64,
      });
      input.push({ type: "text", text: `${candidate.candidateId} — PROPOSED FLAT REDUCTION` });
    }
    input.push({
      type: "image",
      mime_type: candidate.mimeType,
      data: candidate.base64,
    });
  });
  const payload = await geminiInteraction(apiKey, input, {
    model: GEMINI_JURY_MODEL,
    retries: 3,
  });
  const strings: string[] = [];
  collectText(payload, strings);
  const json = strings.join("\n").match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("Gemini jury returned no JSON.");
  return (JSON.parse(json) as { scores?: JuryScore[] }).scores ?? [];
}

async function openAIJury(
  apiKey: string,
  candidates: RawCandidate[],
  stage: "exploration" | "final" = "exploration",
) {
  const rubric = stage === "final"
    ? `Act as an independent senior identity-design jury. These are final flat logo
reductions derived from approved architectural maquettes. Reject text or pseudo-text,
letters, house/property icons, stock geometry, arbitrary abstraction, loss of the source
architecture, weak counterspace, poor optical craft or failure at 24px. Score fidelity
to architectural idea 25, distinctiveness 25, formal craft 20, 24px clarity 15 and
brand fit 15. A reject is mandatory for any fatal flaw.`
    : `Act as an independent senior architect and identity creative director.
These are stage-one architectural maquettes, not logos. Reject conventional houses,
property icons, generic stacked blocks, arbitrary sculpture, implausible cantilevers,
weak spatial hierarchy and anything without an ownable spatial move. Score architectural
idea 25, spatial originality 25, structural coherence 20, silhouette/reduction potential
15 and brand fit 15. Do not penalize a strong study merely because it is not flat yet.`;
  const content: Array<Record<string, unknown>> = [{
    type: "input_text",
    text: `${rubric}
Specifications by candidate:
${candidates.map((item) => `${item.candidateId}: ${item.specification}`).join("\n")}`,
  }];
  candidates.forEach((candidate) => {
    if (candidate.referenceBase64 && candidate.referenceMimeType) {
      content.push({
        type: "input_text",
        text: `${candidate.candidateId} — SOURCE ARCHITECTURAL MAQUETTE`,
      });
      content.push({
        type: "input_image",
        image_url: `data:${candidate.referenceMimeType};base64,${candidate.referenceBase64}`,
        detail: "high",
      });
      content.push({
        type: "input_text",
        text: `${candidate.candidateId} — PROPOSED FLAT REDUCTION`,
      });
    }
    content.push({
      type: "input_image",
      image_url: `data:${candidate.mimeType};base64,${candidate.base64}`,
      detail: "high",
    });
  });
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(180_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.6-sol",
      reasoning: { effort: "high" },
      input: [{ role: "user", content }],
      max_output_tokens: 12000,
      text: {
        format: {
          type: "json_schema",
          name: "logo_jury",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    candidateId: { type: "string" },
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    reject: { type: "boolean" },
                    reason: { type: "string" },
                  },
                  required: ["candidateId", "score", "reject", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scores"],
            additionalProperties: false,
          },
        },
      },
    }),
  });
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message || "OpenAI jury failed.");
  const text =
    payload.output_text ??
    payload.output?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI jury returned no JSON.");
  return (JSON.parse(text) as { scores: JuryScore[] }).scores;
}

export async function createCuratedConcepts(
  brief: LogoBrief,
  keys: { openai: string; gemini: string },
  count: 1 | 4,
  excludeTitles: string[] = [],
): Promise<CreativeCandidate[]> {
  const plans = await createArtDirectionPlans(
    brief,
    keys.openai,
    count,
    excludeTitles,
  );
  const raw: RawCandidate[] = [];
  for (const [index, plan] of plans.entries()) {
    // Stagger image calls so a demand spike does not kill the whole batch at once.
    if (index > 0) await sleep(1200);
    const image = await generateExploration(keys.gemini, brief, plan, 1);
    raw.push({
        candidateId: `${plan.key}-1`,
        planKey: plan.key,
        specification: [
          `silhouette=${plan.silhouette}`,
          `components=${plan.componentCount}`,
          `construction=${plan.construction}`,
          `proportions=${plan.proportions}`,
          `counterspace=${plan.counterspace}`,
          `signature=${plan.signatureMove}`,
          `forbidden=${plan.forbiddenDrift}`,
        ].join("; "),
      key: `${plan.key}-${crypto.randomUUID().slice(0, 8)}`,
      title: plan.title,
      thesis: plan.thesis,
      rationale: plan.rationale,
      base64: image.data,
      mimeType: image.mimeType,
      score: 0,
      verdict: "",
    });
  }
  const [geminiScores, openAIScores] = await Promise.all([
    geminiJury(keys.gemini, raw),
    openAIJury(keys.openai, raw),
  ]);
  const merged = raw.map((candidate, index) =>
    mergeJuryVerdicts(
      candidate,
      pickJuryScore(geminiScores, candidate.candidateId, index),
      pickJuryScore(openAIScores, candidate.candidateId, index),
      "exploration",
    ),
  );
  console.log({
    event: "logo_exploration_jury",
    scores: merged.map((item) => ({
      id: item.candidateId,
      title: item.title,
      score: item.score,
      verdict: item.verdict.slice(0, 160),
    })),
  });

  // Stage one remains visible for comparison. Only a dual-jury pass may be
  // presented as recommended by the API layer.
  const ranked = [...merged].sort((a, b) => b.score - a.score);
  if (!ranked.length) {
    throw new Error(
      "Creative explorations were generated, but the jury returned no usable scores.",
    );
  }
  console.warn({
    event: "logo_jury_soft_fallback",
    passing88: ranked.filter((item) => item.score >= 88).length,
    returning: ranked.length,
    top: ranked.slice(0, 4).map((item) => ({
      id: item.candidateId,
      score: item.score,
      title: item.title,
    })),
  });
  return ranked;
}

export async function refineWithGemini(
  apiKey: string,
  brief: LogoBrief,
  source: { base64: string; mimeType: string },
  critique: string,
) {
  const { payload, model } = await generateImageWithFallback(
    apiKey,
    [
      {
        type: "text",
        text: `STAGE TWO — ARCHITECTURE-TO-IDENTITY REDUCTION.
The attached image is an approved architectural maquette, not a logo. Reconstruct its
defining architectural idea as a professional flat brand symbol.

Brand idea: ${brief.coreIdea}
Jury observations: ${critique}

Preserve only the source object's unmistakable massing relationship, signature void,
cantilever/support logic and asymmetrical silhouette. Remove perspective, materials,
lighting, model-making detail, windows, stairs, landscape and incidental surfaces.
Resolve the result into 2–4 closed, solid near-black shapes with one dominant negative
space. Use exact hard edges, optical corrections, stable joins and generous internal
clearance. It must remain recognizable at 24px and must visibly inherit the approved
architecture rather than inventing a new symbol.

Use a strict front orthographic/elevation projection. Absolute two-dimensional black
and white only: no visible top or side faces, vanishing points, depth, bevel, extrusion,
ambient occlusion, cast shadow, tonal variation, grey or model photography. If the
result still looks like a maquette or building render, it is invalid.

Return one isolated flat near-black symbol centered on warm white. No wordmark, letters,
numbers, pseudo-text, monogram, arrow, house icon, property logo, app icon, mockup,
caption, outline strokes, gradients, shadows or texture. Image only.`,
      },
      { type: "image", mime_type: source.mimeType, data: source.base64 },
    ],
    { type: "image", aspect_ratio: "1:1", image_size: "2K" },
    [GEMINI_PRO_IMAGE, GEMINI_FLASH_IMAGE],
  );
  const image = findImage(payload);
  if (!image) throw new Error("Gemini returned no refined image.");
  console.log({ event: "gemini_refine_model", model });
  return image;
}

export async function evaluateReducedLogo(
  keys: { openai: string; gemini: string },
  brief: LogoBrief,
  source: { base64: string; mimeType: string },
  reference: { base64: string; mimeType: string },
) {
  const candidate: RawCandidate = {
    candidateId: "reduced-logo-1",
    planKey: "architecture-reduction",
    specification: `Final flat identity reduction derived from an approved architectural
maquette. Preserve architectural massing, structural logic and signature negative space.
Brand idea: ${brief.coreIdea}. Avoid: ${brief.avoid}. Must use 2–4 solid shapes, no text,
letters, house/property cliché, arbitrary geometry or detail that fails at 24px.`,
    key: "architecture-reduction",
    title: "Architectural reduction",
    thesis: brief.coreIdea,
    rationale: "A separate identity-design pass derived from the selected architecture.",
    base64: source.base64,
    mimeType: source.mimeType,
    referenceBase64: reference.base64,
    referenceMimeType: reference.mimeType,
    score: 0,
    verdict: "",
  };
  const [geminiScores, openAIScores] = await Promise.all([
    geminiJury(keys.gemini, [candidate], "final"),
    openAIJury(keys.openai, [candidate], "final"),
  ]);
  const judged = mergeJuryVerdicts(
    candidate,
    pickJuryScore(geminiScores, candidate.candidateId, 0),
    pickJuryScore(openAIScores, candidate.candidateId, 0),
    "final",
  );
  return { score: judged.score, verdict: judged.verdict };
}
