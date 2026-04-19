import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import * as schema from "@familytree/database";
import { db } from "../lib/db.js";
import { getSession } from "../lib/session.js";
import {
  getPresignedUploadUrl,
  MEDIA_BUCKET,
  s3,
} from "../lib/storage.js";

const PresignBody = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

const GetMediaQuery = z.object({
  key: z.string().min(1),
});

export async function mediaPlugin(app: FastifyInstance): Promise<void> {
  app.get("/api/media", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const parsed = GetMediaQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid query parameters" });
    }

    const mediaRecord = await db.query.media.findFirst({
      where: (m, { eq }) => eq(m.objectKey, parsed.data.key),
    });
    if (!mediaRecord) return reply.status(404).send({ error: "Media not found" });

    const membership = await db.query.treeMemberships.findFirst({
      where: (m) =>
        and(eq(m.treeId, mediaRecord.treeId), eq(m.userId, session.user.id)),
    });
    if (!membership) {
      return reply.status(403).send({ error: "Not a member of this tree" });
    }

    try {
      const object = await s3.send(
        new GetObjectCommand({
          Bucket: MEDIA_BUCKET,
          Key: mediaRecord.objectKey,
        }),
      );

      if (!object.Body) {
        return reply.status(404).send({ error: "Media body not found" });
      }

      reply.header("Content-Type", mediaRecord.mimeType);
      if (typeof mediaRecord.sizeBytes === "number") {
        reply.header("Content-Length", String(mediaRecord.sizeBytes));
      }
      if (object.ETag) reply.header("ETag", object.ETag);

      const stream = Readable.fromWeb(
        object.Body as globalThis.ReadableStream<Uint8Array>,
      );
      return reply.send(stream);
    } catch (err) {
      const code =
        (err as { Code?: string; name?: string }).Code ??
        (err as { name?: string }).name;
      if (code === "NoSuchKey" || code === "NotFound") {
        return reply.status(404).send({ error: "Media not found" });
      }
      throw err;
    }
  });

  app.post("/api/trees/:treeId/media/presign", async (request, reply) => {
    const session = await getSession(request.headers);
    if (!session) return reply.status(401).send({ error: "Unauthorized" });

    const { treeId } = request.params as { treeId: string };

    const membership = await db.query.treeMemberships.findFirst({
      where: (t) => and(eq(t.treeId, treeId), eq(t.userId, session.user.id)),
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
