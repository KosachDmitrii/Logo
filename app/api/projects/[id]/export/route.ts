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
    layout?: "horizontal" | "vertical" | "icon";
    color?: string;
    markScale?: number;
    wordmarkCase?: "original" | "upper" | "lower";
    wordmarkWeight?: number;
    wordmarkTracking?: number;
    wordmarkStyle?: string;
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
  const layout =
    input.layout === "vertical" || input.layout === "icon"
      ? input.layout
      : "horizontal";
  const horizontal = layout === "horizontal";
  const iconOnly = layout === "icon";
  const width = iconOnly ? 512 : horizontal ? 1400 : 900;
  const height = iconOnly ? 512 : horizontal ? 420 : 900;
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? "") ? input.color! : "#201f1e";
  const displayBrand =
    input.wordmarkCase === "upper"
      ? row.logo_projects.brand_name.toUpperCase()
      : input.wordmarkCase === "lower"
        ? row.logo_projects.brand_name.toLowerCase()
        : row.logo_projects.brand_name;
  const brand = escapeXml(displayBrand);
  const descriptor = escapeXml((input.descriptor ?? "").trim().slice(0, 80));
  const scale = Math.min(1.12, Math.max(0.88, Number(input.markScale ?? 100) / 100));
  const typography = {
    editorial: {
      family: "Georgia, Times New Roman, serif",
      weight: "500",
      spacing: "-3",
    },
    geometric: {
      family: "Futura, Avenir Next, Arial, sans-serif",
      weight: "600",
      spacing: "-4",
    },
    humanist: {
      family: "Avenir Next, Segoe UI, Arial, sans-serif",
      weight: "500",
      spacing: "-2",
    },
    modern: {
      family: "Arial, Helvetica, sans-serif",
      weight: "600",
      spacing: "-5",
    },
  }[input.wordmarkStyle ?? "modern"] ?? {
    family: "Arial, Helvetica, sans-serif",
    weight: "600",
    spacing: "-5",
  };
  const scaled = (size: number) => Math.round(size * scale);
  const wordmarkWeight = Math.min(
    800,
    Math.max(400, Math.round(Number(input.wordmarkWeight ?? typography.weight) / 100) * 100),
  );
  const wordmarkTracking = Math.min(
    8,
    Math.max(-8, Number(input.wordmarkTracking ?? typography.spacing)),
  );
  const mark = iconOnly
    ? `<svg x="${(512 - scaled(448)) / 2}" y="${(512 - scaled(448)) / 2}" width="${scaled(448)}" height="${scaled(448)}" viewBox="${escapeXml(viewBox)}">${inner}</svg>`
    : horizontal
    ? `<svg x="${210 - scaled(340) / 2}" y="${210 - scaled(340) / 2}" width="${scaled(340)}" height="${scaled(340)}" viewBox="${escapeXml(viewBox)}">${inner}</svg>`
    : `<svg x="${450 - scaled(440) / 2}" y="${290 - scaled(440) / 2}" width="${scaled(440)}" height="${scaled(440)}" viewBox="${escapeXml(viewBox)}">${inner}</svg>`;
  const text = iconOnly
    ? ""
    : horizontal
    ? `<text x="440" y="215" font-family="${typography.family}" font-size="112" font-weight="${wordmarkWeight}" letter-spacing="${wordmarkTracking}">${brand}</text>
       ${descriptor ? `<text x="446" y="275" font-family="Arial, Helvetica, sans-serif" font-size="24" letter-spacing="9">${descriptor.toUpperCase()}</text>` : ""}`
    : `<text x="450" y="650" text-anchor="middle" font-family="${typography.family}" font-size="112" font-weight="${wordmarkWeight}" letter-spacing="${wordmarkTracking}">${brand}</text>
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
      "Content-Disposition": `attachment; filename="${filename}-${layout}.svg"`,
    },
  });
}
