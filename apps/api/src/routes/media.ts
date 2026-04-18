import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import { getPresignedUploadUrl } from "../lib/storage.js";

const PresignBody = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export async function mediaPlugin(app: FastifyInstance): Promise<void> {
  app.post("/api/trees/:treeId/media/presign", async (request, reply) => {
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

    const parsed = PresignBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    const { filename, contentType, sizeBytes } = parsed.data;
    const ext = filename.split(".").pop() ?? "bin";
    const objectKey = `trees/${treeId}/${randomUUID()}.${ext}`;
    const uploadUrl = await getPresignedUploadUrl(objectKey, contentType);

    const [mediaRecord] = await db
      .insert(schema.media)
      .values({
        treeId,
        uploadedByUserId: session.user.id,
        objectKey,
        originalFilename: filename,
        mimeType: contentType,
        sizeBytes,
        storageProvider: "minio",
      })
      .returning();

    if (!mediaRecord) {
      return reply.status(500).send({ error: "Failed to create media record" });
    }

    return reply.status(201).send({
      mediaId: mediaRecord.id,
      uploadUrl,
      objectKey,
    });
  });
}
