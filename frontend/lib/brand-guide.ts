import { buildLockupSvg, type LockupExportInput } from "./lockup-export.ts";

export type BrandGuidePersonality = {
  label: string;
  description: string;
};

export type BrandGuideOptics = {
  layout: "horizontal" | "vertical" | "icon";
  layoutLabel: string;
  wordmarkStyleLabel: string;
  descriptorStyleLabel?: string;
  wordmarkCaseLabel: string;
  wordmarkWeight: number;
  wordmarkTracking: number;
  wordmarkSize: number;
  descriptor: string;
  descriptorSize: number;
  markScale: number;
  color: string;
  markSizePx: number;
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

export type BrandGuideBrief = {
  brandName: string;
  coreIdea: string;
  industry: string;
  companyDescription: string;
  positioning: string;
  audience: string;
  market: string;
  companyScale: string;
  priceSegment: string;
  visualDirection: string;
  colorApproach: string;
  colorMood: string;
  brandColors: string;
  usage: string;
  avoid: string;
  personalities: BrandGuidePersonality[];
  directCompetitors: string[];
  brandReferences: Array<{ name: string; aspects?: string[] }>;
  strategy?: {
    differentiation?: string;
    palette?: string[];
    typography?: string;
    categoryCodes?: string[];
    trademarkNotice?: string;
  } | null;
  conceptTitle?: string;
  conceptSummary?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function card(title: string, body: string) {
  if (!body.trim()) return "";
  return `<div class="card"><b>${escapeHtml(title)}</b><p>${escapeHtml(body)}</p></div>`;
}

function list(items: string[]) {
  if (!items.length) return "<p class='muted'>Not specified</p>";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function lockupFrame(
  svg: string,
  label: string,
  tone: "light" | "dark" | "approved" = "light",
) {
  return `<div class="lockup-frame ${tone}"><div class="lockup">${svg}</div><span>${escapeHtml(label)}</span></div>`;
}

/** Strip free transforms so alternate layouts stay readable in the guide. */
function cleanLayoutBase(
  base: Omit<LockupExportInput, "layout" | "color" | "markSvg">,
): Omit<LockupExportInput, "layout" | "color" | "markSvg"> {
  return {
    ...base,
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

function buildLockups(
  markSvg: string,
  base: Omit<LockupExportInput, "layout" | "color" | "markSvg">,
  color: string,
  layout: LockupExportInput["layout"],
) {
  const approved = { ...base, markSvg };
  const clean = { ...cleanLayoutBase(base), markSvg };
  const ink = /^#[0-9a-f]{6}$/i.test(color) ? color : "#201F1E";
  return {
    /** Exact studio lockup — use this for cover + approved frame. */
    primary: buildLockupSvg({ ...approved, layout, color: ink }),
    primaryInverse: buildLockupSvg({
      ...approved,
      layout,
      color: "#FFFFFF",
    }),
    /** Standard layout variants without free rotate/offset. */
    horizontal: buildLockupSvg({
      ...clean,
      layout: "horizontal",
      color: ink,
    }),
    vertical: buildLockupSvg({ ...clean, layout: "vertical", color: ink }),
    icon: buildLockupSvg({ ...clean, layout: "icon", color: ink }),
    horizontalInverse: buildLockupSvg({
      ...clean,
      layout: "horizontal",
      color: "#FFFFFF",
    }),
    verticalInverse: buildLockupSvg({
      ...clean,
      layout: "vertical",
      color: "#FFFFFF",
    }),
    iconInverse: buildLockupSvg({
      ...clean,
      layout: "icon",
      color: "#FFFFFF",
    }),
  };
}

/** Build a print-ready mini brand guide HTML using the same lockup as studio preview. */
export function buildBrandGuideHtml(input: {
  brief: BrandGuideBrief;
  optics: BrandGuideOptics;
  markSvg: string;
  lockupBase: Omit<LockupExportInput, "layout" | "color" | "markSvg">;
}): string {
  const { brief, optics } = input;
  const brand = escapeHtml(brief.brandName);
  const year = new Date().getFullYear();
  const lockups = buildLockups(
    input.markSvg,
    input.lockupBase,
    optics.color,
    optics.layout,
  );
  const palette =
    brief.strategy?.palette?.length
      ? brief.strategy.palette
      : [optics.color, "#F3F0EA", "#FFCF68", "#FFFFFF"];

  const personalityCards = brief.personalities.length
    ? brief.personalities
        .map(
          (item) =>
            `<div class="trait"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.description)}</span></div>`,
        )
        .join("")
    : `<p class="muted">No personality traits selected.</p>`;

  const referenceItems = brief.brandReferences.map((item) => {
    const aspects = item.aspects?.length ? ` — ${item.aspects.join(", ")}` : "";
    return `${item.name}${aspects}`;
  });

  const coverLockup = lockups.primary;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} — Mini brand guide</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#ece9e4;color:#201f1e;font:15px/1.5 Arial,Helvetica,sans-serif}
main{max-width:1100px;margin:auto;background:#fff}
.page{min-height:720px;padding:56px 60px;page-break-after:always}
.cover{background:${escapeHtml(optics.color)};color:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:40px}
.eyebrow{font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.72}
h1{font-size:clamp(48px,8vw,92px);letter-spacing:-.07em;line-height:0.95;margin:10px 0 0}
h2{font-size:clamp(32px,5vw,48px);letter-spacing:-.05em;margin:0 0 28px}
h3{font-size:18px;letter-spacing:-.02em;margin:28px 0 12px}
p{margin:0}
.muted{color:rgba(32,31,30,.55)}
.cover .muted,.cover .idea{color:rgba(255,255,255,.72)}
.cover-lockup{display:grid;place-items:center;min-height:300px;padding:8px 0}
.cover-lockup-card{align-items:center;background:#f3f0ea;border:1px solid rgba(255,255,255,.28);display:flex;justify-content:center;max-width:min(640px,92%);min-height:240px;padding:36px 40px;width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cover-lockup-card svg{display:block;height:auto;max-height:280px;max-width:100%;width:auto}
.idea{max-width:46ch;font-size:16px;line-height:1.45}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 36px}
.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.card{border-top:2px solid #201f1e;padding-top:14px}
.card b{display:block;margin-bottom:8px}
.card p,.card ul{margin:0;color:rgba(32,31,30,.78)}
.lockup-frame{border:1px solid rgba(32,31,30,.14);display:flex;flex-direction:column;gap:14px;min-height:260px;padding:28px 22px 18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lockup-frame.dark{background:#201f1e;border-color:#201f1e;color:#fff}
.lockup-frame.approved{border-color:rgba(32,31,30,.28);grid-column:1/-1;min-height:320px}
.lockup{align-items:center;display:flex;flex:1;justify-content:center;min-height:180px}
.lockup svg{display:block;height:auto;max-height:240px;max-width:100%;width:auto}
.lockup-frame.approved .lockup svg{max-height:300px}
.lockup-frame span{font:11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
.trait{border-top:1px solid rgba(32,31,30,.14);display:flex;flex-direction:column;gap:6px;padding:14px 0}
.trait strong{font-size:15px;letter-spacing:-.02em}
.trait span{color:rgba(32,31,30,.62);font-size:13px;line-height:1.4}
.specs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 28px;margin-top:8px}
.spec{border-top:1px solid rgba(32,31,30,.12);display:flex;justify-content:space-between;gap:16px;padding:10px 0;font-size:13px}
.spec b{font-weight:600}
.spec span{color:rgba(32,31,30,.62);text-align:right}
.palette{display:grid;grid-template-columns:repeat(4,1fr);gap:0;height:160px;margin-top:12px}
.swatch{display:flex;align-items:flex-end;padding:12px;font:11px ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sizes{align-items:end;display:flex;flex-wrap:wrap;gap:28px;margin-top:18px}
.size{display:flex;flex-direction:column;align-items:center;gap:8px}
.size svg{display:block}
.size span{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;opacity:.55}
ul{padding-left:18px;margin:0}
li{margin:7px 0}
button{position:fixed;right:22px;bottom:22px;padding:14px 20px;border:0;background:#ffcf68;color:#201f1e;cursor:pointer;font:600 13px Arial,sans-serif}
@media print{
  body{background:white}
  main{max-width:none}
  .page{height:100vh;min-height:0}
  button{display:none}
  .cover,.lockup-frame.dark,.swatch,.cover-lockup-card{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
@media (max-width:720px){
  .page{padding:32px 22px}
  .grid,.grid-3,.specs{grid-template-columns:1fr}
  .palette{grid-template-columns:1fr 1fr;height:auto}
  .swatch{min-height:88px}
}
</style>
</head>
<body>
<main>
<section class="page cover">
  <div>
    <span class="eyebrow">Mini brand guide / ${year}</span>
    <h1>${brand}</h1>
    ${brief.conceptTitle ? `<p class="muted" style="margin-top:14px">${escapeHtml(brief.conceptTitle)}</p>` : ""}
  </div>
  <div class="cover-lockup"><div class="cover-lockup-card">${coverLockup}</div></div>
  <p class="idea">${escapeHtml(brief.coreIdea || brief.companyDescription || "")}</p>
</section>

<section class="page">
  <span class="eyebrow">01 / Logo system</span>
  <h2>Same mark. Every context.</h2>
  <p class="muted">The approved lockup matches studio production. Alternate layouts below use the same mark and type without free transforms.</p>
  <div class="grid" style="margin-top:28px">
    ${lockupFrame(lockups.primary, `Approved / ${optics.layoutLabel}`, "approved")}
    ${lockupFrame(lockups.horizontal, "Horizontal")}
    ${lockupFrame(lockups.vertical, "Vertical")}
    ${lockupFrame(lockups.icon, "Icon only")}
    ${lockupFrame(lockups.horizontalInverse, "Inverse / horizontal", "dark")}
  </div>
  <h3>Minimum digital sizes</h3>
  <p class="muted">Keep clear space equal to about one quarter of the mark width. Prefer icon-only below 24px wordmark height.</p>
  <div class="sizes">
    ${[16, 24, 32, 48, 64]
      .map((size) => {
        const scaled = buildLockupSvg({
          ...input.lockupBase,
          markSvg: input.markSvg,
          layout: "icon",
          color: optics.color,
          wordmarkSize: size,
          markScale: 100,
        });
        return `<div class="size">${scaled}<span>${size}px</span></div>`;
      })
      .join("")}
  </div>
</section>

<section class="page">
  <span class="eyebrow">02 / Mark character</span>
  <h2>What the logo should feel like.</h2>
  ${brief.conceptSummary ? `<p style="max-width:56ch;margin-bottom:22px">${escapeHtml(brief.conceptSummary)}</p>` : ""}
  ${card("Visual direction", brief.visualDirection)}
  <h3>Personality traits</h3>
  <div class="grid">${personalityCards}</div>
  <h3>Construction notes</h3>
  <ul>
    <li>Single-color silhouette — no gradients, shadows, or photographic texture.</li>
    <li>Mark reads as a constructed form; preserve negative space and stroke weight.</li>
    <li>Do not outline, extrude, or recolor individual parts of the mark.</li>
    <li>Wordmark and mark share one ink color in each approved lockup.</li>
  </ul>
</section>

<section class="page">
  <span class="eyebrow">03 / Optics &amp; type</span>
  <h2>Studio settings captured.</h2>
  <p class="muted">These values reproduce the approved lockup from production.</p>
  <div class="specs">
    <div class="spec"><b>Layout</b><span>${escapeHtml(optics.layoutLabel)}</span></div>
    <div class="spec"><b>Wordmark character</b><span>${escapeHtml(optics.wordmarkStyleLabel)}</span></div>
    <div class="spec"><b>Case</b><span>${escapeHtml(optics.wordmarkCaseLabel)}</span></div>
    <div class="spec"><b>Weight</b><span>${optics.wordmarkWeight}</span></div>
    <div class="spec"><b>Tracking</b><span>${optics.wordmarkTracking}</span></div>
    <div class="spec"><b>Wordmark size</b><span>${optics.wordmarkSize}px</span></div>
    <div class="spec"><b>Mark scale</b><span>${optics.markScale}%</span></div>
    <div class="spec"><b>Descriptor character</b><span>${escapeHtml(optics.descriptorStyleLabel ?? "—")}</span></div>
    <div class="spec"><b>Mark transform</b><span>${[
      optics.markFlipX ? "flip-x" : "",
      optics.markFlipY ? "flip-y" : "",
      optics.markRotate ? `${optics.markRotate}°` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "none"}</span></div>
    <div class="spec"><b>Type rotate</b><span>${[
      optics.wordmarkRotate ? `wordmark ${optics.wordmarkRotate}°` : "",
      optics.descriptorRotate ? `descriptor ${optics.descriptorRotate}°` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "none"}</span></div>
    <div class="spec"><b>Text offset</b><span>${[
      optics.wordmarkOffsetX || optics.wordmarkOffsetY
        ? `wordmark ${optics.wordmarkOffsetX ?? 0},${optics.wordmarkOffsetY ?? 0}`
        : "",
      optics.descriptorOffsetX || optics.descriptorOffsetY
        ? `descriptor ${optics.descriptorOffsetX ?? 0},${optics.descriptorOffsetY ?? 0}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "none"}</span></div>
    <div class="spec"><b>Descriptor</b><span>${escapeHtml(optics.descriptor || "—")}</span></div>
    <div class="spec"><b>Descriptor size</b><span>${optics.descriptorSize}px</span></div>
    <div class="spec"><b>Ink color</b><span>${escapeHtml(optics.color)}</span></div>
  </div>
  <h3>Typography guidance</h3>
  <p>${escapeHtml(brief.strategy?.typography || "Use a restrained grotesk with the captured optical spacing. Do not auto-kern or substitute decorative fonts.")}</p>
</section>

<section class="page">
  <span class="eyebrow">04 / Brand context</span>
  <h2>Why this mark exists.</h2>
  <div class="grid">
    ${card("Industry", brief.industry)}
    ${card("What the company does", brief.companyDescription)}
    ${card("Positioning", brief.positioning)}
    ${card("Audience", brief.audience)}
    ${card("Market", brief.market)}
    ${card("Scale / price", [brief.companyScale, brief.priceSegment].filter(Boolean).join(" · "))}
    ${card("Differentiation", brief.strategy?.differentiation || "")}
    ${card("Color mood", brief.colorMood || brief.brandColors || brief.colorApproach)}
  </div>
  <h3>Direct competitors</h3>
  ${list(brief.directCompetitors)}
  <h3>Visual references</h3>
  ${list(referenceItems)}
</section>

<section class="page">
  <span class="eyebrow">05 / Color &amp; usage</span>
  <h2>Controlled contrast.</h2>
  <div class="palette">${palette
    .slice(0, 4)
    .map((item) => {
      const hex = escapeHtml(item);
      const light = /^#(?:f|e|d)/i.test(item);
      return `<div class="swatch" style="background:${hex};color:${light ? "#201f1e" : "#fff"}">${hex}</div>`;
    })
    .join("")}</div>
  <div class="grid" style="margin-top:34px">
    ${card("Primary usage", brief.usage)}
    ${card("Avoid", brief.avoid)}
  </div>
  ${
    brief.strategy?.categoryCodes?.length
      ? `<h3>Category codes</h3>${list(brief.strategy.categoryCodes)}`
      : ""
  }
</section>

<section class="page">
  <span class="eyebrow">06 / Governance</span>
  <h2>Use with intent.</h2>
  <div class="grid">
    <div class="card">
      <b>Approved lockups</b>
      <ul>
        <li>Vertical (primary)</li>
        <li>Horizontal</li>
        <li>Icon-only</li>
        <li>Black / brand ink and inverse</li>
      </ul>
    </div>
    <div class="card">
      <b>Do not</b>
      <ul>
        <li>Stretch, outline, or add effects to the mark</li>
        <li>Place on busy photography without a clear plate</li>
        <li>Recolor parts of the mark independently</li>
        <li>Set the wordmark in another typeface</li>
      </ul>
    </div>
  </div>
  <h3>Trademark notice</h3>
  <p>${escapeHtml(
    brief.strategy?.trademarkNotice ||
      "A qualified trademark professional must clear the final identity in every intended market.",
  )}</p>
  <p class="muted" style="margin-top:28px">Generated from Loopen studio lockup settings · ${year}</p>
</section>
</main>
<button type="button" onclick="window.print()">Print / Save PDF</button>
</body>
</html>`;
}
