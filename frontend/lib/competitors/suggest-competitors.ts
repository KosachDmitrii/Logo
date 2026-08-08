import { resolveIndustryId } from "./aliases.ts";
import {
  COMPANY_CATALOG,
  DEFAULT_REFERENCES,
  INDUSTRY_SUGGESTIONS,
} from "./industries.ts";
import { audienceToText, nameKey, normalizeText } from "./normalize.ts";
import {
  applyKeywordScores,
  rankedNames,
  seedIndustryScores,
  type ScoredName,
} from "./scoring.ts";
import type {
  CompanyRecord,
  CompetitorEntry,
  DiversityBucket,
  LocalizedText,
  SuggestCompetitorsInput,
  SuggestCompetitorsResult,
} from "./types.ts";
import { SCORE_WEIGHTS } from "./types.ts";

function isRussianLocale(locale?: string): boolean {
  return (locale ?? "en").toLowerCase().startsWith("ru");
}

function resolveLocalized(
  value: LocalizedText | undefined,
  locale?: string,
): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (isRussianLocale(locale) && value.ru) return value.ru;
  return value.en;
}

const DIRECT_BUCKET_QUOTA: Array<{ bucket: DiversityBucket; count: number }> = [
  { bucket: "close", count: 4 },
  { bucket: "scale", count: 2 },
  { bucket: "regional", count: 2 },
  { bucket: "adjacent", count: 2 },
];

const REFERENCE_BUCKET_QUOTA: Array<{
  bucket: DiversityBucket;
  count: number;
}> = [
  { bucket: "visual-identity", count: 2 },
  { bucket: "typography", count: 2 },
  { bucket: "digital", count: 2 },
  { bucket: "motion", count: 1 },
  { bucket: "tone-of-voice", count: 1 },
];

function catalogLookup(name: string) {
  return COMPANY_CATALOG[nameKey(name)];
}

function recordMap(records: CompanyRecord[]): Map<string, CompanyRecord> {
  const map = new Map<string, CompanyRecord>();
  for (const record of records) {
    map.set(nameKey(record.name), record);
  }
  return map;
}

function buildReason(
  scored: ScoredName,
  section: "direct" | "references",
  record: CompanyRecord | undefined,
  locale?: string,
): string {
  const fromRecord = resolveLocalized(record?.reason, locale);
  if (fromRecord) return fromRecord;
  if (scored.reason) return scored.reason;
  const tags = scored.tags.slice(0, 3).join(", ");
  const ru = isRussianLocale(locale);
  if (scored.source === "keyword" && scored.tags.length) {
    if (section === "direct") {
      return ru
        ? `Совпадение по специализации: ${tags}`
        : `Specialization match: ${tags}`;
    }
    return ru
      ? `Визуальный ориентир: ${tags}`
      : `Visual reference: ${tags}`;
  }
  if (section === "direct") {
    return ru
      ? "Близкий игрок в той же индустрии и сегменте"
      : "Close peer in the same industry and segment";
  }
  return ru
    ? "Сильный ориентир по айдентике и коммуникации"
    : "Strong identity and communication reference";
}

