export type LogoQualityReport = {
  approved: boolean;
  containsText: boolean;
  containsMockup: boolean;
  forbiddenCliche: boolean;
  simpleSilhouette: boolean;
  directionMatch: boolean;
  score: number;
  reason: string;
};

type QualityRuntime = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

type VisionResponse = {
  result?: unknown;
  errors?: Array<{ message?: string }>;
  success?: boolean;
};

export function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function parseReport(value: string): LogoQualityReport {
  const json = value
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/i, "")
    .match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error("The logo quality check returned invalid JSON.");
  const parsed = JSON.parse(json) as Partial<LogoQualityReport>;
  const score = Math.max(0, Math.min(100, Number(parsed.score ?? 0)));
  const report = {
    approved: Boolean(parsed.approved),
    containsText: Boolean(parsed.containsText),
    containsMockup: Boolean(parsed.containsMockup),
    forbiddenCliche: Boolean(parsed.forbiddenCliche),
    simpleSilhouette: Boolean(parsed.simpleSilhouette),
    directionMatch: Boolean(parsed.directionMatch),
    score,
    reason:
      typeof parsed.reason === "string"
        ? parsed.reason.slice(0, 240)
        : "The image did not pass the production logo check.",
  };
  report.approved =
    report.approved &&
    !report.containsText &&
    !report.containsMockup &&
    !report.forbiddenCliche &&
    report.simpleSilhouette &&
    report.directionMatch &&
    report.score >= 75;
  return report;
}

function collectStrings(value: unknown, into: string[], depth = 0) {
  if (depth > 4 || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) into.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (
        key === "answer" ||
        key === "response" ||
        key === "caption" ||
        key === "text" ||
        key === "content" ||
        key === "output"
      ) {
        collectStrings(nested, into, depth + 1);
      }
    }
    // Prefer named fields; fall back to shallow scan if nothing found.
    if (!into.length) {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        collectStrings(nested, into, depth + 1);
      }
    }
  }
}

function extractAnswer(payload: VisionResponse) {
  const candidates: string[] = [];
  collectStrings(payload.result, candidates);
  const withJson = candidates.find((item) => item.includes("{") && item.includes("}"));
  return withJson ?? candidates[0] ?? "";
}

export async function assessLogoImage(
  base64: string,
  context: {
    avoid: string;
    direction: string;
    stage: "concept" | "refine" | "vector";
  },
  runtime: QualityRuntime,
) {
  if (!runtime.CLOUDFLARE_ACCOUNT_ID || !runtime.CLOUDFLARE_API_TOKEN) {
    throw new Error("Logo quality control is not configured.");
  }
  const contentType = base64.startsWith("/9j/")
    ? "image/jpeg"
    : base64.startsWith("UklGR")
      ? "image/webp"
      : "image/png";
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/moondream/moondream3.1-9B-A2B`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task: "query",
        image: `data:${contentType};base64,${base64}`,
        question: `Review this ${context.stage} logo mark.
Direction: ${context.direction}
Forbidden: ${context.avoid || "generic stock-logo clichés"}

Reject letters/text, mockups, gradients/shadows/3D, literal industry clichés, or generic shapeless blobs with no ownable idea.

Return ONLY this JSON:
{"approved":boolean,"containsText":boolean,"containsMockup":boolean,"forbiddenCliche":boolean,"simpleSilhouette":boolean,"directionMatch":boolean,"score":number,"reason":"short sentence"}
approved=true only if score>=75 and the mark is a clean flat symbol on a plain background.`,
        reasoning: false,
        max_tokens: 220,
        temperature: 0,
        stream: false,
      }),
    },
  );
  const raw = await response.text();
  let payload: VisionResponse;
  try {
    payload = JSON.parse(raw) as VisionResponse;
  } catch {
    throw new Error(
      `Logo quality control returned a non-JSON response (HTTP ${response.status}).`,
    );
  }
  const text = extractAnswer(payload);
  if (!response.ok || !text) {
    const resultKeys =
      payload.result && typeof payload.result === "object"
        ? Object.keys(payload.result as object).join(",")
        : typeof payload.result;
    console.warn({
      event: "logo_review_empty_response",
      status: response.status,
      resultKeys,
      rawPreview: raw.slice(0, 500),
    });
    throw new Error(
      payload.errors?.[0]?.message ??
        `Logo quality control is unavailable (HTTP ${response.status}).`,
    );
  }
  return parseReport(text);
}
