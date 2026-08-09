import {
  getGoogleFont,
  googleFontCssFamily,
  keepsDescriptorCase,
} from "./google-fonts.ts";
import { customFontFamily, clampLockupOffset } from "./lockup-optics.ts";
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
  descriptorStyle?: string;
  wordmarkFontId?: string | null;
  descriptorFontId?: string | null;
  wordmarkFontCssFamily?: string | null;
  descriptorFontCssFamily?: string | null;
  wordmarkFontDataUri?: string | null;
  descriptorFontDataUri?: string | null;
  markFlipX?: boolean;
  markFlipY?: boolean;
  markRotate?: number;
  wordmarkRotate?: number;
  descriptorRotate?: number;
  wordmarkOffsetX?: number;
  wordmarkOffsetY?: number;
  descriptorOffsetX?: number;
  descriptorOffsetY?: number;
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
  // Deterministic fallback — also used for the first client paint so SSR HTML matches.
  const estimate =
    text.length * fontSize * (0.56 + trackingEm);
  if (typeof document === "undefined") return estimate;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return estimate;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const base = context.measureText(text).width;
  const tracking = fontSize * trackingEm * Math.max(0, text.length - 1);
  return base + tracking;
}

/** SSR-safe width estimate (identical on server and the first client render). */
export function estimateLockupTextWidth(
  text: string,
  fontSize: number,
  trackingEm: number,
): number {
  if (!text) return 0;
  return text.length * fontSize * (0.56 + trackingEm);
}

export function measureLockupTextWidth(
  text: string,
  fontSize: number,
  fontWeight: number,
  fontFamily: string,
  trackingEm: number,
): number {
  return measureTextWidth(text, fontSize, fontWeight, fontFamily, trackingEm);
}

function resolveFamily(
  style: string | undefined,
  customCssFamily: string | null | undefined,
  fontId: string | null | undefined,
): string {
  if (customCssFamily) {
    const google = getGoogleFont(style);
    const fallback = google?.fallback ?? FONT_STACK.modern;
    return `'${customCssFamily}', ${fallback}`;
  }
  if (fontId) return `'${customFontFamily(fontId)}', ${FONT_STACK.modern}`;
  const google = getGoogleFont(style);
  if (google) return googleFontCssFamily(google);
  return FONT_STACK[style ?? "modern"] ?? FONT_STACK.modern;
}

export function resolveLockupFontFamily(
  style: string | undefined,
  customCssFamily?: string | null,
  fontId?: string | null,
): string {
  return resolveFamily(style, customCssFamily, fontId);
}

function clampRot(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(90, Math.max(-90, Number(value)));
}

export function rotatedLockupBounds(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  const rad = (Math.abs(degrees) * Math.PI) / 180;
  if (rad < 0.0001) return { width, height };
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    width: Math.abs(width * cos) + Math.abs(height * sin),
    height: Math.abs(width * sin) + Math.abs(height * cos),
  };
}

function rotatedBounds(
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } {
  return rotatedLockupBounds(width, height, degrees);
}

/**
 * Centered SVG text that survives print/PDF. Many PDF engines ignore
 * dominant-baseline, which shifts ±90° type into the mark; dy from the
 * alphabetic baseline + group rotate matches the CSS preview center.
 */
