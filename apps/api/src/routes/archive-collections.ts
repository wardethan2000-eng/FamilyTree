import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { canManageTreeScope } from "../lib/cross-tree-permission-service.js";
import {
  getTreeScopedPeople,
  getTreeMemories,
  getTreeRelationships,
  getTreeScopedPersonIds,
} from "../lib/cross-tree-read-service.js";
import { buildPersonManifest } from "../lib/archive-export/manifest-builder.js";
import { streamExportZip } from "../lib/archive-export/zip-writer.js";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

export async function archiveCollectionsPlugin(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/api/trees/:treeId/archive-collections/draft",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId } = request.params as { treeId: string };
      const body = request.body as {
        scopeKind: string;
        scope: { personId?: string; branchId?: string };
        defaultViewMode?: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership)
        return reply.status(403).send({ error: "Not a member of this tree" });

      if (body.scopeKind === "person" && body.scope?.personId) {
        const personId = body.scope.personId;
        const people = await getTreeScopedPeople(treeId);
        const person = people.find((p) => p.id === personId);
        if (!person)
          return reply
            .status(404)
            .send({ error: "Person not found or not visible" });

        const memories = await getTreeMemories(treeId, {
          viewerUserId: session.user.id,
        });
        const personMemories = memories.filter(
          (m) =>
            m.primaryPersonId === personId ||
            m.personTags?.some((tag) => tag.personId === personId),
        );

        const relationships = await getTreeRelationships(treeId);
        const personRelationships = relationships.filter(
          (r) => r.fromPersonId === personId || r.toPersonId === personId,
        );

        const relatedPersonIds = new Set<string>([personId]);
        for (const rel of personRelationships) {
          relatedPersonIds.add(rel.fromPersonId);
          relatedPersonIds.add(rel.toPersonId);
        }

        const includedPeople = people.filter((p) =>
          relatedPersonIds.has(p.id),
        );

        const warnings: string[] = [];
        for (const m of personMemories) {
          if (m.linkedMediaProvider && !m.media?.objectKey) {
            warnings.push(
              `Memory "${m.title}" has linked external media that will not be available offline`,
            );
          }
        }

        return {
          name: person.displayName,
          people: includedPeople.map((p) => ({ id: p.id, displayName: p.displayName })),
          memories: personMemories.map((m) => ({
            id: m.id,
            title: m.title,
            kind: m.kind,
            dateOfEventText: m.dateOfEventText,
          })),
          relationships: personRelationships.map((r) => ({
            id: r.id,
            type: r.type,
            fromPersonId: r.fromPersonId,
            toPersonId: r.toPersonId,
          })),
          sections: [],
          warnings,
        };
      }

      return reply.status(400).send({ error: "Unsupported scope kind" });
    },
  );

  app.get("/api/trees/:treeId/archive-collections", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership)
      return reply.status(403).send({ error: "Not a member of this tree" });

    const collections = await db.query.archiveCollections.findMany({
      where: (c, { eq }) => eq(c.treeId, treeId),
      orderBy: (c, { desc }) => [desc(c.updatedAt)],
    });

    return collections;
  });

  app.post("/api/trees/:treeId/archive-collections", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const body = request.body as {
      name: string;
      description?: string;
      scopeKind: string;
      scopeJson?: Record<string, unknown>;
      defaultViewMode?: string;
    };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership || !canManageTreeScope(membership.role))
      return reply.status(403).send({ error: "Must be a steward or founder" });

    const baseSlug = slugify(body.name);
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await db.query.archiveCollections.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.treeId, treeId), eq(c.slug, slug)),
        columns: { id: true },
      });
      if (!existing) break;
      suffix++;
      slug = `${baseSlug}-${suffix}`;
    }

    const [collection] = await db
      .insert(schema.archiveCollections)
      .values({
        treeId,
        createdByUserId: session.user.id,
        name: body.name,
        slug,
        description: body.description ?? null,
        scopeKind: body.scopeKind as "person" | "couple" | "branch" | "event" | "place" | "theme" | "manual",
        scopeJson: body.scopeJson ?? null,
        defaultViewMode: (body.defaultViewMode ?? "chapter") as "chapter" | "drift" | "gallery" | "storybook" | "kiosk",
      })
      .returning();

    return collection;
  });

  app.get(
    "/api/trees/:treeId/archive-collections/:collectionId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership)
        return reply.status(403).send({ error: "Not a member of this tree" });

      const collection = await db.query.archiveCollections.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.treeId, treeId), eq(c.id, collectionId)),
        with: {
          sections: { orderBy: (s, { asc }) => [asc(s.sortOrder)] },
          items: { orderBy: (i, { asc }) => [asc(i.sortOrder)] },
        },
      });

      if (!collection)
        return reply.status(404).send({ error: "Collection not found" });

      return collection;
    },
  );

  app.patch(
    "/api/trees/:treeId/archive-collections/:collectionId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };
      const body = request.body as Partial<{
        name: string;
        description: string;
        introText: string;
        dedicationText: string;
        defaultViewMode: string;
        visibility: string;
        includeRelationships: boolean;
        includeRelatedMemories: boolean;
        includePlaces: boolean;
      }>;

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership || !canManageTreeScope(membership.role))
        return reply.status(403).send({ error: "Must be a steward or founder" });

      const existing = await db.query.archiveCollections.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.treeId, treeId), eq(c.id, collectionId)),
        columns: { id: true },
      });
      if (!existing)
        return reply.status(404).send({ error: "Collection not found" });

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.introText !== undefined) updates.introText = body.introText;
      if (body.dedicationText !== undefined)
        updates.dedicationText = body.dedicationText;
      if (body.defaultViewMode !== undefined)
        updates.defaultViewMode = body.defaultViewMode;
      if (body.visibility !== undefined) updates.visibility = body.visibility;
      if (body.includeRelationships !== undefined)
        updates.includeRelationships = body.includeRelationships;
      if (body.includeRelatedMemories !== undefined)
        updates.includeRelatedMemories = body.includeRelatedMemories;
      if (body.includePlaces !== undefined)
        updates.includePlaces = body.includePlaces;

      const [updated] = await db
        .update(schema.archiveCollections)
        .set(updates)
        .where(
          and(
            eq(schema.archiveCollections.id, collectionId),
            eq(schema.archiveCollections.treeId, treeId),
          ),
        )
        .returning();

      return updated;
    },
  );

  app.delete(
    "/api/trees/:treeId/archive-collections/:collectionId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership || !canManageTreeScope(membership.role))
        return reply.status(403).send({ error: "Must be a steward or founder" });

      await db
        .delete(schema.archiveCollections)
        .where(
          and(
            eq(schema.archiveCollections.id, collectionId),
            eq(schema.archiveCollections.treeId, treeId),
          ),
        );

      return { success: true };
    },
  );

  app.post(
    "/api/trees/:treeId/archive-collections/:collectionId/items",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };
      const body = request.body as {
        itemKind: string;
        personId?: string;
        memoryId?: string;
        placeId?: string;
        relationshipId?: string;
        sectionId?: string;
        captionOverride?: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership || !canManageTreeScope(membership.role))
        return reply.status(403).send({ error: "Must be a steward or founder" });

      const maxItem = await db.query.archiveCollectionItems.findFirst({
        where: (i, { eq }) => eq(i.collectionId, collectionId),
        orderBy: (i, { desc }) => [desc(i.sortOrder)],
        columns: { sortOrder: true },
      });
      const nextSort = (maxItem?.sortOrder ?? -1) + 1;

      const [item] = await db
        .insert(schema.archiveCollectionItems)
        .values({
          collectionId,
          sectionId: body.sectionId ?? null,
          itemKind: body.itemKind as "person" | "memory" | "place" | "relationship",
          personId: body.personId ?? null,
          memoryId: body.memoryId ?? null,
          placeId: body.placeId ?? null,
          relationshipId: body.relationshipId ?? null,
          sortOrder: nextSort,
          captionOverride: body.captionOverride ?? null,
        })
        .returning();

      return item;
    },
  );

  app.delete(
    "/api/trees/:treeId/archive-collections/:collectionId/items/:itemId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId, itemId } = request.params as {
        treeId: string;
        collectionId: string;
        itemId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership || !canManageTreeScope(membership.role))
        return reply.status(403).send({ error: "Must be a steward or founder" });

      await db
        .delete(schema.archiveCollectionItems)
        .where(eq(schema.archiveCollectionItems.id, itemId));

      return { success: true };
    },
  );

  app.get(
    "/api/trees/:treeId/archive-collections/:collectionId/manifest-preview",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership)
        return reply.status(403).send({ error: "Not a member of this tree" });

      const collection = await db.query.archiveCollections.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.treeId, treeId), eq(c.id, collectionId)),
      });
      if (!collection)
        return reply.status(404).send({ error: "Collection not found" });

      if (
        collection.scopeKind === "person" &&
        collection.scopeJson?.personId
      ) {
        const { manifest } = await buildPersonManifest({
          treeId,
          viewerUserId: session.user.id,
          viewerRole: membership.role,
          scopePersonId: collection.scopeJson.personId as string,
          collectionName: collection.name,
          collectionDescription: collection.description,
        });
        return manifest;
      }

      return reply.status(400).send({ error: "Unsupported collection scope" });
    },
  );

  app.post(
    "/api/trees/:treeId/archive-collections/:collectionId/export",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, collectionId } = request.params as {
        treeId: string;
        collectionId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership || !canManageTreeScope(membership.role))
        return reply.status(403).send({ error: "Must be a steward or founder" });

      const collection = await db.query.archiveCollections.findFirst({
        where: (c, { and, eq }) =>
          and(eq(c.treeId, treeId), eq(c.id, collectionId)),
      });
      if (!collection)
        return reply.status(404).send({ error: "Collection not found" });

      let manifest, mediaObjectKeys;
      if (
        collection.scopeKind === "person" &&
        collection.scopeJson?.personId
      ) {
        const result = await buildPersonManifest({
          treeId,
          viewerUserId: session.user.id,
          viewerRole: membership.role,
          scopePersonId: collection.scopeJson.personId as string,
          collectionName: collection.name,
          collectionDescription: collection.description,
        });
        manifest = result.manifest;
        mediaObjectKeys = result.mediaObjectKeys;
      } else {
        return reply.status(400).send({ error: "Unsupported collection scope" });
      }

      streamExportZip(manifest, mediaObjectKeys, reply);
    },
  );
}