import type {
  TreeHomeCoverage,
  TreeHomeMemory,
  TreeHomeMemoryTrailSection,
  TreeHomePersonRecord,
  TreeHomeRelationship,
} from "./homeTypes";

export const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

export function isVideoMemory(memory: TreeHomeMemory): boolean {
  return memory.mimeType?.startsWith("video/") ?? false;
}

export function extractYearFromText(text?: string | null): number | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4})\b/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

export function memoryMatchesDecade(memory: TreeHomeMemory, decadeStart: number) {
  const year = extractYearFromText(memory.dateOfEventText);
  if (year === null) return false;
  return Math.floor(year / 10) * 10 === decadeStart;
}

export function getVoiceTranscriptLabel(memory: TreeHomeMemory): string | null {
  if (memory.kind !== "voice") return null;
  if (memory.transcriptStatus === "completed" && memory.transcriptText) {
    return memory.transcriptText;
  }
  if (memory.transcriptStatus === "completed") {
    return "Transcript unavailable.";
  }
  if (memory.transcriptStatus === "failed") {
    return memory.transcriptError ? `Transcription failed: ${memory.transcriptError}` : "Transcription failed.";
  }
  if (memory.transcriptStatus === "queued" || memory.transcriptStatus === "processing") {
    return "Transcribing…";
  }
  return null;
}

export function getHeroExcerpt(memory: TreeHomeMemory | null): string | null {
  if (!memory) return null;
  if (memory.kind === "voice") return getVoiceTranscriptLabel(memory);
  if (memory.body?.trim()) return memory.body.trim();
  return null;
}

export function getMemoryRelatedPersonIds(memory: TreeHomeMemory | null | undefined): string[] {
  if (!memory) return [];
  return [...new Set([memory.primaryPersonId, ...(memory.relatedPersonIds ?? [])].filter(Boolean))] as string[];
}

export function getMemoryAnchorPersonId(memory: TreeHomeMemory | null | undefined): string | null {
  return getMemoryRelatedPersonIds(memory)[0] ?? null;
}

export function selectAtriumFeaturedMemory(
  memories: TreeHomeMemory[],
  heroCandidates: TreeHomeMemory[],
): TreeHomeMemory | null {
  return (
    heroCandidates[0] ??
    memories.find((memory) => memory.kind === "photo" && memory.mediaUrl) ??
    memories.find((memory) => memory.kind === "story") ??
    memories[0] ??
    null
  );
}

