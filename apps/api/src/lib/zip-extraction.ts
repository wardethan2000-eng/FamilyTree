import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, sql } from "drizzle-orm";
import * as unzipper from "unzipper";
import * as schema from "@tessera/database";
import { db } from "./db.js";
import { extForMimeType, isAllowedMimeType, MEDIA_BUCKET, s3 } from "./storage.js";
import { checkTreeCanAdd } from "./tree-usage-service.js";

type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

const MAX_ENTRIES = 1000;
const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_ENTRY_BYTES = 200 * 1024 * 1024;
const MAX_ZIP_BYTES = 2 * 1024 * 1024 * 1024;
const POLL_INTERVAL_MS = 15_000;
const STALE_LOCK_THRESHOLD_MS = 20 * 60 * 1_000;

import { sanitizePath } from "./sanitize-path.js";

const EXT_MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  tiff: "image/tiff",
  tif: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
  webm: "video/webm",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function inferMimeFromFilename(filename: string): string | null {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot < 0 || lastDot === filename.length - 1) return null;
  const ext = filename.slice(lastDot + 1).toLowerCase();
  return EXT_MIME_MAP[ext] ?? null;
}

export async function extractZipToBatch(
  batchId: string,
  treeId: string,
  userId: string,
  zipObjectKey: string,
  logger: LoggerLike,
): Promise<{ extracted: number; skipped: number }> {
  const object = await s3.send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: zipObjectKey }));
  if (!object.Body) throw new Error("ZIP object body is empty");

  const zipBuffer = Buffer.from(await object.Body.transformToByteArray());
  if (zipBuffer.length > MAX_ZIP_BYTES) {
    throw new Error(`ZIP file exceeds ${MAX_ZIP_BYTES / 1024 / 1024 / 1024} GB limit.`);
  }

  let extracted = 0;
  let skipped = 0;
  let totalBytes = 0;

  const directory = await unzipper.Open.buffer(zipBuffer);
  const entries = directory.files.filter((e) => !e.path.endsWith("/") && !e.path.startsWith("__MACOSX"));

  if (entries.length > MAX_ENTRIES) {
    throw new Error(`ZIP contains too many files (${entries.length}). Maximum is ${MAX_ENTRIES}.`);
  }

  for (const entry of entries) {
    const entrySize = entry.uncompressedSize;
    if (entrySize > MAX_ENTRY_BYTES) {
      logger.warn({ path: entry.path, size: entrySize }, "Skipping ZIP entry exceeding size limit");
      skipped += 1;
      continue;
    }
    totalBytes += entrySize;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error("ZIP total uncompressed size exceeds 2 GB limit.");
    }

    const relativePath = sanitizePath(entry.path);
    if (!relativePath) {
      skipped += 1;
      continue;
    }

    const filename = relativePath.split("/").pop()!;
    const mimeType = inferMimeFromFilename(filename);
    if (!mimeType || !isAllowedMimeType(mimeType)) {
      logger.warn({ path: entry.path, mimeType }, "Skipping ZIP entry with unsupported MIME type");
      skipped += 1;
      continue;
    }

    const capacity = await checkTreeCanAdd(treeId, "media", entrySize);
    if (!capacity.allowed) {
      logger.warn({ path: entry.path, reason: capacity.reason }, "Skipping ZIP entry: capacity exceeded");
      skipped += 1;
      continue;
    }

    const ext = extForMimeType(mimeType);
    const objectKey = `trees/${treeId}/imports/${batchId}/${randomUUID()}.${ext}`;

    const entryBuffer = await entry.buffer();
    await s3.send(
      new PutObjectCommand({
        Bucket: MEDIA_BUCKET,
        Key: objectKey,
        Body: entryBuffer,
        ContentType: mimeType,
      }),
    );

    const [mediaRecord] = await db
      .insert(schema.media)
      .values({
        treeId,
        contributingTreeId: treeId,
        uploadedByUserId: userId,
        objectKey,
        originalFilename: filename,
        mimeType,
        sizeBytes: entrySize,
        storageProvider: "minio",
      })
      .returning();

    if (!mediaRecord) {
      logger.warn({ path: entry.path }, "Failed to create media record for ZIP entry");
      skipped += 1;
      continue;
    }

    await db.insert(schema.importBatchItems).values({
      batchId,
      treeId,
      mediaId: mediaRecord.id,
      originalFilename: filename,
      relativePath,
      detectedMimeType: mimeType,
      sizeBytes: entrySize,
    });

    extracted += 1;
  }

  await db
    .update(schema.importBatches)
    .set({
      totalItems: sql`${schema.importBatches.totalItems} + ${extracted + skipped}`,
      failedItems: sql`${schema.importBatches.failedItems} + ${skipped}`,
      status: "needs_review",
      updatedAt: new Date(),
    })
    .where(eq(schema.importBatches.id, batchId));

  logger.info({ batchId, extracted, skipped }, "ZIP extraction complete");
  return { extracted, skipped };
}

export function startZipExtractionWorker(logger: LoggerLike): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - STALE_LOCK_THRESHOLD_MS);

      await db
        .update(schema.importBatches)
        .set({ status: "uploading", updatedAt: now })
        .where(
          and(
            eq(schema.importBatches.status, "extracting"),
            sql`${schema.importBatches.updatedAt} <= ${staleThreshold}`,
          ),
        );

      const batches = await db.query.importBatches.findMany({
        where: (b, { eq }) => eq(b.status, "awaiting_extraction"),
        orderBy: (b, { asc }) => [asc(b.createdAt)],
        limit: 1,
      });

      const batch = batches[0];
      if (!batch || !batch.sourceKind?.startsWith("zip")) {
        return;
      }

      const [locked] = await db
        .update(schema.importBatches)
        .set({ status: "extracting", updatedAt: new Date() })
        .where(and(eq(schema.importBatches.id, batch.id), eq(schema.importBatches.status, "awaiting_extraction")))
        .returning();
      if (!locked) return;

      const zipItem = await db.query.importBatchItems.findFirst({
        where: (item, { and, eq }) => and(eq(item.batchId, batch.id), eq(item.relativePath, "__archive__")),
        with: { media: { columns: { id: true, objectKey: true } } },
      });

      if (!zipItem?.media) {
        await db
          .update(schema.importBatches)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(schema.importBatches.id, batch.id));
        logger.error({ batchId: batch.id }, "ZIP batch has no archive item");
        return;
      }

      if (!batch.createdByUserId) {
        await db
          .update(schema.importBatches)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(schema.importBatches.id, batch.id));
        logger.error({ batchId: batch.id }, "ZIP batch has no creator user");
        return;
      }

      try {
        const result = await extractZipToBatch(
          batch.id,
          batch.treeId,
          batch.createdByUserId,
          zipItem.media.objectKey,
          logger,
        );

        if (zipItem) {
          await db
            .update(schema.importBatchItems)
            .set({ status: "imported" })
            .where(and(eq(schema.importBatchItems.id, zipItem.id), eq(schema.importBatchItems.batchId, batch.id)));
        }

        logger.info({ batchId: batch.id, ...result }, "ZIP extraction batch processed");
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        await db
          .update(schema.importBatches)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(schema.importBatches.id, batch.id));
        logger.error({ batchId: batch.id, error: errorText }, "ZIP extraction failed");
      }
    } catch (err) {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, "ZIP extraction worker tick error");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
  void tick();

  return () => clearInterval(timer);
}