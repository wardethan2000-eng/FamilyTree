import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import {
  canEditRelationship,
  canManageTreeScope,
} from "../lib/cross-tree-permission-service.js";
import {
  getTreeRelationships,
  isRelationshipInTreeScope,
} from "../lib/cross-tree-read-service.js";
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

const UpdateRelationshipVisibilityBody = z.object({
  isVisible: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
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

    const rels = await getTreeRelationships(treeId);

    return reply.send(rels);
  });

  app.patch(
    "/api/trees/:treeId/relationships/:relationshipId/visibility",
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
      if (!canManageTreeScope(membership.role)) {
        return reply.status(403).send({ error: "Only founders and stewards can manage visibility" });
      }

      const parsed = UpdateRelationshipVisibilityBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }

      const inScope = await isRelationshipInTreeScope(treeId, relationshipId);
      if (!inScope) {
        return reply.status(404).send({ error: "Relationship not found in this tree" });
      }

      const [updated] = await db
        .insert(schema.treeRelationshipVisibility)
        .values({
          treeId,
          relationshipId,
          isVisible: parsed.data.isVisible,
          notes: parsed.data.notes ?? null,
        })
        .onConflictDoUpdate({
          target: [
            schema.treeRelationshipVisibility.treeId,
            schema.treeRelationshipVisibility.relationshipId,
          ],
          set: {
            isVisible: parsed.data.isVisible,
            notes: parsed.data.notes ?? null,
          },
        })
        .returning();

      return reply.send(updated);
    },
  );

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
      const parsed = UpdateRelationshipBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request body" });
      }
      if (Object.keys(parsed.data).length === 0) {
        return reply.status(400).send({ error: "No fields to update" });
      }

      try {
        const permission = await canEditRelationship(session.user.id, relationshipId);
        if (!permission.allowed) {
          return reply.status(403).send({ error: permission.reason });
        }

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
      try {
        const permission = await canEditRelationship(session.user.id, relationshipId);
        if (!permission.allowed) {
          return reply.status(403).send({ error: permission.reason });
        }

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
