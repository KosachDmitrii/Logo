import { prepareLockupMarkSvg, trimSvgViewBox } from "./lockup-svg";

export type LockupExportInput = {
  brandName: string;
  color: string;
  descriptor: string;
  layout: "horizontal" | "vertical" | "icon";
  markScale: number;
  markSvg: string;
  wordmarkCase: "original" | "upper" | "lower";
  wordmarkSize: number;
  descriptorSize: number;
  wordmarkWeight: number;
  wordmarkTracking: number;
  wordmarkStyle: string;
};

const FONT_STACK: Record<string, string> = {
  editorial: "Georgia, 'Times New Roman', serif",
  geometric: "Futura, 'Avenir Next', Arial, sans-serif",
  humanist: "'Avenir Next', 'Segoe UI', Arial, sans-serif",
  modern: "Arial, Helvetica, sans-serif",
};

/** Mark box at markScale 100% — independent of wordmark font size. */
export const LOCKUP_MARK_BASE_PX = 246;

export function lockupMarkSizePx(markScale: number): number {
  const factor = Math.min(4, Math.max(0.7, markScale / 100));
  return Math.round(LOCKUP_MARK_BASE_PX * factor);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function displayBrandName(
  name: string,
  wordmarkCase: LockupExportInput["wordmarkCase"],
) {
  if (wordmarkCase === "upper") return name.toUpperCase();
  if (wordmarkCase === "lower") return name.toLowerCase();
  return name;
}

function measureTextWidth(
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
  trackingEm: number,
) {
  if (!text) return 0;
  if (typeof document === "undefined") {
    return text.length * fontSize * (0.56 + trackingEm);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * fontSize * (0.56 + trackingEm);
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const base = context.measureText(text).width;
  const tracking = fontSize * trackingEm * Math.max(0, text.length - 1);
  return base + tracking;
}

/** Build lockup SVG using the same proportions as the studio preview. */
export function buildLockupSvg(input: LockupExportInput): string {
  const layout = input.layout;
  const horizontal = layout === "horizontal";
  const iconOnly = layout === "icon";
  const color = /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#201f1e";
  const prepared = trimSvgViewBox(prepareLockupMarkSvg(input.markSvg, color));
  const inner = prepared
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "");
  const viewBox =
    prepared.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0 0 1024 1024";

  const brandName = displayBrandName(input.brandName.trim(), input.wordmarkCase);
  const descriptorRaw = input.descriptor.trim().slice(0, 80);
  const descriptorUpper = descriptorRaw.toUpperCase();
  const fontFamily = FONT_STACK[input.wordmarkStyle] ?? FONT_STACK.modern;
  const titleSize = Math.min(192, Math.max(24, Math.round(input.wordmarkSize)));
  const lineSize = Math.min(36, Math.max(6, Math.round(input.descriptorSize)));
  const markSize = lockupMarkSizePx(input.markScale);
  const wordmarkWeight = Math.min(
    800,
    Math.max(400, Math.round(input.wordmarkWeight / 100) * 100),
  );
  const trackingEm = Math.min(0.08, Math.max(-0.08, input.wordmarkTracking / 100));
  const brandLetterSpacing = titleSize * trackingEm;
  const descriptorTrackingEm = 0.22;
  const descriptorLetterSpacing = lineSize * descriptorTrackingEm;

  // Tighter lockup gaps — preview + export stay in sync.
  const markGap = Math.round(titleSize * (horizontal ? 0.16 : 0.18));
  const descriptorGap = Math.round(titleSize * 0.14);
  const typeHeight =
    titleSize * 0.92 + (descriptorRaw ? descriptorGap + lineSize : 0);
  const brandWidth = measureTextWidth(
    brandName,
    titleSize,
    wordmarkWeight,
    fontFamily,
    trackingEm,
  );
  const descriptorWidth = measureTextWidth(
    descriptorUpper,
    lineSize,
    500,
    "Arial, Helvetica, sans-serif",
    descriptorTrackingEm,
  );
  const typeWidth = Math.max(brandWidth, descriptorWidth);
  const pad = Math.round(Math.max(20, titleSize * 0.28));

  let width: number;
  let height: number;
  let markX: number;
  let markY: number;
  let brandX: number;
  let brandY: number;
  let descX: number;
  let descY: number;
  let textAnchor: "start" | "middle" = "start";

  if (iconOnly) {
    width = markSize + pad * 2;
    height = markSize + pad * 2;
    markX = pad;
    markY = pad;
    brandX = 0;
    brandY = 0;
    descX = 0;
    descY = 0;
  } else if (horizontal) {
    const rowHeight = Math.max(markSize, typeHeight);
    width = pad + markSize + markGap + typeWidth + pad;
    height = pad + rowHeight + pad;
    markX = pad;
    markY = pad + (rowHeight - markSize) / 2;
    const typeTop = pad + (rowHeight - typeHeight) / 2;
    brandX = pad + markSize + markGap;
    brandY = typeTop + titleSize * 0.82;
    descX = brandX;
    descY = brandY + descriptorGap + lineSize * 0.9;
    textAnchor = "start";
  } else {
    const contentWidth = Math.max(markSize, typeWidth);
    width = pad + contentWidth + pad;
    height = pad + markSize + markGap + typeHeight + pad;
    markX = pad + (contentWidth - markSize) / 2;
    markY = pad;
    brandX = pad + contentWidth / 2;
    brandY = pad + markSize + markGap + titleSize * 0.82;
    descX = brandX;
    descY = brandY + descriptorGap + lineSize * 0.9;
    textAnchor = "middle";
  }

  const brand = escapeXml(brandName);
  const descriptorXml = escapeXml(descriptorUpper);
  const mark = `<svg x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  const text = iconOnly
    ? ""
    : `<text x="${brandX}" y="${brandY}" text-anchor="${textAnchor}" font-family="${fontFamily}" font-size="${titleSize}" font-weight="${wordmarkWeight}" letter-spacing="${brandLetterSpacing}" fill="${color}">${brand}</text>${
        descriptorRaw
          ? `<text x="${descX}" y="${descY}" text-anchor="${textAnchor}" font-family="Arial, Helvetica, sans-serif" font-size="${lineSize}" font-weight="500" letter-spacing="${descriptorLetterSpacing}" fill="${color}">${descriptorXml}</text>`
          : ""
      }`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">
  <title>${brand} logo</title>
  ${mark}
  ${text}
</svg>`;
}