function svgCenteredText(input: {
  text: string;
  cx: number;
  cy: number;
  rotate: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  fill: string;
}): string {
  const rotate =
    input.rotate !== 0 ? ` rotate(${input.rotate})` : "";
  return `<g transform="translate(${input.cx} ${input.cy})${rotate}"><text x="0" y="0" dy="0.35em" text-anchor="middle" font-family="${escapeXml(input.fontFamily)}" font-size="${input.fontSize}" font-weight="${input.fontWeight}" letter-spacing="${input.letterSpacing}" fill="${input.fill}">${input.text}</text></g>`;
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
  const descriptorStyle = input.descriptorStyle ?? "modern";
  const descriptorText = keepsDescriptorCase(descriptorStyle)
    ? descriptorRaw
    : descriptorRaw.toUpperCase();
  const wordmarkFamily = resolveFamily(
    input.wordmarkStyle,
    input.wordmarkFontCssFamily,
    input.wordmarkFontId,
  );
  const descriptorFamily = resolveFamily(
    descriptorStyle,
    input.descriptorFontCssFamily,
    input.descriptorFontId,
  );
  const titleSize = Math.min(192, Math.max(24, Math.round(input.wordmarkSize)));
  const lineSize = Math.min(36, Math.max(6, Math.round(input.descriptorSize)));
  const markSize = lockupMarkSizePx(input.markScale);
  const wordmarkWeight = Math.min(
    800,
    Math.max(400, Math.round(input.wordmarkWeight / 100) * 100),
  );
  const trackingEm = Math.min(0.08, Math.max(-0.08, input.wordmarkTracking / 100));
  const brandLetterSpacing = titleSize * trackingEm;
  const descriptorTrackingEm = keepsDescriptorCase(descriptorStyle)
    ? 0.04
    : 0.22;
  const descriptorLetterSpacing = lineSize * descriptorTrackingEm;
  const markFlipX = Boolean(input.markFlipX);
  const markFlipY = Boolean(input.markFlipY);
  const markRotate = clampRot(input.markRotate);
  const wordmarkRotate = clampRot(input.wordmarkRotate);
  const descriptorRotate = clampRot(input.descriptorRotate);

  const markGap = Math.round(titleSize * (horizontal ? 0.16 : 0.18));
  const descriptorGap = Math.round(titleSize * 0.14);
  const brandWidth = measureTextWidth(
    brandName,
    titleSize,
    wordmarkWeight,
    wordmarkFamily,
    trackingEm,
  );
  const descriptorWidth = measureTextWidth(
    descriptorText,
    lineSize,
    500,
    descriptorFamily,
    descriptorTrackingEm,
  );
  const brandBounds = rotatedBounds(brandWidth, titleSize, wordmarkRotate);
  const descBounds = descriptorRaw
    ? rotatedBounds(descriptorWidth, lineSize, descriptorRotate)
    : { width: 0, height: 0 };
  const typeWidth = Math.max(brandBounds.width, descBounds.width);
  const typeBlockHeight =
    brandBounds.height + (descriptorRaw ? descriptorGap + descBounds.height : 0);
  const markBounds = rotatedBounds(markSize, markSize, markRotate);
  const pad = Math.round(Math.max(20, titleSize * 0.28));

  let width: number;
  let height: number;
  let markX: number;
  let markY: number;
  let brandCx: number;
  let brandCy: number;
  let descCx: number;
  let descCy: number;

  if (iconOnly) {
    width = markBounds.width + pad * 2;
    height = markBounds.height + pad * 2;
    markX = pad + (markBounds.width - markSize) / 2;
    markY = pad + (markBounds.height - markSize) / 2;
    brandCx = 0;
    brandCy = 0;
    descCx = 0;
    descCy = 0;
  } else if (horizontal) {
    const rowHeight = Math.max(markBounds.height, typeBlockHeight);
    width = pad + markBounds.width + markGap + typeWidth + pad;
    height = pad + rowHeight + pad;
    markX = pad + (markBounds.width - markSize) / 2;
    markY = pad + (rowHeight - markSize) / 2;
    const typeLeft = pad + markBounds.width + markGap;
    const typeTop = pad + (rowHeight - typeBlockHeight) / 2;
    brandCx = typeLeft + brandBounds.width / 2;
    brandCy = typeTop + brandBounds.height / 2;
    descCx = typeLeft + descBounds.width / 2;
    descCy =
      typeTop + brandBounds.height + descriptorGap + descBounds.height / 2;
  } else {
    const contentWidth = Math.max(markBounds.width, typeWidth);
    width = pad + contentWidth + pad;
    height = pad + markBounds.height + markGap + typeBlockHeight + pad;
    markX = pad + (contentWidth - markSize) / 2;
    markY = pad + (markBounds.height - markSize) / 2;
    const typeTop = pad + markBounds.height + markGap;
    brandCx = pad + contentWidth / 2;
    brandCy = typeTop + brandBounds.height / 2;
    descCx = brandCx;
    descCy =
      typeTop + brandBounds.height + descriptorGap + descBounds.height / 2;
  }

  const wordmarkOffsetX = clampLockupOffset(input.wordmarkOffsetX ?? 0);
  const wordmarkOffsetY = clampLockupOffset(input.wordmarkOffsetY ?? 0);
  const descriptorOffsetX = clampLockupOffset(input.descriptorOffsetX ?? 0);
  const descriptorOffsetY = clampLockupOffset(input.descriptorOffsetY ?? 0);
  const padL = Math.max(0, -wordmarkOffsetX, -descriptorOffsetX);
  const padR = Math.max(0, wordmarkOffsetX, descriptorOffsetX);
  const padT = Math.max(0, -wordmarkOffsetY, -descriptorOffsetY);
  const padB = Math.max(0, wordmarkOffsetY, descriptorOffsetY);
  if (!iconOnly && (padL || padR || padT || padB)) {
    width += padL + padR;
    height += padT + padB;
    markX += padL;
    markY += padT;
    brandCx += padL;
    brandCy += padT;
    descCx += padL;
    descCy += padT;
  }
  brandCx += wordmarkOffsetX;
  brandCy += wordmarkOffsetY;
  descCx += descriptorOffsetX;
  descCy += descriptorOffsetY;

  const brand = escapeXml(brandName);
  const descriptorXml = escapeXml(descriptorText);
  const cx = markX + markSize / 2;
  const cy = markY + markSize / 2;
  const scaleX = markFlipX ? -1 : 1;
  const scaleY = markFlipY ? -1 : 1;
  const markTransform = `translate(${cx} ${cy}) rotate(${markRotate}) scale(${scaleX} ${scaleY}) translate(${-cx} ${-cy})`;
  const mark = `<g transform="${markTransform}"><svg x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">${inner}</svg></g>`;

  // Print/PDF often ignores dominant-baseline. Center with dy from the
  // alphabetic baseline, then rotate via <g> so ±90° stays print-safe.
  const text = iconOnly
    ? ""
    : `${svgCenteredText({
        text: brand,
        cx: brandCx,
        cy: brandCy,
        rotate: wordmarkRotate,
        fontFamily: wordmarkFamily,
        fontSize: titleSize,
        fontWeight: wordmarkWeight,
        letterSpacing: brandLetterSpacing,
        fill: color,
      })}${
        descriptorRaw
          ? svgCenteredText({
              text: descriptorXml,
              cx: descCx,
              cy: descCy,
              rotate: descriptorRotate,
              fontFamily: descriptorFamily,
              fontSize: lineSize,
              fontWeight: 500,
              letterSpacing: descriptorLetterSpacing,
              fill: color,
            })
          : ""
      }`;

  const faces: string[] = [];
  if (input.wordmarkFontDataUri && input.wordmarkFontCssFamily) {
    faces.push(
      `@font-face{font-family:'${escapeXml(input.wordmarkFontCssFamily)}';src:url(${input.wordmarkFontDataUri}) format('woff2')}`,
    );
  }
  if (
    input.descriptorFontDataUri &&
    input.descriptorFontCssFamily &&
    input.descriptorFontCssFamily !== input.wordmarkFontCssFamily
  ) {
    faces.push(
      `@font-face{font-family:'${escapeXml(input.descriptorFontCssFamily)}';src:url(${input.descriptorFontDataUri}) format('woff2')}`,
    );
  }
  const styleBlock = faces.length
    ? `<defs><style>${faces.join("")}</style></defs>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">
  <title>${brand} logo</title>
  ${styleBlock}
  ${mark}
  ${text}
</svg>`;
}
