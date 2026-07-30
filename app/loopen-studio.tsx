"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type StudioUser = {
  displayName: string;
  email: string;
};

type GeneratedConcept = {
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

type BrandStrategy = {
  categoryCodes: string[];
  competitorRisks: string[];
  differentiation: string;
  typography: string;
  palette: string[];
  trademarkNotice: string;
};

type PremiumBrief = {
  audience?: string;
  avoid?: string;
  companyDescription?: string;
  competitors?: string;
  colorApproach?: "propose" | "existing" | "mood";
  brandColors?: string;
  colorMood?: string;
  coreIdea?: string;
  industry?: string;
  logoType?: "abstract" | "monogram" | "wordmark" | "emblem" | "combination";
  personalities?: string[];
  positioning?: string;
  strategy?: BrandStrategy;
  usage?: string;
  visualDirection?: string;
};

type StudioAsset = {
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
];

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
    <div className="creative-select" ref={root}>
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

export default function LoopenStudio({
  signInPath,
  user,
}: {
  signInPath: string;
  user: StudioUser | null;
}) {
  const [selectedConcept, setSelectedConcept] = useState("continuous");
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [generatedConcepts, setGeneratedConcepts] = useState<
    GeneratedConcept[]
  >([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("Ketchup");
  const [coreIdea, setCoreIdea] = useState(
    "Architecture turns constraints into opportunity. Create an original inhabitable structure in which two or three precise masses form one memorable shared void. A daring but believable cantilever, shift or cut should transform weight into openness and rigor into an unexpected human moment. The final identity must preserve this spatial idea rather than merely depict a building.",
  );
  const [industry, setIndustry] = useState(
    "Contemporary architecture, interiors and spatial design",
  );
  const [companyDescription, setCompanyDescription] = useState(
    "Ketchup is an independent architecture and spatial-design studio working across residential, hospitality, retail and cultural projects. The studio treats budgets, sites, regulations and existing structures as creative material. Its work combines rigorous planning, clear construction and generous public or shared space with one surprising intervention that makes each project recognisable, useful and emotionally engaging.",
  );
  const [audience, setAudience] = useState(
    "Design-literate private clients, progressive developers, hospitality and retail brands, cultural institutions and entrepreneurs. They value original thinking and strong authorship, but also expect buildability, commercial intelligence, clarity, reliability and lasting cultural relevance.",
  );
  const [positioning, setPositioning] = useState(
    "A sharp, independent architecture practice positioned between corporate predictability and self-indulgent experimentation. Ketchup is conceptually bold but practical, playful without becoming childish, and precise without feeling sterile. The identity should feel confident in an architecture biennale, on construction drawings and on a building façade.",
  );
  const [competitors, setCompetitors] = useState(
    "Reference landscape: OMA, MVRDV, Snøhetta, Assemble, Space10, Schemata Architects, Studio Muoto and contemporary independent architecture practices. Do not imitate their identities, projects or signature buildings; use them only as a benchmark for conceptual clarity, cultural confidence and professional execution.",
  );
  const [colorApproach, setColorApproach] =
    useState<NonNullable<PremiumBrief["colorApproach"]>>("propose");
  const [brandColors, setBrandColors] = useState("");
  const [colorMood, setColorMood] = useState(
    "Warm architectural neutrals with one cultured, energetic accent; contemporary, tactile and confident rather than corporate or fashionable.",
  );
  const [logoType, setLogoType] =
    useState<PremiumBrief["logoType"]>("combination");
  const [visualDirection, setVisualDirection] = useState(
    "Stage 1 — architectural discovery: invent a compact, believable contemporary pavilion or small civic structure, shown as a precise monochrome study model. It should use two or three primary volumes, controlled asymmetry, legible support and circulation, and one inhabitable negative space such as a passage, courtyard or sheltered threshold. Its signature move should be a surprising but structurally credible cantilever, displacement or deep subtraction. Stage 2 — identity reduction: preserve the exact massing relationship, structural tension and signature void while removing perspective, material, windows, stairs and incidental detail. Rebuild it as a flat near-black symbol made from two to four closed shapes, with a distinctive silhouette and excellent 16–24 px recognition. Pair it with a restrained custom Ketchup wordmark; the symbol must also work alone.",
  );
  const [usage, setUsage] = useState(
    "Primary: website header, social avatar, proposals, architectural drawings, title blocks, competition boards and client presentations. Secondary: construction signage, hoarding, building graphics, wayfinding, publications, stamps, merchandise and favicon. Required variants: symbol only, horizontal and vertical lockups, positive and reversed monochrome. The mark must remain recognisable at 16 and 24 pixels and retain authority at environmental scale.",
  );
  const [avoid, setAvoid] = useState(
    "No conventional house outline, pitched roof, doorway pictogram, skyline, skyscraper, generic office block, temple façade, isolated column, floor-plan maze, drafting tool or property-development aesthetic. No hidden K, monogram, arrow, infinity loop, chain, cube, container, app icon, random rectangles or fashionable abstract blob. No tomato, bottle, sauce, red splatter or other food reference. During architectural discovery, avoid fantasy physics, decorative sculpture, people, trees and photorealistic scenery. During logo reduction, allow no perspective, windows, stairs, thin lines, gradients, shadows, textures, pseudo-text or unnecessary detail. Do not copy or closely resemble an existing building or logo.",
  );
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [personalities, setPersonalities] = useState([
    "Architectural",
    "Intelligent",
    "Playful",
    "Precise",
    "Experimental",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [notice, setNotice] = useState("");
  const [diversityWarning, setDiversityWarning] = useState("");
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [exportingKey, setExportingKey] = useState("");
  const [isMethodOpen, setIsMethodOpen] = useState(false);
  const [selectedRefinement, setSelectedRefinement] = useState("");
  const [selectedVector, setSelectedVector] = useState("");
  const [lockupLayout, setLockupLayout] = useState<"horizontal" | "vertical" | "icon">(
    "horizontal",
  );
  const [lockupColor, setLockupColor] = useState("#201f1e");
  const [descriptor, setDescriptor] = useState("Architecture with an unexpected opening");
  const [wordmarkStyle, setWordmarkStyle] = useState("modern");
  const [wordmarkCase, setWordmarkCase] = useState<"original" | "upper" | "lower">("original");
  const [wordmarkWeight, setWordmarkWeight] = useState(600);
  const [wordmarkTracking, setWordmarkTracking] = useState(-3);
  const [markScale, setMarkScale] = useState(100);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const confirmResolver = useRef<((confirmed: boolean) => void) | null>(null);

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
  const selectedReduction = refinements.find(
    (asset) => asset.id === selectedRefinement,
  );
  const canReconstruct = Boolean(
    selectedReduction?.reviewStatus === "Recommended" &&
      (selectedReduction.qualityScore ?? 0) >= 90,
  );
  const selectedVectorAsset = vectors.find(
    (asset) => asset.id === selectedVector,
  );
  const displayBrandName =
    wordmarkCase === "upper"
      ? (brandName || "Brand name").toUpperCase()
      : wordmarkCase === "lower"
        ? (brandName || "Brand name").toLowerCase()
        : brandName || "Brand name";
  const focusedGeneration = generatedConcepts.find(
    (item) => item.directionKey === selectedConcept,
  );

  useEffect(() => {
    if (!user) return;
    void loadHistory();
  }, [user]);

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

  async function loadHistory() {
    const response = await fetch("/api/project-list");
    if (!response.ok) return;
    const payload = (await response.json()) as { projects?: SavedProject[] };
    setProjects(payload.projects ?? []);
  }

  async function openProject(id: string) {
    setNotice("Loading saved project…");
    const response = await fetch(`/api/projects/${id}`);
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
    setBrandName(payload.project.brandName);
    setCoreIdea(payload.project.brief.coreIdea ?? "");
    setIndustry(payload.project.brief.industry ?? "");
    setCompanyDescription(payload.project.brief.companyDescription ?? "");
    setAudience(payload.project.brief.audience ?? "");
    setPositioning(payload.project.brief.positioning ?? "");
    setCompetitors(payload.project.brief.competitors ?? "");
    setColorApproach(payload.project.brief.colorApproach ?? "propose");
    setBrandColors(payload.project.brief.brandColors ?? "");
    setColorMood(payload.project.brief.colorMood ?? "");
    setLogoType(payload.project.brief.logoType ?? "abstract");
    setVisualDirection(payload.project.brief.visualDirection ?? "");
    setUsage(payload.project.brief.usage ?? "");
    setAvoid(payload.project.brief.avoid ?? "");
    setStrategy(payload.project.brief.strategy ?? null);
    setPersonalities(payload.project.brief.personalities ?? []);
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
    setIsHistoryOpen(false);
    setNotice(`${payload.project.brandName} project loaded.`);
    document.getElementById("workflow")?.scrollIntoView({ behavior: "smooth" });
  }

  async function deleteProject(project: SavedProject) {
    const confirmed = await requestConfirmation({
      kicker: "Permanent action / Project",
      title: `Erase ${project.brandName}?`,
      body: "The brief, architectural studies, reductions and production assets will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete project",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingProjectId(project.id);
    const response = await fetch(`/api/projects/${project.id}`, {
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
      setStrategy(null);
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

  async function generate() {
    if (!user) {
      window.location.href = signInPath;
      return;
    }

    setIsGenerating(true);
    setNotice(
      "Building four original directions. This can take up to two minutes…",
    );

    try {
      const response = await fetch("/api/generate-concepts", {
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
      const payload = (await response.json()) as {
        error?: string;
        generations?: GeneratedConcept[];
        failures?: string[];
        projectId?: string;
        strategy?: BrandStrategy;
      };

      if (!response.ok || !payload.projectId || !payload.generations?.length) {
        throw new Error(payload.error ?? "Generation could not be completed.");
      }

      setGeneratedConcepts(payload.generations);
      setProjectId(payload.projectId);
      setStrategy(payload.strategy ?? null);
      setAssets([]);
      setSelectedRefinement("");
      setSelectedVector("");
      setSelectedConcept(payload.generations[0].directionKey);
      setSelectedConceptIds([payload.generations[0].id]);
      setIsGenerating(false);
      setNotice(
        payload.failures?.length
          ? `${payload.generations.length} of 4 directions generated. ${payload.failures.length} still failed after one safety recovery.`
          : "All 4 architectural studies generated, reviewed and saved.",
      );
      void auditDiversity(payload.generations);
      void loadHistory();
      document
        .getElementById("concepts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setIsGenerating(false);
      showRequestError(
        "Architectural studies",
        error instanceof Error
          ? error.message
          : "Generation could not be completed.",
      );
    }
  }

  async function generateMore() {
    if (!projectId || generatedConcepts.length >= 8) return;
    setIsGeneratingMore(true);
    setNotice("Generating exactly one additional graphic mark with Klein 4B…");
    try {
      const response = await fetch("/api/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, actionId: crypto.randomUUID() }),
      });
      const payload = (await response.json()) as {
        error?: string;
        generations?: GeneratedConcept[];
        failures?: string[];
      };
      if (!response.ok || !payload.generations?.length) {
        throw new Error(payload.error ?? "More concepts could not be generated.");
      }
      setGeneratedConcepts((current) => [...current, ...payload.generations!]);
      void auditDiversity([...generatedConcepts, ...payload.generations]);
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
      setNotice("Select one or two concepts before refinement.");
      return;
    }
    if (!(await requestConfirmation({
      kicker: "Stage 02 / Paid generation",
      title: "Architecture becomes identity.",
      body: `Nano Banana Pro will reduce ${selectedConceptIds.length} selected architectural stud${selectedConceptIds.length > 1 ? "ies" : "y"} into flat identity symbols. The source massing and signature void will remain visible.`,
      confirmLabel: `Create ${selectedConceptIds.length} reduction${selectedConceptIds.length > 1 ? "s" : ""}`,
    }))) return;
    setIsRefining(true);
    setNotice(`Reducing ${selectedConceptIds.length} architectural stud${selectedConceptIds.length > 1 ? "ies" : "y"} into flat identity symbols…`);
    try {
      const response = await fetch(`/api/projects/${projectId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationIds: selectedConceptIds }),
      });
      const payload = (await response.json()) as {
        assets?: StudioAsset[];
        error?: string;
      };
      if (!response.ok || !payload.assets?.length) {
        showRequestError(
          "Logo reduction",
          payload.error ?? "Refinement could not be completed.",
        );
        return;
      }
      setAssets((current) => [
        ...current.filter((asset) => asset.stage !== "refine"),
        ...payload.assets!,
      ]);
      setSelectedRefinement(payload.assets[0].id);
      setNotice(`${payload.assets.length} architectural reduction${payload.assets.length > 1 ? "s are" : " is"} ready. Choose one for geometric SVG reconstruction.`);
      void loadHistory();
    } catch (error) {
      showRequestError(
        "Logo reduction",
        error instanceof Error
          ? error.message
          : "Refinement could not be completed.",
      );
    } finally {
      setIsRefining(false);
    }
  }

  async function vectorizeSelected() {
    if (!projectId || !selectedRefinement) {
      setNotice("Choose a refined symbol before vectorization.");
      return;
    }
    if (
      !selectedReduction ||
      selectedReduction.reviewStatus !== "Recommended" ||
      (selectedReduction.qualityScore ?? 0) < 90
    ) {
      setNotice(
        "This reduction did not pass both final juries. Choose a Recommended flat reduction before SVG reconstruction.",
      );
      return;
    }
    if (!(await requestConfirmation({
      kicker: "Stage 03 / Production master",
      title: "Commit to the geometry.",
      body: "The approved reduction will be rebuilt as a controlled set of closed SVG paths and tested for monochrome and small-size use.",
      confirmLabel: "Build SVG master",
    }))) return;
    setIsVectorizing(true);
    setNotice("Rebuilding the selected symbol as controlled SVG geometry…");
    try {
      const response = await fetch(`/api/projects/${projectId}/vectorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: selectedRefinement }),
      });
      const payload = (await response.json().catch(() => null)) as {
        assets?: StudioAsset[];
        error?: string;
      } | null;
      if (!response.ok || !payload?.assets?.length) {
        showRequestError(
          "SVG reconstruction",
          payload?.error ?? "Vectorization could not be completed.",
        );
        return;
      }
      setAssets((current) => [
        ...current.filter((asset) => asset.stage !== "vector"),
        ...payload.assets!,
      ]);
      setSelectedVector(payload.assets[0].id);
      setNotice("Production SVGs are ready. Adjust and export your lockup.");
      void loadHistory();
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
      const response = await fetch(`/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: selectedVector,
        color: lockupColor,
        descriptor,
        layout,
        markScale,
        wordmarkCase,
        wordmarkWeight,
        wordmarkTracking,
        wordmarkStyle,
      }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        showRequestError(
          "Asset export",
          payload.error ?? "Export could not be created.",
        );
        return;
      }
      const svgBlob = await response.blob();
      let blob = svgBlob;
      if (format !== "svg") {
      const sourceUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not render the SVG export."));
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
          (result) => (result ? resolve(result) : reject(new Error("Raster export failed."))),
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
      `/api/projects/${projectId}/brand-guide?assetId=${encodeURIComponent(selectedVector)}&color=${encodeURIComponent(lockupColor)}&descriptor=${encodeURIComponent(descriptor)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setNotice("Brand guide opened. Choose Print → Save as PDF.");
  }

  async function selectGeneratedConcept(directionKey: string) {
    setSelectedConcept(directionKey);
    const generation = generatedConcepts.find(
      (item) => item.directionKey === directionKey,
    );
    if (!generation || !projectId) return;
    const alreadySelected = selectedConceptIds.includes(generation.id);
    if (!alreadySelected && selectedConceptIds.length >= 2) {
      setNotice("You can select up to two concepts. Deselect one to continue.");
      return;
    }
    setSelectedConceptIds((current) =>
      alreadySelected
        ? current.filter((id) => id !== generation.id)
        : [...current, generation.id],
    );
    if (alreadySelected) {
      setNotice(`${generation.directionTitle} removed from the refinement shortlist.`);
      return;
    }

    const response = await fetch(`/api/projects/${projectId}/select`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: generation.id }),
    });

    setNotice(
      response.ok
        ? `${generation.directionTitle} added to the refinement shortlist (${selectedConceptIds.length + 1}/2).`
        : "The direction is selected locally, but could not be saved.",
    );
  }

  async function deleteConcept(generation: GeneratedConcept) {
    if (!(await requestConfirmation({
      kicker: "Permanent action / Direction",
      title: `Remove ${generation.directionTitle}?`,
      body: "This architectural study and its place in the current shortlist will be permanently removed.",
      confirmLabel: "Delete direction",
      tone: "danger",
    }))) return;
    const response = await fetch(`/api/images/${generation.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      showRequestError("Delete direction", "Concept could not be deleted.");
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

  async function auditDiversity(items: GeneratedConcept[]) {
    if (items.length < 2) return;
    try {
      const hashes = await Promise.all(
        items.map(
          (item) =>
            new Promise<string>((resolve, reject) => {
              const image = new Image();
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
              image.src = item.imageUrl;
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
                ["03", "Distinct territories", "Gemini creates genuinely different architectural studies from separate spatial ideas—not multiple seeds of one symbol.", "Gemini image"],
                ["04", "Reduction + jury", "Selected architecture is reduced to a flat mark. Gemini and GPT judge fidelity, distinction, craft and 24 px clarity independently.", "Dual jury"],
                ["05", "Production master", "Only an approved reduction is rebuilt as controlled SVG geometry, paired with a separate wordmark and tested across contexts.", "GPT + human"],
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
          <a href="#concepts">Method</a>
          <a href="#manifesto">About</a>
        </nav>
        <button
          className="project-pill"
          type="button"
          onClick={() =>
            user ? setIsHistoryOpen((current) => !current) : (window.location.href = signInPath)
          }
          title={user ? "Open project history" : "Sign in with ChatGPT"}
        >
          <span className="online-dot" />
          {user ? `${projects.length} projects` : "Sign in"}
        </button>
      </header>
      {user && isHistoryOpen && (
        <aside className="history-drawer" aria-label="Project history">
          <div className="history-head">
            <div>
              <span>Private workspace</span>
              <strong>{user.displayName}</strong>
            </div>
            <button type="button" onClick={() => setIsHistoryOpen(false)} aria-label="Close history">×</button>
          </div>
          <div className="history-list">
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
          <span className="local-session-note">Local private session</span>
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
          <div className="field-row">
            <label htmlFor="brand-name">Brand name *</label>
            <span>01</span>
            <input
              id="brand-name"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
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
              onChange={(event) => setCoreIdea(event.target.value)}
              required
            />
          </div>
          <div className="premium-fields">
            <label>
              <span className="mini-label">Industry *</span>
              <input value={industry} onChange={(event) => setIndustry(event.target.value)} required />
            </label>
            <label>
              <span className="mini-label">What the company does *</span>
              <textarea value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} rows={3} required />
            </label>
            <label>
              <span className="mini-label">Positioning</span>
              <textarea value={positioning} onChange={(event) => setPositioning(event.target.value)} rows={2} />
            </label>
            <label>
              <span className="mini-label">Competitors</span>
              <textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} rows={2} placeholder="Names or URLs, separated by commas" />
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
            <CreativeSelect
              label="Final identity type"
              value={logoType ?? "combination"}
              onChange={(value) =>
                setLogoType(value as PremiumBrief["logoType"])
              }
              options={[
                { value: "abstract", label: "Abstract symbol" },
                { value: "monogram", label: "Monogram" },
                { value: "wordmark", label: "Wordmark" },
                { value: "emblem", label: "Emblem" },
                { value: "combination", label: "Symbol + wordmark" },
              ]}
            />
            <label>
              <span className="mini-label">Visual direction</span>
              <textarea value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} rows={3} />
            </label>
            <label>
              <span className="mini-label">Audience</span>
              <textarea value={audience} onChange={(event) => setAudience(event.target.value)} rows={2} />
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
                  onChange={(event) => setColorMood(event.target.value)}
                  rows={2}
                />
              </label>
            )}
            <label>
              <span className="mini-label">Primary usage</span>
              <textarea value={usage} onChange={(event) => setUsage(event.target.value)} rows={2} />
            </label>
            <label className="wide-field">
              <span className="mini-label">Avoid</span>
              <textarea value={avoid} onChange={(event) => setAvoid(event.target.value)} rows={3} />
            </label>
          </div>
          <div className="generate-row">
            <p>
              <span>4</span> directed explorations · Nano Banana Pro · dual independent jury
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generating architectural studies…"
                : user
                  ? "Generate 4 architectural studies"
                  : "Sign in to generate"}
              {isGenerating ? (
                <RequestDrop label="Generating architectural studies" />
              ) : (
                <span>↗</span>
              )}
            </button>
          </div>
          {!user && (
            <p className="auth-hint">
              Sign in with ChatGPT to save briefs, generate images and keep each
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
            Each route begins as a real architectural idea. Only the selected
            structures are later reduced and tested as identity symbols.
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
              const conceptKey = generated.directionKey;
              const isActive = selectedConceptIds.includes(generated.id);
              return (
              <article
                className={`concept-card ${isActive ? "selected" : ""}`}
                key={generated.id}
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
                    src={generated.imageUrl}
                    alt={`${brandName} — ${generated.directionTitle}`}
                  />
                </div>
                <div className="concept-copy">
                  <h3>{generated.directionTitle}</h3>
                  <p>{generated.rationale ?? concept.thesis}</p>
                  <small className="review-reason">
                    {generated.reviewReason ?? "Inspect before refinement."}
                  </small>
                </div>
                <button
                  className="select-indicator"
                  type="button"
                  onClick={() => selectGeneratedConcept(conceptKey)}
                  aria-pressed={isActive}
                >
                  {isActive ? `Selected ${selectedConceptIds.indexOf(generated.id) + 1}/2` : "Select"}{" "}
                  <b>{isActive ? "●" : "+"}</b>
                </button>
                <button
                  className="delete-concept"
                  type="button"
                  onClick={() => deleteConcept(generated)}
                  aria-label={`Delete ${generated.directionTitle}`}
                >
                  Delete
                </button>
              </article>
              );
            })}
          </div>
        ) : (
          <div className="concept-empty">
            <span>Awaiting a real brief</span>
            <strong>No sample logos. No invented scores.</strong>
            <p>
              Complete the brief and generate four architectural studies.
              Only real generated maquettes will appear here.
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
              {selectedConceptIds.length}/2 selected
              {focusedGeneration ? ` · ${focusedGeneration.directionTitle}` : ""}
            </strong>
          </div>
          <div className="selected-actions">
            {generatedConcepts.find(
              (item) => item.directionKey === selectedConcept,
            ) ? (
              <a
                className="download-button"
                href={
                  generatedConcepts.find(
                    (item) => item.directionKey === selectedConcept,
                  )!.downloadUrl
                }
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

      <section className="workflow-section" id="workflow">
        <div className="workflow-heading">
          <p className="eyebrow">04 / Production pipeline</p>
          <h2>From chosen thought<br />to usable identity.</h2>
          <p>Every stage keeps a visible parent, so the creative decision never disappears inside a black box.</p>
        </div>

        <div className="workflow-stage">
          <div className="stage-index"><span>01</span><strong>Logo reduction</strong></div>
          <div className="asset-grid">
            {refinements.length ? refinements.map((asset) => (
              <button
                type="button"
                className={selectedRefinement === asset.id ? "asset-card active" : "asset-card"}
                key={asset.id}
                onClick={() => setSelectedRefinement(asset.id)}
              >
                <img src={asset.url} alt={`${brandName} ${asset.label}`} />
                <span>{asset.label}</span>
                <small>
                  {asset.model}
                  {asset.qualityScore ? ` · QC ${asset.qualityScore}/100` : ""}
                </small>
                <b
                  className={`asset-verdict ${
                    asset.reviewStatus === "Recommended" ? "approved" : "rejected"
                  }`}
                >
                  {asset.reviewStatus ?? "Review required"}
                </b>
              </button>
            )) : (
              <div className="empty-stage">
                <strong>Architecture-to-symbol reduction</strong>
                <p>Choose one or two architectural studies. Nano Banana preserves their massing and signature void while removing perspective and detail.</p>
                <button type="button" onClick={refineSelected} disabled={isRefining}>
                  {isRefining ? "Reducing…" : "Create logo reductions →"}
                  {isRefining && <RequestDrop label="Creating logo reductions" />}
                </button>
              </div>
            )}
          </div>
          {refinements.length > 0 && (
            <button
              className="stage-action"
              type="button"
              onClick={vectorizeSelected}
              disabled={
                isVectorizing ||
                !canReconstruct
              }
            >
            {isVectorizing ? "Creating SVG…" : "Reconstruct selected"}
            {isVectorizing ? <RequestDrop label="Creating SVG master" /> : <span>→</span>}
            </button>
          )}
          {selectedReduction && !canReconstruct && (
            <div className="transition-blocked" role="status">
              <span>Transition blocked</span>
              <strong>This image is still an architectural render, not an approved flat mark.</strong>
              <p>
                {selectedReduction.reviewReason ??
                  "The reduction did not pass both final juries at 90/100. SVG reconstruction is intentionally unavailable."}
              </p>
              <button type="button" onClick={refineSelected} disabled={isRefining}>
                {isRefining ? "Reducing again…" : "Try a new reduction"}
                {isRefining ? <RequestDrop label="Retrying logo reduction" /> : <span>↗</span>}
              </button>
            </div>
          )}
        </div>

        <div className="workflow-stage">
          <div className="stage-index"><span>02</span><strong>Vector</strong></div>
          <div className="asset-grid vector-grid">
            {vectors.length ? vectors.map((asset) => (
              <button
                type="button"
                className={selectedVector === asset.id ? "asset-card active" : "asset-card"}
                key={asset.id}
                onClick={() => setSelectedVector(asset.id)}
              >
                <img src={asset.url} alt={`${brandName} ${asset.label}`} />
                <span>{asset.label}</span>
                <small>{asset.model}</small>
              </button>
            )) : (
              <div className="empty-stage">
                <strong>Geometric SVG master</strong>
                <p>GPT redraws the approved symbol as a small set of controlled paths and specifies the Ketchup wordmark separately.</p>
              </div>
            )}
          </div>
        </div>

        <div className={`lockup-editor ${selectedVectorAsset ? "" : "locked"}`}>
          {!selectedVectorAsset ? (
            <div className="production-lock">
              <div className="production-lock-number">05</div>
              <p>Identity workspace / Locked</p>
              <h3>The controls appear<br />when the mark is real.</h3>
              <div>
                <span>Required state</span>
                <strong>Recommended reduction → Geometric SVG master</strong>
              </div>
              <i aria-hidden="true">↘</i>
            </div>
          ) : (<>
          <div className="editor-controls">
            <div>
              <span className="mini-label">Layout</span>
              <div className="segmented">
                <button type="button" className={lockupLayout === "horizontal" ? "active" : ""} onClick={() => setLockupLayout("horizontal")}>Horizontal</button>
                <button type="button" className={lockupLayout === "vertical" ? "active" : ""} onClick={() => setLockupLayout("vertical")}>Vertical</button>
                <button type="button" className={lockupLayout === "icon" ? "active" : ""} onClick={() => setLockupLayout("icon")}>Icon only</button>
              </div>
            </div>
            <label>
              <span className="mini-label">Descriptor</span>
              <input value={descriptor} onChange={(event) => setDescriptor(event.target.value)} />
            </label>
            <div className="editor-color-control">
              <span className="mini-label">Color</span>
              <div className="editor-color-options">
                {(strategy?.palette ?? ["#201F1E", "#F3F0EA", "#C84A32", "#FFFFFF"]).map(
                  (color) => (
                    <button
                      type="button"
                      key={color}
                      className={lockupColor.toLowerCase() === color.toLowerCase() ? "active" : ""}
                      style={{ background: color }}
                      aria-label={`Use ${color}`}
                      onClick={() => setLockupColor(color)}
                    />
                  ),
                )}
              </div>
            </div>
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
            <label className="creative-range">
              <span className="mini-label">Wordmark weight — {wordmarkWeight}</span>
              <input style={{ "--range-progress": `${((wordmarkWeight - 400) / 400) * 100}%` } as CSSProperties} type="range" min="400" max="800" step="100" value={wordmarkWeight} onChange={(event) => setWordmarkWeight(Number(event.target.value))} />
            </label>
            <label className="creative-range">
              <span className="mini-label">Tracking — {wordmarkTracking}</span>
              <input style={{ "--range-progress": `${((wordmarkTracking + 8) / 16) * 100}%` } as CSSProperties} type="range" min="-8" max="8" value={wordmarkTracking} onChange={(event) => setWordmarkTracking(Number(event.target.value))} />
            </label>
            <label className="creative-range">
              <span className="mini-label">Optical mark scale — {markScale}%</span>
              <input style={{ "--range-progress": `${((markScale - 88) / 24) * 100}%` } as CSSProperties} type="range" min="88" max="112" value={markScale} onChange={(event) => setMarkScale(Number(event.target.value))} />
            </label>
          </div>
          <div
            className={`lockup-preview ${lockupLayout}`}
            style={{ color: lockupColor }}
          >
            {selectedVectorAsset ? (
              <img
                src={selectedVectorAsset.url}
                alt=""
                style={{ transform: `scale(${markScale / 100})` }}
              />
            ) : <div className="preview-placeholder">SVG</div>}
            {lockupLayout !== "icon" && (
              <div>
                <strong
                  className={`wordmark-${wordmarkStyle}`}
                  style={{ fontWeight: wordmarkWeight, letterSpacing: `${wordmarkTracking / 100}em` }}
                >
                  {wordmarkCase === "upper"
                    ? (brandName || "Brand name").toUpperCase()
                    : wordmarkCase === "lower"
                      ? (brandName || "Brand name").toLowerCase()
                      : brandName || "Brand name"}
                </strong>
                {descriptor && <span>{descriptor}</span>}
              </div>
            )}
          </div>
          <div className="quality-lab">
            <article>
              <span>Responsive test</span>
              <div className="size-test">
                {[16, 24, 32, 64].map((size) => (
                  <figure key={size}>
                    {selectedVectorAsset ? <img src={selectedVectorAsset.url} alt="" style={{ width: size, height: size }} /> : <i />}
                    <figcaption>{size}px</figcaption>
                  </figure>
                ))}
              </div>
            </article>
            <article>
              <span>Contrast test</span>
              <div className="contrast-test">
                <div>{selectedVectorAsset && <img src={selectedVectorAsset.url} alt="" />}</div>
                <div>{selectedVectorAsset && <img src={selectedVectorAsset.url} alt="" />}</div>
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
              {refinements.find((asset) => asset.id === selectedRefinement) && (
                <a href={refinements.find((asset) => asset.id === selectedRefinement)!.downloadUrl}>Download PNG</a>
              )}
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
              <img src={selectedVectorAsset.url} alt="" />
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
                    <img
                      src={selectedVectorAsset.url}
                      alt=""
                      style={{ width: size, height: size }}
                    />
                    <figcaption>{size}px</figcaption>
                  </figure>
                ))}
              </div>
              <p>One master. Controlled at every scale.</p>
            </article>
          </div>
        ) : (
          <div className="system-locked">
            <span>05 / Waiting for a master</span>
            <strong>No placeholder brand system.</strong>
            <p>
              Approve a flat reduction and create its geometric SVG. Real
              applications will then be composed from the actual Ketchup mark,
              wordmark and selected palette.
            </p>
            <i aria-hidden="true">05</i>
          </div>
        )}
      </section>

      <section className="manifesto" id="manifesto">
        <p className="eyebrow">Our point of view</p>
        <blockquote>
          AI should multiply
          <span>directions,</span> not multiply noise.
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
