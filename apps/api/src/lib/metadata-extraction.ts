import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, asc, eq, isNotNull, lt, lte } from "drizzle-orm";
import * as schema from "@tessera/database";
import { db } from "./db.js";
import { imageDimensions } from "./image-geometry.js";
import { computeDHash, hammingDistance } from "./perceptual-hash.js";
import { MEDIA_BUCKET, s3 } from "./storage.js";

const POLL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_SECONDS = 60;
const STALE_LOCK_THRESHOLD_MS = 10 * 60 * 1_000;
const BATCH_SIZE = 5;
const DUPLICATE_HAMMING_THRESHOLD = 10;

type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (body instanceof Readable) return streamToBuffer(body);
  if (body && typeof body === "object" && Symbol.asyncIterator in body) {
    return streamToBuffer(Readable.from(body as AsyncIterable<Uint8Array>));
  }
  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function"
  ) {
    const data = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(data);
  }
  throw new Error("Unsupported stream body");
}

interface ExtractedMetadata {
  checksum: string;
  capturedAt: string | null;
  width: number | null;
  height: number | null;
  perceptualHash: string | null;
  extra: Record<string, unknown>;
}

function extractExifDateFromJpeg(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;
  const soi = buffer.readUInt16BE(0);
  if (soi !== 0xffd8) return null;

  let offset = 2;
  while (offset < buffer.length - 4) {
    const marker = buffer.readUInt16BE(offset);
    if (marker === 0xffe1) {
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      const segStart = offset + 4;
      if (segStart + 6 <= buffer.length) {
        const exifHeader = buffer.toString("ascii", segStart, segStart + 6);
        if (exifHeader === "Exif\x00\x00" || exifHeader.startsWith("Exif")) {
          const dateStr = findExifDateInSegment(buffer, segStart, segmentLength);
          if (dateStr) return dateStr;
        }
      }
      offset += 2 + segmentLength;
    } else if ((marker & 0xff00) === 0xff00 && marker !== 0xffda) {
      if (offset + 4 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) return null;
      offset += 2 + segmentLength;
    } else {
      break;
    }
  }
  return null;
}

function findExifDateInSegment(buffer: Buffer, start: number, length: number): string | null {
  const end = Math.min(start + length, buffer.length);
  const segment = buffer.toString("ascii", start, end);
  const dateTimeOriginal = segment.indexOf("DateTimeOriginal\x00\x00");
  if (dateTimeOriginal >= 0) {
    const dateStart = segment.indexOf(":", dateTimeOriginal);
    if (dateStart >= 0) {
      const raw = segment.slice(dateStart - 4, dateStart + 15);
      const cleaned = raw.replace(/\0/g, "").trim();
      if (cleaned.length >= 10) return cleaned.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    }
  }
  const dateTimeIdx = segment.indexOf("DateTime\x00\x00");
  if (dateTimeIdx >= 0) {
    const dateStart = segment.indexOf(":", dateTimeIdx);
    if (dateStart >= 0) {
      const raw = segment.slice(dateStart - 4, dateStart + 15);
      const cleaned = raw.replace(/\0/g, "").trim();
      if (cleaned.length >= 10) return cleaned.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
    }
  }
  return null;
}

async function extractMetadataFromS3(
  objectKey: string,
  mimeType: string,
): Promise<ExtractedMetadata> {
  const object = await s3.send(new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: objectKey }));
  if (!object.Body) throw new Error("Object body is empty");

  const buffer = await bodyToBuffer(object.Body);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  let capturedAt: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let perceptualHash: string | null = null;
  const extra: Record<string, unknown> = {};

  if (mimeType.startsWith("image/jpeg") || mimeType.startsWith("image/tiff")) {
    capturedAt = extractExifDateFromJpeg(buffer);
    if (capturedAt) extra.exifDateSource = "EXIF";
  }

  if (mimeType.startsWith("image/")) {
    const dims = imageDimensions(buffer, mimeType);
    if (dims) {
      width = dims.width;
      height = dims.height;
      extra.dimensionsSource = "header";
    }
    perceptualHash = await computeDHash(buffer);
  }

  return { checksum, capturedAt, width, height, perceptualHash, extra };
}

function nextRetryDate(attempts: number): Date {
  const seconds = BASE_RETRY_SECONDS * 2 ** Math.max(0, attempts - 1);
  return new Date(Date.now() + seconds * 1000);
}

