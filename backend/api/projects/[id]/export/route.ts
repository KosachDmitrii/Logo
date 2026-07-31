import { getStudioUser } from "@/backend/auth/session";
import { prepareLockupMarkSvg } from "@/frontend/lib/lockup-svg";
import { escapeXml, sanitizeSvg } from "@/backend/lib/mvp-runtime";
import { selectOne } from "@/backend/lib/supabase";
import { getObject } from "@/backend/lib/storage";

export const dynamic = "force-dynamic";

function estimateTextWidth(
  text: string,
  fontSize: number,
  trackingEm: number,
) {
  if (!text) return 0;
  // Approximate grotesk advance width; good enough for canvas sizing.
  const advance = fontSize * (0.56 + trackingEm);
  return Math.max(fontSize, text.length * advance);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getStudioUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { id: projectId } = await context.params;
  const input = (await request.json()) as {
    assetId?: string;
    brandName?: string;
    descriptor?: string;
    layout?: "horizontal" | "vertical" | "icon";
    color?: string;
    markScale?: number;
    wordmarkCase?: "original" | "upper" | "lower";
    wordmarkSize?: number;
    descriptorSize?: number;
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
  const object = await getObject(row.object_key);
  if (!object) return Response.json({ error: "Vector data not found." }, { status: 404 });
  const source = sanitizeSvg(await object.text());
  const color = /^#[0-9a-f]{6}$/i.test(input.color ?? "") ? input.color! : "#201f1e";
  const prepared = prepareLockupMarkSvg(source, color);
  const inner = prepared
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "");
  const viewBox = prepared.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1] ?? "0 0 1024 1024";
  const layout =
    input.layout === "vertical" || input.layout === "icon"
      ? input.layout
      : "horizontal";
  const horizontal = layout === "horizontal";
  const iconOnly = layout === "icon";
  const nameSource = (input.brandName ?? "").trim() || row.logo_projects.brand_name;
  const displayBrand =
    input.wordmarkCase === "upper"
      ? nameSource.toUpperCase()
      : input.wordmarkCase === "lower"
        ? nameSource.toLowerCase()
        : nameSource;
  const brand = escapeXml(displayBrand);
  const descriptorRaw = (input.descriptor ?? "").trim().slice(0, 80);
  const descriptorUpper = escapeXml(descriptorRaw.toUpperCase());

  // Mirror preview formulas in frontend/loopen-studio.tsx + globals.css
  const markScaleFactor = Math.min(4, Math.max(0.7, Number(input.markScale ?? 100) / 100));
  const titleSize = Math.min(192, Math.max(24, Math.round(Number(input.wordmarkSize ?? 112))));
  const lineSize = Math.min(36, Math.max(6, Math.round(Number(input.descriptorSize ?? 24))));
  const markSize = Math.round(
    (layout === "vertical" ? titleSize * 2 : titleSize * 2.2) * markScaleFactor,
  );
  const typography = {
    editorial: {
      family: "Georgia, Times New Roman, serif",
      weight: "500",
      spacing: -0.03,
    },
    geometric: {
      family: "Futura, Avenir Next, Arial, sans-serif",
      weight: "600",
      spacing: -0.04,
    },
    humanist: {
      family: "Avenir Next, Segoe UI, Arial, sans-serif",
      weight: "500",
      spacing: -0.02,
    },
    modern: {
      family: "Arial, Helvetica, sans-serif",
      weight: "600",
      spacing: -0.05,
    },
  }[input.wordmarkStyle ?? "modern"] ?? {
    family: "Arial, Helvetica, sans-serif",
    weight: "600",
    spacing: -0.05,
  };
  const wordmarkWeight = Math.min(
    800,
    Math.max(400, Math.round(Number(input.wordmarkWeight ?? typography.weight) / 100) * 100),
  );
  const trackingInput = Number(input.wordmarkTracking);
  const trackingEm = Number.isFinite(trackingInput)
    ? Math.min(0.08, Math.max(-0.08, trackingInput / 100))
    : typography.spacing;
  const brandLetterSpacing = titleSize * trackingEm;
  const descriptorLetterSpacing = lineSize * 0.28;
  const markGap = Math.round(titleSize * (horizontal ? 0.16 : 0.18));
  const descriptorGap = Math.round(titleSize * 0.14);
  const typeHeight =
    titleSize * 0.92 + (descriptorRaw ? descriptorGap + lineSize : 0);
  const brandWidth = estimateTextWidth(displayBrand, titleSize, trackingEm);
  const descriptorWidth = descriptorRaw
    ? estimateTextWidth(descriptorRaw.toUpperCase(), lineSize, 0.28)
    : 0;
  const typeWidth = Math.max(brandWidth, descriptorWidth);
  const pad = Math.round(Math.max(24, titleSize * 0.35));

  let width: number;
  let height: number;
  let markX: number;
  let markY: number;
  let brandX: number;
  let brandY: number;
  let descX: number;
  let descY: number;
  let textAnchor: "start" | "middle" = "start";

  if (iconOnly) {
    width = markSize + pad * 2;
    height = markSize + pad * 2;
    markX = pad;
    markY = pad;
    brandX = 0;
    brandY = 0;
    descX = 0;
    descY = 0;
  } else if (horizontal) {
    const rowHeight = Math.max(markSize, typeHeight);
    width = pad + markSize + markGap + typeWidth + pad;
    height = pad + rowHeight + pad;
    markX = pad;
    markY = pad + (rowHeight - markSize) / 2;
    brandX = pad + markSize + markGap;
    const typeTop = pad + (rowHeight - typeHeight) / 2;
    brandY = typeTop + titleSize * 0.85;
    descX = brandX;
    descY = brandY + descriptorGap + lineSize * 0.85;
    textAnchor = "start";
  } else {
    // vertical — same structure as the studio preview
    const contentWidth = Math.max(markSize, typeWidth);
    width = pad + contentWidth + pad;
    height = pad + markSize + markGap + typeHeight + pad;
    markX = pad + (contentWidth - markSize) / 2;
    markY = pad;
    brandX = pad + contentWidth / 2;
    brandY = pad + markSize + markGap + titleSize * 0.85;
    descX = brandX;
    descY = brandY + descriptorGap + lineSize * 0.85;
    textAnchor = "middle";
  }

  const mark = `<svg x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" viewBox="${escapeXml(viewBox)}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
  const text = iconOnly
    ? ""
    : `<text x="${brandX}" y="${brandY}" text-anchor="${textAnchor}" font-family="${typography.family}" font-size="${titleSize}" font-weight="${wordmarkWeight}" letter-spacing="${brandLetterSpacing}" fill="${color}">${brand}</text>
       ${
         descriptorRaw
           ? `<text x="${descX}" y="${descY}" text-anchor="${textAnchor}" font-family="Arial, Helvetica, sans-serif" font-size="${lineSize}" letter-spacing="${descriptorLetterSpacing}" fill="${color}">${descriptorUpper}</text>`
           : ""
       }`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}">
  <title>${brand} logo</title>
  ${mark}
  ${text}
</svg>`;
  const filename =
    nameSource
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "loopen";
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${filename}-${layout}.svg"`,
    },
  });
}
