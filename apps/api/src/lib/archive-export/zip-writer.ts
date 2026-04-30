import { createHash } from "node:crypto";
import type { Archiver } from "archiver";
import archiver from "archiver";
import type { ServerResponse } from "node:http";
import type { ArchiveExportManifest } from "./types.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, MEDIA_BUCKET } from "../../lib/storage.js";
import { renderIndexHtml } from "./html-renderer.js";

type PreparedMedia = {
  mediaId: string;
  objectKey: string;
  buffer: Buffer;
  checksum: string;
};

export async function streamExportZip(
  manifest: ArchiveExportManifest,
  mediaObjectKeys: Map<string, string>,
  reply: { raw: ServerResponse },
): Promise<Archiver> {
  const preparedMedia = await prepareMedia(mediaObjectKeys);
  const checksumByMediaId = new Map(preparedMedia.map((item) => [item.mediaId, item.checksum]));
  const manifestWithChecksums: ArchiveExportManifest = {
    ...manifest,
    media: manifest.media.map((item) => ({
      ...item,
      checksum: checksumByMediaId.get(item.id) ?? item.checksum,
    })),
  };

  const safeName = manifest.tree.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  reply.raw.setHeader("Content-Type", "application/zip");
  reply.raw.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}_archive.zip"`,
  );

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(reply.raw);

  archive.append(renderIndexHtml(manifestWithChecksums), { name: "index.html" });

  const readmeText = [
    `Open index.html in a browser.`,
    ``,
    `This local archive was prepared from Tessera on ${new Date(manifest.exportedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    `It does not require an internet connection.`,
    `Anyone with this folder can view its contents.`,
    `Keep the media folder beside index.html.`,
  ].join("\n");
  archive.append(readmeText, { name: "README.txt" });

  for (const { mediaId, objectKey, buffer } of preparedMedia) {
    const ext = objectKey.split(".").pop() ?? "bin";
    const entryName = `media/${mediaId}.${ext}`;
    archive.append(buffer, { name: entryName });
  }

  const completion = new Promise<void>((resolveCompletion, rejectCompletion) => {
    archive.on("end", resolveCompletion);
    archive.on("error", rejectCompletion);
    reply.raw.on("error", rejectCompletion);
  });

  void archive.finalize();
  await completion;
  return archive;
}

async function prepareMedia(mediaObjectKeys: Map<string, string>): Promise<PreparedMedia[]> {
  const prepared: PreparedMedia[] = [];
  for (const [mediaId, objectKey] of mediaObjectKeys) {
    const buffer = await fetchMediaBuffer(objectKey);
    prepared.push({
      mediaId,
      objectKey,
      buffer,
      checksum: `sha256:${createHash("sha256").update(buffer).digest("hex")}`,
    });
  }
  return prepared;
}

async function fetchMediaBuffer(objectKey: string): Promise<Buffer> {
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: objectKey }),
  );
  if (!obj.Body) {
    throw new Error(`Media object ${objectKey} has no body`);
  }

  const bytes = await obj.Body.transformToByteArray();
  return Buffer.from(bytes);
}
