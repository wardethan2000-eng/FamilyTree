import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as schema from "@tessera/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";

const UpdatePrefsBody = z.object({
  invitationsEmail: z.boolean().optional(),
  promptsEmail: z.boolean().optional(),
  systemEmail: z.boolean().optional(),
});

export type NotificationKind =
  | "invitationsEmail"
  | "promptsEmail"
  | "systemEmail";

export async function ensureNotificationPreferences(userId: string) {
  const existing = await db.query.userNotificationPreferences.findFirst({
    where: eq(schema.userNotificationPreferences.userId, userId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(schema.userNotificationPreferences)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  return (
    created ??
    (await db.query.userNotificationPreferences.findFirst({
      where: eq(schema.userNotificationPreferences.userId, userId),
    }))!
  );
}

/**
 * Returns true if an email of the given kind may be sent to the address.
 * Unknown addresses (no user account) always receive — they haven't had
 * a chance to opt out yet.
 */
export async function mayEmailUser(
  email: string,
  kind: NotificationKind,
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email.toLowerCase()),
  });
  if (!user) return true;
  const prefs = await ensureNotificationPreferences(user.id);
  return prefs[kind];
}

export async function mePlugin(app: FastifyInstance) {
  /** GET /api/me/invitations — list pending invitations for the signed-in user's email */
  app.get("/api/me/invitations", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });
    const email = session.user.email.toLowerCase();
    const now = new Date();

    const invites = await db.query.invitations.findMany({
      where: (inv, { and, eq }) =>
        and(eq(inv.email, email), eq(inv.status, "pending")),
      with: { tree: true, invitedBy: true, linkedPerson: true },
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    });

    const live = invites.filter((inv) => inv.expiresAt > now);

    return reply.send(
      live.map((inv) => ({
        id: inv.id,
        treeId: inv.treeId,
        treeName: inv.tree?.name ?? "Unknown",
        invitedByName:
          inv.invitedBy?.name ?? inv.invitedBy?.email ?? "Unknown",
        invitedByEmail: inv.invitedBy?.email ?? null,
        proposedRole: inv.proposedRole,
        linkedPersonName: inv.linkedPerson?.displayName ?? null,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    );
  });

  app.get("/api/me/notification-preferences", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });
    const prefs = await ensureNotificationPreferences(session.user.id);
    return reply.send({
      invitationsEmail: prefs.invitationsEmail,
      promptsEmail: prefs.promptsEmail,
      systemEmail: prefs.systemEmail,
    });
  });

  app.put("/api/me/notification-preferences", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });
    const parsed = UpdatePrefsBody.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Invalid body", issues: parsed.error.issues });
    }
    await ensureNotificationPreferences(session.user.id);
    const now = new Date();
    await db
      .update(schema.userNotificationPreferences)
      .set({ ...parsed.data, updatedAt: now })
      .where(
        eq(schema.userNotificationPreferences.userId, session.user.id),
      );
    const updated = await ensureNotificationPreferences(session.user.id);
    return reply.send({
      invitationsEmail: updated.invitationsEmail,
      promptsEmail: updated.promptsEmail,
      systemEmail: updated.systemEmail,
    });
  });
}
