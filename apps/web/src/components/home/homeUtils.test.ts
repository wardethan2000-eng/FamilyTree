import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TreeHomeMemory, TreeHomePersonRecord, TreeHomeRelationship } from "./homeTypes";
import {
  buildAtriumFamilyPresenceGroups,
  buildAtriumMemoryTrail,
  getAtriumBranchFocusIds,
  getMemoryAnchorPersonId,
  selectAtriumFeaturedMemory,
} from "./homeUtils";

const PEOPLE: TreeHomePersonRecord[] = [
  { id: "focus", displayName: "Focus Person", portraitUrl: null, essenceLine: null, linkedUserId: null },
  { id: "sibling", displayName: "Sibling", portraitUrl: null, essenceLine: null, linkedUserId: null },
  { id: "child", displayName: "Child", portraitUrl: null, essenceLine: null, linkedUserId: null },
  { id: "spouse", displayName: "Spouse", portraitUrl: null, essenceLine: null, linkedUserId: null },
];

const RELATIONSHIPS: TreeHomeRelationship[] = [
  { id: "sib", fromPersonId: "focus", toPersonId: "sibling", type: "sibling" },
  { id: "child", fromPersonId: "focus", toPersonId: "child", type: "parent_child" },
  { id: "spouse", fromPersonId: "focus", toPersonId: "spouse", type: "spouse", spouseStatus: "active" },
];

function createMemory(overrides: Partial<TreeHomeMemory> & Pick<TreeHomeMemory, "id" | "kind" | "title">): TreeHomeMemory {
  return {
    body: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    dateOfEventText: null,
    mediaUrl: null,
    personName: null,
    primaryPersonId: null,
    personPortraitUrl: null,
    relatedPersonIds: [],
    ...overrides,
  };
}

describe("atrium home helpers", () => {
  it("anchors a memory to tagged people when no primary person is set", () => {
    const memory = createMemory({
      id: "m1",
      kind: "story",
      title: "Tagged only",
      relatedPersonIds: ["focus", "sibling"],
    });

    assert.equal(getMemoryAnchorPersonId(memory), "focus");
  });

  it("selects a featured memory from hero candidates first", () => {
    const memories = [
      createMemory({ id: "m1", kind: "story", title: "Story" }),
      createMemory({ id: "m2", kind: "photo", title: "Photo", mediaUrl: "/photo.jpg" }),
    ];

    assert.equal(selectAtriumFeaturedMemory(memories, [memories[0]!])?.id, "m1");
    assert.equal(selectAtriumFeaturedMemory(memories, [])?.id, "m2");
  });

  it("builds a guided trail from the featured memory context", () => {
    const featured = createMemory({
      id: "featured",
      kind: "story",
      title: "Opening memory",
      relatedPersonIds: ["focus"],
      dateOfEventText: "1950",
    });
    const sameBranch = createMemory({
      id: "same-branch",
      kind: "photo",
      title: "Same branch",
      relatedPersonIds: ["focus"],
      mediaUrl: "/photo.jpg",
      dateOfEventText: "1952",
    });
    const nearby = createMemory({
      id: "nearby",
      kind: "voice",
      title: "Nearby branch",
      relatedPersonIds: ["sibling"],
      dateOfEventText: "1956",
    });
    const distant = createMemory({
      id: "distant",
      kind: "story",
      title: "Elsewhere",
      relatedPersonIds: ["child"],
      dateOfEventText: "1990",
    });

    const trail = buildAtriumMemoryTrail({
      featuredMemory: featured,
      memories: [featured, sameBranch, nearby, distant],
      focusIds: getAtriumBranchFocusIds("focus", RELATIONSHIPS),
      focusPersonName: "Focus Person",
    });

    assert.equal(trail[0]?.id, "begin-here");
    assert.equal(trail[0]?.memories[0]?.id, "featured");
    assert.ok(trail[0]?.memories.some((memory) => memory.id === "same-branch"));
    assert.equal(trail[1]?.id, "from-this-branch");
    assert.ok(trail[1]?.memories.some((memory) => memory.id === "nearby"));
  });

  it("builds family presence groups around the focus person", () => {
    const groups = buildAtriumFamilyPresenceGroups({
      focusPersonId: "focus",
      focusIds: getAtriumBranchFocusIds("focus", RELATIONSHIPS),
      people: PEOPLE,
      relationships: RELATIONSHIPS,
    });

    assert.deepEqual(
      groups.map((group) => group.id),
      ["partnered-with", "alongside", "carried-forward"],
    );
  });
});
