import { asBriefText, parseCompetitorEntries } from "./brief-options.ts";
import {
  clampLockupOffset,
  clampRotate,
  defaultLockupOptics,
  type LockupLayout,
  type LockupOptics,
  type LockupPreset,
} from "./lockup-optics.ts";
import type { StudioDraft, StudioSessionSnapshot } from "./studio-types.ts";

function asLockupLayout(value: unknown): LockupLayout {
  if (value === "vertical" || value === "icon" || value === "horizontal") {
    return value;
  }
  return "horizontal";
}

function asOpticsPartial(value: unknown): Partial<LockupOptics> {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const next: Partial<LockupOptics> = {};
  const defaults = defaultLockupOptics();
  for (const key of Object.keys(defaults) as Array<keyof LockupOptics>) {
    if (key in raw) {
      (next as Record<string, unknown>)[key] = raw[key as string];
    }
  }
  return next;
}

export const STUDIO_SESSION_KEY = "loopen-studio-session-v1";

/** When true, writes are ignored (logout / hard wipe before navigation). */
let studioSessionPersistSuspended = false;

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
    market: "",
    companyScale: "",
    priceSegment: "",
    competitors: "",
    directCompetitors: [],
    brandReferences: [],
    rejectedDirect: [],
    rejectedReferences: [],
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
    ...defaultLockupOptics(),
    lockupByLayout: {
      horizontal: {},
      vertical: {},
      icon: {},
    },
    lockupPresets: [],
    compareSnapshot: null,
  };
}

export function draftFromSnapshot(snapshot: StudioSessionSnapshot): StudioDraft {
  const directCompetitors = parseCompetitorEntries(
    snapshot.directCompetitors ?? snapshot.competitors,
  );
  const brandReferences = parseCompetitorEntries(snapshot.brandReferences);
  return {
    projectId: snapshot.projectId,
    activeTemplateId: snapshot.activeTemplateId ?? "",
    brandName: snapshot.brandName ?? "",
    coreIdea: snapshot.coreIdea ?? "",
    industry: snapshot.industry ?? "",
    companyDescription: snapshot.companyDescription ?? "",
    audience: asBriefText(snapshot.audience),
    positioning: asBriefText(snapshot.positioning),
    market: snapshot.market ?? "",
    companyScale: snapshot.companyScale ?? "",
    priceSegment: snapshot.priceSegment ?? "",
    competitors: asBriefText(snapshot.competitors),
    directCompetitors,
    brandReferences,
    rejectedDirect: Array.isArray(snapshot.rejectedDirect)
      ? snapshot.rejectedDirect.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    rejectedReferences: Array.isArray(snapshot.rejectedReferences)
      ? snapshot.rejectedReferences.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
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
    lockupLayout: asLockupLayout(snapshot.lockupLayout),
    lockupColor: snapshot.lockupColor ?? "#201f1e",
    wordmarkName: snapshot.wordmarkName ?? snapshot.brandName ?? "",
    descriptor: snapshot.descriptor ?? "",
    wordmarkStyle: snapshot.wordmarkStyle ?? "modern",
    descriptorStyle: snapshot.descriptorStyle ?? "modern",
    wordmarkFontId:
      typeof snapshot.wordmarkFontId === "string"
        ? snapshot.wordmarkFontId
        : null,
    descriptorFontId:
      typeof snapshot.descriptorFontId === "string"
        ? snapshot.descriptorFontId
        : null,
    wordmarkCase: snapshot.wordmarkCase ?? "original",
    wordmarkWeight: snapshot.wordmarkWeight ?? 600,
    wordmarkTracking: snapshot.wordmarkTracking ?? -3,
    wordmarkSize: snapshot.wordmarkSize ?? 112,
    descriptorSize: snapshot.descriptorSize ?? 24,
    markScale: snapshot.markScale ?? 100,
    markFlipX: Boolean(snapshot.markFlipX),
    markFlipY: Boolean(snapshot.markFlipY),
    markRotate: clampRotate(Number(snapshot.markRotate ?? 0)),
    wordmarkRotate: clampRotate(Number(snapshot.wordmarkRotate ?? 0)),
    descriptorRotate: clampRotate(Number(snapshot.descriptorRotate ?? 0)),
    wordmarkOffsetX: clampLockupOffset(Number(snapshot.wordmarkOffsetX ?? 0)),
    wordmarkOffsetY: clampLockupOffset(Number(snapshot.wordmarkOffsetY ?? 0)),
    descriptorOffsetX: clampLockupOffset(
      Number(snapshot.descriptorOffsetX ?? 0),
    ),
    descriptorOffsetY: clampLockupOffset(
      Number(snapshot.descriptorOffsetY ?? 0),
    ),
    lockupByLayout: {
      horizontal: asOpticsPartial(snapshot.lockupByLayout?.horizontal),
      vertical: asOpticsPartial(snapshot.lockupByLayout?.vertical),
      icon: asOpticsPartial(snapshot.lockupByLayout?.icon),
    },
    lockupPresets: Array.isArray(snapshot.lockupPresets)
      ? (snapshot.lockupPresets as LockupPreset[]).filter(
          (item) => item && typeof item.id === "string" && item.optics,
        )
      : [],
    compareSnapshot:
      snapshot.compareSnapshot && typeof snapshot.compareSnapshot === "object"
        ? {
            ...defaultLockupOptics(),
            ...asOpticsPartial(snapshot.compareSnapshot),
            lockupLayout: asLockupLayout(
              (snapshot.compareSnapshot as { lockupLayout?: unknown })
                .lockupLayout,
            ),
          }
        : null,
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
  if (studioSessionPersistSuspended) {
    // Undo any race where pagehide tries to re-save during logout.
    clearStudioSession();
    return;
  }
  try {
    window.sessionStorage.setItem(STUDIO_SESSION_KEY, JSON.stringify(snapshot));
    window.localStorage.removeItem(STUDIO_SESSION_KEY);
    invalidateClientStudioSnapshotCache();
  } catch {
    // Quota / private mode — session restore is best-effort.
  }
}

/** Block further session writes (e.g. pagehide flush during logout). */
export function suspendStudioSessionPersist() {
  studioSessionPersistSuspended = true;
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

/** No-op subscribe — session is applied once in LoopenStudio after mount. */
export function subscribeStudioSession(_onStoreChange?: () => void) {
  void _onStoreChange;
  return () => {};
}
