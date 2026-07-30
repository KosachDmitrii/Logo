import type { LogoBrief } from "./mvp-runtime";

export type VectorConcept = {
  key: string;
  title: string;
  thesis: string;
  rationale: string;
  svg: string;
  score: number;
  verdict: string;
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  error?: { message?: string };
  status?: string;
};

const responseModel = "gpt-5.6-terra";

function extractOutputText(payload: OpenAIResponse) {
  if (payload.output_text) return payload.output_text;
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
      if (content.type === "refusal" && content.refusal) {
        throw new Error(`OpenAI refused the art-direction request: ${content.refusal}`);
      }
    }
  }
  const itemTypes = (payload.output ?? []).map((item) => item.type).join(",") || "none";
  throw new Error(
    payload.error?.message ||
      `OpenAI returned no structured design output (status: ${payload.status ?? "unknown"}; items: ${itemTypes}).`,
  );
}

async function structuredResponse<T>(
  apiKey: string,
  name: string,
  schema: Record<string, unknown>,
  instructions: string,
  input: string,
  effort: "medium" | "high" | "xhigh" = "high",
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(240_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: responseModel,
      reasoning: { effort },
      instructions,
      input,
      max_output_tokens: 16000,
      text: {
        format: {
          type: "json_schema",
          name,
          strict: true,
          schema,
        },
      },
    }),
  });
  const payload = (await response.json()) as OpenAIResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI returned HTTP ${response.status}.`);
  }
  return JSON.parse(extractOutputText(payload)) as T;
}

const territorySchema = {
  type: "object",
  properties: {
    territories: {
      type: "array",
      minItems: 6,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          thesis: { type: "string" },
          visualMechanism: { type: "string" },
          ownableDetail: { type: "string" },
          rejectionTrap: { type: "string" },
        },
        required: [
          "key",
          "title",
          "thesis",
          "visualMechanism",
          "ownableDetail",
          "rejectionTrap",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["territories"],
  additionalProperties: false,
} as const;

const finalSchema = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          thesis: { type: "string" },
          rationale: { type: "string" },
          paths: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
          score: { type: "integer", minimum: 0, maximum: 100 },
          verdict: { type: "string" },
        },
        required: [
          "key",
          "title",
          "thesis",
          "rationale",
          "paths",
          "score",
          "verdict",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts"],
  additionalProperties: false,
} as const;

const executionPlanSchema = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          thesis: { type: "string" },
          rationale: { type: "string" },
          executionPrompt: { type: "string" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          verdict: { type: "string" },
        },
        required: ["key", "title", "thesis", "rationale", "executionPrompt", "score", "verdict"],
        additionalProperties: false,
      },
    },
  },
  required: ["concepts"],
  additionalProperties: false,
} as const;

function briefText(brief: LogoBrief) {
  return JSON.stringify(
    {
      brand: brief.brandName,
      industry: brief.industry,
      company: brief.companyDescription,
      coreIdea: brief.coreIdea,
      audience: brief.audience,
      positioning: brief.positioning,
      personality: brief.personalities,
      visualDirection: brief.visualDirection,
      competitors: brief.competitors,
      avoid: brief.avoid,
      useCases: brief.usage,
      logoType: brief.logoType,
    },
    null,
    2,
  );
}

function validatePath(path: string) {
  const value = path.trim();
  if (
    value.length < 12 ||
    value.length > 3000 ||
    /[<>{}"'`;=&]|url|script|text|image|foreign/i.test(value) ||
    !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\-\s]+$/.test(value)
  ) {
    throw new Error("The design model returned an unsafe or invalid SVG path.");
  }
  return value;
}

function renderSvg(paths: string[]) {
  const geometry = paths
    .map((path) => `<path d="${validatePath(path)}" fill="#171716"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Abstract logo symbol"><rect width="512" height="512" fill="#F7F4ED"/>${geometry}</svg>`;
}

async function executeWithRecraft(apiKey: string, prompt: string) {
  const response = await fetch("https://external.api.recraft.ai/v1/images/generations/vector", {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "recraftv4_1_vector",
      n: 1,
      response_format: "url",
      size: "1024x1024",
      prompt,
    }),
  });
  const payload = (await response.json()) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    detail?: string;
  };
  if (!response.ok) {
    throw new Error(payload.detail || `Recraft returned HTTP ${response.status}.`);
  }
  const base64 = payload.data?.[0]?.b64_json;
  const url = payload.data?.[0]?.url;
  let svg = base64 ? atob(base64) : "";
  if (!svg && url) {
    const download = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!download.ok) throw new Error("Recraft SVG download failed.");
    svg = await download.text();
  }
  if (!svg.includes("<svg") || /<text\b|<image\b|<foreignObject\b|<script\b/i.test(svg)) {
    throw new Error("Recraft returned an invalid or text-bearing SVG.");
  }
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"https?:[^"]*"|'https?:[^']*')/gi, "");
}

