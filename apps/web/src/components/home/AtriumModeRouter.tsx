"use client";

import type { TreeHomeMemory, TreeHomeMemoryTrailSection, TreeHomeTodayHighlights, TreeHomeCoverage } from "./homeTypes";
import { ImmersiveScroll } from "./immersive-scroll/ImmersiveScroll";
import { GalleryWall } from "./gallery-wall/GalleryWall";
import { HorizontalFilmstrip } from "./filmstrip/HorizontalFilmstrip";

export type AtriumMode = "scroll" | "gallery" | "filmstrip";

interface TrailPerson {
  id: string;
  name: string;
  portraitUrl: string | null;
}

interface PersonSummary {
  id: string;
  name: string;
  portraitUrl: string | null;
  essenceLine: string | null;
  birthYear: number | null;
  deathYear: number | null;
}

interface FamilyPresenceGroup {
  id: string;
  label: string;
  people: PersonSummary[];
}

export interface AtriumSharedProps {
  treeId: string;
  treeName: string;
  featuredMemory: TreeHomeMemory | null;
  trailSections: TreeHomeMemoryTrailSection[];
  today: TreeHomeTodayHighlights | null;
  familyPresenceGroups: FamilyPresenceGroup[];
  focusPerson: PersonSummary | null;
  focusPersonName: string | null;
  branchCue: string;
  archiveSummary: {
    peopleCount: number;
    generationCount: number;
    earliestYear: number | null;
    latestYear: number | null;
    branchLabel: string | null;
  } | null;
  coverage: TreeHomeCoverage | null;
  people: TrailPerson[];
  resurfacingCount: number;
  memoryHref: string | null;
  branchHref: string | null;
  fullTreeHref: string;
  onPersonClick: (personId: string) => void;
  onMemoryClick: (memory: TreeHomeMemory) => void;
  onDrift: () => void;
  onStartPersonDrift: (personId: string) => void;
  onStartRemembrance: (personId: string) => void;
}

export function AtriumModeRouter({
  mode,
  ...props
}: AtriumSharedProps & { mode: AtriumMode }) {
  switch (mode) {
    case "scroll":
      return <ImmersiveScroll {...props} />;
    case "gallery":
      return <GalleryWall {...props} />;
    case "filmstrip":
      return <HorizontalFilmstrip {...props} />;
    default:
      return <ImmersiveScroll {...props} />;
  }
}