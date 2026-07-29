import { env } from "cloudflare:workers";

export type LogoBrief = {
  audience: string;
  avoid: string;
  brandName: string;
  companyDescription: string;
  competitors: string;
  coreIdea: string;
  industry: string;
  logoType: "abstract" | "monogram" | "wordmark" | "emblem" | "combination";
  personalities: string[];
  positioning: string;
  usage: string;
  visualDirection: string;
  strategy?: BrandStrategy;
};

export type BrandStrategy = {
  categoryCodes: string[];
  competitorRisks: string[];
  differentiation: string;
  typography: string;
  palette: string[];
  trademarkNotice: string;
  creativeDirections: Direction[];
};

export type Direction = {
  key: string;
  title: string;
  thesis: string;
};

type DirectionRecipe = {
  composition: string;
  geometry: string;
  signature: string;
};

type RuntimeEnv = {
  FILES?: R2Bucket;
  OPENAI_API_KEY?: string;
  RECRAFT_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
};

export const directions: Direction[] = [
  {
    key: "continuous",
    title: "Continuous Space",
    thesis:
      "One uninterrupted form turns spatial continuity into a memorable abstract silhouette.",
  },
  {
    key: "portal",
    title: "Open Counterform",
    thesis:
      "A surprising internal void creates openness without drawing a literal doorway.",
  },
  {
    key: "signal",
    title: "Modular Rhythm",
    thesis:
      "Three unequal modules create a precise rhythm through spacing, not architectural illustration.",
  },
  {
    key: "fold",
    title: "Constructive Tension",
    thesis:
      "Two opposing masses meet at one controlled interruption, balancing rigor and play.",
  },
];

function directionRecipe(direction: Direction): DirectionRecipe {
  const recipes: Record<string, DirectionRecipe> = {
    continuous: {
      composition: "one continuous asymmetric form with a clear visual flow",
      geometry:
        "a broad bent band with one controlled change of direction and generous internal space",
      signature:
        "the uninterrupted path and deliberately off-center balance",
    },
    portal: {
      composition:
        "one compact mass transformed by a single asymmetric internal counterform",
      geometry:
        "a curved outer silhouette with one precisely cut oblique void, never a rectangular opening",
      signature: "the unexpected negative-space cut",
    },
    signal: {
      composition:
        "three separate unequal modules arranged in a horizontal rhythmic sequence",
      geometry:
        "one circle-derived module, one short bar and one angled module with deliberate spacing",
      signature: "the cadence between three non-touching parts",
    },
    fold: {
      composition: "two interlocking masses under visible constructive tension",
      geometry:
        "one rounded mass and one sharp oblique mass meeting at a narrow controlled joint",
      signature: "the contrast between soft and precise geometry",
    },
  };
  return recipes[direction.key.split("-")[0]] ?? {
    composition: "one compact asymmetric abstract composition",
    geometry: "two or three simple non-literal geometric masses",
    signature: "one unusual relationship between forms",
  };
}

export function getRuntimeEnv(): Required<
  Pick<RuntimeEnv, "FILES">
> &
  Pick<
    RuntimeEnv,
    | "OPENAI_API_KEY"
    | "RECRAFT_API_KEY"
    | "SUPABASE_URL"
    | "SUPABASE_SERVICE_ROLE_KEY"
    | "CLOUDFLARE_ACCOUNT_ID"
    | "CLOUDFLARE_API_TOKEN"
  > {
  const runtime = env as unknown as RuntimeEnv;
  if (!runtime.FILES) {
    throw new Error("Project storage is not configured.");
  }

  return {
    FILES: runtime.FILES,
    OPENAI_API_KEY: runtime.OPENAI_API_KEY,
    RECRAFT_API_KEY: runtime.RECRAFT_API_KEY,
    SUPABASE_URL: runtime.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: runtime.SUPABASE_SERVICE_ROLE_KEY,
    CLOUDFLARE_ACCOUNT_ID: runtime.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_API_TOKEN: runtime.CLOUDFLARE_API_TOKEN,
  };
}

