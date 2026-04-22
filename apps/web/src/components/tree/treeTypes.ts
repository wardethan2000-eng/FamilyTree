import type { Node, Edge } from "@xyflow/react";

export type PersonNodeData = {
  personId: string;
  name: string;
  birthYear?: number | null;
  deathYear?: number | null;
  portraitUrl?: string | null;
  essenceLine?: string | null;
  isYou: boolean;
  /** True when this person's cinematic overlay is open */
  isFocused: boolean;
  isDimmed: boolean;
  /** 0–1 indicating how relevant this person is to the active decade (1 = exact match, null = no decade filter active) */
  decadeRelevance: number | null;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;
export type TreeFlowNode = PersonFlowNode;

/** @deprecated use PersonFlowNode */
export type PersonNode = PersonFlowNode;
/** @deprecated use PersonFlowNode */
export type TreeNode = PersonFlowNode;

export type ConstellationEdgeData = {
  kind: "parent_child" | "sibling" | "spouse";
  renderSourceX?: number;
  renderSourceY?: number;
  renderTargetX?: number;
  renderTargetY?: number;
  unionX?: number;
  unionY?: number;
  opacity?: number;
  strokeWidth?: number;
  strokeDasharray?: string;
};

export type TreeEdge = Edge<ConstellationEdgeData>;

/** Raw API person as returned by the API */
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
  spouseStatus?: "active" | "former" | "deceased_partner" | null;
  startDateText?: string | null;
  endDateText?: string | null;
}

export interface ApiMemory {
  id: string;
  primaryPersonId: string;
  contributorUserId?: string | null;
  kind: "story" | "photo" | "voice" | "document" | "other";
  title: string;
  body?: string | null;
  transcriptText?: string | null;
  transcriptLanguage?: string | null;
  transcriptStatus?: "none" | "queued" | "processing" | "completed" | "failed";
  transcriptError?: string | null;
  dateOfEventText?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  /** Convenience: set by the fetching component to the owning person's id */
  personId?: string;
}
