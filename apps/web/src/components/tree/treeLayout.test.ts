import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLayout } from "./treeLayout.js";
import type { ApiPerson, ApiRelationship } from "./treeTypes";

// Layout constants (must match treeLayout.ts)
const NODE_WIDTH = 96;
const SPOUSE_GAP = 60;
const SIBLING_GAP = 160;
const GENERATION_GAP = 240;

const peopleFixture: ApiPerson[] = [
  { id: "parent-a", name: "Parent A", birthYear: 1970 },
  { id: "parent-b", name: "Parent B", birthYear: 1972 },
  { id: "child-elder", name: "Child Elder", birthYear: 1995 },
  { id: "child-middle", name: "Child Middle", birthYear: 1998 },
  { id: "child-younger", name: "Child Younger", birthYear: 2001 },
  { id: "grandchild-1", name: "Grandchild One", birthYear: 2024 },
];

const relationshipFixture: ApiRelationship[] = [
  {
    id: "spouse-parent-a-parent-b",
    fromPersonId: "parent-a",
    toPersonId: "parent-b",
    type: "spouse",
    spouseStatus: "active",
  },
  {
    id: "parent-a-child-elder",
    fromPersonId: "parent-a",
    toPersonId: "child-elder",
    type: "parent_child",
  },
  {
    id: "parent-a-child-middle",
    fromPersonId: "parent-a",
    toPersonId: "child-middle",
    type: "parent_child",
  },
  {
    id: "parent-a-child-younger",
    fromPersonId: "parent-a",
    toPersonId: "child-younger",
    type: "parent_child",
  },
  {
    id: "parent-b-child-elder",
    fromPersonId: "parent-b",
    toPersonId: "child-elder",
    type: "parent_child",
  },
  {
    id: "parent-b-child-middle",
    fromPersonId: "parent-b",
    toPersonId: "child-middle",
    type: "parent_child",
  },
  {
    id: "parent-b-child-younger",
    fromPersonId: "parent-b",
    toPersonId: "child-younger",
    type: "parent_child",
  },
  {
    id: "child-younger-grandchild-1",
    fromPersonId: "child-younger",
    toPersonId: "grandchild-1",
    type: "parent_child",
  },
];

function getPosition(positions: Map<string, { x: number; y: number }>, personId: string) {
  const position = positions.get(personId);
  assert.ok(position, `Missing position for ${personId}`);
  return position;
}

function layoutSnapshot(layout: Map<string, { x: number; y: number }>) {
  return Object.fromEntries(
    [...layout.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, position]) => [
        id,
        {
          x: Number(position.x.toFixed(3)),
          y: Number(position.y.toFixed(3)),
        },
      ]),
  );
}

describe("computeLayout", () => {
  it("keeps generations in lanes and groups active spouses", () => {
    const positions = computeLayout(peopleFixture, relationshipFixture);

    const parentA = getPosition(positions, "parent-a");
    const parentB = getPosition(positions, "parent-b");
    const elder = getPosition(positions, "child-elder");
    const middle = getPosition(positions, "child-middle");
    const younger = getPosition(positions, "child-younger");
    const grandchild = getPosition(positions, "grandchild-1");

    // Spouses share the same Y
    assert.equal(parentA.y, parentB.y);

    // Spouse x-distance = NODE_WIDTH + SPOUSE_GAP = 96 + 60 = 156 (top-left to top-left)
    assert.equal(Math.abs(parentA.x - parentB.x), NODE_WIDTH + SPOUSE_GAP);

    // Children are all on the same row, one generation below parents
    assert.equal(elder.y, middle.y);
    assert.equal(middle.y, younger.y);
    assert.ok(elder.y > parentA.y);
    assert.equal(elder.y - parentA.y, GENERATION_GAP);

    // Grandchild is one generation below their parent
    assert.ok(grandchild.y > younger.y);
    assert.equal(grandchild.y - younger.y, GENERATION_GAP);
  });

  it("clusters siblings by birth year with stable spacing", () => {
    const positions = computeLayout(peopleFixture, relationshipFixture);
    const siblingIds = ["child-elder", "child-middle", "child-younger"];
    const orderedSiblings = siblingIds
      .map((id) => ({ id, position: getPosition(positions, id) }))
      .sort((a, b) => a.position.x - b.position.x);

    assert.deepEqual(
      orderedSiblings.map((entry) => entry.id),
      ["child-elder", "child-middle", "child-younger"],
    );
    // Sibling spacing = SIBLING_GAP = 160 (top-left to top-left, same as center-to-center)
    assert.equal(orderedSiblings[1]!.position.x - orderedSiblings[0]!.position.x, SIBLING_GAP);
    assert.equal(orderedSiblings[2]!.position.x - orderedSiblings[1]!.position.x, SIBLING_GAP);
  });

  it("is deterministic regardless of input ordering", () => {
    const baseline = computeLayout(peopleFixture, relationshipFixture);
    const shuffled = computeLayout(
      [...peopleFixture].reverse(),
      [...relationshipFixture].reverse(),
    );
    const rerun = computeLayout(peopleFixture, relationshipFixture);

    assert.deepEqual(layoutSnapshot(shuffled), layoutSnapshot(baseline));
    assert.deepEqual(layoutSnapshot(rerun), layoutSnapshot(baseline));
  });

  it("places all people in a single row when there are no relationships", () => {
    const people: ApiPerson[] = [
      { id: "alice", name: "Alice" },
      { id: "bob", name: "Bob" },
      { id: "carol", name: "Carol" },
    ];
    const positions = computeLayout(people, []);

    const alice = getPosition(positions, "alice");
    const bob = getPosition(positions, "bob");
    const carol = getPosition(positions, "carol");

    // All on same row
    assert.equal(alice.y, bob.y);
    assert.equal(bob.y, carol.y);

    // Sorted alphabetically (alice < bob < carol) and spaced by SIBLING_GAP
    const sorted = [alice, bob, carol].sort((a, b) => a.x - b.x);
    assert.equal(sorted[1]!.x - sorted[0]!.x, SIBLING_GAP);
    assert.equal(sorted[2]!.x - sorted[1]!.x, SIBLING_GAP);
  });
});
