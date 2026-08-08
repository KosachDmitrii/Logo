import type { IndustryId } from "./types.ts";
import { INDUSTRY_IDS } from "./aliases.ts";

export type IndustryOption = {
  value: IndustryId | "other";
  /** i18n key under brief.ind.* */
  labelKey: string;
};

const LABEL_KEYS: Record<IndustryId | "other", string> = {
  architecture: "brief.ind.architecture",
  "interior-design": "brief.ind.interior.design",
  "real-estate": "brief.ind.real.estate",
  construction: "brief.ind.construction",
  technology: "brief.ind.technology",
  "artificial-intelligence": "brief.ind.artificial.intelligence",
  software: "brief.ind.software",
  finance: "brief.ind.finance",
  healthcare: "brief.ind.healthcare",
  "beauty-wellness": "brief.ind.beauty.and.wellness",
  fashion: "brief.ind.fashion",
  "food-beverage": "brief.ind.food.and.beverage",
  hospitality: "brief.ind.hospitality",
  travel: "brief.ind.travel",
  retail: "brief.ind.retail",
  "e-commerce": "brief.ind.e.commerce",
  education: "brief.ind.education",
  media: "brief.ind.media",
  entertainment: "brief.ind.entertainment",
  "culture-arts": "brief.ind.culture.and.arts",
  "creative-services": "brief.ind.creative.services",
  "professional-services": "brief.ind.professional.services",
  "clean-energy": "brief.ind.clean.energy",
  automotive: "brief.ind.automotive",
  "consumer-products": "brief.ind.consumer.products",
  nonprofit: "brief.ind.nonprofit",
  other: "brief.ind.other",
};

/** Select options: IndustryId values + Other. */
export const INDUSTRY_SELECT_OPTIONS: IndustryOption[] = [
  ...INDUSTRY_IDS.map((id) => ({
    value: id as IndustryId | "other",
    labelKey: LABEL_KEYS[id],
  })),
  { value: "other", labelKey: LABEL_KEYS.other },
];

/**
 * Legacy English display labels kept for older session/API values.
 * Prefer IndustryId going forward.
 */
export const INDUSTRY_OPTIONS = [
  "Architecture",
  "Interior Design",
  "Real Estate",
  "Construction",
  "Technology",
  "Artificial Intelligence",
  "Software",
  "Finance",
  "Healthcare",
  "Beauty & Wellness",
  "Fashion",
  "Food & Beverage",
  "Hospitality",
  "Travel",
  "Retail",
  "E-commerce",
  "Education",
  "Media",
  "Entertainment",
  "Culture & Arts",
  "Creative Services",
  "Professional Services",
  "Clean Energy",
  "Automotive",
  "Consumer Products",
  "Nonprofit",
  "Other",
] as const;

export type LegacyIndustryOption = (typeof INDUSTRY_OPTIONS)[number];
