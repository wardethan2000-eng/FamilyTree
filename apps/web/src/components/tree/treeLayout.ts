import Dagre from "@dagrejs/dagre";
import type {
  ApiPerson,
  ApiRelationship,
  PersonFlowNode,
  TreeEdge,
} from "./treeTypes";

export function extractYearFromText(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1]!, 10) : null;
}

const NODE_WIDTH = 96;
const NODE_HEIGHT = 130;
const SPOUSE_GAP = 60;       // pixel gap between adjacent spouse node circles
const SIBLING_GAP = 160;     // center-to-center distance between siblings in same generation
const GENERATION_GAP = 240;  // vertical distance between generation rows

function sortedPair(leftId: string, rightId: string): [string, string] {
  return leftId <= rightId ? [leftId, rightId] : [rightId, leftId];
}

/** Build layout from people + relationships */
export function computeLayout(
  people: ApiPerson[],
  relationships: ApiRelationship[]
): Map<string, { x: number; y: number }> {
  if (people.length === 0) return new Map();

  const sortedPeople = [...people].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRelationships = [...relationships].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.fromPersonId !== b.fromPersonId) {
      return a.fromPersonId.localeCompare(b.fromPersonId);
    }
    if (a.toPersonId !== b.toPersonId) {
      return a.toPersonId.localeCompare(b.toPersonId);
    }
    return a.id.localeCompare(b.id);
  });

  // ONLY parent_child edges go to Dagre — spouse/sibling are handled in post-processing
  const parentChildRels = sortedRelationships.filter((r) => r.type === "parent_child");

  // Grid fallback: no parent_child relationships → single alphabetical row
  if (parentChildRels.length === 0) {
    const positions = new Map<string, { x: number; y: number }>();
    const totalWidth = (sortedPeople.length - 1) * SIBLING_GAP;
    const startX = -totalWidth / 2;
    sortedPeople.forEach((person, index) => {
      positions.set(person.id, {
        x: startX + index * SIBLING_GAP - NODE_WIDTH / 2,
        y: 0,
      });
    });
    return positions;
  }

  const g = new Dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: GENERATION_GAP,
    nodesep: SIBLING_GAP,
    marginx: 80,
    marginy: 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const p of sortedPeople) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const r of parentChildRels) {
    g.setEdge(r.fromPersonId, r.toPersonId);
  }

  Dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const nodeId of g.nodes()) {
    const node = g.node(nodeId);
    if (node) {
      positions.set(nodeId, {
        x: node.x - NODE_WIDTH / 2,
        y: node.y - NODE_HEIGHT / 2,
      });
    }
  }

  const generationLaneByPersonId = buildGenerationLanes(
    sortedPeople,
    parentChildRels,
    positions,
  );
  stabilizeFamilyUnits(
    positions,
    sortedPeople,
    sortedRelationships,
    generationLaneByPersonId,
  );
  return positions;
}

