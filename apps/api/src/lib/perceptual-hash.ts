import sharp from "sharp";

const DHASH_SIZE = 9;

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    distance += popcount(xor);
  }
  return distance;
}

function popcount(n: number): number {
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

export async function computeDHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(buffer)
      .grayscale()
      .resize(DHASH_SIZE, DHASH_SIZE - 1, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bits: number[] = [];
    for (let row = 0; row < info.height; row++) {
      for (let col = 0; col < info.width - 1; col++) {
        const left = data[row * info.width + col]!;
        const right = data[row * info.width + col + 1]!;
        bits.push(left > right ? 1 : 0);
      }
    }

    const hexChars: string[] = [];
    for (let i = 0; i < bits.length; i += 4) {
      let nibble = 0;
      for (let j = 0; j < 4 && i + j < bits.length; j++) {
        nibble = (nibble << 1) | bits[i + j]!;
      }
      hexChars.push(nibble.toString(16));
    }
    return hexChars.join("");
  } catch {
    return null;
  }
}