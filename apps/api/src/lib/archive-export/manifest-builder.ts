import { db } from "../db.js";
import * as schema from "@tessera/database";
import { eq, inArray } from "drizzle-orm";
import {
  getTreeScopedPeople,
  getTreeScopedPeople as _getTreeScopedPeople,
  getTreeMemories,
  getTreeRelationships,
} from "../cross-tree-read-service.js";
import type {
  ArchiveExportManifest,
  ExportPerson,
  ExportMemory,
  ExportRelationship,
  ExportPlace,
  ExportSection,
  ExportMedia,
  ExportPerspective,
  MediaQuality,
  ExportOutputKind,
} from "./types.js";

type ScopedPerson = Awaited<ReturnType<typeof getTreeScopedPeople>>[number];

type ManifestOptions = {
  treeId: string;
  viewerUserId: string;
  viewerRole: string;
  collectionName?: string;
  collectionDescription?: string | null;
  scopeKind?: string;
  scopePersonId?: string;
  mediaQuality?: MediaQuality;
  outputKind?: ExportOutputKind;
  includeRelationships?: boolean;
  includeRelatedMemories?: boolean;
  includePlaces?: boolean;
};

function addMediaFromRow(
  mediaRow: { id: string; objectKey: string; mimeType: string; sizeBytes: number | bigint; checksum: string | null } | null | undefined,
  role: ExportMedia["role"],
  mediaMap: Map<string, ExportMedia>,
  mediaIdSet: Set<string>,
): void {
  if (!mediaRow) return;
  if (mediaIdSet.has(mediaRow.id)) return;
  mediaIdSet.add(mediaRow.id);
  mediaMap.set(mediaRow.id, {
    id: mediaRow.id,
    objectKey: mediaRow.objectKey,
    localPath: buildMediaLocalPath(mediaRow.id, mediaRow.mimeType),
    mimeType: mediaRow.mimeType,
    sizeBytes: Number(mediaRow.sizeBytes),
    checksum: mediaRow.checksum,
    role,
  });
}

function buildExportPerson(
  p: ScopedPerson,
  relationshipsByPersonId: Map<string, Awaited<ReturnType<typeof getTreeRelationships>>>,
  memoriesByPersonId: Map<string, string[]>,
): ExportPerson {
  const rels = relationshipsByPersonId.get(p.id) ?? [];
  const memIds = memoriesByPersonId.get(p.id) ?? [];
  return {
    id: p.id,
    displayName: p.displayName,
    canonicalDisplayName: ("canonicalDisplayName" in p ? (p as Record<string, unknown>).canonicalDisplayName : p.displayName) as string,
    alsoKnownAs: ("alsoKnownAs" in p ? (Array.isArray((p as Record<string, unknown>).alsoKnownAs) ? (p as Record<string, unknown>).alsoKnownAs as string[] : []) : []) ,
    birthDateText: p.birthDateText,
    deathDateText: p.deathDateText,
    essenceLine: p.essenceLine,
    portraitMediaId: p.portraitMedia?.id ?? null,
    relationshipIds: rels.map((r: { id: string }) => r.id),
    memoryIds: memIds,
  };
}

function buildExportMemory(
  m: Awaited<ReturnType<typeof getTreeMemories>>[number],
  perspectivesByMemoryId: Map<string, { id: string; body: string | null; contributorName: string | null; mediaId: string | null; mimeType: string | null }[]>,
): ExportMemory {
  return {
    id: m.id,
    primaryPersonId: m.primaryPersonId,
    title: m.title,
    kind: m.kind,
    body: m.body,
    dateOfEventText: m.dateOfEventText,
    placeId: m.placeId,
    placeLabel: m.place?.label ?? m.placeLabelOverride ?? null,
    transcriptText: m.transcriptText,
    mediaIds: [
      ...(m.media ? [m.media.id] : []),
      ...(m.mediaItems?.map((item: { media: { id: string } | null }) => item.media?.id).filter((id: string | null | undefined): id is string => id != null) ?? []),
    ],
    primaryMediaId: m.media?.id ?? null,
    taggedPersonIds: m.personTags?.map((tag: { personId: string }) => tag.personId) ?? [],
    perspectiveIds: perspectivesByMemoryId.get(m.id) ?? [],
    relatedMemoryIds: [],
    contributorName: m.primaryPerson?.displayName ?? null,
    sectionIds: [],
    captionOverride: null,
  };
}

