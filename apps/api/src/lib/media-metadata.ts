import { randomUUID } from "node:crypto";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { db } from "./db.js";
import * as schema from "@tessera/database";
import { eq } from "drizzle-orm";

interface ExtractedMetadata {
  dateFromExif?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  cameraMake?: string;
  cameraModel?: string;
}

const EXIF_DATE_FORMAT = /^(\d{4}):(\d{2}):(\d{2})/;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatExifDate(raw: string): string {
  const match = raw.match(EXIF_DATE_FORMAT);
  if (!match) return raw;
  const year = match[1];
  const month = parseInt(match[2]!, 10);
  const day = match[3];
  if (month < 1 || month > 12) return `${year}-${month.toString().padStart(2, "0")}`;
  const dayNum = day ? ` ${parseInt(day, 10)}` : "";
  return `${MONTH_NAMES[month - 1]}${dayNum}, ${year}`;
}

function parseExifDateToDate(raw: string): Date | null {
  const match = raw.match(EXIF_DATE_FORMAT);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  return new Date(year, month - 1, day);
}

const JPEG_MARKER = Buffer.from([0xff, 0xd8, 0xff]);
const EXIF_HEADER = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
const TIFF_LE = Buffer.from([0x49, 0x49]);
const TIFF_BE = Buffer.from([0x4d, 0x4d]);

function readExifTag(
  data: Buffer,
  offset: number,
  byteOrder: "LE" | "BE",
): { tagId: number; type: number; count: number; valueOffset: number } {
  const readU16 = byteOrder === "LE"
    ? (pos: number) => data.readUInt16LE(pos)
    : (pos: number) => data.readUInt16BE(pos);
  const readU32 = byteOrder === "LE"
    ? (pos: number) => data.readUInt32LE(pos)
    : (pos: number) => data.readUInt32BE(pos);

  return {
    tagId: readU16(offset),
    type: readU16(offset + 2),
    count: readU32(offset + 4),
    valueOffset: readU32(offset + 8),
  };
}

function readTagValue(
  data: Buffer,
  tag: { type: number; count: number; valueOffset: number },
  ifdOffset: number,
  byteOrder: "LE" | "BE",
): string | null {
  const readU16 = byteOrder === "LE"
    ? (pos: number) => data.readUInt16LE(pos)
    : (pos: number) => data.readUInt16BE(pos);

  const typeSize: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };
  const size = typeSize[tag.type] ?? 1;
  const totalSize = size * tag.count;

  const valuePos = totalSize <= 4
    ? ifdOffset + tag.valueOffset
    : tag.valueOffset;

  if (valuePos + totalSize > data.length) return null;

  if (tag.type === 2) {
    const str = data.subarray(valuePos, valuePos + tag.count).toString("utf-8");
    return str.replace(/\0+$/, "").trim();
  }

  if (tag.type === 3 && tag.count === 1) {
    return readU16(valuePos).toString();
  }

  return null;
}

