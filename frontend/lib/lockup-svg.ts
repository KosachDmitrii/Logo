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