export function buildRefinementPrompt(
  brief: LogoBrief,
  directionTitle: string,
  variant: number,
) {
  return `
Refine the supplied image into one production-ready abstract logo symbol.

Brand idea: ${brief.coreIdea}
Industry: ${brief.industry}
What the company does: ${brief.companyDescription}
Positioning: ${brief.positioning}
Personality: ${brief.personalities.join(", ") || "intelligent, clear, memorable"}
Selected direction: ${directionTitle}
Variant: ${variant === 1 ? "optically balanced and restrained" : "slightly bolder and more distinctive"}
Logo type: ${brief.logoType}
Visual direction: ${brief.visualDirection}
Competitors to remain visually distinct from: ${brief.competitors || "none supplied"}

Image 0 is the approved source symbol. Preserve its central visual idea,
recognizable silhouette and overall geometry. Do not reinterpret it as a new concept.
Improve optical balance, spacing, negative space, consistency, small-size clarity
and professional vector-readiness. Remove accidental details and generic styling.

Return one isolated flat near-black symbol centered on a plain white background.
ABSOLUTELY NO letters, words, brand name, pseudo-text, typography, numbers or captions.
No border, mockup, presentation card, gradients, shadows, texture, 3D or unrelated new concept.
  `.trim();
}

export function sanitizeSvg(svg: string) {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(?:"https?:[^"]*"|'https?:[^']*')/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
}

export function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

export function validateBrief(value: unknown): LogoBrief {
  if (!value || typeof value !== "object") {
    throw new Error("A brand brief is required.");
  }

  const input = value as Record<string, unknown>;
  const brandName = cleanString(input.brandName, 80);
  const coreIdea = cleanString(input.coreIdea, 500);
  const industry = cleanString(input.industry, 120);
  const companyDescription = cleanString(input.companyDescription, 500);
  const audience = cleanString(input.audience, 300);
  const avoid = cleanString(input.avoid, 300);
  const positioning = cleanString(input.positioning, 300);
  const competitors = cleanString(input.competitors, 500);
  const visualDirection = cleanString(input.visualDirection, 200);
  const usage = cleanString(input.usage, 300);
  const logoTypes = ["abstract", "monogram", "wordmark", "emblem", "combination"] as const;
  const logoType = logoTypes.includes(input.logoType as (typeof logoTypes)[number])
    ? (input.logoType as LogoBrief["logoType"])
    : "abstract";
  const personalities = Array.isArray(input.personalities)
    ? input.personalities
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (!brandName || !coreIdea || !industry || !companyDescription) {
    throw new Error(
      "Brand name, industry, company description and core idea are required.",
    );
  }

  return {
    audience,
    avoid,
    brandName,
    companyDescription,
    competitors,
    coreIdea,
    industry,
    logoType,
    personalities,
    positioning,
    usage,
    visualDirection,
  };
}

export function buildPrompt(
  brief: LogoBrief,
  direction: Direction,
  options: { recoveryMode?: boolean } = {},
) {
  if (options.recoveryMode) {
    return `
Create exactly one clean abstract geometric logo symbol.

Creative direction: ${direction.title}
Visual thesis: ${direction.thesis}

Use one simple near-black shape with balanced negative space, centered on a
plain white background. Make it distinctive, calm, professional, flat,
single-color and recognizable at 24 pixels.

The image must contain only the symbol. No text, letters, words, initials,
numbers, typography, captions, borders, mockups, people, products, scenery,
gradients, shadows, texture, lighting effects, 3D or photographic elements.
Do not use literal industry icons or familiar stock-logo constructions.
    `.trim();
  }

  const recipe = directionRecipe(direction);
  return `
Create exactly one original graphic logo mark, not a brand-name treatment.
The brand name is intentionally absent and will be typeset separately.

Creative route: ${direction.title}
Idea: ${direction.thesis}
Composition: ${recipe.composition}.
Construction: ${recipe.geometry}.
Distinctive device: recognition comes from ${recipe.signature}.
Character: ${brief.personalities.join(", ") || "intelligent, precise, playful"}.

Render a single isolated near-black vector-like mark, centered on a plain
off-white square. Use flat solid shapes, a strong silhouette, balanced negative
space and very few components. It must remain recognizable at 24 pixels.

The canvas contains the mark only: no letters, words, initials, numbers,
pseudo-text, captions, borders, presentation layout, products, people or
scenery. Keep the idea abstract and non-literal. No building, roof, house,
doorway, skyline or floor-plan pictogram. No gradient, shadow, texture, lighting
effect, outline clutter, 3D or photographic treatment.
  `.trim();
}

export async function hashIdentity(value: string) {
  const bytes = new TextEncoder().encode(value.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
