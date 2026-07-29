import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  escapeXml,
  getRuntimeEnv,
  sanitizeSvg,
} from "../../../../../lib/mvp-runtime";
import { selectOne } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  const { id: projectId } = await context.params;
  const input = (await request.json()) as {
    assetId?: string;
    descriptor?: string;
    layout?: "horizontal" | "vertical";
    color?: string;
  };
  const row = await selectOne<{
    object_key: string;
    logo_projects: { brand_name: string };
  }>("logo_assets", {
    select: "object_key,logo_projects!inner(brand_name)",
    id: `eq.${input.assetId ?? ""}`,
    project_id: `eq.${projectId}`,
    user_email: `eq.${user.email}`,
    stage: "eq.vector",
  });
  if (!row) return Response.json({ error: "Vector asset not found." }, { status: 404 });
  const object = await runtime.FILES.get(row.object_key);
  if (!object) return Response.json({ error: "Vector data not found." }, { status: 404 });
  const source = sanitizeSvg(await object.text());
  const inner = source
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "");
  const viewBox = source.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0 0 1024 1024";
  const horizontal = input.layout !== "vertical";
  const width = horizontal ? 1400 : 900;
  const height = horizontal ? 420 : 900;
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? "") ? input.color! : "#201f1e";
  const brand = escapeXml(row.logo_projects.brand_name);
  const descriptor = escapeXml((input.descriptor ?? "").trim().slice(0, 80));
  const mark = horizontal
    ? `<svg x="40" y="40" width="340" height="340" viewBox="${escapeXml(viewBox)}">${inner}</svg>`
    : `<svg x="230" y="70" width="440" height="440" viewBox="${escapeXml(viewBox)}">${inner}</svg>`;
  const text = horizontal
    ? `<text x="440" y="215" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="600" letter-spacing="-5">${brand}</text>
       ${descriptor ? `<text x="446" y="275" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="9">${descriptor.toUpperCase()}</text>` : ""}`
    : `<text x="450" y="650" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="112" font-weight="600" letter-spacing="-5">${brand}</text>
       ${descriptor ? `<text x="450" y="715" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="9">${descriptor.toUpperCase()}</text>` : ""}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="${color}">
  <title>${brand} logo</title>
  ${mark}
  ${text}
</svg>`;
  const filename =
    row.logo_projects.brand_name
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "loopen";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${filename}-${horizontal ? "horizontal" : "vertical"}.svg"`,
    },
  });
}
