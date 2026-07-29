"use client";

import { useEffect, useMemo, useState } from "react";

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

const concepts: Concept[] = [
  {
    id: "continuous",
    index: "01",
    name: "Continuous Loop",
    thesis: "A single gesture. Movement without an endpoint.",
    className: "mark-loop",
    accent: "acid",
  },
  {
    id: "portal",
    index: "02",
    name: "Open Portal",
    thesis: "A living frame that turns attention into motion.",
    className: "mark-portal",
    accent: "cobalt",
  },
  {
    id: "signal",
    index: "03",
    name: "Loop Signal",
    thesis: "Two connected states, always exchanging energy.",
    className: "mark-signal",
    accent: "coral",
  },
  {
    id: "fold",
    index: "04",
    name: "Soft Fold",
    thesis: "A precise system with a human, tactile edge.",
    className: "mark-fold",
    accent: "lavender",
  },
];

const personalityOptions = [
  "Intelligent",
  "Playful",
  "Precise",
  "Warm",
  "Experimental",
  "Bold",
];

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
    "Architecture as a catalyst: adding energy, clarity and human character to everyday spaces. Ketchup transforms ordinary constraints into bold, memorable and highly functional environments.",
  );
  const [industry, setIndustry] = useState("Architecture and spatial design");
  const [companyDescription, setCompanyDescription] = useState(
    "Ketchup is a contemporary architecture studio designing residential, hospitality, retail and cultural spaces. The studio combines rigorous spatial thinking with playful experimentation, creating buildings and interiors that feel distinctive, useful and deeply connected to their context.",
  );
  const [audience, setAudience] = useState(
    "Design-conscious property developers, hospitality founders, cultural institutions and private clients seeking contemporary architecture with a distinctive identity.",
  );
  const [positioning, setPositioning] = useState(
    "An independent, design-led architecture studio for ambitious clients who want intelligent spaces with a strong point of view. Conceptually bold but never self-important; playful in spirit, precise in execution.",
  );
  const [competitors, setCompetitors] = useState(
    "MVRDV, OMA, BIG, Snøhetta, Assemble, Space10, Adjaye Associates",
  );
  const [logoType, setLogoType] =
    useState<PremiumBrief["logoType"]>("wordmark");
  const [visualDirection, setVisualDirection] = useState(
    "Bold editorial wordmark with architectural structure, unexpected spacing and one playful custom letter detail. Swiss modernist discipline disrupted by a warm, unconventional gesture.",
  );
  const [usage, setUsage] = useState(
    "Architectural drawings, construction-site signage, project presentations, website, social media, competition boards, wayfinding, printed publications and building plaques.",
  );
  const [avoid, setAvoid] = useState(
    "No tomatoes, ketchup bottles, sauce splashes or food imagery. Avoid houses, rooftops, skylines, floor-plan icons, columns, arches, K monograms, infinity symbols, gradients, shadows, 3D effects and generic corporate architecture branding.",
  );
  const [strategy, setStrategy] = useState<BrandStrategy | null>(null);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [personalities, setPersonalities] = useState([
    "Intelligent",
    "Playful",
    "Precise",
    "Experimental",
    "Bold",
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [notice, setNotice] = useState("");
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isVectorizing, setIsVectorizing] = useState(false);
  const [selectedRefinement, setSelectedRefinement] = useState("");
  const [selectedVector, setSelectedVector] = useState("");
  const [lockupLayout, setLockupLayout] = useState<"horizontal" | "vertical" | "icon">(
    "horizontal",
  );
  const [lockupColor, setLockupColor] = useState("#201f1e");
  const [descriptor, setDescriptor] = useState("Architecture as a catalyst");
  const [wordmarkStyle, setWordmarkStyle] = useState("modern");
  const [markScale, setMarkScale] = useState(100);

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
  const selectedVectorAsset = vectors.find(
    (asset) => asset.id === selectedVector,
  );
  const focusedGeneration = generatedConcepts.find(
    (item) => item.directionKey === selectedConcept,
  );

  useEffect(() => {
    if (!user) return;
    void loadHistory();
  }, [user]);

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
      setNotice(payload.error ?? "Project could not be loaded.");
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
    const confirmed = window.confirm(
      `Delete “${project.brandName}” and all of its generated assets? This cannot be undone.`,
    );
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
      setNotice(payload?.error ?? "Project could not be deleted.");
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
          brandName,
          coreIdea,
          personalities,
          industry,
          companyDescription,
          audience,
          positioning,
          competitors,
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
          ? `${payload.generations.length} of 4 directions generated. ${payload.failures.length} failed after retry: ${payload.failures[0]}`
          : "All 4 strategic directions generated and saved.",
      );
      void loadHistory();
      document
        .getElementById("concepts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setIsGenerating(false);
      setNotice(
        error instanceof Error
          ? error.message
          : "Generation could not be completed.",
      );
    }
  }

  async function generateMore() {
    if (!projectId || generatedConcepts.length >= 8) return;
    setIsGeneratingMore(true);
    setNotice("Generating one more fast concept with Klein 9B…");
    try {
      const response = await fetch("/api/generate-concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
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
      setNotice(
        payload.failures?.length
          ? `The additional concept could not be completed: ${payload.failures[0]}`
          : "One additional concept is ready.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "More concepts could not be generated.");
    } finally {
      setIsGeneratingMore(false);
    }
  }

  async function refineSelected() {
    if (!projectId || !selectedConceptIds.length) {
      setNotice("Select one or two concepts before refinement.");
      return;
    }
    setIsRefining(true);
    setNotice(`Creating ${selectedConceptIds.length} high-fidelity FLUX.2 Dev refinement${selectedConceptIds.length > 1 ? "s" : ""}…`);
    const response = await fetch(`/api/projects/${projectId}/refine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationIds: selectedConceptIds }),
    });
    const payload = (await response.json()) as { assets?: StudioAsset[]; error?: string };
    setIsRefining(false);
    if (!response.ok || !payload.assets?.length) {
      setNotice(payload.error ?? "Refinement could not be completed.");
      return;
    }
    setAssets((current) => [
      ...current.filter((asset) => asset.stage !== "refine"),
      ...payload.assets!,
    ]);
    setSelectedRefinement(payload.assets[0].id);
    setNotice(`${payload.assets.length} high-fidelity refinement${payload.assets.length > 1 ? "s are" : " is"} ready. Choose one for vector production.`);
    void loadHistory();
  }

  async function vectorizeSelected() {
    if (!projectId || !selectedRefinement) {
      setNotice("Choose a refined symbol before vectorization.");
      return;
    }
    setIsVectorizing(true);
    setNotice("Tracing the selected symbol into an exact SVG…");
    const response = await fetch(`/api/projects/${projectId}/vectorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: selectedRefinement }),
    });
    const payload = (await response.json()) as { assets?: StudioAsset[]; error?: string };
    setIsVectorizing(false);
    if (!response.ok || !payload.assets?.length) {
      setNotice(payload.error ?? "Vectorization could not be completed.");
      return;
    }
    setAssets((current) => [
      ...current.filter((asset) => asset.stage !== "vector"),
      ...payload.assets!,
    ]);
    setSelectedVector(payload.assets[0].id);
    setNotice("Production SVGs are ready. Adjust and export your lockup.");
    void loadHistory();
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
    const response = await fetch(`/api/projects/${projectId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assetId: selectedVector,
        color: lockupColor,
        descriptor,
        layout,
        markScale,
        wordmarkStyle,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setNotice(payload.error ?? "Export could not be created.");
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

  return (
    <main>
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
                  {deletingProjectId === project.id ? "…" : "×"}
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
              maxLength={80}
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
              maxLength={500}
              required
            />
          </div>
          <div className="premium-fields">
            <label>
              <span className="mini-label">Industry *</span>
              <input value={industry} onChange={(event) => setIndustry(event.target.value)} maxLength={120} required />
            </label>
            <label>
              <span className="mini-label">What the company does *</span>
              <textarea value={companyDescription} onChange={(event) => setCompanyDescription(event.target.value)} maxLength={500} rows={3} required />
            </label>
            <label>
              <span className="mini-label">Positioning</span>
              <textarea value={positioning} onChange={(event) => setPositioning(event.target.value)} maxLength={300} rows={2} />
            </label>
            <label>
              <span className="mini-label">Competitors</span>
              <textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} maxLength={500} rows={2} placeholder="Names or URLs, separated by commas" />
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
              <span className="mini-label">Logo type</span>
              <select value={logoType} onChange={(event) => setLogoType(event.target.value as PremiumBrief["logoType"])}>
                <option value="abstract">Abstract symbol</option>
                <option value="monogram">Monogram</option>
                <option value="wordmark">Wordmark</option>
                <option value="emblem">Emblem</option>
                <option value="combination">Symbol + wordmark</option>
              </select>
            </label>
            <label>
              <span className="mini-label">Visual direction</span>
              <input value={visualDirection} onChange={(event) => setVisualDirection(event.target.value)} maxLength={200} />
            </label>
            <label>
              <span className="mini-label">Audience</span>
              <textarea value={audience} onChange={(event) => setAudience(event.target.value)} maxLength={300} rows={2} />
            </label>
            <label>
              <span className="mini-label">Primary usage</span>
              <textarea value={usage} onChange={(event) => setUsage(event.target.value)} maxLength={300} rows={2} />
            </label>
            <label className="wide-field">
              <span className="mini-label">Avoid</span>
              <textarea value={avoid} onChange={(event) => setAvoid(event.target.value)} maxLength={300} rows={2} />
            </label>
          </div>
          <div className="generate-row">
            <p>
              <span>4</span> strategic directions
            </p>
            <button
              className="primary-button"
              type="button"
              onClick={generate}
              disabled={isGenerating}
            >
              {isGenerating
                ? "Generating real concepts…"
                : user
                  ? "Generate 4 real directions"
                  : "Sign in to generate"}
              {isGenerating ? (
                <span className="water-loader" aria-label="Generating">
                  <i />
                </span>
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

      {strategy && (
        <section className="strategy-section" aria-label="Brand research and strategy">
          <div className="strategy-heading">
            <p className="eyebrow">02 / Category research</p>
            <h2>Know the category.<br />Refuse its clichés.</h2>
            <p>{strategy.differentiation}</p>
          </div>
          <button
            className="strategy-toggle"
            type="button"
            aria-expanded={isStrategyOpen}
            onClick={() => setIsStrategyOpen((current) => !current)}
          >
            {isStrategyOpen ? "Hide research" : "View research details"}
            <span>{isStrategyOpen ? "−" : "+"}</span>
          </button>
          {isStrategyOpen && <div className="strategy-grid">
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
              <span>Starting palette</span>
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
          {isStrategyOpen && <p className="trademark-notice">Trademark note — {strategy.trademarkNotice}</p>}
        </section>
      )}

      <section className="concepts-section" id="concepts">
        <div className="concepts-header">
          <div>
            <p className="eyebrow light">02 / Concept territories</p>
            <h2>Different ideas. Not different seeds.</h2>
          </div>
          <p>
            Each route starts from a distinct strategic thought and survives at
            24 px before it earns the right to become a brand.
          </p>
        </div>

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
              <button
                className={`concept-card ${isActive ? "selected" : ""}`}
                type="button"
                key={generated.id}
                onClick={() => selectGeneratedConcept(conceptKey)}
                aria-pressed={isActive}
              >
                <div className="concept-meta">
                  <span>{String(conceptIndex + 1).padStart(2, "0")}</span>
                  <span className={`score ${concept.accent}`}>
                    {generated.qualityScore
                      ? `QC ${generated.qualityScore}/100`
                      : "Legacy · unchecked"}
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
                </div>
                <span className="select-indicator">
                  {isActive ? `Selected ${selectedConceptIds.indexOf(generated.id) + 1}/2` : "Select"}{" "}
                  <b>{isActive ? "●" : "+"}</b>
                </span>
              </button>
              );
            })}
          </div>
        ) : (
          <div className="concept-empty">
            <span>Awaiting a real brief</span>
            <strong>No sample logos. No invented scores.</strong>
            <p>
              Complete the premium brief and generate four strategic directions.
              Only actual Cloudflare results will appear here.
            </p>
            <a href="#brief">Complete the brief ↑</a>
          </div>
        )}

        {generatedConcepts.length > 0 && generatedConcepts.length < 8 && (
          <div className="more-concepts">
            <span>{generatedConcepts.length} concepts ready · select up to 2</span>
            <button
              type="button"
              onClick={generateMore}
              disabled={isGeneratingMore}
            >
              {isGeneratingMore ? "Generating one more…" : "More concept +1"}
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
            <span>Refinement shortlist</span>
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
              {isRefining ? "Refining…" : `Refine ${selectedConceptIds.length || ""} selected`} <span>→</span>
            </button>
          </div>
        </div>}
      </section>

      <section className="workflow-section" id="workflow">
        <div className="workflow-heading">
          <p className="eyebrow">03 / Production pipeline</p>
          <h2>From chosen thought<br />to usable identity.</h2>
          <p>Every stage keeps a visible parent, so the creative decision never disappears inside a black box.</p>
        </div>

        <div className="workflow-stage">
          <div className="stage-index"><span>01</span><strong>Refine</strong></div>
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
              </button>
            )) : (
              <div className="empty-stage">
                <strong>Controlled symbol refinement</strong>
                <p>Choose one or two approved symbols above. The exact brand name is composed separately in the lockup editor.</p>
                <button type="button" onClick={refineSelected} disabled={isRefining}>
                  {isRefining ? "Refining…" : "Create refinements →"}
                </button>
              </div>
            )}
          </div>
          {refinements.length > 0 && (
            <button className="stage-action" type="button" onClick={vectorizeSelected} disabled={isVectorizing}>
            {isVectorizing ? "Creating SVG…" : "Vectorize selected"} <span>→</span>
            </button>
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
                <strong>Exact vector trace</strong>
                <p>Recraft converts the selected symbol to SVG without generative reconstruction.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lockup-editor">
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
              <input value={descriptor} maxLength={80} onChange={(event) => setDescriptor(event.target.value)} />
            </label>
            <label>
              <span className="mini-label">Color</span>
              <input type="color" value={lockupColor} onChange={(event) => setLockupColor(event.target.value)} />
            </label>
            <label>
              <span className="mini-label">Wordmark character</span>
              <select value={wordmarkStyle} onChange={(event) => setWordmarkStyle(event.target.value)}>
                <option value="modern">Modern grotesk</option>
                <option value="geometric">Geometric</option>
                <option value="humanist">Humanist</option>
                <option value="editorial">Editorial serif</option>
              </select>
            </label>
            <label>
              <span className="mini-label">Optical mark scale — {markScale}%</span>
              <input type="range" min="88" max="112" value={markScale} onChange={(event) => setMarkScale(Number(event.target.value))} />
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
                <strong className={`wordmark-${wordmarkStyle}`}>{brandName || "Brand name"}</strong>
                {descriptor && <span>{descriptor}</span>}
              </div>
            )}
          </div>
          <div className="quality-lab">
            <article>
              <span>Responsive test</span>
              <div className="size-test">
                {[16, 24, 48].map((size) => (
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
              <button type="button" onClick={() => void exportLockup("svg")} disabled={!selectedVector}>SVG ↓</button>
              <button type="button" onClick={() => void exportLockup("png")} disabled={!selectedVector}>PNG ↓</button>
              <button type="button" onClick={() => void exportLockup("webp")} disabled={!selectedVector}>WebP ↓</button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 48)} disabled={!selectedVector}>Favicon 48 ↓</button>
              <button type="button" onClick={() => void exportLockup("png", "icon", 1024)} disabled={!selectedVector}>Social avatar ↓</button>
              <button type="button" onClick={printBrandGuide} disabled={!selectedVector}>Brand guide / PDF ↗</button>
            </div>
          </div>
        </div>
      </section>

      <section className="system-section">
        <div className="system-left">
          <p className="eyebrow">04 / Brand system</p>
          <h2>
            One idea.
            <br />
            Every context.
          </h2>
          <div className="system-number">12</div>
          <p className="system-caption">Production-ready assets from one route.</p>
        </div>
        <div className="system-board">
          <article className="application-card acid-card">
            <span className="app-label">App icon / 01</span>
            <div className="app-loop" />
            <strong>Loop forward.</strong>
          </article>
          <article className="application-card black-card">
            <span className="app-label">Wordmark / 02</span>
            <div className="black-wordmark">LOO<span>∞</span>PEN</div>
            <p>Adaptive identity for adaptive brands.</p>
          </article>
          <article className="application-card white-card">
            <span className="app-label">Micro mark / 03</span>
            <div className="micro-grid">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <p>24 px → ∞</p>
          </article>
        </div>
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
          <button className="text-button" type="button">
            Read the Loopen method <span>↗</span>
          </button>
        </div>
      </section>

      <footer>
        <a className="footer-wordmark" href="#top">
          LOOPEN<span>®</span>
        </a>
        <div className="footer-meta">
          <p>Brand systems, not random logos.</p>
          <p>Made with intent in Tel Aviv.</p>
        </div>
        <a className="back-top" href="#top">
          Back to top ↑
        </a>
      </footer>
    </main>
  );
}
