import type { LogoBrief } from "./mvp-runtime";
import {
  buildStructuredLogoPrompt,
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
    lower.includes("overloaded") ||
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline")
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run async work with limited concurrency (faster than serial, safer than full blast). */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );
  return results;
}

async function geminiInteraction(
  apiKey: string,
  input: Array<Record<string, string>>,
  options: {
    model: string;
    responseFormat?: Record<string, string>;
    serviceTier?: "standard" | "priority";
    retries?: number;
    timeoutMs?: number;
  },
) {
  const retries = options.retries ?? 3;
  const timeoutMs = options.timeoutMs ?? 180_000;
  let lastError = "Gemini request failed.";
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/interactions",
        {
          method: "POST",
          signal: AbortSignal.timeout(timeoutMs),
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const aborted =
        (error instanceof Error && error.name === "TimeoutError") ||
        /aborted|timeout|timed out/i.test(message);
      lastError = aborted
        ? `Gemini ${options.model} timed out after ${Math.round(timeoutMs / 1000)}s.`
        : message;
      if (!isTransientGeminiError(lastError) || attempt === retries - 1) {
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
  }
  throw new Error(lastError);
}

async function generateImageWithFallback(
  apiKey: string,
  input: Array<Record<string, string>>,
  responseFormat: Record<string, string>,
  models: string[],
  options?: { retries?: number; timeoutMs?: number },
) {
  let lastError = new Error("Gemini image generation failed.");
  for (const model of models) {
    try {
      const payload = await geminiInteraction(apiKey, input, {
        model,
        responseFormat,
        // One quick retry, then switch model — long backoff on a dead model wastes minutes.
        retries: options?.retries ?? 2,
        timeoutMs: options?.timeoutMs ?? 240_000,
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
  styleReference?: { base64: string; mimeType: string },
  correction = "",
) {
  const structured = buildStructuredLogoPrompt(plan, brief.avoid);
  // Send the four-block brief like a direct Imagen/Gemini paste — no extra bureaucracy.
  const input: Array<Record<string, string>> = [{
    type: "text",
    text: `${structured}

Generate one centered logo image from this brief. Symbol only — no wordmark or text
in the image (typography is added later). Image only.
${correction ? `\nCorrection: ${correction}\nKeep the same territory; fix the issue.` : ""}`,
  }];
  if (styleReference) {
    input.push({
      type: "text",
      text: `VISUAL ART-DIRECTION REFERENCE. Study only its degree of reduction,
bold black-and-white contrast, architectural confidence, symbol-to-clear-space ratio and
professional finish. Ignore all surrounding interface, text and controls. Do not copy,
trace or closely imitate any pictured symbol. Create a new ${brief.brandName}-specific idea.`,
    });
    input.push({
      type: "image",
      mime_type: styleReference.mimeType,
      data: styleReference.base64,
    });
  }
  // Exploration prioritises speed + idea. Pro is refine-only.
  const { payload, model } = await generateImageWithFallback(
    apiKey,
    input,
    { type: "image", aspect_ratio: "1:1", image_size: "1K" },
    [GEMINI_FLASH_IMAGE, GEMINI_PRO_IMAGE],
    { retries: 2, timeoutMs: 180_000 },
  );
  const image = findImage(payload);
  if (!image) throw new Error("Gemini returned no generated image.");
  const avoidLogged = (brief.avoid.trim() || plan.avoidBlock.trim()).replace(
    /\s+/g,
    " ",
  );
  console.log({
    event: "gemini_exploration_model",
    model,
    direction: plan.key,
    corrected: Boolean(correction),
    promptChars: structured.length,
    blocks: {
      subject: plan.subject.trim().replace(/\s+/g, " "),
      symbolDetails: plan.symbolDetails.trim().replace(/\s+/g, " "),
      avoid: avoidLogged,
      style: plan.stylePresentation.trim().replace(/\s+/g, " "),
    },
    prompt: structured,
  });
  return image;
}

type JuryScore = {
  candidateId: string;
  score: number;
  reject: boolean;
  reason: string;
};

function normalizeJuryScores(
  scores: Array<Partial<JuryScore> & Record<string, unknown>> | undefined,
): JuryScore[] {
  return (scores ?? []).map((item) => ({
    candidateId: String(item.candidateId ?? ""),
    score: Math.max(0, Math.min(100, Number(item.score ?? 0))),
    reject: Boolean(item.reject),
    reason: String(
      item.reason ??
        item.verdict ??
        item.critique ??
        item.explanation ??
        "No written critique returned.",
    ).slice(0, 400),
  }));
}

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
  // Exploration stays conservative (min). Final is advisory — average so one
  // harsh craft note cannot bury an otherwise shippable mark.
  const score =
    stage === "final"
      ? Math.round(
          parts.reduce((sum, item) => sum + item.score, 0) / parts.length,
        )
      : Math.min(...parts.map((item) => item.score));
  const anyReject = parts.some((item) => item.reject);
  const reasons = [
    gemini ? `Gemini: ${gemini.reason}` : null,
    openai ? `OpenAI: ${openai.reason}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const label =
    stage === "final"
      ? "Final dual jury"
      : parts.length > 1
        ? "Dual jury"
        : "Exploration jury";
  return {
    ...candidate,
    score: anyReject ? Math.min(score, 59) : score,
    verdict: `${label} — ${reasons}`.slice(0, 500),
  };
}

async function geminiJury(
  apiKey: string,
  candidates: RawCandidate[],
  stage: "exploration" | "final" = "exploration",
  clientAvoid = "",
) {
  const avoidLaw = clientAvoid.trim()
    || "Use only constraints stated in each candidate specification.";
  const rubric = stage === "final"
    ? `You are a senior identity-design jury reviewing refined flat logo symbols.
The wordmark is added separately by the application.

Style law ONLY (system — do not extend it):
- flat 2D graphic
- light / off-white background
- no 3D

Everything else is Client AVOID / brief from the form. Do not invent extra style or
content bans (no hardcoded shadows/gradients/letters/house/food rules).

Client AVOID (binding content law from the form):
${avoidLaw}

Reject only for clear breaks of Style law OR Client AVOID.
Do NOT reject ambiguous negative space that "might look like a letter" unless AVOID
explicitly forbids letters.
Score idea 25, distinctiveness 25, formal craft 20, 24px clarity 15 and brand fit 15.`
    : `You are reviewing logo exploration concepts with a SHORT checklist only.

Style law ONLY (system — do not extend it):
- flat 2D graphic
- light / off-white background
- no 3D

Everything else comes from the form. Do not invent extra bans.

Client AVOID (binding content law from the form):
${avoidLaw}

Reject only if the image clearly breaks Style law or Client AVOID.
Do NOT reject for ambiguous negative space that "might look like a letter" unless
AVOID explicitly forbids letters.
Do NOT demand perfect craft — that comes in refine.

Score generously on idea and silhouette (concept 40, distinctiveness 30, brand fit 30).
reject=true only for clear Style or Client AVOID breaks.`;
  const input: Array<Record<string, string>> = [{
    type: "text",
    text: `${rubric}
Return ONLY JSON: {"scores":[{"candidateId":"...","score":0,"reject":true,"reason":"..."}]}
Specifications by candidate:
${candidates.map((item) => `${item.candidateId}: ${item.specification}`).join("\n")}`,
  }];
  candidates.forEach((candidate) => {
    if (candidate.referenceBase64 && candidate.referenceMimeType) {
      input.push({ type: "text", text: `${candidate.candidateId} — SOURCE LOGO CONCEPT` });
      input.push({
        type: "image",
        mime_type: candidate.referenceMimeType,
        data: candidate.referenceBase64,
      });
      input.push({ type: "text", text: `${candidate.candidateId} — REFINED LOGO` });
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
  return normalizeJuryScores(
    (JSON.parse(json) as { scores?: Array<Partial<JuryScore> & Record<string, unknown>> })
      .scores,
  );
}

async function openAIJury(
  apiKey: string,
  candidates: RawCandidate[],
  stage: "exploration" | "final" = "exploration",
  clientAvoid = "",
) {
  const avoidLaw = clientAvoid.trim()
    || "Use only constraints stated in each candidate specification.";
  const rubric = stage === "final"
    ? `Act as an independent senior identity-design jury for refined flat logo symbols.
Wordmark is added separately by the application.
Style law ONLY (system — do not extend): flat 2D, light/off-white background, no 3D.
Client AVOID from the form (binding; do not invent bans): ${avoidLaw}
Reject only clear Style or Client AVOID breaks. Do not reject "looks like a letter"
unless AVOID explicitly forbids letters/text. Score idea 25, distinctiveness 25,
formal craft 20, 24px clarity 15 and brand fit 15.`
    : `Act as an independent senior identity creative director reviewing explorations.
Style law ONLY (system — do not extend): flat 2D, light/off-white background, no 3D.
Client AVOID from the form (binding; do not invent bans): ${avoidLaw}
Do not reject ambiguous negative space unless AVOID forbids letters.
Score concept 40, distinctiveness 30, brand fit 30.`;
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
        text: `${candidate.candidateId} — SOURCE LOGO CONCEPT`,
      });
      content.push({
        type: "input_image",
        image_url: `data:${candidate.referenceMimeType};base64,${candidate.referenceBase64}`,
        detail: "high",
      });
      content.push({
        type: "input_text",
        text: `${candidate.candidateId} — REFINED LOGO`,
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
      reasoning: { effort: stage === "final" ? "high" : "medium" },
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
  return normalizeJuryScores(
    (JSON.parse(text) as { scores?: Array<Partial<JuryScore> & Record<string, unknown>> })
      .scores,
  );
}

export async function createCuratedConcepts(
  brief: LogoBrief,
  keys: { openai: string; gemini: string },
  count: 1 | 4,
  excludeTitles: string[] = [],
  styleReference?: { base64: string; mimeType: string },
): Promise<CreativeCandidate[]> {
  const plans = await createArtDirectionPlans(
    brief,
    keys.openai,
    count,
    excludeTitles,
  );
  const IMAGE_CONCURRENCY = 4;
  const EXPLORATION_THRESHOLD = 55;
  const SOFT_FILL_FLOOR = 40;

  const toCandidate = (
    plan: ArtDirectionPlan,
    image: { data: string; mimeType: string },
    attempt: number,
  ): RawCandidate => ({
    candidateId: `${plan.key}-${attempt}`,
    planKey: plan.key,
    specification: buildStructuredLogoPrompt(plan, brief.avoid),
    key: `${plan.key}-${crypto.randomUUID().slice(0, 8)}`,
    title: plan.title,
    thesis: plan.thesis,
    rationale: plan.rationale,
    base64: image.data,
    mimeType: image.mimeType,
    score: 0,
    verdict: "",
  });

  const raw = await mapPool(plans, IMAGE_CONCURRENCY, async (plan) => {
    const image = await generateExploration(
      keys.gemini,
      brief,
      plan,
      styleReference,
    );
    return toCandidate(plan, image, 1);
  });

  const geminiScores = await geminiJury(
    keys.gemini,
    raw,
    "exploration",
    brief.avoid,
  );
  let reviewed = raw.map((candidate, index) =>
    mergeJuryVerdicts(
      candidate,
      pickJuryScore(geminiScores, candidate.candidateId, index),
      null,
      "exploration",
    ),
  );

  // One directed redo for rejects so the batch can still return ~count concepts.
  const failed = reviewed.filter((item) => item.score < EXPLORATION_THRESHOLD);
  if (failed.length) {
    const retried = await mapPool(failed, IMAGE_CONCURRENCY, async (candidate) => {
      const plan = plans.find((item) => item.key === candidate.planKey);
      if (!plan) return null;
      const image = await generateExploration(
        keys.gemini,
        brief,
        plan,
        styleReference,
        candidate.verdict,
      );
      return toCandidate(plan, image, 2);
    }).then((items) => items.filter((item): item is RawCandidate => item !== null));

    if (retried.length) {
      const retryScores = await geminiJury(
        keys.gemini,
        retried,
        "exploration",
        brief.avoid,
      );
      const retryVerdicts = retried.map((candidate, index) =>
        mergeJuryVerdicts(
          candidate,
          pickJuryScore(retryScores, candidate.candidateId, index),
          null,
          "exploration",
        ),
      );
      reviewed = reviewed.map((candidate) => {
        const retry = retryVerdicts.find(
          (item) => item.planKey === candidate.planKey,
        );
        return retry && retry.score > candidate.score ? retry : candidate;
      });
    }
  }

  console.log({
    event: "logo_exploration_jury",
    scores: reviewed.map((item) => ({
      id: item.candidateId,
      title: item.title,
      score: item.score,
      verdict: item.verdict.slice(0, 160),
    })),
  });

  const passing = [...reviewed]
    .filter((item) => item.score >= EXPLORATION_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  // Soft-fill toward `count` with near-misses so the studio still offers choice.
  const fillers = [...reviewed]
    .filter(
      (item) =>
        item.score >= SOFT_FILL_FLOOR &&
        item.score < EXPLORATION_THRESHOLD &&
        !passing.some((pass) => pass.planKey === item.planKey),
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count - passing.length));
  const ranked = [...passing, ...fillers].slice(0, count);
  if (!ranked.length) {
    throw new Error(
      `The generated symbols did not reach Loopen's ${EXPLORATION_THRESHOLD}/100 exploration threshold. No weak concepts were saved. Run a new exploration.`,
    );
  }
  console.warn({
    event: "logo_jury_soft_fallback",
    passing88: ranked.filter((item) => item.score >= 88).length,
    passing65: passing.length,
    softFilled: fillers.length,
    returning: ranked.length,
    top: ranked.map((item) => ({
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
        text: `STAGE TWO — PROFESSIONAL LOGO REFINEMENT.
The attached image is a selected flat logo symbol for "${brief.brandName}". Keep its
defining idea and make it production-ready without replacing it with a different concept.

Brand idea: ${brief.coreIdea}
Jury observations: ${critique}

Preserve its unmistakable silhouette, visual mechanism and counterform. Improve
proportions, curve tension, corner logic, joins, spacing, optical centering and small-size
clarity. Resolve the symbol into 1–4 closed, solid near-black shapes with generous internal
clearance. It must remain recognizable at 24px and visibly inherit the selected idea.

Absolute two-dimensional black and white only: no top or side faces, perspective, depth,
bevel, extrusion, ambient occlusion, cast shadow, tonal variation or photography.

Return one isolated flat near-black logo symbol centered on warm white. The application
will add the wordmark separately. No text, letters, numbers, pseudo-text, unintended
monogram, house icon, property logo, app icon, mockup, caption, outline strokes,
gradients, shadows or texture. Image only.`,
      },
      { type: "image", mime_type: source.mimeType, data: source.base64 },
    ],
    { type: "image", aspect_ratio: "1:1", image_size: "2K" },
    [GEMINI_PRO_IMAGE, GEMINI_FLASH_IMAGE],
    // Pro 2K is slow under load — one Pro attempt, then Flash; don't burn two Pro timeouts.
    { retries: 1, timeoutMs: 240_000 },
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
    planKey: "logo-refinement",
    specification: `Production refinement derived from a selected flat logo symbol for
"${brief.brandName}". Preserve its core idea, silhouette and signature counterspace.
Brand idea: ${brief.coreIdea}. Avoid: ${brief.avoid}. Use only the solid shapes required
by the selected idea, with no text, letters or numbers, literal category cliché,
arbitrary geometry or detail that fails at 24px.`,
    key: "logo-refinement",
    title: "Logo refinement",
    thesis: brief.coreIdea,
    rationale: "A focused craft pass derived from the selected logo concept.",
    base64: source.base64,
    mimeType: source.mimeType,
    referenceBase64: reference.base64,
    referenceMimeType: reference.mimeType,
    score: 0,
    verdict: "",
  };
  const [geminiScores, openAIScores] = await Promise.all([
    geminiJury(keys.gemini, [candidate], "final", brief.avoid),
    openAIJury(keys.openai, [candidate], "final", brief.avoid),
  ]);
  const judged = mergeJuryVerdicts(
    candidate,
    pickJuryScore(geminiScores, candidate.candidateId, 0),
    pickJuryScore(openAIScores, candidate.candidateId, 0),
    "final",
  );
  return { score: judged.score, verdict: judged.verdict };
}

/** Recommended is an advisory badge only — never a hard gate. */
export const REFINE_RECOMMENDED_SCORE = 75;

/**
 * One Pro refine + dual jury, with a single automatic craft repair when the
 * first pass scores below Recommended but is not a veto/reject.
 */
export async function refineAndReviewWithGemini(
  keys: { gemini: string; openai: string },
  brief: LogoBrief,
  source: { base64: string; mimeType: string },
  critique: string,
) {
  let refined = await refineWithGemini(keys.gemini, brief, source, critique);
  let finalReview = await evaluateReducedLogo(
    keys,
    brief,
    { base64: refined.data, mimeType: refined.mimeType },
    source,
  );
  if (
    finalReview.score < REFINE_RECOMMENDED_SCORE &&
    finalReview.score > 59
  ) {
    console.log({
      event: "logo_refine_auto_repair",
      firstScore: finalReview.score,
      critiquePreview: finalReview.verdict.slice(0, 240),
    });
    try {
      const repaired = await refineWithGemini(
        keys.gemini,
        brief,
        source,
        finalReview.verdict,
      );
      const repairedReview = await evaluateReducedLogo(
        keys,
        brief,
        { base64: repaired.data, mimeType: repaired.mimeType },
        source,
      );
      if (repairedReview.score >= finalReview.score) {
        refined = repaired;
        finalReview = repairedReview;
      }
    } catch (error) {
      console.warn({
        event: "logo_refine_auto_repair_failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { refined, finalReview };
}
