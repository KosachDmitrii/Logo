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
  assert.match(studio, /Generate 4 logo concepts/);
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
  const [route, imageRoute, selectRoute, runtime, quality, creative, artDirection, hosting, migration, supabase] =
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
      readFile(new URL("../lib/vector-art-direction.ts", import.meta.url), "utf8"),
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
  assert.match(artDirection, /1\. Subject:/);
  assert.match(artDirection, /2\. Symbol details:/);
  assert.match(creative, /EXPLORATION_THRESHOLD = 55/);
  assert.match(creative, /Style law ONLY \(system/);
  assert.match(creative, /flat 2D/);
  assert.match(creative, /no 3D/);
  assert.match(creative, /Everything else is Client AVOID|Everything else comes from the form/);
  assert.doesNotMatch(
    creative,
    /Style law ONLY[\s\S]{0,200}no 3D, shadows, gradients/,
  );
  assert.match(creative, /Symbol only — no wordmark/);
  assert.match(creative, /mapPool|IMAGE_CONCURRENCY/);
  assert.match(creative, /\[GEMINI_FLASH_IMAGE, GEMINI_PRO_IMAGE\]/);
  assert.match(creative, /promptChars: structured\.length/);
  assert.match(creative, /blocks: \{/);
  assert.match(creative, /prompt: structured/);
  assert.match(artDirection, /KETCHUP ARCHITECTS/);
  assert.match(artDirection, /structured_logo_prompts/);
  assert.match(artDirection, /buildStructuredLogoPrompt/);
  assert.match(creative, /VISUAL ART-DIRECTION REFERENCE/);
  assert.match(creative, /STAGE TWO — PROFESSIONAL LOGO REFINEMENT/);
  assert.match(creative, /evaluateReducedLogo/);
  assert.match(creative, /stage === "final"/);
  assert.match(creative, /Math\.min\(\.\.\.parts\.map/);
  assert.match(creative, /refineAndReviewWithGemini/);
  assert.match(creative, /logo_refine_auto_repair/);
  assert.match(creative, /REFINE_RECOMMENDED_SCORE/);
  assert.match(creative, /logo_jury_soft_fallback/);
  assert.match(creative, /gpt-5\.6-sol/);
  assert.match(creative, /refineWithGemini/);
  assert.match(creative, /item\.score >= EXPLORATION_THRESHOLD/);
  assert.doesNotMatch(creative, /strict 88\/100 dual-jury threshold/);
  assert.doesNotMatch(creative, /return \[passingFinals\[0\]\]/);
  assert.match(creative, /SOFT_FILL_FLOOR|softFilled/);
  assert.match(creative, /Correction: \$\{correction\}/);
  assert.match(artDirection, /TWO TO THREE sentences/);
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
  assert.match(studio, /Refine selected logos/);
  assert.match(studio, /Reconstruct selected/);
  assert.match(studio, /Brand guide \/ PDF/);
  assert.match(studio, /Industry \*/);
  assert.match(studio, /What the company does \*/);
  assert.match(studio, /Brand name \*/);
  assert.match(studio, /Brief template/);
  assert.match(studio, /BRIEF_TEMPLATES/);
  assert.match(studio, /applyBriefTemplate/);
  assert.match(studio, /Blank \/ custom brief/);
  assert.match(studio, /Northline/);
  assert.match(studio, /Voltara/);
  assert.match(studio, /e\.g\. Acme/);
  assert.doesNotMatch(studio, /Quick start templates/);
  assert.match(studio, /Core idea \*/);
  assert.match(studio, /Competitors/);
  assert.match(studio, /Icon only/);
  assert.match(studio, /Original concept/);
  assert.match(studio, /vectorSourceMode/);
  assert.match(studio, /Jury recommendation/);
  assert.match(studio, /SVG is still unlocked/);
  assert.doesNotMatch(studio, /Transition blocked/);
  assert.doesNotMatch(studio, /intentionally unavailable/);
  assert.match(refine, /@cf\/black-forest-labs\/flux-2-dev/);
  assert.match(refine, /refineVectorConcept/);
  assert.match(refine, /refineAndReviewWithGemini/);
  assert.match(refine, /REFINE_RECOMMENDED_SCORE/);
  assert.match(refine, /LOOPEN_LOGO_REFINEMENT/);
  assert.match(refine, /image\/svg\+xml/);
  assert.match(refine, /form\.append\("width", "1024"\)/);
  assert.match(refine, /generationIds/);
  assert.match(refine, /critiquesByGenerationId/);
  assert.match(refine, /fromFailedRefine/);
  assert.match(studio, /critiquesByGenerationId/);
  assert.match(studio, /Retry refinement with jury notes/);
  assert.doesNotMatch(refine, /assessLogoImage/);
  assert.match(studio, /More concept \+1/);
  assert.match(studio, /1 selected|selectedConceptIds\.length/);
  assert.match(studio, /selected for refinement/);
  assert.doesNotMatch(studio, /\/2 selected/);
  assert.match(vectorize, /external\.api\.recraft\.ai/);
  assert.match(vectorize, /reconstructArchitecturalLogoSvg/);
  assert.match(vectorize, /LOOPEN_GEOMETRIC_RECONSTRUCTION/);
  assert.match(vectorize, /native-vector/);
  assert.match(vectorize, /RECRAFT_API_KEY/);
  assert.match(vectorize, /generationId/);
  assert.match(vectorize, /logo_vector_quality_advisory/);
  assert.match(vectorize, /always deliver the SVG/);
  assert.doesNotMatch(vectorize, /rejected by the transition jury/);
  assert.doesNotMatch(vectorize, /master\.score < 90/);
  assert.doesNotMatch(vectorize, /not safe to vectorize/);
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
