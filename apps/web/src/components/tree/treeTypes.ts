import type { Node, Edge } from "@xyflow/react";

export type PersonNodeData = {
  personId: string;
  name: string;
  birthYear?: number | null;
  deathYear?: number | null;
  portraitUrl?: string | null;
  essenceLine?: string | null;
  isYou: boolean;
  isFocused: boolean;
  isDimmed: boolean;
};

export type MemoryCardNodeData = {
  memoryId: string;
  personId: string;
  kind: "photo" | "story";
  title: string;
  bodyPreview?: string;
  mediaUrl?: string | null;
  year?: number | null;
  contributorName?: string | null;
  isOverflow?: boolean;
  overflowCount?: number;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;
export type MemoryCardFlowNode = Node<MemoryCardNodeData, "memoryCard">;
export type TreeFlowNode = PersonFlowNode | MemoryCardFlowNode;

/** @deprecated use PersonFlowNode */
export type PersonNode = PersonFlowNode;
/** @deprecated use MemoryCardFlowNode */
export type MemoryCardNode = MemoryCardFlowNode;
/** @deprecated use TreeFlowNode */
export type TreeNode = TreeFlowNode;

export type TreeEdge = Edge;

/** Raw API person with relationships and memories */
export interface ApiPerson {
  id: string;
  name: string;
  birthYear?: number | null;
  deathYear?: number | null;
  essenceLine?: string | null;
  portraitMediaId?: string | null;
  portraitUrl?: string | null;
  linkedUserId?: string | null;
}

export interface ApiRelationship {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: "parent_child" | "sibling" | "spouse";
}

export interface ApiMemory {
  id: string;
  primaryPersonId: string;
  contributorUserId?: string | null;
  kind: "photo" | "story";
  title: string;
  body?: string | null;
  dateOfEventText?: string | null;
  mediaUrl?: string | null;
  /** Convenience: set by the fetching component to the owning person's id */
  personId?: string;
}

export type FocusLevel = 0 | 1 | 2;