export function startMetadataExtractionWorker(logger: LoggerLike): () => void {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - STALE_LOCK_THRESHOLD_MS);

      await db
        .update(schema.importBatchItems)
        .set({ status: "uploaded", lockedAt: null, updatedAt: now })
        .where(
          and(
            eq(schema.importBatchItems.status, "processing"),
            isNotNull(schema.importBatchItems.lockedAt),
            lte(schema.importBatchItems.lockedAt, staleThreshold),
            lt(schema.importBatchItems.attempts, MAX_ATTEMPTS),
          ),
        );

      const candidates = await db.query.importBatchItems.findMany({
        where: (row, { and, eq, isNull, lte }) =>
          and(
            eq(row.status, "uploaded"),
            isNull(row.checksum),
            lte(row.runAfter, now),
          ),
        with: {
          media: {
            columns: { id: true, objectKey: true, mimeType: true },
          },
        },
        orderBy: [asc(schema.importBatchItems.runAfter), asc(schema.importBatchItems.createdAt)],
        limit: BATCH_SIZE,
      });

      for (const nextItem of candidates) {
        if (!nextItem.media) continue;

        const [locked] = await db
          .update(schema.importBatchItems)
          .set({
            status: "processing",
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.importBatchItems.id, nextItem.id),
              eq(schema.importBatchItems.status, "uploaded"),
            ),
          )
          .returning();
        if (!locked) continue;

        try {
          const meta = await extractMetadataFromS3(
            nextItem.media.objectKey,
            nextItem.media.mimeType,
          );

          const updateData: Record<string, unknown> = {
            checksum: meta.checksum,
            metadata: {
              ...meta.extra,
              ...(meta.width != null && meta.height != null ? { width: meta.width, height: meta.height } : {}),
            },
            updatedAt: new Date(),
          };

          if (meta.capturedAt) {
            try {
              updateData.capturedAt = new Date(meta.capturedAt);
            } catch {
              // Invalid date format, skip
            }
          }

          if (meta.perceptualHash) {
            updateData.perceptualHash = meta.perceptualHash;
          }

          const existingWithChecksum = await db.query.importBatchItems.findFirst({
            where: (item, { and, eq, isNotNull }) =>
              and(
                eq(item.checksum, meta.checksum),
                eq(item.treeId, nextItem.treeId),
                isNotNull(item.memoryId),
              ),
            columns: { id: true, memoryId: true },
          });

          if (existingWithChecksum) {
            updateData.reviewState = "needs_duplicate_review";
            logger.info(
              {
                itemId: nextItem.id,
                existingItemId: existingWithChecksum.id,
                checksum: meta.checksum.slice(0, 16),
              },
              "Possible duplicate detected by checksum",
            );
          } else if (meta.perceptualHash) {
            const nearDupes = await db.query.importBatchItems.findMany({
              where: (item, { and, eq, isNotNull }) =>
                and(
                  eq(item.treeId, nextItem.treeId),
                  isNotNull(item.perceptualHash),
                  isNotNull(item.memoryId),
                ),
              columns: { id: true, perceptualHash: true },
              limit: 200,
            });
            const nearDupe = nearDupes.find((candidate) => {
              if (!candidate.perceptualHash) return false;
              return hammingDistance(meta.perceptualHash!, candidate.perceptualHash) <= DUPLICATE_HAMMING_THRESHOLD;
            });
            if (nearDupe) {
              updateData.reviewState = "needs_duplicate_review";
              logger.info(
                {
                  itemId: nextItem.id,
                  existingItemId: nearDupe.id,
                  hammingDistance: hammingDistance(meta.perceptualHash!, nearDupe.perceptualHash!),
                },
                "Near duplicate detected by perceptual hash",
              );
            }
          }

          await db
            .update(schema.importBatchItems)
            .set({
              ...updateData,
              status: "imported",
              lockedAt: null,
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.importBatchItems.id, nextItem.id));

          if (meta.capturedAt && nextItem.memoryId) {
            const memory = await db.query.memories.findFirst({
              where: (m, { and, eq, isNull }) =>
                and(eq(m.id, nextItem.memoryId!), isNull(m.dateOfEventText)),
              columns: { id: true },
            });

            if (memory) {
              await db
                .update(schema.memories)
                .set({
                  dateOfEventText: meta.capturedAt,
                  captureConfidenceJson: { dateSource: "exif", confidence: 0.7 },
                  updatedAt: new Date(),
                })
                .where(eq(schema.memories.id, memory.id));

              await db
                .update(schema.importBatchItems)
                .set({ reviewState: "needs_place" })
                .where(eq(schema.importBatchItems.id, nextItem.id));
            }
          }

          logger.info(
            { itemId: nextItem.id, checksum: meta.checksum.slice(0, 16), capturedAt: meta.capturedAt },
            "Metadata extracted for import item",
          );
        } catch (err) {
          const attempts = locked.attempts + 1;
          const isPermanentFailure = attempts >= MAX_ATTEMPTS;
          const errorText = err instanceof Error ? err.message : String(err);
          const now2 = new Date();

          await db
            .update(schema.importBatchItems)
            .set({
              status: isPermanentFailure ? "failed" : "uploaded",
              attempts,
              runAfter: isPermanentFailure ? locked.runAfter : nextRetryDate(attempts),
              lockedAt: null,
              lastError: errorText.slice(0, 4000),
              errorMessage: errorText.slice(0, 4000),
              updatedAt: now2,
            })
            .where(eq(schema.importBatchItems.id, nextItem.id));

          logger.warn(
            {
              itemId: nextItem.id,
              attempts,
              permanent: isPermanentFailure,
              error: errorText,
            },
            "Metadata extraction failed for item",
          );
        }
      }
    } catch (err) {
      logger.error(
        { error: err instanceof Error ? err.message : String(err) },
        "Metadata worker tick error",
      );
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