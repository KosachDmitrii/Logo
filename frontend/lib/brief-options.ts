/** Canonical English values stored in brief state; display via i18n. */

import type {
  CompanyScale,
  CompetitorEntry,
  IndustryId,
  PriceSegment,
} from "./competitors/types.ts";
import { resolveIndustryId } from "./competitors/aliases.ts";
import {
  INDUSTRY_OPTIONS,
  INDUSTRY_SELECT_OPTIONS,
} from "./competitors/industry-options.ts";
import { nameKey } from "./competitors/normalize.ts";
import { normalizeWebsite } from "./competitors/validation.ts";

export type { CompetitorEntry, IndustryId, CompanyScale, PriceSegment };
export { INDUSTRY_OPTIONS, INDUSTRY_SELECT_OPTIONS };

export const BRIEF_LIMITS = {
  competitorsMax: 10,
} as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

const KNOWN_INDUSTRIES = new Set<string>([
  ...INDUSTRY_OPTIONS.filter((item) => item !== "Other"),
  ...INDUSTRY_SELECT_OPTIONS.map((item) => item.value).filter(
    (item) => item !== "other",
  ),
]);

export function optionKey(prefix: string, value: string): string {
  const industryId = resolveIndustryId(value);
  if (industryId && prefix === "brief.ind") {
    return INDUSTRY_SELECT_OPTIONS.find((item) => item.value === industryId)
      ?.labelKey ?? `${prefix}.${industryId}`;
  }
  return `${prefix}.${value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}`;
}

export function splitIndustry(value: string): {
  choice: string;
  other: string;
} {
  const trimmed = value.trim();
  if (!trimmed) return { choice: "", other: "" };
  if (trimmed === "Other" || trimmed === "other") {
    return { choice: "other", other: "" };
  }
  const industryId = resolveIndustryId(trimmed);
  if (industryId) return { choice: industryId, other: "" };
  if (KNOWN_INDUSTRIES.has(trimmed)) return { choice: trimmed, other: "" };
  return {
    choice: "other",
    other: trimmed,
  };
}

/** Coerce legacy session/API values (string | string[]) into a single string. */
export function asBriefText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

export function formatCompetitorEntries(entries: CompetitorEntry[]): string {
  return entries
    .map((entry) => {
      const site = entry.website ?? entry.url;
      const aspects = (entry.likedAspects ?? []).filter(Boolean);
      const details: string[] = [];
      if (site) details.push(site);
      if (aspects.length) details.push(`like: ${aspects.join(", ")}`);
      return details.length ? `${entry.name} (${details.join("; ")})` : entry.name;
    })
    .join(", ");
}

export function parseCompetitorEntries(value: unknown): CompetitorEntry[] {
  if (Array.isArray(value)) {
    const entries: CompetitorEntry[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) continue;
      const key = nameKey(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const website = normalizeWebsite(
        (typeof record.website === "string" && record.website) ||
          (typeof record.url === "string" && record.url) ||
          undefined,
      );
      const entry: CompetitorEntry = { name };
      if (website) {
        entry.website = website;
        entry.url = website;
      }
      if (typeof record.country === "string" && record.country.trim()) {
        entry.country = record.country.trim();
      }
      if (typeof record.reason === "string" && record.reason.trim()) {
        entry.reason = record.reason.trim();
      }
      if (Array.isArray(record.tags)) {
        entry.tags = record.tags.filter(
          (tag): tag is string => typeof tag === "string" && Boolean(tag.trim()),
        );
      }
      if (typeof record.score === "number") entry.score = record.score;
      if (
        record.source === "industry" ||
        record.source === "keyword" ||
        record.source === "manual"
      ) {
        entry.source = record.source;
      }
      if (typeof record.category === "string") {
        entry.category = record.category as CompetitorEntry["category"];
      }
      if (Array.isArray(record.likedAspects)) {
        entry.likedAspects =
          record.likedAspects as CompetitorEntry["likedAspects"];
      }
      if (typeof record.notes === "string" && record.notes.trim()) {
        entry.notes = record.notes.trim();
      }
      entries.push(entry);
      if (entries.length >= BRIEF_LIMITS.competitorsMax) break;
    }
    return entries;
  }
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, BRIEF_LIMITS.competitorsMax)
    .map((name) => ({ name }));
}