function stabilizeFamilyUnits(
  positions: Map<string, { x: number; y: number }>,
  people: ApiPerson[],
  relationships: ApiRelationship[],
  generationLaneByPersonId: Map<string, number>,
) {
  if (positions.size === 0) return;
  const minY = Math.min(...[...positions.values()].map((p) => p.y));
  const peopleById = new Map(people.map((person) => [person.id, person]));

  // Snap everyone to their generation lane derived from parent/child lineage.
  for (const [personId, position] of positions.entries()) {
    const lane = generationLaneByPersonId.get(personId) ?? 0;
    positions.set(personId, {
      x: position.x,
      y: minY + lane * GENERATION_GAP,
    });
  }

  // Place active spouse pairs as horizontal units with SPOUSE_GAP between them.
  const activeSpouseRelationships = relationships
    .filter(
      (rel) => rel.type === "spouse" && (rel.spouseStatus ?? "active") === "active",
    )
    .sort((a, b) => {
      const [aLeft, aRight] = sortedPair(a.fromPersonId, a.toPersonId);
      const [bLeft, bRight] = sortedPair(b.fromPersonId, b.toPersonId);
      return `${aLeft}|${aRight}`.localeCompare(`${bLeft}|${bRight}`);
    });

  const activeSpouseCountByPersonId = new Map<string, number>();
  for (const rel of activeSpouseRelationships) {
    activeSpouseCountByPersonId.set(
      rel.fromPersonId,
      (activeSpouseCountByPersonId.get(rel.fromPersonId) ?? 0) + 1,
    );
    activeSpouseCountByPersonId.set(
      rel.toPersonId,
      (activeSpouseCountByPersonId.get(rel.toPersonId) ?? 0) + 1,
    );
  }

  for (const rel of activeSpouseRelationships) {
    if (rel.type !== "spouse") continue;
    // Skip if corrupted data gives a person multiple active spouses
    if ((activeSpouseCountByPersonId.get(rel.fromPersonId) ?? 0) !== 1) continue;
    if ((activeSpouseCountByPersonId.get(rel.toPersonId) ?? 0) !== 1) continue;

    const [leftPersonId, rightPersonId] = sortedPair(
      rel.fromPersonId,
      rel.toPersonId,
    );
    const left = positions.get(leftPersonId);
    const right = positions.get(rightPersonId);
    if (!left || !right) continue;

    // Unit center = midpoint between the two nodes' centers
    const unitCenterX =
      (left.x + NODE_WIDTH / 2 + right.x + NODE_WIDTH / 2) / 2;
    const lane = Math.min(
      generationLaneByPersonId.get(leftPersonId) ?? 0,
      generationLaneByPersonId.get(rightPersonId) ?? 0,
    );
    const targetY = minY + lane * GENERATION_GAP;

    // half-unit = distance from unit center to each node's center
    // = (NODE_WIDTH + SPOUSE_GAP) / 2 = (96 + 60) / 2 = 78
    const halfUnit = (NODE_WIDTH + SPOUSE_GAP) / 2;

    positions.set(leftPersonId, {
      x: unitCenterX - halfUnit - NODE_WIDTH / 2,
      y: targetY,
    });
    positions.set(rightPersonId, {
      x: unitCenterX + halfUnit - NODE_WIDTH / 2,
      y: targetY,
    });
  }

  // Cluster siblings (shared parent signatures) into stable horizontal rows.
  const parentIdsByChild = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (rel.type !== "parent_child") continue;
    const current = parentIdsByChild.get(rel.toPersonId) ?? new Set<string>();
    current.add(rel.fromPersonId);
    parentIdsByChild.set(rel.toPersonId, current);
  }

  const childrenByParentSignature = new Map<
    string,
    { parentIds: string[]; childIds: string[] }
  >();

  for (const [childId, parentIdsRaw] of parentIdsByChild.entries()) {
    const parentIds = [...parentIdsRaw].sort();
    const signature = parentIds.join("|");
    const existing = childrenByParentSignature.get(signature);
    if (existing) {
      existing.childIds.push(childId);
      continue;
    }
    childrenByParentSignature.set(signature, { parentIds, childIds: [childId] });
  }

  for (const group of childrenByParentSignature.values()) {
    if (group.childIds.length <= 1) continue;

    const parentPositions = group.parentIds
      .map((id) => positions.get(id))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    const childPositions = group.childIds
      .map((id) => positions.get(id))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    if (childPositions.length === 0) continue;

    const defaultCenterX =
      childPositions.reduce((sum, p) => sum + p.x + NODE_WIDTH / 2, 0) /
      childPositions.length;
    const parentCenterX =
      parentPositions.length > 0
        ? parentPositions.reduce((sum, p) => sum + p.x + NODE_WIDTH / 2, 0) /
          parentPositions.length
        : defaultCenterX;
    const parentY =
      parentPositions.length > 0
        ? Math.max(...parentPositions.map((p) => p.y))
        : Math.min(...childPositions.map((p) => p.y)) - GENERATION_GAP;
    const targetLane = Math.max(
      ...group.childIds.map((childId) => generationLaneByPersonId.get(childId) ?? 0),
    );
    const targetY = Math.max(minY + targetLane * GENERATION_GAP, parentY + GENERATION_GAP);

    const sortedChildren = [...group.childIds].sort((aChildId, bChildId) => {
      const aPerson = peopleById.get(aChildId);
      const bPerson = peopleById.get(bChildId);
      const aBirthYear = aPerson?.birthYear ?? Number.POSITIVE_INFINITY;
      const bBirthYear = bPerson?.birthYear ?? Number.POSITIVE_INFINITY;
      if (aBirthYear !== bBirthYear) return aBirthYear - bBirthYear;

      const aPos = positions.get(aChildId);
      const bPos = positions.get(bChildId);
      if (aPos && bPos && aPos.x !== bPos.x) {
        return aPos.x - bPos.x;
      }
      return aChildId.localeCompare(bChildId);
    });

    const totalWidth = (sortedChildren.length - 1) * SIBLING_GAP;
    const startCenterX = parentCenterX - totalWidth / 2;

    sortedChildren.forEach((childId, index) => {
      const centerX = startCenterX + index * SIBLING_GAP;
      positions.set(childId, {
        x: centerX - NODE_WIDTH / 2,
        y: targetY,
      });
    });
  }
}

