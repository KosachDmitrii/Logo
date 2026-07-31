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
import { buildLockupSvg } from "./lib/lockup-export";
import { prepareLockupMarkSvg, trimSvgViewBox } from "./lib/lockup-svg";
import {
  clearStudioSession,
  createEmptyStudioDraft,
  draftFromSnapshot,
  getClientStudioSnapshot,
  subscribeStudioSession,
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

export type StudioUser = {
  displayName: string;
  email: string;
  signalBalance?: number | null;
  /** local = ALLOW_LOCAL_STUDIO=1 — not a real account */
  source?: "supabase" | "local";
  role?: StudioRole;
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
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [exportingKey, setExportingKey] = useState("");
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSignalsOpen, setIsSignalsOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authSending, setAuthSending] = useState<"password" | "magic" | "">("");
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
      kicker: `${stage} / Request failed`,
      title: "The process stopped.",
      body: message,
      confirmLabel: "Return to studio",
      dismissOnly: true,
      tone: "danger",
    });
  }

  function requireStudioAccess() {
    if (user) return true;
    setIsAuthOpen(true);
    setAuthStatus("Enter with email to generate, save and keep work private.");
    return false;
  }

  function handlePaymentRequired(error?: string, required?: number) {
    setIsSignalsOpen(true);
    setNotice(
      error ||
        (required
          ? `Not enough signals — this move needs ${required}.`
          : "Not enough signals for this move."),
    );
  }

  async function refreshStudioAccount() {
    try {
      const response = await apiFetch("/auth/me");
      if (!response.ok) return;
      const payload = await readApiJson<{
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
      if (payload.warning) setNotice(payload.warning);
    } catch {
      // Wallet endpoint may be unavailable until migration is applied.
    }
  }

  async function sendEntryLink() {
    const email = authEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthStatus("Use a real email — the magic link lands there.");
      return;
    }
    setAuthSending("magic");
    setAuthStatus("Sending a private entry link…");
    try {
      const response = await apiFetch("/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await readApiJson<{ error?: string; message?: string }>(
        response,
      );
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send the entry link.");
      }
      setAuthStatus(
        payload.message ??
          "Entry link sent. Open it on this device to unlock the studio.",
      );
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : "Could not send the entry link.",
      );
    } finally {
      setAuthSending("");
    }
  }

  async function signInWithPassword(event?: { preventDefault(): void }) {
    event?.preventDefault();
    const email = authEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || authPassword.length < 6) {
      setAuthStatus("Enter email and password (min 6 characters).");
      return;
    }
    setAuthSending("password");
    setAuthStatus("Opening the studio…");
    try {
      const response = await apiFetch("/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: authPassword }),
      });
      const payload = await readApiJson<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(payload.error ?? "Invalid email or password.");
      }
      window.location.href = "/#brief";
      window.location.reload();
    } catch (error) {
      setAuthStatus(
        error instanceof Error ? error.message : "Could not sign in.",
      );
      setAuthSending("");
    }
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
        throw new Error(payload.error ?? "Checkout could not start.");
      }
      window.location.href = payload.url;
    } catch (error) {
      showRequestError(
        "Signal top-up",
        error instanceof Error ? error.message : "Checkout could not start.",
      );
      setCheckoutPackId("");
    }
  }

  function showJuryReview(concept: GeneratedConcept) {
    confirmResolver.current?.(false);
    confirmResolver.current = null;
    setConfirmDialog({
      kicker: `Dual jury / ${concept.reviewStatus ?? "Review"}`,
      title: concept.directionTitle,
      body: concept.reviewReason ?? "The jury has not returned a written critique for this direction.",
      confirmLabel: "Return to concepts",
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
    generatedConcepts.find((item) => item.id === selectedConceptIds[0]) ??
    generatedConcepts.find((item) => item.id === selectedReduction?.parentId) ??
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
  const displayBrandName =
    wordmarkCase === "upper"
      ? (wordmarkName || brandName || "Brand name").toUpperCase()
      : wordmarkCase === "lower"
        ? (wordmarkName || brandName || "Brand name").toLowerCase()
        : wordmarkName || brandName || "Brand name";
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
    void refreshStudioAccount();
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "enter" || params.has("auth") || signInPath.includes("#enter")) {
      // Open even for Local Studio — that identity is not a real account.
      if (!user || user.source === "local") setIsAuthOpen(true);
    }
    if (params.get("signals") === "topped") {
      setNotice("Signals landed. The studio is charged and ready.");
      setIsSignalsOpen(false);
      void refreshStudioAccount();
    }
    if (params.get("signals") === "cancelled") {
      setNotice("Top-up cancelled — your balance is unchanged.");
    }
  }, [user?.email, signInPath]);

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

  async function openProject(id: string) {
    setNotice("Loading saved project…");
    const response = await apiFetch(`/projects/${id}`);
    const payload = (await response.json()) as {
      error?: string;
      project?: { brandName: string; brief: PremiumBrief; selectedGenerationId?: string };
      generations?: GeneratedConcept[];
      assets?: StudioAsset[];
    };
    if (!response.ok || !payload.project) {
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
    const latestRefine = loadedAssets.filter((asset) => asset.stage === "refine").at(-1);
    const latestVector = loadedAssets.filter((asset) => asset.stage === "vector").at(-1);
    setSelectedRefinement(latestRefine?.id ?? "");
    setSelectedVector(latestVector?.id ?? "");
    setProductionLocked(false);
    setIsHistoryOpen(false);
    setNotice(`${payload.project.brandName} project loaded.`);
    document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteProject(project: SavedProject) {
    const confirmed = await requestConfirmation({
      kicker: "Permanent action / Project",
      title: `Erase ${project.brandName}?`,
      body: "The brief, logo concepts, refinements and production assets will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete project",
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
        "Delete project",
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
    setNotice(`${project.brandName} was permanently deleted.`);
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
    setNotice("Blank brief — fill in your own details.");
  }

  async function resetStudioToFresh() {
    const confirmed = await requestConfirmation({
      kicker: "Session / Fresh start",
      title: "Reset the studio to first open?",
      body: "This clears the brief, concepts, refinements, SVG and lockup settings in this tab. Saved projects in history stay on the server.",
      confirmLabel: "Reset studio",
      tone: "danger",
    });
    if (!confirmed) return;

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
    setNotice("Studio reset — as if you opened Loopen for the first time.");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    setNotice(`${template.label} brief loaded — review or generate.`);
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function generate() {
    if (!requireStudioAccess()) return;

    setIsGenerating(true);
    setNotice(
      "Designing four original flat logo directions. This can take up to two minutes…",
    );

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
        throw new Error(payload.error ?? "Generation could not be completed.");
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
          ? `${payload.generations.length} of 4 directions passed the professional jury. Weak concepts were withheld.`
          : "All 4 logo concepts generated, reviewed and saved.",
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
          : "Generation could not be completed.",
      );
    }
  }

  async function generateMore() {
    if (!projectId || generatedConcepts.length >= 8) return;
    if (!requireStudioAccess()) return;
    setIsGeneratingMore(true);
    setNotice("Generating exactly one additional graphic mark with Klein 4B…");
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
        throw new Error(payload.error ?? "More concepts could not be generated.");
      }
      setGeneratedConcepts((current) => [...current, ...payload.generations!]);
      void auditDiversity([...generatedConcepts, ...payload.generations]);
      void refreshStudioAccount();
      setNotice(
        payload.failures?.length
          ? `The additional concept could not be completed: ${payload.failures[0]}`
          : "One additional concept is ready.",
      );
    } catch (error) {
      showRequestError(
        "Additional study",
        error instanceof Error
          ? error.message
          : "More concepts could not be generated.",
      );
    } finally {
      setIsGeneratingMore(false);
    }
  }

  async function refineSelected() {
    if (!projectId || !selectedConceptIds.length) {
      setNotice("Select one concept before refinement.");
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
      kicker: `Stage 02 / ${refineCost} signals`,
      title: isRetry ? "Retry refinement with jury notes." : "Architecture becomes identity.",
      body: isRetry
        ? `Pro refine retries with the last dual-jury critique (${refineCost} signals). Production stages 04–05 stay cleared until SVG is rebuilt.`
        : `Pro refine the selected concept (${refineCost} signals). Stages 04–05 stay cleared until SVG is rebuilt.`,
      confirmLabel: isRetry
        ? "Retry refinement"
        : `Refine ${selectedConceptIds.length} concept${selectedConceptIds.length > 1 ? "s" : ""}`,
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
        ? `Retrying refinement with previous jury critique…`
        : `Refining selected logo concept…`,
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
          "Logo refinement",
          payload.error ?? "Refinement could not be completed.",
        );
        return;
      }
      // New refine only — keep vectors/lockup/system closed until Reconstruct.
      setAssets(payload.assets);
      setSelectedRefinement(payload.assets[0].id);
      setSelectedVector("");
      setVectorSourceMode("refine");
      setNotice(
        `${payload.assets.length} refined logo${payload.assets.length > 1 ? "s are" : " is"} ready. Reconstruct SVG when you want to unlock the brand system.`,
      );
      void loadHistory();
      void refreshStudioAccount();
    } catch (error) {
      setAssets(previousAssets);
      setSelectedRefinement(previousRefinement);
      setSelectedVector(previousVector);
      setProductionLocked(previousLocked);
      showRequestError(
        "Logo refinement",
        error instanceof Error
          ? error.message
          : "Refinement could not be completed.",
      );
    } finally {
      setIsRefining(false);
    }
  }

  async function vectorizeSelected() {
    if (!projectId || !canReconstruct) {
      setNotice("Select a concept or refinement before vectorization.");
      return;
    }
    const useOriginal = preferOriginal && Boolean(vectorSourceGeneration);
    const sourceLabel = useOriginal
      ? vectorSourceGeneration!.directionTitle
      : selectedReduction!.label;
    const vectorCost = signalCosts?.vectorize ?? 1;
    if (!(await requestConfirmation({
      kicker: `Stage 03 / ${vectorCost} signal${vectorCost === 1 ? "" : "s"}`,
      title: useOriginal
        ? "Build SVG from the original concept."
        : "Commit to the geometry.",
      body: useOriginal
        ? `"${sourceLabel}" (exploration) will be traced into an exact SVG that matches its silhouette (${vectorCost} signal). Prefer Refinement when a craft pass exists — it is higher resolution.`
        : `"${sourceLabel}" will be traced into an exact SVG that matches its silhouette — same mark, sharp vector edges (${vectorCost} signal).`,
      confirmLabel: "Build SVG master",
    }))) return;
    setIsVectorizing(true);
    setNotice(
      useOriginal
        ? "Tracing the original concept into an exact SVG…"
        : "Tracing the refinement into an exact SVG…",
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
          payload.error ?? "Vectorization could not be completed.",
        );
        return;
      }
      setAssets((current) => [
        ...current.filter((asset) => asset.stage !== "vector"),
        ...payload.assets!,
      ]);
      setSelectedVector(payload.assets[0].id);
      setProductionLocked(false);
      setNotice("Production SVGs are ready. Adjust and export your lockup.");
      void loadHistory();
      void refreshStudioAccount();
    } catch (error) {
      showRequestError(
        "SVG reconstruction",
        error instanceof Error
          ? error.message
          : "Vectorization could not be completed.",
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
      setNotice("Choose a vector result before export.");
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
          payload?.error ?? "Vector asset could not be loaded.",
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
      setNotice(`Production ${format.toUpperCase()} downloaded.`);
    } catch (error) {
      showRequestError(
        "Asset export",
        error instanceof Error ? error.message : "Export could not be created.",
      );
    } finally {
      setExportingKey("");
    }
  }

  function printBrandGuide() {
    if (!projectId || !selectedVector) {
      setNotice("Choose a vector result before creating the brand guide.");
      return;
    }
    window.open(
      apiUrl(
        `/projects/${projectId}/brand-guide?assetId=${encodeURIComponent(selectedVector)}&color=${encodeURIComponent(lockupColor)}&descriptor=${encodeURIComponent(descriptor)}&name=${encodeURIComponent(wordmarkName || brandName)}`,
      ),
      "_blank",
      "noopener,noreferrer",
    );
    setNotice("Brand guide opened. Choose Print → Save as PDF.");
  }

  async function deleteConcept(generation: GeneratedConcept) {
    const confirmed = await requestConfirmation({
      kicker: "Permanent action / Concept",
      title: `Delete ${generation.directionTitle}?`,
      body: "This concept and any linked assets will be permanently removed. No replacement will be generated.",
      confirmLabel: "Delete concept",
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
        "Delete concept",
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
    setNotice("Concept deleted. No replacement was generated.");
  }

  async function deleteAsset(asset: StudioAsset) {
    const confirmed = await requestConfirmation({
      kicker: "Permanent action / SVG",
      title: `Delete ${asset.label}?`,
      body: "This production SVG will be permanently removed from the project. Reconstruct again if you need a new master.",
      confirmLabel: "Delete SVG",
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
        "Delete SVG",
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
    setNotice(`${asset.label} deleted.`);
  }

  async function selectGeneratedConcept(generationId: string) {
    const generation = generatedConcepts.find((item) => item.id === generationId);
    if (!generation || !projectId) return;
    setSelectedConcept(generation.directionKey);
    const alreadySelected = selectedConceptIds.includes(generation.id);
    if (alreadySelected) {
      setSelectedConceptIds([]);
      setNotice(`${generation.directionTitle} removed from the refinement shortlist.`);
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
        ? `${generation.directionTitle} selected for refinement.`
        : "The direction is selected locally, but could not be saved.",
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
        closest < 28
          ? "Similarity warning: at least two concepts have a closely related silhouette. Review them manually; Loopen will not regenerate without your action."
          : "",
      );
    } catch {
      setDiversityWarning("Automatic silhouette comparison was unavailable. Review variety manually.");
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
              <span>Method / 01—05</span>
              <button type="button" onClick={() => setIsMethodOpen(false)}>
                Close <i>×</i>
              </button>
            </header>
            <div className="method-intro">
              <p>Our point of view</p>
              <h2 id="method-title">
                Direction before
                <br />
                <em>decoration.</em>
              </h2>
              <p>
                AI expands the field. Strategy sets the boundaries. Independent
                juries remove noise. Human selection makes the identity specific.
              </p>
            </div>
            <div className="method-steps">
              {[
                ["01", "Brand signal", "The client defines meaning, audience, position, constraints and color intent before form exists.", "Human + GPT"],
                ["02", "Category refusal", "The system identifies repeated category codes, competitor ownership and the visual territory the brand should avoid.", "GPT strategy"],
                ["03", "Distinct territories", "Gemini creates four genuinely different flat logo concepts from separate brand ideas—not multiple seeds of one shape.", "Gemini image"],
                ["04", "Refinement + jury", "Selected concepts receive a focused craft pass. Gemini and GPT judge idea, distinction, optical quality and 24 px clarity independently.", "Dual jury"],
                ["05", "Production master", "Only an approved logo is rebuilt as controlled SVG geometry, paired with a separate wordmark and tested across contexts.", "GPT + human"],
              ].map(([number, title, body, owner]) => (
                <section key={number}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                  <b>{owner}</b>
                </section>
              ))}
            </div>
            <footer>
              <blockquote>
                AI should multiply <em>directions,</em> not multiply noise.
              </blockquote>
              <button type="button" onClick={() => {
                setIsMethodOpen(false);
                document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
              }}>
                Start with the brief <span>↘</span>
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
              <span>Decision</span>
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
                    Keep exploring
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
        <a className="wordmark" href="#top" aria-label="Loopen home">
          <span className="wordmark-glyph" aria-hidden="true">
            ∞
          </span>
          LOOPEN
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a href="#brief">Studio</a>
          <a href="#manifesto">Method</a>
          <a href="#manifesto">About</a>
        </nav>
        <div className="header-actions">
          <button
            className="session-reset"
            type="button"
            onClick={() => void resetStudioToFresh()}
          >
            New session
          </button>
          {hasWorkspace && (
            <button
              className="signal-pill"
              type="button"
              onClick={() => setIsSignalsOpen(true)}
              title="Studio signals — prepaid creative energy"
            >
              <span className="signal-orb" aria-hidden="true" />
              {signalBalance === null ? "Signals" : `${signalBalance} signals`}
            </button>
          )}
          {isGuestSession && (
            <button
              className="project-pill enter-pill"
              type="button"
              onClick={() => {
                setAuthStatus(
                  "Enter with email and password, or request a magic link.",
                );
                setIsAuthOpen(true);
              }}
              title="Enter with email"
            >
              <span className="online-dot" />
              Enter
            </button>
          )}
          {hasWorkspace && (
            <button
              className="project-pill"
              type="button"
              onClick={() => setIsHistoryOpen((current) => !current)}
              title="Open project history"
            >
              <span className="online-dot" />
              {`${projects.length} projects`}
            </button>
          )}
        </div>
      </header>
      {isAuthOpen && (
        <div className="studio-gate-backdrop" role="presentation" onClick={() => setIsAuthOpen(false)}>
          <section
            className="studio-gate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-gate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="studio-gate-index">∞</p>
            <p>01 / Private entry</p>
            <h2 id="studio-gate-title">
              Enter the
              <em> studio.</em>
            </h2>
            <div className="studio-gate-copy">
              <span>How</span>
              <p>
                Sign in with email + password, or request a one-time magic link —
                both paths open the same private studio.
              </p>
            </div>
            <form className="studio-gate-form" onSubmit={signInWithPassword}>
              <label>
                <span className="mini-label">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@brand.studio"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="mini-label">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  minLength={6}
                />
              </label>
              <div className="studio-gate-actions">
                <button type="button" onClick={() => setIsAuthOpen(false)}>
                  Not now
                </button>
                <button
                  className="confirm-dialog-primary"
                  type="submit"
                  disabled={Boolean(authSending)}
                >
                  {authSending === "password" ? "Signing in…" : "Enter studio"}
                  <span>→</span>
                </button>
              </div>
              <div className="studio-gate-magic">
                <span>Or magic link</span>
                <p>No password — we email a private entry key to the address above.</p>
                <button
                  type="button"
                  disabled={Boolean(authSending)}
                  onClick={() => void sendEntryLink()}
                >
                  {authSending === "magic" ? "Sending…" : "Send entry link"}
                  <span>↗</span>
                </button>
              </div>
            </form>
            {authStatus && <p className="studio-gate-status">{authStatus}</p>}
            <p className="studio-gate-note">
              First magic-link entry includes {signalCosts?.generateBatch ?? 4}{" "}
              welcome signals — enough for one full concept batch.
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
              <p>Signal vault</p>
              <button type="button" onClick={() => setIsSignalsOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <h2 id="signal-vault-title">
              Creative energy,
              <em> prepaid.</em>
            </h2>
            <p className="signal-vault-balance">
              <strong>{signalBalance ?? "—"}</strong>
              <span>signals on hand</span>
            </p>
            <ul className="signal-cost-list">
              <li><span>4 concepts</span><b>{signalCosts?.generateBatch ?? 4}</b></li>
              <li><span>+1 concept</span><b>{signalCosts?.extraConcept ?? 1}</b></li>
              <li><span>Pro refine</span><b>{signalCosts?.refine ?? 2}</b></li>
              <li><span>Vector master</span><b>{signalCosts?.vectorize ?? 1}</b></li>
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
                      blurb: "One full loop: brief → four concepts → refine → vector.",
                    },
                    {
                      id: "studio",
                      label: "Studio",
                      signals: 40,
                      priceUsd: 39,
                      blurb: "Room to explore territories and lock a mark properly.",
                    },
                    {
                      id: "atelier",
                      label: "Atelier",
                      signals: 120,
                      priceUsd: 99,
                      blurb: "A working stock for multiple brands in the same season.",
                    },
                  ]
              ).map((pack) => (
                <article className="signal-pack" key={pack.id}>
                  <span>{pack.label}</span>
                  <strong>{pack.signals}</strong>
                  <small>signals</small>
                  <p>{pack.blurb}</p>
                  <button
                    type="button"
                    disabled={!billingEnabled || checkoutPackId === pack.id || !user}
                    onClick={() => void startSignalCheckout(pack.id)}
                  >
                    {!user
                      ? "Enter first"
                      : !billingEnabled
                        ? "Billing soon"
                        : checkoutPackId === pack.id
                          ? "Redirecting…"
                          : `$${pack.priceUsd}`}
                  </button>
                </article>
              ))}
            </div>
            {!billingEnabled && (
              <p className="signal-vault-note">
                Stripe keys are not configured yet — welcome signals still work for the first loop.
              </p>
            )}
          </section>
        </div>
      )}
      {user && isHistoryOpen && (
        <aside className="history-drawer" aria-label="Project history">
          <div className="history-head">
            <div>
              <span>
                {isAdmin
                  ? "Admin workspace"
                  : role === "user"
                    ? "Private workspace"
                    : "Guest workspace"}
              </span>
              <strong>{user.displayName}</strong>
              <small className="history-email">
                {user.email}
                {role !== "guest" ? ` · ${role}` : ""}
              </small>
            </div>
            <button type="button" onClick={() => setIsHistoryOpen(false)} aria-label="Close history">×</button>
          </div>
          <div className="history-account-row">
            <button type="button" onClick={() => setIsSignalsOpen(true)}>
              {signalBalance === null ? "Signals" : `${signalBalance} signals`} ↗
            </button>
            <a href="/api/auth/logout?return_to=/">Leave studio</a>
          </div>
          <div className="history-list" ref={historyListRef}>
            {projects.length ? projects.map((project) => (
              <div className="history-project" key={project.id}>
                <button
                  className="history-open"
                  type="button"
                  onClick={() => openProject(project.id)}
                >
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  <strong>{project.brandName}</strong>
                  <small>{project.status}</small>
                </button>
                <button
                  className="history-delete"
                  type="button"
                  onClick={() => deleteProject(project)}
                  disabled={deletingProjectId === project.id}
                  aria-label={`Delete ${project.brandName} project`}
                  title="Delete project"
                >
                  {deletingProjectId === project.id ? (
                    <RequestDrop label="Deleting project" />
                  ) : "×"}
                </button>
              </div>
            )) : <p>No saved projects yet.</p>}
          </div>
          {projects.length > 3 && (
            <div className="history-scroll-controls" aria-label="Scroll project history">
              <button
                type="button"
                onClick={() => scrollProjectHistory(-1)}
                aria-label="Scroll projects up"
              >
                ↑
              </button>
              <span>Browse projects</span>
              <button
                type="button"
                onClick={() => scrollProjectHistory(1)}
                aria-label="Scroll projects down"
              >
                ↓
              </button>
            </div>
          )}
          <span className="local-session-note">Tab session autosaved</span>
        </aside>
      )}

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span>AI creative direction</span>
          <span>Tel Aviv / 2026</span>
        </div>
        <h1>
          Brands with
          <span className="hero-line">
            <i className="loop-orbit" aria-hidden="true" />
            <em>memory.</em>
          </span>
        </h1>
        <div className="hero-footer">
          <p>
            Loopen turns a sharp brand brief into an original, scalable identity
            system — guided by strategy, refined by taste.
          </p>
          <a className="circle-cta" href="#brief" aria-label="Start a brand brief">
            <span>Start</span>
            <b>↘</b>
          </a>
        </div>
      </section>

      <section className="ticker" aria-label="Product capabilities">
        <div>
          <span>Strategy first</span>
          <i>✦</i>
          <span>Distinct directions</span>
          <i>✦</i>
          <span>Editable vectors</span>
          <i>✦</i>
          <span>Human selection</span>
          <i>✦</i>
        </div>
      </section>

      <section className="studio-section" id="brief">
        <div className="section-heading">
          <p className="eyebrow">01 / Brand signal</p>
          <h2>
            Define the feeling
            <br />
            before the form.
          </h2>
          <p className="section-note">
            A focused brief gives the system taste, boundaries and a reason for
            every visual decision.
          </p>
        </div>

        <div className="brief-panel">
          <div className="premium-fields brief-template-select">
            <CreativeSelect
              label="Brief template"
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
                { value: "custom", label: "Blank / custom brief" },
                ...BRIEF_TEMPLATES.map((template) => ({
                  value: template.id,
                  label: `${template.label} — ${template.industryLabel}`,
                })),
              ]}
            />
          </div>
          <div className="field-row">
            <label htmlFor="brand-name">Brand name *</label>
            <span>01</span>
            <input
              id="brand-name"
              value={brandName}
              placeholder="e.g. Acme"
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
            <label htmlFor="brand-idea">Core idea *</label>
            <span>02</span>
            <textarea
              id="brand-idea"
              rows={2}
              value={coreIdea}
              placeholder="What the brand stands for in one or two sentences"
              onChange={(event) => setCoreIdea(event.target.value)}
              required
            />
          </div>
          <div className="premium-fields">
            <label>
              <span className="mini-label">Industry *</span>
              <input
                value={industry}
                placeholder="e.g. Architecture, coffee, clean energy"
                onChange={(event) => setIndustry(event.target.value)}
                required
              />
            </label>
            <label>
              <span className="mini-label">What the company does *</span>
              <textarea
                value={companyDescription}
                placeholder="Short description of products, services and markets"
                onChange={(event) => setCompanyDescription(event.target.value)}
                rows={3}
                required
              />
            </label>
            <label>
              <span className="mini-label">Positioning</span>
              <textarea
                value={positioning}
                placeholder="How the brand sits vs competitors"
                onChange={(event) => setPositioning(event.target.value)}
                rows={2}
              />
            </label>
            <label>
              <span className="mini-label">Competitors</span>
              <textarea
                value={competitors}
                placeholder="Names or URLs, separated by commas"
                onChange={(event) => setCompetitors(event.target.value)}
                rows={2}
              />
            </label>
          </div>
          <div className="personality-row">
            <div className="field-label">
              <label>Personality</label>
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
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="premium-fields production-brief">
            <label>
              <span className="mini-label">Visual direction</span>
              <textarea
                value={visualDirection}
                placeholder="Mood, form language, what the mark should feel like"
                onChange={(event) => setVisualDirection(event.target.value)}
                rows={3}
              />
            </label>
            <label>
              <span className="mini-label">Audience</span>
              <textarea
                value={audience}
                placeholder="Who the brand is for"
                onChange={(event) => setAudience(event.target.value)}
                rows={2}
              />
            </label>
            <CreativeSelect
              label="Color strategy"
              value={colorApproach}
              onChange={(value) =>
                setColorApproach(
                  value as NonNullable<PremiumBrief["colorApproach"]>,
                )
              }
              options={[
                { value: "propose", label: "Let the system propose" },
                { value: "existing", label: "Use existing brand colors" },
                { value: "mood", label: "Build from a color mood" },
              ]}
            />
            {colorApproach === "existing" && (
              <label>
                <span className="mini-label">Existing colors</span>
                <textarea
                  value={brandColors}
                  onChange={(event) => setBrandColors(event.target.value)}
                  rows={2}
                  placeholder="#111111, #F4F1E8 — add names or usage notes"
                />
              </label>
            )}
            {colorApproach !== "existing" && (
              <label>
                <span className="mini-label">Desired color mood</span>
                <textarea
                  value={colorMood}
                  placeholder="e.g. Warm neutrals with one sharp accent"
                  onChange={(event) => setColorMood(event.target.value)}
                  rows={2}
                />
              </label>
            )}
            <label>
              <span className="mini-label">Primary usage</span>
              <textarea
                value={usage}
                placeholder="Website, app, packaging, signage…"
                onChange={(event) => setUsage(event.target.value)}
                rows={2}
              />
            </label>
            <label className="wide-field">
              <span className="mini-label">Avoid</span>
              <textarea
                value={avoid}
                placeholder="Clichés, motifs or styles to stay away from"
                onChange={(event) => setAvoid(event.target.value)}
                rows={3}
              />
            </label>
          </div>
          <div className="generate-row">
            <p>
              <span>{signalCosts?.generateBatch ?? 4}</span> signals · four explorations · dual jury · Pro refine later
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generating logo concepts…"
                : user
                  ? "Generate 4 logo concepts"
                  : "Enter to generate"}
              {isGenerating ? (
                <RequestDrop label="Generating logo concepts" />
              ) : (
                <span>↗</span>
              )}
            </button>
          </div>
          {isGuestSession && (
            <p className="auth-hint">
              Enter with email to save briefs, spend signals and keep each
              project private.
            </p>
          )}
          {notice && (
            <p className="inline-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </section>

      <section className="strategy-section" id="research" aria-label="Brand research and strategy">
          <div className="strategy-heading">
            <p className="eyebrow">02 / Category research</p>
            <h2>Know the category.<br />Refuse its clichés.</h2>
            <p>
              {strategy?.differentiation ??
                (isGenerating
                  ? "Research sets the boundaries for the creative work: what the category repeats, what competitors already own and where Ketchup can be unmistakably different."
                  : "Submit the brief to establish category codes, competitor risks, typography and a client-directed color strategy before concepts are created.")}
            </p>
          </div>
          {strategy ? (
            <button
              className="strategy-toggle"
              type="button"
              aria-expanded={isStrategyOpen}
              onClick={() => setIsStrategyOpen((current) => !current)}
            >
              {isStrategyOpen ? "Hide research" : "View research details"}
              <span>{isStrategyOpen ? "−" : "+"}</span>
            </button>
          ) : (
            <div className={`strategy-pending ${isGenerating ? "active" : ""}`}>
              <div className="research-status">
                <span>{isGenerating ? "Research in progress" : "Awaiting brief"}</span>
                <b>{isGenerating ? "04 signals" : "00 / 04"}</b>
              </div>
              <div className="research-route" aria-label="Research stages">
                {[
                  ["01", "Category codes"],
                  ["02", "Competitor field"],
                  ["03", "White space"],
                  ["04", "Color logic"],
                ].map(([number, label]) => (
                  <div className="research-node" key={number}>
                    <i aria-hidden="true" />
                    <span>{number}</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              </div>
              {!isGenerating && (
                <p>Submit the brand signal above to activate the research map.</p>
              )}
            </div>
          )}
          {strategy && isStrategyOpen && <div className="strategy-grid">
            <article>
              <span>Visual codes</span>
              {strategy.categoryCodes.map((item) => <p key={item}>{item}</p>)}
            </article>
            <article>
              <span>Competitor risks</span>
              {strategy.competitorRisks.map((item) => <p key={item}>{item}</p>)}
            </article>
            <article>
              <span>Typography direction</span>
              <p>{strategy.typography}</p>
            </article>
            <article>
              <span>
                {colorApproach === "existing"
                  ? "Client palette"
                  : "Proposed palette"}
              </span>
              <div className="palette-row">
                {strategy.palette.map((color) => (
                  <button
                    key={color}
                    type="button"
                    title={`Use ${color}`}
                    style={{ background: color }}
                    onClick={() => setLockupColor(color)}
                  >
                    <i>{color}</i>
                  </button>
                ))}
              </div>
            </article>
          </div>}
          {strategy && isStrategyOpen && <p className="trademark-notice">Trademark note — {strategy.trademarkNotice}</p>}
        </section>

      <section className="concepts-section" id="concepts">
        <div className="concepts-header">
          <div>
            <p className="eyebrow light">03 / Concept territories</p>
            <h2>Different ideas. Not different seeds.</h2>
          </div>
          <p>
            Each route begins with a different brand idea and arrives as a flat,
            usable logo concept ready for professional selection and refinement.
          </p>
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
                    ? `Deselect ${generated.directionTitle}`
                    : `Select ${generated.directionTitle}`
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
                    title={generated.reviewReason ?? "Manual review required"}
                  >
                    {generated.reviewStatus ?? "Review"}
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
                    <span>Read jury critique</span>
                    <b>{generated.qualityScore ? `${generated.qualityScore}/100` : "↗"}</b>
                  </button>
                </div>
                <div className="concept-card-actions">
                  <span className="select-indicator" aria-hidden="true">
                    {isActive ? "Selected" : "Select"}
                  </span>
                  <button
                    className="delete-concept"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteConcept(generated);
                    }}
                    aria-label={`Delete ${generated.directionTitle}`}
                  >
                    Delete
                  </button>
                </div>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="concept-empty">
            <span>Awaiting a real brief</span>
            <strong>No sample logos. No invented scores.</strong>
            <p>
              Complete the brief and generate four original flat logo concepts.
              Only real generated identity work will appear here.
            </p>
            <a href="#brief">Complete the brief ↑</a>
          </div>
        )}

        {generatedConcepts.length > 0 && generatedConcepts.length < 8 && (
          <div className="more-concepts">
            <span>{generatedConcepts.length} concepts ready · next action makes exactly 1 image request</span>
            <button
              type="button"
              onClick={generateMore}
              disabled={isGeneratingMore}
            >
              {isGeneratingMore ? "Generating one more…" : "More concept +1"}
              {isGeneratingMore && <RequestDrop label="Generating one more study" />}
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
            <span>Architecture shortlist</span>
            <strong>
              {selectedConceptIds.length ? "1 selected" : "0 selected"}
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
                Download PNG ↓
              </a>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setNotice("Generate real concepts to download a PNG.")
                }
              >
                Download PNG
              </button>
            )}
            <button
              className="approve-button"
              type="button"
              onClick={refineSelected}
              disabled={isRefining || selectedConceptIds.length === 0}
            >
              {isRefining ? "Reducing…" : `Reduce ${selectedConceptIds.length || ""} selected`}
              {isRefining ? <RequestDrop label="Reducing selected studies" /> : <span>→</span>}
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
          <p className="eyebrow">04 / Production pipeline</p>
          <h2>From chosen thought<br />to usable identity.</h2>
          <p>Every stage keeps a visible parent, so the creative decision never disappears inside a black box.</p>
        </div>

        <div className="workflow-stage">
          <div className="stage-index"><span>01</span><strong>Logo refinement</strong></div>
          <div className="asset-grid">
            {refinements.length ? refinements.map((asset) => (
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
                <img
                  src={resolveMediaUrl(asset.url)}
                  alt={`${brandName} ${asset.label}`}
                />
                <span>{asset.label}</span>
                <small>
                  {asset.model}
                  {asset.qualityScore ? ` · QC ${asset.qualityScore}/100` : ""}
                </small>
                <b
                  className={`asset-verdict ${
                    asset.reviewStatus === "Recommended" ? "approved" : "advisory"
                  }`}
                >
                  {asset.reviewStatus === "Recommended"
                    ? "Recommended"
                    : "Review notes"}
                </b>
                {selectedRefinement === asset.id && vectorSourceGeneration && (
                  <div
                    className="segmented vector-source-toggle"
                    role="group"
                    aria-label="SVG source"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={vectorSourceMode === "original" ? "active" : ""}
                      onClick={() => setVectorSourceMode("original")}
                    >
                      Original concept
                    </button>
                    <button
                      type="button"
                      className={vectorSourceMode === "refine" ? "active" : ""}
                      onClick={() => setVectorSourceMode("refine")}
                    >
                      Refinement
                    </button>
                  </div>
                )}
              </article>
            )) : (
              <div className="empty-stage">
                <strong>Professional craft pass</strong>
                <p>
                  {isRefining
                    ? "Nano Banana is refining the selected concept. SVG reconstruction unlocks when this pass finishes."
                    : selectedConceptIds.length
                      ? "Use Reduce in the shortlist above to start the craft pass. Or reconstruct SVG directly from the original concept."
                      : "Choose one logo concept above. Nano Banana preserves the idea and silhouette while improving proportions, counterspace and small-size clarity."}
                </p>
                {isRefining && (
                  <p className="inline-notice" role="status">
                    Refining selected logo…
                    <RequestDrop label="Refining selected logos" />
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
              {isVectorizing ? "Creating SVG…" : "Reconstruct selected"}
              {isVectorizing ? <RequestDrop label="Creating SVG master" /> : <span>→</span>}
              </button>
            </div>
          )}
          {!isRefining && selectedReduction && !juryRecommends && (
            <div className="transition-advisory" role="status">
              <span>Jury recommendation</span>
              <strong>Craft notes available — SVG is still unlocked.</strong>
              <p>
                {selectedReduction.reviewReason ??
                  "The dual jury left review notes. You can refine again or build SVG from this mark or the original concept."}
              </p>
              <button type="button" onClick={refineSelected} disabled={isRefining}>
                {isRefining ? "Refining again…" : "Optional: try another refinement"}
                {isRefining ? <RequestDrop label="Retrying logo refinement" /> : <span>↗</span>}
              </button>
            </div>
          )}
        </div>

        <div className="workflow-stage">
          <div className="stage-index"><span>02</span><strong>Vector</strong></div>
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
                    aria-label={`Delete ${asset.label}`}
                  >
                    Delete
                  </button>
                </div>
              </article>
            )) : (
              <div className="empty-stage">
                <strong>Geometric SVG master</strong>
                <p>Rebuild from the original concept or a refinement — jury notes recommend, they never block.</p>
              </div>
            )}
          </div>
        </div>

        <div className={`lockup-editor ${selectedVectorAsset ? "" : "locked"}`}>
          {!selectedVectorAsset ? (
            <div className="production-lock">
              <div className="production-lock-number">—</div>
              <p>Identity workspace / Locked</p>
              <h3>The controls appear<br />when the mark is real.</h3>
              <div>
                <span>Next step</span>
                <strong>Concept or refine → Geometric SVG master</strong>
              </div>
              <i aria-hidden="true">↘</i>
            </div>
          ) : (<>
          <div className="lockup-stage">
            <aside className="lockup-rail">
              <div className="rail-block">
                <p className="rail-kicker">01 / Composition</p>
                <div className="segmented">
                  <button type="button" className={lockupLayout === "horizontal" ? "active" : ""} onClick={() => setLockupLayout("horizontal")}>Horizontal</button>
                  <button type="button" className={lockupLayout === "vertical" ? "active" : ""} onClick={() => setLockupLayout("vertical")}>Vertical</button>
                  <button type="button" className={lockupLayout === "icon" ? "active" : ""} onClick={() => setLockupLayout("icon")}>Icon only</button>
                </div>
                <div className="editor-color-control">
                  <span className="mini-label">Color</span>
                  <div className="editor-color-options">
                    {lockupPalette.map((color) => (
                      <button
                        type="button"
                        key={color}
                        className={lockupColor.toLowerCase() === color.toLowerCase() ? "active" : ""}
                        style={{ background: color }}
                        aria-label={`Use ${color}`}
                        onClick={() => setLockupColor(color)}
                      />
                    ))}
                    <label className="editor-color-picker" title="Custom color">
                      <span className="sr-only">Custom color</span>
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
                <p className="rail-kicker">02 / Type</p>
                <label className="editor-field-with-size">
                  <span className="mini-label">Wordmark name</span>
                  <div className="editor-field-line">
                    <input
                      value={wordmarkName}
                      placeholder={brandName || "Brand name"}
                      onChange={(event) => setWordmarkName(event.target.value)}
                    />
                    <SizeSquareSelect
                      label="Wordmark"
                      value={wordmarkSize}
                      onChange={setWordmarkSize}
                      options={WORDMARK_SIZE_OPTIONS}
                    />
                  </div>
                </label>
                <label className="editor-field-with-size">
                  <span className="mini-label">Descriptor</span>
                  <div className="editor-field-line">
                    <input
                      value={descriptor}
                      placeholder="Short line under the wordmark"
                      onChange={(event) => setDescriptor(event.target.value)}
                    />
                    <SizeSquareSelect
                      label="Descriptor"
                      value={descriptorSize}
                      onChange={setDescriptorSize}
                      options={DESCRIPTOR_SIZE_OPTIONS}
                    />
                  </div>
                </label>
                <CreativeSelect
                  label="Wordmark character"
                  value={wordmarkStyle}
                  onChange={setWordmarkStyle}
                  options={[
                    { value: "modern", label: "Modern grotesk" },
                    { value: "geometric", label: "Geometric" },
                    { value: "humanist", label: "Humanist" },
                    { value: "editorial", label: "Editorial serif" },
                  ]}
                />
                <CreativeSelect
                  label="Case"
                  value={wordmarkCase}
                  onChange={(value) => setWordmarkCase(value as typeof wordmarkCase)}
                  options={[
                    { value: "original", label: "Original" },
                    { value: "upper", label: "Uppercase" },
                    { value: "lower", label: "Lowercase" },
                  ]}
                />
              </div>

              <div className="rail-block">
                <p className="rail-kicker">03 / Optics</p>
                <label className="creative-range">
                  <span className="mini-label">Weight — {wordmarkWeight}</span>
                  <input style={{ "--range-progress": `${((wordmarkWeight - 400) / 400) * 100}%` } as CSSProperties} type="range" min="400" max="800" step="100" value={wordmarkWeight} onChange={(event) => setWordmarkWeight(Number(event.target.value))} />
                </label>
                <label className="creative-range">
                  <span className="mini-label">Tracking — {wordmarkTracking}</span>
                  <input style={{ "--range-progress": `${((wordmarkTracking + 8) / 16) * 100}%` } as CSSProperties} type="range" min="-8" max="8" value={wordmarkTracking} onChange={(event) => setWordmarkTracking(Number(event.target.value))} />
                </label>
                <label className="creative-range">
                  <span className="mini-label">
                    Mark scale — {markScale}% · {markSizePx}px
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
              <span>Responsive test</span>
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
              <span>Contrast test</span>
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
              <span>Production checks</span>
              <ul>
                <li>Single-color silhouette</li>
                <li>Small-size legibility</li>
                <li>Light and dark backgrounds</li>
                <li>Editable SVG paths</li>
              </ul>
            </article>
          </div>
          <div className="export-row">
            <div><span>03</span><strong>Export system</strong></div>
            <div>
              <button type="button" onClick={() => void exportLockup("svg")} disabled={!selectedVector || Boolean(exportingKey)}>
                SVG {exportingKey === `svg-${lockupLayout}-master` ? <RequestDrop label="Exporting SVG" /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png")} disabled={!selectedVector || Boolean(exportingKey)}>
                PNG {exportingKey === `png-${lockupLayout}-master` ? <RequestDrop label="Exporting PNG" /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("webp")} disabled={!selectedVector || Boolean(exportingKey)}>
                WebP {exportingKey === `webp-${lockupLayout}-master` ? <RequestDrop label="Exporting WebP" /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 48)} disabled={!selectedVector || Boolean(exportingKey)}>
                Favicon 48 {exportingKey === "png-icon-48" ? <RequestDrop label="Exporting favicon" /> : "↓"}
              </button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 1024)} disabled={!selectedVector || Boolean(exportingKey)}>
                Social avatar {exportingKey === "png-icon-1024" ? <RequestDrop label="Exporting social avatar" /> : "↓"}
              </button>
              <button type="button" onClick={printBrandGuide} disabled={!selectedVector}>Brand guide / PDF ↗</button>
            </div>
          </div>
          </>)}
        </div>
      </section>

      <section className="system-section" id="system">
        <div className="system-left">
          <p className="eyebrow">05 / Brand system</p>
          <h2>
            One idea.
            <br />
            Every context.
          </h2>
          <div className="system-number">{selectedVectorAsset ? "03" : "—"}</div>
          <p className="system-caption">
            {selectedVectorAsset
              ? "Three live identity contexts built from the approved master."
              : "The brand system unlocks after an approved SVG master exists."}
          </p>
        </div>
        {selectedVectorAsset ? (
          <div className="system-board">
            <article
              className="application-card identity-drawing-card"
              style={{ background: strategy?.palette?.[2] ?? "var(--acid)" }}
            >
              <span className="app-label">Drawing title block / 01</span>
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
              <span className="app-label">Proposal cover / 02</span>
              <div className={`dynamic-wordmark wordmark-${wordmarkStyle}`}>
                {displayBrandName}
              </div>
              <p>{descriptor || "Architecture with a point of view."}</p>
            </article>
            <article className="application-card identity-scale-card">
              <span className="app-label">Responsive mark / 03</span>
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
              <p>One master. Controlled at every scale.</p>
            </article>
          </div>
        ) : (
          <div className="system-locked">
            <span>Waiting for a master</span>
            <strong>No placeholder brand system.</strong>
            <p>
              Approve a refined logo and create its geometric SVG. Real
              applications will then be composed from the actual brand mark,
              wordmark and selected palette.
            </p>
            <i aria-hidden="true">○</i>
          </div>
        )}
      </section>

      <section className="manifesto" id="manifesto">
        <p className="eyebrow">Our point of view</p>
        <blockquote>
          AI should multiply <span>directions,</span>
          <br />
          not multiply noise.
        </blockquote>
        <div className="manifesto-footer">
          <p>
            Strategy makes it relevant. Selection makes it distinct. Craft makes
            it last.
          </p>
          <button
            className="text-button"
            type="button"
            onClick={() => setIsMethodOpen(true)}
          >
            Read the Loopen method <span>↗</span>
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-signal">
          <span><i /> System online</span>
          <p>Independent AI identity studio<br />Tel Aviv / 2026</p>
        </div>
        <div className="footer-statement">
          <span>One sharp brief.</span>
          <strong>
            A brand with
            <br />
            somewhere to <em>go.</em>
          </strong>
        </div>
        <nav className="footer-route" aria-label="Page sections">
          {[
            ["01", "Brief", "#brief"],
            ["02", "Research", "#research"],
            ["03", "Territories", "#concepts"],
            ["04", "Production", "#workflow"],
            ["05", "System", "#system"],
          ].map(([number, label, href]) => (
            <a href={href} key={number}>
              <span>{number}</span>
              <strong>{label}</strong>
              <i>↘</i>
            </a>
          ))}
        </nav>
        <div className="footer-brand-row">
          <a className="footer-wordmark" href="#top">
            LOOPEN<span>®</span>
          </a>
          <div className="footer-orbit" aria-hidden="true"><i /></div>
          <div className="footer-meta">
            <p>Brand systems,<br />not random logos.</p>
            <button type="button" onClick={() => setIsMethodOpen(true)}>
              Read the method ↗
            </button>
          </div>
          <a className="back-top" href="#top">
            <span>Back to top</span>
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
      ? "Studio session restored after reload."
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
