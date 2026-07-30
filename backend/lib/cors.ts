/** Origins allowed for local UI → Railway API. */
export function isAllowedCorsOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;

  const fromEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (fromEnv.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return true;
    }
    // Phone / LAN testing against the machine running `next dev`.
    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function applyCorsHeaders(
  request: Request,
  headers: Headers,
): Headers {
  const origin = request.headers.get("origin");
  if (!isAllowedCorsOrigin(origin) || !origin) return headers;
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return headers;
}

export function corsPreflightResponse(request: Request): Response {
  const headers = applyCorsHeaders(request, new Headers());
  return new Response(null, { status: 204, headers });
}
