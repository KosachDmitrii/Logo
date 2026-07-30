import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the finished Loopen product surface", async () => {
  const [page, studio, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/loopen-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /Loopen — Brand systems, not random logos/);
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /chatGPTSignInPath/);
  assert.match(studio, /Generate 4 architectural studies/);
  assert.match(studio, /02 \/ Category research/);
  assert.match(studio, /Awaiting brief/);
  assert.match(studio, /\/api\/project-list/);
  assert.match(studio, /\/api\/generate-concepts/);
  assert.match(studio, /Delete .* project/);
  assert.match(studio, /Download PNG/);
  assert.match(css, /--acid:\s*#ffcf68/);
  assert.doesNotMatch(page + studio + layout, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("keeps generation authenticated, persistent, and server-side", async () => {
  const [route, imageRoute, selectRoute, runtime, quality, creative, hosting, migration, supabase] =
    await Promise.all([
      readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/images/[id]/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/api/projects/[id]/select/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../lib/mvp-runtime.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/logo-quality.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/gemini-creative.ts", import.meta.url), "utf8"),
      readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../supabase/migrations/20260729190000_loopen_schema.sql",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(new URL("../lib/supabase.ts", import.meta.url), "utf8"),
    ]);

  assert.match(route, /getChatGPTUser/);
  assert.match(imageRoute, /getChatGPTUser/);
  assert.match(selectRoute, /getChatGPTUser/);
  assert.match(route, /createCuratedConcepts/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(route, /gemini-3-pro-image|gemini-3\.1-flash-image/);
  assert.match(creative, /gemini-3\.1-flash-image/);
  assert.match(creative, /gemini-3-pro-image/);
  assert.match(creative, /gemini-3-flash-preview/);
  assert.match(creative, /logo_exploration_jury/);
  assert.match(creative, /architectural concept study/);
  assert.match(creative, /STAGE TWO — ARCHITECTURE-TO-IDENTITY REDUCTION/);
  assert.match(creative, /evaluateReducedLogo/);
  assert.match(creative, /Math\.min\(\.\.\.parts\.map/);
  assert.match(creative, /logo_jury_soft_fallback/);
  assert.match(creative, /gpt-5\.6-sol/);
  assert.match(creative, /refineWithGemini/);
  assert.match(creative, /\[\.\.\.merged\]\.sort/);
  assert.doesNotMatch(creative, /strict 88\/100 dual-jury threshold/);
  assert.doesNotMatch(creative, /return \[passingFinals\[0\]\]/);
  assert.match(route, /temporarily overloaded/);
  assert.match(route, /reviewStatus/);
  assert.match(route, /requestId/);
  assert.match(quality, /containsText/);
  assert.match(quality, /score >= 75/);
  assert.match(quality, /moondream3\.1-9B-A2B/);
  assert.match(runtime, /ICON ONLY/);
  assert.match(runtime, /Idea the mark must express/);
  assert.match(runtime, /redactBrandName|the studio/);
  assert.match(runtime, /Trap to avoid/);
  assert.match(runtime, /recoveryMode/);
  assert.match(route, /logo_concept_text_recovery/);
  assert.match(runtime, /Continuous Space/);
  assert.match(runtime, /Open Counterform/);
  assert.match(runtime, /Modular Rhythm/);
  assert.match(runtime, /Constructive Tension/);
  assert.match(hosting, /"d1": null/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(migration, /create table if not exists public\.logo_projects/i);
  assert.match(migration, /create table if not exists public\.logo_generations/i);
  assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(supabase, /method: "DELETE"/);
  assert.match(supabase, /Authorization: `Bearer \$\{key\}`/);
  assert.doesNotMatch(route + runtime, /runtime\.DB|D1Database/);
  assert.ok(root);
});

test("ships the complete refinement and vector production workflow", async () => {
  const [studio, refine, vectorize, exportRoute, assetRoute, migration] =
    await Promise.all([
      readFile(new URL("../app/loopen-studio.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/api/projects/[id]/refine/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/api/projects/[id]/vectorize/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../app/api/projects/[id]/export/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/api/assets/[id]/route.ts", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../supabase/migrations/20260729190000_loopen_schema.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(studio, /Project history/);
  assert.match(studio, /Create logo reductions/);
  assert.match(studio, /Reconstruct selected/);
  assert.match(studio, /Brand guide \/ PDF/);
  assert.match(studio, /Industry \*/);
  assert.match(studio, /What the company does \*/);
  assert.match(studio, /Brand name \*/);
  assert.match(studio, /Core idea \*/);
  assert.match(studio, /Competitors/);
  assert.match(studio, /Icon only/);
  assert.match(refine, /@cf\/black-forest-labs\/flux-2-dev/);
  assert.match(refine, /refineVectorConcept/);
  assert.match(refine, /refineWithGemini/);
  assert.match(refine, /evaluateReducedLogo/);
  assert.match(refine, /LOOPEN_ARCHITECTURE_REDUCTION/);
  assert.match(refine, /image\/svg\+xml/);
  assert.match(refine, /form\.append\("width", "1024"\)/);
  assert.match(refine, /generationIds/);
  assert.doesNotMatch(refine, /assessLogoImage/);
  assert.match(studio, /More concept \+1/);
  assert.match(studio, /Selected .*\/2|selectedConceptIds\.length/);
  assert.match(vectorize, /external\.api\.recraft\.ai/);
  assert.match(vectorize, /reconstructArchitecturalLogoSvg/);
  assert.match(vectorize, /LOOPEN_GEOMETRIC_RECONSTRUCTION/);
  assert.match(vectorize, /native-vector/);
  assert.match(vectorize, /RECRAFT_API_KEY/);
  assert.match(vectorize, /not safe to vectorize/);
  assert.doesNotMatch(vectorize, /imageToImage/);
  assert.match(exportRoute, /sanitizeSvg/);
  assert.match(exportRoute, /iconOnly/);
  assert.match(assetRoute, /Content-Disposition/);
  assert.match(migration, /create table if not exists public\.logo_assets/i);
});

test("uses a sign-in-free local development identity", async () => {
  const auth = await readFile(
    new URL("../app/chatgpt-auth.ts", import.meta.url),
    "utf8",
  );

  assert.match(auth, /process\.env\.NODE_ENV !== "production"/);
  assert.match(auth, /local@loopen\.dev/);
});
