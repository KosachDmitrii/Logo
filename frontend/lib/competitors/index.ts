export type {
  CompanyScale,
  CompetitorEntry,
  DiversityBucket,
  IndustryId,
  LikedAspect,
  PriceSegment,
  ReferenceCategory,
  ReferencePreference,
  SuggestCompetitorsInput,
  SuggestCompetitorsResult,
} from "./types.ts";
export {
  COMPETITOR_SECTION_LABELS,
  CONCEPT_SCORE_WEIGHTS,
  SCORE_WEIGHTS,
} from "./types.ts";
export { resolveIndustryId, isIndustryId, INDUSTRY_IDS } from "./aliases.ts";
export {
  INDUSTRY_OPTIONS,
  INDUSTRY_SELECT_OPTIONS,
  type IndustryOption,
  type LegacyIndustryOption,
} from "./industry-options.ts";
export {
  audienceToText,
  matchesRule,
  nameKey,
  normalizeText,
} from "./normalize.ts";
export {
  canAddCompetitor,
  entryWebsite,
  isValidHttpUrl,
  normalizeWebsite,
} from "./validation.ts";
export { suggestCompetitors } from "./suggest-competitors.ts";
