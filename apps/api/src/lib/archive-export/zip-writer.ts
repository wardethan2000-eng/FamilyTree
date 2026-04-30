import archiver from "archiver";
import type { FastifyReply } from "fastify";
import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, MEDIA_BUCKET } from "../../lib/storage.js";
import type { ArchiveExportManifest } from "./types.js";
import { renderIndexHtml } from "./html-renderer.js";

export function streamExportZip(
  manifest: ArchiveExportManifest,
  mediaObjectKeys: Map<string, string>,
  reply: FastifyReply,
): void {
  const safeName = manifest.tree.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  reply.raw.setHeader("Content-Type", "application/zip");
  reply.raw.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}_archive.zip"`,
  );

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(reply.raw);

  archive.append(renderIndexHtml(manifest), { name: "index.html" });

  const readmeText = [
    `${manifest.collection.name} — Tessera Local Archive`,
    ``,
    `Open index.html in a browser.`,
    ``,
    `This local archive was prepared from Tessera on ${new Date(manifest.exportedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    `It does not require an internet connection.`,
    `Anyone with this folder can view its contents.`,
    `Keep the media folder beside index.html.`,
    ``,
    `Collection: ${manifest.collection.name}`,
    `Scope: ${manifest.collection.scopeKind}`,
    `People: ${manifest.people.length}`,
    `Memories: ${manifest.memories.length}`,
    `Media files: ${manifest.media.length}`,
  ].join("\n");
  archive.append(readmeText, { name: "README.txt" });

  for (const [mediaId, objectKey] of mediaObjectKeys) {
    archive.append(fetchMediaStream(objectKey), { name: `media/${mediaId}.${extFromKey(objectKey)}` });
  }

  archive.finalize();
}

function extFromKey(objectKey: string): string {
  const dotIndex = objectKey.lastIndexOf(".");
  if (dotIndex === -1) return "bin";
  return objectKey.slice(dotIndex + 1) || "bin";
}

function fetchMediaStream(objectKey: string): Readable {
  const passthrough = new Readable({ read() {} });

  (async () => {
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: objectKey }),
      );
      if (obj.Body) {
        const nodeStream = Readable.fromWeb(obj.Body as ReadableStream<Uint8Array>);
        nodeStream.on("data", (chunk: Buffer) => passthrough.push(chunk));
        nodeStream.on("end", () => passthrough.push(null));
        nodeStream.on("error", (err: Error) => passthrough.destroy(err));
      } else {
        passthrough.push(null);
      }
    } catch {
      passthrough.push(null);
    }
  })();

  return passthrough;
}