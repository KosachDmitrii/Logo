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
  const [route, imageRoute, selectRoute, runtime, hosting, migration] =
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
        new URL("../drizzle/0000_lonely_rhodey.sql", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(route, /getChatGPTUser/);
  assert.match(imageRoute, /getChatGPTUser/);
  assert.match(selectRoute, /getChatGPTUser/);
  assert.match(route, /gpt-image-2/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /Promise\.allSettled/);
  assert.match(runtime, /Continuous Logic/);
  assert.match(runtime, /Open Portal/);
  assert.match(runtime, /Signal Exchange/);
  assert.match(runtime, /Soft Structure/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(migration, /CREATE TABLE `logo_projects`/);
  assert.match(migration, /CREATE TABLE `logo_generations`/);
  assert.doesNotMatch(route + runtime, /VITE_OPENAI_API_KEY/);
  assert.ok(root);
});

test("ships the complete refinement and vector production workflow", async () => {
  const [studio, runtime, refine, vectorize, exportRoute, assetRoute, migration] =
    await Promise.all([
      readFile(new URL("../app/loopen-studio.tsx", import.meta.url), "utf8"),
      readFile(new URL("../lib/mvp-runtime.ts", import.meta.url), "utf8"),
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
        new URL("../drizzle/0001_plain_the_fallen.sql", import.meta.url),
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
  assert.match(runtime, /CREATE TABLE IF NOT EXISTS logo_assets/);
  assert.match(migration, /CREATE TABLE `logo_assets`/);
});
