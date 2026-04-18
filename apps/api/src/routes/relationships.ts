import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";

const CreateRelationshipBody = z.object({
  fromPersonId: z.string().uuid(),
  toPersonId: z.string().uuid(),
  type: z.enum(["parent_child", "sibling", "spouse"]),
  startDateText: z.string().max(100).optional(),
  endDateText: z.string().max(100).optional(),
});

export async function relationshipsPlugin(app: FastifyInstance): Promise<void> {
  app.post("/api/trees/:treeId/relationships", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const parsed = CreateRelationshipBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { fromPersonId, toPersonId, type, startDateText, endDateText } =
      parsed.data;

    if (fromPersonId === toPersonId) {
      return reply
        .status(400)
        .send({ error: "A person cannot have a relationship with themselves" });
    }

    const [rel] = await db
      .insert(schema.relationships)
      .values({
        treeId,
        fromPersonId,
        toPersonId,
        type,
        startDateText: startDateText ?? null,
        endDateText: endDateText ?? null,
      })
      .returning();

    return reply.status(201).send(rel);
  });

  app.get("/api/trees/:treeId/relationships", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const rels = await db.query.relationships.findMany({
      where: (r, { eq }) => eq(r.treeId, treeId),
      with: { fromPerson: true, toPerson: true },
    });

    return reply.send(rels);
  });
}
