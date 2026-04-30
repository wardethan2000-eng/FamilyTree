import type { ArchiveExportManifest, ExportPerson, ExportMemory, ExportRelationship, ExportMedia, ExportPerspective, ExportPersonCuration } from "./types.js";
import { db } from "../db.js";
import {
  getTreeMemories,
  getTreeRelationships,
  getTreeScopedPeople,
} from "../cross-tree-read-service.js";

export async function buildFullTreeManifest(
  treeId: string,
  viewerUserId: string,
  viewerRole: string,
): Promise<{ manifest: ArchiveExportManifest; mediaObjectKeys: Map<string, string> }> {
  const [tree, people, memories, relationships, personCuration] = await Promise.all([
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
  const mediaRoles = new Map<string, ExportMedia["role"]>();

  const memoryPerspectives =
    memories.length > 0
      ? await db.query.memoryPerspectives.findMany({
          where: (p, { inArray }) =>
            inArray(
              p.memoryId,
              memories.map((m) => m.id),
            ),
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

  const exportPeople: ExportPerson[] = people.map((p) => {
    const portraitMediaId = p.portraitMedia?.id ?? null;
    if (p.portraitMedia?.objectKey && portraitMediaId) {
      mediaObjectKeys.set(portraitMediaId, p.portraitMedia.objectKey);
      mediaRoles.set(portraitMediaId, "portrait");
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

  const taggedPersonIdsByMemory = new Map<string, string[]>();
  for (const m of memories) {
    const ids = m.personTags?.map((t) => t.personId) ?? [];
    taggedPersonIdsByMemory.set(m.id, ids);
  }

  const exportMemories: ExportMemory[] = memories.map((m) => {
    const mediaIds: string[] = [];
    if (m.media?.id) {
      mediaIds.push(m.media.id);
      if (m.media.objectKey) {
        mediaObjectKeys.set(m.media.id, m.media.objectKey);
        mediaRoles.set(m.media.id, "memory");
        mediaInfo.set(m.media.id, { mimeType: (m.media as { mimeType?: string }).mimeType ?? "", sizeBytes: (m.media as { sizeBytes?: number }).sizeBytes ?? 0 });
      }
    }
    for (const item of m.mediaItems ?? []) {
      if (item.media?.id) {
        mediaIds.push(item.media.id);
        if (item.media.objectKey) {
          mediaObjectKeys.set(item.media.id, item.media.objectKey);
          mediaRoles.set(item.media.id, "memory");
          mediaInfo.set(item.media.id, { mimeType: (item.media as unknown as { mimeType?: string }).mimeType ?? "", sizeBytes: (item.media as unknown as { sizeBytes?: number }).sizeBytes ?? 0 });
        }
      }
    }

    for (const persp of perspectivesByMemoryId.get(m.id) ?? []) {
      if (persp.media?.id && persp.media.objectKey) {
        mediaObjectKeys.set(persp.media.id, persp.media.objectKey);
        mediaRoles.set(persp.media.id, "perspective");
        mediaInfo.set(persp.media.id, { mimeType: persp.media.mimeType ?? "", sizeBytes: persp.media.sizeBytes ?? 0 });
      }
    }

    const taggedIds = taggedPersonIdsByMemory.get(m.id) ?? [];
    const primaryId = m.primaryPersonId;
    const allPersonIds = [...new Set([primaryId, ...taggedIds])];

    for (const pid of allPersonIds) {
      peopleById.get(pid)?.memoryIds.push(m.id);
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
      sectionIds: [],
      captionOverride: null,
    };
  });

  const exportRelationships: ExportRelationship[] = relationships.map((r) => {
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
    contributorName:
      p.contributorPerson?.displayName ??
      p.contributor?.name ??
      null,
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
      role: mediaRoles.get(id) ?? "memory",
    });
  }

  for (const p of people) {
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

  const exportPersonCuration: ExportPersonCuration[] = personCuration.map((item) => ({
    personId: item.personId,
    memoryId: item.memoryId,
    isFeatured: item.isFeatured,
    sortOrder: item.sortOrder,
  }));

  const manifest: ArchiveExportManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    generatedBy: {
      userId: viewerUserId,
      displayName: null,
    },
    tree: { id: tree.id, name: tree.name },
    collection: {
      id: null,
      name: tree.name,
      description: null,
      introText: null,
      dedicationText: null,
      defaultViewMode: "chapter",
      scopeKind: "full_tree",
    },
    people: exportPeople,
    memories: exportMemories,
    relationships: exportRelationships,
    perspectives: exportPerspectives,
    places: [],
    sections: [],
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