export async function buildFullTreeManifest(
  options: ManifestOptions,
): Promise<ArchiveExportManifest> {
  const {
    treeId,
    viewerUserId,
    viewerRole,
  } = options;

  const tree = await db.query.trees.findFirst({
    where: (t, { eq }) => eq(t.id, treeId),
  });
  if (!tree) throw new Error(`Tree ${treeId} not found`);

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, viewerUserId),
    columns: { id: true, name: true },
  });

  const people = await getTreeScopedPeople(treeId);
  const memories = await getTreeMemories(treeId, { viewerUserId });
  const relationships = await getTreeRelationships(treeId);

  const perspectiveMemoryIds = memories.map((m) => m.id);
  const memoryPerspectives =
    perspectiveMemoryIds.length > 0
      ? await db.query.memoryPerspectives.findMany({
          where: (p, { inArray }) => inArray(p.memoryId, perspectiveMemoryIds),
          with: {
            contributor: { columns: { id: true, name: true } },
            contributorPerson: { columns: { id: true, displayName: true } },
            media: { columns: { id: true, objectKey: true, mimeType: true, sizeBytes: true, checksum: true } },
          },
        })
      : [];

  const perspectivesByMemoryId = new Map<string, { id: string; body: string | null; contributorName: string | null; mediaId: string | null; mimeType: string | null }[]>();
  for (const p of memoryPerspectives) {
    const entry: { id: string; body: string | null; contributorName: string | null; mediaId: string | null; mimeType: string | null } = {
      id: p.id,
      body: p.body,
      contributorName: p.contributorPerson?.displayName ?? p.contributor?.name ?? null,
      mediaId: p.media?.id ?? null,
      mimeType: p.media?.mimeType ?? null,
    };
    const current = perspectivesByMemoryId.get(p.memoryId) ?? [];
    current.push(entry);
    perspectivesByMemoryId.set(p.memoryId, current);
  }

  const relationshipsByPersonId = new Map<string, typeof relationships>();
  for (const rel of relationships) {
    if (!relationshipsByPersonId.has(rel.fromPersonId)) {
      relationshipsByPersonId.set(rel.fromPersonId, []);
    }
    if (!relationshipsByPersonId.has(rel.toPersonId)) {
      relationshipsByPersonId.set(rel.toPersonId, []);
    }
    relationshipsByPersonId.get(rel.fromPersonId)!.push(rel);
    relationshipsByPersonId.get(rel.toPersonId)!.push(rel);
  }

  const memoriesByPersonId = new Map<string, string[]>();
  for (const memory of memories) {
    if (!memoriesByPersonId.has(memory.primaryPersonId)) {
      memoriesByPersonId.set(memory.primaryPersonId, []);
    }
    memoriesByPersonId.get(memory.primaryPersonId)!.push(memory.id);
    if (memory.personTags) {
      for (const tag of memory.personTags) {
        if (!memoriesByPersonId.has(tag.personId)) {
          memoriesByPersonId.set(tag.personId, []);
        }
        const arr = memoriesByPersonId.get(tag.personId)!;
        if (!arr.includes(memory.id)) arr.push(memory.id);
      }
    }
  }

  const mediaMap = new Map<string, ExportMedia>();
  const mediaIdSet = new Set<string>();

  for (const person of people) {
    if (person.portraitMedia) {
      addMediaFromRow(
        { id: person.portraitMedia.id, objectKey: person.portraitMedia.objectKey, mimeType: person.portraitMedia.mimeType, sizeBytes: Number(person.portraitMedia.sizeBytes), checksum: person.portraitMedia.checksum ?? null },
        "portrait",
        mediaMap,
        mediaIdSet,
      );
    }
  }

  for (const memory of memories) {
    if (memory.media) {
      addMediaFromRow(
        { id: memory.media.id, objectKey: memory.media.objectKey, mimeType: memory.media.mimeType, sizeBytes: Number(memory.media.sizeBytes), checksum: memory.media.checksum ?? null },
        "memory",
        mediaMap,
        mediaIdSet,
      );
    }
    if (memory.mediaItems) {
      for (const item of memory.mediaItems) {
        if (item.media) {
          addMediaFromRow(
            { id: item.media.id, objectKey: item.media.objectKey, mimeType: item.media.mimeType, sizeBytes: Number(item.media.sizeBytes), checksum: item.media.checksum ?? null },
            "memory",
            mediaMap,
            mediaIdSet,
          );
        }
      }
    }
    for (const perspective of memoryPerspectives.filter((p) => p.memoryId === memory.id)) {
      if (perspective.media) {
        addMediaFromRow(
          { id: perspective.media.id, objectKey: perspective.media.objectKey, mimeType: perspective.media.mimeType, sizeBytes: Number(perspective.media.sizeBytes), checksum: perspective.media.checksum ?? null },
          "perspective",
          mediaMap,
          mediaIdSet,
        );
      }
    }
  }

  const placeIds = new Set<string>();
  for (const memory of memories) {
    if (memory.placeId) placeIds.add(memory.placeId);
  }
  const places: ExportPlace[] = placeIds.size > 0
    ? (await db.query.places.findMany({
        where: (p, { inArray }) => inArray(p.id, [...placeIds]),
      })).map((p) => ({
        id: p.id, label: p.label, latitude: p.latitude, longitude: p.longitude,
        countryCode: p.countryCode, adminRegion: p.adminRegion, locality: p.locality,
      }))
    : [];

  const exportPeople = people.map((p) => buildExportPerson(p, relationshipsByPersonId, memoriesByPersonId));
  const exportMemories = memories.map((m) => buildExportMemory(m, perspectivesByMemoryId));
  const exportRelationships: ExportRelationship[] = relationships.map((r) => ({
    id: r.id,
    fromPersonId: r.fromPersonId,
    toPersonId: r.toPersonId,
    type: r.type,
    spouseStatus: r.spouseStatus ?? null,
    startDateText: r.startDateText ?? null,
    endDateText: r.endDateText ?? null,
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    generatedBy: { userId: viewerUserId, displayName: user?.name ?? null },
    tree: { id: tree.id, name: tree.name },
    collection: {
      id: null,
      name: options.collectionName ?? tree.name,
      description: options.collectionDescription ?? null,
      introText: null,
      dedicationText: null,
      defaultViewMode: "chapter",
      scopeKind: options.scopeKind ?? "full_tree",
    },
    people: exportPeople,
    memories: exportMemories,
    relationships: exportRelationships,
    places,
    sections: [],
    media: [...mediaMap.values()],
    permissions: {
      exportedByUserId: viewerUserId,
      exportedByRole: viewerRole,
      visibilityResolvedAt: new Date().toISOString(),
    },
  };
}

export async function buildPersonManifest(
  options: ManifestOptions & { scopePersonId: string },
): Promise<ArchiveExportManifest> {
  const { treeId, viewerUserId, viewerRole, scopePersonId } = options;

  const tree = await db.query.trees.findFirst({
    where: (t, { eq }) => eq(t.id, treeId),
  });
  if (!tree) throw new Error(`Tree ${treeId} not found`);

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, viewerUserId),
    columns: { id: true, name: true },
  });

  const allPeople = await getTreeScopedPeople(treeId);
  const targetPerson = allPeople.find((p) => p.id === scopePersonId);
  if (!targetPerson) throw new Error(`Person ${scopePersonId} not found or not visible`);

  const allMemories = await getTreeMemories(treeId, { viewerUserId });
  const personMemories = allMemories.filter(
    (m) =>
      m.primaryPersonId === scopePersonId ||
      m.personTags?.some((tag: { personId: string }) => tag.personId === scopePersonId),
  );

  const taggedPersonIds = new Set<string>([scopePersonId]);
  for (const memory of personMemories) {
    if (memory.personTags) {
      for (const tag of memory.personTags) {
        taggedPersonIds.add(tag.personId);
      }
    }
  }

  const allRelationships = await getTreeRelationships(treeId);
  const personRelationships = allRelationships.filter(
    (r) => r.fromPersonId === scopePersonId || r.toPersonId === scopePersonId,
  );

  const relatedPersonIds = new Set<string>([scopePersonId]);
  for (const rel of personRelationships) {
    relatedPersonIds.add(rel.fromPersonId);
    relatedPersonIds.add(rel.toPersonId);
  }

  const includedPeople = allPeople.filter((p) =>
    taggedPersonIds.has(p.id) || relatedPersonIds.has(p.id),
  );

  const perspectiveMemoryIds = personMemories.map((m) => m.id);
  const memoryPerspectives =
    perspectiveMemoryIds.length > 0
      ? await db.query.memoryPerspectives.findMany({
          where: (p, { inArray }) => inArray(p.memoryId, perspectiveMemoryIds),
          with: {
            contributor: { columns: { id: true, name: true } },
            contributorPerson: { columns: { id: true, displayName: true } },
            media: { columns: { id: true, objectKey: true, mimeType: true, sizeBytes: true, checksum: true } },
          },
        })
      : [];

  const perspectivesByMemoryId = new Map<string, { id: string; body: string | null; contributorName: string | null; mediaId: string | null; mimeType: string | null }[]>();
  for (const p of memoryPerspectives) {
    const entry: { id: string; body: string | null; contributorName: string | null; mediaId: string | null; mimeType: string | null } = {
      id: p.id,
      body: p.body,
      contributorName: p.contributorPerson?.displayName ?? p.contributor?.name ?? null,
      mediaId: p.media?.id ?? null,
      mimeType: p.media?.mimeType ?? null,
    };
    const current = perspectivesByMemoryId.get(p.memoryId) ?? [];
    current.push(entry);
    perspectivesByMemoryId.set(p.memoryId, current);
  }

  const relationshipsByPersonId = new Map<string, typeof personRelationships>();
  for (const rel of personRelationships) {
    if (!relationshipsByPersonId.has(rel.fromPersonId)) {
      relationshipsByPersonId.set(rel.fromPersonId, []);
    }
    if (!relationshipsByPersonId.has(rel.toPersonId)) {
      relationshipsByPersonId.set(rel.toPersonId, []);
    }
    relationshipsByPersonId.get(rel.fromPersonId)!.push(rel);
    relationshipsByPersonId.get(rel.toPersonId)!.push(rel);
  }

  const memoriesByPersonId = new Map<string, string[]>();
  for (const memory of personMemories) {
    if (!memoriesByPersonId.has(memory.primaryPersonId)) {
      memoriesByPersonId.set(memory.primaryPersonId, []);
    }
    memoriesByPersonId.get(memory.primaryPersonId)!.push(memory.id);
    if (memory.personTags) {
      for (const tag of memory.personTags) {
        if (!memoriesByPersonId.has(tag.personId)) {
          memoriesByPersonId.set(tag.personId, []);
        }
        const arr = memoriesByPersonId.get(tag.personId)!;
        if (!arr.includes(memory.id)) arr.push(memory.id);
      }
    }
  }

  const mediaMap = new Map<string, ExportMedia>();
  const mediaIdSet = new Set<string>();

  for (const person of includedPeople) {
    if (person.portraitMedia) {
      addMediaFromRow(
        { id: person.portraitMedia.id, objectKey: person.portraitMedia.objectKey, mimeType: person.portraitMedia.mimeType, sizeBytes: Number(person.portraitMedia.sizeBytes), checksum: person.portraitMedia.checksum ?? null },
        "portrait",
        mediaMap,
        mediaIdSet,
      );
    }
  }

  for (const memory of personMemories) {
    if (memory.media) {
      addMediaFromRow(
        { id: memory.media.id, objectKey: memory.media.objectKey, mimeType: memory.media.mimeType, sizeBytes: Number(memory.media.sizeBytes), checksum: memory.media.checksum ?? null },
        "memory",
        mediaMap,
        mediaIdSet,
      );
    }
    if (memory.mediaItems) {
      for (const item of memory.mediaItems) {
        if (item.media) {
          addMediaFromRow(
            { id: item.media.id, objectKey: item.media.objectKey, mimeType: item.media.mimeType, sizeBytes: Number(item.media.sizeBytes), checksum: item.media.checksum ?? null },
            "memory",
            mediaMap,
            mediaIdSet,
          );
        }
      }
    }
    for (const perspective of memoryPerspectives.filter((p) => p.memoryId === memory.id)) {
      if (perspective.media) {
        addMediaFromRow(
          { id: perspective.media.id, objectKey: perspective.media.objectKey, mimeType: perspective.media.mimeType, sizeBytes: Number(perspective.media.sizeBytes), checksum: perspective.media.checksum ?? null },
          "perspective",
          mediaMap,
          mediaIdSet,
        );
      }
    }
  }

  const placeIds = new Set<string>();
  for (const memory of personMemories) {
    if (memory.placeId) placeIds.add(memory.placeId);
  }
  const places: ExportPlace[] = placeIds.size > 0
    ? (await db.query.places.findMany({
        where: (p, { inArray }) => inArray(p.id, [...placeIds]),
      })).map((p) => ({
        id: p.id, label: p.label, latitude: p.latitude, longitude: p.longitude,
        countryCode: p.countryCode, adminRegion: p.adminRegion, locality: p.locality,
      }))
    : [];

  const personName = targetPerson.displayName;
  const exportPeople = includedPeople.map((p) => buildExportPerson(p, relationshipsByPersonId, memoriesByPersonId));
  const exportMemories = personMemories.map((m) => buildExportMemory(m, perspectivesByMemoryId));
  const exportRelationships: ExportRelationship[] = personRelationships.map((r) => ({
    id: r.id,
    fromPersonId: r.fromPersonId,
    toPersonId: r.toPersonId,
    type: r.type,
    spouseStatus: r.spouseStatus ?? null,
    startDateText: r.startDateText ?? null,
    endDateText: r.endDateText ?? null,
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    generatedBy: { userId: viewerUserId, displayName: user?.name ?? null },
    tree: { id: tree.id, name: tree.name },
    collection: {
      id: null,
      name: options.collectionName ?? personName,
      description: options.collectionDescription ?? null,
      introText: null,
      dedicationText: null,
      defaultViewMode: "chapter",
      scopeKind: "person",
    },
    people: exportPeople,
    memories: exportMemories,
    relationships: exportRelationships,
    places,
    sections: [],
    media: [...mediaMap.values()],
    permissions: {
      exportedByUserId: viewerUserId,
      exportedByRole: viewerRole,
      visibilityResolvedAt: new Date().toISOString(),
    },
  };
}

export function buildMediaLocalPath(mediaId: string, mimeType: string): string {
  const ext = extForMimeType(mimeType);
  return `media/${mediaId}.${ext}`;
}

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/mpeg": "mpeg",
  "video/3gpp": "3gp",
  "video/x-msvideo": "avi",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-m4a": "m4a",
  "audio/opus": "opus",
  "application/pdf": "pdf",
};

function extForMimeType(mime: string): string {
  const normalized = (mime.toLowerCase().split(";")[0] ?? "").trim();
  return MIME_TO_EXT[normalized] ?? "bin";
}