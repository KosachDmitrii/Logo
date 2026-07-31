const DEFAULT_API_BASE = "/api";

/** Baked at build time. Same-origin `/api`, or absolute Railway API root. */
export function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_API_BASE;
  return raw.replace(/\/+$/, "");
}

/**
 * Build an API URL from a path relative to the API root.
 * Accepts `project-list`, `/projects/id`, or legacy `/api/projects/id`.
 */
export function apiUrl(path: string): string {
  const base = getApiBase();
  let suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/api") suffix = "";
  else if (suffix.startsWith("/api/")) suffix = suffix.slice(4);
  return `${base}${suffix}`;
}

/** Rewrite relative `/api/...` media URLs when the API base is remote. */
export function resolveMediaUrl(url: string): string {
  if (
    !url ||
    /^https?:\/\//i.test(url) ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return apiUrl(url);
}

/**
 * Same-origin `/api/...` URL for fetching SVG text (tint / plate strip).
 * Avoids cross-origin failures when NEXT_PUBLIC_API_URL points at Railway —
 * the Next rewrite proxy still serves `/api/*` locally.
 */
export function sameOriginApiUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("/api/")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) {
    return url.startsWith("/api") ? url : apiUrl(url);
  }
  try {
    const parsed = new URL(url, "http://local.invalid");
    if (parsed.pathname.startsWith("/api/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // ignore
  }
  return resolveMediaUrl(url);
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}

/** Parse JSON bodies; surface plain-text/HTML proxy failures as readable errors. */
export async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    throw new Error(
      response.ok
        ? "Empty response from API."
        : `Request failed (${response.status}).`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 160);
    if (/internal server error/i.test(trimmed)) {
      throw new Error(
        "API proxy timed out or the server dropped the connection. Long generations need a higher proxy timeout — restart `next dev` after updating next.config.",
      );
    }
    throw new Error(
      response.ok
        ? `Unexpected API response: ${trimmed}`
        : `Request failed (${response.status}): ${trimmed}`,
    );
  }
}
