/** Strip plate backgrounds and recolor mark geometry for lockup export/preview. */
export function prepareLockupMarkSvg(svg: string, color: string) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#201f1e";
  return svg
    .replace(
      /<rect\b(?=[^>]*\bwidth\s*=\s*["'](?:512|1024|100%)["'])(?=[^>]*\bheight\s*=\s*["'](?:512|1024|100%)["'])[^>]*\/?>/gi,
      "",
    )
    .replace(
      /<rect\b(?=[^>]*\bheight\s*=\s*["'](?:512|1024|100%)["'])(?=[^>]*\bwidth\s*=\s*["'](?:512|1024|100%)["'])[^>]*\/?>/gi,
      "",
    )
    .replace(/\bfill\s*=\s*["'](?!none)[^"']*["']/gi, `fill="${safeColor}"`)
    .replace(/\bstroke\s*=\s*["'](?!none)[^"']*["']/gi, `stroke="${safeColor}"`);
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
    // Keep a stable CSS intrinsic size — bare viewBox units (e.g. 22px) collapse the lockup grid.
    root.setAttribute("width", "512");
    root.setAttribute("height", "512");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return new XMLSerializer().serializeToString(root);
  } catch {
    return svg;
  }
}
