export type IndustryId =
  | "architecture"
  | "interior-design"
  | "real-estate"
  | "construction"
  | "technology"
  | "artificial-intelligence"
  | "software"
  | "finance"
  | "healthcare"
  | "beauty-wellness"
  | "fashion"
  | "food-beverage"
  | "hospitality"
  | "travel"
  | "retail"
  | "e-commerce"
  | "education"
  | "media"
  | "entertainment"
  | "culture-arts"
  | "creative-services"
  | "professional-services"
  | "clean-energy"
  | "automotive"
  | "consumer-products"
  | "nonprofit";

export type CompanyScale = "independent" | "mid-size" | "global";
export type PriceSegment = "accessible" | "premium" | "luxury";

export type ReferenceCategory =
  | "visual-identity"
  | "typography"
  | "color"
  | "editorial"
  | "digital"
  | "motion"
  | "tone-of-voice";

export type LikedAspect =
  | "logo"
  | "typography"
  | "color"
  | "layout"
  | "motion"
  | "tone";

export type CompetitorEntry = {
  name: string;
  /** Canonical site URL. Legacy `url` is accepted on parse. */
  website?: string;
  /** @deprecated Prefer `website`. Kept for session/API compat. */
  url?: string;
  country?: string;
  reason?: string;
  tags?: string[];
  score?: number;
  source?: "industry" | "keyword" | "manual";
  category?: ReferenceCategory;
  likedAspects?: LikedAspect[];
  notes?: string;
};

export type ReferencePreference = {
  name: string;
  likedAspects?: LikedAspect[];
  notes?: string;
};

export type KeywordRule = {
  match: RegExp;
  exclude?: RegExp;
  weight?: number;
  direct?: string[];
  references?: string[];
  tags?: string[];
  bucket?: DiversityBucket;
};

export type DiversityBucket =
  | "close"
  | "scale"
  | "regional"
  | "adjacent"
  | "visual-identity"
  | "typography"
  | "digital"
  | "motion"
  | "tone-of-voice";

/** Plain string is treated as English; use `{ en, ru }` for bilingual copy. */
export type LocalizedText = string | { en: string; ru?: string };

export type CompanyRecord = {
  name: string;
  website?: string;
  country?: string;
  tags?: string[];
  category?: ReferenceCategory;
  bucket?: DiversityBucket;
  reason?: LocalizedText;
};

export type SuggestionPool = {
  direct: CompanyRecord[];
  references: CompanyRecord[];
  keywords?: KeywordRule[];
};

export type SuggestCompetitorsInput = {
  industry: IndustryId | string;
  companyDescription?: string;
  positioning?: string;
  audience?: string[] | string;
  market?: string;
  companyScale?: CompanyScale;
  priceSegment?: PriceSegment;
  /** UI locale — reasons follow this language (default `en`). */
  locale?: string;
  selectedDirect?: CompetitorEntry[];
  selectedReferences?: CompetitorEntry[];
  rejectedDirect?: string[];
  rejectedReferences?: string[];
  directLimit?: number;
  referenceLimit?: number;
};

export type SuggestCompetitorsResult = {
  direct: CompetitorEntry[];
  references: CompetitorEntry[];
  needsManualInput?: boolean;
};

export const COMPETITOR_SECTION_LABELS = {
  direct: {
    title: "Прямые конкуренты",
    description:
      "Компании с похожим предложением, аудиторией и рыночным позиционированием.",
  },
  references: {
    title: "Бренд-референсы",
    description:
      "Бренды, чьи визуальные и коммуникационные решения могут задать направление.",
  },
} as const;

export const SCORE_WEIGHTS = {
  industry: 30,
  specialization: 20,
  positioning: 15,
  audience: 10,
  market: 10,
  companyScale: 10,
  priceSegment: 5,
} as const;

export const CONCEPT_SCORE_WEIGHTS = {
  briefRelevance: 25,
  distinctiveness: 20,
  simplicity: 15,
  smallSizeLegibility: 15,
  industryDifferentiation: 15,
  versatility: 10,
} as const;
