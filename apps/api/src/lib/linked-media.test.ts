import assert from "node:assert/strict";
import { describe, it } from "node:test";

const { normalizeLinkedMedia } = await import("./linked-media.js");

describe("normalizeLinkedMedia", () => {
  it("extracts a Google Drive file id from a standard share link", () => {
    const normalized = normalizeLinkedMedia({
      provider: "google_drive",
      url: "https://drive.google.com/file/d/abc123_DEF-456/view?usp=sharing",
      label: "Family portrait",
    });

    assert.deepEqual(normalized, {
      provider: "google_drive",
      providerItemId: "abc123_DEF-456",
      sourceUrl:
        "https://drive.google.com/file/d/abc123_DEF-456/view?usp=sharing",
      openUrl:
        "https://drive.google.com/file/d/abc123_DEF-456/view?usp=sharing",
      previewUrl:
        "https://drive.google.com/thumbnail?id=abc123_DEF-456&sz=w1600",
      label: "Family portrait",
    });
  });

  it("extracts a Google Drive file id from an id query param", () => {
    const normalized = normalizeLinkedMedia({
      provider: "google_drive",
      url: "https://drive.google.com/open?id=abc123_DEF-456",
    });

    assert.equal(normalized.providerItemId, "abc123_DEF-456");
    assert.equal(
      normalized.previewUrl,
      "https://drive.google.com/thumbnail?id=abc123_DEF-456&sz=w1600",
    );
  });

  it("rejects unparseable Drive links", () => {
    assert.throws(
      () =>
        normalizeLinkedMedia({
          provider: "google_drive",
          url: "https://example.com/not-drive",
        }),
      /could not be parsed/i,
    );
  });
});
