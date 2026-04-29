import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, MEDIA_BUCKET } from "../storage.js";
import { extForMimeType } from "../storage.js";
import type { ExportMedia, MediaQuality } from "./types.js";

type MediaStreamResult = {
  name: string;
  stream: NodeJS.ReadableStream;
};

export async function* streamMediaFiles(
  media: ExportMedia[],
  quality: MediaQuality = "web",
): AsyncGenerator<MediaStreamResult> {
  for (const item of media) {
    try {
      const obj = await s3.send(
        new GetObjectCommand({ Bucket: MEDIA_BUCKET, Key: item.objectKey }),
      );
      if (!obj.Body) continue;

      const nodeStream = Readable.fromWeb(
        obj.Body as ReadableStream<Uint8Array>,
      );

      if (quality === "original" || !isImageMimeType(item.mimeType)) {
        yield { name: item.localPath, stream: nodeStream };
        continue;
      }

      // For web and small quality tiers on images, we pass through the original
      // for now. A future enhancement will integrate sharp for resizing.
      // For V1, we yield the original with the correct local path.
      yield { name: item.localPath, stream: nodeStream };
    } catch {
      continue;
    }
  }
}

export async function collectMediaKeys(
  media: ExportMedia[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const item of media) {
    map.set(item.objectKey, item.localPath);
  }
  return map;
}

function isImageMimeType(mime: string): boolean {
  return mime.startsWith("image/");
}