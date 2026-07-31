import { rpc } from "@/backend/lib/supabase";

const HOUR_MS = 60 * 60 * 1000;

export type RateLimitRule = {
  /** Unique key prefix, e.g. generate / refine / otp */
  action: string;
  limit: number;
  windowMs?: number;
};

export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  constructor(message = "Studio pace limit reached. Give it a moment, then continue.") {
    super(message);
    this.name = "RateLimitError";
  }
}

function enforceEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function assertRateLimit(
  identity: string,
  rule: RateLimitRule,
): Promise<void> {
  if (!enforceEnabled()) return;
  if (!identity) throw new RateLimitError();

  const windowMs = rule.windowMs ?? HOUR_MS;
  const bucket = `${rule.action}:${identity.toLowerCase()}`;
  const allowed = await rpc<boolean>("hit_studio_rate_limit", {
    p_bucket: bucket,
    p_limit: rule.limit,
    p_window_ms: windowMs,
  });
  if (!allowed) throw new RateLimitError();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Production pace guards for expensive AI routes. */
export const RATE_LIMITS = {
  generateUser: { action: "generate:user", limit: 5 },
  generateIp: { action: "generate:ip", limit: 20 },
  refineUser: { action: "refine:user", limit: 20 },
  vectorizeUser: { action: "vectorize:user", limit: 20 },
  otpIp: { action: "otp:ip", limit: 8 },
  checkoutUser: { action: "checkout:user", limit: 10 },
} as const satisfies Record<string, RateLimitRule>;
