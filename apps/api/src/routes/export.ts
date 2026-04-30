import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import {
  buildFullTreeManifest,
  buildPersonManifest,
} from "../lib/archive-export/manifest-builder.js";
import { streamExportZip } from "../lib/archive-export/zip-writer.js";

export async function exportPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/trees/:treeId/export", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t, { and, eq }) =>
        and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
    });
    if (!membership)
      return reply.status(403).send({ error: "Not a member of this tree" });

    const { manifest, mediaObjectKeys } = await buildFullTreeManifest({
      treeId,
      viewerUserId: session.user.id,
      viewerRole: membership.role,
    });

    streamExportZip(manifest, mediaObjectKeys, reply);
  });

  app.get(
    "/api/trees/:treeId/export/person/:personId",
    async (request, reply) => {
      const session = await getSession(request.headers);
      if (!session) return reply.status(401).send({ error: "Unauthorized" });

      const { treeId, personId } = request.params as {
        treeId: string;
        personId: string;
      };

      const membership = await db.query.treeMemberships.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
      });
      if (!membership)
        return reply.status(403).send({ error: "Not a member of this tree" });

      const { manifest, mediaObjectKeys } = await buildPersonManifest({
        treeId,
        viewerUserId: session.user.id,
        viewerRole: membership.role,
        scopePersonId: personId,
      });

      streamExportZip(manifest, mediaObjectKeys, reply);
    },
  );
}