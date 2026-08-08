import type { CompetitorEntry } from "./types.ts";
import { nameKey } from "./normalize.ts";

const COMPETITORS_MAX = 10;

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return Boolean(url.hostname.includes("."));
  } catch {
    return false;
  }
}

export function normalizeWebsite(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return undefined;
  }
}

export function canAddCompetitor(
  value: CompetitorEntry[],
  candidateName: string,
  max = COMPETITORS_MAX,
): { ok: true } | { ok: false; reason: "limit" | "duplicate" | "empty" } {
  const key = nameKey(candidateName);
  if (!key) return { ok: false, reason: "empty" };
  if (value.length >= max) return { ok: false, reason: "limit" };
  if (value.some((item) => nameKey(item.name) === key)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true };
}

export function entryWebsite(entry: CompetitorEntry): string | undefined {
  return normalizeWebsite(entry.website ?? entry.url);
}
