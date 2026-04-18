import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
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
  isLiving: z.boolean().optional(),
  portraitMediaId: z.string().uuid().nullable().optional(),
});

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
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

    const parsed = CreatePersonBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { linkToUser, ...fields } = parsed.data;

    const [person] = await db
      .insert(schema.people)
      .values({
        treeId,
        displayName: fields.displayName,
        alsoKnownAs: fields.alsoKnownAs ?? [],
        essenceLine: fields.essenceLine,
        birthDateText: fields.birthDateText,
        deathDateText: fields.deathDateText,
        birthPlace: fields.birthPlace,
        deathPlace: fields.deathPlace,
        isLiving: fields.isLiving ?? true,
        linkedUserId: linkToUser ? session.user.id : undefined,
      })
      .returning();

    return reply.status(201).send(person);
  });

  app.get("/api/trees/:treeId/people", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const people = await db.query.people.findMany({
      where: (p, { eq }) => eq(p.treeId, treeId),
      with: { portraitMedia: true },
    });

    return reply.send(
      people.map((p) => ({
        ...p,
        portraitUrl: p.portraitMedia ? mediaUrl(p.portraitMedia.objectKey) : null,
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
      db.query.people.findFirst({
        where: (p, { and, eq }) =>
          and(eq(p.treeId, treeId), eq(p.id, personId)),
        with: { portraitMedia: true },
      }),
      db.query.memories.findMany({
        where: (m, { eq }) => eq(m.primaryPersonId, personId),
        with: { media: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
      }),
      db.query.relationships.findMany({
        where: (r, { and, or, eq }) =>
          and(
            eq(r.treeId, treeId),
            or(eq(r.fromPersonId, personId), eq(r.toPersonId, personId)),
          ),
        with: { fromPerson: true, toPerson: true },
      }),
    ]);

    if (!person) return reply.status(404).send({ error: "Person not found" });

    return reply.send({
      ...person,
      portraitUrl: person.portraitMedia
        ? mediaUrl(person.portraitMedia.objectKey)
        : null,
      memories: memories.map((m) => ({
        ...m,
        mediaUrl: m.media ? mediaUrl(m.media.objectKey) : null,
      })),
      relationships,
    });
  });

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

    const [updated] = await db
      .update(schema.people)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(schema.people.treeId, treeId), eq(schema.people.id, personId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Person not found" });

    return reply.send(updated);
  });
}

