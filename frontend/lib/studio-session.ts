import type { StudioDraft, StudioSessionSnapshot } from "./studio-types";

export const STUDIO_SESSION_KEY = "loopen-studio-session-v1";

declare global {
  interface Window {
    __loopenStudioSessionCache?: StudioSessionSnapshot | null | undefined;
  }
}

export function createEmptyStudioDraft(): StudioDraft {
  return {
    projectId: null,
    activeTemplateId: "",
    brandName: "",
    coreIdea: "",
    industry: "",
    companyDescription: "",
    audience: "",
    positioning: "",
    competitors: "",
    colorApproach: "propose",
    brandColors: "",
    colorMood: "",
    visualDirection: "",
    usage: "",
    avoid: "",
    personalities: [],
    strategy: null,
    selectedConcept: "continuous",
    selectedConceptIds: [],
    generatedConcepts: [],
    assets: [],
    selectedRefinement: "",
    selectedVector: "",
    productionLocked: false,
    vectorSourceMode: "refine",
    lockupLayout: "horizontal",
    lockupColor: "#201f1e",
    wordmarkName: "",
    descriptor: "",
    wordmarkStyle: "modern",
    wordmarkCase: "original",
    wordmarkWeight: 600,
    wordmarkTracking: -3,
    wordmarkSize: 112,
    descriptorSize: 24,
    markScale: 100,
  };
}

export function draftFromSnapshot(snapshot: StudioSessionSnapshot): StudioDraft {
  return {
    projectId: snapshot.projectId,
    activeTemplateId: snapshot.activeTemplateId ?? "",
    brandName: snapshot.brandName ?? "",
    coreIdea: snapshot.coreIdea ?? "",
    industry: snapshot.industry ?? "",
    companyDescription: snapshot.companyDescription ?? "",
    audience: snapshot.audience ?? "",
    positioning: snapshot.positioning ?? "",
    competitors: snapshot.competitors ?? "",
    colorApproach: snapshot.colorApproach ?? "propose",
    brandColors: snapshot.brandColors ?? "",
    colorMood: snapshot.colorMood ?? "",
    visualDirection: snapshot.visualDirection ?? "",
    usage: snapshot.usage ?? "",
    avoid: snapshot.avoid ?? "",
    personalities: snapshot.personalities ?? [],
    strategy: snapshot.strategy ?? null,
    selectedConcept: snapshot.selectedConcept || "continuous",
    selectedConceptIds: snapshot.selectedConceptIds ?? [],
    generatedConcepts: snapshot.generatedConcepts ?? [],
    assets: snapshot.assets ?? [],
    selectedRefinement: snapshot.selectedRefinement ?? "",
    selectedVector: snapshot.selectedVector ?? "",
    productionLocked: Boolean(snapshot.productionLocked),
    vectorSourceMode: snapshot.vectorSourceMode ?? "refine",
    lockupLayout: snapshot.lockupLayout ?? "horizontal",
    lockupColor: snapshot.lockupColor ?? "#201f1e",
    wordmarkName: snapshot.wordmarkName ?? snapshot.brandName ?? "",
    descriptor: snapshot.descriptor ?? "",
    wordmarkStyle: snapshot.wordmarkStyle ?? "modern",
    wordmarkCase: snapshot.wordmarkCase ?? "original",
    wordmarkWeight: snapshot.wordmarkWeight ?? 600,
    wordmarkTracking: snapshot.wordmarkTracking ?? -3,
    wordmarkSize: snapshot.wordmarkSize ?? 112,
    descriptorSize: snapshot.descriptorSize ?? 24,
    markScale: snapshot.markScale ?? 100,
  };
}

function invalidateClientStudioSnapshotCache() {
  if (typeof window === "undefined") return;
  window.__loopenStudioSessionCache = undefined;
}

export function readStudioSession(): StudioSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    // Drop any leftover localStorage draft from older builds.
    window.localStorage.removeItem(STUDIO_SESSION_KEY);
    const raw = window.sessionStorage.getItem(STUDIO_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudioSessionSnapshot;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStudioSession(snapshot: StudioSessionSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify(snapshot));
    window.localStorage.removeItem(STUDIO_SESSION_KEY);
    invalidateClientStudioSnapshotCache();
  } catch {
    // Quota / private mode — session restore is best-effort.
  }
}

export function clearStudioSession() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STUDIO_SESSION_KEY);
    window.localStorage.removeItem(STUDIO_SESSION_KEY);
    invalidateClientStudioSnapshotCache();
  } catch {
    // ignore
  }
}

/** Cached snapshot for useSyncExternalStore subscribers on the client. */
export function getClientStudioSnapshot(): StudioSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  if (window.__loopenStudioSessionCache === undefined) {
    window.__loopenStudioSessionCache = readStudioSession();
  }
  return window.__loopenStudioSessionCache ?? null;
}

/** No-op subscribe — snapshot is read once at boot; edits go through React state. */
export function subscribeStudioSession(_onStoreChange?: () => void) {
  void _onStoreChange;
  return () => {};
}
