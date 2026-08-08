import type {
  CompanyScale,
  CompetitorEntry,
  PriceSegment,
} from "./brief-options.ts";

export type { CompetitorEntry, CompanyScale, PriceSegment };

export type GeneratedConcept = {
  directionKey: string;
  directionTitle: string;
  downloadUrl: string;
  id: string;
  imageUrl: string;
  qualityScore?: number;
  rationale?: string;
  reviewReason?: string;
  reviewStatus?: string;
};

export type BrandStrategy = {
  categoryCodes: string[];
  competitorRisks: string[];
  differentiation: string;
  typography: string;
  palette: string[];
  trademarkNotice: string;
};

export type PremiumBrief = {
  audience?: string;
  avoid?: string;
  companyDescription?: string;
  /** Flattened direct competitors for prompts / legacy clients. */
  competitors?: string;
  directCompetitors?: CompetitorEntry[];
  brandReferences?: CompetitorEntry[];
  colorApproach?: "propose" | "existing" | "mood";
  brandColors?: string;
  colorMood?: string;
  coreIdea?: string;
  /** Stable IndustryId when known; free text for "other". */
  industry?: string;
  market?: string;
  companyScale?: CompanyScale;
  priceSegment?: PriceSegment;
  logoType?: "abstract" | "monogram" | "wordmark" | "emblem" | "combination";
  personalities?: string[];
  positioning?: string;
  strategy?: BrandStrategy;
  usage?: string;
  visualDirection?: string;
};

export type StudioAsset = {
  contentType: string;
  downloadUrl: string;
  id: string;
  label: string;
  model: string;
  parentId: string;
  provider: string;
  qualityScore?: number;
  reviewReason?: string;
  reviewStatus?: string;
  stage: "refine" | "vector";
  url: string;
};

export type StudioSessionSnapshot = {
  v: 1;
  savedAt: number;
  projectId: string | null;
  activeTemplateId: string;
  brandName: string;
  coreIdea: string;
  industry: string;
  companyDescription: string;
  audience: string;
  positioning: string;
  market: string;
  companyScale: CompanyScale | "";
  priceSegment: PriceSegment | "";
  competitors: string;
  directCompetitors: CompetitorEntry[];
  brandReferences: CompetitorEntry[];
  rejectedDirect: string[];
  rejectedReferences: string[];
  colorApproach: NonNullable<PremiumBrief["colorApproach"]>;
  brandColors: string;
  colorMood: string;
  visualDirection: string;
  usage: string;
  avoid: string;
  personalities: string[];
  strategy: BrandStrategy | null;
  selectedConcept: string;
  selectedConceptIds: string[];
  generatedConcepts: GeneratedConcept[];
  assets: StudioAsset[];
  selectedRefinement: string;
  selectedVector: string;
  /** When true, stages 04–05 stay cleared (e.g. Reduce in progress). */
  productionLocked: boolean;
  vectorSourceMode: "refine" | "original";
  lockupLayout: "horizontal" | "vertical" | "icon";
  lockupColor: string;
  wordmarkName: string;
  descriptor: string;
  wordmarkStyle: string;
  wordmarkCase: "original" | "upper" | "lower";
  wordmarkWeight: number;
  wordmarkTracking: number;
  wordmarkSize: number;
  descriptorSize: number;
  markScale: number;
};

/** Session fields without snapshot metadata (v, savedAt). */
export type StudioDraft = Omit<StudioSessionSnapshot, "v" | "savedAt">;