function toEntry(
  scored: ScoredName,
  section: "direct" | "references",
  records: Map<string, CompanyRecord>,
  locale?: string,
): CompetitorEntry {
  const key = nameKey(scored.name);
  const record = records.get(key);
  const catalog = catalogLookup(scored.name);
  const tags = uniqueStrings([
    ...(scored.tags ?? []),
    ...(record?.tags ?? []),
    ...(catalog?.tags ?? []),
  ]).slice(0, 3);
  const website = record?.website ?? catalog?.website;
  const country = record?.country ?? catalog?.country;
  return {
    name: record?.name ?? scored.name,
    website,
    url: website,
    country,
    reason: buildReason(scored, section, record, locale),
    tags,
    score: scored.score,
    source: scored.source,
    category: record?.category,
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function exclusionSet(names: Array<string | undefined | null>): Set<string> {
  const set = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    const key = nameKey(name);
    if (key) set.add(key);
  }
  return set;
}

function applyScalePriceBonus(
  scores: Map<string, ScoredName>,
  input: SuggestCompetitorsInput,
  records: Map<string, CompanyRecord>,
) {
  if (input.companyScale === "global") {
    for (const entry of scores.values()) {
      if (entry.tags.includes("global") || entry.bucket === "scale") {
        entry.score += SCORE_WEIGHTS.companyScale;
      }
    }
  } else if (input.companyScale === "independent") {
    for (const entry of scores.values()) {
      if (
        entry.tags.includes("independent") ||
        entry.bucket === "regional" ||
        entry.tags.includes("specialty")
      ) {
        entry.score += SCORE_WEIGHTS.companyScale;
      }
    }
  } else if (input.companyScale === "mid-size") {
    for (const entry of scores.values()) {
      if (entry.bucket === "close" || entry.tags.includes("premium")) {
        entry.score += Math.round(SCORE_WEIGHTS.companyScale / 2);
      }
    }
  }

  if (input.priceSegment === "luxury" || input.priceSegment === "premium") {
    for (const entry of scores.values()) {
      if (
        entry.tags.includes("premium") ||
        entry.tags.includes("luxury") ||
        entry.tags.includes("specialty")
      ) {
        entry.score += SCORE_WEIGHTS.priceSegment;
      }
    }
  } else if (input.priceSegment === "accessible") {
    for (const entry of scores.values()) {
      if (entry.tags.includes("accessible") || entry.tags.includes("dtc")) {
        entry.score += SCORE_WEIGHTS.priceSegment;
      }
    }
  }

  if (input.market) {
    const market = normalizeText(input.market);
    for (const entry of scores.values()) {
      const country = normalizeText(
        recordCountryHint(entry.name, records) ?? "",
      );
      if (country && (market.includes(country) || country.includes(market))) {
        entry.score += SCORE_WEIGHTS.market;
        if (!entry.bucket) entry.bucket = "regional";
      }
    }
  }
}

function recordCountryHint(
  name: string,
  records: Map<string, CompanyRecord>,
): string | undefined {
  return (
    records.get(nameKey(name))?.country ??
    COMPANY_CATALOG[nameKey(name)]?.country
  );
}

function diversify(
  ranked: ScoredName[],
  quotas: Array<{ bucket: DiversityBucket; count: number }>,
  limit: number,
): ScoredName[] {
  const picked: ScoredName[] = [];
  const used = new Set<string>();

  for (const { bucket, count } of quotas) {
    let taken = 0;
    for (const item of ranked) {
      if (taken >= count || picked.length >= limit) break;
      const key = nameKey(item.name);
      if (used.has(key)) continue;
      if ((item.bucket as DiversityBucket | undefined) !== bucket) continue;
      picked.push(item);
      used.add(key);
      taken++;
    }
  }

  for (const item of ranked) {
    if (picked.length >= limit) break;
    const key = nameKey(item.name);
    if (used.has(key)) continue;
    picked.push(item);
    used.add(key);
  }

  return picked;
}

export function suggestCompetitors(
  input: SuggestCompetitorsInput,
): SuggestCompetitorsResult {
  const industryId = resolveIndustryId(input.industry);
  const audienceText = audienceToText(input.audience);
  const context = normalizeText(
    [
      industryId ?? input.industry,
      input.companyDescription,
      input.positioning,
      audienceText,
      input.market,
      input.companyScale,
      input.priceSegment,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const directLimit = input.directLimit ?? 10;
  const referenceLimit = input.referenceLimit ?? 8;

  const selectedDirectKeys = exclusionSet([
    ...(input.selectedDirect ?? []).map((item) => item.name),
    ...(input.rejectedDirect ?? []),
  ]);
  const selectedReferenceKeys = exclusionSet([
    ...(input.selectedReferences ?? []).map((item) => item.name),
    ...(input.rejectedReferences ?? []),
  ]);

  const locale = input.locale ?? "en";

  if (!industryId) {
    const defaultRecords = recordMap(DEFAULT_REFERENCES);
    const refs = DEFAULT_REFERENCES.slice(0, Math.min(6, referenceLimit)).map(
      (record, index) =>
        toEntry(
          {
            name: record.name,
            score: SCORE_WEIGHTS.industry,
            source: "industry",
            tags: record.tags ?? [],
            order: index,
            bucket: record.bucket,
          },
          "references",
          defaultRecords,
          locale,
        ),
    );
    return {
      direct: [],
      references: refs.filter(
        (item) => !selectedReferenceKeys.has(nameKey(item.name)),
      ),
      needsManualInput: true,
    };
  }

  const pool = INDUSTRY_SUGGESTIONS[industryId];
  const directRecords = recordMap(pool.direct);
  const referenceRecords = recordMap([
    ...pool.references,
    ...DEFAULT_REFERENCES,
  ]);

  const directScores = new Map<string, ScoredName>();
  const referenceScores = new Map<string, ScoredName>();

  seedIndustryScores(pool.direct, directScores, 0);
  seedIndustryScores(pool.references, referenceScores, 0);

  applyKeywordScores(
    context,
    pool.keywords,
    "direct",
    directScores,
    directScores.size,
  );
  applyKeywordScores(
    context,
    pool.keywords,
    "references",
    referenceScores,
    referenceScores.size,
  );

  if (/(b2b|enterprise|корпорат)/i.test(context)) {
    for (const entry of directScores.values()) {
      if (entry.tags.includes("b2b") || entry.tags.includes("enterprise")) {
        entry.score += SCORE_WEIGHTS.audience;
      }
    }
  }
  if (/(b2c|consumer|потребител|dtc)/i.test(context)) {
    for (const entry of directScores.values()) {
      if (
        entry.tags.includes("consumer") ||
        entry.tags.includes("dtc") ||
        entry.tags.includes("retail")
      ) {
        entry.score += SCORE_WEIGHTS.audience;
      }
    }
  }
  if (/(premium|luxury|преми|люкс)/i.test(context)) {
    for (const entry of directScores.values()) {
      if (entry.tags.includes("premium") || entry.tags.includes("luxury")) {
        entry.score += SCORE_WEIGHTS.positioning;
      }
    }
  }

  applyScalePriceBonus(directScores, input, directRecords);
  applyScalePriceBonus(referenceScores, input, referenceRecords);

  const rankedDirect = rankedNames(directScores, selectedDirectKeys);
  let directPicked = diversify(rankedDirect, DIRECT_BUCKET_QUOTA, directLimit);

  const directKeys = exclusionSet([
    ...directPicked.map((item) => item.name),
    ...selectedDirectKeys,
  ]);

  const rankedReferences = rankedNames(
    referenceScores,
    new Set([...selectedReferenceKeys, ...directKeys]),
  );
  let referencePicked = diversify(
    rankedReferences,
    REFERENCE_BUCKET_QUOTA,
    referenceLimit,
  );

  // Ensure no cross-section overlap after diversification
  referencePicked = referencePicked.filter(
    (item) => !directKeys.has(nameKey(item.name)),
  );

  return {
    direct: directPicked.map((item) =>
      toEntry(item, "direct", directRecords, locale),
    ),
    references: referencePicked.map((item) =>
      toEntry(item, "references", referenceRecords, locale),
    ),
    needsManualInput: directPicked.length === 0,
  };
}
