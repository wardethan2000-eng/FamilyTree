import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hammingDistance } from "./perceptual-hash.js";

describe("hammingDistance", () => {
  it("returns 0 for identical strings", () => {
    assert.equal(hammingDistance("0000000000000000", "0000000000000000"), 0);
  });

  it("returns 0 for identical hex hashes", () => {
    assert.equal(hammingDistance("a3f5c7e9b2d4f180", "a3f5c7e9b2d4f180"), 0);
  });

  it("returns 4 for a single hex digit difference from 0 to f", () => {
    assert.equal(hammingDistance("0", "f"), 4);
  });

  it("returns 1 for adjacent hex values 0 and 1", () => {
    assert.equal(hammingDistance("0", "1"), 1);
  });

  it("returns 2 for close hex values", () => {
    assert.equal(hammingDistance("0", "3"), 2);
  });

  it("returns Infinity for different length strings", () => {
    assert.equal(hammingDistance("abc", "abcd"), Infinity);
  });

  it("computes correct distance for multi-character hashes", () => {
    assert.equal(hammingDistance("0000", "ffff"), 16);
  });

  it("returns 8 for two hex digits off by f", () => {
    assert.equal(hammingDistance("00", "0f"), 4);
  });

  it("returns correct distance for typical phash comparison", () => {
    const hash1 = "1234567890abcdef";
    const hash2 = "1234567890abcddf";
    const dist = hammingDistance(hash1, hash2);
    assert.ok(dist <= 2, `Expected small hamming distance, got ${dist}`);
  });

  it("returns large distance for very different hashes", () => {
    const dist = hammingDistance("0000000000000000", "fffffffffffe0000");
    assert.ok(dist > 30, `Expected large hamming distance, got ${dist}`);
  });
});