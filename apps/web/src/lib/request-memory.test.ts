import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRequestRecipients } from "./request-memory";

const PEOPLE = [
  { id: "p1", displayName: "Alice", linkedUserId: "u1" },
  { id: "p2", displayName: "Bob", linkedUserId: "u2" },
  { id: "p3", displayName: "Cara", linkedUserId: null },
  { id: "p4", displayName: "Drew", linkedUserId: "u4" },
];

describe("request memory targeting", () => {
  it("resolves a single linked recipient", () => {
    const result = resolveRequestRecipients({
      mode: "person",
      people: PEOPLE,
      selectedPersonId: "p2",
    });

    assert.deepEqual(result.recipientIds, ["p2"]);
    assert.deepEqual(result.excludedUnlinked, []);
  });

  it("filters unlinked recipients from a manual selection", () => {
    const result = resolveRequestRecipients({
      mode: "people",
      people: PEOPLE,
      selectedPersonIds: ["p1", "p3", "p4"],
    });

    assert.deepEqual(result.recipientIds, ["p1", "p4"]);
    assert.deepEqual(
      result.excludedUnlinked.map((person) => person.id),
      ["p3"],
    );
  });

  it("expands immediate family around an anchor person", () => {
    const result = resolveRequestRecipients({
      mode: "family",
      people: PEOPLE,
      familyAnchorPersonId: "p1",
      relationships: [
        { id: "r1", fromPersonId: "p1", toPersonId: "p2", type: "spouse" },
        { id: "r2", fromPersonId: "p1", toPersonId: "p3", type: "parent_child" },
        { id: "r3", fromPersonId: "p4", toPersonId: "p1", type: "parent_child" },
      ],
    });

    assert.deepEqual(result.recipientIds, ["p1", "p2", "p4"]);
    assert.deepEqual(
      result.excludedUnlinked.map((person) => person.id),
      ["p3"],
    );
  });
});
