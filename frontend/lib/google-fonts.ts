export type GoogleLockupFont = {
  id: string;
  family: string;
  /** Fallback CSS stack after the Google family. */
  fallback: string;
  category: "sans" | "serif" | "display";
  weights: number[];
};

/** Curated Google Fonts for lockup wordmark / descriptor. */
export const GOOGLE_LOCKUP_FONTS: GoogleLockupFont[] = [
  {
    id: "gf-inter",
    family: "Inter",
    fallback: "Arial, Helvetica, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "gf-space-grotesk",
    family: "Space Grotesk",
    fallback: "Arial, Helvetica, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700],
  },
  {
    id: "gf-manrope",
    family: "Manrope",
    fallback: "Arial, Helvetica, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "gf-dm-sans",
    family: "DM Sans",
    fallback: "Arial, Helvetica, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700],
  },
  {
    id: "gf-outfit",
    family: "Outfit",
    fallback: "Arial, Helvetica, sans-serif",
    category: "sans",
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "gf-syne",
    family: "Syne",
    fallback: "Arial, Helvetica, sans-serif",
    category: "display",
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: "gf-playfair",
    family: "Playfair Display",
    fallback: "Georgia, 'Times New Roman', serif",
    category: "serif",
    weights: [400, 500, 600, 700],
  },
  {
    id: "gf-fraunces",
    family: "Fraunces",
    fallback: "Georgia, 'Times New Roman', serif",
    category: "serif",
    weights: [400, 500, 600, 700],
  },
  {
    id: "gf-libre-baskerville",
    family: "Libre Baskerville",
    fallback: "Georgia, 'Times New Roman', serif",
    category: "serif",
    weights: [400, 700],
  },
  {
    id: "gf-bebas-neue",
    family: "Bebas Neue",
    fallback: "Impact, Arial Narrow, sans-serif",
    category: "display",
    weights: [400],
  },
];

const BY_ID = new Map(GOOGLE_LOCKUP_FONTS.map((font) => [font.id, font]));

export function isGoogleFontStyle(style: string | undefined): boolean {
  return Boolean(style && BY_ID.has(style));
}

export function getGoogleFont(
  style: string | undefined,
): GoogleLockupFont | undefined {
  if (!style) return undefined;
  return BY_ID.get(style);
}

export function googleFontCssFamily(font: GoogleLockupFont): string {
  return `'${font.family}', ${font.fallback}`;
}

/** Keep sentence case for soft / serif stacks; uppercase for crisp sans. */
export function keepsDescriptorCase(style: string | undefined): boolean {
  if (style === "editorial" || style === "humanist") return true;
  const google = getGoogleFont(style);
  if (!google) return false;
  return google.category === "serif" || google.category === "display";
}

export function googleFontsStylesheetHref(styles: Array<string | undefined>): string | null {
  const families = Array.from(
    new Set(
      styles
        .map((style) => getGoogleFont(style)?.family)
        .filter((family): family is string => Boolean(family)),
    ),
  );
  if (!families.length) return null;
  const params = families
    .map((family) => {
      const font = GOOGLE_LOCKUP_FONTS.find((item) => item.family === family)!;
      const weights = font.weights.join(";");
      return `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weights}`;
    })
    .join("&");
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

function closestWeight(weights: number[], wanted: number): number {
  return weights.reduce((best, weight) =>
    Math.abs(weight - wanted) < Math.abs(best - wanted) ? weight : best,
  );
}

/** Fetch a single woff2 as data URI for SVG @font-face embed. */
export async function fetchGoogleFontEmbed(
  style: string,
  weight = 600,
): Promise<{ cssFamily: string; dataUri: string } | null> {
  const font = getGoogleFont(style);
  if (!font) return null;
  const wght = closestWeight(font.weights, weight);
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@${wght}&display=swap`;
  try {
    const cssResponse = await fetch(cssUrl);
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();
    const urlMatch = css.match(
      /url\((['"]?)(https:\/\/fonts\.gstatic\.com\/[^)'"]+)\1\)/,
    );
    const fontUrl = urlMatch?.[2];
    if (!fontUrl) return null;
    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) return null;
    const buffer = await fontResponse.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]!);
    }
    const contentType =
      fontResponse.headers.get("content-type") || "font/woff2";
    return {
      cssFamily: font.family,
      dataUri: `data:${contentType};base64,${btoa(binary)}`,
    };
  } catch {
    return null;
  }
}

export function lockupTypeStyleLabel(
  style: string,
  translate: (key: string) => string,
): string {
  const google = getGoogleFont(style);
  if (google) return google.family;
  const key = `prod.type.${style}`;
  const label = translate(key);
  return label === key ? style : label;
}
