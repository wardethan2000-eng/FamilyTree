/* eslint-disable @next/next/no-img-element */
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getMedia, getMediaUrl, getPerson, isImageMedia } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  onNavigate: (route: Route) => void;
};

export function GalleryMode({ manifest, onNavigate }: Props) {
  const items = manifest.memories
    .flatMap((memory) =>
      memory.mediaIds
        .map((mediaId) => ({ memory, media: getMedia(manifest, mediaId), url: getMediaUrl(manifest, mediaId) }))
        .filter((item) => item.url && isImageMedia(item.media)),
    );

  return (
    <div class="fade-in gallery-view">
      <div class="view-heading">
        <h2>Gallery</h2>
        <p>{items.length} images from {manifest.collection.name}</p>
      </div>

      {items.length === 0 ? (
        <p class="empty">No image media is included in this archive.</p>
      ) : (
        <div class="gallery-grid">
          {items.map(({ memory, media, url }) => {
            const person = getPerson(manifest, memory.primaryPersonId);
            return (
              <button
                key={`${memory.id}-${media?.id ?? url}`}
                class="gallery-item"
                onClick={() => onNavigate({ view: "memory", memoryId: memory.id })}
              >
                <img src={url ?? ""} alt={memory.title} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span class="gallery-caption">
                  <span>{memory.captionOverride ?? memory.title}</span>
                  <small>{person?.displayName ?? memory.dateOfEventText ?? ""}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
