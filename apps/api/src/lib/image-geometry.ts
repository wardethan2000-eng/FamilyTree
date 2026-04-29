export interface ImageDimensions {
  width: number;
  height: number;
}

export function jpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4) return null;
  if (buffer.readUInt16BE(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset < buffer.length - 1) {
    const marker = buffer.readUInt16BE(offset);
    if (marker === 0xffc0 || marker === 0xffc2) {
      if (offset + 9 > buffer.length) return null;
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }
    if ((marker & 0xff00) !== 0xff00) return null;
    if (marker === 0xffd9 || marker === 0xffda) return null;
    if (offset + 4 > buffer.length) return null;
    const segLen = buffer.readUInt16BE(offset + 2);
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }
  return null;
}

export function pngDimensions(buffer: Buffer): ImageDimensions | null {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIG)) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width > 0 && height > 0) return { width, height };
  return null;
}

export function imageDimensions(
  buffer: Buffer,
  mimeType: string,
): ImageDimensions | null {
  if (mimeType === "image/png") return pngDimensions(buffer);
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    mimeType.startsWith("image/jpeg")
  ) {
    return jpegDimensions(buffer);
  }
  return null;
}