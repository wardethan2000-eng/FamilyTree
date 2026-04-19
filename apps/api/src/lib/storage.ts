import {
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MEDIA_BUCKET = process.env.MINIO_BUCKET ?? "familytree-media";

export const s3 = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT ?? "localhost"}:${process.env.MINIO_PORT ?? "9000"}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "familytree",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "familytree-dev-secret",
  },
  forcePathStyle: true, // required for MinIO
});

export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new CreateBucketCommand({ Bucket: MEDIA_BUCKET }));
  } catch (err) {
    const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name;
    if (code !== "BucketAlreadyOwnedByYou" && code !== "BucketAlreadyExists") {
      throw err;
    }
  }
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: MEDIA_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export function mediaUrl(objectKey: string): string {
  const apiBase = (process.env.API_BASE_URL ?? "http://localhost:4000").replace(
    /\/$/,
    "",
  );
  return `${apiBase}/api/media?key=${encodeURIComponent(objectKey)}`;
}
