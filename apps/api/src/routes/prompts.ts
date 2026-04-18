import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { mediaUrl } from "../lib/storage.js";

const CreatePromptBody = z.object({
  toPersonId: z.string().uuid(),
  questionText: z.string().min(1).max(1000),
});

const ReplyBody = z.object({
  kind: z.enum(["story", "photo", "voice", "document", "other"]),
  title: z.string().min(1).max(200),
  body: z.string().optional(),
  mediaId: z.string().uuid().optional(),
  dateOfEventText: z.string().max(100).optional(),
});

const UpdatePromptBody = z.object({
  status: z.enum(["pending", "answered", "dismissed"]),
});

async function verifyMembership(treeId: string, userId: string) {
  return db.query.treeMemberships.findFirst({
    where: (t, { and, eq }) =>
      and(eq(t.treeId, treeId), eq(t.userId, userId)),
  });
}

export async function promptsPlugin(app: FastifyInstance): Promise<void> {
  /** POST /api/trees/:treeId/prompts — send a memory prompt to a person */
  app.post("/api/trees/:treeId/prompts", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    const parsed = CreatePromptBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    const { toPersonId, questionText } = parsed.data;

    // Verify target person belongs to this tree
    const person = await db.query.people.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, toPersonId), eq(p.treeId, treeId)),
    });
    if (!person) return reply.status(404).send({ error: "Person not found in this tree" });

    const [prompt] = await db
      .insert(schema.prompts)
      .values({ treeId, fromUserId: session.user.id, toPersonId, questionText })
      .returning();

    const full = await db.query.prompts.findFirst({
      where: (p, { eq }) => eq(p.id, prompt!.id),
      with: {
        fromUser: true,
        toPerson: { with: { portraitMedia: true } },
      },
    });

    return reply.status(201).send(enrichPrompt(full as PromptWithRelations));
  });

  /** GET /api/trees/:treeId/prompts — all prompts in tree (founder/steward/contributor) */
  app.get("/api/trees/:treeId/prompts", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    const prompts = await db.query.prompts.findMany({
      where: (p, { eq }) => eq(p.treeId, treeId),
      with: {
        fromUser: true,
        toPerson: { with: { portraitMedia: true } },
        replies: { with: { media: true } },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return reply.send(prompts.map((p) => enrichPromptWithReplies(p as PromptWithRelations)));
  });

  /** GET /api/trees/:treeId/prompts/inbox — prompts directed to the current user's linked person */
  app.get("/api/trees/:treeId/prompts/inbox", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    // Find person linked to this user in this tree
    const linkedPerson = await db.query.people.findFirst({
      where: (p, { and, eq }) =>
        and(eq(p.treeId, treeId), eq(p.linkedUserId, session.user.id)),
    });

    if (!linkedPerson) return reply.send([]);

    const prompts = await db.query.prompts.findMany({
      where: (p, { and, eq }) =>
        and(eq(p.treeId, treeId), eq(p.toPersonId, linkedPerson.id)),
      with: {
        fromUser: true,
        toPerson: { with: { portraitMedia: true } },
        replies: { with: { media: true } },
      },
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });

    return reply.send(prompts.map((p) => enrichPromptWithReplies(p as PromptWithRelations)));
  });

  /** PATCH /api/trees/:treeId/prompts/:promptId — update status (dismiss, etc.) */
  app.patch("/api/trees/:treeId/prompts/:promptId", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, promptId } = request.params as { treeId: string; promptId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    const parsed = UpdatePromptBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    const prompt = await db.query.prompts.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, promptId), eq(p.treeId, treeId)),
    });
    if (!prompt) return reply.status(404).send({ error: "Prompt not found" });

    const [updated] = await db
      .update(schema.prompts)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(and(eq(schema.prompts.id, promptId), eq(schema.prompts.treeId, treeId)))
      .returning();

    return reply.send(updated);
  });

  /** POST /api/trees/:treeId/prompts/:promptId/reply — create a memory as a reply */
  app.post("/api/trees/:treeId/prompts/:promptId/reply", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId, promptId } = request.params as { treeId: string; promptId: string };
    const membership = await verifyMembership(treeId, session.user.id);
    if (!membership) return reply.status(403).send({ error: "Not a member of this tree" });

    const parsed = ReplyBody.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: "Invalid request body" });

    const prompt = await db.query.prompts.findFirst({
      where: (p, { and, eq }) => and(eq(p.id, promptId), eq(p.treeId, treeId)),
    });
    if (!prompt) return reply.status(404).send({ error: "Prompt not found" });

    const { kind, title, body, mediaId, dateOfEventText } = parsed.data;

    const [memory] = await db
      .insert(schema.memories)
      .values({
        treeId,
        primaryPersonId: prompt.toPersonId,
        contributorUserId: session.user.id,
        kind,
        title,
        body: body ?? null,
        mediaId: mediaId ?? null,
        promptId,
        dateOfEventText: dateOfEventText ?? null,
      })
      .returning();

    // Mark prompt as answered
    await db
      .update(schema.prompts)
      .set({ status: "answered", updatedAt: new Date() })
      .where(eq(schema.prompts.id, promptId));

    const full = await db.query.memories.findFirst({
      where: (m, { eq }) => eq(m.id, memory!.id),
      with: { media: true },
    });

    return reply.status(201).send({
      ...full,
      mediaUrl: full?.media ? mediaUrl(full.media.objectKey) : null,
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type PromptWithRelations = {
  id: string;
  treeId: string;
  fromUserId: string;
  toPersonId: string;
  questionText: string;
  status: "pending" | "answered" | "dismissed";
  createdAt: Date;
  updatedAt: Date;
  fromUser?: { id: string; name: string; email: string } | null;
  toPerson?: {
    id: string;
    displayName: string;
    portraitMedia?: { objectKey: string } | null;
  } | null;
  replies?: Array<{
    id: string;
    kind: string;
    title: string;
    media?: { objectKey: string } | null;
    [key: string]: unknown;
  }>;
};

function enrichPrompt(p: PromptWithRelations | null | undefined) {
  if (!p) return p;
  return {
    ...p,
    personName: p.toPerson?.displayName ?? null,
    personPortraitUrl: p.toPerson?.portraitMedia
      ? mediaUrl(p.toPerson.portraitMedia.objectKey)
      : null,
    fromUserName: p.fromUser?.name ?? null,
  };
}

function enrichPromptWithReplies(p: PromptWithRelations) {
  const base = enrichPrompt(p);
  if (!base) return base;
  return {
    ...base,
    replies: (p.replies ?? []).map((r) => ({
      ...r,
      mediaUrl: r.media ? mediaUrl(r.media.objectKey) : null,
    })),
  };
}
