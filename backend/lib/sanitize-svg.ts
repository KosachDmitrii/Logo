const SVG_ALLOWED_TAGS = new Map<string, string>([
  ["svg", "svg"],
  ["g", "g"],
  ["path", "path"],
  ["circle", "circle"],
  ["ellipse", "ellipse"],
  ["rect", "rect"],
  ["line", "line"],
  ["polyline", "polyline"],
  ["polygon", "polygon"],
  ["defs", "defs"],
  ["clippath", "clipPath"],
  ["mask", "mask"],
  ["use", "use"],
  ["symbol", "symbol"],
  ["title", "title"],
  ["desc", "desc"],
  ["metadata", "metadata"],
]);

const SVG_ALLOWED_ATTRS = new Map<string, string>([
  ["viewbox", "viewBox"],
  ["xmlns", "xmlns"],
  ["xmlns:xlink", "xmlns:xlink"],
  ["width", "width"],
  ["height", "height"],
  ["x", "x"],
  ["y", "y"],
  ["cx", "cx"],
  ["cy", "cy"],
  ["r", "r"],
  ["rx", "rx"],
  ["ry", "ry"],
  ["x1", "x1"],
  ["y1", "y1"],
  ["x2", "x2"],
  ["y2", "y2"],
  ["d", "d"],
  ["points", "points"],
  ["fill", "fill"],
  ["stroke", "stroke"],
  ["stroke-width", "stroke-width"],
  ["stroke-linecap", "stroke-linecap"],
  ["stroke-linejoin", "stroke-linejoin"],
  ["stroke-miterlimit", "stroke-miterlimit"],
  ["stroke-dasharray", "stroke-dasharray"],
  ["stroke-dashoffset", "stroke-dashoffset"],
  ["stroke-opacity", "stroke-opacity"],
  ["fill-opacity", "fill-opacity"],
  ["fill-rule", "fill-rule"],
  ["clip-rule", "clip-rule"],
  ["clip-path", "clip-path"],
  ["mask", "mask"],
  ["transform", "transform"],
  ["opacity", "opacity"],
  ["id", "id"],
  ["class", "class"],
  ["href", "href"],
  ["xlink:href", "xlink:href"],
]);

function isSafeSvgUri(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) return true;
  if (trimmed.startsWith("data:image/svg+xml")) return true;
  return false;
}

/** Strip disallowed SVG tags/attrs; keep a tight path-based allowlist for AI masters. */
export function sanitizeSvg(svg: string) {
  const stripped = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  return stripped.replace(
    /<\/?([a-zA-Z][\w:-]*)\b([^>]*)\/?>/g,
    (match, rawTag: string, rawAttrs: string) => {
      const isClose = match.startsWith("</");
      const tagKey = rawTag.toLowerCase();
      const tag = SVG_ALLOWED_TAGS.get(tagKey);
      if (!tag) return "";
      if (isClose) return `</${tag}>`;

      const attrs: string[] = [];
      const attrPattern =
        /([:@a-zA-Z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrPattern.exec(rawAttrs))) {
        const name = attrMatch[1].toLowerCase();
        const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
        if (name.startsWith("on")) continue;
        const safeName = SVG_ALLOWED_ATTRS.get(name);
        if (!safeName) continue;
        if (
          (name === "href" || name === "xlink:href") &&
          !isSafeSvgUri(value)
        ) {
          continue;
        }
        if (/javascript:/i.test(value) || /data:text\/html/i.test(value)) {
          continue;
        }
        attrs.push(`${safeName}="${value.replace(/"/g, "&quot;")}"`);
      }

      const selfClosing = match.endsWith("/>");
      return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}${
        selfClosing ? " />" : ">"
      }`;
    },
  );
}