export async function createVectorConcepts(
  brief: LogoBrief,
  openAIApiKey: string,
  recraftApiKey: string,
  count: 1 | 4,
  excludeTitles: string[] = [],
): Promise<VectorConcept[]> {
  const strategy = await structuredResponse<{
    territories: Array<{
      key: string;
      title: string;
      thesis: string;
      visualMechanism: string;
      ownableDetail: string;
      rejectionTrap: string;
    }>;
  }>(
    openAIApiKey,
    "brand_concept_territories",
    territorySchema,
    `You are the strategy partner at a world-class independent brand identity studio.
Develop six genuinely different, brand-specific territories for a symbol. Think in
meaning, behavior, tension, transformation, rhythm and counterform—not stock shapes.
Each territory needs one ownable visual mechanism and an explicit rejection trap.
Avoid literal category illustration, visual puns, initials, fashionable sameness,
generic geometry and anything named in the brief. Titles describe ideas, not shapes.`,
    `Create six territories from this brief:\n${briefText(brief)}
Already used titles to avoid: ${excludeTitles.join(", ") || "none"}`,
    "medium",
  );

  const plan = await structuredResponse<{
    concepts: Array<{
      key: string;
      title: string;
      thesis: string;
      rationale: string;
      executionPrompt: string;
      score: number;
      verdict: string;
    }>;
  }>(
    openAIApiKey,
    "production_vector_logo_plan",
    {
      ...executionPlanSchema,
      properties: {
        concepts: {
          ...executionPlanSchema.properties.concepts,
          minItems: count,
          maxItems: count,
        },
      },
    },
    `Act as both a world-class identity design director and an unforgiving final juror.
Select the strongest, most differentiated territories, then write ${count} exact
art-direction brief${count === 1 ? "" : "s"} for a specialist vector identity model.

This is identity design, not illustration. Every mark must have one clear conceptual
move, a distinctive outer silhouette, intentional counterspace, optical balance and a
recognizable 24px read. It must feel authored rather than generated. Prefer subtraction,
controlled asymmetry and surprising spatial relationships over adding more parts.

EXECUTION-PROMPT CONTRACT:
- Describe one isolated flat near-black symbol centered on plain warm white.
- Specify the conceptual move, silhouette, counterspace and optical relationship.
- Demand very few closed vector shapes, generous clearspace and exact hard edges.
- No strokes, letters, numerals, words, captions or glyph-like forms.
- No houses, roofs, doors, arches, buildings, floor plans or category pictograms.
- No circles beside rectangles, random blobs, decorative ribbons or stock-logo forms.
- Do not merely visualize a territory description; resolve it into an ownable mark.

Score each result harshly on concept 25, distinctiveness 25, formal craft 20,
small-size clarity 15 and brief fit 15. A score above 90 means portfolio-grade.
Silently revise until each submitted concept earns at least 88. Never inflate scores.`,
    `BRAND BRIEF:\n${briefText(brief)}

CANDIDATE TERRITORIES:
${JSON.stringify(strategy.territories, null, 2)}

Return exactly ${count} production concepts. They must be structurally different from
one another and from these previous titles: ${excludeTitles.join(", ") || "none"}.`,
    "high",
  );

  if (plan.concepts.length !== count) {
    throw new Error(`The design model returned ${plan.concepts.length} concepts; expected ${count}.`);
  }
  return Promise.all(
    plan.concepts.map(async (concept) => ({
      key: `${concept.key || "concept"}-${crypto.randomUUID().slice(0, 8)}`,
      title: concept.title.slice(0, 80),
      thesis: concept.thesis.slice(0, 280),
      rationale: concept.rationale.slice(0, 600),
      svg: await executeWithRecraft(
        recraftApiKey,
        `${concept.executionPrompt}

Professional brand identity symbol, not an illustration or UI icon. One ownable idea.
Flat solid near-black vector shapes on a plain warm off-white square. Strong negative
space, optically balanced, unmistakable at 24px, editable SVG quality.
ABSOLUTELY ZERO text, letters, initials, numbers, signatures, captions, mockups,
buildings, houses, roofs, doors, floor plans, food, gradients, shadows, texture or 3D.`,
      ),
      score: Math.min(89, Math.max(0, Math.round(concept.score))),
      verdict: `Pending independent visual review. ${concept.verdict.slice(0, 180)}`,
    })),
  );
}

export async function refineVectorConcept(
  brief: LogoBrief,
  apiKey: string,
  sourceSvg: string,
  directionTitle: string,
  variant: number,
): Promise<VectorConcept> {
  const sourcePaths = Array.from(
    sourceSvg.matchAll(/<path\b[^>]*\sd=(["'])(.*?)\1/gi),
  ).map(
    (match) => validatePath(match[2]),
  );
  if (!sourcePaths.length) throw new Error("The selected vector concept has no paths.");
  const final = await structuredResponse<{
    concepts: Array<{
      key: string;
      title: string;
      thesis: string;
      rationale: string;
      paths: string[];
      score: number;
      verdict: string;
    }>;
  }>(
    apiKey,
    "refined_vector_logo",
    {
      ...finalSchema,
      properties: {
        concepts: {
          ...finalSchema.properties.concepts,
          minItems: 1,
          maxItems: 1,
        },
      },
    },
    `You are the senior design director doing final optical correction on an approved
vector logo concept. Preserve its core idea and recognition. Improve proportion,
counterspace, alignment, visual weight, curve quality and 24px clarity. Variant
${variant} should be ${variant === 1 ? "restrained, timeless and optically exact" : "more distinctive, assertive and ownable"}.
Return one revised construction as 1–5 closed SVG path d strings on the same 512×512
grid. Coordinates stay within 56..456. No SVG tags, fills, transforms, strokes, text,
letters, pictograms, buildings, decorative additions or new concept. Score harshly;
revise silently until it is portfolio-grade.`,
    `BRAND BRIEF:\n${briefText(brief)}
SELECTED DIRECTION: ${directionTitle}
SOURCE PATHS:\n${JSON.stringify(sourcePaths, null, 2)}`,
    "high",
  );
  const concept = final.concepts[0];
  return {
    key: `${concept.key || "refine"}-${crypto.randomUUID().slice(0, 8)}`,
    title: concept.title.slice(0, 80),
    thesis: concept.thesis.slice(0, 280),
    rationale: concept.rationale.slice(0, 600),
    svg: renderSvg(concept.paths),
    score: Math.max(0, Math.min(100, Math.round(concept.score))),
    verdict: concept.verdict.slice(0, 240),
  };
}
