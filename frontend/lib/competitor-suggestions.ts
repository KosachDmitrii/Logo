/** @deprecated Import from `./competitors` instead. */
export {
  COMPETITOR_SECTION_LABELS,
  CONCEPT_SCORE_WEIGHTS,
  INDUSTRY_OPTIONS,
  INDUSTRY_SELECT_OPTIONS,
  SCORE_WEIGHTS,
  canAddCompetitor,
  entryWebsite,
  isIndustryId,
  isValidHttpUrl,
  matchesRule,
  nameKey,
  normalizeText,
  normalizeWebsite,
  resolveIndustryId,
  suggestCompetitors,
} from "./competitors/index.ts";
export type {
  CompanyScale,
  CompetitorEntry,
  IndustryId,
  LikedAspect,
  PriceSegment,
  ReferenceCategory,
  SuggestCompetitorsInput,
  SuggestCompetitorsResult,
} from "./competitors/index.ts";
