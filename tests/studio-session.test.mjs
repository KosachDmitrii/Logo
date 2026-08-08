import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyStudioDraft,
  draftFromSnapshot,
  STUDIO_SESSION_KEY,
} from "../frontend/lib/studio-session.ts";

test("draftFromSnapshot restores production and lockup fields", () => {
  const draft = draftFromSnapshot({
    v: 1,
    savedAt: 1,
    ...createEmptyStudioDraft(),
    projectId: "proj-1",
    brandName: "Muchachos",
    selectedConceptIds: ["gen-1"],
    productionLocked: true,
    vectorSourceMode: "original",
    markScale: 160,
    wordmarkSize: 128,
  });

  assert.equal(draft.projectId, "proj-1");
  assert.equal(draft.brandName, "Muchachos");
  assert.deepEqual(draft.selectedConceptIds, ["gen-1"]);
  assert.equal(draft.productionLocked, true);
  assert.equal(draft.vectorSourceMode, "original");
  assert.equal(draft.markScale, 160);
  assert.equal(draft.wordmarkSize, 128);
});

test("createEmptyStudioDraft starts unlocked with refine source", () => {
  const empty = createEmptyStudioDraft();
  assert.equal(empty.projectId, null);
  assert.equal(empty.productionLocked, false);
  assert.equal(empty.vectorSourceMode, "refine");
  assert.equal(empty.markScale, 100);
  assert.deepEqual(empty.directCompetitors, []);
  assert.deepEqual(empty.brandReferences, []);
  assert.equal(empty.market, "");
  assert.equal(STUDIO_SESSION_KEY, "loopen-studio-session-v1");
});

test("draftFromSnapshot hydrates competitor entries and market fields", () => {
  const draft = draftFromSnapshot({
    v: 1,
    savedAt: 1,
    ...createEmptyStudioDraft(),
    industry: "Architecture",
    market: "Denmark",
    companyScale: "independent",
    priceSegment: "premium",
    competitors: "OMA, BIG",
    directCompetitors: [
      { name: "OMA", website: "https://www.oma.com", url: "https://www.oma.com" },
    ],
    brandReferences: [{ name: "Pentagram", url: "https://www.pentagram.com" }],
  });

  assert.equal(draft.market, "Denmark");
  assert.equal(draft.companyScale, "independent");
  assert.equal(draft.directCompetitors[0]?.name, "OMA");
  assert.equal(draft.directCompetitors[0]?.website, "https://www.oma.com/");
  assert.equal(draft.brandReferences[0]?.website, "https://www.pentagram.com/");
});
