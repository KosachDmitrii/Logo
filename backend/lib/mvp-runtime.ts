export type LogoBrief = {
  audience: string;
  avoid: string;
  brandName: string;
  companyDescription: string;
  competitors: string;
  colorApproach: "propose" | "existing" | "mood";
  brandColors: string;
  colorMood: string;
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

type RuntimeEnv = {
  OPENAI_API_KEY?: string;
  RECRAFT_API_KEY?: string;
  GEMINI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export const directions: Direction[] = [
  {
    key: "continuous",
    title: "Continuous Space",
    thesis:
      "Constraint becomes flow: one decisive continuous move turns ordinary space into energy.",
  },
  {
    key: "portal",
    title: "Open Counterform",
    thesis:
      "A precise opening turns solid mass into invitation — clarity you want to enter.",
  },
  {
    key: "signal",
    title: "Modular Rhythm",
    thesis:
      "Unequal parts compose a site-specific rhythm — spacing carries the character.",
  },
  {
    key: "fold",
    title: "Constructive Tension",
    thesis:
      "Rigor meets play at one controlled collision — intelligent, never cute.",
  },
];

type DirectionIdea = {
  invent: string;
  feel: string;
  trap: string;
};

function directionIdea(direction: Direction): DirectionIdea {
  const ideas: Record<string, DirectionIdea> = {
    continuous: {
      invent:
        "one decisive continuous gesture that turns a constraint into spatial energy",
      feel: "activated, precise, memorable — architecture as catalyst, not decoration",
      trap:
        "do not draw a ribbon, ring, loop, stadium O, infinity path or soft blob",
    },
    portal: {
      invent:
        "solidity transformed by one intentional opening that feels designed, not punched out",
      feel: "open, human, intelligent — a threshold with attitude",
      trap:
        "do not draw a random inkblot with a cut, a circle with a bite, or a literal doorway",
    },
    signal: {
      invent:
        "a composed rhythm of unequal parts where the gaps matter as much as the masses",
      feel: "modular, deliberate, contemporary — specific, not a kit of parts",
      trap:
        "do not arrange three default rectangles, dots or bars like a UI icon",
    },
    fold: {
      invent:
        "two contrasting characters meeting at one joint that creates tension and wit",
      feel: "bold but controlled — precise geometry with one playful counter-move",
      trap:
        "do not place a circle next to a rectangle like a school exercise",
    },
  };
  return ideas[direction.key.split("-")[0]] ?? {
    invent: "one surprising abstract idea that could only belong to this brand",
    feel: "distinctive, calm, ownable",
    trap: "do not invent a generic geometric exercise",
  };
}

export function getRuntimeEnv(): Pick<
  RuntimeEnv,
  | "OPENAI_API_KEY"
  | "RECRAFT_API_KEY"
  | "GEMINI_API_KEY"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
> {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    RECRAFT_API_KEY: process.env.RECRAFT_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function buildRefinementPrompt(
  brief: LogoBrief,
  directionTitle: string,
  variant: number,
) {
  return `
Refine the supplied image into one production-ready brand logo symbol.

Brand: ${brief.brandName}
Core idea: ${brief.coreIdea}
Industry: ${brief.industry}
What the company does: ${brief.companyDescription}
Positioning: ${brief.positioning || "premium, differentiated, contemporary"}
Personality: ${brief.personalities.join(", ") || "intelligent, clear, memorable"}
Selected direction: ${directionTitle}
Variant: ${variant === 1 ? "optically balanced and restrained" : "slightly bolder and more distinctive"}
Visual direction: ${brief.visualDirection || "minimal, distinctive, ownable"}
Competitors to remain visually distinct from: ${brief.competitors || "common category leaders"}
Avoid: ${brief.avoid || "literal industry icons and stock-logo clichés"}

Image 0 is the approved source symbol. Preserve its central visual idea,
recognizable silhouette and overall geometry. Do not reinterpret it as a new concept.
Raise it to identity-system quality: optical balance, crisp edges, intentional
negative space, consistent stroke/mass logic, 24px clarity and vector-readiness.
Remove accidental blobs, soft AI edges, symmetry-by-default and generic styling.

Return one isolated flat near-black symbol centered on a plain white background.
ABSOLUTELY NO letters, words, brand name, pseudo-text, typography, numbers or captions.
No border, mockup, presentation card, gradients, shadows, texture, 3D or unrelated new concept.
  `.trim();
}

export { sanitizeSvg } from "./sanitize-svg";

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
  const brandName = cleanString(input.brandName);
  const coreIdea = cleanString(input.coreIdea);
  const industry = cleanString(input.industry);
  const companyDescription = cleanString(input.companyDescription);
  const audience = cleanString(input.audience);
  const avoid = cleanString(input.avoid);
  const positioning = cleanString(input.positioning);
  const competitors = cleanString(input.competitors);
  const colorApproaches = ["propose", "existing", "mood"] as const;
  const colorApproach = colorApproaches.includes(
    input.colorApproach as (typeof colorApproaches)[number],
  )
    ? (input.colorApproach as LogoBrief["colorApproach"])
    : "propose";
  const brandColors = cleanString(input.brandColors);
  const colorMood = cleanString(input.colorMood);
  const visualDirection = cleanString(input.visualDirection);
  const usage = cleanString(input.usage);
  const logoTypes = ["abstract", "monogram", "wordmark", "emblem", "combination"] as const;
  const logoType = logoTypes.includes(input.logoType as (typeof logoTypes)[number])
    ? (input.logoType as LogoBrief["logoType"])
    : "abstract";
  const personalities = Array.isArray(input.personalities)
    ? input.personalities
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
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
    colorApproach,
    brandColors,
    colorMood,
    coreIdea,
    industry,
    logoType,
    personalities,
    positioning,
    usage,
    visualDirection,
  };
}

function redactBrandName(value: string, brandName: string) {
  const name = brandName.trim();
  if (!name) return value;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(new RegExp(escaped, "gi"), "the studio");
}

export function buildPrompt(
  brief: LogoBrief,
  direction: Direction,
  options: { recoveryMode?: boolean } = {},
) {
  const idea = directionIdea(direction);
  // Never put the real brand name in an image prompt — Flux will try to
  // typeset it (often as garbled pseudo-text). Keep only semantic context.
  const company = redactBrandName(brief.companyDescription, brief.brandName);
  const coreIdea = redactBrandName(brief.coreIdea, brief.brandName);
  const positioning = redactBrandName(
    brief.positioning || "premium, differentiated, contemporary",
    brief.brandName,
  );
  const brandBlock = `
Studio type: ${brief.industry}
What they do: ${company}
Idea the mark must express: ${coreIdea}
Personality: ${brief.personalities.join(", ") || "intelligent, precise, memorable"}
Positioning: ${positioning}
Stay distinct from: ${brief.competitors || "common category leaders"}
Avoid: ${brief.avoid || "literal industry icons and stock-logo clichés"}
  `.trim();

  if (options.recoveryMode) {
    return `
ICON ONLY. One abstract graphic mark. Zero typography.

${brandBlock}

Territory: ${direction.title} — ${direction.thesis}
Invent from: ${idea.invent}
Feel: ${idea.feel}
Trap: ${idea.trap}

Flat near-black symbol on plain white. Few parts. Strong at 24px.
ABSOLUTELY NO letters, words, brand names, initials, numbers or fake text.
No buildings, food, mockups, gradients, shadows or 3D.
    `.trim();
  }

  return `
ICON ONLY — a pure graphic symbol with ZERO text.
Do not write any brand name, word, letter, initial, number or fake typography.
The wordmark will be added later outside this image.

${brandBlock}

Concept territory: ${direction.title}
Thesis: ${direction.thesis}
Invent from this metaphor: ${idea.invent}
It should feel: ${idea.feel}
Trap to avoid: ${idea.trap}

Critical instruction:
Invent a strong visual idea first. Geometry is only the consequence of that idea.
Do not execute a generic abstract exercise. Do not literally assemble the metaphor
into stock shapes. Make a mark that could become a recognizable identity for this
studio — specific, memorable, and hard to confuse with default AI geometry.

Craft: flat near-black solid shapes on plain off-white; optically balanced; few parts;
sharp silhouette; recognizable at 24px.
Forbidden: letters, words, initials, numbers, pseudo-text, captions, signatures,
mockups, borders, people, products, buildings, roofs, doorways, floor plans, skylines,
food imagery, gradients, shadows, texture, 3D or photographic treatment.
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

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
