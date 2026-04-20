export type LinkedMediaInput = {
  provider: "google_drive";
  url: string;
  label?: string | null;
};

export type NormalizedLinkedMedia = {
  provider: "google_drive";
  providerItemId: string;
  sourceUrl: string;
  openUrl: string;
  previewUrl: string;
  label: string | null;
};

function extractGoogleDriveFileId(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const idFromQuery = url.searchParams.get("id");
    if (idFromQuery) {
      return idFromQuery;
    }

    const pathMatch = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    const fileMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return fileMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

export function normalizeLinkedMedia(input: LinkedMediaInput): NormalizedLinkedMedia {
  if (input.provider !== "google_drive") {
    throw new Error("Only Google Drive linked media is supported right now.");
  }

  const providerItemId = extractGoogleDriveFileId(input.url);
  if (!providerItemId) {
    throw new Error(
      "This Google Drive link could not be parsed. Use a standard Drive share URL.",
    );
  }

  return {
    provider: "google_drive",
    providerItemId,
    sourceUrl: input.url,
    openUrl: input.url,
    previewUrl: `https://drive.google.com/thumbnail?id=${providerItemId}&sz=w1600`,
    label: input.label?.trim() || null,
  };
}
