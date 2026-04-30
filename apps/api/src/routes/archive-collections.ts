import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { buildCollectionManifest } from "../lib/archive-export/collection-manifest-builder.js";
import { streamExportZip } from "../lib/archive-export/zip-writer.js";
import { getTreeMemories } from "../lib/cross-tree-read-service.js";

function canManage(role: string | null): boolean {
  return role === "founder" || role === "admin" || role === "editor";
}

const validScopeKinds = ["person", "couple", "branch", "event", "place", "theme", "manual"] as const;
const validViewModes = ["chapter", "drift", "gallery", "storybook", "kiosk"] as const;
const validZipOutputKinds = ["full_zip", "mini_zip", "kiosk_package"] as const;

export async function archiveCollectionsPlugin(app: FastifyInstance): Promise<void> {

  /** POST /api/trees/:treeId/archive-collections/draft */
  app.post("/api/trees/:treeId/archive-collections/draft", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const body = request.body as { scopeKind: string; scope?: Record<string, string>; defaultViewMode?: string };
    if (!body.scopeKind) return reply.status(400).send({ error: "scopeKind is required" });

    if (!validScopeKinds.includes(body.scopeKind as typeof validScopeKinds[number])) {
      return reply.status(400).send({ error: `Invalid scopeKind. Must be one of: ${validScopeKinds.join(", ")}` });
    }
    if (body.defaultViewMode && !validViewModes.includes(body.defaultViewMode as typeof validViewModes[number])) {
      return reply.status(400).send({ error: `Invalid defaultViewMode. Must be one of: ${validViewModes.join(", ")}` });
    }

    if (body.scopeKind === "person") {
      const personId = body.scope?.personId;
      if (!personId) return reply.status(400).send({ error: "personId is required for person scope" });

      const person = await db.query.people.findFirst({
        where: (p, { and, eq }) => and(eq(p.id, personId), eq(p.treeId, treeId)),
        with: { portraitMedia: { columns: { id: true, objectKey: true, mimeType: true } } },
      });
      if (!person) return reply.status(404).send({ error: "Person not found" });

      const visiblePersonMemories = await getTreeMemories(treeId, {
        personId,
        viewerUserId: session.user.id,
        limit: 15,
      });

      const relationships = await db.query.relationships.findMany({
        where: (r, { and, or, eq }) =>
          and(eq(r.treeId, treeId), or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId))),
        with: {
          fromPerson: { columns: { id: true, displayName: true } },
          toPerson: { columns: { id: true, displayName: true } },
        },
      });

      const relatedPersonIds = new Set<string>();
      for (const r of relationships) {
        relatedPersonIds.add(r.fromPersonId);
        relatedPersonIds.add(r.toPersonId);
      }
      relatedPersonIds.delete(personId);

      const draftItems: { itemKind: string; itemId: string; label: string }[] = [
        { itemKind: "person", itemId: person.id, label: person.displayName },
      ];

      for (const relatedId of relatedPersonIds) {
        const r = relationships.find((rel) => rel.fromPersonId === relatedId || rel.toPersonId === relatedId);
        const name = r?.fromPersonId === relatedId ? r.fromPerson?.displayName : r?.toPerson?.displayName;
        if (name) {
          draftItems.push({ itemKind: "person", itemId: relatedId, label: name });
        }
      }

      for (const m of visiblePersonMemories) {
        draftItems.push({ itemKind: "memory", itemId: m.id, label: m.title });
      }

      return reply.send({
        name: `${person.displayName} — Local Archive`,
        description: `A collection of memories and stories about ${person.displayName}`,
        scopeKind: body.scopeKind,
        scope: { personId },
        defaultViewMode: body.defaultViewMode ?? "chapter",
        people: [{ id: person.id, displayName: person.displayName, portraitMediaId: person.portraitMediaId }],
        draftItems,
        warnings: [],
      });
    }

    return reply.send({
      name: "New Collection",
      description: null,
      scopeKind: body.scopeKind,
      scope: body.scope ?? {},
      defaultViewMode: body.defaultViewMode ?? "chapter",
      people: [],
      draftItems: [],
      warnings: [],
    });
  });

  /** GET /api/trees/:treeId/archive-collections */
  app.get("/api/trees/:treeId/archive-collections", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const collections = await db.query.archiveCollections.findMany({
      where: (c, { eq }) => eq(c.treeId, treeId),
      orderBy: (c, { desc }) => [desc(c.updatedAt)],
      with: {
        sections: { orderBy: (s, { asc }) => [asc(s.sortOrder)] },
        items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
      },
    });

    return reply.send({ collections });
  });

  /** POST /api/trees/:treeId/archive-collections */
  app.post("/api/trees/:treeId/archive-collections", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const body = request.body as {
      name: string;
      description?: string;
      scopeKind: string;
      scopeJson?: string;
      introText?: string;
      dedicationText?: string;
      defaultViewMode?: string;
      visibility?: string;
      items?: { itemKind: string; itemId: string; sortOrder?: number; captionOverride?: string }[];
    };

    if (!body.name?.trim()) return reply.status(400).send({ error: "name is required" });
    if (!validScopeKinds.includes(body.scopeKind as typeof validScopeKinds[number])) {
      return reply.status(400).send({ error: `Invalid scopeKind. Must be one of: ${validScopeKinds.join(", ")}` });
    }
    if (body.defaultViewMode && !validViewModes.includes(body.defaultViewMode as typeof validViewModes[number])) {
      return reply.status(400).send({ error: `Invalid defaultViewMode. Must be one of: ${validViewModes.join(", ")}` });
    }

    const [collection] = await db.insert(schema.archiveCollections).values({
      treeId,
      createdByUserId: session.user.id,
      name: body.name.trim(),
      description: body.description ?? null,
      scopeKind: body.scopeKind as typeof schema.collectionScopeKindEnum.enumValues[number],
      scopeJson: body.scopeJson ?? null,
      introText: body.introText ?? null,
      dedicationText: body.dedicationText ?? null,
      defaultViewMode: (body.defaultViewMode ?? "chapter") as typeof schema.collectionViewModeEnum.enumValues[number],
      visibility: (body.visibility ?? "private") as typeof schema.collectionVisibilityEnum.enumValues[number],
    }).returning();

    if (!collection) return reply.status(500).send({ error: "Failed to create collection" });

    if (body.items && body.items.length > 0) {
      await db.insert(schema.archiveCollectionItems).values(
        body.items.map((item, i) => ({
          collectionId: collection.id,
          itemKind: item.itemKind as typeof schema.collectionItemKindEnum.enumValues[number],
          itemId: item.itemId,
          sortOrder: item.sortOrder ?? i,
          captionOverride: item.captionOverride ?? null,
        })),
      );
    }

    return reply.status(201).send({ id: collection.id, name: collection.name });
  });

  /** GET /api/trees/:treeId/archive-collections/:collectionId */
  app.get("/api/trees/:treeId/archive-collections/:collectionId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const collection = await db.query.archiveCollections.findFirst({
      where: (c, { and, eq }) => and(eq(c.id, collectionId), eq(c.treeId, treeId)),
      with: {
        sections: { orderBy: (s, { asc }) => [asc(s.sortOrder)] },
        items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
      },
    });

    if (!collection) return reply.status(404).send({ error: "Collection not found" });
    return reply.send({ collection });
  });

  /** PATCH /api/trees/:treeId/archive-collections/:collectionId */
  app.patch("/api/trees/:treeId/archive-collections/:collectionId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const body = request.body as {
      name?: string;
      description?: string;
      introText?: string;
      dedicationText?: string;
      defaultViewMode?: string;
      visibility?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.introText !== undefined) updates.introText = body.introText;
    if (body.dedicationText !== undefined) updates.dedicationText = body.dedicationText;
    if (body.defaultViewMode !== undefined) {
      if (!validViewModes.includes(body.defaultViewMode as typeof validViewModes[number])) {
        return reply.status(400).send({ error: `Invalid defaultViewMode. Must be one of: ${validViewModes.join(", ")}` });
      }
      updates.defaultViewMode = body.defaultViewMode;
    }
    if (body.visibility !== undefined) updates.visibility = body.visibility;

    await db.update(schema.archiveCollections).set(updates).where(
      and(eq(schema.archiveCollections.id, collectionId), eq(schema.archiveCollections.treeId, treeId)),
    );

    return reply.send({ ok: true });
  });

  /** DELETE /api/trees/:treeId/archive-collections/:collectionId */
  app.delete("/api/trees/:treeId/archive-collections/:collectionId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    await db.delete(schema.archiveCollections).where(
      and(eq(schema.archiveCollections.id, collectionId), eq(schema.archiveCollections.treeId, treeId)),
    );

    return reply.send({ ok: true });
  });

  /** POST /api/trees/:treeId/archive-collections/:collectionId/items */
  app.post("/api/trees/:treeId/archive-collections/:collectionId/items", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const body = request.body as {
      itemKind: string;
      itemId: string;
      sectionId?: string;
      sortOrder?: number;
      captionOverride?: string;
      includeContext?: boolean;
    };

    if (!body.itemKind || !body.itemId) return reply.status(400).send({ error: "itemKind and itemId are required" });

    const existingCount = await db.query.archiveCollectionItems.findMany({
      where: (i, { eq }) => eq(i.collectionId, collectionId),
    });

    const [item] = await db.insert(schema.archiveCollectionItems).values({
      collectionId,
      sectionId: body.sectionId ?? null,
      itemKind: body.itemKind as typeof schema.collectionItemKindEnum.enumValues[number],
      itemId: body.itemId,
      sortOrder: body.sortOrder ?? existingCount.length,
      captionOverride: body.captionOverride ?? null,
      includeContext: body.includeContext ?? true,
    }).returning();

    return reply.status(201).send({ id: item?.id ?? null });
  });

  /** PATCH /api/trees/:treeId/archive-collections/:collectionId/items/:itemId */
  app.patch("/api/trees/:treeId/archive-collections/:collectionId/items/:itemId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId, itemId } = request.params as { treeId: string; collectionId: string; itemId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const body = request.body as { sortOrder?: number; captionOverride?: string; sectionId?: string; includeContext?: boolean };
    const updates: Record<string, unknown> = {};
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.captionOverride !== undefined) updates.captionOverride = body.captionOverride;
    if (body.sectionId !== undefined) updates.sectionId = body.sectionId;
    if (body.includeContext !== undefined) updates.includeContext = body.includeContext;

    if (Object.keys(updates).length === 0) return reply.send({ ok: true });

    await db.update(schema.archiveCollectionItems).set(updates).where(
      and(eq(schema.archiveCollectionItems.id, itemId), eq(schema.archiveCollectionItems.collectionId, collectionId)),
    );

    return reply.send({ ok: true });
  });

  /** DELETE /api/trees/:treeId/archive-collections/:collectionId/items/:itemId */
  app.delete("/api/trees/:treeId/archive-collections/:collectionId/items/:itemId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId, itemId } = request.params as { treeId: string; collectionId: string; itemId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    await db.delete(schema.archiveCollectionItems).where(
      and(eq(schema.archiveCollectionItems.id, itemId), eq(schema.archiveCollectionItems.collectionId, collectionId)),
    );

    return reply.send({ ok: true });
  });

  /** POST /api/trees/:treeId/archive-collections/:collectionId/sections */
  app.post("/api/trees/:treeId/archive-collections/:collectionId/sections", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });
    if (!canManage(membership.role)) return reply.status(403).send({ error: "Not allowed" });

    const body = request.body as { title: string; body?: string; sectionKind?: string; sortOrder?: number };
    if (!body.title?.trim()) return reply.status(400).send({ error: "title is required" });

    const [section] = await db.insert(schema.archiveCollectionSections).values({
      collectionId,
      title: body.title.trim(),
      body: body.body ?? null,
      sectionKind: (body.sectionKind ?? "chapter") as typeof schema.sectionKindEnum.enumValues[number],
      sortOrder: body.sortOrder ?? 0,
    }).returning();

    return reply.status(201).send({ id: section?.id ?? null });
  });

  /** GET /api/trees/:treeId/archive-collections/:collectionId/manifest-preview */
  app.get("/api/trees/:treeId/archive-collections/:collectionId/manifest-preview", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const { manifest } = await buildCollectionManifest(collectionId, treeId, session.user.id, membership.role);
    return reply.send({ manifest });
  });

  /** POST /api/trees/:treeId/archive-collections/:collectionId/export */
  app.post("/api/trees/:treeId/archive-collections/:collectionId/export", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, collectionId } = request.params as { treeId: string; collectionId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const body = request.body as { outputKind?: string };
    const outputKind = (body.outputKind ?? "mini_zip") as typeof schema.exportOutputKindEnum.enumValues[number];
    if (!validZipOutputKinds.includes(outputKind as typeof validZipOutputKinds[number])) {
      return reply.status(400).send({ error: "This export endpoint only supports ZIP-based offline packages" });
    }

    const collection = await db.query.archiveCollections.findFirst({
      where: (c, { and, eq }) => and(eq(c.id, collectionId), eq(c.treeId, treeId)),
    });
    if (!collection) return reply.status(404).send({ error: "Collection not found" });

    const { manifest, mediaObjectKeys } = await buildCollectionManifest(collectionId, treeId, session.user.id, membership.role);

    const [exportRow] = await db.insert(schema.archiveExports).values({
      treeId,
      collectionId,
      requestedByUserId: session.user.id,
      status: "running",
      outputKind,
      manifestVersion: 1,
      manifestJson: JSON.stringify(manifest),
    }).returning();

    try {
      await streamExportZip(manifest, mediaObjectKeys, reply);

      await db.update(schema.archiveExports).set({
        status: "completed",
        completedAt: new Date(),
      }).where(eq(schema.archiveExports.id, exportRow!.id));
    } catch (err) {
      await db.update(schema.archiveExports).set({
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Export failed",
        completedAt: new Date(),
      }).where(eq(schema.archiveExports.id, exportRow!.id));
      throw err;
    }
  });

  /** GET /api/trees/:treeId/archive-exports/:exportId */
  app.get("/api/trees/:treeId/archive-exports/:exportId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, exportId } = request.params as { treeId: string; exportId: string };
    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) return reply.status(403).send({ error: "Not a member" });

    const exportRow = await db.query.archiveExports.findFirst({
      where: (e, { and, eq }) => and(eq(e.id, exportId), eq(e.treeId, treeId)),
    });

    if (!exportRow) return reply.status(404).send({ error: "Export not found" });
    return reply.send({
      id: exportRow.id,
      status: exportRow.status,
      outputKind: exportRow.outputKind,
      fileSizeBytes: exportRow.fileSizeBytes,
      createdAt: exportRow.createdAt,
      completedAt: exportRow.completedAt,
      errorMessage: exportRow.errorMessage,
    });
  });
}
