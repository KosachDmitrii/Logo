export type LockupLayout = "horizontal" | "vertical" | "icon";

export type LockupOptics = {
  lockupColor: string;
  wordmarkName: string;
  descriptor: string;
  wordmarkStyle: string;
  descriptorStyle: string;
  wordmarkFontId: string | null;
  descriptorFontId: string | null;
  wordmarkCase: "original" | "upper" | "lower";
  wordmarkWeight: number;
  wordmarkTracking: number;
  wordmarkSize: number;
  descriptorSize: number;
  markScale: number;
  markFlipX: boolean;
  markFlipY: boolean;
  markRotate: number;
  wordmarkRotate: number;
  descriptorRotate: number;
  wordmarkOffsetX: number;
  wordmarkOffsetY: number;
  descriptorOffsetX: number;
  descriptorOffsetY: number;
};

export type LockupPreset = {
  id: string;
  name: string;
  optics: LockupOptics & { lockupLayout: LockupLayout };
};

export const EMPTY_LOCKUP_BY_LAYOUT: Record<
  LockupLayout,
  Partial<LockupOptics>
> = {
  horizontal: {},
  vertical: {},
  icon: {},
};

export function defaultLockupOptics(): LockupOptics {
  return {
    lockupColor: "#201f1e",
    wordmarkName: "",
    descriptor: "",
    wordmarkStyle: "modern",
    descriptorStyle: "modern",
    wordmarkFontId: null,
    descriptorFontId: null,
    wordmarkCase: "original",
    wordmarkWeight: 600,
    wordmarkTracking: -3,
    wordmarkSize: 112,
    descriptorSize: 24,
    markScale: 100,
    markFlipX: false,
    markFlipY: false,
    markRotate: 0,
    wordmarkRotate: 0,
    descriptorRotate: 0,
    wordmarkOffsetX: 0,
    wordmarkOffsetY: 0,
    descriptorOffsetX: 0,
    descriptorOffsetY: 0,
  };
}

export function pickLockupOptics(source: LockupOptics): LockupOptics {
  return {
    lockupColor: source.lockupColor,
    wordmarkName: source.wordmarkName,
    descriptor: source.descriptor,
    wordmarkStyle: source.wordmarkStyle,
    descriptorStyle: source.descriptorStyle,
    wordmarkFontId: source.wordmarkFontId,
    descriptorFontId: source.descriptorFontId,
    wordmarkCase: source.wordmarkCase,
    wordmarkWeight: source.wordmarkWeight,
    wordmarkTracking: source.wordmarkTracking,
    wordmarkSize: source.wordmarkSize,
    descriptorSize: source.descriptorSize,
    markScale: source.markScale,
    markFlipX: source.markFlipX,
    markFlipY: source.markFlipY,
    markRotate: source.markRotate,
    wordmarkRotate: source.wordmarkRotate,
    descriptorRotate: source.descriptorRotate,
    wordmarkOffsetX: source.wordmarkOffsetX,
    wordmarkOffsetY: source.wordmarkOffsetY,
    descriptorOffsetX: source.descriptorOffsetX,
    descriptorOffsetY: source.descriptorOffsetY,
  };
}

export function clampRotate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(90, Math.max(-90, Math.round(value)));
}

export function clampLockupOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(800, Math.max(-800, Math.round(value)));
}

export function customFontFamily(fontId: string): string {
  return `LoopenCustom-${fontId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`;
}
