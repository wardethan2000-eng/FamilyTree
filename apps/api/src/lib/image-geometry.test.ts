import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { jpegDimensions, pngDimensions, imageDimensions } from "./image-geometry.js";

describe("jpegDimensions", () => {
  it("returns null for empty buffer", () => {
    assert.equal(jpegDimensions(Buffer.alloc(0)), null);
  });

  it("returns null for buffer too short", () => {
    assert.equal(jpegDimensions(Buffer.from([0xff, 0xd8])), null);
  });

  it("returns null for non-JPEG data", () => {
    assert.equal(jpegDimensions(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01])), null);
  });

  it("extracts dimensions from a minimal JPEG SOF0 marker", () => {
    // JPEG header: SOI (0xFFD8) + SOF0 marker
    const buf = Buffer.alloc(50);
    buf.writeUInt16BE(0xffd8, 0); // SOI
    buf.writeUInt16BE(0xffc0, 2); // SOF0 marker
    buf.writeUInt16BE(16, 4);     // segment length (including length field)
    buf.writeUInt8(8, 6);         // precision
    buf.writeUInt16BE(480, 7);    // height
    buf.writeUInt16BE(640, 9);    // width
    const result = jpegDimensions(buf);
    assert.deepEqual(result, { width: 640, height: 480 });
  });

  it("extracts dimensions from JPEG with preceding APP0 marker", () => {
    const buf = Buffer.alloc(80);
    let offset = 0;
    buf.writeUInt16BE(0xffd8, offset); offset += 2; // SOI
    // APP0 (JFIF) marker - skip over it
    buf.writeUInt16BE(0xffe0, offset); offset += 2;
    const app0Len = 16;
    buf.writeUInt16BE(app0Len, offset); offset += 2;
    Buffer.alloc(app0Len - 2).copy(buf, offset); offset += app0Len - 2;
    // SOF0 marker
    buf.writeUInt16BE(0xffc0, offset); offset += 2;
    buf.writeUInt16BE(11, offset); offset += 2; // segLen
    buf.writeUInt8(8, offset); offset += 1;
    buf.writeUInt16BE(300, offset); offset += 2; // height
    buf.writeUInt16BE(400, offset); offset += 2; // width
    const result = jpegDimensions(buf);
    assert.deepEqual(result, { width: 400, height: 300 });
  });

  it("returns null for zero dimensions", () => {
    const buf = Buffer.alloc(50);
    buf.writeUInt16BE(0xffd8, 0);
    buf.writeUInt16BE(0xffc0, 2);
    buf.writeUInt16BE(16, 4);
    buf.writeUInt8(8, 6);
    buf.writeUInt16BE(0, 7);    // height = 0
    buf.writeUInt16BE(0, 9);    // width = 0
    assert.equal(jpegDimensions(buf), null);
  });

  it("handles malformed segment length < 2 gracefully", () => {
    const buf = Buffer.alloc(20);
    buf.writeUInt16BE(0xffd8, 0); // SOI
    buf.writeUInt16BE(0xffe0, 2); // APP0 marker
    buf.writeUInt16BE(0, 4);      // segment length = 0 (invalid)
    // Should not infinite loop; return null
    assert.equal(jpegDimensions(buf), null);
  });

  it("stops at SOS marker", () => {
    const buf = Buffer.alloc(30);
    buf.writeUInt16BE(0xffd8, 0); // SOI
    buf.writeUInt16BE(0xffda, 2); // SOS marker - should end search
    // No SOF before SOS, should return null
    assert.equal(jpegDimensions(buf), null);
  });
});

describe("pngDimensions", () => {
  it("returns null for empty buffer", () => {
    assert.equal(pngDimensions(Buffer.alloc(0)), null);
  });

  it("returns null for buffer too short for PNG header", () => {
    assert.equal(pngDimensions(Buffer.from([0x89, 0x50])), null);
  });

  it("returns null for non-PNG data", () => {
    assert.equal(pngDimensions(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03])), null);
  });

  it("extracts dimensions from a valid PNG header", () => {
    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const buf = Buffer.alloc(24);
    PNG_SIG.copy(buf, 0);
    // IHDR chunk: width and height at bytes 16-23
    buf.writeUInt32BE(800, 16);  // width
    buf.writeUInt32BE(600, 20);  // height
    assert.deepEqual(pngDimensions(buf), { width: 800, height: 600 });
  });

  it("returns null for zero dimensions in PNG", () => {
    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const buf = Buffer.alloc(24);
    PNG_SIG.copy(buf, 0);
    buf.writeUInt32BE(0, 16);  // width = 0
    buf.writeUInt32BE(0, 20);  // height = 0
    assert.equal(pngDimensions(buf), null);
  });
});

describe("imageDimensions", () => {
  it("delegates to jpegDimensions for image/jpeg", () => {
    const buf = Buffer.alloc(50);
    buf.writeUInt16BE(0xffd8, 0);
    buf.writeUInt16BE(0xffc0, 2);
    buf.writeUInt16BE(16, 4);
    buf.writeUInt8(8, 6);
    buf.writeUInt16BE(100, 7);
    buf.writeUInt16BE(200, 9);
    assert.deepEqual(imageDimensions(buf, "image/jpeg"), { width: 200, height: 100 });
  });

  it("delegates to pngDimensions for image/png", () => {
    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const buf = Buffer.alloc(24);
    PNG_SIG.copy(buf, 0);
    buf.writeUInt32BE(640, 16);
    buf.writeUInt32BE(480, 20);
    assert.deepEqual(imageDimensions(buf, "image/png"), { width: 640, height: 480 });
  });

  it("returns null for unsupported MIME types", () => {
    assert.equal(imageDimensions(Buffer.alloc(0), "video/mp4"), null);
  });
});