import type { CompetitorEntry, KeywordRule } from "./types.ts";
import { SCORE_WEIGHTS as WEIGHTS } from "./types.ts";
import { matchesRule, nameKey } from "./normalize.ts";

export type ScoredName = {
  name: string;
  score: number;
  source: NonNullable<CompetitorEntry["source"]>;
  tags: string[];
  reason?: string;
  order: number;
  bucket?: string;
};

export function applyKeywordScores(
  context: string,
  rules: KeywordRule[] | undefined,
  section: "direct" | "references",
  scores: Map<string, ScoredName>,
  orderStart: number,
): number {
  let order = orderStart;
  for (const rule of rules ?? []) {
    if (!matchesRule(rule.match, context)) continue;
    if (rule.exclude && matchesRule(rule.exclude, context)) continue;
    const weight = rule.weight ?? WEIGHTS.specialization;
    const names = section === "direct" ? rule.direct : rule.references;
    for (const name of names ?? []) {
      const key = nameKey(name);
      if (!key) continue;
      const existing = scores.get(key);
      if (existing) {
        existing.score += weight;
        if (rule.tags?.length) {
          existing.tags = uniqueTags([...existing.tags, ...rule.tags]);
        }
        if (!existing.bucket && rule.bucket) existing.bucket = rule.bucket;
      } else {
        scores.set(key, {
          name,
          score: WEIGHTS.industry + weight,
          source: "keyword",
          tags: uniqueTags(rule.tags ?? []),
          order: order++,
          bucket: rule.bucket,
        });
      }
    }
  }
  return order;
}

export function seedIndustryScores(
  names: Array<{ name: string; tags?: string[]; bucket?: string }>,
  scores: Map<string, ScoredName>,
  orderStart: number,
  baseScore: number = WEIGHTS.industry,
): number {
  let order = orderStart;
  for (const item of names) {
    const key = nameKey(item.name);
    if (!key || scores.has(key)) continue;
    scores.set(key, {
      name: item.name,
      score: baseScore,
      source: "industry",
      tags: uniqueTags(item.tags ?? []),
      order: order++,
      bucket: item.bucket,
    });
  }
  return order;
}

export function rankedNames(
  scores: Map<string, ScoredName>,
  exclude: Set<string>,
): ScoredName[] {
  return [...scores.values()]
    .filter((item) => !exclude.has(nameKey(item.name)))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order;
    });
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag.trim());
  }
  return out;
}
