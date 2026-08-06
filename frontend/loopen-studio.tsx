"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  apiFetch,
  apiUrl,
  readApiJson,
  resolveMediaUrl,
  sameOriginApiUrl,
} from "./lib/api";
import {
  type AuthFieldErrors,
  type AuthFieldKey,
  type AuthFormValues,
  hasAuthErrors,
  validateAuthField,
  validateAuthForm,
} from "./lib/auth-validation";
import {
  applyDocumentLocale,
  detectBrowserLocale,
  normalizeAppLocale,
  studioPlaceStamp,
  t,
  type AppLocale,
} from "./lib/i18n";
import { buildLockupSvg } from "./lib/lockup-export";
import { prepareLockupMarkSvg, trimSvgViewBox } from "./lib/lockup-svg";
import {
  clearStudioSession,
  createEmptyStudioDraft,
  draftFromSnapshot,
  getClientStudioSnapshot,
  STUDIO_SESSION_KEY,
  subscribeStudioSession,
  suspendStudioSessionPersist,
  writeStudioSession,
} from "./lib/studio-session";
import type {
  BrandStrategy,
  GeneratedConcept,
  PremiumBrief,
  StudioAsset,
  StudioDraft,
  StudioSessionSnapshot,
} from "./lib/studio-types";

export type StudioRole = "guest" | "user" | "admin";

export type BriefLocale = AppLocale;

export type StudioEmailPrefs = {
  productUpdates: boolean;
  signalReceipts: boolean;
  teamLaunch: boolean;
  briefLocale: BriefLocale;
};

type StudioEmailPrefsPayload = Omit<StudioEmailPrefs, "briefLocale"> & {
  briefLocale?: BriefLocale | null;
};

const BRIEF_LOCALE_OPTIONS: { value: BriefLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "he", label: "עברית" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
];

const LOCALE_STORAGE_KEY = "loopen.briefLocale";

function readStoredLocale(): BriefLocale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored) return normalizeAppLocale(stored);
  } catch {
    // ignore storage failures
  }
  return detectBrowserLocale();
}

function persistLocale(locale: BriefLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // ignore storage failures
  }
}

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "hello@loopen.dev";

export type StudioUser = {
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  prefs?: StudioEmailPrefsPayload;
  signalBalance?: number | null;
  /** local = ALLOW_LOCAL_STUDIO=1 — not a real account */
  source?: "supabase" | "local";
  role?: StudioRole;
};

type BillingHistoryEntry = {
  id: string;
  delta: number;
  reason: string;
  ref: string | null;
  createdAt: number;
  label: string;
};

type SignalPack = {
  id: string;
  label: string;
  signals: number;
  priceUsd: number;
  blurb: string;
};

type SignalCosts = {
  generateBatch: number;
  extraConcept: number;
  refine: number;
  vectorize: number;
};

type SavedProject = {
  brandName: string;
  createdAt: number;
  id: string;
  selectedGenerationId?: string;
  status: string;
  updatedAt: number;
};

type Concept = {
  id: string;
  index: string;
  name: string;
  thesis: string;
  className: string;
  accent: string;
};

type ConfirmDialog = {
  body: string;
  confirmLabel: string;
  dismissOnly?: boolean;
  kicker: string;
  title: string;
  tone?: "default" | "danger";
};

const concepts: Concept[] = [
  {
    id: "continuous",
    index: "01",
    name: "Continuous Space",
    thesis: "Constraint becomes flow — one decisive move activates the space.",
    className: "mark-loop",
    accent: "acid",
  },
  {
    id: "portal",
    index: "02",
    name: "Open Counterform",
    thesis: "A precise opening turns solid mass into invitation.",
    className: "mark-portal",
    accent: "cobalt",
  },
  {
    id: "signal",
    index: "03",
    name: "Modular Rhythm",
    thesis: "Unequal parts compose a site-specific rhythm through spacing.",
    className: "mark-signal",
    accent: "coral",
  },
  {
    id: "fold",
    index: "04",
    name: "Constructive Tension",
    thesis: "Rigor meets play at one controlled collision.",
    className: "mark-fold",
    accent: "lavender",
  },
];

const personalityOptions = [
  "Architectural",
  "Intelligent",
  "Playful",
  "Precise",
  "Warm",
  "Experimental",
  "Bold",
  "Calm",
  "Technical",
  "Editorial",
];

type BriefTemplate = {
  id: string;
  label: string;
  industryLabel: string;
  brandName: string;
  coreIdea: string;
  industry: string;
  companyDescription: string;
  audience: string;
  positioning: string;
  competitors: string;
  colorApproach: NonNullable<PremiumBrief["colorApproach"]>;
  brandColors: string;
  colorMood: string;
  visualDirection: string;
  usage: string;
  avoid: string;
  personalities: string[];
  descriptor: string;
};

const BRIEF_TEMPLATES: BriefTemplate[] = [
  {
    id: "ketchup",
    label: "Ketchup",
    industryLabel: "Architecture",
    brandName: "Ketchup",
    coreIdea:
      "Ketchup is an architecture and spatial-design studio that turns constraints into distinctive, generous places. The identity should communicate intelligent transformation, confident authorship and an unexpected human quality. Create a memorable symbol that feels specific to Ketchup rather than to architecture in general.",
    industry: "Contemporary architecture, interiors and spatial design",
    companyDescription:
      "Ketchup is an independent architecture and spatial-design studio working across residential, hospitality, retail and cultural projects. The studio treats budgets, sites, regulations and existing structures as creative material. Its work combines rigorous planning, clear construction and generous public or shared space with one surprising intervention that makes each project recognisable, useful and emotionally engaging.",
    audience:
      "Design-literate private clients, progressive developers, hospitality and retail brands, cultural institutions and entrepreneurs. They value original thinking and strong authorship, but also expect buildability, commercial intelligence, clarity, reliability and lasting cultural relevance.",
    positioning:
      "A sharp, independent architecture practice positioned between corporate predictability and self-indulgent experimentation. Ketchup is conceptually bold but practical, playful without becoming childish, and precise without feeling sterile. The identity should feel confident in an architecture biennale, on construction drawings and on a building façade.",
    competitors:
      "Reference landscape: OMA, MVRDV, Snøhetta, Assemble, Space10, Schemata Architects, Studio Muoto and contemporary independent architecture practices. Do not imitate their identities, projects or signature buildings; use them only as a benchmark for conceptual clarity, cultural confidence and professional execution.",
    colorApproach: "propose",
    brandColors: "",
    colorMood:
      "Warm architectural neutrals with one cultured, energetic accent; contemporary, tactile and confident rather than corporate or fashionable.",
    visualDirection:
      "Create a bold, flat black symbol with the cultural confidence of an independent contemporary architecture studio. It may abstractly suggest a shelter, passage, structure, spatial frame or constructed landscape, but it should remain a concise identity mark rather than an illustration. Prioritise an original silhouette, strong gestalt, controlled asymmetry and one memorable visual idea. The symbol must work independently at 16–24 px; the application will pair it with a restrained Ketchup wordmark.",
    usage:
      "Primary: website header, social avatar, proposals, architectural drawings, title blocks, competition boards and client presentations. Secondary: construction signage, hoarding, building graphics, wayfinding, publications, stamps, merchandise and favicon. Required variants: symbol only, horizontal and vertical lockups, positive and reversed monochrome. The mark must remain recognisable at 16 and 24 pixels and retain authority at environmental scale.",
    avoid:
      "Avoid generic house and roof icons, property-development branding, food or ketchup imagery, obvious stock-logo geometry and close resemblance to an existing identity. No 3D rendering, perspective, mockup, gradients, shadows, textures, fine illustrative detail, text, letters or pseudo-text inside the generated symbol.",
    personalities: [
      "Architectural",
      "Intelligent",
      "Playful",
      "Precise",
      "Experimental",
    ],
    descriptor: "Architecture with an unexpected opening",
  },
  {
    id: "northline",
    label: "Northline",
    industryLabel: "Specialty coffee",
    brandName: "Northline",
    coreIdea:
      "Northline is a specialty coffee roastery and café brand built around clarity, craft and a quiet sense of northern light. The identity should feel precise and hospitable — a mark that suggests route, roast and ritual without becoming a coffee-cup cliché.",
    industry: "Specialty coffee roasting, cafés and hospitality",
    companyDescription:
      "Northline roasts single-origin and blend coffees for cafés, offices and home brewing. The brand runs a flagship café, supplies wholesale partners and publishes tasting notes with the same care as its roasting logs. Northline values transparency of origin, consistent extraction and a calm, design-led guest experience.",
    audience:
      "Urban coffee drinkers, independent café owners, design-conscious offices and home baristas who care about origin, freshness and a refined everyday ritual rather than loud lifestyle marketing.",
    positioning:
      "A modern roasting brand between industrial commodity coffee and precious third-wave theatre. Northline is warm but exact, hospitable without being cute, and serious about taste without sounding academic.",
    competitors:
      "Reference landscape: Blue Bottle, Tim Wendelboe, April Coffee, La Cabra, Square Mile and strong independent local roasters. Do not imitate their marks; use them only as a benchmark for craft credibility and café-ready systems.",
    colorApproach: "propose",
    brandColors: "",
    colorMood:
      "Soft paper neutrals with deep roast brown and one cool northern accent; calm, tactile and morning-ready.",
    visualDirection:
      "Create a bold, flat black symbol for a specialty coffee brand. Suggest route, horizon, roast craft or a precise hospitality gesture without drawing a cup, bean, steam cloud or barista tool. Prioritise a compact silhouette, strong gestalt and one memorable idea that works as a stamp, sleeve mark and favicon.",
    usage:
      "Primary: café fascia, cups, bags, website header, social avatar and wholesale packaging. Secondary: menus, loyalty stamps, merch, delivery stickers and favicon. Required variants: symbol only, horizontal lockup, positive and reversed monochrome.",
    avoid:
      "Avoid coffee cups, beans, steam swirls, mountains-as-cliché, leaf badges and generic café script. No 3D rendering, perspective, mockup, gradients, shadows, textures, fine illustrative detail, text, letters or pseudo-text inside the generated symbol.",
    personalities: ["Warm", "Precise", "Calm", "Bold", "Editorial"],
    descriptor: "Coffee with a clear route",
  },
  {
    id: "voltara",
    label: "Voltara",
    industryLabel: "Clean energy",
    brandName: "Voltara",
    coreIdea:
      "Voltara is a clean-energy and home-electrification company helping households and small businesses switch to smarter power. The identity should communicate reliable modern infrastructure with a human, optimistic charge — not a generic lightning bolt utility brand.",
    industry: "Clean energy, home electrification and energy services",
    companyDescription:
      "Voltara designs and installs solar, battery storage and electrification upgrades for homes and light commercial sites. The company combines engineering clarity with a consumer-friendly service model: site assessment, financing options, installation and ongoing monitoring. Voltara wants to feel like the trusted operator of a cleaner everyday grid.",
    audience:
      "Homeowners, property managers and small-business operators who want lower energy costs, resilience and a credible green transition without dealing with opaque contractors.",
    positioning:
      "A practical clean-energy brand between corporate utilities and lifestyle eco startups. Voltara is technical but approachable, optimistic without greenwashing, and precise enough for engineering docs while remaining friendly on a van or app icon.",
    competitors:
      "Reference landscape: Tesla Energy, Sunrun, Octopus Energy, Enphase and strong regional installers. Do not imitate their identities; use them only as a benchmark for trust, modernity and service clarity.",
    colorApproach: "propose",
    brandColors: "",
    colorMood:
      "Cool daylight neutrals with one charged electric accent; clean, trustworthy and future-facing without neon sci-fi.",
    visualDirection:
      "Create a bold, flat black symbol for a clean-energy company. Suggest flow, storage, connection or a controlled release of power without a literal lightning bolt, sun disk, leaf or plug. Prioritise an original compact silhouette and one memorable idea that works on vans, app icons and technical reports.",
    usage:
      "Primary: website, app icon, vans, installer uniforms, proposals and monitoring dashboards. Secondary: yard signs, packaging for hardware kits, presentations and favicon. Required variants: symbol only, horizontal and vertical lockups, positive and reversed monochrome.",
    avoid:
      "Avoid lightning bolts, suns, leaves, plugs, batteries-as-icons and generic tech hexagons. No 3D rendering, perspective, mockup, gradients, shadows, textures, fine illustrative detail, text, letters or pseudo-text inside the generated symbol.",
    personalities: ["Technical", "Intelligent", "Bold", "Precise", "Calm"],
    descriptor: "Power made practical",
  },
  {
    id: "muchachos",
    label: "Muchachos",
    industryLabel: "Barber shop",
    brandName: "Muchachos",
    coreIdea:
      "Muchachos is a contemporary barber shop built on sharp craft, masculine hospitality and neighbourhood ritual. The identity should feel confident and brotherly without becoming a cliché scissors brand — a mark that owns the chair, the line-up and the after-hours atmosphere.",
    industry: "Barber shops, men's grooming and neighbourhood hospitality",
    companyDescription:
      "Muchachos is an independent barber shop offering classic and modern cuts, fades, beard work and grooming rituals in a social, well-run space. The shop mixes precise technique with warm service: walk-ins and bookings, good music, clean stations and a culture where regulars feel known. Muchachos wants to feel like the best chair on the block — sharp, welcoming and culturally specific.",
    audience:
      "Men and style-conscious locals who want a reliable cut, a strong vibe and a shop that feels social rather than clinical. They care about craft, atmosphere, consistency and a brand that looks as sharp as the finish.",
    positioning:
      "A modern barber brand between old-school nostalgia kitsch and luxury spa grooming. Muchachos is bold but friendly, precise without feeling sterile, and culturally warm without becoming costume Latino. The identity should work on a storefront, apron, Instagram avatar and appointment card.",
    competitors:
      "Reference landscape: Blind Barber, Schorem, Fellow Barber, local independent barbershops and strong neighbourhood grooming rooms. Do not imitate their marks; use them only as a benchmark for craft credibility, shop culture and street-level presence.",
    colorApproach: "propose",
    brandColors: "",
    colorMood:
      "Deep barbershop blacks and warm wood neutrals with one sharp accent; masculine, intimate and nightlife-adjacent without looking cheap or neon.",
    visualDirection:
      "Create a bold, flat black symbol for a contemporary barber shop named Muchachos. Suggest brotherhood, a precise cut, rhythm, chair craft or neighbourhood signal without drawing scissors, combs, razors, mustaches or barber poles. Prioritise an original compact silhouette, strong gestalt and one memorable idea that works as a storefront mark, stamp and favicon.",
    usage:
      "Primary: storefront fascia, window vinyl, social avatar, booking app icon, aprons and appointment cards. Secondary: product labels, loyalty stamps, merch, mirrors and favicon. Required variants: symbol only, horizontal and vertical lockups, positive and reversed monochrome.",
    avoid:
      "Avoid scissors, combs, razors, barber poles, mustaches, skulls, crowns and generic hipster badges. No 3D rendering, perspective, mockup, gradients, shadows, textures, fine illustrative detail, text, letters or pseudo-text inside the generated symbol.",
    personalities: ["Bold", "Warm", "Precise", "Playful", "Editorial"],
    descriptor: "Sharp cuts. Good company.",
  },
];

function resolveBriefTemplateId(fields: {
  brandName: string;
  coreIdea: string;
  industry: string;
  activeTemplateId?: string;
}): string {
  if (
    fields.activeTemplateId &&
    BRIEF_TEMPLATES.some((item) => item.id === fields.activeTemplateId)
  ) {
    return fields.activeTemplateId;
  }
  const match = BRIEF_TEMPLATES.find(
    (item) =>
      item.brandName === fields.brandName &&
      item.coreIdea === fields.coreIdea &&
      item.industry === fields.industry,
  );
  return match?.id ?? "";
}

const WORDMARK_SIZE_OPTIONS = Array.from({ length: (192 - 24) / 4 + 1 }, (_, i) => {
  const value = String(24 + i * 4);
  return { value, label: value };
});

const DESCRIPTOR_SIZE_OPTIONS = [
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16" },
  { value: "18", label: "18" },
  { value: "20", label: "20" },
  { value: "22", label: "22" },
  { value: "24", label: "24" },
  { value: "26", label: "26" },
  { value: "28", label: "28" },
];

/** Survives Strict Mode remounts and session key swaps (fresh → restored). */
let projectListCache: SavedProject[] | null = null;
let projectListInflight: Promise<SavedProject[]> | null = null;

async function fetchProjectList(force = false): Promise<SavedProject[]> {
  if (!force && projectListCache) return projectListCache;
  if (!force && projectListInflight) return projectListInflight;

  const request = (async () => {
    const response = await apiFetch("/project-list");
    if (!response.ok) return projectListCache ?? [];
    const payload = (await response.json()) as { projects?: SavedProject[] };
    projectListCache = payload.projects ?? [];
    return projectListCache;
  })();

  projectListInflight = request.finally(() => {
    if (projectListInflight === request) projectListInflight = null;
  });
  return projectListInflight;
}

