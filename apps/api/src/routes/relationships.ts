import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import {
  RelationshipRuleError,
  createRelationship,
  deleteRelationship,
  updateRelationship,
} from "../lib/relationship-service.js";

const spouseStatusSchema = z.enum(["active", "former", "deceased_partner"]);

const CreateRelationshipBody = z.object({
  fromPersonId: z.string().uuid(),
  toPersonId: z.string().uuid(),
  type: z.enum(["parent_child", "sibling", "spouse"]),
  startDateText: z.string().max(100).optional(),
  endDateText: z.string().max(100).optional(),
  spouseStatus: spouseStatusSchema.optional(),
});

const UpdateRelationshipBody = z.object({
  type: z.enum(["parent_child", "sibling", "spouse"]).optional(),
  startDateText: z.string().max(100).nullable().optional(),
  endDateText: z.string().max(100).nullable().optional(),
  spouseStatus: spouseStatusSchema.nullable().optional(),
});

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

export async function relationshipsPlugin(app: FastifyInstance): Promise<void> {
  app.post("/api/trees/:treeId/relationships", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot edit relationships" });
    }

    const parsed = CreateRelationshipBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    try {
      const rel = await createRelationship({
        treeId,
        fromPersonId: parsed.data.fromPersonId,
        toPersonId: parsed.data.toPersonId,
        type: parsed.data.type,
        startDateText: parsed.data.startDateText ?? null,
        endDateText: parsed.data.endDateText ?? null,
        spouseStatus: parsed.data.spouseStatus ?? null,
      });
      return reply.status(201).send(rel);
    } catch (error) {
      if (error instanceof RelationshipRuleError) {
        return reply.status(error.status).send({ error: error.message });
      }
      request.log.error({ err: error }, "Failed to create relationship");
      return reply.status(500).send({ error: "Failed to create relationship" });
    }
  });

  app.get("/api/trees/:treeId/relationships", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    const rels = await db.query.relationships.findMany({
      where: (r, { eq }) => eq(r.treeId, treeId),
      with: { fromPerson: true, toPerson: true },
    });

    return reply.send(rels);
  });

  app.patch(
    "/api/trees/:treeId/relationships/:relationshipId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, relationshipId } = request.params as {
        treeId: string;
        relationshipId: string;
      };

      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) {
        return reply.status(403).send({ error: "Not a member of this tree" });
      }
      if (membership.role === "viewer") {
        return reply.status(403).send({ error: "Viewers cannot edit relationships" });
      }

      const parsed = UpdateRelationshipBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.status(400).send({ error: "No fields to update" });
      }

      try {
        const updated = await updateRelationship({
          treeId,
          relationshipId,
          type: parsed.data.type,
          startDateText: parsed.data.startDateText,
          endDateText: parsed.data.endDateText,
          spouseStatus: parsed.data.spouseStatus,
        });
        return reply.send(updated);
      } catch (error) {
        if (error instanceof RelationshipRuleError) {
          return reply.status(error.status).send({ error: error.message });
        }
        request.log.error({ err: error }, "Failed to update relationship");
        return reply.status(500).send({ error: "Failed to update relationship" });
      }
    },
  );

  app.delete(
    "/api/trees/:treeId/relationships/:relationshipId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, relationshipId } = request.params as {
        treeId: string;
        relationshipId: string;
      };

      const membership = await verifyMembership(treeId, session.user.id);
      if (!membership) {
        return reply.status(403).send({ error: "Not a member of this tree" });
      }
      if (membership.role === "viewer") {
        return reply.status(403).send({ error: "Viewers cannot edit relationships" });
      }

      try {
        await deleteRelationship(treeId, relationshipId);
        return reply.status(204).send();
      } catch (error) {
        if (error instanceof RelationshipRuleError) {
          return reply.status(error.status).send({ error: error.message });
        }
        request.log.error({ err: error }, "Failed to delete relationship");
        return reply.status(500).send({ error: "Failed to delete relationship" });
      }
    },
  );
}
