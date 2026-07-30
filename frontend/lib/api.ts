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

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), init);
}
