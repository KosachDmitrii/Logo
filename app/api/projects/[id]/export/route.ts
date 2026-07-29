import { getChatGPTUser } from "../../../../chatgpt-auth";
import {
  ensureSchema,
  escapeXml,
  getRuntimeEnv,
  sanitizeSvg,
} from "../../../../../lib/mvp-runtime";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const runtime = getRuntimeEnv();
  await ensureSchema(runtime.DB);
  const { id: projectId } = await context.params;
  const input = (await request.json()) as {
    assetId?: string;
    descriptor?: string;
    layout?: "horizontal" | "vertical";
    color?: string;
  };
  const row = await runtime.DB.prepare(
    `SELECT a.object_key AS objectKey, p.brand_name AS brandName
     FROM logo_assets a JOIN logo_projects p ON p.id = a.project_id
     WHERE a.id = ? AND a.project_id = ? AND a.user_email = ? AND a.stage = 'vector'`,
  )
    .bind(input.assetId ?? "", projectId, user.email)
    .first<{ objectKey: string; brandName: string }>();
  if (!row) return Response.json({ error: "Vector asset not found." }, { status: 404 });
  const object = await runtime.FILES.get(row.objectKey);
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
  const brand = escapeXml(row.brandName);
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
  const filename = row.brandName.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "loopen";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${filename}-${horizontal ? "horizontal" : "vertical"}.svg"`,
    },
  });
}