function buildGenerationLanes(
  people: ApiPerson[],
  parentChildRelationships: ApiRelationship[],
  positions: Map<string, { x: number; y: number }>,
): Map<string, number> {
  const personIds = people.map((person) => person.id);
  const personIdSet = new Set(personIds);
  const childrenByParentId = new Map<string, Set<string>>();
  const parentIdsByChildId = new Map<string, Set<string>>();
  const indegreeByPersonId = new Map<string, number>(
    personIds.map((personId) => [personId, 0]),
  );
  const laneByPersonId = new Map<string, number>(personIds.map((personId) => [personId, 0]));

  for (const rel of parentChildRelationships) {
    if (!personIdSet.has(rel.fromPersonId) || !personIdSet.has(rel.toPersonId)) continue;

    const children = childrenByParentId.get(rel.fromPersonId) ?? new Set<string>();
    children.add(rel.toPersonId);
    childrenByParentId.set(rel.fromPersonId, children);

    const parents = parentIdsByChildId.get(rel.toPersonId) ?? new Set<string>();
    parents.add(rel.fromPersonId);
    parentIdsByChildId.set(rel.toPersonId, parents);
  }

  for (const [childId, parentIds] of parentIdsByChildId.entries()) {
    indegreeByPersonId.set(childId, parentIds.size);
  }

  const ranking = [...people].sort((a, b) => {
    const aPos = positions.get(a.id);
    const bPos = positions.get(b.id);
    if (aPos && bPos && aPos.y !== bPos.y) return aPos.y - bPos.y;
    if (aPos && bPos && aPos.x !== bPos.x) return aPos.x - bPos.x;
    return a.id.localeCompare(b.id);
  });
  const rankByPersonId = new Map<string, number>(
    ranking.map((person, index) => [person.id, index]),
  );

  const queue = ranking
    .filter((person) => (indegreeByPersonId.get(person.id) ?? 0) === 0)
    .map((person) => person.id);
  const processed = new Set<string>();

  while (queue.length > 0) {
    const personId = queue.shift();
    if (!personId || processed.has(personId)) continue;
    processed.add(personId);

    const parentLane = laneByPersonId.get(personId) ?? 0;
    const children = [...(childrenByParentId.get(personId) ?? [])].sort((a, b) => {
      const rankA = rankByPersonId.get(a) ?? Number.MAX_SAFE_INTEGER;
      const rankB = rankByPersonId.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
    for (const childId of children) {
      const currentLane = laneByPersonId.get(childId) ?? 0;
      laneByPersonId.set(childId, Math.max(currentLane, parentLane + 1));

      const nextIndegree = (indegreeByPersonId.get(childId) ?? 0) - 1;
      indegreeByPersonId.set(childId, nextIndegree);
      if (nextIndegree === 0) {
        queue.push(childId);
        queue.sort((a, b) => {
          const rankA = rankByPersonId.get(a) ?? Number.MAX_SAFE_INTEGER;
          const rankB = rankByPersonId.get(b) ?? Number.MAX_SAFE_INTEGER;
          if (rankA !== rankB) return rankA - rankB;
          return a.localeCompare(b);
        });
      }
    }
  }

  const minY = Math.min(...[...positions.values()].map((position) => position.y));
  const unresolvedIds = ranking
    .map((person) => person.id)
    .filter((personId) => !processed.has(personId));
  for (const personId of unresolvedIds) {
    const parentLanes = [...(parentIdsByChildId.get(personId) ?? [])]
      .map((parentId) => laneByPersonId.get(parentId))
      .filter((lane): lane is number => lane !== undefined);

    if (parentLanes.length > 0) {
      laneByPersonId.set(personId, Math.max(...parentLanes) + 1);
      continue;
    }

    const pos = positions.get(personId);
    if (!pos) {
      laneByPersonId.set(personId, 0);
      continue;
    }
    laneByPersonId.set(
      personId,
      Math.max(0, Math.round((pos.y - minY) / GENERATION_GAP)),
    );
  }

  return laneByPersonId;
}

/** Build ReactFlow person nodes */
export function buildPersonNodes(
  people: ApiPerson[],
  positions: Map<string, { x: number; y: number }>,
  selectedPersonId: string | null,
  currentUserId: string | null
): PersonFlowNode[] {
  return people.map((person) => {
    const pos = positions.get(person.id) ?? { x: 0, y: 0 };

    return {
      id: person.id,
      type: "person" as const,
      position: pos,
      data: {
        personId: person.id,
        name: person.name,
        birthYear: person.birthYear,
        deathYear: person.deathYear,
        portraitUrl: person.portraitUrl,
        essenceLine: person.essenceLine,
        isYou: person.id === currentUserId,
        isFocused: person.id === selectedPersonId,
      },
      draggable: false,
    };
  });
}

/** Build visual ReactFlow edges */
export function buildEdges(relationships: ApiRelationship[]): TreeEdge[] {
  return relationships.flatMap((r) => {
    if (r.type === "parent_child") {
      return [
        {
          id: `edge-${r.id}`,
          source: r.fromPersonId,
          target: r.toPersonId,
          type: "smoothstep",
          style: { stroke: "var(--rule)", strokeWidth: 1.5 },
          animated: false,
        } as TreeEdge,
      ];
    }
    if (r.type === "spouse") {
      const spouseStatus = r.spouseStatus ?? "active";
      const spouseStyle =
        spouseStatus === "active"
          ? { strokeDasharray: "5 4", opacity: 1, strokeWidth: 1.2 }
          : spouseStatus === "deceased_partner"
            ? { strokeDasharray: "1 5", opacity: 0.85, strokeWidth: 1 }
            : { strokeDasharray: "2 6", opacity: 0.65, strokeWidth: 1 };
      return [
        {
          id: `edge-${r.id}`,
          source: r.fromPersonId,
          target: r.toPersonId,
          type: "straight",
          style: {
            stroke: "var(--rule)",
            ...spouseStyle,
          },
          animated: false,
        } as TreeEdge,
      ];
    }
    if (r.type === "sibling") {
      return [
        {
          id: `edge-${r.id}`,
          source: r.fromPersonId,
          target: r.toPersonId,
          type: "straight",
          style: {
            stroke: "var(--rule)",
            strokeWidth: 1,
            strokeDasharray: "2 4",
            opacity: 0.5,
          },
          animated: false,
        } as TreeEdge,
      ];
    }
    return [];
  });
}

/**
 * Collect immediate family cluster for a person.
 * Returns Set of personIds (person + parents + children + spouses).
 */
export function getImmediateFamily(
  personId: string,
  relationships: ApiRelationship[]
): Set<string> {
  const ids = new Set<string>([personId]);

  for (const r of relationships) {
    if (r.type === "parent_child") {
      if (r.toPersonId === personId) ids.add(r.fromPersonId);
      if (r.fromPersonId === personId) ids.add(r.toPersonId);
    }
    if (r.type === "spouse") {
      if (r.fromPersonId === personId) ids.add(r.toPersonId);
      if (r.toPersonId === personId) ids.add(r.fromPersonId);
    }
  }

  return ids;
}

export { NODE_WIDTH, NODE_HEIGHT };
