import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import * as schema from "@familytree/database";
import { removePersonFromTree } from "../lib/cross-tree-mutation-service.js";
import {
  canEditPerson,
  canManageTreeScope,
} from "../lib/cross-tree-permission-service.js";
import {
  getTreeMemories,
  getTreePersonRelationships,
  getTreeScopedPeople,
  getTreeScopedPerson,
  getVisibleTreesForPerson,
  isPersonInTreeScope,
} from "../lib/cross-tree-read-service.js";
import { db } from "../lib/db.js";
import { checkTreeCanAdd } from "../lib/tree-usage-service.js";
import {
  addPersonToTreeScope,
  createPersonWithScope,
  upsertPersonTreeScope,
} from "../lib/cross-tree-write-service.js";
import { getSession } from "../lib/session.js";
import { mediaUrl } from "../lib/storage.js";

const CreatePersonBody = z.object({
  displayName: z.string().min(1).max(200),
  alsoKnownAs: z.array(z.string()).optional(),
  essenceLine: z.string().max(255).optional(),
  birthDateText: z.string().max(100).optional(),
  deathDateText: z.string().max(100).optional(),
  birthPlace: z.string().max(200).optional(),
  deathPlace: z.string().max(200).optional(),
  birthPlaceId: z.string().uuid().optional(),
  deathPlaceId: z.string().uuid().optional(),
  isLiving: z.boolean().optional(),
  linkToUser: z.boolean().optional(),
});

const UpdatePersonBody = z.object({
  displayName: z.string().min(1).max(200).optional(),
  alsoKnownAs: z.array(z.string()).optional(),
  essenceLine: z.string().max(255).nullable().optional(),
  birthDateText: z.string().max(100).nullable().optional(),
  deathDateText: z.string().max(100).nullable().optional(),
  birthPlace: z.string().max(200).nullable().optional(),
  deathPlace: z.string().max(200).nullable().optional(),
  birthPlaceId: z.string().uuid().nullable().optional(),
  deathPlaceId: z.string().uuid().nullable().optional(),
  isLiving: z.boolean().optional(),
  portraitMediaId: z.string().uuid().nullable().optional(),
});

const AddPersonToScopeBody = z.object({
  personId: z.string().uuid(),
});

const UpdateScopePersonBody = z.object({
  displayNameOverride: z.string().min(1).max(200).nullable().optional(),
  visibilityDefault: z
    .enum(["all_members", "family_circle", "named_circle"])
    .optional(),
});

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

async function validatePlaceId(placeId: string, treeId: string) {
  return db.query.places.findFirst({
    where: (p, { and, eq }) => and(eq(p.id, placeId), eq(p.treeId, treeId)),
  });
}

function serializePlace(place: {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  countryCode: string | null;
  adminRegion: string | null;
  locality: string | null;
} | null | undefined) {
  return place
    ? {
        id: place.id,
        label: place.label,
        latitude: place.latitude,
        longitude: place.longitude,
        countryCode: place.countryCode,
        adminRegion: place.adminRegion,
        locality: place.locality,
      }
    : null;
}

