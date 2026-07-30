import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeSvg } from "../backend/lib/sanitize-svg.ts";

test("sanitizeSvg keeps path geometry and drops scripts/styles/events", () => {
  const dirty = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <script>alert(1)</script>
      <style>path{fill:red}</style>
      <foreignObject width="10" height="10"><div>x</div></foreignObject>
      <path d="M10 10h10v10H10z" fill="#111" onclick="evil()" />
      <a href="https://evil.example">
        <circle cx="20" cy="20" r="5" />
      </a>
      <use href="#mark" />
      <image href="javascript:alert(1)" />
    </svg>
  `;

  const clean = sanitizeSvg(dirty);

  assert.match(clean, /<svg[^>]*viewBox="0 0 100 100"/);
  assert.match(clean, /<path[^>]*d="M10 10h10v10H10z"/i);
  assert.match(clean, /fill="#111"/);
  assert.match(clean, /<use[^>]*href="#mark"/i);
  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /<style/i);
  assert.doesNotMatch(clean, /foreignObject/i);
  assert.doesNotMatch(clean, /onclick/i);
  assert.doesNotMatch(clean, /https:\/\/evil/);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /<image/i);
  assert.doesNotMatch(clean, /<a[\s>]/i);
});

test("sanitizeSvg rejects remote href and keeps fragment refs", () => {
  const clean = sanitizeSvg(
    `<svg><use href="https://cdn.example/x.svg#a" /><use href="#local" /></svg>`,
  );
  assert.doesNotMatch(clean, /cdn\.example/);
  assert.match(clean, /href="#local"/);
});
