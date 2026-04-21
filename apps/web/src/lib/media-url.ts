"use client";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(
  /\/$/,
  "",
);

export function getProxiedMediaUrl(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null;

  const mediaPrefix = `${API_BASE}/api/media?`;
  if (mediaUrl.startsWith(mediaPrefix)) {
    return mediaUrl.slice(API_BASE.length);
  }

  return mediaUrl;
}