export async function peoplePlugin(app: FastifyInstance): Promise<void> {
  app.post("/api/trees/:treeId/people", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot add people" });
    }

    const parsed = CreatePersonBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { linkToUser, ...fields } = parsed.data;
    const capacity = await checkTreeCanAdd(treeId, "person");
    if (!capacity.allowed) {
      return reply.status(capacity.status).send({ error: capacity.reason });
    }

    if (fields.birthPlaceId) {
      const place = await validatePlaceId(fields.birthPlaceId, treeId);
      if (!place) {
        return reply.status(400).send({ error: "Birth place not found in this tree" });
      }
    }
    if (fields.deathPlaceId) {
      const place = await validatePlaceId(fields.deathPlaceId, treeId);
      if (!place) {
        return reply.status(400).send({ error: "Death place not found in this tree" });
      }
    }

    const person = await createPersonWithScope({
      treeId,
      addedByUserId: session.user.id,
      displayName: fields.displayName,
      alsoKnownAs: fields.alsoKnownAs ?? [],
      essenceLine: fields.essenceLine,
      birthDateText: fields.birthDateText,
      deathDateText: fields.deathDateText,
      birthPlace: fields.birthPlace,
      deathPlace: fields.deathPlace,
      birthPlaceId: fields.birthPlaceId,
      deathPlaceId: fields.deathPlaceId,
      isLiving: fields.isLiving ?? true,
      linkedUserId: linkToUser ? session.user.id : undefined,
    });

    if (!person) {
      return reply.status(500).send({ error: "Failed to create person" });
    }

    const fullPerson = await db.query.people.findFirst({
      where: (p, { eq }) => eq(p.id, person.id),
      with: { birthPlaceRef: true, deathPlaceRef: true },
    });

    return reply.status(201).send({
      ...fullPerson,
      birthPlaceResolved: serializePlace(fullPerson?.birthPlaceRef),
      deathPlaceResolved: serializePlace(fullPerson?.deathPlaceRef),
    });
  });

  app.get("/api/trees/:treeId/people", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const people = await getTreeScopedPeople(treeId);

    return reply.send(
      people.map((p) => ({
        ...p,
        portraitUrl: p.portraitMedia ? mediaUrl(p.portraitMedia.objectKey) : null,
        birthPlaceResolved: serializePlace(p.birthPlaceRef),
        deathPlaceResolved: serializePlace(p.deathPlaceRef),
      })),
    );
  });

  app.get("/api/trees/:treeId/people/:personId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as {
      treeId: string;
      personId: string;
    };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const [person, memories, relationships] = await Promise.all([
      getTreeScopedPerson(treeId, personId),
      getTreeMemories(treeId, { personId, viewerUserId: session.user.id }),
      getTreePersonRelationships(treeId, personId),
    ]);

    if (!person) return reply.status(404).send({ error: "Person not found" });

    return reply.send({
      ...person,
      portraitUrl: person.portraitMedia
        ? mediaUrl(person.portraitMedia.objectKey)
        : null,
      birthPlaceResolved: serializePlace(person.birthPlaceRef),
      deathPlaceResolved: serializePlace(person.deathPlaceRef),
      memories: memories.map((m) => ({
        ...m,
        mediaUrl: m.media ? mediaUrl(m.media.objectKey) : null,
        mimeType: m.media?.mimeType ?? null,
        place: serializePlace(m.place),
      })),
      relationships,
    });
  });

  app.post("/api/trees/:treeId/scope/people", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can manage tree scope" });
    }

    const parsed = AddPersonToScopeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { personId } = parsed.data;
    const alreadyInScope = await isPersonInTreeScope(treeId, personId);
    if (alreadyInScope) {
      const existing = await getTreeScopedPerson(treeId, personId);
      return reply.status(200).send(existing);
    }

    const capacity = await checkTreeCanAdd(treeId, "person");
    if (!capacity.allowed) {
      return reply.status(capacity.status).send({ error: capacity.reason });
    }

    const person = await addPersonToTreeScope({
      treeId,
      personId,
      addedByUserId: session.user.id,
    });
    if (!person) {
      return reply.status(404).send({ error: "Person not found" });
    }

    const fullPerson = await getTreeScopedPerson(treeId, personId);
    return reply.status(201).send(fullPerson);
  });

  app.get("/api/trees/:treeId/scope/people", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const people = await getTreeScopedPeople(treeId);
    return reply.send(people);
  });

  app.patch("/api/trees/:treeId/scope/people/:personId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as {
      treeId: string;
      personId: string;
    };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can manage tree scope" });
    }

    const parsed = UpdateScopePersonBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    if (Object.keys(parsed.data).length === 0) {
      return reply.status(400).send({ error: "No scope fields to update" });
    }

    const personInScope = await isPersonInTreeScope(treeId, personId);
    if (!personInScope) {
      return reply.status(404).send({ error: "Person not found" });
    }

    const updated = await upsertPersonTreeScope({
      treeId,
      personId,
      addedByUserId: session.user.id,
      displayNameOverride: parsed.data.displayNameOverride,
      visibilityDefault: parsed.data.visibilityDefault,
    });

    if (!updated) {
      return reply.status(404).send({ error: "Person not found" });
    }

    const fullPerson = await getTreeScopedPerson(treeId, personId);
    return reply.send(fullPerson);
  });

  app.delete("/api/trees/:treeId/scope/people/:personId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as {
      treeId: string;
      personId: string;
    };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can manage tree scope" });
    }

    const result = await removePersonFromTree(treeId, personId);
    if (!result) {
      return reply.status(404).send({ error: "Person not found" });
    }

    return reply.send({
      deleted: true,
      action: result.action,
      remainingScopeCount: result.remainingScopeCount,
      personId: result.personId,
    });
  });

  app.get("/api/people/:personId/trees", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { personId } = request.params as { personId: string };

    const visibleTrees = await getVisibleTreesForPerson(personId, session.user.id);
    if (visibleTrees.length === 0) {
      return reply.status(404).send({ error: "Person not found" });
    }

    return reply.send(visibleTrees);
  });

  /**
   * GET /api/trees/:treeId/people/:personId/cross-tree
   *
   * Returns the "mirror" person record and their public memories from a
   * connected tree, accessible because of an active crossTreePersonLink.
   *
   * The requesting user must be a member of treeId.
   * The personId must be in treeId.
   * The response lists all active links for this person and the linked
   * person's basic profile + memories from the other tree.
   */
  app.get(
    "/api/trees/:treeId/people/:personId/cross-tree",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, personId } = request.params as {
        treeId: string;
        personId: string;
      };

      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) {
        return reply.status(403).send({ error: "Not a member of this tree" });
      }

      // Confirm the person belongs to this tree
      const personInScope = await isPersonInTreeScope(treeId, personId);
      if (!personInScope) {
        return reply.status(404).send({ error: "Person not found" });
      }

      // Find all active cross-tree links for this person (could be personA or personB)
      const linksRaw = await db.query.crossTreePersonLinks.findMany({
        where: (l) =>
          or(eq(l.personAId, personId), eq(l.personBId, personId)),
        with: {
          connection: true,
          personA: { with: { portraitMedia: true } },
          personB: { with: { portraitMedia: true } },
        },
      });

      // Filter to active connections only
      const activeLinks = linksRaw.filter((l) => l.connection.status === "active");

      // For each active link, resolve the "other" person and their memories.
      const legacyResults = await Promise.all(
        activeLinks.map(async (link) => {
          const isPersonA = link.personAId === personId;
          const otherPerson = isPersonA ? link.personB : link.personA;
          const otherTreeId = isPersonA
            ? link.connection.treeBId
            : link.connection.treeAId;
          const otherTree = await db.query.trees.findFirst({
            where: (tree, { eq }) => eq(tree.id, otherTreeId),
            columns: {
              name: true,
            },
          });

          const memories = await getTreeMemories(otherTreeId, {
            personId: otherPerson.id,
            viewerUserId: session.user.id,
          });

          return {
            connectionId: link.connectionId,
            treeId: otherTreeId,
            treeName: otherTree?.name ?? null,
            linkedPerson: {
              ...otherPerson,
              portraitUrl: otherPerson.portraitMedia
                ? mediaUrl(otherPerson.portraitMedia.objectKey)
                : null,
            },
            memories: memories.map((m) => ({
              ...m,
              mediaUrl: m.media ? mediaUrl(m.media.objectKey) : null,
              mimeType: m.media?.mimeType ?? null,
            })),
          };
        }),
      );

      const legacyTreeIds = new Set(legacyResults.map((result) => result.treeId));
      const visibleTrees = await getVisibleTreesForPerson(personId, session.user.id);
      const scopeResults = await Promise.all(
        visibleTrees
          .filter((candidateTree) => candidateTree.id !== treeId)
          .filter((candidateTree) => !legacyTreeIds.has(candidateTree.id))
          .map(async (candidateTree) => {
            const scopedPerson = await getTreeScopedPerson(candidateTree.id, personId);
            if (!scopedPerson) {
              return null;
            }

            const memories = await getTreeMemories(candidateTree.id, {
              personId,
              viewerUserId: session.user.id,
            });

            return {
              connectionId: null,
              treeId: candidateTree.id,
              treeName: candidateTree.name,
              linkedPerson: {
                ...scopedPerson,
                portraitUrl: scopedPerson.portraitMedia
                  ? mediaUrl(scopedPerson.portraitMedia.objectKey)
                  : null,
              },
              memories: memories.map((memory) => ({
                ...memory,
                mediaUrl: memory.media ? mediaUrl(memory.media.objectKey) : null,
                mimeType: memory.media?.mimeType ?? null,
              })),
            };
          }),
      );

      return reply.send([
        ...legacyResults,
        ...scopeResults.filter((result) => result !== null),
      ]);
    },
  );

  app.patch("/api/trees/:treeId/people/:personId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as {
      treeId: string;
      personId: string;
    };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const parsed = UpdatePersonBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: "No fields to update" });
    }

    if (updates.portraitMediaId) {
      const portraitMediaId = updates.portraitMediaId;
      const portraitMedia = await db.query.media.findFirst({
        where: (m, { and, eq }) =>
          and(eq(m.id, portraitMediaId), eq(m.treeId, treeId)),
      });
      if (!portraitMedia) {
        return reply.status(400).send({ error: "Portrait media not found in this tree" });
      }
    }

    if (updates.birthPlaceId) {
      const place = await validatePlaceId(updates.birthPlaceId, treeId);
      if (!place) {
        return reply.status(400).send({ error: "Birth place not found in this tree" });
      }
    }
    if (updates.deathPlaceId) {
      const place = await validatePlaceId(updates.deathPlaceId, treeId);
      if (!place) {
        return reply.status(400).send({ error: "Death place not found in this tree" });
      }
    }

    const personInScope = await isPersonInTreeScope(treeId, personId);
    if (!personInScope) {
      return reply.status(404).send({ error: "Person not found" });
    }

    const permission = await canEditPerson(session.user.id, personId);
    if (!permission.allowed) {
      return reply.status(403).send({ error: permission.reason });
    }

    const [updated] = await db
      .update(schema.people)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.people.id, personId))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Person not found" });

    const fullUpdated = await getTreeScopedPerson(treeId, personId);

    return reply.send({
      ...fullUpdated,
      portraitUrl: fullUpdated?.portraitMedia
        ? mediaUrl(fullUpdated.portraitMedia.objectKey)
        : null,
      birthPlaceResolved: serializePlace(fullUpdated?.birthPlaceRef),
      deathPlaceResolved: serializePlace(fullUpdated?.deathPlaceRef),
    });
  });

  app.delete("/api/trees/:treeId/people/:personId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, personId } = request.params as {
      treeId: string;
      personId: string;
    };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (!canManageTreeScope(membership.role)) {
      return reply.status(403).send({ error: "Only founders and stewards can delete people from a tree" });
    }

    const result = await removePersonFromTree(treeId, personId);
    if (!result) {
      return reply.status(404).send({ error: "Person not found" });
    }

    return reply.status(200).send({
      deleted: true,
      action: result.action,
      remainingScopeCount: result.remainingScopeCount,
      personId: result.personId,
    });
  });
}