function extractExifFromBuffer(data: Buffer): ExtractedMetadata {
  const result: ExtractedMetadata = {};

  if (data.length < 4) return result;
  if (!JPEG_MARKER.every((b, i) => data[i] === b)) return result;

  let pos = 3;

  while (pos + 4 < data.length) {
    const marker = data.readUInt16BE(pos);
    if (marker < 0xffe0 || marker > 0xfffe) break;

    const segLen = data.readUInt16BE(pos + 2);
    const segStart = pos + 4;
    const segEnd = segStart + segLen - 2;

    if (marker === 0xffe1 && segEnd <= data.length) {
      const segData = data.subarray(segStart, segEnd);

      if (segData.length > 6 && EXIF_HEADER.every((b, i) => segData[i] === b)) {
        const tiffOffset = 6;
        const tiffData = segData.subarray(tiffOffset);

        if (tiffData.length < 8) break;

        let byteOrder: "LE" | "BE";
        if (TIFF_LE.every((b, i) => tiffData[i] === b)) {
          byteOrder = "LE";
        } else if (TIFF_BE.every((b, i) => tiffData[i] === b)) {
          byteOrder = "BE";
        } else {
          break;
        }

        const readU16 = byteOrder === "LE"
          ? (p: number) => tiffData.readUInt16LE(p)
          : (p: number) => tiffData.readUInt16BE(p);
        const readU32 = byteOrder === "LE"
          ? (p: number) => tiffData.readUInt32LE(p)
          : (p: number) => tiffData.readUInt32BE(p);

        const ifd0Offset = readU32(4);
        if (ifd0Offset + 2 > tiffData.length) break;

        const numTags = readU16(ifd0Offset);
        const tagsStart = ifd0Offset + 2;

        for (let i = 0; i < numTags; i++) {
          const tagOffset = tagsStart + i * 12;
          if (tagOffset + 12 > tiffData.length) break;

          const tagId = readU16(tagOffset);

          if (tagId === 0x8769) {
            const exifIFDOffset = readU32(tagOffset + 8);
            if (exifIFDOffset + 2 > tiffData.length) continue;

            const numExifTags = readU16(exifIFDOffset);
            const exifTagsStart = exifIFDOffset + 2;

            for (let j = 0; j < numExifTags; j++) {
              const exifTagOffset = exifTagsStart + j * 12;
              if (exifTagOffset + 12 > tiffData.length) break;

              const tag = readExifTag(tiffData, exifTagOffset, byteOrder);
              const tagIdInner = byteOrder === "LE"
                ? tiffData.readUInt16LE(exifTagOffset)
                : tiffData.readUInt16BE(exifTagOffset);

              if (tagIdInner === 0x9003) {
                const value = readTagValue(tiffData, tag, exifIFDOffset, byteOrder);
                if (value) {
                  const formatted = formatExifDate(value);
                  const parsed = parseExifDateToDate(value);
                  if (parsed && parsed.getFullYear() > 1800 && parsed.getFullYear() < 2100) {
                    result.dateFromExif = formatted;
                  }
                }
              }

              if (tagIdInner === 0x010f && !result.cameraMake) {
                const value = readTagValue(tiffData, tag, exifIFDOffset, byteOrder);
                if (value) result.cameraMake = value;
              }

              if (tagIdInner === 0x0110 && !result.cameraModel) {
                const value = readTagValue(tiffData, tag, exifIFDOffset, byteOrder);
                if (value) result.cameraModel = value;
              }
            }
          }
        }
      }
    }

    pos = segEnd;
    if (segLen < 2) break;
  }

  return result;
}

function extractMetadataFromMimeType(
  data: Buffer,
  mimeType: string,
): ExtractedMetadata {
  const result: ExtractedMetadata = {};

  if (mimeType.startsWith("image/jpeg") || mimeType.startsWith("image/tiff")) {
    const exif = extractExifFromBuffer(data);
    if (exif.dateFromExif) result.dateFromExif = exif.dateFromExif;
    if (exif.cameraMake) result.cameraMake = exif.cameraMake;
    if (exif.cameraModel) result.cameraModel = exif.cameraModel;
  }

  if (mimeType.startsWith("image/")) {
    const dimResult = extractImageDimensions(data, mimeType);
    if (dimResult.width) result.width = dimResult.width;
    if (dimResult.height) result.height = dimResult.height;
  }

  return result;
}

function extractImageDimensions(
  data: Buffer,
  mimeType: string,
): { width?: number; height?: number } {
  if (mimeType === "image/png") {
    if (data.length > 24 &&
        data[0] === 0x89 && data[1] === 0x50 &&
        data[2] === 0x4e && data[3] === 0x47) {
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      return { width, height };
    }
  }

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    let pos = 3;
    while (pos + 4 < data.length) {
      const marker = data.readUInt16BE(pos);
      if (marker >= 0xffc0 && marker <= 0xffc3) {
        const segLen = data.readUInt16BE(pos + 2);
        if (pos + segLen + 1 < data.length) {
          const height = data.readUInt16BE(pos + 5);
          const width = data.readUInt16BE(pos + 7);
          return { width, height };
        }
      }
      if (marker === 0xffd9 || marker === 0xffda) break;
      const segLen = data.readUInt16BE(pos + 2);
      pos += 2 + segLen;
    }
  }

  if (mimeType === "image/webp") {
    if (data.length > 30 &&
        data[0] === 0x52 && data[1] === 0x49 &&
        data[2] === 0x46 && data[3] === 0x46) {
      const chunkPos = 12;
      if (data.toString("ascii", chunkPos, chunkPos + 4) === "VP8 ") {
        const width = (data.readUInt16LE(chunkPos + 6) & 0x3fff);
        const height = (data.readUInt16LE(chunkPos + 8) & 0x3fff);
        return { width, height };
      }
    }
  }

  return {};
}

