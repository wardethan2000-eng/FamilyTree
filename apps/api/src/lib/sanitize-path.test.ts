import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizePath } from "./sanitize-path.js";

describe("sanitizePath", () => {
  it("returns clean paths unchanged", () => {
    assert.equal(sanitizePath("photos/vacation/beach.jpg"), "photos/vacation/beach.jpg");
  });

  it("returns simple filename unchanged", () => {
    assert.equal(sanitizePath("IMG_001.jpg"), "IMG_001.jpg");
  });

  it("filters out .. path segments", () => {
    assert.equal(sanitizePath("../../etc/passwd"), "etc/passwd");
  });

  it("filters out . segments", () => {
    assert.equal(sanitizePath("./current/./file.txt"), "current/file.txt");
  });

  it("handles empty path segments", () => {
    assert.equal(sanitizePath("a///b"), "a/b");
  });

  it("returns null for empty result", () => {
    assert.equal(sanitizePath(""), null);
    assert.equal(sanitizePath("/"), null);
    assert.equal(sanitizePath("///"), null);
  });

  it("sanitizes special characters", () => {
    assert.equal(sanitizePath('file<name>with:special|chars?.txt'), "file_name_with_special_chars_.txt");
  });

  it("returns null for path traversal via ..", () => {
    assert.equal(sanitizePath("../../../etc/shadow"), "etc/shadow");
  });

  it("handles mixed traversal and valid paths", () => {
    const result = sanitizePath("photos/../private/secret.jpg");
    assert.equal(result, "photos/private/secret.jpg");
  });
});