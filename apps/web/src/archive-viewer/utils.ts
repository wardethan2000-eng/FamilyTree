import type { ArchiveExportManifest, ExportPerson, ExportMemory, ExportMedia, ExportPerspective, ExportPersonCuration } from "./types.js";

export function getMediaUrl(manifest: ArchiveExportManifest, mediaId: string | null | undefined): string | null {
  if (!mediaId) return null;
  const media = manifest.media.find((m) => m.id === mediaId);
  return media ? media.localPath : null;
}

export function getPerson(manifest: ArchiveExportManifest, personId: string): ExportPerson | undefined {
  return manifest.people.find((p) => p.id === personId);
}

export function getMemory(manifest: ArchiveExportManifest, memoryId: string): ExportMemory | undefined {
  return manifest.memories.find((m) => m.id === memoryId);
}

export function getMemoriesForPerson(manifest: ArchiveExportManifest, personId: string): ExportMemory[] {
  const person = getPerson(manifest, personId);
  if (!person) return [];
  const ids = new Set(person.memoryIds);

  const curationMap = new Map<string, ExportPersonCuration>();
  for (const c of manifest.personCuration ?? []) {
    if (c.personId === personId) curationMap.set(c.memoryId, c);
  }

  return manifest.memories
    .filter((m) => ids.has(m.id) || m.primaryPersonId === personId || m.taggedPersonIds.includes(personId))
    .sort((a, b) => {
      const ca = curationMap.get(a.id);
      const cb = curationMap.get(b.id);
      if (ca && cb) return ca.sortOrder - cb.sortOrder;
      return (a.dateOfEventText ?? "").localeCompare(b.dateOfEventText ?? "");
    });
}

export function getRelationshipsForPerson(manifest: ArchiveExportManifest, personId: string) {
  const person = getPerson(manifest, personId);
  if (!person) return [];
  const relIds = new Set(person.relationshipIds);
  return manifest.relationships.filter((r) => relIds.has(r.id));
}

export function getPerspectivesForMemory(manifest: ArchiveExportManifest, memoryId: string): ExportPerspective[] {
  if (!manifest.perspectives) return [];
  return manifest.perspectives.filter((p) => p.memoryId === memoryId);
}

export function relationshipLabel(type: string, fromId: string, toId: string, currentId: string): string {
  if (type === "parent_child") return currentId === toId ? "Parent" : "Child";
  if (type === "spouse") return "Spouse";
  if (type === "sibling") return "Sibling";
  return type;
}

export function dateSpan(birth: string | null, death: string | null): string {
  if (birth && death) return `${birth} \u2013 ${death}`;
  if (birth && !death) return `${birth} \u2013`;
  if (!birth && death) return `\u2013 ${death}`;
  return "";
}

export function isFeaturedMemory(manifest: ArchiveExportManifest, personId: string, memoryId: string): boolean {
  if (!manifest.personCuration) return false;
  return manifest.personCuration.some((c) => c.personId === personId && c.memoryId === memoryId && c.isFeatured);
}

export function searchManifest(manifest: ArchiveExportManifest, query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return { people: [], memories: [] };

  const people = manifest.people.filter((p) =>
    p.displayName.toLowerCase().includes(q) ||
    (p.essenceLine ?? "").toLowerCase().includes(q) ||
    p.alsoKnownAs.some((a) => a.toLowerCase().includes(q))
  );

  const memories = manifest.memories.filter((m) =>
    m.title.toLowerCase().includes(q) ||
    (m.body ?? "").toLowerCase().includes(q) ||
    (m.dateOfEventText ?? "").toLowerCase().includes(q) ||
    (m.placeLabel ?? "").toLowerCase().includes(q) ||
    (m.transcriptText ?? "").toLowerCase().includes(q)
  );

  return { people, memories };
}