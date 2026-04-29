import archiver from "archiver";
import type { FastifyReply } from "fastify";
import type { Readable } from "node:stream";
import type { ArchiveExportManifest, ExportMedia, MediaQuality } from "./types.js";
import { streamMediaFiles } from "./media-export.js";
import { buildOfflineViewerHtml } from "./html-renderer.js";

type ZipOptions = {
  manifest: ArchiveExportManifest;
  media: ExportMedia[];
  mediaQuality?: MediaQuality;
  treeName: string;
};

export async function streamArchiveZip(
  reply: FastifyReply,
  options: ZipOptions,
): Promise<void> {
  const { manifest, media, mediaQuality = "web", treeName } = options;

  const safeName = treeName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  reply.raw.setHeader("Content-Type", "application/zip");
  reply.raw.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}_archive.zip"`,
  );

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.pipe(reply.raw);

  const viewerHtml = buildOfflineViewerHtml(manifest);
  archive.append(viewerHtml, { name: "index.html" });

  archive.append(buildReadmeTxt(manifest, treeName), { name: "README.txt" });

  for await (const file of streamMediaFiles(media, mediaQuality)) {
    archive.append(file.stream as Readable, { name: file.name });
  }

  await archive.finalize();
}

function buildReadmeTxt(
  manifest: ArchiveExportManifest,
  treeName: string,
): string {
  const date = new Date(manifest.exportedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return [
    `${treeName} — Tessera Local Archive`,
    ``,
    `Open index.html in a browser.`,
    ``,
    `This local archive was prepared from Tessera on ${date}.`,
    `It does not require an internet connection.`,
    `Anyone with this folder can view its contents.`,
    `Keep the media folder beside index.html.`,
    ``,
    `Collection: ${manifest.collection.name}`,
    `Scope: ${manifest.collection.scopeKind}`,
    `People: ${manifest.people.length}`,
    `Memories: ${manifest.memories.length}`,
    `Media files: ${manifest.media.length}`,
    ``,
    `Exported by: ${manifest.permissions.exportedByUserId}`,
    `Role at time of export: ${manifest.permissions.exportedByRole}`,
  ].join("\n");
}