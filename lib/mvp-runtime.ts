import { env } from "cloudflare:workers";

export type LogoBrief = {
  audience: string;
  avoid: string;
  brandName: string;
  coreIdea: string;
  personalities: string[];
};

export type Direction = {
  key: string;
  title: string;
  thesis: string;
};

type RuntimeEnv = {
  DB?: D1Database;
  FILES?: R2Bucket;
  OPENAI_API_KEY?: string;
};

export const directions: Direction[] = [
  {
    key: "continuous",
    title: "Continuous Logic",
    thesis:
      "One evolving gesture that communicates learning, rhythm and forward movement.",
  },
  {
    key: "portal",
    title: "Open Portal",
    thesis:
      "A precise opening that turns repetition into entry, discovery and possibility.",
  },
  {
    key: "signal",
    title: "Signal Exchange",
    thesis:
      "Two distinct states connected by a confident transfer of energy and information.",
  },
  {
    key: "fold",
    title: "Soft Structure",
    thesis:
      "A disciplined geometric system softened by one tactile, memorable fold.",
  },
];

export function getRuntimeEnv(): Required<
  Pick<RuntimeEnv, "DB" | "FILES">
> &
  Pick<RuntimeEnv, "OPENAI_API_KEY"> {
  const runtime = env as unknown as RuntimeEnv;
  if (!runtime.DB || !runtime.FILES) {
    throw new Error("Project storage is not configured.");
  }

  return {
    DB: runtime.DB,
    FILES: runtime.FILES,
    OPENAI_API_KEY: runtime.OPENAI_API_KEY,
  };
}

export async function ensureSchema(database: D1Database) {
  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS logo_projects (
        id TEXT PRIMARY KEY NOT NULL,
        user_email TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        brief_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'created',
        selected_generation_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `),
    database.prepare(`
      CREATE TABLE IF NOT EXISTS logo_generations (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        direction_key TEXT NOT NULL,
        direction_title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        object_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES logo_projects(id) ON DELETE CASCADE
      )
    `),
    database.prepare(`
      CREATE INDEX IF NOT EXISTS logo_projects_user_created_idx
      ON logo_projects (user_email, created_at)
    `),
    database.prepare(`
      CREATE INDEX IF NOT EXISTS logo_generations_project_idx
      ON logo_generations (project_id)
    `),
    database.prepare(`
      CREATE INDEX IF NOT EXISTS logo_generations_user_idx
      ON logo_generations (user_email)
    `),
  ]);
}

export function validateBrief(value: unknown): LogoBrief {
  if (!value || typeof value !== "object") {
    throw new Error("A brand brief is required.");
  }

  const input = value as Record<string, unknown>;
  const brandName = cleanString(input.brandName, 80);
  const coreIdea = cleanString(input.coreIdea, 500);
  const audience = cleanString(input.audience, 300);
  const avoid = cleanString(input.avoid, 300);
  const personalities = Array.isArray(input.personalities)
    ? input.personalities
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 40))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  if (!brandName || !coreIdea) {
    throw new Error("Brand name and core idea are required.");
  }

  return {
    audience,
    avoid,
    brandName,
    coreIdea,
    personalities,
  };
}

export function buildPrompt(brief: LogoBrief, direction: Direction) {
  return `
Create one original professional logo symbol for the brand "${brief.brandName}".

Brand idea: ${brief.coreIdea}
Audience: ${brief.audience || "modern, design-conscious customers"}
Personality: ${brief.personalities.join(", ") || "intelligent, clear, memorable"}

Strategic direction: ${direction.title}
Concept thesis: ${direction.thesis}

Design requirements:
- one isolated abstract symbol, centered
- one clear visual idea with simple geometric construction
- flat near-black shape on a plain warm light-gray background
- strong silhouette and balanced negative space
- consistent visual weight
- recognizable at 24 pixels
- suitable for later vector reconstruction
- contemporary Swiss editorial restraint with a subtle human touch

Do not include text or the brand name.
Do not create a mockup, presentation board, stationery, or multiple options.
Do not use gradients, shadows, texture, lighting effects, 3D, or photographic elements.
Avoid: ${brief.avoid || "generic startup symbols, literal arrows, obvious infinity marks"}.
The result must be visibly different from common stock-logo clichés.
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
