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
  result?: { response?: string };
  errors?: Array<{ message?: string }>;
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
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${runtime.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
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
              "You are a strict senior identity-design production reviewer. Return only compact valid JSON.",
          },
          {
            role: "user",
            content: `Review this ${context.stage} image as a production logo symbol.
Expected direction: ${context.direction}
Forbidden ideas and forms: ${context.avoid || "generic stock-logo clichés"}

Reject it if it contains any letters, words, numbers, captions or pseudo-text; a mockup, border, presentation board or multiple options; gradients, shadows, texture or 3D; a forbidden or generic category cliché; excessive detail; an unclear silhouette; or weak correspondence to the direction.

Return exactly:
{"approved":boolean,"containsText":boolean,"containsMockup":boolean,"forbiddenCliche":boolean,"simpleSilhouette":boolean,"directionMatch":boolean,"score":number,"reason":"short sentence"}
Set approved=true only for a clean, isolated, flat, single-color symbol on a plain background with score 75 or higher.`,
          },
        ],
        image: `data:image/png;base64,${base64}`,
        max_tokens: 260,
        temperature: 0,
      }),
    },
  );
  const payload = (await response.json()) as VisionResponse;
  const text = payload.result?.response;
  if (!response.ok || !text) {
    throw new Error(
      payload.errors?.[0]?.message ??
        "Logo quality control is unavailable. Confirm the Workers AI vision-model license.",
    );
  }
  return parseReport(text);
}
