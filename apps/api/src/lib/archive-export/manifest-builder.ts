import { db } from "../db.js";
import * as schema from "@tessera/database";
import { eq, inArray } from "drizzle-orm";
import {
  getTreeScopedPeople,
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
  ExportPersonCuration,
  MediaQuality,
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
  includeRelationships?: boolean;
  includeRelatedMemories?: boolean;
  includePlaces?: boolean;
};

type ManifestResult = {
  manifest: ArchiveExportManifest;
  mediaObjectKeys: Map<string, string>;
};

function addMedia(
  id: string,
  objectKey: string,
  mimeType: string,
  sizeBytes: number,
  checksum: string | null,
  role: ExportMedia["role"],
  mediaMap: Map<string, ExportMedia>,
  mediaIdSet: Set<string>,
  mediaObjectKeys: Map<string, string>,
): void {
  if (mediaIdSet.has(id)) return;
  mediaIdSet.add(id);
  const ext = extForMimeType(mimeType) || "bin";
  mediaMap.set(id, {
    id,
    localPath: `media/${id}.${ext}`,
    mimeType,
    sizeBytes,
    checksum,
    role,
  });
  mediaObjectKeys.set(id, objectKey);
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
    alsoKnownAs: ("alsoKnownAs" in p ? (Array.isArray((p as Record<string, unknown>).alsoKnownAs) ? (p as Record<string, unknown>).alsoKnownAs as string[] : []) : []),
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
  perspectiveIdsByMemory: Map<string, string[]>,
): ExportMemory {
  return {
    id: m.id,
    primaryPersonId: m.primaryPersonId,
    title: m.title,
    kind: m.kind as ExportMemory["kind"],
    body: m.body,
    dateOfEventText: m.dateOfEventText,
    placeId: m.placeId ?? null,
    placeLabel: m.place?.label ?? m.placeLabelOverride ?? null,
    transcriptText: m.transcriptText,
    mediaIds: [
      ...(m.media ? [m.media.id] : []),
      ...(m.mediaItems?.map((item: { media: { id: string } | null }) => item.media?.id).filter((id: string | null | undefined): id is string => id != null) ?? []),
    ],
    taggedPersonIds: m.personTags?.map((tag: { personId: string }) => tag.personId) ?? [],
    perspectiveIds: perspectiveIdsByMemory.get(m.id) ?? [],
    relatedMemoryIds: [],
    contributorName: m.primaryPerson?.displayName ?? null,
    sectionIds: [],
    captionOverride: null,
  };
}

