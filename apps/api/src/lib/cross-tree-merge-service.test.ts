import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://tessera:tessera@localhost:5432/tessera_test";

const {
  PersonMergeError,
  preflightMergedRelationshipState,
} = await import("./cross-tree-merge-service.js");
type MergeRelationshipRecord =
  import("./cross-tree-merge-service.js").MergeRelationshipRecord;

function relationship(
  overrides: Partial<MergeRelationshipRecord>,
): MergeRelationshipRecord {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    treeId: overrides.treeId ?? "tree-1",
    type: overrides.type ?? "parent_child",
    fromPersonId: overrides.fromPersonId ?? "person-a",
    toPersonId: overrides.toPersonId ?? "person-b",
    spouseStatus: overrides.spouseStatus ?? null,
    startDateText: overrides.startDateText ?? null,
    endDateText: overrides.endDateText ?? null,
  };
}

describe("preflightMergedRelationshipState", () => {
  it("rejects merges that would give a person more than two parents", () => {
    assert.throws(
      () =>
        preflightMergedRelationshipState({
          survivorPersonId: "survivor",
          mergedAwayPersonId: "merged",
          relationships: [
            relationship({
              id: "parent-a",
              fromPersonId: "parent-a",
              toPersonId: "survivor",
            }),
            relationship({
              id: "parent-b",
              fromPersonId: "parent-b",
              toPersonId: "survivor",
            }),
            relationship({
              id: "parent-c",
              fromPersonId: "parent-c",
              toPersonId: "merged",
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PersonMergeError);
        assert.equal(error.status, 409);
        assert.match(error.message, /more than two parents/i);
        return true;
      },
    );
  });

  it("rejects merges that would create multiple active spouses", () => {
    assert.throws(
      () =>
        preflightMergedRelationshipState({
          survivorPersonId: "survivor",
          mergedAwayPersonId: "merged",
          relationships: [
            relationship({
              id: "spouse-a",
              type: "spouse",
              fromPersonId: "survivor",
              toPersonId: "partner-a",
              spouseStatus: "active",
            }),
            relationship({
              id: "spouse-b",
              type: "spouse",
              fromPersonId: "merged",
              toPersonId: "partner-b",
              spouseStatus: "active",
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PersonMergeError);
        assert.equal(error.status, 409);
        assert.match(error.message, /multiple active spouse relationships/i);
        return true;
      },
    );
  });

  it("rejects merges that would create a parent-child cycle", () => {
    assert.throws(
      () =>
        preflightMergedRelationshipState({
          survivorPersonId: "survivor",
          mergedAwayPersonId: "merged",
          relationships: [
            relationship({
              id: "survivor-parent",
              fromPersonId: "survivor",
              toPersonId: "child-a",
            }),
            relationship({
              id: "merged-child",
              fromPersonId: "child-a",
              toPersonId: "merged",
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PersonMergeError);
        assert.equal(error.status, 409);
        assert.match(error.message, /parent\/child cycle/i);
        return true;
      },
    );
  });

  it("merges compatible duplicate relationships into one projected record", () => {
    const projected = preflightMergedRelationshipState({
      survivorPersonId: "survivor",
      mergedAwayPersonId: "merged",
      relationships: [
        relationship({
          id: "former-spouse",
          type: "spouse",
          fromPersonId: "survivor",
          toPersonId: "partner-a",
          spouseStatus: "former",
          startDateText: "2001",
        }),
        relationship({
          id: "duplicate-former-spouse",
          type: "spouse",
          fromPersonId: "merged",
          toPersonId: "partner-a",
          spouseStatus: "former",
          endDateText: "2010",
        }),
      ],
    });

    assert.equal(projected.length, 1);
    assert.deepEqual(projected[0], {
      id: "former-spouse",
      treeId: "tree-1",
      type: "spouse",
      fromPersonId: "survivor",
      toPersonId: "partner-a",
      spouseStatus: "former",
      startDateText: "2001",
      endDateText: "2010",
    });
  });

  it("rejects duplicate relationships with conflicting metadata", () => {
    assert.throws(
      () =>
        preflightMergedRelationshipState({
          survivorPersonId: "survivor",
          mergedAwayPersonId: "merged",
          relationships: [
            relationship({
              id: "former-spouse",
              type: "spouse",
              fromPersonId: "survivor",
              toPersonId: "partner-a",
              spouseStatus: "former",
            }),
            relationship({
              id: "active-spouse",
              type: "spouse",
              fromPersonId: "merged",
              toPersonId: "partner-a",
              spouseStatus: "active",
            }),
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof PersonMergeError);
        assert.equal(error.status, 409);
        assert.match(error.message, /conflicting spouse status/i);
        return true;
      },
    );
  });
});
