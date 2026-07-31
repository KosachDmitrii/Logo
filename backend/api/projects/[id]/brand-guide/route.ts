import { getStudioUser } from "@/backend/auth/session";
import { prepareLockupMarkSvg } from "@/frontend/lib/lockup-svg";
import {
  escapeXml,
  type LogoBrief,
  sanitizeSvg,
} from "@/backend/lib/mvp-runtime";
import { selectOne } from "@/backend/lib/supabase";
import { getObject } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) return new Response("Authentication required.", { status: 401 });
  const { id: projectId } = await context.params;
  const url = new URL(request.url);
  const assetId = url.searchParams.get("assetId") ?? "";
  const row = await selectOne<{
    object_key: string;
    logo_projects: { brand_name: string; brief_json: LogoBrief };
  }>("logo_assets", {
    select: "object_key,logo_projects!inner(brand_name,brief_json)",
    id: `eq.${assetId}`,
    project_id: `eq.${projectId}`,
    user_email: `eq.${user.email}`,
    stage: "eq.vector",
  });
  if (!row) return new Response("Vector asset not found.", { status: 404 });
  const object = await getObject(row.object_key);
  if (!object) return new Response("Vector data not found.", { status: 404 });

  const brief = row.logo_projects.brief_json;
  const strategy = brief.strategy;
  const nameSource =
    (url.searchParams.get("name") ?? "").trim() || row.logo_projects.brand_name;
  const brand = escapeXml(nameSource);
  const descriptor = escapeXml(
    (url.searchParams.get("descriptor") ?? "").slice(0, 80),
  );
  const color = /^#[0-9a-f]{6}$/i.test(url.searchParams.get("color") ?? "")
    ? url.searchParams.get("color")!
    : "#201F1E";
  const palette = strategy?.palette ?? [color, "#F3F0EA", "#FFCF68", "#FFFFFF"];
  const svg = prepareLockupMarkSvg(sanitizeSvg(await object.text()), color);
  const list = (items: string[]) =>
    items.map((item) => `<li>${escapeXml(item)}</li>`).join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand} — Mini brand guide</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#ece9e4;color:#201f1e;font:15px/1.5 Arial,sans-serif}
main{max-width:1100px;margin:auto;background:#fff}.page{min-height:720px;padding:60px;page-break-after:always}
.cover{background:${color};color:#fff;display:flex;flex-direction:column;justify-content:space-between}
h1{font-size:92px;letter-spacing:-.07em;margin:0}h2{font-size:48px;letter-spacing:-.05em;margin:0 0 35px}
.eyebrow{font:12px monospace;letter-spacing:.12em;text-transform:uppercase}.mark{height:300px;display:grid;place-items:center}
.mark svg{height:260px;max-width:80%;width:260px}.mark svg *{fill:currentColor!important}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:35px}.card{border-top:2px solid;padding-top:16px}
.palette{display:grid;grid-template-columns:repeat(4,1fr);height:180px}.swatch{padding:15px;font:11px monospace}
.dark{background:#201f1e;color:white}.dark svg *{fill:white!important}li{margin:8px 0}
button{position:fixed;right:22px;bottom:22px;padding:14px 20px;border:0;background:#ffcf68;cursor:pointer}
@media print{body{background:white}main{max-width:none}.page{height:100vh}button{display:none}}
</style>
</head>
<body><main>
<section class="page cover"><div><span class="eyebrow">Mini brand guide / 2026</span><h1>${brand}</h1>${descriptor ? `<p>${descriptor}</p>` : ""}</div><div class="mark">${svg}</div><p>${escapeXml(brief.coreIdea)}</p></section>
<section class="page"><span class="eyebrow">01 / Strategy</span><h2>Built to mean something.</h2><div class="grid">
<div class="card"><b>Industry</b><p>${escapeXml(brief.industry)}</p></div>
<div class="card"><b>Positioning</b><p>${escapeXml(brief.positioning)}</p></div>
<div class="card"><b>Differentiation</b><p>${escapeXml(strategy?.differentiation ?? brief.coreIdea)}</p></div>
<div class="card"><b>Typography</b><p>${escapeXml(strategy?.typography ?? "Use a restrained grotesk with custom optical spacing.")}</p></div>
</div></section>
<section class="page"><span class="eyebrow">02 / Logo system</span><h2>One mark. Every context.</h2><div class="grid">
<div class="card"><div class="mark">${svg}</div><b>Primary / light</b></div>
<div class="card dark"><div class="mark">${svg}</div><b>Inverse / dark</b></div>
</div><h3>Minimum digital size</h3><p>16 px for favicon, 24 px for interface use, 48 px for social avatars. Preserve clear space equal to one quarter of the mark width.</p></section>
<section class="page"><span class="eyebrow">03 / Color</span><h2>Controlled contrast.</h2><div class="palette">${palette.map((item) => `<div class="swatch" style="background:${escapeXml(item)}">${escapeXml(item)}</div>`).join("")}</div>
<h3>Category codes</h3><ul>${list(strategy?.categoryCodes ?? [])}</ul>
<h3>Avoid</h3><p>${escapeXml(brief.avoid)}</p></section>
<section class="page"><span class="eyebrow">04 / Governance</span><h2>Use with intent.</h2><div class="grid">
<div class="card"><b>Approved lockups</b><ul><li>Horizontal</li><li>Vertical</li><li>Icon-only</li><li>Black and inverse</li></ul></div>
<div class="card"><b>Trademark notice</b><p>${escapeXml(strategy?.trademarkNotice ?? "A qualified trademark professional must clear the final identity in every intended market.")}</p></div>
</div></section>
</main><button onclick="window.print()">Print / Save PDF</button></body></html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
    },
  });
}
