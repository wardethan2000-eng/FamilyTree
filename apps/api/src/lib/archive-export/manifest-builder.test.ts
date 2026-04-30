import { describe, it } from "node:test";
import assert from "node:assert/strict";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/mpeg": "mpeg",
  "video/3gpp": "3gp",
  "video/x-msvideo": "avi",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-m4a": "m4a",
  "audio/opus": "opus",
  "application/pdf": "pdf",
};

function extForMimeType(mime: string): string {
  const normalized = (mime.toLowerCase().split(";")[0] ?? "").trim();
  return MIME_TO_EXT[normalized] ?? "bin";
}

function buildMediaLocalPath(mediaId: string, mimeType: string): string {
  const ext = extForMimeType(mimeType);
  return `media/${mediaId}.${ext}`;
}

describe("buildMediaLocalPath", () => {
  it("maps jpeg to jpg", () => {
    assert.equal(buildMediaLocalPath("abc-123", "image/jpeg"), "media/abc-123.jpg");
  });

  it("maps png", () => {
    assert.equal(buildMediaLocalPath("def-456", "image/png"), "media/def-456.png");
  });

  it("maps video/mp4", () => {
    assert.equal(buildMediaLocalPath("vid-1", "video/mp4"), "media/vid-1.mp4");
  });

  it("maps audio/mpeg to mp3", () => {
    assert.equal(buildMediaLocalPath("aud-1", "audio/mpeg"), "media/aud-1.mp3");
  });

  it("maps audio/mp3 to mp3", () => {
    assert.equal(buildMediaLocalPath("aud-2", "audio/mp3"), "media/aud-2.mp3");
  });

  it("maps audio/webm", () => {
    assert.equal(buildMediaLocalPath("aud-3", "audio/webm"), "media/aud-3.webm");
  });

  it("maps video/quicktime to mov", () => {
    assert.equal(buildMediaLocalPath("vid-2", "video/quicktime"), "media/vid-2.mov");
  });

  it("maps image/webp", () => {
    assert.equal(buildMediaLocalPath("img-1", "image/webp"), "media/img-1.webp");
  });

  it("maps application/pdf", () => {
    assert.equal(buildMediaLocalPath("doc-1", "application/pdf"), "media/doc-1.pdf");
  });

  it("falls back to bin for unknown mime types", () => {
    assert.equal(buildMediaLocalPath("unk-1", "application/unknown"), "media/unk-1.bin");
  });

  it("handles mime types with charset parameter", () => {
    assert.equal(buildMediaLocalPath("txt-1", "image/jpeg; charset=utf-8"), "media/txt-1.jpg");
  });

  it("handles uppercase mime types", () => {
    assert.equal(buildMediaLocalPath("up-1", "IMAGE/JPEG"), "media/up-1.jpg");
  });

  it("produces collision-free paths for different IDs with same mime type", () => {
    const path1 = buildMediaLocalPath("id-a", "image/jpeg");
    const path2 = buildMediaLocalPath("id-b", "image/jpeg");
    assert.notEqual(path1, path2);
    assert.equal(path1, "media/id-a.jpg");
    assert.equal(path2, "media/id-b.jpg");
  });
});

describe("extForMimeType", () => {
  it("handles all video types", () => {
    assert.equal(extForMimeType("video/mp4"), "mp4");
    assert.equal(extForMimeType("video/quicktime"), "mov");
    assert.equal(extForMimeType("video/webm"), "webm");
    assert.equal(extForMimeType("video/x-msvideo"), "avi");
  });

  it("handles all audio types", () => {
    assert.equal(extForMimeType("audio/mpeg"), "mp3");
    assert.equal(extForMimeType("audio/mp4"), "m4a");
    assert.equal(extForMimeType("audio/ogg"), "ogg");
    assert.equal(extForMimeType("audio/wav"), "wav");
    assert.equal(extForMimeType("audio/flac"), "flac");
    assert.equal(extForMimeType("audio/opus"), "opus");
  });

  it("handles trailing whitespace and semicolons", () => {
    assert.equal(extForMimeType("image/jpeg ; charset=binary"), "jpg");
  });
});