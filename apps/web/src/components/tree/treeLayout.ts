import Dagre from "@dagrejs/dagre";
import type {
  ApiPerson,
  ApiRelationship,
  ApiMemory,
  PersonFlowNode,
  MemoryCardFlowNode,
  TreeEdge,
} from "./treeTypes";

function extractYearFromText(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1]!, 10) : null;
}

const NODE_WIDTH = 96;
const NODE_HEIGHT = 130;
const MEMORY_CARD_WIDTH = 220;
const MEMORY_CARD_HEIGHT = 110;
const MEMORY_CARD_GAP = 16;
const MEMORY_Y_OFFSET = 200;
const MAX_VISIBLE_MEMORIES = 6;

/** Build dagre layout from people + parent_child relationships */
export function computeLayout(
  people: ApiPerson[],
  relationships: ApiRelationship[]
): Map<string, { x: number; y: number }> {
  const g = new Dagre.graphlib.Graph();
  g.setGraph({
    rankdir: "TB",
    ranksep: 220,
    nodesep: 140,
    marginx: 80,
    marginy: 80,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const p of people) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // Only parent_child edges determine vertical ranking
  for (const r of relationships) {
    if (r.type === "parent_child") {
      g.setEdge(r.fromPersonId, r.toPersonId);
    }
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
  return positions;
}

/** Build ReactFlow nodes from people + positions */
export function buildPersonNodes(
  people: ApiPerson[],
  positions: Map<string, { x: number; y: number }>,
  focusedPersonId: string | null,
  clusterId: Set<string>,
  currentUserId: string | null
): PersonFlowNode[] {
  return people.map((person) => {
    const pos = positions.get(person.id) ?? { x: 0, y: 0 };
    const isFocused = person.id === focusedPersonId;
    const isDimmed = focusedPersonId !== null && !clusterId.has(person.id);

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
        isFocused,
        isDimmed,
      },
      draggable: false,
      selectable: !isDimmed,
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
          style: {
            stroke: "var(--rule)",
            strokeWidth: 1.5,
          },
          animated: false,
        } as TreeEdge,
      ];
    }
    if (r.type === "spouse") {
      return [
        {
          id: `edge-${r.id}`,
          source: r.fromPersonId,
          target: r.toPersonId,
          type: "straight",
          style: {
            stroke: "var(--rule)",
            strokeWidth: 1,
            strokeDasharray: "4 4",
          },
          animated: false,
        } as TreeEdge,
      ];
    }
    return [];
  });
}

/**
 * Collect the immediate family cluster for a focused person.
 * Returns Set of personIds that should remain fully visible.
 */
export function getImmediateFamily(
  personId: string,
  relationships: ApiRelationship[]
): Set<string> {
  const ids = new Set<string>([personId]);

  for (const r of relationships) {
    if (r.type === "parent_child") {
      if (r.toPersonId === personId) ids.add(r.fromPersonId); // parents
      if (r.fromPersonId === personId) ids.add(r.toPersonId); // children
    }
    if (r.type === "spouse") {
      if (r.fromPersonId === personId) ids.add(r.toPersonId);
      if (r.toPersonId === personId) ids.add(r.fromPersonId);
    }
  }

  return ids;
}

/**
 * Compute positions for memory cards below a focused person node.
 * Returns array of { id, x, y } in canvas coordinates.
 */
export function memoryCardPositions(
  personX: number,
  personY: number,
  memoryCount: number
): { x: number; y: number }[] {
  const displayed = Math.min(memoryCount, MAX_VISIBLE_MEMORIES);
  const totalWidth =
    displayed * MEMORY_CARD_WIDTH + (displayed - 1) * MEMORY_CARD_GAP;
  const startX = personX + NODE_WIDTH / 2 - totalWidth / 2;
  const cardY = personY + NODE_HEIGHT + MEMORY_Y_OFFSET;

  return Array.from({ length: displayed }, (_, i) => ({
    x: startX + i * (MEMORY_CARD_WIDTH + MEMORY_CARD_GAP),
    y: cardY,
  }));
}

/**
 * Build memory card ReactFlow nodes for the focused person.
 */
export function buildMemoryCardNodes(
  personX: number,
  personY: number,
  personId: string,
  memories: ApiMemory[]
): MemoryCardFlowNode[] {
  const positions = memoryCardPositions(personX, personY, memories.length);
  const displayed = memories.slice(0, MAX_VISIBLE_MEMORIES);

  return displayed.map((memory, i) => {
    const pos = positions[i]!;
    const isOverflow = i === MAX_VISIBLE_MEMORIES - 1 && memories.length > MAX_VISIBLE_MEMORIES;

    return {
      id: `memory-card-${memory.id}`,
      type: "memoryCard" as const,
      position: pos,
      data: {
        memoryId: memory.id,
        personId,
        kind: memory.kind,
        title: memory.title,
        bodyPreview: memory.body?.slice(0, 80),
        mediaUrl: memory.mediaUrl,
        year: extractYearFromText(memory.dateOfEventText),
        contributorName: null,
        isOverflow,
        overflowCount: isOverflow ? memories.length - MAX_VISIBLE_MEMORIES + 1 : 0,
      },
      draggable: false,
    } as MemoryCardFlowNode;
  });
}

/**
 * Build dashed edges from person node to each of their memory cards.
 */
export function buildMemoryEdges(
  personId: string,
  memoryNodes: MemoryCardFlowNode[]
): TreeEdge[] {
  return memoryNodes.map((card) => ({
    id: `memory-edge-${card.id}`,
    source: personId,
    target: card.id,
    type: "straight",
    style: {
      stroke: "var(--rule)",
      strokeWidth: 1,
      strokeDasharray: "3 4",
      opacity: 0.6,
    },
    animated: false,
  }));
}

export { NODE_WIDTH, NODE_HEIGHT, MEMORY_CARD_WIDTH, MEMORY_CARD_HEIGHT, MAX_VISIBLE_MEMORIES };
