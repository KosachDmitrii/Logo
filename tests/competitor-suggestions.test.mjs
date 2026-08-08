import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesRule,
  nameKey,
  normalizeText,
  resolveIndustryId,
  suggestCompetitors,
} from "../frontend/lib/competitors/index.ts";

test("resolveIndustryId is stable across RU/EN/display labels", () => {
  assert.equal(resolveIndustryId("architecture"), "architecture");
  assert.equal(resolveIndustryId("Architecture"), "architecture");
  assert.equal(resolveIndustryId("Архитектура"), "architecture");
  assert.equal(resolveIndustryId("Food & Beverage"), "food-beverage");
  assert.equal(resolveIndustryId("other"), null);
});

test("normalizeText handles case, diacritics and punctuation", () => {
  assert.equal(normalizeText("Snøhetta"), "snohetta");
  assert.equal(normalizeText("Food\n& Beverage"), "food beverage");
  assert.equal(nameKey("  OMA "), "oma");
});

test("audience accepts string and array", () => {
  const asString = suggestCompetitors({
    industry: "architecture",
    audience: "premium residential clients",
    positioning: "quiet minimal",
  });
  const asArray = suggestCompetitors({
    industry: "architecture",
    audience: ["premium", "residential", "clients"],
    positioning: "quiet minimal",
  });
  assert.ok(asString.direct.length > 0);
  assert.ok(asArray.direct.length > 0);
  assert.ok(asString.direct.some((item) => /Norm/i.test(item.name)));
  assert.ok(asArray.direct.some((item) => /Norm/i.test(item.name)));
});

test("multiple keyword rules accumulate score", () => {
  const result = suggestCompetitors({
    industry: "architecture",
    companyDescription: "sustainable timber residential houses",
    positioning: "ecological quiet homes",
  });
  const scored = result.direct.find((item) => item.score != null);
  assert.ok(scored);
  assert.ok((scored.score ?? 0) > 30);
  assert.ok(
    result.direct.some((item) =>
      /Henning|Waugh|Lendager|White/i.test(item.name),
    ),
  );
});

test("dedupes and avoids section overlap", () => {
  const result = suggestCompetitors({
    industry: "creative-services",
    positioning: "identity studio",
  });
  const directKeys = new Set(result.direct.map((item) => nameKey(item.name)));
  const refKeys = result.references.map((item) => nameKey(item.name));
  assert.equal(directKeys.size, result.direct.length);
  assert.ok(refKeys.every((key) => !directKeys.has(key)));
});

test("excludes selected and rejected entries", () => {
  const result = suggestCompetitors({
    industry: "architecture",
    selectedDirect: [{ name: "OMA" }],
    rejectedDirect: ["BIG"],
    selectedReferences: [{ name: "Pentagram" }],
    rejectedReferences: ["Manual"],
  });
  assert.ok(!result.direct.some((item) => nameKey(item.name) === "oma"));
  assert.ok(!result.direct.some((item) => nameKey(item.name) === "big"));
  assert.ok(
    !result.references.some((item) => nameKey(item.name) === "pentagram"),
  );
  assert.ok(!result.references.some((item) => nameKey(item.name) === "manual"));
});

test("fallback returns empty direct and needsManualInput", () => {
  const result = suggestCompetitors({
    industry: "Custom niche studio",
  });
  assert.deepEqual(result.direct, []);
  assert.equal(result.needsManualInput, true);
  assert.ok(result.references.length > 0);
  assert.ok(
    !result.direct.some((item) => /Category leaders/i.test(item.name)),
  );
});

test("respects limits", () => {
  const result = suggestCompetitors({
    industry: "architecture",
    directLimit: 4,
    referenceLimit: 3,
  });
  assert.ok(result.direct.length <= 4);
  assert.ok(result.references.length <= 3);
});

test("matchesRule resets RegExp lastIndex", () => {
  const pattern = /ai/gi;
  pattern.lastIndex = 5;
  assert.equal(matchesRule(pattern, "hello world"), false);
  assert.equal(pattern.lastIndex, 0);
  assert.equal(matchesRule(/\b(ai|machine learning)\b/i, "ai product"), true);
});

test("stable sort on equal scores keeps industry order for untouched pool", () => {
  const first = suggestCompetitors({ industry: "education" });
  const second = suggestCompetitors({ industry: "education" });
  assert.deepEqual(
    first.direct.map((item) => item.name),
    second.direct.map((item) => item.name),
  );
});

test("russian hospitality keywords boost interior practices", () => {
  const result = suggestCompetitors({
    industry: "architecture",
    companyDescription: "проекты гостиниц и интерьеров ресторанов",
  });
  assert.ok(
    result.direct.some((item) =>
      /Neri|Space Copenhagen|Yabu|Mumbai/i.test(item.name),
    ),
  );
});

test("AI keyword does not match inside other words", () => {
  const loose = suggestCompetitors({
    industry: "technology",
    companyDescription: "email campaign tooling",
  });
  const tight = suggestCompetitors({
    industry: "technology",
    companyDescription: "agentic artificial intelligence platform",
  });
  assert.ok(!loose.direct.some((item) => item.name === "OpenAI"));
  assert.ok(tight.direct.some((item) => item.name === "OpenAI"));
});

test("reason copy follows UI locale", () => {
  const en = suggestCompetitors({ industry: "Custom niche", locale: "en" });
  const ru = suggestCompetitors({ industry: "Custom niche", locale: "ru" });
  assert.match(en.references[0]?.reason ?? "", /Strong identity/i);
  assert.match(ru.references[0]?.reason ?? "", /Сильный ориентир/);
});
