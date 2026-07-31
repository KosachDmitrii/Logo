import assert from "node:assert/strict";
import test from "node:test";
import { prepareLockupMarkSvg } from "../frontend/lib/lockup-svg.ts";

test("prepareLockupMarkSvg builds a transparent mark from Recraft vector paths", () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="2048" height="2048">
      <path fill="#F4EFEA" d="M0 0h2048v2048H0z" />
      <path fill="#252422" d="M656 1103h200v80H656z" />
      <path fill="#F4EFEA" d="M980 942h60v40H980z" />
      <path fill="#252422" d="M1257 813h40v40h-40z" />
    </svg>
  `;
  const prepared = prepareLockupMarkSvg(svg, "#201f1e");
  assert.doesNotMatch(prepared, /M0 0h2048v2048H0z/i);
  assert.doesNotMatch(prepared, /#F4EFEA/i);
  assert.match(prepared, /M656 1103h200v80H656z/i);
  assert.match(prepared, /M1257 813h40v40h-40z/i);
  assert.match(prepared, /M980 942h60v40H980z/i);
  assert.match(prepared, /mask id="loopen-mark-mask"/i);
  assert.match(prepared, /fill="#201f1e"/i);
});

test("prepareLockupMarkSvg strips full-canvas rect plates", () => {
  const svg = `
    <svg viewBox="0 0 512 512">
      <rect width="512" height="512" fill="#F4F1E8"/>
      <path d="M40 40h40v40H40z" fill="#000"/>
    </svg>
  `;
  const prepared = prepareLockupMarkSvg(svg, "#c84a32");
  assert.doesNotMatch(prepared, /<rect\b/i);
  assert.match(prepared, /fill="#c84a32"/i);
  assert.match(prepared, /M40 40h40v40H40z/i);
});