async function buildManifest(
  treeId: string,
  viewerUserId: string,
  viewerRole: string,
  people: ScopedPerson[],
  memories: Awaited<ReturnType<typeof getTreeMemories>>,
  relationships: Awaited<ReturnType<typeof getTreeRelationships>>,
  collectionOptions: Partial<ManifestOptions> & { collectionId?: string | null },
): Promise<ManifestResult> {
  const tree = await db.query.trees.findFirst({
    where: (t, { eq }) => eq(t.id, treeId),
  });
  if (!tree) throw new Error(`Tree ${treeId} not found`);

  const user = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, viewerUserId),
    columns: { id: true, name: true },
  });

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

  const exportPerspectives: ExportPerspective[] = memoryPerspectives.map((p) => ({
    id: p.id,
    memoryId: p.memoryId,
    body: p.body,
    mediaId: p.media?.id ?? null,
    contributorName: p.contributorPerson?.displayName ?? p.contributor?.name ?? null,
  }));

  const perspectiveIdsByMemory = new Map<string, string[]>();
  for (const p of exportPerspectives) {
    const arr = perspectiveIdsByMemory.get(p.memoryId) ?? [];
    arr.push(p.id);
    perspectiveIdsByMemory.set(p.memoryId, arr);
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
  const mediaObjectKeys = new Map<string, string>();

  for (const person of people) {
    if (person.portraitMedia) {
      addMedia(
        person.portraitMedia.id,
        person.portraitMedia.objectKey,
        person.portraitMedia.mimeType,
        Number(person.portraitMedia.sizeBytes),
        person.portraitMedia.checksum ?? null,
        "portrait",
        mediaMap,
        mediaIdSet,
        mediaObjectKeys,
      );
    }
  }

  for (const memory of memories) {
    if (memory.media) {
      addMedia(
        memory.media.id,
        memory.media.objectKey,
        memory.media.mimeType,
        Number(memory.media.sizeBytes),
        memory.media.checksum ?? null,
        "memory",
        mediaMap,
        mediaIdSet,
        mediaObjectKeys,
      );
    }
    if (memory.mediaItems) {
      for (const item of memory.mediaItems) {
        if (item.media) {
          addMedia(
            item.media.id,
            item.media.objectKey,
            item.media.mimeType,
            Number(item.media.sizeBytes),
            item.media.checksum ?? null,
            "memory",
            mediaMap,
            mediaIdSet,
            mediaObjectKeys,
          );
        }
      }
    }
  }

  for (const p of memoryPerspectives) {
    if (p.media) {
      addMedia(
        p.media.id,
        p.media.objectKey,
        p.media.mimeType,
        Number(p.media.sizeBytes),
        p.media.checksum ?? null,
        "perspective",
        mediaMap,
        mediaIdSet,
        mediaObjectKeys,
      );
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
        id: p.id,
        label: p.label,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        ...(p.locality ? { locality: p.locality } : {}),
        ...(p.adminRegion ? { adminRegion: p.adminRegion } : {}),
        ...(p.countryCode ? { countryCode: p.countryCode } : {}),
      }))
    : [];

  const personCurationRows = await db.query.personMemoryCuration.findMany({
    where: (c, { eq }) => eq(c.treeId, treeId),
  });
  const personCuration: ExportPersonCuration[] = personCurationRows.map((c) => ({
    personId: c.personId,
    memoryId: c.memoryId,
    isFeatured: c.isFeatured,
    sortOrder: c.sortOrder,
  }));

  const exportPeople = people.map((p) => buildExportPerson(p, relationshipsByPersonId, memoriesByPersonId));
  const exportMemories = memories.map((m) => buildExportMemory(m, perspectiveIdsByMemory));
  const exportRelationships: ExportRelationship[] = relationships.map((r) => ({
    id: r.id,
    fromPersonId: r.fromPersonId,
    toPersonId: r.toPersonId,
    type: r.type,
    startDateText: r.startDateText ?? null,
    endDateText: r.endDateText ?? null,
  }));

  const manifest: ArchiveExportManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    generatedBy: { userId: viewerUserId, displayName: user?.name ?? null },
    tree: { id: tree.id, name: tree.name },
    collection: {
      id: collectionOptions.collectionId ?? null,
      name: collectionOptions.collectionName ?? tree.name,
      description: collectionOptions.collectionDescription ?? null,
      introText: null,
      dedicationText: null,
      defaultViewMode: "chapter",
      scopeKind: collectionOptions.scopeKind ?? "full_tree",
    },
    people: exportPeople,
    memories: exportMemories,
    relationships: exportRelationships,
    perspectives: exportPerspectives,
    places,
    sections: [] as ExportSection[],
    media: [...mediaMap.values()],
    personCuration,
    permissions: {
      exportedByUserId: viewerUserId,
      exportedByRole: viewerRole,
      visibilityResolvedAt: new Date().toISOString(),
    },
  };

  return { manifest, mediaObjectKeys };
}

export async function buildFullTreeManifest(
  options: ManifestOptions,
): Promise<ManifestResult> {
  const { treeId, viewerUserId, viewerRole } = options;

  const people = await getTreeScopedPeople(treeId);
  const memories = await getTreeMemories(treeId, { viewerUserId });
  const relationships = await getTreeRelationships(treeId);

  return buildManifest(treeId, viewerUserId, viewerRole, people, memories, relationships, {
    collectionName: options.collectionName,
    collectionDescription: options.collectionDescription,
    scopeKind: options.scopeKind ?? "full_tree",
  });
}

export async function buildPersonManifest(
  options: ManifestOptions & { scopePersonId: string },
): Promise<ManifestResult> {
  const { treeId, viewerUserId, viewerRole, scopePersonId } = options;

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

  return buildManifest(treeId, viewerUserId, viewerRole, includedPeople, personMemories, personRelationships, {
    collectionName: options.collectionName ?? targetPerson.displayName,
    collectionDescription: options.collectionDescription,
    scopeKind: "person",
  });
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