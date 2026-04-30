import type { ArchiveExportManifest, ExportPerson, ExportMemory, ExportRelationship, ExportMedia, ExportPerspective, ExportPersonCuration, ExportSection } from "./types.js";
import { db } from "../db.js";
import {
  getTreeMemories,
  getTreeRelationships,
  getTreeScopedPeople,
} from "../cross-tree-read-service.js";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@tessera/database";

export async function buildCollectionManifest(
  collectionId: string,
  treeId: string,
  viewerUserId: string,
  viewerRole: string,
): Promise<{ manifest: ArchiveExportManifest; mediaObjectKeys: Map<string, string> }> {
  const collection = await db.query.archiveCollections.findFirst({
    where: (c, { and, eq }) => and(eq(c.id, collectionId), eq(c.treeId, treeId)),
    with: {
      sections: { orderBy: (s, { asc }) => [asc(s.sortOrder)] },
      items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
    },
  });

  if (!collection) throw new Error(`Collection ${collectionId} not found`);

  const personItems = collection.items.filter((i) => i.itemKind === "person");
  const memoryItems = collection.items.filter((i) => i.itemKind === "memory");

  const personIds = [...new Set(personItems.map((i) => i.itemId))];
  const memoryIds = [...new Set(memoryItems.map((i) => i.itemId))];

  const [tree, allTreePeople, allTreeMemories, allTreeRelationships, personCuration] = await Promise.all([
    db.query.trees.findFirst({ where: (t, { eq }) => eq(t.id, treeId) }),
    getTreeScopedPeople(treeId),
    getTreeMemories(treeId, { viewerUserId }),
    getTreeRelationships(treeId),
    db.query.personMemoryCuration.findMany({
      where: (c, { eq }) => eq(c.treeId, treeId),
    }),
  ]);

  if (!tree) throw new Error(`Tree ${treeId} not found`);

  const mediaObjectKeys = new Map<string, string>();
  const mediaInfo = new Map<string, { mimeType: string; sizeBytes: number }>();

  const collectionPersonIds = new Set(personIds);

  for (const rel of allTreeRelationships) {
    if (collectionPersonIds.has(rel.fromPersonId) || collectionPersonIds.has(rel.toPersonId)) {
      collectionPersonIds.add(rel.fromPersonId);
      collectionPersonIds.add(rel.toPersonId);
    }
  }

  for (const m of allTreeMemories) {
    const taggedIds = m.personTags?.map((t) => t.personId) ?? [];
    if (memoryIds.includes(m.id) || taggedIds.some((id) => collectionPersonIds.has(id)) || collectionPersonIds.has(m.primaryPersonId)) {
      memoryIds.push(m.id);
      for (const tid of taggedIds) {
        if (m.primaryPersonId) collectionPersonIds.add(m.primaryPersonId);
        collectionPersonIds.add(tid);
      }
      if (m.primaryPersonId) collectionPersonIds.add(m.primaryPersonId);
    }
  }

  const uniqueMemoryIds = [...new Set(memoryIds)];
  const uniquePersonIds = [...collectionPersonIds];

  const exportPeople: ExportPerson[] = allTreePeople
    .filter((p) => uniquePersonIds.includes(p.id))
    .map((p) => {
      const portraitMediaId = p.portraitMedia?.id ?? null;
      if (p.portraitMedia?.objectKey && portraitMediaId) {
        mediaObjectKeys.set(portraitMediaId, p.portraitMedia.objectKey);
        if (p.portraitMedia.mimeType) {
          mediaInfo.set(portraitMediaId, { mimeType: p.portraitMedia.mimeType, sizeBytes: (p.portraitMedia as { sizeBytes?: number }).sizeBytes ?? 0 });
        }
      }
      return {
        id: p.id,
        displayName: p.displayName,
        canonicalDisplayName: (p as Record<string, unknown>).canonicalDisplayName as string | undefined,
        alsoKnownAs: p.alsoKnownAs ?? [],
        birthDateText: p.birthDateText,
        deathDateText: p.deathDateText,
        essenceLine: p.essenceLine,
        portraitMediaId,
        relationshipIds: [],
        memoryIds: [],
      };
    });

  const peopleById = new Map(exportPeople.map((p) => [p.id, p]));

  const filteredMemories = allTreeMemories.filter((m) => uniqueMemoryIds.includes(m.id));

  const memoryPerspectives =
    filteredMemories.length > 0
      ? await db.query.memoryPerspectives.findMany({
          where: (p, { inArray }) =>
            inArray(p.memoryId, filteredMemories.map((m) => m.id)),
          with: {
            contributor: { columns: { id: true, name: true } },
            contributorPerson: { columns: { id: true, displayName: true } },
            media: { columns: { objectKey: true, mimeType: true, id: true, sizeBytes: true } },
          },
        })
      : [];

  const perspectivesByMemoryId = new Map<string, typeof memoryPerspectives>();
  for (const p of memoryPerspectives) {
    const arr = perspectivesByMemoryId.get(p.memoryId) ?? [];
    arr.push(p);
    perspectivesByMemoryId.set(p.memoryId, arr);
  }

  const itemCaptionMap = new Map<string, string | null>();
  for (const item of memoryItems) {
    if (item.captionOverride) {
      itemCaptionMap.set(item.itemId, item.captionOverride);
    }
  }

  const exportMemories: ExportMemory[] = filteredMemories.map((m) => {
    const mediaIds: string[] = [];
    if (m.media?.id) {
      mediaIds.push(m.media.id);
      if (m.media.objectKey) {
        mediaObjectKeys.set(m.media.id, m.media.objectKey);
        mediaInfo.set(m.media.id, { mimeType: (m.media as { mimeType?: string }).mimeType ?? "", sizeBytes: (m.media as { sizeBytes?: number }).sizeBytes ?? 0 });
      }
    }
    for (const item of m.mediaItems ?? []) {
      if (item.media?.id) {
        mediaIds.push(item.media.id);
        if (item.media.objectKey) {
          mediaObjectKeys.set(item.media.id, item.media.objectKey);
          mediaInfo.set(item.media.id, { mimeType: (item.media as unknown as { mimeType?: string }).mimeType ?? "", sizeBytes: (item.media as unknown as { sizeBytes?: number }).sizeBytes ?? 0 });
        }
      }
    }

    for (const persp of perspectivesByMemoryId.get(m.id) ?? []) {
      if (persp.media?.id && persp.media.objectKey) {
        mediaObjectKeys.set(persp.media.id, persp.media.objectKey);
        mediaInfo.set(persp.media.id, { mimeType: persp.media.mimeType ?? "", sizeBytes: persp.media.sizeBytes ?? 0 });
      }
    }

    const taggedIds = m.personTags?.map((t) => t.personId) ?? [];
    const allPersonIds = [...new Set([m.primaryPersonId, ...taggedIds])];
    for (const pid of allPersonIds) {
      peopleById.get(pid)?.memoryIds.push(m.id);
    }

    const sectionIds: string[] = [];
    for (const section of collection.sections) {
      const sectionItemIds = collection.items
        .filter((i) => i.sectionId === section.id && i.itemKind === "memory")
        .map((i) => i.itemId);
      if (sectionItemIds.includes(m.id)) {
        sectionIds.push(section.id);
      }
    }

    return {
      id: m.id,
      primaryPersonId: m.primaryPersonId,
      title: m.title,
      kind: m.kind,
      body: m.body,
      dateOfEventText: m.dateOfEventText,
      placeId: m.placeId ?? null,
      placeLabel: m.place?.label ?? m.placeLabelOverride ?? null,
      transcriptText: m.transcriptText,
      mediaIds,
      taggedPersonIds: taggedIds,
      perspectiveIds: (perspectivesByMemoryId.get(m.id) ?? []).map((p) => p.id),
      relatedMemoryIds: [],
      contributorName: m.primaryPerson?.displayName ?? null,
      sectionIds,
      captionOverride: itemCaptionMap.get(m.id) ?? null,
    };
  });

  const exportRelationships: ExportRelationship[] = allTreeRelationships
    .filter((r) => collectionPersonIds.has(r.fromPersonId) || collectionPersonIds.has(r.toPersonId))
    .map((r) => {
      peopleById.get(r.fromPersonId)?.relationshipIds.push(r.id);
      peopleById.get(r.toPersonId)?.relationshipIds.push(r.id);
      return {
        id: r.id,
        fromPersonId: r.fromPersonId,
        toPersonId: r.toPersonId,
        type: r.type,
        startDateText: r.startDateText ?? null,
        endDateText: r.endDateText ?? null,
      };
    });

  const exportPerspectives: ExportPerspective[] = memoryPerspectives.map((p) => ({
    id: p.id,
    memoryId: p.memoryId,
    body: p.body,
    mediaId: p.media?.id ?? null,
    contributorName: p.contributorPerson?.displayName ?? p.contributor?.name ?? null,
  }));

  const exportMedia: ExportMedia[] = [];
  for (const [id, objectKey] of mediaObjectKeys) {
    const ext = objectKey.split(".").pop() ?? "bin";
    const info = mediaInfo.get(id);
    exportMedia.push({
      id,
      localPath: `media/${id}.${ext}`,
      mimeType: info?.mimeType ?? "",
      sizeBytes: info?.sizeBytes ?? 0,
      checksum: null,
      role: "memory",
    });
  }

  for (const p of allTreePeople.filter((p) => collectionPersonIds.has(p.id))) {
    if (p.portraitMedia?.id && !exportMedia.find((em) => em.id === p.portraitMedia!.id)) {
      const objectKey = p.portraitMedia.objectKey;
      if (!objectKey) continue;
      const ext = objectKey.split(".").pop() ?? "bin";
      const info = mediaInfo.get(p.portraitMedia.id);
      exportMedia.push({
        id: p.portraitMedia.id,
        localPath: `media/${p.portraitMedia.id}.${ext}`,
        mimeType: info?.mimeType ?? "",
        sizeBytes: info?.sizeBytes ?? 0,
        checksum: null,
        role: "portrait",
      });
    }
  }

  const exportSections: ExportSection[] = collection.sections.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body ?? null,
    sectionKind: s.sectionKind,
    sortOrder: s.sortOrder,
    itemIds: collection.items
      .filter((i) => i.sectionId === s.id)
      .map((i) => i.itemId),
  }));

  const exportPersonCuration: ExportPersonCuration[] = personCuration
    .filter((c) => uniquePersonIds.includes(c.personId) && uniqueMemoryIds.includes(c.memoryId))
    .map((item) => ({
      personId: item.personId,
      memoryId: item.memoryId,
      isFeatured: item.isFeatured,
      sortOrder: item.sortOrder,
    }));

  const manifest: ArchiveExportManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    generatedBy: { userId: viewerUserId, displayName: null },
    tree: { id: tree.id, name: tree.name },
    collection: {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      introText: collection.introText,
      dedicationText: collection.dedicationText,
      defaultViewMode: collection.defaultViewMode,
      scopeKind: collection.scopeKind,
    },
    people: exportPeople,
    memories: exportMemories,
    relationships: exportRelationships,
    perspectives: exportPerspectives,
    places: [],
    sections: exportSections,
    media: exportMedia,
    personCuration: exportPersonCuration,
    permissions: {
      viewerUserId,
      generatedFromRole: viewerRole,
      visibilityResolvedAt: new Date().toISOString(),
    },
  };

  return { manifest, mediaObjectKeys };
}