/** Strip plate backgrounds and recolor mark geometry for lockup export/preview. */

function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const match = svg.match(
    /viewBox\s*=\s*["']\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s*["']/i,
  );
  if (!match) return { x: 0, y: 0, w: 512, h: 512 };
  const x = Number(match[1]);
  const y = Number(match[2]);
  const w = Number(match[3]);
  const h = Number(match[4]);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    return { x: 0, y: 0, w: 512, h: 512 };
  }
  return { x, y, w, h };
}

function attrNumber(tag: string, name: string): number | null {
  const match = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  if (!match) return null;
  const raw = match[1].trim();
  if (raw.endsWith("%")) {
    const pct = Number(raw.slice(0, -1));
    return Number.isFinite(pct) ? pct / 100 : null;
  }
  const value = Number(raw.replace(/px$/i, ""));
  return Number.isFinite(value) ? value : null;
}

function parseCssColor(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().toLowerCase();
  if (!raw || raw === "none" || raw === "transparent") return null;
  if (raw === "white") return { r: 255, g: 255, b: 255 };
  if (raw === "black") return { r: 0, g: 0, b: 0 };
  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return {
        r: parseInt(h[0] + h[0], 16),
        g: parseInt(h[1] + h[1], 16),
        b: parseInt(h[2] + h[2], 16),
      };
    }
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  const rgb = raw.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }
  return null;
}

function luminance(color: { r: number; g: number; b: number }) {
  return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
}

function isPaperFill(value: string): boolean {
  const color = parseCssColor(value);
  if (!color) return false;
  return luminance(color) >= 0.82;
}

function fillFromTag(tag: string): string | null {
  const attr = tag.match(/\bfill\s*=\s*["']([^"']+)["']/i);
  if (attr) return attr[1];
  const style = tag.match(/\bstyle\s*=\s*["']([^"']*)["']/i);
  if (!style) return null;
  const fill = style[1].match(/\bfill\s*:\s*([^;]+)/i);
  return fill?.[1]?.trim() ?? null;
}