export function getAtriumBranchFocusIds(
  personId: string | null,
  relationships: TreeHomeRelationship[],
): Set<string> {
  if (!personId) return new Set();

  const focused = new Set<string>([personId]);
  const queue = [{ id: personId, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;

    for (const relationship of relationships) {
      let neighborId: string | null = null;
      if (relationship.fromPersonId === current.id) neighborId = relationship.toPersonId;
      if (relationship.toPersonId === current.id) neighborId = relationship.fromPersonId;
      if (!neighborId || focused.has(neighborId)) continue;

      const maxDepth = relationship.type === "parent_child" ? 2 : 1;
      if (current.depth >= maxDepth) continue;

      focused.add(neighborId);
      queue.push({ id: neighborId, depth: current.depth + 1 });
    }
  }

  return focused;
}

export function buildAtriumMemoryTrail({
  featuredMemory,
  memories,
  focusIds,
  focusPersonName,
}: {
  featuredMemory: TreeHomeMemory | null;
  memories: TreeHomeMemory[];
  focusIds: Set<string>;
  focusPersonName: string | null;
}): TreeHomeMemoryTrailSection[] {
  if (memories.length === 0) return [];

  const usedIds = new Set<string>();
  const sections: TreeHomeMemoryTrailSection[] = [];

  const beginHere: TreeHomeMemory[] = [];
  if (featuredMemory) {
    beginHere.push(featuredMemory);
    usedIds.add(featuredMemory.id);
  }
  beginHere.push(
    ...takeMemories(
      rankTrailMemories(
        memories.filter((memory) => !usedIds.has(memory.id) && memorySharesContext(memory, featuredMemory)),
        featuredMemory,
        focusIds,
      ),
      2,
      usedIds,
    ),
  );
  if (beginHere.length === 0) {
    beginHere.push(...takeMemories(rankTrailMemories(memories, featuredMemory, focusIds), 3, usedIds));
  }
  if (beginHere.length > 0) {
    sections.push({
      id: "begin-here",
      title: "Begin here",
      description: "Stay with the opening memory, then step into the first nearby stories.",
      memories: beginHere,
    });
  }

  const branchMemories = takeMemories(
    rankTrailMemories(
      memories.filter((memory) => !usedIds.has(memory.id) && memoryTouchesFocus(memory, focusIds)),
      featuredMemory,
      focusIds,
    ),
    4,
    usedIds,
  );
  if (branchMemories.length > 0) {
    sections.push({
      id: "from-this-branch",
      title: "From this branch",
      description: focusPersonName
        ? `Stories and artifacts that stay close to ${focusPersonName}.`
        : "Stories that stay close to the branch around the featured memory.",
      memories: branchMemories,
    });
  }

  const crossGenerations = takeMemories(
    rankTrailMemories(
      memories.filter((memory) => !usedIds.has(memory.id)),
      featuredMemory,
      focusIds,
    ),
    4,
    usedIds,
  );
  if (crossGenerations.length > 0) {
    sections.push({
      id: "across-generations",
      title: "Across generations",
      description: "Let the trail widen beyond the immediate branch and across the family timeline.",
      memories: crossGenerations,
    });
  }

  return sections;
}

export function buildAtriumFamilyPresenceGroups({
  focusPersonId,
  focusIds,
  people,
  relationships,
}: {
  focusPersonId: string | null;
  focusIds: Set<string>;
  people: TreeHomePersonRecord[];
  relationships: TreeHomeRelationship[];
}) {
  if (!focusPersonId) return [];

  const peopleIds = new Set(people.map((person) => person.id));
  const directIds = new Set<string>();
  const groups: Array<{ id: string; label: string; personIds: string[] }> = [];

  const collectGroup = (id: string, label: string, personIds: string[]) => {
    const uniqueIds = [...new Set(personIds)].filter(
      (personId) => personId !== focusPersonId && peopleIds.has(personId),
    );
    if (uniqueIds.length === 0) return;
    uniqueIds.forEach((personId) => directIds.add(personId));
    groups.push({ id, label, personIds: uniqueIds.slice(0, 8) });
  };

  collectGroup(
    "partnered-with",
    "Partnered with",
    relationships
      .filter(
        (relationship) =>
          relationship.type === "spouse" &&
          (relationship.fromPersonId === focusPersonId || relationship.toPersonId === focusPersonId),
      )
      .map((relationship) =>
        relationship.fromPersonId === focusPersonId
          ? relationship.toPersonId
          : relationship.fromPersonId,
      ),
  );

  collectGroup(
    "raised-by",
    "Raised by",
    relationships
      .filter(
        (relationship) =>
          relationship.type === "parent_child" && relationship.toPersonId === focusPersonId,
      )
      .map((relationship) => relationship.fromPersonId),
  );

  collectGroup(
    "alongside",
    "Alongside",
    relationships
      .filter(
        (relationship) =>
          relationship.type === "sibling" &&
          (relationship.fromPersonId === focusPersonId || relationship.toPersonId === focusPersonId),
      )
      .map((relationship) =>
        relationship.fromPersonId === focusPersonId
          ? relationship.toPersonId
          : relationship.fromPersonId,
      ),
  );

  collectGroup(
    "carried-forward",
    "Carried forward by",
    relationships
      .filter(
        (relationship) =>
          relationship.type === "parent_child" && relationship.fromPersonId === focusPersonId,
      )
      .map((relationship) => relationship.toPersonId),
  );

  collectGroup(
    "nearby-in-branch",
    "Nearby in this branch",
    [...focusIds].filter((personId) => personId !== focusPersonId && !directIds.has(personId)),
  );

  if (groups.length > 0) return groups;

  const fallbackIds = people
    .map((person) => person.id)
    .filter((personId) => personId !== focusPersonId)
    .slice(0, 8);
  return fallbackIds.length > 0
    ? [{ id: "family", label: "Elsewhere in this family", personIds: fallbackIds }]
    : [];
}

export function getCoverageRangeLabel(coverage: TreeHomeCoverage | null): string {
  if (!coverage || (coverage.earliestYear === null && coverage.latestYear === null)) {
    return "Dates are still gathering.";
  }
  if (coverage.earliestYear !== null && coverage.latestYear !== null) {
    if (coverage.earliestYear === coverage.latestYear) return `${coverage.earliestYear}`;
    return `${coverage.earliestYear} to ${coverage.latestYear}`;
  }
  return `${coverage.earliestYear ?? coverage.latestYear}`;
}

function memoryTouchesFocus(memory: TreeHomeMemory, focusIds: Set<string>) {
  return getMemoryRelatedPersonIds(memory).some((personId) => focusIds.has(personId));
}

function memorySharesContext(memory: TreeHomeMemory, featuredMemory: TreeHomeMemory | null) {
  const featuredIds = new Set(getMemoryRelatedPersonIds(featuredMemory));
  if (featuredIds.size === 0) return false;
  return getMemoryRelatedPersonIds(memory).some((personId) => featuredIds.has(personId));
}

function scoreTrailMemory(
  memory: TreeHomeMemory,
  featuredMemory: TreeHomeMemory | null,
  focusIds: Set<string>,
) {
  let score = 0;

  if (featuredMemory) {
    if (memory.id === featuredMemory.id) score += 120;

    const memoryAnchorId = getMemoryAnchorPersonId(memory);
    const featuredAnchorId = getMemoryAnchorPersonId(featuredMemory);
    if (memoryAnchorId && featuredAnchorId && memoryAnchorId === featuredAnchorId) score += 48;
    if (memorySharesContext(memory, featuredMemory)) score += 28;
    if (memoryTouchesFocus(memory, focusIds)) score += 24;

    const year = extractYearFromText(memory.dateOfEventText);
    const featuredYear = extractYearFromText(featuredMemory.dateOfEventText);
    if (year !== null && featuredYear !== null) {
      score += Math.max(0, 20 - Math.min(20, Math.floor(Math.abs(year - featuredYear) / 5)));
    } else if (year !== null || featuredYear !== null) {
      score += 4;
    }

    if (memory.kind !== featuredMemory.kind) score += 6;
  }

  if (memory.kind === "voice") score += 5;
  if (memory.mediaUrl) score += 4;
  if (memory.body?.trim()) score += Math.min(6, Math.floor(memory.body.trim().length / 180));
  if (memory.transcriptText?.trim()) score += 4;
  if (memory.dateOfEventText) score += 3;

  return score;
}

function rankTrailMemories(
  memories: TreeHomeMemory[],
  featuredMemory: TreeHomeMemory | null,
  focusIds: Set<string>,
) {
  return [...memories].sort((left, right) => {
    const scoreDiff =
      scoreTrailMemory(right, featuredMemory, focusIds) -
      scoreTrailMemory(left, featuredMemory, focusIds);
    if (scoreDiff !== 0) return scoreDiff;

    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

function takeMemories(memories: TreeHomeMemory[], limit: number, usedIds: Set<string>) {
  const selected: TreeHomeMemory[] = [];

  for (const memory of memories) {
    if (selected.length >= limit) break;
    if (usedIds.has(memory.id)) continue;
    usedIds.add(memory.id);
    selected.push(memory);
  }

  return selected;
}
