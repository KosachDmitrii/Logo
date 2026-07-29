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
  assert.match(studio, /Generate 4 real directions/);
  assert.match(studio, /Download PNG/);
  assert.match(css, /--acid:\s*#ffcf68/);
  assert.doesNotMatch(page + studio + layout, /codex-preview|SkeletonPreview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});

test("keeps generation authenticated, persistent, and server-side", async () => {
  const [route, imageRoute, selectRoute, runtime, hosting, migration, supabase] =
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
  assert.match(route, /@cf\/black-forest-labs\/flux-2-dev/);
  assert.match(route, /CLOUDFLARE_API_TOKEN/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(runtime, /Continuous Logic/);
  assert.match(runtime, /Open Portal/);
  assert.match(runtime, /Signal Exchange/);
  assert.match(runtime, /Soft Structure/);
  assert.match(hosting, /"d1": null/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(migration, /create table if not exists public\.logo_projects/i);
  assert.match(migration, /create table if not exists public\.logo_generations/i);
  assert.match(supabase, /SUPABASE_SERVICE_ROLE_KEY/);
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
  assert.match(studio, /Create refinements/);
  assert.match(studio, /Vectorize selected/);
  assert.match(studio, /Download lockup SVG/);
  assert.match(refine, /\/v1\/images\/edits/);
  assert.match(refine, /gpt-image-2/);
  assert.match(vectorize, /external\.api\.recraft\.ai/);
  assert.match(vectorize, /RECRAFT_API_KEY/);
  assert.match(exportRoute, /sanitizeSvg/);
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
