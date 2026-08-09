import type { IndustryId } from "./types.ts";
import { INDUSTRY_IDS } from "./aliases.ts";

export type IndustryOption = {
  value: IndustryId | "other";
  /** i18n key under brief.ind.* */
  labelKey: string;
};

const LABEL_KEYS: Record<IndustryId | "other", string> = {
  "advertising-marketing": "brief.ind.advertising.and.marketing",
  agriculture: "brief.ind.agriculture",
  architecture: "brief.ind.architecture",
  "artificial-intelligence": "brief.ind.artificial.intelligence",
  automotive: "brief.ind.automotive",
  aviation: "brief.ind.aviation",
  "beauty-wellness": "brief.ind.beauty.and.wellness",
  biotech: "brief.ind.biotech",
  "clean-energy": "brief.ind.clean.energy",
  "climate-tech": "brief.ind.climate.tech",
  construction: "brief.ind.construction",
  consulting: "brief.ind.consulting",
  "consumer-products": "brief.ind.consumer.products",
  "creative-services": "brief.ind.creative.services",
  "culture-arts": "brief.ind.culture.and.arts",
  cybersecurity: "brief.ind.cybersecurity",
  "e-commerce": "brief.ind.e.commerce",
  education: "brief.ind.education",
  entertainment: "brief.ind.entertainment",
  fashion: "brief.ind.fashion",
  finance: "brief.ind.finance",
  "fitness-sports": "brief.ind.fitness.and.sports",
  "food-beverage": "brief.ind.food.and.beverage",
  gaming: "brief.ind.gaming",
  government: "brief.ind.government",
  healthcare: "brief.ind.healthcare",
  "home-living": "brief.ind.home.and.living",
  hospitality: "brief.ind.hospitality",
  insurance: "brief.ind.insurance",
  "interior-design": "brief.ind.interior.design",
  "jewelry-luxury": "brief.ind.jewelry.and.luxury",
  legal: "brief.ind.legal",
  logistics: "brief.ind.logistics",
  manufacturing: "brief.ind.manufacturing",
  media: "brief.ind.media",
  music: "brief.ind.music",
  nonprofit: "brief.ind.nonprofit",
  pets: "brief.ind.pets",
  pharmaceuticals: "brief.ind.pharmaceuticals",
  "professional-services": "brief.ind.professional.services",
  "public-relations": "brief.ind.public.relations",
  publishing: "brief.ind.publishing",
  "real-estate": "brief.ind.real.estate",
  retail: "brief.ind.retail",
  software: "brief.ind.software",
  technology: "brief.ind.technology",
  telecommunications: "brief.ind.telecommunications",
  travel: "brief.ind.travel",
  "venture-capital": "brief.ind.venture.capital",
  other: "brief.ind.other",
};

/** Select options: 49 industries A–Z + Other = 50. */
export const INDUSTRY_SELECT_OPTIONS: IndustryOption[] = [
  ...INDUSTRY_IDS.map((id) => ({
    value: id as IndustryId | "other",
    labelKey: LABEL_KEYS[id],
  })),
  { value: "other", labelKey: LABEL_KEYS.other },
];

/**
 * Legacy English display labels kept for older session/API values.
 * Prefer IndustryId going forward. Alphabetical; Other last.
 */
export const INDUSTRY_OPTIONS = [
  "Advertising & Marketing",
  "Agriculture",
  "Architecture",
  "Artificial Intelligence",
  "Automotive",
  "Aviation",
  "Beauty & Wellness",
  "Biotech",
  "Clean Energy",
  "Climate Tech",
  "Construction",
  "Consulting",
  "Consumer Products",
  "Creative Services",
  "Culture & Arts",
  "Cybersecurity",
  "E-commerce",
  "Education",
  "Entertainment",
  "Fashion",
  "Finance",
  "Fitness & Sports",
  "Food & Beverage",
  "Gaming",
  "Government",
  "Healthcare",
  "Home & Living",
  "Hospitality",
  "Insurance",
  "Interior Design",
  "Jewelry & Luxury",
  "Legal",
  "Logistics",
  "Manufacturing",
  "Media",
  "Music",
  "Nonprofit",
  "Pets",
  "Pharmaceuticals",
  "Professional Services",
  "Public Relations",
  "Publishing",
  "Real Estate",
  "Retail",
  "Software",
  "Technology",
  "Telecommunications",
  "Travel",
  "Venture Capital",
  "Other",
] as const;

export type LegacyIndustryOption = (typeof INDUSTRY_OPTIONS)[number];
