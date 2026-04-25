import type { FastifyInstance } from "fastify";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";

const DEFAULT_BRANCHES = [
  { name: "Childhood", sortWeight: 0 },
  { name: "School & Education", sortWeight: 1 },
  { name: "Romance & Partnership", sortWeight: 2 },
  { name: "Parenthood & Family", sortWeight: 3 },
  { name: "Career & Calling", sortWeight: 4 },
  { name: "Travel & Adventure", sortWeight: 5 },
  { name: "Home & Place", sortWeight: 6 },
  { name: "Recipes & Traditions", sortWeight: 7 },
  { name: "Loss & Remembrance", sortWeight: 8 },
  { name: "Just Between Us", sortWeight: 9 },
];

const ACCENT_PALETTE = [
  "moss",
  "rose",
  "gilt",
  "ink-soft",
  "moss",
  "rose",
  "gilt",
  "ink-soft",
  "moss",
  "rose",
];

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) => and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

async function ensureDefaultBranches(treeId: string) {
  const existing = await db.query.branches.findMany({
    where: (b, { and, eq }) => and(eq(b.treeId, treeId), eq(b.isDefault, true)),
  });
  if (existing.length > 0) return existing;

  const values = DEFAULT_BRANCHES.map((def, i) => ({
    treeId,
    name: def.name,
    sortWeight: def.sortWeight,
    isDefault: true,
    accent: ACCENT_PALETTE[i] ?? "moss",
  }));

  const inserted = await db.insert(schema.branches).values(values).returning();
  return inserted;
}

const CreateBranchBody = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  accent: z.enum(["moss", "rose", "gilt", "ink-soft"]).optional(),
});

const UpdateBranchBody = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  sortWeight: z.number().int().optional(),
  accent: z.enum(["moss", "rose", "gilt", "ink-soft"]).nullable().optional(),
});

const TagMemoryBody = z.object({
  branchIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function branchesPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/trees/:treeId/branches", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    await ensureDefaultBranches(treeId);

    const branches = await db.query.branches.findMany({
      where: (b, { eq }) => eq(b.treeId, treeId),
      orderBy: (b, { asc }) => [asc(b.sortWeight), asc(b.createdAt)],
    });

    const branchIds = branches.map((b) => b.id);

    const memoryCounts =
      branchIds.length > 0
        ? await db
            .select({
              branchId: schema.memoryBranches.branchId,
              count: count(),
            })
            .from(schema.memoryBranches)
            .where(
              sql`${schema.memoryBranches.branchId} IN (${sql.join(
                branchIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
            .groupBy(schema.memoryBranches.branchId)
        : [];

    const countMap = new Map(memoryCounts.map((r) => [r.branchId, r.count]));

    return reply.send(
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description ?? null,
        sortWeight: b.sortWeight,
        isDefault: b.isDefault,
        accent: b.accent ?? null,
        memoryCount: countMap.get(b.id) ?? 0,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    );
  });

  app.post("/api/trees/:treeId/branches", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot create branches" });
    }

    const parsed = CreateBranchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }

    const inserted = await db
      .insert(schema.branches)
      .values({
        treeId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        accent: parsed.data.accent ?? null,
        isDefault: false,
      })
      .returning();

    const branch = inserted[0];
    if (!branch) {
      return reply.status(500).send({ error: "Failed to create branch" });
    }

    return reply.status(201).send({
      id: branch.id,
      name: branch.name,
      description: branch.description ?? null,
      sortWeight: branch.sortWeight,
      isDefault: branch.isDefault,
      accent: branch.accent ?? null,
      memoryCount: 0,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
    });
  });

  app.patch("/api/trees/:treeId/branches/:branchId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, branchId } = request.params as { treeId: string; branchId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot update branches" });
    }

    const parsed = UpdateBranchBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }

    const existing = await db.query.branches.findFirst({
      where: (b, { and, eq }) => and(eq(b.id, branchId), eq(b.treeId, treeId)),
    });
    if (!existing) {
      return reply.status(404).send({ error: "Branch not found" });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.sortWeight !== undefined) updates.sortWeight = parsed.data.sortWeight;
    if (parsed.data.accent !== undefined) updates.accent = parsed.data.accent;

    const updatedRows = await db
      .update(schema.branches)
      .set(updates)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.treeId, treeId)))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      return reply.status(404).send({ error: "Branch not found" });
    }

    return reply.send({
      id: updated.id,
      name: updated.name,
      description: updated.description ?? null,
      sortWeight: updated.sortWeight,
      isDefault: updated.isDefault,
      accent: updated.accent ?? null,
      memoryCount: 0,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  });

  app.delete("/api/trees/:treeId/branches/:branchId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, branchId } = request.params as { treeId: string; branchId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot delete branches" });
    }

    const existing = await db.query.branches.findFirst({
      where: (b, { and, eq }) => and(eq(b.id, branchId), eq(b.treeId, treeId)),
    });
    if (!existing) {
      return reply.status(404).send({ error: "Branch not found" });
    }
    if (existing.isDefault) {
      return reply.status(403).send({ error: "Default branches cannot be deleted" });
    }

    await db
      .delete(schema.branches)
      .where(and(eq(schema.branches.id, branchId), eq(schema.branches.treeId, treeId)));

    return reply.status(204).send();
  });

  app.post("/api/trees/:treeId/memories/:memoryId/branches", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, memoryId } = request.params as { treeId: string; memoryId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot tag memories" });
    }

    const parsed = TagMemoryBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body", details: parsed.error.issues });
    }

    const memory = await db.query.memories.findFirst({
      where: (m, { and, eq }) => and(eq(m.id, memoryId), eq(m.treeId, treeId)),
    });
    if (!memory) {
      return reply.status(404).send({ error: "Memory not found" });
    }

    const branches = await db.query.branches.findMany({
      where: (b, { and, eq, inArray }) =>
        and(eq(b.treeId, treeId), inArray(b.id, parsed.data.branchIds)),
    });
    if (branches.length !== parsed.data.branchIds.length) {
      return reply.status(400).send({ error: "One or more branches not found in this tree" });
    }

    const values = parsed.data.branchIds.map((branchId) => ({
      memoryId,
      branchId,
    }));

    await db.insert(schema.memoryBranches).values(values).onConflictDoNothing();

    return reply.status(201).send({ tagged: parsed.data.branchIds });
  });

  app.delete("/api/trees/:treeId/memories/:memoryId/branches/:branchId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, memoryId, branchId } = request.params as {
      treeId: string;
      memoryId: string;
      branchId: string;
    };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }
    if (membership.role === "viewer") {
      return reply.status(403).send({ error: "Viewers cannot untag memories" });
    }

    await db
      .delete(schema.memoryBranches)
      .where(
        and(
          eq(schema.memoryBranches.memoryId, memoryId),
          eq(schema.memoryBranches.branchId, branchId),
        ),
      );

    return reply.status(204).send();
  });
}