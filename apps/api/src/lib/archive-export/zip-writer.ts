import { Readable } from "node:stream";
import type { Archiver } from "archiver";
import archiver from "archiver";
import type { ServerResponse } from "node:http";
import type { ArchiveExportManifest } from "./types.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, MEDIA_BUCKET } from "../../lib/storage.js";
import { renderIndexHtml } from "./html-renderer.js";

export function streamExportZip(
  manifest: ArchiveExportManifest,
  mediaObjectKeys: Map<string, string>,
  reply: { raw: ServerResponse },
): Archiver {
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
    `Open index.html in a browser.`,
    ``,
    `This local archive was prepared from Tessera on ${new Date(manifest.exportedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.`,
    `It does not require an internet connection.`,
    `Anyone with this folder can view its contents.`,
    `Keep the media folder beside index.html.`,
  ].join("\n");
  archive.append(readmeText, { name: "README.txt" });

  for (const [mediaId, objectKey] of mediaObjectKeys) {
    const ext = objectKey.split(".").pop() ?? "bin";
    const entryName = `media/${mediaId}.${ext}`;
    archive.append(fetchMediaStream(objectKey), { name: entryName });
  }

  archive.finalize();
  return archive;
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