function pathD(tag: string): string | null {
  return tag.match(/\bd\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
}

function isFullBleedRectPath(d: string, w: number, h: number): boolean {
  const compact = d.replace(/[\s,]+/g, " ").trim();
  const hv = compact.match(
    /^M\s*([-\d.eE]+)\s+([-\d.eE]+)\s*[hH]\s*([-\d.eE]+)\s*[vV]\s*([-\d.eE]+)\s*[hH]\s*([-\d.eE]+)\s*[zZ]\s*$/i,
  );
  if (hv) {
    const x = Math.abs(Number(hv[1]));
    const y = Math.abs(Number(hv[2]));
    const width = Math.abs(Number(hv[3]));
    const height = Math.abs(Number(hv[4]));
    return x <= w * 0.02 && y <= h * 0.02 && width >= w * 0.96 && height >= h * 0.96;
  }
  const abs = compact.match(
    /^M\s*([-\d.eE]+)\s+([-\d.eE]+)\s*L\s*([-\d.eE]+)\s+([-\d.eE]+)\s*L\s*([-\d.eE]+)\s+([-\d.eE]+)\s*L\s*([-\d.eE]+)\s+([-\d.eE]+)\s*[zZ]\s*$/i,
  );
  if (abs) {
    const xs = [Number(abs[1]), Number(abs[3]), Number(abs[5]), Number(abs[7])];
    const ys = [Number(abs[2]), Number(abs[4]), Number(abs[6]), Number(abs[8])];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return (
      minX <= w * 0.02 &&
      minY <= h * 0.02 &&
      maxX - minX >= w * 0.96 &&
      maxY - minY >= h * 0.96
    );
  }
  return false;
}

function isFullBleedRectTag(tag: string, w: number, h: number): boolean {
  const widthAttr = attrNumber(tag, "width");
  const heightAttr = attrNumber(tag, "height");
  if (widthAttr == null || heightAttr == null) return false;
  const width = widthAttr <= 1 ? widthAttr * w : widthAttr;
  const height = heightAttr <= 1 ? heightAttr * h : heightAttr;
  if (width >= w * 0.96 && height >= h * 0.96) return true;
  return (
    (width === 512 || width === 1024 || width === 2048) &&
    (height === 512 || height === 1024 || height === 2048)
  );
}

/**
 * Build a regular transparent SVG from a Recraft/GPT vector asset:
 * same mark as the Vector card, cream plate removed, counters kept as holes.
 * Safe inside <img> (uses mask, not mix-blend-mode).
 */
export function prepareLockupMarkSvg(svg: string, color: string) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#201f1e";
  const box = parseViewBox(svg);
  const inkPaths: string[] = [];
  const holePaths: string[] = [];

  for (const match of svg.matchAll(/<(path|rect)\b[^>]*\/?>/gi)) {
    const tag = match[0];
    const kind = match[1].toLowerCase();
    const fill = fillFromTag(tag);

    if (kind === "rect") {
      if (isFullBleedRectTag(tag, box.w, box.h)) continue;
      if (fill && isPaperFill(fill)) {
        // Non-plate paper rect → hole
        const d = rectToPath(tag, box.w, box.h);
        if (d) holePaths.push(d);
        continue;
      }
      const d = rectToPath(tag, box.w, box.h);
      if (d) inkPaths.push(d);
      continue;
    }

    const d = pathD(tag);
    if (!d) continue;
    if (isFullBleedRectPath(d, box.w, box.h)) continue;
    if (fill && isPaperFill(fill)) {
      holePaths.push(d);
      continue;
    }
    inkPaths.push(d);
  }

  if (!inkPaths.length) {
    // Fallback: old tint-all behaviour without plate stripping failure.
    return svg
      .replace(
        /<rect\b(?=[^>]*\bwidth\s*=\s*["'](?:512|1024|2048|100%)["'])(?=[^>]*\bheight\s*=\s*["'](?:512|1024|2048|100%)["'])[^>]*\/?>/gi,
        "",
      )
      .replace(/\bfill\s*=\s*["'](?!none)[^"']*["']/gi, `fill="${safeColor}"`);
  }

  const ink = inkPaths
    .map((d) => `<path d="${d}" fill="${safeColor}"/>`)
    .join("");
  const holes = holePaths
    .map((d) => `<path d="${d}" fill="#000"/>`)
    .join("");
  const mask = holes
    ? `<defs><mask id="loopen-mark-mask" maskUnits="userSpaceOnUse" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"><rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="#fff"/>${holes}</mask></defs>`
    : "";
  const body = holes ? `<g mask="url(#loopen-mark-mask)">${ink}</g>` : ink;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" width="512" height="512" preserveAspectRatio="xMidYMid meet">${mask}${body}</svg>`;
}

function rectToPath(tag: string, vbW: number, vbH: number): string | null {
  const widthAttr = attrNumber(tag, "width");
  const heightAttr = attrNumber(tag, "height");
  if (widthAttr == null || heightAttr == null) return null;
  const x = attrNumber(tag, "x") ?? 0;
  const y = attrNumber(tag, "y") ?? 0;
  const width = widthAttr <= 1 ? widthAttr * vbW : widthAttr;
  const height = heightAttr <= 1 ? heightAttr * vbH : heightAttr;
  return `M${x} ${y}h${width}v${height}H${x}z`;
}

/** Tight viewBox around painted geometry so the mark fills its lockup slot. */
export function trimSvgViewBox(svg: string): string {
  if (typeof document === "undefined") return svg;
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.querySelector("parsererror")) return svg;

    const host = document.createElement("div");
    host.style.cssText =
      "position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none";
    const mounted = root.cloneNode(true) as SVGSVGElement;
    mounted.setAttribute("width", "1024");
    mounted.setAttribute("height", "1024");
    host.appendChild(mounted);
    document.body.appendChild(host);

    const bbox = mounted.getBBox();
    document.body.removeChild(host);

    if (!Number.isFinite(bbox.width) || !Number.isFinite(bbox.height)) return svg;
    if (bbox.width < 1 || bbox.height < 1) return svg;

    const pad = Math.max(bbox.width, bbox.height) * 0.06;
    root.setAttribute(
      "viewBox",
      `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad * 2} ${bbox.height + pad * 2}`,
    );
    root.setAttribute("width", "512");
    root.setAttribute("height", "512");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
}