function LockupMark({
  alt,
  color,
  url,
}: {
  alt: string;
  color: string;
  url: string;
}) {
  // Empty until prepared — raw Recraft assets include an opaque paper plate.
  const [src, setSrc] = useState("");
  const srcRef = useRef(src);
  srcRef.current = src;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // Same-origin `/api/...` so the Next proxy + Local Studio auth apply.
        // Absolute Railway URLs break SVG text fetch (CORS / cookies).
        const response = await fetch(sameOriginApiUrl(url), {
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Mark fetch failed.");
        const text = await response.text();
        if (!/<svg[\s>]/i.test(text)) throw new Error("Mark was not SVG.");
        // Never show the raw asset — Recraft SVGs include opaque paper plates.
        const tinted = trimSvgViewBox(prepareLockupMarkSvg(text, color));
        if (!/<path\b/i.test(tinted)) throw new Error("Mark geometry empty.");
        const objectUrl = URL.createObjectURL(
          new Blob([tinted], { type: "image/svg+xml" }),
        );
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        // Keep showing the previous blob until the new tint is ready.
        // Revoking in effect cleanup was collapsing the mark on color change.
        setSrc((previous) => {
          if (previous.startsWith("blob:") && previous !== objectUrl) {
            URL.revokeObjectURL(previous);
          }
          return objectUrl;
        });
      } catch (error) {
        console.warn("Lockup mark prepare failed:", error);
        // Keep prior blob; avoid flashing the cream plate from the raw SVG URL.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, color]);

  useEffect(
    () => () => {
      if (srcRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(srcRef.current);
      }
    },
    [],
  );

  if (!src) {
    return <span className="lockup-mark" aria-hidden="true" />;
  }
  return <img className="lockup-mark" src={src} alt={alt} />;
}

function SizeSquareSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  options: Array<{ label: string; value: string }>;
  value: number;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={`size-square${open ? " is-open" : ""}`} ref={root}>
      <button
        type="button"
        className="size-square-trigger"
        aria-expanded={open}
        aria-label={`${label} size ${value}px`}
        title={`${label} size`}
        onClick={() => setOpen((current) => !current)}
      >
        {value}
      </button>
      {open && (
        <div className="size-square-menu" role="listbox" aria-label={`${label} size`}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === String(value)}
              key={option.value}
              onClick={() => {
                onChange(Number(option.value));
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CreativeSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className={`creative-select${open ? " is-open" : ""}`} ref={root}>
      <span className="mini-label">{label}</span>
      <button
        type="button"
        className="creative-select-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <i>{open ? "−" : "↘"}</i>
      </button>
      {open && (
        <div className="creative-select-menu" role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{option.label}</strong>
              <i>{option.value === value ? "●" : "○"}</i>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RequestDrop({ label = "Working" }: { label?: string }) {
  return (
    <span className="water-loader" aria-label={label}>
      <i />
    </span>
  );
}

const STUDIO_ORIGIN = "Tel Aviv";
const STUDIO_AUTHOR = "Dmitrii Kosach";

function LoopenStudioApp({
  signInPath,
  user,
  role,
  initialDraft,
  restoreNotice,
}: {
  signInPath: string;
  user: StudioUser | null;
  role: StudioRole;
  initialDraft: StudioDraft;
  restoreNotice: string;
}) {
  const [selectedConcept, setSelectedConcept] = useState(initialDraft.selectedConcept);
  const [selectedConceptIds, setSelectedConceptIds] = useState(initialDraft.selectedConceptIds);
  const [generatedConcepts, setGeneratedConcepts] = useState(initialDraft.generatedConcepts);
  const [projectId, setProjectId] = useState<string | null>(initialDraft.projectId);
  const [activeTemplateId, setActiveTemplateId] = useState(() =>
    resolveBriefTemplateId(initialDraft),
  );
  const [brandName, setBrandName] = useState(initialDraft.brandName);
  const [coreIdea, setCoreIdea] = useState(initialDraft.coreIdea);
  const [industry, setIndustry] = useState(initialDraft.industry);
  const [companyDescription, setCompanyDescription] = useState(
    initialDraft.companyDescription,
  );
  const [audience, setAudience] = useState(initialDraft.audience);
  const [positioning, setPositioning] = useState(initialDraft.positioning);
  const [competitors, setCompetitors] = useState(initialDraft.competitors);
  const [colorApproach, setColorApproach] =
    useState<NonNullable<PremiumBrief["colorApproach"]>>(initialDraft.colorApproach);
  const [brandColors, setBrandColors] = useState(initialDraft.brandColors);
  const [colorMood, setColorMood] = useState(initialDraft.colorMood);
  const logoType: PremiumBrief["logoType"] = "combination";
  const [visualDirection, setVisualDirection] = useState(initialDraft.visualDirection);
  const [usage, setUsage] = useState(initialDraft.usage);
  const [avoid, setAvoid] = useState(initialDraft.avoid);
  const [strategy, setStrategy] = useState<BrandStrategy | null>(initialDraft.strategy);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [personalities, setPersonalities] = useState(initialDraft.personalities);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [notice, setNotice] = useState(restoreNotice);
  const [diversityWarning, setDiversityWarning] = useState("");
  const [assets, setAssets] = useState(initialDraft.assets);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [openingProjectName, setOpeningProjectName] = useState("");
  const [workspacePane, setWorkspacePane] = useState<"projects" | "account">(
    "projects",
  );
  const [accountSection, setAccountSection] = useState<
    | "profile"
    | "password"
    | "email"
    | "locale"
    | "billing"
    | "team"
    | "support"
    | "delete"
    | null
  >(null);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileStatus, setProfileStatus] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordNextConfirm, setPasswordNextConfirm] = useState("");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<StudioEmailPrefs>(() => {
    const fromUser = user?.prefs?.briefLocale;
    const briefLocale = fromUser
      ? normalizeAppLocale(fromUser)
      : readStoredLocale();
    if (fromUser) persistLocale(briefLocale);
    return {
      productUpdates: user?.prefs?.productUpdates ?? true,
      signalReceipts: user?.prefs?.signalReceipts ?? true,
      teamLaunch: user?.prefs?.teamLaunch ?? false,
      briefLocale,
    };
  });
  const locale = emailPrefs.briefLocale;
  const [localeStatus, setLocaleStatus] = useState("");
  const [localeSaving, setLocaleSaving] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState("");
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [billingHistory, setBillingHistory] = useState<BillingHistoryEntry[]>(
    [],
  );
  const [billingHistoryStatus, setBillingHistoryStatus] = useState("");
  const [billingHistoryLoading, setBillingHistoryLoading] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [exportingKey, setExportingKey] = useState("");
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignalsOpen, setIsSignalsOpen] = useState(false);
  const [authMode, setAuthMode] = useState<
    "signin" | "signup" | "forgot" | "reset" | "confirm"
  >("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authFirstName, setAuthFirstName] = useState("");
  const [authLastName, setAuthLastName] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState("");
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);
  const [authErrors, setAuthErrors] = useState<AuthFieldErrors>({});
  const [authTouched, setAuthTouched] = useState<
    Partial<Record<AuthFieldKey, boolean>>
  >({});
  const [authSubmitAttempted, setAuthSubmitAttempted] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authSending, setAuthSending] = useState<
    "signin" | "signup" | "forgot" | "reset" | "resend" | ""
  >("");
  const [authResendReadyAt, setAuthResendReadyAt] = useState(0);
  const [authResendWaitSec, setAuthResendWaitSec] = useState(0);
  const [signalBalance, setSignalBalance] = useState<number | null>(
    user?.signalBalance ?? null,
  );
  const [signalPacks, setSignalPacks] = useState<SignalPack[]>([]);
  const [signalCosts, setSignalCosts] = useState<SignalCosts | null>(null);
  const [billingEnabled, setBillingEnabled] = useState(false);
  const [checkoutPackId, setCheckoutPackId] = useState("");
  /** guest = signed out. user/admin = real Supabase account. */
  const isGuestSession = role === "guest" || !user;
  const isAdmin = role === "admin";
  const hasWorkspace = Boolean(user) && (role === "user" || role === "admin");
  const [selectedRefinement, setSelectedRefinement] = useState(initialDraft.selectedRefinement);
  const [selectedVector, setSelectedVector] = useState(initialDraft.selectedVector);
  const [productionLocked, setProductionLocked] = useState(initialDraft.productionLocked);
  const [vectorSourceMode, setVectorSourceMode] = useState<"refine" | "original">(
    initialDraft.vectorSourceMode,
  );
  const [lockupLayout, setLockupLayout] = useState<"horizontal" | "vertical" | "icon">(
    initialDraft.lockupLayout,
  );
  const [lockupColor, setLockupColor] = useState(initialDraft.lockupColor);
  const [wordmarkName, setWordmarkName] = useState(initialDraft.wordmarkName);
  const [descriptor, setDescriptor] = useState(initialDraft.descriptor);
  const [wordmarkStyle, setWordmarkStyle] = useState(initialDraft.wordmarkStyle);
  const [wordmarkCase, setWordmarkCase] = useState<"original" | "upper" | "lower">(
    initialDraft.wordmarkCase,
  );
  const [wordmarkWeight, setWordmarkWeight] = useState(initialDraft.wordmarkWeight);
  const [wordmarkTracking, setWordmarkTracking] = useState(initialDraft.wordmarkTracking);
  const [wordmarkSize, setWordmarkSize] = useState(initialDraft.wordmarkSize);
  const [descriptorSize, setDescriptorSize] = useState(initialDraft.descriptorSize);
  const [markScale, setMarkScale] = useState(initialDraft.markScale);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);
  const historyListRef = useRef<HTMLDivElement>(null);
  const sessionReady = true;
  const studioStamp = useMemo(
    () => studioPlaceStamp(STUDIO_ORIGIN),
    [],
  );

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (!isHistoryOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isHistoryOpen]);

  function scrollProjectHistory(direction: -1 | 1) {
    historyListRef.current?.scrollBy({
      behavior: "smooth",
      top: direction * Math.max(240, historyListRef.current.clientHeight * 0.72),
    });
  }

  function requestConfirmation(dialog: ConfirmDialog) {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current?.(false);
      confirmResolver.current = resolve;
      setConfirmDialog(dialog);
    });
  }

  function resolveConfirmation(confirmed: boolean) {
    confirmResolver.current?.(confirmed);
    confirmResolver.current = null;
    setConfirmDialog(null);
  }

  function showRequestError(stage: string, message: string) {
    setNotice(message);
    confirmResolver.current?.(false);
    confirmResolver.current = null;
    setConfirmDialog({
      kicker: t(locale, "confirm.requestFailed.kicker", { stage }),
      title: t(locale, "confirm.requestFailed.title"),
      body: message,
      confirmLabel: t(locale, "confirm.returnStudio"),
      dismissOnly: true,
      tone: "danger",
    });
  }

  function startAuthResendCooldown(seconds = 60) {
    setAuthResendReadyAt(Date.now() + seconds * 1000);
    setAuthResendWaitSec(seconds);
  }

  function authFormValues(): AuthFormValues {
    return {
      firstName: authFirstName,
      lastName: authLastName,
      email: authEmail,
      password: authPassword,
      passwordConfirm: authPasswordConfirm,
    };
  }

  function clearAuthFieldErrors() {
    setAuthErrors({});
    setAuthTouched({});
    setAuthSubmitAttempted(false);
  }

  function showAuthFieldError(field: AuthFieldKey): string | undefined {
    if (!authSubmitAttempted && !authTouched[field]) return undefined;
    return authErrors[field];
  }

  function updateAuthField(field: AuthFieldKey, value: string) {
    const nextValues = authFormValues();
    if (field === "firstName") {
      setAuthFirstName(value);
      nextValues.firstName = value;
    } else if (field === "lastName") {
      setAuthLastName(value);
      nextValues.lastName = value;
    } else if (field === "email") {
      setAuthEmail(value);
      nextValues.email = value;
    } else if (field === "password") {
      setAuthPassword(value);
      nextValues.password = value;
      if (!value) setAuthPasswordVisible(false);
    } else {
      setAuthPasswordConfirm(value);
      nextValues.passwordConfirm = value;
    }

    if (authSubmitAttempted || authTouched[field]) {
      const message = validateAuthField(field, nextValues, authMode, locale);
      setAuthErrors((current) => {
        const next = { ...current };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    }
    if (
      field === "password" &&
      (authSubmitAttempted || authTouched.passwordConfirm) &&
      (authMode === "signup" || authMode === "reset")
    ) {
      const confirmMessage = validateAuthField(
        "passwordConfirm",
        nextValues,
        authMode,
        locale,
      );
      setAuthErrors((current) => {
        const next = { ...current };
        if (confirmMessage) next.passwordConfirm = confirmMessage;
        else delete next.passwordConfirm;
        return next;
      });
    }
  }

  function blurAuthField(field: AuthFieldKey) {
    setAuthTouched((current) => ({ ...current, [field]: true }));
    const message = validateAuthField(
      field,
      authFormValues(),
      authMode,
      locale,
    );
    setAuthErrors((current) => {
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function runAuthValidation(): boolean {
    const errors = validateAuthForm(authMode, authFormValues(), locale);
    setAuthSubmitAttempted(true);
    setAuthErrors(errors);
    return !hasAuthErrors(errors);
  }

  function openAuthGate(
    mode: "signin" | "signup" | "forgot" | "reset" | "confirm" = "signin",
    status = "",
  ) {
    setAuthMode(mode);
    setAuthStatus(status);
    setAuthPassword("");
    setAuthPasswordConfirm("");
    setAuthPasswordVisible(false);
    clearAuthFieldErrors();
    if (mode !== "signup") {
      setAuthFirstName("");
      setAuthLastName("");
    }
    if (mode !== "confirm") {
      setAuthResendReadyAt(0);
      setAuthResendWaitSec(0);
    }
    setIsAuthOpen(true);
  }

  function requireStudioAccess() {
    if (user) return true;
    openAuthGate("signin", t(locale, "auth.requireAccess"));
    return false;
  }

  function handlePaymentRequired(error?: string, required?: number) {
    setIsSignalsOpen(true);
    setNotice(
      error ||
        (required
          ? t(locale, "notice.insufficientSignalsNeed", { n: required })
          : t(locale, "notice.insufficientSignals")),
    );
  }

  async function refreshStudioAccount() {
    try {
      const response = await apiFetch("/auth/me");
      if (!response.ok) return;
      const payload = await readApiJson<{
        user?: StudioUser | null;
        signals?: { balance: number } | null;
        packs?: SignalPack[];
        costs?: SignalCosts;
        billingEnabled?: boolean;
        warning?: string;
      }>(response);
      if (typeof payload.signals?.balance === "number") {
        setSignalBalance(payload.signals.balance);
      }
      if (payload.packs?.length) setSignalPacks(payload.packs);
      if (payload.costs) setSignalCosts(payload.costs);
      setBillingEnabled(Boolean(payload.billingEnabled));
      if (payload.user?.prefs) {
        const prefs = payload.user.prefs as StudioEmailPrefsPayload;
        setEmailPrefs((current) => {
          // Only adopt locale when the Auth user actually has brief_locale set.
          // Never fall back to a stale default that would wipe the UI language.
          const briefLocale = prefs.briefLocale
            ? normalizeAppLocale(prefs.briefLocale)
            : current.briefLocale;
          const next: StudioEmailPrefs = {
            productUpdates: prefs.productUpdates ?? current.productUpdates,
            signalReceipts: prefs.signalReceipts ?? current.signalReceipts,
            teamLaunch: prefs.teamLaunch ?? current.teamLaunch,
            briefLocale,
          };
          persistLocale(next.briefLocale);
          return next;
        });
      }
      if (payload.user) {
        setProfileFirstName(payload.user.firstName ?? "");
        setProfileLastName(payload.user.lastName ?? "");
      }
      if (payload.warning) setNotice(payload.warning);
    } catch {
      // Wallet endpoint may be unavailable until migration is applied.
    }
  }

  function openWorkspace(pane: "projects" | "account" = "projects") {
    setWorkspacePane(pane);
    setAccountSection(null);
    setIsHistoryOpen(true);
    void refreshStudioAccount();
  }

  async function saveProfileName(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const firstName = profileFirstName.trim();
    const lastName = profileLastName.trim();
    if (firstName.length < 2 || lastName.length < 2) {
      setProfileStatus(t(locale, "workspace.profile.needNames"));
      return;
    }
    setProfileSaving(true);
    setProfileStatus(t(locale, "workspace.profile.saving"));
    try {
      const response = await apiFetch("/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });
      const payload = await readApiJson<{
        error?: string;
        user?: { displayName?: string; firstName?: string; lastName?: string };
      }>(response);
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "workspace.profile.failed"),
        );
      }
      setProfileStatus(t(locale, "workspace.profile.updated"));
      if (payload.user?.displayName) {
        // Soft refresh — full reload keeps cookies/session simple.
        window.location.reload();
        return;
      }
    } catch (error) {
      setProfileStatus(
        error instanceof Error
          ? error.message
          : t(locale, "workspace.profile.failed"),
      );
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveAccountPassword(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (passwordNext.length < 8 || !/[A-Za-z]/.test(passwordNext) || !/\d/.test(passwordNext)) {
      setPasswordStatus(t(locale, "workspace.password.rules"));
      return;
    }
    if (passwordNext !== passwordNextConfirm) {
      setPasswordStatus(t(locale, "workspace.password.mismatch"));
      return;
    }
    setPasswordSaving(true);
    setPasswordStatus(t(locale, "workspace.password.updatingLong"));
    try {
      const response = await apiFetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordCurrent,
          newPassword: passwordNext,
        }),
      });
      const payload = await readApiJson<{ error?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "workspace.password.failed"),
        );
      }
      setPasswordCurrent("");
      setPasswordNext("");
      setPasswordNextConfirm("");
      setPasswordStatus(
        payload.message ?? t(locale, "workspace.password.updated"),
      );
    } catch (error) {
      setPasswordStatus(
        error instanceof Error
          ? error.message
          : t(locale, "workspace.password.failed"),
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  async function saveEmailPrefs(next: StudioEmailPrefs) {
    setEmailPrefs(next);
    setPrefsSaving(true);
    setPrefsStatus(t(locale, "workspace.prefs.saving"));
    try {
      const response = await apiFetch("/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Locale has its own saver — don't stamp it on every email toggle.
        body: JSON.stringify({
          productUpdates: next.productUpdates,
          signalReceipts: next.signalReceipts,
          teamLaunch: next.teamLaunch,
        }),
      });
      const payload = await readApiJson<{
        error?: string;
        user?: { prefs?: StudioEmailPrefs };
      }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? t(locale, "workspace.prefs.failed"));
      }
      if (payload.user?.prefs) {
        const prefs = payload.user.prefs as StudioEmailPrefsPayload;
        setEmailPrefs((current) => ({
          productUpdates: prefs.productUpdates ?? current.productUpdates,
          signalReceipts: prefs.signalReceipts ?? current.signalReceipts,
          teamLaunch: prefs.teamLaunch ?? current.teamLaunch,
          briefLocale: prefs.briefLocale ?? current.briefLocale,
        }));
      }
      setPrefsStatus(t(locale, "workspace.prefs.saved"));
    } catch (error) {
      setPrefsStatus(
        error instanceof Error
          ? error.message
          : t(locale, "workspace.prefs.failed"),
      );
      void refreshStudioAccount();
    } finally {
      setPrefsSaving(false);
    }
  }

  async function saveBriefLocale(briefLocale: BriefLocale) {
    const previous = emailPrefs.briefLocale;
    const next = { ...emailPrefs, briefLocale };
    setEmailPrefs(next);
    persistLocale(briefLocale);
    applyDocumentLocale(briefLocale);
    setLocaleSaving(true);
    setLocaleStatus("…");
    try {
      const response = await apiFetch("/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefLocale }),
      });
      const payload = await readApiJson<{
        error?: string;
        user?: { prefs?: StudioEmailPrefsPayload };
      }>(response);
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(previous, "workspace.locale.failed"),
        );
      }
      const saved =
        payload.user?.prefs?.briefLocale &&
        normalizeAppLocale(payload.user.prefs.briefLocale);
      if (!saved || saved !== briefLocale) {
        throw new Error(t(previous, "workspace.locale.notSaved"));
      }
      setEmailPrefs((current) => ({
        ...current,
        productUpdates:
          payload.user?.prefs?.productUpdates ?? current.productUpdates,
        signalReceipts:
          payload.user?.prefs?.signalReceipts ?? current.signalReceipts,
        teamLaunch: payload.user?.prefs?.teamLaunch ?? current.teamLaunch,
        briefLocale: saved,
      }));
      persistLocale(saved);
      setLocaleStatus(t(saved, "workspace.locale.saved"));
    } catch (error) {
      setEmailPrefs((current) => ({ ...current, briefLocale: previous }));
      persistLocale(previous);
      applyDocumentLocale(previous);
      setLocaleStatus(
        error instanceof Error
          ? error.message
          : t(previous, "workspace.locale.failed"),
      );
      void refreshStudioAccount();
    } finally {
      setLocaleSaving(false);
    }
  }

  async function loadBillingHistory() {
    setBillingHistoryLoading(true);
    setBillingHistoryStatus("");
    try {
      const response = await apiFetch("/billing/history");
      const payload = await readApiJson<{
        error?: string;
        entries?: BillingHistoryEntry[];
      }>(response);
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "workspace.billing.loadFailed"),
        );
      }
      setBillingHistory(payload.entries ?? []);
      if (!(payload.entries ?? []).length) {
        setBillingHistoryStatus(t(locale, "workspace.billing.empty"));
      }
    } catch (error) {
      setBillingHistory([]);
      setBillingHistoryStatus(
        error instanceof Error
          ? error.message
          : t(locale, "workspace.billing.loadFailed"),
      );
    } finally {
      setBillingHistoryLoading(false);
    }
  }

  async function deleteStudioAccount(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (deleteConfirmEmail.trim().toLowerCase() !== user?.email.toLowerCase()) {
      setDeleteStatus(t(locale, "workspace.delete.typeEmail"));
      return;
    }
    const confirmed = await requestConfirmation({
      kicker: t(locale, "confirm.deleteAccount.kicker"),
      title: t(locale, "confirm.deleteAccount.title"),
      body: t(locale, "confirm.deleteAccount.body"),
      confirmLabel: t(locale, "confirm.deleteAccount.cta"),
      tone: "danger",
    });
    if (!confirmed) return;

    setDeleteSaving(true);
    setDeleteStatus(t(locale, "workspace.delete.deletingLong"));
    try {
      const response = await apiFetch("/auth/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail.trim() }),
      });
      const payload = await readApiJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? t(locale, "workspace.delete.failed"));
      }
      window.location.href = "/";
    } catch (error) {
      setDeleteStatus(
        error instanceof Error
          ? error.message
          : t(locale, "workspace.delete.failed"),
      );
      setDeleteSaving(false);
    }
  }

  async function signInWithPassword(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!runAuthValidation()) {
      setAuthStatus(t(locale, "auth.checkFields"));
      return;
    }
    const email = authEmail.trim().toLowerCase();
    setAuthSending("signin");
    setAuthStatus(t(locale, "auth.status.opening"));
    try {
      const response = await apiFetch("/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: authPassword }),
      });
      const payload = await readApiJson<{
        error?: string;
        needsConfirmation?: boolean;
      }>(response);
      if (!response.ok) {
        if (payload.needsConfirmation) {
          openAuthGate(
            "confirm",
            payload.error ?? t(locale, "auth.status.confirmFirst"),
          );
          setAuthSending("");
          return;
        }
        setAuthErrors({
          password: payload.error ?? t(locale, "auth.status.invalidCreds"),
        });
        setAuthStatus(payload.error ?? t(locale, "auth.status.invalidCreds"));
        setAuthSending("");
        return;
      }
      window.location.href = "/#brief";
      window.location.reload();
    } catch (error) {
      setAuthStatus(
        error instanceof Error
          ? error.message
          : t(locale, "auth.status.signInFailed"),
      );
      setAuthSending("");
    }
  }

  async function registerWithPassword(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!runAuthValidation()) {
      setAuthStatus(t(locale, "auth.checkFields"));
      return;
    }
    const email = authEmail.trim().toLowerCase();
    const firstName = authFirstName.trim();
    const lastName = authLastName.trim();
    setAuthSending("signup");
    setAuthStatus(t(locale, "auth.status.creating"));
    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: authPassword,
          firstName,
          lastName,
        }),
      });
      const payload = await readApiJson<{
        error?: string;
        message?: string;
        needsConfirmation?: boolean;
      }>(response);
      if (!response.ok) {
        setAuthStatus(
          payload.error ?? t(locale, "auth.status.createFailed"),
        );
        setAuthSending("");
        return;
      }
      if (payload.needsConfirmation) {
        setAuthPassword("");
        setAuthPasswordConfirm("");
        openAuthGate(
          "confirm",
          payload.message ?? t(locale, "auth.status.createdConfirm"),
        );
        startAuthResendCooldown(60);
        setAuthSending("");
        return;
      }
      window.location.href = "/#brief";
      window.location.reload();
    } catch (error) {
      setAuthStatus(
        error instanceof Error
          ? error.message
          : t(locale, "auth.status.createFailed"),
      );
      setAuthSending("");
    }
  }

  async function resendConfirmationEmail() {
    if (authResendWaitSec > 0 || authSending === "resend") return;
    if (!runAuthValidation()) {
      setAuthStatus(t(locale, "auth.status.resendNeedEmail"));
      return;
    }
    const email = authEmail.trim().toLowerCase();
    setAuthSending("resend");
    setAuthStatus(t(locale, "auth.status.resending"));
    try {
      const response = await apiFetch("/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await readApiJson<{ error?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "auth.status.resendFailed"),
        );
      }
      startAuthResendCooldown(60);
      setAuthStatus(payload.message ?? t(locale, "auth.status.resendSent"));
    } catch (error) {
      setAuthStatus(
        error instanceof Error
          ? error.message
          : t(locale, "auth.status.resendFailed"),
      );
    } finally {
      setAuthSending("");
    }
  }

  async function requestPasswordReset(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!runAuthValidation()) {
      setAuthStatus(t(locale, "auth.status.resetNeedEmail"));
      return;
    }
    const email = authEmail.trim().toLowerCase();
    setAuthSending("forgot");
    setAuthStatus(t(locale, "auth.status.sendingReset"));
    try {
      const response = await apiFetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await readApiJson<{ error?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "auth.status.resetSendFailed"),
        );
      }
      setAuthStatus(payload.message ?? t(locale, "auth.status.resetSent"));
    } catch (error) {
      setAuthStatus(
        error instanceof Error
          ? error.message
          : t(locale, "auth.status.resetSendFailed"),
      );
    } finally {
      setAuthSending("");
    }
  }

  async function updateStudioPassword(event?: { preventDefault(): void }) {
    event?.preventDefault();
    if (!runAuthValidation()) {
      setAuthStatus(t(locale, "auth.checkFields"));
      return;
    }
    setAuthSending("reset");
    setAuthStatus(t(locale, "auth.status.savingPassword"));
    try {
      const response = await apiFetch("/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: authPassword }),
      });
      const payload = await readApiJson<{ error?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(
          payload.error ?? t(locale, "auth.status.updatePasswordFailed"),
        );
      }
      window.location.href = "/#brief";
      window.location.reload();
    } catch (error) {
      setAuthStatus(
        error instanceof Error
          ? error.message
          : t(locale, "auth.status.updatePasswordFailed"),
      );
      setAuthSending("");
    }
  }

  function submitAuthForm(event: { preventDefault(): void }) {
    event.preventDefault();
    if (authMode === "signup") return void registerWithPassword();
    if (authMode === "forgot") return void requestPasswordReset();
    if (authMode === "reset") return void updateStudioPassword();
    return void signInWithPassword();
  }

  function suppressNativeAuthValidation(
    event: { preventDefault(): void },
  ) {
    event.preventDefault();
  }

  async function startSignalCheckout(packId: string) {
    setCheckoutPackId(packId);
    try {
      const response = await apiFetch("/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const payload = await readApiJson<{ error?: string; url?: string }>(
        response,
      );
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? t(locale, "signals.checkoutFailed"));
      }
      window.location.href = payload.url;
    } catch (error) {
      showRequestError(
        t(locale, "signals.checkoutStage"),
        error instanceof Error
          ? error.message
          : t(locale, "signals.checkoutFailed"),
      );
      setCheckoutPackId("");
    }
  }

  function showJuryReview(concept: GeneratedConcept) {
    confirmResolver.current?.(false);
    confirmResolver.current = null;
    setConfirmDialog({
      kicker: t(locale, "confirm.jury.kicker", {
        status: concept.reviewStatus ?? t(locale, "concepts.reviewStatus"),
      }),
      title: concept.directionTitle,
      body: concept.reviewReason ?? t(locale, "confirm.jury.noCritique"),
      confirmLabel: t(locale, "confirm.jury.return"),
      dismissOnly: true,
    });
  }

  const selected = useMemo(
    () =>
      concepts.find((concept) => concept.id === selectedConcept) ??
      concepts.find((concept) => selectedConcept.startsWith(`${concept.id}-`)) ??
      concepts.find(
        (concept) =>
          concept.id ===
          generatedConcepts.find(
            (generation) => generation.directionKey === selectedConcept,
          )?.directionKey,
      ) ??
      concepts[0],
    [generatedConcepts, selectedConcept],
  );
  const refinements = assets.filter((asset) => asset.stage === "refine");
  const vectors = assets.filter((asset) => asset.stage === "vector");
  const productionUnlocked =
    selectedConceptIds.length > 0 ||
    refinements.length > 0 ||
    vectors.length > 0 ||
    isRefining ||
    isVectorizing;
  const selectedReduction = refinements.find(
    (asset) => asset.id === selectedRefinement,
  );
  const vectorSourceGeneration =
    generatedConcepts.find((item) => item.id === selectedReduction?.parentId) ??
    generatedConcepts.find((item) => item.id === selectedConceptIds[0]) ??
    generatedConcepts.find((item) => item.directionKey === selectedConcept) ??
    null;
  const preferOriginal =
    vectorSourceMode === "original" ||
    (!selectedReduction && Boolean(vectorSourceGeneration));
  const canReconstruct = Boolean(
    preferOriginal ? vectorSourceGeneration : selectedReduction,
  );
  const juryRecommends =
    selectedReduction?.reviewStatus === "Recommended" ||
    (selectedReduction?.qualityScore ?? 0) >= 75;
  const selectedVectorAsset = vectors.find(
    (asset) => asset.id === selectedVector,
  );
  const lockupPalette = Array.from(
    new Map(
      (strategy?.palette ?? ["#201F1E", "#F3F0EA", "#C84A32", "#FFFFFF"]).map((color) => [
        color.toLowerCase(),
        color,
      ]),
    ).values(),
  );
  const brandNameFallback = t(locale, "prod.wordmarkPh");
  const displayBrandName =
    wordmarkCase === "upper"
      ? (wordmarkName || brandName || brandNameFallback).toUpperCase()
      : wordmarkCase === "lower"
        ? (wordmarkName || brandName || brandNameFallback).toLowerCase()
        : wordmarkName || brandName || brandNameFallback;
  const markScaleFactor = Math.min(4, Math.max(0.7, markScale / 100));
  // Same base for horizontal/icon so "Icon only" doesn't jump to a huge orphan size.
  const markSizePx = Math.round(
    (lockupLayout === "vertical" ? wordmarkSize * 2 : wordmarkSize * 2.2) *
      markScaleFactor,
  );
  const focusedGeneration = generatedConcepts.find(
    (item) => item.directionKey === selectedConcept,
  );

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;
    void fetchProjectList().then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (!authResendReadyAt) {
      setAuthResendWaitSec(0);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((authResendReadyAt - Date.now()) / 1000),
      );
      setAuthResendWaitSec(left);
      if (left === 0) setAuthResendReadyAt(0);
    };
    tick();
    const id = window.setInterval(tick, 400);
    return () => window.clearInterval(id);
  }, [authResendReadyAt]);

  useEffect(() => {
    void refreshStudioAccount();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#/, "");
    const authError = params.get("auth");
    const wantsReset = params.get("reset") === "1";
    if (wantsReset) {
      openAuthGate("reset", t(locale, "auth.reset.copy"));
    } else if (authError === "confirmed") {
      if (isGuestSession) {
        openAuthGate(
          "signin",
          t(locale, "auth.status.emailConfirmedSignIn"),
        );
      } else {
        setNotice(t(locale, "notice.emailConfirmed"));
      }
    } else if (
      authError === "failed" ||
      authError === "missing" ||
      authError === "config"
    ) {
      openAuthGate(
        "signin",
        authError === "config"
          ? "Auth is not configured on this host."
          : t(locale, "auth.status.linkExpired"),
      );
    } else if (
      (hash === "enter" || params.has("auth") || signInPath.includes("#enter")) &&
      isGuestSession
    ) {
      openAuthGate("signin");
    }
    if (params.get("signals") === "topped") {
      setNotice(t(locale, "notice.signalsLanded"));
      setIsSignalsOpen(false);
      void refreshStudioAccount();
    }
    if (params.get("signals") === "cancelled") {
      setNotice(t(locale, "notice.topUpCancelled"));
    }
  }, [user?.email, signInPath, isGuestSession]);

  useEffect(() => {
    // While production is locked (Reduce reset), trust local snapshot only —
    // do not rehydrate old refine/SVG assets from the server.
    if (!initialDraft.projectId || initialDraft.productionLocked) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await apiFetch(`/projects/${initialDraft.projectId}`);
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as {
          generations?: GeneratedConcept[];
          assets?: StudioAsset[];
        };
        if (cancelled) return;
        if (payload.generations?.length) {
          setGeneratedConcepts(payload.generations);
        }
        if (payload.assets) {
          setAssets(payload.assets);
          const refineIds = new Set(
            payload.assets
              .filter((asset) => asset.stage === "refine")
              .map((asset) => asset.id),
          );
          const vectorIds = new Set(
            payload.assets
              .filter((asset) => asset.stage === "vector")
              .map((asset) => asset.id),
          );
          setSelectedRefinement((current) =>
            current && refineIds.has(current)
              ? current
              : payload.assets!.filter((asset) => asset.stage === "refine").at(-1)
                  ?.id ?? "",
          );
          setSelectedVector((current) =>
            current && vectorIds.has(current)
              ? current
              : payload.assets!.filter((asset) => asset.stage === "vector").at(-1)
                  ?.id ?? "",
          );
        }
      } catch {
        // Keep local snapshot if the API is briefly unavailable after wake.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialDraft.projectId, initialDraft.productionLocked]);

  useEffect(() => {
    if (!sessionReady) return;
    const snapshot: StudioSessionSnapshot = {
      v: 1,
      savedAt: Date.now(),
      projectId,
      activeTemplateId,
      brandName,
      coreIdea,
      industry,
      companyDescription,
      audience,
      positioning,
      competitors,
      colorApproach,
      brandColors,
      colorMood,
      visualDirection,
      usage,
      avoid,
      personalities,
      strategy,
      selectedConcept,
      selectedConceptIds,
      generatedConcepts,
      assets,
      selectedRefinement,
      selectedVector,
      productionLocked,
      vectorSourceMode,
      lockupLayout,
      lockupColor,
      wordmarkName,
      descriptor,
      wordmarkStyle,
      wordmarkCase,
      wordmarkWeight,
      wordmarkTracking,
      wordmarkSize,
      descriptorSize,
      markScale,
    };
    const timer = window.setTimeout(() => writeStudioSession(snapshot), 250);
    const flush = () => writeStudioSession(snapshot);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, [
    sessionReady,
    projectId,
    activeTemplateId,
    brandName,
    coreIdea,
    industry,
    companyDescription,
    audience,
    positioning,
    competitors,
    colorApproach,
    brandColors,
    colorMood,
    visualDirection,
    usage,
    avoid,
    personalities,
    strategy,
    selectedConcept,
    selectedConceptIds,
    generatedConcepts,
    assets,
    selectedRefinement,
    selectedVector,
    productionLocked,
    vectorSourceMode,
    lockupLayout,
    lockupColor,
    wordmarkName,
    descriptor,
    wordmarkStyle,
    wordmarkCase,
    wordmarkWeight,
    wordmarkTracking,
    wordmarkSize,
    descriptorSize,
    markScale,
  ]);

  useEffect(() => {
    if (!confirmDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") resolveConfirmation(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmDialog]);

  useEffect(() => {
    if (!isMethodOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMethodOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMethodOpen]);

  async function loadHistory(force = true) {
    const list = await fetchProjectList(force);
    setProjects(list);
  }

  async function openProject(id: string, brandHint = "") {
    const startedAt = Date.now();
    setOpeningProjectName(brandHint || "…");
    setNotice(t(locale, "notice.loadingProject"));
    try {
      const response = await apiFetch(`/projects/${id}`);
      const payload = (await response.json()) as {
        error?: string;
        project?: {
          brandName: string;
          brief: PremiumBrief;
          selectedGenerationId?: string;
        };
        generations?: GeneratedConcept[];
        assets?: StudioAsset[];
      };
      if (!response.ok || !payload.project) {
        setOpeningProjectName("");
        showRequestError(
          "Project history",
          payload.error ?? "Project could not be loaded.",
        );
        return;
      }
      const loadedAssets = payload.assets ?? [];
      const loadedGenerations = payload.generations ?? [];
      setProjectId(id);
      const nextBrand = payload.project.brandName;
      const nextCoreIdea = payload.project.brief.coreIdea ?? "";
      const nextIndustry = payload.project.brief.industry ?? "";
      setOpeningProjectName(nextBrand);
      setBrandName(nextBrand);
      setWordmarkName(nextBrand);
      setCoreIdea(nextCoreIdea);
      setIndustry(nextIndustry);
      setCompanyDescription(payload.project.brief.companyDescription ?? "");
      setAudience(payload.project.brief.audience ?? "");
      setPositioning(payload.project.brief.positioning ?? "");
      setCompetitors(payload.project.brief.competitors ?? "");
      setColorApproach(payload.project.brief.colorApproach ?? "propose");
      setBrandColors(payload.project.brief.brandColors ?? "");
      setColorMood(payload.project.brief.colorMood ?? "");
      setVisualDirection(payload.project.brief.visualDirection ?? "");
      setUsage(payload.project.brief.usage ?? "");
      setAvoid(payload.project.brief.avoid ?? "");
      setStrategy(payload.project.brief.strategy ?? null);
      setPersonalities(payload.project.brief.personalities ?? []);
      setActiveTemplateId(
        resolveBriefTemplateId({
          brandName: nextBrand,
          coreIdea: nextCoreIdea,
          industry: nextIndustry,
        }),
      );
      setGeneratedConcepts(loadedGenerations);
      setAssets(loadedAssets);
      const selectedLoaded =
        loadedGenerations.find(
          (item) => item.id === payload.project?.selectedGenerationId,
        ) ?? loadedGenerations[0];
      if (selectedLoaded) setSelectedConcept(selectedLoaded.directionKey);
      setSelectedConceptIds(selectedLoaded ? [selectedLoaded.id] : []);
      const latestRefine = loadedAssets
        .filter((asset) => asset.stage === "refine")
        .at(-1);
      const latestVector = loadedAssets
        .filter((asset) => asset.stage === "vector")
        .at(-1);
      setSelectedRefinement(latestRefine?.id ?? "");
      setSelectedVector(latestVector?.id ?? "");
      setProductionLocked(false);
      setNotice(
        t(locale, "notice.projectLoaded", { name: payload.project.brandName }),
      );
      // Hold the creative loader briefly so it reads as intentional, not a flash.
      const holdMs = Math.max(0, 900 - (Date.now() - startedAt));
      if (holdMs) await new Promise((resolve) => window.setTimeout(resolve, holdMs));
      setIsHistoryOpen(false);
      setOpeningProjectName("");
      window.requestAnimationFrame(() => {
        document
          .getElementById("concepts")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (error) {
      setOpeningProjectName("");
      showRequestError(
        "Project history",
        error instanceof Error ? error.message : "Project could not be loaded.",
      );
    }
  }

  async function deleteProject(project: SavedProject) {
    const confirmed = await requestConfirmation({
      kicker: t(locale, "confirm.deleteProject.kicker"),
      title: t(locale, "confirm.deleteProject.title", {
        name: project.brandName,
      }),
      body: t(locale, "confirm.deleteProject.body"),
      confirmLabel: t(locale, "confirm.deleteProject.cta"),
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    const response = await apiFetch(`/projects/${project.id}`, {
      method: "DELETE",
    });
    setDeletingProjectId("");
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      showRequestError(
        t(locale, "confirm.deleteProject.cta"),
        payload?.error ?? "Project could not be deleted.",
      );
      return;
    }

    projectListCache = (projectListCache ?? projects).filter(
      (item) => item.id !== project.id,
    );
    setProjects((current) =>
      current.filter((item) => item.id !== project.id),
    );
    if (projectId === project.id) {
      setProjectId(null);
      setGeneratedConcepts([]);
      setSelectedConceptIds([]);
      setAssets([]);
      setSelectedRefinement("");
      setSelectedVector("");
      setProductionLocked(false);
      setStrategy(null);
      clearStudioSession();
    }
    setNotice(
      t(locale, "notice.projectDeleted", { name: project.brandName }),
    );
  }

  function togglePersonality(item: string) {
    setPersonalities((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  }

  function clearBriefTemplate() {
    setActiveTemplateId("");
    setBrandName("");
    setWordmarkName("");
    setCoreIdea("");
    setIndustry("");
    setCompanyDescription("");
    setAudience("");
    setPositioning("");
    setCompetitors("");
    setColorApproach("propose");
    setBrandColors("");
    setColorMood("");
    setVisualDirection("");
    setUsage("");
    setAvoid("");
    setPersonalities([]);
    setDescriptor("");
    setStrategy(null);
    setNotice(t(locale, "notice.blankBrief"));
  }

  async function resetStudioToFresh() {
    const confirmed = await requestConfirmation({
      kicker: t(locale, "confirm.reset.kicker"),
      title: t(locale, "confirm.reset.title"),
      body: t(locale, "confirm.reset.body"),
      confirmLabel: t(locale, "confirm.reset.cta"),
      tone: "danger",
    });
    if (!confirmed) return false;

    clearBriefTemplate();
    setSelectedConcept("continuous");
    setSelectedConceptIds([]);
    setGeneratedConcepts([]);
    setProjectId(null);
    setIsStrategyOpen(false);
    setIsGenerating(false);
    setIsGeneratingMore(false);
    setDiversityWarning("");
    setAssets([]);
    setIsHistoryOpen(false);
    setDeletingProjectId("");
    setIsRefining(false);
    setIsVectorizing(false);
    setExportingKey("");
    setIsMethodOpen(false);
    setSelectedRefinement("");
    setSelectedVector("");
    setProductionLocked(false);
    setVectorSourceMode("refine");
    setLockupLayout("horizontal");
    setLockupColor("#201f1e");
    setWordmarkStyle("modern");
    setWordmarkCase("original");
    setWordmarkWeight(600);
    setWordmarkTracking(-3);
    setWordmarkSize(112);
    setDescriptorSize(24);
    setMarkScale(100);
    setConfirmDialog(null);
    clearStudioSession();
    setNotice(t(locale, "notice.studioReset"));
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  function startBriefFromWorkspace() {
    setIsHistoryOpen(false);
    setWorkspacePane("projects");
    window.requestAnimationFrame(() => {
      document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  async function startNewProjectFromWorkspace() {
    const reset = await resetStudioToFresh();
    if (!reset) return;
    window.requestAnimationFrame(() => {
      document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  /** Wipe client draft/cache before auth cookies are cleared — pagehide must not re-save. */
  function leaveStudio() {
    suspendStudioSessionPersist();
    clearStudioSession();
    projectListCache = null;
    projectListInflight = null;
    try {
      window.localStorage.removeItem(LOCALE_STORAGE_KEY);
      window.sessionStorage.removeItem(STUDIO_SESSION_KEY);
      window.localStorage.removeItem(STUDIO_SESSION_KEY);
    } catch {
      // ignore
    }
    setProjects([]);
    setSignalBalance(null);
    setIsHistoryOpen(false);
    setIsSignalsOpen(false);
    setOpeningProjectName("");
    setConfirmDialog(null);
    clearBriefTemplate();
    setSelectedConcept("continuous");
    setSelectedConceptIds([]);
    setGeneratedConcepts([]);
    setProjectId(null);
    setAssets([]);
    setSelectedRefinement("");
    setSelectedVector("");
    setProductionLocked(false);
    setStrategy(null);
    setProfileFirstName("");
    setProfileLastName("");
    setPasswordCurrent("");
    setPasswordNext("");
    setPasswordNextConfirm("");
    setDeleteConfirmEmail("");
    // Logout HTML page clears storage again after any pagehide re-write.
    window.location.assign("/api/auth/logout?return_to=/");
  }

  function applyBriefTemplate(template: BriefTemplate) {
    setActiveTemplateId(template.id);
    setBrandName(template.brandName);
    setWordmarkName(template.brandName);
    setCoreIdea(template.coreIdea);
    setIndustry(template.industry);
    setCompanyDescription(template.companyDescription);
    setAudience(template.audience);
    setPositioning(template.positioning);
    setCompetitors(template.competitors);
    setColorApproach(template.colorApproach);
    setBrandColors(template.brandColors);
    setColorMood(template.colorMood);
    setVisualDirection(template.visualDirection);
    setUsage(template.usage);
    setAvoid(template.avoid);
    setPersonalities(template.personalities);
    setDescriptor(template.descriptor);
    setStrategy(null);
    setNotice(t(locale, "notice.templateLoaded", { name: template.label }));
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function generate() {
    if (!requireStudioAccess()) return;

    setIsGenerating(true);
    setNotice(t(locale, "notice.generating"));

    try {
      const response = await apiFetch("/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          brandName,
          coreIdea,
          personalities,
          industry,
          companyDescription,
          audience,
          positioning,
          competitors,
          colorApproach,
          brandColors,
          colorMood,
          logoType,
          visualDirection,
          usage,
          avoid,
          briefLocale: emailPrefs.briefLocale,
        }),
      });
      const payload = await readApiJson<{
        error?: string;
        code?: string;
        required?: number;
        generations?: GeneratedConcept[];
        failures?: string[];
        projectId?: string;
        strategy?: BrandStrategy;
      }>(response);

      if (response.status === 402 || payload.code === "INSUFFICIENT_SIGNALS") {
        setIsGenerating(false);
        handlePaymentRequired(payload.error, payload.required);
        void refreshStudioAccount();
        return;
      }

      if (!response.ok || !payload.projectId || !payload.generations?.length) {
        throw new Error(payload.error ?? t(locale, "notice.genFailed"));
      }
      void refreshStudioAccount();

      setGeneratedConcepts(payload.generations);
      setProjectId(payload.projectId);
      setStrategy(payload.strategy ?? null);
      setAssets([]);
      setSelectedRefinement("");
      setSelectedVector("");
      setProductionLocked(false);
      setSelectedConcept(payload.generations[0].directionKey);
      setSelectedConceptIds([]);
      setIsGenerating(false);
      setNotice(
        payload.failures?.length || payload.generations.length < 4
          ? t(locale, "notice.genPartial", {
              n: payload.generations.length,
            })
          : t(locale, "notice.genComplete"),
      );
      void auditDiversity(payload.generations);
      void loadHistory();
      document
        .getElementById("concepts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setIsGenerating(false);
      showRequestError(
        "Logo concepts",
        error instanceof Error
          ? error.message
          : t(locale, "notice.genFailed"),
      );
    }
  }

  async function generateMore() {
    if (!projectId || generatedConcepts.length >= 8) return;
    if (!requireStudioAccess()) return;
    setIsGeneratingMore(true);
    setNotice(t(locale, "notice.moreGenerating"));
    try {
      const response = await apiFetch("/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, actionId: crypto.randomUUID() }),
      });
      const payload = await readApiJson<{
        code?: string;
        required?: number;
        error?: string;
        generations?: GeneratedConcept[];
        failures?: string[];
      }>(response);
      if (response.status === 402 || payload.code === "INSUFFICIENT_SIGNALS") {
        handlePaymentRequired(payload.error, payload.required);
        void refreshStudioAccount();
        return;
      }
      if (!response.ok || !payload.generations?.length) {
        throw new Error(payload.error ?? t(locale, "notice.moreFailed"));
      }
      setGeneratedConcepts((current) => [...current, ...payload.generations!]);
      void auditDiversity([...generatedConcepts, ...payload.generations]);
      void refreshStudioAccount();
      setNotice(
        payload.failures?.length
          ? t(locale, "notice.moreFailedDetail", {
              detail: payload.failures[0],
            })
          : t(locale, "notice.moreReady"),
      );
    } catch (error) {
      showRequestError(
        "Additional study",
        error instanceof Error
          ? error.message
          : t(locale, "notice.moreFailed"),
      );
    } finally {
      setIsGeneratingMore(false);
    }
  }

  async function refineSelected() {
    if (!projectId || !selectedConceptIds.length) {
      setNotice(t(locale, "notice.selectBeforeRefine"));
      return;
    }
    const critiquesByGenerationId: Record<string, string> = {};
    for (const generationId of selectedConceptIds) {
      const failed = [...refinements]
        .reverse()
        .find(
          (asset) =>
            asset.parentId === generationId &&
            Boolean(asset.reviewReason) &&
            (asset.reviewStatus !== "Recommended" ||
              (asset.qualityScore ?? 0) < 75),
        );
      if (failed?.reviewReason) {
        critiquesByGenerationId[generationId] = failed.reviewReason;
      }
    }
    const isRetry = Object.keys(critiquesByGenerationId).length > 0;
    const previousAssets = assets;
    const previousRefinement = selectedRefinement;
    const previousVector = selectedVector;
    const previousLocked = productionLocked;

    // Clear and lock 04–05 immediately on Reduce click (restore if cancelled).
    setProductionLocked(true);
    setAssets([]);
    setSelectedRefinement("");
    setSelectedVector("");

    const refineCost = signalCosts?.refine ?? 2;
    if (!(await requestConfirmation({
      kicker: t(locale, "confirm.refine.kicker", { n: refineCost }),
      title: isRetry
        ? t(locale, "confirm.refine.retryTitle")
        : t(locale, "confirm.refine.title"),
      body: isRetry
        ? t(locale, "confirm.refine.retryBody", { n: refineCost })
        : t(locale, "confirm.refine.body", { n: refineCost }),
      confirmLabel: isRetry
        ? t(locale, "confirm.refine.retryCta")
        : t(locale, "confirm.refine.cta", { n: selectedConceptIds.length }),
    }))) {
      setAssets(previousAssets);
      setSelectedRefinement(previousRefinement);
      setSelectedVector(previousVector);
      setProductionLocked(previousLocked);
      return;
    }

    setIsRefining(true);
    setNotice(
      isRetry
        ? t(locale, "notice.retryingRefine")
        : t(locale, "notice.refining"),
    );
    document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const response = await apiFetch(`/projects/${projectId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationIds: selectedConceptIds,
          ...(isRetry ? { critiquesByGenerationId } : {}),
        }),
      });
      const payload = await readApiJson<{
        assets?: StudioAsset[];
        error?: string;
        code?: string;
        required?: number;
      }>(response);
      if (response.status === 402 || payload.code === "INSUFFICIENT_SIGNALS") {
        setAssets(previousAssets);
        setSelectedRefinement(previousRefinement);
        setSelectedVector(previousVector);
        setProductionLocked(previousLocked);
        handlePaymentRequired(payload.error, payload.required);
        void refreshStudioAccount();
        return;
      }
      if (!response.ok || !payload.assets?.length) {
        setAssets(previousAssets);
        setSelectedRefinement(previousRefinement);
        setSelectedVector(previousVector);
        setProductionLocked(previousLocked);
        showRequestError(
          t(locale, "prod.stage.refine"),
          payload.error ?? t(locale, "notice.refineFailed"),
        );
        return;
      }
      // New refine only — keep vectors/lockup/system closed until Reconstruct.
      setAssets(payload.assets);
      setSelectedRefinement(payload.assets[0].id);
      setSelectedVector("");
      setVectorSourceMode("refine");
      setNotice(
        t(locale, "notice.refineReady", { n: payload.assets.length }),
      );
      void loadHistory();
      void refreshStudioAccount();
    } catch (error) {
      setAssets(previousAssets);
      setSelectedRefinement(previousRefinement);
      setSelectedVector(previousVector);
      setProductionLocked(previousLocked);
      showRequestError(
        t(locale, "prod.stage.refine"),
        error instanceof Error
          ? error.message
          : t(locale, "notice.refineFailed"),
      );
    } finally {
      setIsRefining(false);
    }
  }

  async function vectorizeSelected() {
    if (!projectId || !canReconstruct) {
      setNotice(t(locale, "notice.selectBeforeVector"));
      return;
    }
    const useOriginal = preferOriginal && Boolean(vectorSourceGeneration);
    const sourceLabel = useOriginal
      ? vectorSourceGeneration!.directionTitle
      : selectedReduction!.label;
    const vectorCost = signalCosts?.vectorize ?? 1;
    if (!(await requestConfirmation({
      kicker: t(locale, "confirm.vector.kicker", { n: vectorCost }),
      title: useOriginal
        ? t(locale, "confirm.vector.originalTitle")
        : t(locale, "confirm.vector.title"),
      body: useOriginal
        ? t(locale, "confirm.vector.originalBody", { label: sourceLabel })
        : t(locale, "confirm.vector.body", { label: sourceLabel }),
      confirmLabel: t(locale, "confirm.vector.cta"),
    }))) return;
    setIsVectorizing(true);
    setNotice(
      useOriginal
        ? t(locale, "notice.tracingOriginal")
        : t(locale, "notice.tracingRefine"),
    );
    try {
      const response = await apiFetch(`/projects/${projectId}/vectorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useOriginal
            ? { generationId: vectorSourceGeneration!.id }
            : { assetId: selectedRefinement },
        ),
      });
      const payload = await readApiJson<{
        assets?: StudioAsset[];
        error?: string;
        code?: string;
        required?: number;
      }>(response);
      if (response.status === 402 || payload.code === "INSUFFICIENT_SIGNALS") {
        handlePaymentRequired(payload.error, payload.required);
        void refreshStudioAccount();
        return;
      }
      if (!response.ok || !payload.assets?.length) {
        showRequestError(
          "SVG reconstruction",
          payload.error ?? t(locale, "notice.vectorFailed"),
        );
        return;
      }
      setAssets((current) => [
        ...current.filter((asset) => asset.stage !== "vector"),
        ...payload.assets!,
      ]);
      setSelectedVector(payload.assets[0].id);
      setProductionLocked(false);
      setNotice(t(locale, "notice.svgReady"));
      void loadHistory();
      void refreshStudioAccount();
    } catch (error) {
      showRequestError(
        "SVG reconstruction",
        error instanceof Error
          ? error.message
          : t(locale, "notice.vectorFailed"),
      );
    } finally {
      setIsVectorizing(false);
    }
  }

  async function exportLockup(
    format: "svg" | "png" | "webp" = "svg",
    layout: "horizontal" | "vertical" | "icon" = lockupLayout,
    rasterSize?: number,
  ) {
    if (!projectId || !selectedVector) {
      setNotice(t(locale, "notice.chooseVectorExport"));
      return;
    }
    const requestKey = `${format}-${layout}-${rasterSize ?? "master"}`;
    setExportingKey(requestKey);
    try {
      // Compose on the client from the same sizes as the preview (WYSIWYG).
      const assetResponse = await apiFetch(`/assets/${selectedVector}`);
      if (!assetResponse.ok) {
        const payload = (await assetResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        showRequestError(
          "Asset export",
          payload?.error ?? t(locale, "notice.assetLoadFailed"),
        );
        return;
      }
      const markSvg = await assetResponse.text();
      const svg = buildLockupSvg({
        brandName: wordmarkName || brandName,
        color: lockupColor,
        descriptor,
        layout,
        markScale,
        markSvg,
        wordmarkCase,
        wordmarkSize,
        descriptorSize,
        wordmarkWeight,
        wordmarkTracking,
        wordmarkStyle,
      });
      const svgBlob = new Blob([svg], { type: "image/svg+xml" });
      let blob: Blob = svgBlob;
      if (format !== "svg") {
        const sourceUrl = URL.createObjectURL(svgBlob);
        const image = new Image();
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () =>
            reject(new Error("Could not render the SVG export."));
          image.src = sourceUrl;
        });
        const canvas = document.createElement("canvas");
        canvas.width = rasterSize ?? image.naturalWidth;
        canvas.height = rasterSize ?? image.naturalHeight;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas export is unavailable.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(sourceUrl);
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (result) =>
              result
                ? resolve(result)
                : reject(new Error("Raster export failed.")),
            format === "png" ? "image/png" : "image/webp",
            0.96,
          ),
        );
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${brandName}-${layout}${rasterSize ? `-${rasterSize}` : ""}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice(
        t(locale, "notice.exportDownloaded", {
          format: format.toUpperCase(),
        }),
      );
    } catch (error) {
      showRequestError(
        "Asset export",
        error instanceof Error
          ? error.message
          : t(locale, "notice.exportFailed"),
      );
    } finally {
      setExportingKey("");
    }
  }

  function printBrandGuide() {
    if (!projectId || !selectedVector) {
      setNotice(t(locale, "notice.chooseVectorGuide"));
      return;
    }
    window.open(
      apiUrl(
        `/projects/${projectId}/brand-guide?assetId=${encodeURIComponent(selectedVector)}&color=${encodeURIComponent(lockupColor)}&descriptor=${encodeURIComponent(descriptor)}&name=${encodeURIComponent(wordmarkName || brandName)}`,
      ),
      "_blank",
      "noopener,noreferrer",
    );
    setNotice(t(locale, "notice.guideOpened"));
  }

  async function deleteConcept(generation: GeneratedConcept) {
    const confirmed = await requestConfirmation({
      kicker: t(locale, "confirm.deleteConcept.kicker"),
      title: t(locale, "confirm.deleteConcept.title", {
        title: generation.directionTitle,
      }),
      body: t(locale, "confirm.deleteConcept.body"),
      confirmLabel: t(locale, "confirm.deleteConcept.cta"),
      tone: "danger",
    });
    if (!confirmed) return;

    const response = await apiFetch(`/images/${generation.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      showRequestError(
        t(locale, "confirm.deleteConcept.cta"),
        payload?.error ?? "Concept could not be deleted.",
      );
      return;
    }

    setGeneratedConcepts((current) =>
      current.filter((item) => item.id !== generation.id),
    );
    setSelectedConceptIds((current) =>
      current.filter((id) => id !== generation.id),
    );
    setNotice(t(locale, "notice.conceptDeleted"));
  }

  async function deleteAsset(asset: StudioAsset) {
    const confirmed = await requestConfirmation({
      kicker: t(locale, "confirm.deleteSvg.kicker"),
      title: t(locale, "confirm.deleteSvg.title", { label: asset.label }),
      body: t(locale, "confirm.deleteSvg.body"),
      confirmLabel: t(locale, "confirm.deleteSvg.cta"),
      tone: "danger",
    });
    if (!confirmed) return;

    const response = await apiFetch(`/assets/${asset.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      showRequestError(
        t(locale, "confirm.deleteSvg.cta"),
        payload?.error ?? "SVG could not be deleted.",
      );
      return;
    }

    const remaining = assets.filter((item) => item.id !== asset.id);
    const remainingVectors = remaining.filter((item) => item.stage === "vector");
    setAssets(remaining);
    if (selectedVector === asset.id) {
      setSelectedVector(remainingVectors[0]?.id ?? "");
      if (!remainingVectors.length) setProductionLocked(false);
    }
    if (selectedRefinement === asset.id) {
      const remainingRefines = remaining.filter((item) => item.stage === "refine");
      setSelectedRefinement(remainingRefines[0]?.id ?? "");
    }
    setNotice(t(locale, "notice.assetDeleted", { label: asset.label }));
  }

  async function selectGeneratedConcept(generationId: string) {
    const generation = generatedConcepts.find((item) => item.id === generationId);
    if (!generation || !projectId) return;
    setSelectedConcept(generation.directionKey);
    const alreadySelected = selectedConceptIds.includes(generation.id);
    if (alreadySelected) {
      setSelectedConceptIds([]);
      setNotice(
        t(locale, "notice.removedFromShortlist", {
          title: generation.directionTitle,
        }),
      );
      return;
    }
    setSelectedConceptIds([generation.id]);

    const response = await apiFetch(`/projects/${projectId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: generation.id }),
    });

    setNotice(
      response.ok
        ? t(locale, "notice.selectedForRefine", {
            title: generation.directionTitle,
          })
        : t(locale, "notice.selectLocalOnly"),
    );
  }

  async function auditDiversity(items: GeneratedConcept[]) {
    if (items.length < 2) return;
    try {
      const hashes = await Promise.all(
        items.map(
          (item) =>
            new Promise<string>((resolve, reject) => {
              const image = new Image();
              image.crossOrigin = "anonymous";
              image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 16;
                canvas.height = 16;
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (!context) return reject(new Error("Canvas unavailable"));
                context.drawImage(image, 0, 0, 16, 16);
                const pixels = context.getImageData(0, 0, 16, 16).data;
                const values = Array.from({ length: 256 }, (_, index) => {
                  const offset = index * 4;
                  return (
                    pixels[offset] * 0.299 +
                    pixels[offset + 1] * 0.587 +
                    pixels[offset + 2] * 0.114
                  );
                });
                const average =
                  values.reduce((sum, value) => sum + value, 0) / values.length;
                resolve(values.map((value) => (value >= average ? "1" : "0")).join(""));
              };
              image.onerror = reject;
              image.src = resolveMediaUrl(item.imageUrl);
            }),
        ),
      );
      let closest = 256;
      for (let left = 0; left < hashes.length; left += 1) {
        for (let right = left + 1; right < hashes.length; right += 1) {
          let distance = 0;
          for (let bit = 0; bit < hashes[left].length; bit += 1) {
            if (hashes[left][bit] !== hashes[right][bit]) distance += 1;
          }
          closest = Math.min(closest, distance);
        }
      }
      setDiversityWarning(
        closest < 28 ? t(locale, "concepts.diversity.warn") : "",
      );
    } catch {
      setDiversityWarning(t(locale, "concepts.diversity.unavailable"));
    }
  }

  return (
    <main>
      {isMethodOpen && (
        <div
          className="method-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setIsMethodOpen(false);
          }}
        >
          <article
            className="method-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="method-title"
          >
            <header>
              <a href="#top" onClick={() => setIsMethodOpen(false)}>LOOPEN®</a>
              <span>{t(locale, "method.index")}</span>
              <button type="button" onClick={() => setIsMethodOpen(false)}>
                {t(locale, "method.close")} <i>×</i>
              </button>
            </header>
            <div className="method-intro">
              <p>{t(locale, "method.pov")}</p>
              <h2 id="method-title">
                {t(locale, "method.title.1")}
                <br />
                <em>{t(locale, "method.title.2")}</em>
              </h2>
              <p>{t(locale, "method.intro")}</p>
            </div>
            <div className="method-steps">
              {(
                [
                  ["01", "method.step01"],
                  ["02", "method.step02"],
                  ["03", "method.step03"],
                  ["04", "method.step04"],
                  ["05", "method.step05"],
                ] as const
              ).map(([number, stepKey]) => (
                <section key={number}>
                  <span>{number}</span>
                  <h3>{t(locale, `${stepKey}.title`)}</h3>
                  <p>{t(locale, `${stepKey}.body`)}</p>
                  <b>{t(locale, `${stepKey}.owner`)}</b>
                </section>
              ))}
            </div>
            <footer>
              <blockquote>
                {t(locale, "manifesto.quote.1")}{" "}
                <em>{t(locale, "manifesto.quote.2")}</em>{" "}
                {t(locale, "manifesto.quote.3")}
              </blockquote>
              <button type="button" onClick={() => {
                setIsMethodOpen(false);
                document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
              }}>
                {t(locale, "method.cta")} <span>↘</span>
              </button>
            </footer>
          </article>
        </div>
      )}
      {confirmDialog && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) resolveConfirmation(false);
          }}
        >
          <section
            className={`confirm-dialog ${confirmDialog.tone === "danger" ? "danger" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="confirm-dialog-index">↘</div>
            <p>{confirmDialog.kicker}</p>
            <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
            <div className="confirm-dialog-copy">
              <span>{t(locale, "confirm.decision")}</span>
              <p>{confirmDialog.body}</p>
            </div>
            <div className="confirm-dialog-actions">
              {confirmDialog.dismissOnly ? (
                <button
                  type="button"
                  className="confirm-dialog-primary"
                  onClick={() => resolveConfirmation(false)}
                >
                  {confirmDialog.confirmLabel} <span>↘</span>
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => resolveConfirmation(false)}>
                    {t(locale, "confirm.keepExploring")}
                  </button>
                  <button
                    type="button"
                    className="confirm-dialog-primary"
                    onClick={() => resolveConfirmation(true)}
                  >
                    {confirmDialog.confirmLabel} <span>→</span>
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}
      <header className="site-header">
        <a
          className="wordmark"
          href="#top"
          aria-label={`LOOPEN — ${t(locale, "nav.homeAria")}`}
        >
          <span className="wordmark-glyph" aria-hidden="true">
            ∞
          </span>
          LOOPEN
        </a>
        <nav className="top-nav" aria-label={t(locale, "nav.mainAria")}>
          <a href="#brief">{t(locale, "nav.studio")}</a>
          <a href="#concepts">{t(locale, "nav.concepts")}</a>
          <button type="button" onClick={() => setIsMethodOpen(true)}>
            {t(locale, "nav.method")}
          </button>
          <a href="#manifesto">{t(locale, "nav.about")}</a>
        </nav>
        <div className="header-actions">
          <button
            className="session-reset"
            type="button"
            onClick={() => void resetStudioToFresh()}
          >
            {t(locale, "nav.newSession")}
          </button>
          {hasWorkspace && (
            <button
              className="signal-pill"
              type="button"
              onClick={() => setIsSignalsOpen(true)}
              title={t(locale, "nav.signalsTitle")}
            >
              <span className="signal-orb" aria-hidden="true" />
              {signalBalance === null
                ? t(locale, "nav.signals")
                : t(locale, "nav.signalsCount", { n: signalBalance })}
            </button>
          )}
          {isGuestSession && (
            <button
              className="project-pill enter-pill"
              type="button"
              onClick={() =>
                openAuthGate(
                  "signin",
                  t(locale, "auth.signin.copy"),
                )
              }
              title={t(locale, "nav.enter")}
            >
              <span className="online-dot" />
              {t(locale, "nav.enter")}
            </button>
          )}
          {hasWorkspace && (
            <button
              className="project-pill"
              type="button"
              onClick={() => {
                if (isHistoryOpen) setIsHistoryOpen(false);
                else openWorkspace("projects");
              }}
              title={t(locale, "workspace.private")}
            >
              <span className="online-dot" />
              {`${projects.length} ${t(locale, "nav.projects")}`}
            </button>
          )}
        </div>
      </header>
      {isAuthOpen && (
        <div
          className="studio-gate-backdrop"
          role="presentation"
          onClick={() => setIsAuthOpen(false)}
        >
          <section
            className="studio-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-gate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="studio-gate-index">∞</p>
            <p>
              {authMode === "signup"
                ? t(locale, "auth.signup.kicker")
                : authMode === "confirm"
                  ? t(locale, "auth.confirm.kicker")
                  : authMode === "forgot"
                    ? t(locale, "auth.forgot.kicker")
                    : authMode === "reset"
                      ? t(locale, "auth.reset.kicker")
                      : t(locale, "auth.signin.kicker")}
            </p>
            <h2 id="studio-gate-title">
              {authMode === "signup" ? (
                <>
                  {t(locale, "auth.signup.title.1")}
                  <em> {t(locale, "auth.signup.title.2")}</em>
                </>
              ) : authMode === "confirm" ? (
                <>
                  {t(locale, "auth.confirm.title.1")}
                  <em> {t(locale, "auth.confirm.title.2")}</em>
                </>
              ) : authMode === "forgot" ? (
                <>
                  {t(locale, "auth.forgot.title.1")}
                  <em> {t(locale, "auth.forgot.title.2")}</em>
                </>
              ) : authMode === "reset" ? (
                <>
                  {t(locale, "auth.reset.title.1")}
                  <em> {t(locale, "auth.reset.title.2")}</em>
                </>
              ) : (
                <>
                  {t(locale, "auth.signin.title.1")}
                  <em> {t(locale, "auth.signin.title.2")}</em>
                </>
              )}
            </h2>
            <div className="studio-gate-copy">
              <span>{t(locale, "auth.how")}</span>
              <p>
                {authMode === "signup"
                  ? t(locale, "auth.signup.copy")
                  : authMode === "confirm"
                    ? t(locale, "auth.confirm.copy")
                    : authMode === "forgot"
                      ? t(locale, "auth.forgot.copy")
                      : authMode === "reset"
                        ? t(locale, "auth.reset.copy")
                        : t(locale, "auth.signin.copy")}
              </p>
            </div>
            <form
              className="studio-gate-form"
              onSubmit={submitAuthForm}
              noValidate
              // Kill leftover browser constraint bubbles if any field gets a
              // required/pattern attribute from autocomplete tooling.
              onInvalid={suppressNativeAuthValidation}
            >
              {authMode === "signup" && (
                <div className="studio-gate-name-row">
                  <label
                    className={`studio-gate-field${showAuthFieldError("firstName") ? " is-invalid" : ""}`}
                    htmlFor="studio-auth-first-name"
                  >
                    <span className="mini-label">
                      {t(locale, "auth.firstName")}{" "}
                      <span className="req-mark" aria-hidden="true">*</span>
                    </span>
                    <input
                      id="studio-auth-first-name"
                      type="text"
                      autoComplete="given-name"
                      placeholder="Ada"
                      value={authFirstName}
                      onChange={(event) =>
                        updateAuthField("firstName", event.target.value)
                      }
                      onBlur={() => blurAuthField("firstName")}
                      onInvalid={suppressNativeAuthValidation}
                      maxLength={80}
                      aria-invalid={Boolean(showAuthFieldError("firstName"))}
                      aria-describedby={
                        showAuthFieldError("firstName")
                          ? "studio-auth-first-name-error"
                          : undefined
                      }
                    />
                    {showAuthFieldError("firstName") && (
                      <span
                        className="studio-gate-field-error"
                        id="studio-auth-first-name-error"
                        role="alert"
                      >
                        {showAuthFieldError("firstName")}
                      </span>
                    )}
                  </label>
                  <label
                    className={`studio-gate-field${showAuthFieldError("lastName") ? " is-invalid" : ""}`}
                    htmlFor="studio-auth-last-name"
                  >
                    <span className="mini-label">
                      {t(locale, "auth.lastName")}{" "}
                      <span className="req-mark" aria-hidden="true">*</span>
                    </span>
                    <input
                      id="studio-auth-last-name"
                      type="text"
                      autoComplete="family-name"
                      placeholder="Lovelace"
                      value={authLastName}
                      onChange={(event) =>
                        updateAuthField("lastName", event.target.value)
                      }
                      onBlur={() => blurAuthField("lastName")}
                      onInvalid={suppressNativeAuthValidation}
                      maxLength={80}
                      aria-invalid={Boolean(showAuthFieldError("lastName"))}
                      aria-describedby={
                        showAuthFieldError("lastName")
                          ? "studio-auth-last-name-error"
                          : undefined
                      }
                    />
                    {showAuthFieldError("lastName") && (
                      <span
                        className="studio-gate-field-error"
                        id="studio-auth-last-name-error"
                        role="alert"
                      >
                        {showAuthFieldError("lastName")}
                      </span>
                    )}
                  </label>
                </div>
              )}
              {authMode !== "reset" && (
                <label
                  className={`studio-gate-field${showAuthFieldError("email") ? " is-invalid" : ""}`}
                  htmlFor="studio-auth-email"
                >
                  <span className="mini-label">
                    {t(locale, "auth.email")}{" "}
                    <span className="req-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    id="studio-auth-email"
                    type="text"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t(locale, "auth.placeholder.email")}
                    value={authEmail}
                    onChange={(event) =>
                      updateAuthField("email", event.target.value)
                    }
                    onBlur={() => blurAuthField("email")}
                    onInvalid={suppressNativeAuthValidation}
                    readOnly={authMode === "confirm"}
                    aria-invalid={Boolean(showAuthFieldError("email"))}
                    aria-describedby={
                      showAuthFieldError("email")
                        ? "studio-auth-email-error"
                        : undefined
                    }
                  />
                  {showAuthFieldError("email") && (
                    <span
                      className="studio-gate-field-error"
                      id="studio-auth-email-error"
                      role="alert"
                    >
                      {showAuthFieldError("email")}
                    </span>
                  )}
                </label>
              )}
              {authMode !== "forgot" && authMode !== "confirm" && (
                <label
                  className={`studio-gate-field${showAuthFieldError("password") ? " is-invalid" : ""}`}
                  htmlFor="studio-auth-password"
                >
                  <span className="mini-label">
                    {authMode === "reset"
                      ? t(locale, "auth.newPassword")
                      : t(locale, "auth.password")}{" "}
                    <span className="req-mark" aria-hidden="true">*</span>
                  </span>
                  <div
                    className={`studio-gate-password${authMode === "signin" ? " has-toggle" : ""}`}
                  >
                    <input
                      id="studio-auth-password"
                      type={
                        authMode === "signin" && authPasswordVisible
                          ? "text"
                          : "password"
                      }
                      autoComplete={
                        authMode === "signin"
                          ? "current-password"
                          : "new-password"
                      }
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(event) =>
                        updateAuthField("password", event.target.value)
                      }
                      onBlur={() => blurAuthField("password")}
                      onInvalid={suppressNativeAuthValidation}
                      aria-invalid={Boolean(showAuthFieldError("password"))}
                      aria-describedby={
                        showAuthFieldError("password")
                          ? "studio-auth-password-error"
                          : authMode === "signup" || authMode === "reset"
                            ? "studio-auth-password-hint"
                            : undefined
                      }
                    />
                    {authMode === "signin" && authPassword.length > 0 && (
                      <button
                        type="button"
                        className="studio-gate-password-toggle"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setAuthPasswordVisible(true);
                        }}
                        onPointerUp={() => setAuthPasswordVisible(false)}
                        onPointerLeave={() => setAuthPasswordVisible(false)}
                        onPointerCancel={() => setAuthPasswordVisible(false)}
                        onBlur={() => setAuthPasswordVisible(false)}
                        onContextMenu={(event) => event.preventDefault()}
                        aria-label={t(locale, "auth.showPasswordAria")}
                        tabIndex={0}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="18"
                          height="18"
                          aria-hidden="true"
                        >
                          {authPasswordVisible ? (
                            <>
                              <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                d="M3.5 3.5l17 17"
                              />
                              <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9M7.1 7.3C5.2 8.4 3.7 10 2.8 12c1.8 4 5.3 6.5 9.2 6.5 1.5 0 2.9-.4 4.2-1.1M10.6 5.3A10.4 10.4 0 0 1 12 5.5c3.9 0 7.4 2.5 9.2 6.5-.6 1.3-1.5 2.5-2.6 3.4"
                              />
                            </>
                          ) : (
                            <>
                              <path
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.8 12C4.6 8 8.1 5.5 12 5.5S19.4 8 21.2 12c-1.8 4-5.3 6.5-9.2 6.5S4.6 16 2.8 12Z"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                              />
                            </>
                          )}
                        </svg>
                      </button>
                    )}
                  </div>
                  {(authMode === "signup" || authMode === "reset") &&
                    !showAuthFieldError("password") && (
                      <span
                        className="studio-gate-field-hint"
                        id="studio-auth-password-hint"
                      >
                        {t(locale, "auth.passwordHint")}
                      </span>
                    )}
                  {showAuthFieldError("password") && (
                    <span
                      className="studio-gate-field-error"
                      id="studio-auth-password-error"
                      role="alert"
                    >
                      {showAuthFieldError("password")}
                    </span>
                  )}
                </label>
              )}
              {(authMode === "signup" || authMode === "reset") && (
                <label
                  className={`studio-gate-field${showAuthFieldError("passwordConfirm") ? " is-invalid" : ""}`}
                  htmlFor="studio-auth-password-confirm"
                >
                  <span className="mini-label">
                    {t(locale, "auth.confirmPassword")}{" "}
                    <span className="req-mark" aria-hidden="true">*</span>
                  </span>
                  <input
                    id="studio-auth-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={authPasswordConfirm}
                    onChange={(event) =>
                      updateAuthField("passwordConfirm", event.target.value)
                    }
                    onBlur={() => blurAuthField("passwordConfirm")}
                    onInvalid={suppressNativeAuthValidation}
                    aria-invalid={Boolean(
                      showAuthFieldError("passwordConfirm"),
                    )}
                    aria-describedby={
                      showAuthFieldError("passwordConfirm")
                        ? "studio-auth-password-confirm-error"
                        : undefined
                    }
                  />
                  {showAuthFieldError("passwordConfirm") && (
                    <span
                      className="studio-gate-field-error"
                      id="studio-auth-password-confirm-error"
                      role="alert"
                    >
                      {showAuthFieldError("passwordConfirm")}
                    </span>
                  )}
                </label>
              )}
              <div className="studio-gate-actions">
                <button type="button" onClick={() => setIsAuthOpen(false)}>
                  {t(locale, "auth.notNow")}
                </button>
                {authMode === "confirm" ? (
                  <button
                    className="confirm-dialog-primary"
                    type="button"
                    disabled={Boolean(authSending) || authResendWaitSec > 0}
                    onClick={() => void resendConfirmationEmail()}
                  >
                    {authSending === "resend"
                      ? t(locale, "auth.sending")
                      : authResendWaitSec > 0
                        ? t(locale, "auth.resendIn", { n: authResendWaitSec })
                        : t(locale, "auth.resend")}
                    <span>↗</span>
                  </button>
                ) : (
                  <button
                    className="confirm-dialog-primary"
                    type="submit"
                    formNoValidate
                    disabled={Boolean(authSending)}
                  >
                    {authSending === "signin"
                      ? t(locale, "auth.signingIn")
                      : authSending === "signup"
                        ? t(locale, "auth.creating")
                        : authSending === "forgot"
                          ? t(locale, "auth.sending")
                          : authSending === "reset"
                            ? t(locale, "auth.saving")
                            : authMode === "signup"
                              ? t(locale, "auth.create")
                              : authMode === "forgot"
                                ? t(locale, "auth.sendReset")
                                : authMode === "reset"
                                  ? t(locale, "auth.savePassword")
                                  : t(locale, "auth.enter")}
                    <span>→</span>
                  </button>
                )}
              </div>
              <div className="studio-gate-switch">
                {authMode === "signin" && (
                  <>
                    <button
                      type="button"
                      onClick={() => openAuthGate("signup")}
                      disabled={Boolean(authSending)}
                    >
                      {t(locale, "auth.createAccount")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openAuthGate("forgot")}
                      disabled={Boolean(authSending)}
                    >
                      {t(locale, "auth.forgotPassword")}
                    </button>
                  </>
                )}
                {authMode === "signup" && (
                  <button
                    type="button"
                    onClick={() => openAuthGate("signin")}
                    disabled={Boolean(authSending)}
                  >
                    {t(locale, "auth.haveAccount")}
                  </button>
                )}
                {authMode === "confirm" && (
                  <button
                    type="button"
                    onClick={() =>
                      openAuthGate(
                        "signin",
                        t(locale, "auth.confirm.copy"),
                      )
                    }
                    disabled={Boolean(authSending)}
                  >
                    {t(locale, "auth.confirmedSignIn")}
                  </button>
                )}
                {(authMode === "forgot" || authMode === "reset") && (
                  <button
                    type="button"
                    onClick={() => openAuthGate("signin")}
                    disabled={Boolean(authSending)}
                  >
                    {t(locale, "auth.backSignIn")}
                  </button>
                )}
              </div>
            </form>
            {authStatus && <p className="studio-gate-status">{authStatus}</p>}
            <p className="studio-gate-note">
              {t(locale, "auth.welcomeNote", {
                n: signalCosts?.generateBatch ?? 4,
              })}
            </p>
          </section>
        </div>
      )}
      {isSignalsOpen && (
        <div className="studio-gate-backdrop" role="presentation" onClick={() => setIsSignalsOpen(false)}>
          <section
            className="signal-vault"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signal-vault-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="signal-vault-head">
              <p>{t(locale, "signals.vault")}</p>
              <button
                type="button"
                onClick={() => setIsSignalsOpen(false)}
                aria-label={t(locale, "signals.closeAria")}
              >
                ×
              </button>
            </div>
            <h2 id="signal-vault-title">
              {t(locale, "signals.title.1")}
              <em> {t(locale, "signals.title.2")}</em>
            </h2>
            <p className="signal-vault-balance">
              <strong>{signalBalance ?? "—"}</strong>
              <span>{t(locale, "signals.onHand")}</span>
            </p>
            <ul className="signal-cost-list">
              <li><span>{t(locale, "signals.cost.batch")}</span><b>{signalCosts?.generateBatch ?? 4}</b></li>
              <li><span>{t(locale, "signals.cost.extra")}</span><b>{signalCosts?.extraConcept ?? 1}</b></li>
              <li><span>{t(locale, "signals.cost.refine")}</span><b>{signalCosts?.refine ?? 2}</b></li>
              <li><span>{t(locale, "signals.cost.vector")}</span><b>{signalCosts?.vectorize ?? 1}</b></li>
            </ul>
            <div className="signal-pack-grid">
              {(signalPacks.length
                ? signalPacks
                : [
                    {
                      id: "spark",
                      label: "Spark",
                      signals: 12,
                      priceUsd: 14,
                      blurb: t(locale, "signals.pack.sparkBlurb"),
                    },
                    {
                      id: "studio",
                      label: "Studio",
                      signals: 40,
                      priceUsd: 39,
                      blurb: t(locale, "signals.pack.studioBlurb"),
                    },
                    {
                      id: "atelier",
                      label: "Atelier",
                      signals: 120,
                      priceUsd: 99,
                      blurb: t(locale, "signals.pack.atelierBlurb"),
                    },
                  ]
              ).map((pack) => (
                <article className="signal-pack" key={pack.id}>
                  <span>{pack.label}</span>
                  <strong>{pack.signals}</strong>
                  <small>{t(locale, "signals.unit")}</small>
                  <p>{pack.blurb}</p>
                  <button
                    type="button"
                    disabled={!billingEnabled || checkoutPackId === pack.id || !user}
                    onClick={() => void startSignalCheckout(pack.id)}
                  >
                    {!user
                      ? t(locale, "signals.enterFirst")
                      : !billingEnabled
                        ? t(locale, "signals.billingSoon")
                        : checkoutPackId === pack.id
                          ? t(locale, "signals.redirecting")
                          : `$${pack.priceUsd}`}
                  </button>
                </article>
              ))}
            </div>
            {!billingEnabled && (
              <p className="signal-vault-note">
                {t(locale, "signals.stripeNote")}
              </p>
            )}
          </section>
        </div>
      )}
      {openingProjectName && (
        <div
          className="project-open-backdrop"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <section className="project-open-card">
            <span className="project-open-orbit" aria-hidden="true">
              <i />
              <b>∞</b>
            </span>
            <p>{t(locale, "projectOpen.kicker")}</p>
            <h2>
              {t(locale, "projectOpen.title.1")}
              <em> {t(locale, "projectOpen.title.2")}</em>
            </h2>
            <strong>{openingProjectName}</strong>
            <div className="project-open-meta">
              <span>{t(locale, "projectOpen.stage")}</span>
              <p>{t(locale, "projectOpen.body")}</p>
            </div>
          </section>
        </div>
      )}
      {user && isHistoryOpen && (
        <aside className="history-drawer" aria-label={t(locale, "workspace.private")}>
          <div className="history-head">
            <div>
              <span>
                {isAdmin
                  ? t(locale, "workspace.admin")
                  : role === "user"
                    ? t(locale, "workspace.private")
                    : t(locale, "workspace.guest")}
              </span>
              <strong>{user.displayName}</strong>
              <small className="history-email">
                {user.email}
                {role !== "guest" ? ` · ${role}` : ""}
              </small>
            </div>
            <button
              type="button"
              onClick={() => setIsHistoryOpen(false)}
              aria-label={t(locale, "workspace.closeAria")}
            >
              ×
            </button>
          </div>

          <div className="history-account-row">
            <button type="button" onClick={() => setIsSignalsOpen(true)}>
              {signalBalance === null
                ? t(locale, "nav.signals")
                : t(locale, "nav.signalsCount", { n: signalBalance })}{" "}
              ↗
            </button>
            <button type="button" onClick={leaveStudio}>
              {t(locale, "workspace.leave")}
            </button>
          </div>

          <div
            className="workspace-tabs"
            role="tablist"
            aria-label={t(locale, "workspace.tabsAria")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={workspacePane === "projects"}
              className={workspacePane === "projects" ? "is-active" : ""}
              onClick={() => setWorkspacePane("projects")}
            >
              {t(locale, "workspace.projects")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={workspacePane === "account"}
              className={workspacePane === "account" ? "is-active" : ""}
              onClick={() => {
                setWorkspacePane("account");
                // Names only — never rehydrate prefs from the SSR `user` prop
                // (it is stale after an in-session language / email prefs save).
                setProfileFirstName(user.firstName ?? profileFirstName);
                setProfileLastName(user.lastName ?? profileLastName);
              }}
            >
              {t(locale, "workspace.account")}
            </button>
          </div>

          {workspacePane === "projects" ? (
            <>
              <div className="history-list" ref={historyListRef}>
                {projects.length ? (
                  <>
                    <button
                      type="button"
                      className="workspace-new-project"
                      onClick={() => void startNewProjectFromWorkspace()}
                    >
                      {t(locale, "workspace.newProject")} <span>→</span>
                    </button>
                    {projects.map((project) => (
                      <div className="history-project" key={project.id}>
                        <button
                          className="history-open"
                          type="button"
                          onClick={() =>
                            void openProject(project.id, project.brandName)
                          }
                          disabled={Boolean(openingProjectName)}
                        >
                          <span>
                            {new Date(project.createdAt).toLocaleString(locale, {
                              day: "numeric",
                              month: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <strong>{project.brandName}</strong>
                          <small>{project.status}</small>
                        </button>
                        <button
                          className="history-delete"
                          type="button"
                          onClick={() => deleteProject(project)}
                          disabled={deletingProjectId === project.id}
                          aria-label={t(locale, "workspace.deleteProjectAria", {
                            name: project.brandName,
                          })}
                          title={t(locale, "workspace.deleteProjectTitle")}
                        >
                          {deletingProjectId === project.id ? (
                            <RequestDrop
                              label={t(locale, "workspace.deletingProject")}
                            />
                          ) : (
                            "×"
                          )}
                        </button>
                      </div>
                    ))}
                  </>
                ) : (
                  <div className="workspace-empty">
                    <p className="workspace-empty-kicker">
                      {t(locale, "workspace.empty.kicker")}
                    </p>
                    <h3>{t(locale, "workspace.empty.title")}</h3>
                    <p>{t(locale, "workspace.empty.body")}</p>
                    <button
                      type="button"
                      className="workspace-empty-cta"
                      onClick={startBriefFromWorkspace}
                    >
                      {t(locale, "workspace.empty.cta")} <span>↘</span>
                    </button>
                  </div>
                )}
              </div>
              {projects.length > 3 && (
                <div
                  className="history-scroll-controls"
                  aria-label={t(locale, "workspace.scrollHistoryAria")}
                >
                  <button
                    type="button"
                    onClick={() => scrollProjectHistory(-1)}
                    aria-label={t(locale, "workspace.scrollUpAria")}
                  >
                    ↑
                  </button>
                  <span>{t(locale, "workspace.browse")}</span>
                  <button
                    type="button"
                    onClick={() => scrollProjectHistory(1)}
                    aria-label={t(locale, "workspace.scrollDownAria")}
                  >
                    ↓
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="workspace-account">
              {(
                [
                  ["profile", "workspace.editName"],
                  ["password", "workspace.changePassword"],
                  ["locale", "workspace.briefLanguage"],
                  ["email", "workspace.emailPrefs"],
                  ["billing", "workspace.billing"],
                  ["team", "workspace.team"],
                  ["support", "workspace.support"],
                  ["delete", "workspace.delete"],
                ] as const
              ).map(([id, labelKey]) => (
                <section key={id} className="workspace-acc-block">
                  <button
                    type="button"
                    className={`workspace-acc-trigger${accountSection === id ? " is-open" : ""}`}
                    onClick={() => {
                      const next = accountSection === id ? null : id;
                      setAccountSection(next);
                      if (next === "billing") void loadBillingHistory();
                    }}
                    aria-expanded={accountSection === id}
                  >
                    <span>{t(locale, labelKey)}</span>
                    <b>{accountSection === id ? "−" : "+"}</b>
                  </button>

                  {accountSection === id && id === "profile" && (
                    <form
                      className="workspace-acc-panel"
                      onSubmit={saveProfileName}
                    >
                      <label>
                        <span>{t(locale, "field.firstName")}</span>
                        <input
                          value={profileFirstName}
                          onChange={(event) =>
                            setProfileFirstName(event.target.value)
                          }
                          maxLength={80}
                          required
                        />
                      </label>
                      <label>
                        <span>{t(locale, "field.lastName")}</span>
                        <input
                          value={profileLastName}
                          onChange={(event) =>
                            setProfileLastName(event.target.value)
                          }
                          maxLength={80}
                          required
                        />
                      </label>
                      <button type="submit" disabled={profileSaving}>
                        {profileSaving
                          ? t(locale, "workspace.profile.saving")
                          : t(locale, "workspace.profile.save")}
                      </button>
                      {profileStatus && <p>{profileStatus}</p>}
                    </form>
                  )}

                  {accountSection === id && id === "password" && (
                    <form
                      className="workspace-acc-panel"
                      onSubmit={saveAccountPassword}
                    >
                      {user.source === "local" ? (
                        <p>{t(locale, "workspace.password.localOnly")}</p>
                      ) : (
                        <>
                          <label>
                            <span>{t(locale, "workspace.password.current")}</span>
                            <input
                              type="password"
                              autoComplete="current-password"
                              value={passwordCurrent}
                              onChange={(event) =>
                                setPasswordCurrent(event.target.value)
                              }
                              required
                            />
                          </label>
                          <label>
                            <span>{t(locale, "workspace.password.new")}</span>
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={passwordNext}
                              onChange={(event) =>
                                setPasswordNext(event.target.value)
                              }
                              required
                            />
                          </label>
                          <label>
                            <span>{t(locale, "workspace.password.confirm")}</span>
                            <input
                              type="password"
                              autoComplete="new-password"
                              value={passwordNextConfirm}
                              onChange={(event) =>
                                setPasswordNextConfirm(event.target.value)
                              }
                              required
                            />
                          </label>
                          <button type="submit" disabled={passwordSaving}>
                            {passwordSaving
                              ? t(locale, "workspace.password.updating")
                              : t(locale, "workspace.password.update")}
                          </button>
                          {passwordStatus && <p>{passwordStatus}</p>}
                        </>
                      )}
                    </form>
                  )}

                  {accountSection === id && id === "locale" && (
                    <div className="workspace-acc-panel workspace-locale-panel">
                      <p>{t(locale, "workspace.locale.help")}</p>
                      <CreativeSelect
                        label={t(locale, "workspace.locale.label")}
                        value={emailPrefs.briefLocale}
                        options={BRIEF_LOCALE_OPTIONS}
                        onChange={(value) => {
                          if (localeSaving) return;
                          void saveBriefLocale(value as BriefLocale);
                        }}
                      />
                      {localeStatus && <p>{localeStatus}</p>}
                    </div>
                  )}

                  {accountSection === id && id === "email" && (
                    <div className="workspace-acc-panel">
                      <label className="workspace-toggle">
                        <input
                          type="checkbox"
                          checked={emailPrefs.productUpdates}
                          disabled={prefsSaving}
                          onChange={(event) =>
                            void saveEmailPrefs({
                              ...emailPrefs,
                              productUpdates: event.target.checked,
                            })
                          }
                        />
                        <span>{t(locale, "workspace.email.productUpdates")}</span>
                      </label>
                      <label className="workspace-toggle">
                        <input
                          type="checkbox"
                          checked={emailPrefs.signalReceipts}
                          disabled={prefsSaving}
                          onChange={(event) =>
                            void saveEmailPrefs({
                              ...emailPrefs,
                              signalReceipts: event.target.checked,
                            })
                          }
                        />
                        <span>{t(locale, "workspace.email.signalReceipts")}</span>
                      </label>
                      {prefsStatus && <p>{prefsStatus}</p>}
                    </div>
                  )}

                  {accountSection === id && id === "support" && (
                    <div className="workspace-acc-panel">
                      <p>{t(locale, "workspace.support.body")}</p>
                      <a
                        className="workspace-support-link"
                        href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                          `LOOPEN ${t(locale, "workspace.support.subject")}`,
                        )}`}
                      >
                        {SUPPORT_EMAIL} <span>↗</span>
                      </a>
                    </div>
                  )}

                  {accountSection === id && id === "billing" && (
                    <div className="workspace-acc-panel">
                      {billingHistoryLoading ? (
                        <p>{t(locale, "workspace.billing.loading")}</p>
                      ) : billingHistory.length ? (
                        <ul className="workspace-billing-list">
                          {billingHistory.map((entry) => (
                            <li key={entry.id}>
                              <span>
                                {new Date(entry.createdAt).toLocaleDateString()}
                              </span>
                              <strong>{entry.label}</strong>
                              <b>
                                {entry.delta > 0 ? "+" : ""}
                                {entry.delta}
                              </b>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          {billingHistoryStatus ||
                            (billingEnabled
                              ? t(locale, "workspace.billing.empty")
                              : t(locale, "workspace.billing.stripePending"))}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsSignalsOpen(true)}
                      >
                        {t(locale, "workspace.billing.topUp")}
                      </button>
                    </div>
                  )}

                  {accountSection === id && id === "team" && (
                    <div className="workspace-acc-panel">
                      <p>{t(locale, "workspace.team.body")}</p>
                      <label className="workspace-toggle">
                        <input
                          type="checkbox"
                          checked={emailPrefs.teamLaunch}
                          disabled={prefsSaving}
                          onChange={(event) =>
                            void saveEmailPrefs({
                              ...emailPrefs,
                              teamLaunch: event.target.checked,
                            })
                          }
                        />
                        <span>{t(locale, "workspace.team.notify")}</span>
                      </label>
                      {prefsStatus && <p>{prefsStatus}</p>}
                    </div>
                  )}

                  {accountSection === id && id === "delete" && (
                    <form
                      className="workspace-acc-panel workspace-acc-danger"
                      onSubmit={deleteStudioAccount}
                    >
                      {user.source === "local" ? (
                        <p>{t(locale, "workspace.delete.localOnly")}</p>
                      ) : (
                        <>
                          <p>
                            {
                              t(locale, "workspace.delete.body").split(
                                "{email}",
                              )[0]
                            }
                            <em>{user.email}</em>
                            {
                              t(locale, "workspace.delete.body").split(
                                "{email}",
                              )[1]
                            }
                          </p>
                          <label>
                            <span>{t(locale, "workspace.delete.confirmEmail")}</span>
                            <input
                              type="email"
                              value={deleteConfirmEmail}
                              onChange={(event) =>
                                setDeleteConfirmEmail(event.target.value)
                              }
                              placeholder={user.email}
                              required
                            />
                          </label>
                          <button type="submit" disabled={deleteSaving}>
                            {deleteSaving
                              ? t(locale, "workspace.delete.deleting")
                              : t(locale, "workspace.delete.submit")}
                          </button>
                          {deleteStatus && <p>{deleteStatus}</p>}
                        </>
                      )}
                    </form>
                  )}
                </section>
              ))}
            </div>
          )}

          <span className="local-session-note">
            {t(locale, "workspace.autosave")}
          </span>
        </aside>
      )}

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span>{t(locale, "hero.kicker")}</span>
          <span>{studioStamp}</span>
        </div>
        <h1>
          {t(locale, "hero.title.1")}
          <span className="hero-line">
            <i className="loop-orbit" aria-hidden="true" />
            <em>{t(locale, "hero.title.2")}</em>
          </span>
        </h1>
        <div className="hero-footer">
          <p>LOOPEN {t(locale, "hero.body")}</p>
          <a className="circle-cta" href="#brief" aria-label={t(locale, "hero.start")}>
            <span>{t(locale, "hero.start")}</span>
            <b>↘</b>
          </a>
        </div>
      </section>

      <section className="ticker" aria-label={t(locale, "ticker.aria")}>
        <div>
          <span>{t(locale, "ticker.strategy")}</span>
          <i>✦</i>
          <span>{t(locale, "ticker.directions")}</span>
          <i>✦</i>
          <span>{t(locale, "ticker.vectors")}</span>
          <i>✦</i>
          <span>{t(locale, "ticker.selection")}</span>
          <i>✦</i>
        </div>
      </section>

      <section className="studio-section" id="brief">
        <div className="section-heading">
          <p className="eyebrow">{t(locale, "brief.eyebrow")}</p>
          <h2>
            {t(locale, "brief.title.1")}
            <br />
            {t(locale, "brief.title.2")}
          </h2>
          <p className="section-note">{t(locale, "brief.note")}</p>
        </div>

        <div className="brief-panel">
          <div className="premium-fields brief-template-select">
            <CreativeSelect
              label={t(locale, "brief.template")}
              value={activeTemplateId || "custom"}
              onChange={(value) => {
                if (value === "custom") {
                  clearBriefTemplate();
                  return;
                }
                const template = BRIEF_TEMPLATES.find((item) => item.id === value);
                if (template) applyBriefTemplate(template);
              }}
              options={[
                { value: "custom", label: t(locale, "brief.blankTemplate") },
                ...BRIEF_TEMPLATES.map((template) => ({
                  value: template.id,
                  label: `${template.label} — ${template.industryLabel}`,
                })),
              ]}
            />
          </div>
          <div className="field-row">
            <label htmlFor="brand-name">{t(locale, "brief.brandName")} *</label>
            <span>01</span>
            <input
              id="brand-name"
              value={brandName}
              placeholder={t(locale, "brief.ph.brandName")}
              onChange={(event) => {
                const next = event.target.value;
                setWordmarkName((current) =>
                  !current.trim() || current === brandName ? next : current,
                );
                setBrandName(next);
                setActiveTemplateId((current) => {
                  const template = BRIEF_TEMPLATES.find((item) => item.id === current);
                  if (template && next !== template.brandName) return "";
                  return current;
                });
              }}
              required
            />
          </div>
          <div className="field-row">
            <label htmlFor="brand-idea">{t(locale, "brief.coreIdea")} *</label>
            <span>02</span>
            <textarea
              id="brand-idea"
              rows={2}
              value={coreIdea}
              placeholder={t(locale, "brief.ph.coreIdea")}
              onChange={(event) => setCoreIdea(event.target.value)}
              required
            />
          </div>
          <div className="premium-fields">
            <label>
              <span className="mini-label">{t(locale, "brief.industry")} *</span>
              <input
                value={industry}
                placeholder={t(locale, "brief.ph.industry")}
                onChange={(event) => setIndustry(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="mini-label">{t(locale, "brief.companyDoes")} *</span>
              <textarea
                value={companyDescription}
                placeholder={t(locale, "brief.ph.companyDoes")}
                onChange={(event) => setCompanyDescription(event.target.value)}
                rows={3}
                required
              />
            </label>
            <label>
              <span className="mini-label">{t(locale, "brief.positioning")}</span>
              <textarea
                value={positioning}
                placeholder={t(locale, "brief.ph.positioning")}
                onChange={(event) => setPositioning(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span className="mini-label">{t(locale, "brief.competitors")}</span>
              <textarea
                value={competitors}
                placeholder={t(locale, "brief.ph.competitors")}
                onChange={(event) => setCompetitors(event.target.value)}
                rows={2}
              />
            </label>
          </div>
          <div className="personality-row">
            <div className="field-label">
              <label>{t(locale, "brief.personality")}</label>
              <span>03</span>
            </div>
            <div className="chips">
              {personalityOptions.map((item) => {
                const active = personalities.includes(item);
                return (
                  <button
                    key={item}
                    className={active ? "chip active" : "chip"}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePersonality(item)}
                  >
                    {active && <span>●</span>}
                    {t(locale, `brief.person.${item.toLowerCase()}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="premium-fields production-brief">
            <label>
              <span className="mini-label">{t(locale, "brief.visualDirection")}</span>
              <textarea
                value={visualDirection}
                placeholder={t(locale, "brief.ph.visualDirection")}
                onChange={(event) => setVisualDirection(event.target.value)}
                rows={3}
              />
            </label>
            <label>
              <span className="mini-label">{t(locale, "brief.audience")}</span>
              <textarea
                value={audience}
                placeholder={t(locale, "brief.ph.audience")}
                onChange={(event) => setAudience(event.target.value)}
                rows={2}
              />
            </label>
            <CreativeSelect
              label={t(locale, "brief.colorStrategy")}
              value={colorApproach}
              onChange={(value) =>
                setColorApproach(
                  value as NonNullable<PremiumBrief["colorApproach"]>,
                )
              }
              options={[
                { value: "propose", label: t(locale, "brief.color.propose") },
                { value: "existing", label: t(locale, "brief.color.existing") },
                { value: "mood", label: t(locale, "brief.color.mood") },
              ]}
            />
            {colorApproach === "existing" && (
              <label>
                <span className="mini-label">{t(locale, "brief.existingColors")}</span>
                <textarea
                  value={brandColors}
                  onChange={(event) => setBrandColors(event.target.value)}
                  rows={2}
                  placeholder={t(locale, "brief.ph.existingColors")}
                />
              </label>
            )}
            {colorApproach !== "existing" && (
              <label>
                <span className="mini-label">{t(locale, "brief.colorMood")}</span>
                <textarea
                  value={colorMood}
                  placeholder={t(locale, "brief.ph.colorMood")}
                  onChange={(event) => setColorMood(event.target.value)}
                  rows={2}
                />
              </label>
            )}
            <label>
              <span className="mini-label">{t(locale, "brief.usage")}</span>
              <textarea
                value={usage}
                placeholder={t(locale, "brief.ph.usage")}
                onChange={(event) => setUsage(event.target.value)}
                rows={2}
              />
            </label>
            <label className="wide-field">
              <span className="mini-label">{t(locale, "brief.avoid")}</span>
              <textarea
                value={avoid}
                placeholder={t(locale, "brief.ph.avoid")}
                onChange={(event) => setAvoid(event.target.value)}
                rows={3}
              />
            </label>
          </div>
          <div className="generate-row">
            <p>
              <span>{signalCosts?.generateBatch ?? 4}</span>{" "}
              {t(locale, "brief.signalsLine")}
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating
                ? t(locale, "brief.generateBusy")
                : user
                  ? t(locale, "brief.generate")
                  : t(locale, "brief.enterGenerate")}
              {isGenerating ? (
                <RequestDrop label={t(locale, "brief.generateBusy")} />
              ) : (
                <span>↗</span>
              )}
            </button>
          </div>
          {isGuestSession && (
            <p className="auth-hint">{t(locale, "brief.authHint")}</p>
          )}
          {notice && (
            <p className="inline-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>

      <section
        className="strategy-section"
        id="research"
        aria-label={t(locale, "strategy.aria")}
      >
          <div className="strategy-heading">
            <p className="eyebrow">{t(locale, "strategy.eyebrow")}</p>
            <h2>
              {t(locale, "strategy.title.1")}
              <br />
              {t(locale, "strategy.title.2")}
            </h2>
            <p>
              {strategy?.differentiation ??
                (isGenerating
                  ? t(locale, "strategy.placeholder.generating")
                  : t(locale, "strategy.placeholder.idle"))}
            </p>
          </div>
          {strategy ? (
            <button
              className="strategy-toggle"
              type="button"
              aria-expanded={isStrategyOpen}
              onClick={() => setIsStrategyOpen((current) => !current)}
            >
              {isStrategyOpen
                ? t(locale, "strategy.hide")
                : t(locale, "strategy.view")}
              <span>{isStrategyOpen ? "−" : "+"}</span>
            </button>
          ) : (
            <div className={`strategy-pending ${isGenerating ? "active" : ""}`}>
              <div className="research-status">
                <span>
                  {isGenerating
                    ? t(locale, "strategy.inProgress")
                    : t(locale, "strategy.awaiting")}
                </span>
                <b>
                  {isGenerating
                    ? t(locale, "strategy.signalsActive")
                    : t(locale, "strategy.signalsIdle")}
                </b>
              </div>
              <div
                className="research-route"
                aria-label={t(locale, "strategy.stagesAria")}
              >
                {(
                  [
                    ["01", "strategy.stage.codes"],
                    ["02", "strategy.stage.competitors"],
                    ["03", "strategy.stage.whitespace"],
                    ["04", "strategy.stage.color"],
                  ] as const
                ).map(([number, labelKey]) => (
                  <div className="research-node" key={number}>
                    <i aria-hidden="true" />
                    <span>{number}</span>
                    <strong>{t(locale, labelKey)}</strong>
                  </div>
                ))}
              </div>
              {!isGenerating && <p>{t(locale, "strategy.submitHint")}</p>}
            </div>
          )}
          {strategy && isStrategyOpen && <div className="strategy-grid">
            <article>
              <span>{t(locale, "strategy.codes")}</span>
              {strategy.categoryCodes.map((item) => <p key={item}>{item}</p>)}
            </article>
            <article>
              <span>{t(locale, "strategy.risks")}</span>
              {strategy.competitorRisks.map((item) => <p key={item}>{item}</p>)}
            </article>
            <article>
              <span>{t(locale, "strategy.typography")}</span>
              <p>{strategy.typography}</p>
            </article>
            <article>
              <span>
                {colorApproach === "existing"
                  ? t(locale, "strategy.clientPalette")
                  : t(locale, "strategy.proposedPalette")}
              </span>
              <div className="palette-row">
                {strategy.palette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={t(locale, "strategy.useColor", { color })}
                    style={{ background: color }}
                    onClick={() => setLockupColor(color)}
                  >
                    <i>{color}</i>
                  </button>
                ))}
              </div>
            </article>
          </div>}
          {strategy && isStrategyOpen && (
            <p className="trademark-notice">
              {t(locale, "strategy.trademarkPrefix")}{" "}
              {strategy.trademarkNotice}
            </p>
          )}
        </section>

      <section className="concepts-section" id="concepts">
        <div className="concepts-header">
          <div>
            <p className="eyebrow light">{t(locale, "concepts.eyebrow")}</p>
            <h2>{t(locale, "concepts.title")}</h2>
          </div>
          <p>{t(locale, "concepts.body")}</p>
        </div>
        {diversityWarning && (
          <p className="diversity-warning" role="status">
            {diversityWarning}
          </p>
        )}

        {generatedConcepts.length ? (
          <div className="concept-grid">
            {generatedConcepts.map((generated, conceptIndex) => {
              const concept =
                concepts.find(
                  (item) =>
                    item.id === generated.directionKey ||
                    generated.directionKey.startsWith(`${item.id}-`),
                ) ??
                concepts[conceptIndex] ??
                concepts[0];
              const isActive = selectedConceptIds.includes(generated.id);
              return (
              <article
                className={`concept-card ${isActive ? "selected" : ""}`}
                key={generated.id}
                role="button"
                tabIndex={0}
                aria-pressed={isActive}
                aria-label={
                  isActive
                    ? t(locale, "concepts.deselectAria", {
                        title: generated.directionTitle,
                      })
                    : t(locale, "concepts.selectAria", {
                        title: generated.directionTitle,
                      })
                }
                onClick={() => selectGeneratedConcept(generated.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectGeneratedConcept(generated.id);
                  }
                }}
              >
                <div className="concept-meta">
                  <span>{String(conceptIndex + 1).padStart(2, "0")}</span>
                  <span
                    className={`score ${concept.accent}`}
                    title={
                      generated.reviewReason ??
                      t(locale, "concepts.reviewFallback")
                    }
                  >
                    {generated.reviewStatus === "Recommended"
                      ? t(locale, "prod.recommended")
                      : generated.reviewStatus
                        ? t(locale, "prod.reviewNotes")
                        : t(locale, "concepts.reviewStatus")}
                  </span>
                </div>
                <div className="concept-mark generated-mark">
                  <img
                    src={resolveMediaUrl(generated.imageUrl)}
                    alt={`${brandName} — ${generated.directionTitle}`}
                  />
                  <span className="generated-wordmark">{brandName}</span>
                </div>
                <div className="concept-copy">
                  <h3>{generated.directionTitle}</h3>
                  <p>{generated.rationale ?? concept.thesis}</p>
                  <button
                    className="review-trigger"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      showJuryReview(generated);
                    }}
                  >
                    <span>{t(locale, "concepts.readJury")}</span>
                    <b>{generated.qualityScore ? `${generated.qualityScore}/100` : "↗"}</b>
                  </button>
                </div>
                <div className="concept-card-actions">
                  <span className="select-indicator" aria-hidden="true">
                    {isActive
                      ? t(locale, "concepts.selected")
                      : t(locale, "concepts.select")}
                  </span>
                  <button
                    className="delete-concept"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteConcept(generated);
                    }}
                    aria-label={t(locale, "concepts.deleteAria", {
                      title: generated.directionTitle,
                    })}
                  >
                    {t(locale, "concepts.delete")}
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="concept-empty">
            <span>{t(locale, "concepts.empty.kicker")}</span>
            <strong>{t(locale, "concepts.empty.title")}</strong>
            <p>{t(locale, "concepts.empty.body")}</p>
            <a href="#brief">{t(locale, "concepts.empty.cta")}</a>
          </div>
        )}

        {generatedConcepts.length > 0 && generatedConcepts.length < 8 && (
          <div className="more-concepts">
            <span>
              {t(locale, "concepts.moreReady", {
                n: generatedConcepts.length,
              })}
            </span>
            <button
              type="button"
              onClick={generateMore}
              disabled={isGeneratingMore}
            >
              {isGeneratingMore
                ? t(locale, "concepts.moreBusy")
                : t(locale, "concepts.moreCta")}
              {isGeneratingMore && (
                <RequestDrop label={t(locale, "concepts.moreLoader")} />
              )}
            </button>
          </div>
        )}

        {generatedConcepts.length > 0 && <div className="selected-bar">
          <div className={`selected-symbol ${selected.className}`} aria-hidden="true">
            <i />
            <b />
            <em />
          </div>
          <div>
            <span>{t(locale, "concepts.shortlist")}</span>
            <strong>
              {t(locale, "concepts.selectedCount", {
                n: selectedConceptIds.length ? 1 : 0,
              })}
              {focusedGeneration ? ` · ${focusedGeneration.directionTitle}` : ""}
            </strong>
          </div>
          <div className="selected-actions">
            {generatedConcepts.find(
              (item) => item.directionKey === selectedConcept,
            ) ? (
              <a
                className="download-button"
                href={resolveMediaUrl(
                  generatedConcepts.find(
                    (item) => item.directionKey === selectedConcept,
                  )!.downloadUrl,
                )}
              >
                {t(locale, "concepts.downloadPng")}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setNotice(t(locale, "notice.needRealConcepts"))}
              >
                {t(locale, "concepts.downloadPngShort")}
              </button>
            )}
            <button
              className="approve-button"
              type="button"
              onClick={refineSelected}
              disabled={isRefining || selectedConceptIds.length === 0}
            >
              {isRefining
                ? t(locale, "concepts.reducing")
                : t(locale, "concepts.reduceSelected", {
                    n: selectedConceptIds.length || "",
                  })}
              {isRefining ? (
                <RequestDrop label={t(locale, "concepts.reduceLoader")} />
              ) : (
                <span>→</span>
              )}
            </button>
          </div>
        </div>}
      </section>

      <section
        className={`workflow-section${productionUnlocked ? "" : " workflow-deferred"}`}
        id="workflow"
        aria-hidden={productionUnlocked ? undefined : true}
      >
        <div className="workflow-heading">
          <p className="eyebrow">{t(locale, "prod.eyebrow")}</p>
          <h2>
            {t(locale, "prod.title.1")}
            <br />
            {t(locale, "prod.title.2")}
          </h2>
          <p>{t(locale, "prod.body")}</p>
        </div>

        <div className="workflow-stage">
          <div className="stage-index">
            <span>01</span>
            <strong>{t(locale, "prod.stage.refine")}</strong>
          </div>
          <div className="asset-grid">
            {refinements.length ? refinements.map((asset) => {
              const parentConcept =
                generatedConcepts.find((item) => item.id === asset.parentId) ??
                null;
              const showOriginal =
                selectedRefinement === asset.id &&
                vectorSourceMode === "original" &&
                Boolean(parentConcept);
              const previewLabel = showOriginal
                ? parentConcept!.directionTitle
                : asset.label;
              const previewMeta = showOriginal
                ? parentConcept!.qualityScore
                  ? `QC ${parentConcept!.qualityScore}/100`
                  : t(locale, "prod.originalConcept")
                : `${asset.model}${
                    asset.qualityScore ? ` · QC ${asset.qualityScore}/100` : ""
                  }`;

              return (
              <article
                className={selectedRefinement === asset.id ? "asset-card active" : "asset-card"}
                key={asset.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedRefinement === asset.id}
                onClick={() => setSelectedRefinement(asset.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRefinement(asset.id);
                  }
                }}
              >
                <div
                  className={`asset-card-preview${showOriginal ? " is-original" : ""}`}
                >
                  <img
                    className="asset-preview-refine"
                    src={resolveMediaUrl(asset.url)}
                    alt={`${brandName} ${asset.label}`}
                    decoding="async"
                    hidden={showOriginal}
                  />
                  {parentConcept ? (
                    <img
                      className="asset-preview-original"
                      src={resolveMediaUrl(parentConcept.imageUrl)}
                      alt={`${brandName} ${parentConcept.directionTitle}`}
                      decoding="async"
                      hidden={!showOriginal}
                    />
                  ) : null}
                </div>
                <span>{previewLabel}</span>
                <small>{previewMeta}</small>
                <b
                  className={`asset-verdict ${
                    asset.reviewStatus === "Recommended" ? "approved" : "advisory"
                  }${showOriginal ? " is-slot" : ""}`}
                  aria-hidden={showOriginal || undefined}
                >
                  {asset.reviewStatus === "Recommended"
                    ? t(locale, "prod.recommended")
                    : t(locale, "prod.reviewNotes")}
                </b>
                <div
                  className={`segmented vector-source-toggle${
                    selectedRefinement === asset.id && parentConcept
                      ? ""
                      : " is-slot"
                  }`}
                  role="group"
                  aria-label={t(locale, "prod.svgSourceAria")}
                  aria-hidden={
                    !(selectedRefinement === asset.id && parentConcept) ||
                    undefined
                  }
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className={
                      selectedRefinement === asset.id &&
                      vectorSourceMode === "original"
                        ? "active"
                        : ""
                    }
                    disabled={
                      !(selectedRefinement === asset.id && parentConcept)
                    }
                    tabIndex={
                      selectedRefinement === asset.id && parentConcept
                        ? 0
                        : -1
                    }
                    onClick={() => setVectorSourceMode("original")}
                  >
                    {t(locale, "prod.originalConcept")}
                  </button>
                  <button
                    type="button"
                    className={
                      selectedRefinement === asset.id &&
                      vectorSourceMode === "refine"
                        ? "active"
                        : ""
                    }
                    disabled={
                      !(selectedRefinement === asset.id && parentConcept)
                    }
                    tabIndex={
                      selectedRefinement === asset.id && parentConcept
                        ? 0
                        : -1
                    }
                    onClick={() => setVectorSourceMode("refine")}
                  >
                    {t(locale, "prod.refinement")}
                  </button>
                </div>
              </article>
              );
            }) : (
              <div className="empty-stage">
                <strong>{t(locale, "prod.empty.refineTitle")}</strong>
                <p>
                  {isRefining
                    ? t(locale, "prod.empty.refining")
                    : selectedConceptIds.length
                      ? t(locale, "prod.empty.hasSelection")
                      : t(locale, "prod.empty.noSelection")}
                </p>
                {isRefining && (
                  <p className="inline-notice" role="status">
                    {t(locale, "prod.refiningStatus")}
                    <RequestDrop label={t(locale, "prod.refiningLoader")} />
                  </p>
                )}
              </div>
            )}
          </div>
          {!isRefining && (refinements.length > 0 || selectedConceptIds.length > 0) && (
            <div className="vector-source-bar">
              <button
                className="stage-action"
                type="button"
                onClick={vectorizeSelected}
                disabled={isVectorizing || !canReconstruct}
              >
              {isVectorizing
                ? t(locale, "prod.creatingSvg")
                : t(locale, "prod.reconstruct")}
              {isVectorizing ? (
                <RequestDrop label={t(locale, "prod.creatingLoader")} />
              ) : (
                <span>→</span>
              )}
              </button>
            </div>
          )}
          {!isRefining && selectedReduction && !juryRecommends && (
            <div className="transition-advisory" role="status">
              <span>{t(locale, "prod.juryRec")}</span>
              <strong>{t(locale, "prod.juryUnlocked")}</strong>
              <p>
                {selectedReduction.reviewReason ??
                  t(locale, "prod.juryFallback")}
              </p>
              <button type="button" onClick={refineSelected} disabled={isRefining}>
                {isRefining
                  ? t(locale, "prod.retrying")
                  : t(locale, "prod.retryRefine")}
                {isRefining ? (
                  <RequestDrop label={t(locale, "prod.retryLoader")} />
                ) : (
                  <span>↗</span>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="workflow-stage">
          <div className="stage-index">
            <span>02</span>
            <strong>{t(locale, "prod.stage.vector")}</strong>
          </div>
          <div className="asset-grid vector-grid">
            {vectors.length ? vectors.map((asset) => (
              <article
                className={selectedVector === asset.id ? "asset-card active" : "asset-card"}
                key={asset.id}
                role="button"
                tabIndex={0}
                aria-pressed={selectedVector === asset.id}
                onClick={() => setSelectedVector(asset.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedVector(asset.id);
                  }
                }}
              >
                <img
                  src={resolveMediaUrl(asset.url)}
                  alt={`${brandName} ${asset.label}`}
                />
                <span>{asset.label}</span>
                <small>{asset.model}</small>
                <div className="asset-card-actions">
                  <button
                    className="delete-asset"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteAsset(asset);
                    }}
                    aria-label={`${t(locale, "prod.delete")} ${asset.label}`}
                  >
                    {t(locale, "prod.delete")}
                  </button>
                </div>
              </article>
            )) : (
              <div className="empty-stage">
                <strong>{t(locale, "prod.empty.vectorTitle")}</strong>
                <p>{t(locale, "prod.empty.vectorBody")}</p>
              </div>
            )}
          </div>
        </div>

        <div className={`lockup-editor ${selectedVectorAsset ? "" : "locked"}`}>
          {!selectedVectorAsset ? (
            <div className="production-lock">
              <div className="production-lock-number">—</div>
              <p>{t(locale, "prod.lock.kicker")}</p>
              <h3>{t(locale, "prod.lock.title")}</h3>
              <div>
                <span>{t(locale, "prod.lock.next")}</span>
                <strong>{t(locale, "prod.lock.nextValue")}</strong>
              </div>
              <i aria-hidden="true">↘</i>
            </div>
          ) : (<>
          <div className="lockup-stage">
            <aside className="lockup-rail">
              <div className="rail-block">
                <p className="rail-kicker">{t(locale, "prod.comp.kicker")}</p>
                <div className="segmented">
                  <button type="button" className={lockupLayout === "horizontal" ? "active" : ""} onClick={() => setLockupLayout("horizontal")}>{t(locale, "prod.layout.horizontal")}</button>
                  <button type="button" className={lockupLayout === "vertical" ? "active" : ""} onClick={() => setLockupLayout("vertical")}>{t(locale, "prod.layout.vertical")}</button>
                  <button type="button" className={lockupLayout === "icon" ? "active" : ""} onClick={() => setLockupLayout("icon")}>{t(locale, "prod.layout.icon")}</button>
                </div>
                <div className="editor-color-control">
                  <span className="mini-label">{t(locale, "prod.color")}</span>
                  <div className="editor-color-options">
                    {lockupPalette.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={lockupColor.toLowerCase() === color.toLowerCase() ? "active" : ""}
                        style={{ background: color }}
                        aria-label={t(locale, "strategy.useColor", { color })}
                        onClick={() => setLockupColor(color)}
                      />
                    ))}
                    <label
                      className="editor-color-picker"
                      title={t(locale, "prod.customColor")}
                    >
                      <span className="sr-only">
                        {t(locale, "prod.customColor")}
                      </span>
                      <input
                        type="color"
                        value={/^#[0-9a-f]{6}$/i.test(lockupColor) ? lockupColor : "#201f1e"}
                        onChange={(event) => setLockupColor(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="rail-block">
                <p className="rail-kicker">{t(locale, "prod.type.kicker")}</p>
                <label className="editor-field-with-size">
                  <span className="mini-label">
                    {t(locale, "prod.wordmarkName")}
                  </span>
                  <div className="editor-field-line">
                    <input
                      value={wordmarkName}
                      placeholder={brandName || brandNameFallback}
                      onChange={(event) => setWordmarkName(event.target.value)}
                    />
                    <SizeSquareSelect
                      label={t(locale, "prod.wordmark")}
                      value={wordmarkSize}
                      onChange={setWordmarkSize}
                      options={WORDMARK_SIZE_OPTIONS}
                    />
                  </div>
                </label>
                <label className="editor-field-with-size">
                  <span className="mini-label">
                    {t(locale, "prod.descriptor")}
                  </span>
                  <div className="editor-field-line">
                    <input
                      value={descriptor}
                      placeholder={t(locale, "prod.descriptorPh")}
                      onChange={(event) => setDescriptor(event.target.value)}
                    />
                    <SizeSquareSelect
                      label={t(locale, "prod.descriptor")}
                      value={descriptorSize}
                      onChange={setDescriptorSize}
                      options={DESCRIPTOR_SIZE_OPTIONS}
                    />
                  </div>
                </label>
                <CreativeSelect
                  label={t(locale, "prod.wordmarkCharacter")}
                  value={wordmarkStyle}
                  onChange={setWordmarkStyle}
                  options={[
                    { value: "modern", label: t(locale, "prod.type.modern") },
                    {
                      value: "geometric",
                      label: t(locale, "prod.type.geometric"),
                    },
                    {
                      value: "humanist",
                      label: t(locale, "prod.type.humanist"),
                    },
                    {
                      value: "editorial",
                      label: t(locale, "prod.type.editorial"),
                    },
                  ]}
                />
                <CreativeSelect
                  label={t(locale, "prod.case")}
                  value={wordmarkCase}
                  onChange={(value) => setWordmarkCase(value as typeof wordmarkCase)}
                  options={[
                    {
                      value: "original",
                      label: t(locale, "prod.case.original"),
                    },
                    { value: "upper", label: t(locale, "prod.case.upper") },
                    { value: "lower", label: t(locale, "prod.case.lower") },
                  ]}
                />
              </div>

              <div className="rail-block">
                <p className="rail-kicker">{t(locale, "prod.optics.kicker")}</p>
                <label className="creative-range">
                  <span className="mini-label">
                    {t(locale, "prod.weight", { n: wordmarkWeight })}
                  </span>
                  <input style={{ "--range-progress": `${((wordmarkWeight - 400) / 400) * 100}%` } as CSSProperties} type="range" min="400" max="800" step="100" value={wordmarkWeight} onChange={(event) => setWordmarkWeight(Number(event.target.value))} />
                </label>
                <label className="creative-range">
                  <span className="mini-label">
                    {t(locale, "prod.tracking", { n: wordmarkTracking })}
                  </span>
                  <input style={{ "--range-progress": `${((wordmarkTracking + 8) / 16) * 100}%` } as CSSProperties} type="range" min="-8" max="8" value={wordmarkTracking} onChange={(event) => setWordmarkTracking(Number(event.target.value))} />
                </label>
                <label className="creative-range">
                  <span className="mini-label">
                    {t(locale, "prod.markScale", {
                      pct: markScale,
                      px: markSizePx,
                    })}
                  </span>
                  <input
                    style={
                      {
                        "--range-progress": `${((markScale - 70) / 330) * 100}%`,
                      } as CSSProperties
                    }
                    type="range"
                    min="70"
                    max="400"
                    step="5"
                    value={markScale}
                    onChange={(event) => setMarkScale(Number(event.target.value))}
                  />
                </label>
              </div>
            </aside>

            <div
              className={`lockup-preview ${lockupLayout}`}
              style={
                {
                  color: lockupColor,
                  "--wordmark-size": `${wordmarkSize}px`,
                  "--descriptor-size": `${descriptorSize}px`,
                  "--mark-size": `${markSizePx}px`,
                } as CSSProperties
              }
            >
              <div className="lockup-preview-fit">
                <div className="lockup-mark-slot">
                  {selectedVectorAsset ? (
                    <LockupMark
                      url={selectedVectorAsset.url}
                      color={lockupColor}
                      alt=""
                    />
                  ) : (
                    <div className="preview-placeholder">SVG</div>
                  )}
                </div>
                {lockupLayout !== "icon" && (
                  <div className="lockup-preview-type">
                    <strong
                      className={`wordmark-${wordmarkStyle}`}
                      style={{
                        fontWeight: wordmarkWeight,
                        letterSpacing: `${wordmarkTracking / 100}em`,
                      }}
                    >
                      {displayBrandName}
                    </strong>
                    {descriptor ? <span>{descriptor}</span> : null}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="quality-lab">
            <article>
              <span>{t(locale, "prod.responsiveTest")}</span>
              <div className="size-test">
                {[16, 24, 32, 64].map((size) => (
                  <figure key={size}>
                    <span className="size-test-mark" style={{ width: size, height: size }}>
                      {selectedVectorAsset ? (
                        <LockupMark
                          url={selectedVectorAsset.url}
                          color="#ffffff"
                          alt=""
                        />
                      ) : (
                        <i />
                      )}
                    </span>
                    <figcaption>{size}px</figcaption>
                  </figure>
                ))}
              </div>
            </article>
            <article>
              <span>{t(locale, "prod.contrastTest")}</span>
              <div className="contrast-test">
                <div>
                  {selectedVectorAsset && (
                    <LockupMark
                      url={selectedVectorAsset.url}
                      color={lockupColor}
                      alt=""
                    />
                  )}
                </div>
                <div>
                  {selectedVectorAsset && (
                    <LockupMark
                      url={selectedVectorAsset.url}
                      color="#ffffff"
                      alt=""
                    />
                  )}
                </div>
              </div>
            </article>
            <article>
              <span>{t(locale, "prod.checks")}</span>
              <ul>
                <li>{t(locale, "prod.check.silhouette")}</li>
                <li>{t(locale, "prod.check.legibility")}</li>
                <li>{t(locale, "prod.check.contrast")}</li>
                <li>{t(locale, "prod.check.paths")}</li>
              </ul>
            </article>
          </div>
          <div className="export-row">
            <div>
              <span>03</span>
              <strong>{t(locale, "prod.export")}</strong>
            </div>
            <div>
              <button type="button" onClick={() => void exportLockup("svg")} disabled={!selectedVector || Boolean(exportingKey)}>
                SVG {exportingKey === `svg-${lockupLayout}-master` ? <RequestDrop label={t(locale, "prod.loader.exportSvg")} /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png")} disabled={!selectedVector || Boolean(exportingKey)}>
                PNG {exportingKey === `png-${lockupLayout}-master` ? <RequestDrop label={t(locale, "prod.loader.exportPng")} /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("webp")} disabled={!selectedVector || Boolean(exportingKey)}>
                WebP {exportingKey === `webp-${lockupLayout}-master` ? <RequestDrop label={t(locale, "prod.loader.exportWebp")} /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 48)} disabled={!selectedVector || Boolean(exportingKey)}>
                {t(locale, "prod.export.favicon")} {exportingKey === "png-icon-48" ? <RequestDrop label={t(locale, "prod.loader.favicon")} /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 1024)} disabled={!selectedVector || Boolean(exportingKey)}>
                {t(locale, "prod.export.social")} {exportingKey === "png-icon-1024" ? <RequestDrop label={t(locale, "prod.loader.social")} /> : "↓"}
              </button>
              <button type="button" onClick={printBrandGuide} disabled={!selectedVector}>
                {t(locale, "prod.export.guide")}
              </button>
            </div>
          </div>
          </>)}
        </div>
      </section>

      <section className="system-section" id="system">
        <div className="system-left">
          <p className="eyebrow">{t(locale, "system.eyebrow")}</p>
          <h2>
            {t(locale, "system.title.1")}
            <br />
            {t(locale, "system.title.2")}
          </h2>
          <div className="system-number">{selectedVectorAsset ? "03" : "—"}</div>
          <p className="system-caption">
            {selectedVectorAsset
              ? t(locale, "system.caption.ready")
              : t(locale, "system.caption.locked")}
          </p>
        </div>
        {selectedVectorAsset ? (
          <div className="system-board">
            <article
              className="application-card identity-drawing-card"
              style={{ background: strategy?.palette?.[2] ?? "var(--acid)" }}
            >
              <span className="app-label">{t(locale, "system.app.drawing")}</span>
              <LockupMark
                url={selectedVectorAsset.url}
                color={lockupColor}
                alt=""
              />
              <div className="drawing-metadata">
                <span>PROJECT</span><b>KT / 001</b>
                <span>STAGE</span><b>CONCEPT</b>
                <span>REVISION</span><b>01</b>
              </div>
              <strong>{displayBrandName}</strong>
            </article>
            <article className="application-card identity-proposal-card">
              <span className="app-label">{t(locale, "system.app.proposal")}</span>
              <div className={`dynamic-wordmark wordmark-${wordmarkStyle}`}>
                {displayBrandName}
              </div>
              <p>{descriptor || t(locale, "system.proposalFallback")}</p>
            </article>
            <article className="application-card identity-scale-card">
              <span className="app-label">{t(locale, "system.app.scale")}</span>
              <div className="identity-scale-row">
                {[24, 40, 72].map((size) => (
                  <figure key={size}>
                    <span className="size-test-mark" style={{ width: size, height: size }}>
                      <LockupMark
                        url={selectedVectorAsset.url}
                        color={lockupColor}
                        alt=""
                      />
                    </span>
                    <figcaption>{size}px</figcaption>
                  </figure>
                ))}
              </div>
              <p>{t(locale, "system.scaleNote")}</p>
            </article>
          </div>
        ) : (
          <div className="system-locked">
            <span>{t(locale, "system.locked.kicker")}</span>
            <strong>{t(locale, "system.locked.title")}</strong>
            <p>{t(locale, "system.locked.body")}</p>
            <i aria-hidden="true">○</i>
          </div>
        )}
      </section>

      <section className="manifesto" id="manifesto">
        <p className="eyebrow">{t(locale, "manifesto.eyebrow")}</p>
        <blockquote>
          {t(locale, "manifesto.quote.1")}{" "}
          <span>{t(locale, "manifesto.quote.2")}</span>
          <br />
          {t(locale, "manifesto.quote.3")}
        </blockquote>
        <div className="manifesto-footer">
          <p>{t(locale, "manifesto.body")}</p>
          <button
            className="text-button"
            type="button"
            onClick={() => setIsMethodOpen(true)}
          >
            {t(locale, "manifesto.readMethod")}
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-signal">
          <span><i /> {t(locale, "footer.online")}</span>
          <p>
            {t(locale, "footer.studio")}
            <br />
            {studioStamp}
          </p>
        </div>
        <div className="footer-statement">
          <span>{t(locale, "footer.oneBrief")}</span>
          <strong>
            {t(locale, "footer.statement.1")}
            <br />
            {t(locale, "footer.statement.2")}{" "}
            <em>{t(locale, "footer.statement.3")}</em>
          </strong>
        </div>
        <nav className="footer-route" aria-label={t(locale, "footer.routeAria")}>
          {(
            [
              ["01", "brief.eyebrow", "#brief"],
              ["02", "strategy.eyebrow", "#research"],
              ["03", "concepts.eyebrow", "#concepts"],
              ["04", "prod.eyebrow", "#workflow"],
              ["05", "system.eyebrow", "#system"],
            ] as const
          ).map(([number, labelKey, href]) => (
            <a href={href} key={number}>
              <span>{number}</span>
              <strong>
                {t(locale, labelKey).replace(/^\d+\s*\/\s*/, "")}
              </strong>
              <i>↘</i>
            </a>
          ))}
        </nav>
        <div className="footer-brand-row">
          <div className="footer-brand">
            <a className="footer-wordmark" href="#top">
              LOOPEN<span>®</span>
            </a>
            <p className="footer-credit">
              {t(locale, "footer.credit")}{" "}
              <em>{STUDIO_AUTHOR}</em>
            </p>
          </div>
          <div className="footer-orbit" aria-hidden="true"><i /></div>
          <div className="footer-meta">
            <p>
              {t(locale, "footer.meta")
                .split("\n")
                .map((line, index, lines) => (
                  <span key={line}>
                    {line}
                    {index < lines.length - 1 ? <br /> : null}
                  </span>
                ))}
            </p>
            <button type="button" onClick={() => setIsMethodOpen(true)}>
              {t(locale, "footer.method")}
            </button>
          </div>
          <a className="back-top" href="#top">
            <span>{t(locale, "footer.backTop")}</span>
            <i>↑</i>
          </a>
        </div>
      </footer>
    </main>
  );
}

export default function LoopenStudio({
  signInPath,
  user,
  role = "guest",
}: {
  signInPath: string;
  user: StudioUser | null;
  role?: StudioRole;
}) {
  const restored = useSyncExternalStore(
    subscribeStudioSession,
    getClientStudioSnapshot,
    () => null,
  );
  const initialDraft = restored
    ? draftFromSnapshot(restored)
    : createEmptyStudioDraft();
  const restoreNotice =
    restored && (restored.projectId || restored.generatedConcepts.length)
      ? t(readStoredLocale(), "notice.sessionRestored")
      : "";

  return (
    <LoopenStudioApp
      key={restored ? `session-${restored.savedAt}` : "fresh"}
      signInPath={signInPath}
      user={user}
      role={role}
      initialDraft={initialDraft}
      restoreNotice={restoreNotice}
    />
  );
}