export async function processBatchItemMetadata(
  s3: S3Client,
  bucketName: string,
  batchItem: {
    id: string;
    mediaId: string | null;
    detectedMimeType: string | null;
    originalFilename: string;
  },
): Promise<void> {
  if (!batchItem.mediaId) return;

  const media = await db.query.media.findFirst({
    where: (m, { eq }) => eq(m.id, batchItem.mediaId),
    columns: { id: true, objectKey: true, mimeType: true },
  });

  if (!media) return;

  try {
    const getCmd = new GetObjectCommand({
      Bucket: bucketName,
      Key: media.objectKey,
      Range: "bytes=0-65535",
    });

    const response = await s3.send(getCmd);
    if (!response.Body) return;

    const bodyBytes = await response.Body.transformToByteArray();
    const data = Buffer.from(bodyBytes);

    const mimeType = batchItem.detectedMimeType ?? media.mimeType ?? "application/octet-stream";
    const metadata = extractMetadataFromMimeType(data, mimeType);

    if (Object.keys(metadata).length === 0) return;

    const updateData: Record<string, unknown> = {};
    const memoryUpdates: Record<string, unknown> = {};

    if (metadata.dateFromExif) {
      memoryUpdates.dateOfEventText = metadata.dateFromExif;
    }
    if (metadata.width || metadata.height) {
      updateData.metadata = {
        ...(({} as Record<string, unknown>)),
        ...(metadata.width ? { width: metadata.width } : {}),
        ...(metadata.height ? { height: metadata.height } : {}),
        ...(metadata.cameraMake ? { cameraMake: metadata.cameraMake } : {}),
        ...(metadata.cameraModel ? { cameraModel: metadata.cameraModel } : {}),
      };
    }

    if (Object.keys(updateData).length > 0) {
      const currentItem = await db.query.importBatchItems.findFirst({
        where: (i, { eq }) => eq(i.id, batchItem.id),
        columns: { id: true, metadata: true },
      });
      const existingMeta = (currentItem?.metadata ?? {}) as Record<string, unknown>;
      await db
        .update(schema.importBatchItems)
        .set({
          metadata: {
            ...existingMeta,
            ...updateData.metadata,
            ...(metadata.dateFromExif ? { dateFromExif: metadata.dateFromExif } : {}),
            ...(metadata.cameraMake ? { cameraMake: metadata.cameraMake } : {}),
            ...(metadata.cameraModel ? { cameraModel: metadata.cameraModel } : {}),
          },
          updatedAt: new Date(),
        })
        .where(eq(schema.importBatchItems.id, batchItem.id));
    }

    if (Object.keys(memoryUpdates).length > 0) {
      const item = await db.query.importBatchItems.findFirst({
        where: (i, { eq }) => eq(i.id, batchItem.id),
        columns: { memoryId: true },
      });

      if (item?.memoryId) {
        await db
          .update(schema.memories)
          .set({ ...memoryUpdates, updatedAt: new Date() })
          .where(eq(schema.memories.id, item.memoryId));

        const newReviewState = memoryUpdates.dateOfEventText ? "needs_place" : undefined;
        if (newReviewState) {
          await db
            .update(schema.importBatchItems)
            .set({ reviewState: newReviewState, updatedAt: new Date() })
            .where(eq(schema.importBatchItems.id, batchItem.id));
        }
      }
    }
  } catch {
    // Metadata extraction is best-effort; do not fail the import for this.
  }
}

export { extractMetadataFromMimeType as extractMetadataFromBuffer, type ExtractedMetadata };