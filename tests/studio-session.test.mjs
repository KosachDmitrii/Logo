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
  assert.equal(STUDIO_SESSION_KEY, "loopen-studio-session-v1");
});
