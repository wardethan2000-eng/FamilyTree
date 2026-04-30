import { h } from "preact";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getMemory, getPerson, getPlace, getMediaUrl, getMediaType, getPerspectivesForMemory, getRelatedMemories } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  memoryId: string;
  onNavigate: (route: Route) => void;
};

export function MemoryDetail({ manifest, memoryId, onNavigate }: Props) {
  const memory = getMemory(manifest, memoryId);
  if (!memory) return null;

  const primaryPerson = getPerson(manifest, memory.primaryPersonId);
  const taggedPeople = memory.taggedPersonIds
    .map((id) => getPerson(manifest, id))
    .filter(Boolean);
  const perspectives = getPerspectivesForMemory(manifest, memoryId);
  const relatedMemories = getRelatedMemories(manifest, memoryId);
  const place = memory.placeId ? getPlace(manifest, memory.placeId) : null;

  const mediaItems = memory.mediaIds
    .map((id) => ({ id, url: getMediaUrl(manifest, id), type: getMediaType(manifest, id) }))
    .filter((item): item is { id: string; url: string; type: "image" | "video" | "audio" | "unknown" } => item.url !== null);

  const images = mediaItems.filter((m) => m.type === "image");
  const videos = mediaItems.filter((m) => m.type === "video");
  const audios = mediaItems.filter((m) => m.type === "audio");

  const close = () => {
    if (primaryPerson) {
      onNavigate({ view: "person", personId: primaryPerson.id });
    } else {
      onNavigate({ view: "home" });
    }
  };

  return (
    <div class="detail-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="detail-panel">
        <button class="detail-close" onClick={close}>&times;</button>

        {videos.length > 0 && (
          <div class="media-gallery">
            {videos.map((v, i) => (
              <video key={i} controls preload="metadata" style="width:100%;max-height:400px;border-radius:4px;">
                <source src={v.url} />
                Your browser does not support video playback.
              </video>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div class="media-gallery">
            {images.map((img, i) => (
              <img key={i} src={img.url} alt={memory.title} onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}} />
            ))}
          </div>
        )}

        {audios.length > 0 && audios.map((a, i) => (
          <audio key={i} class="audio-player" controls src={a.url}>
            Your browser does not support audio playback.
          </audio>
        ))}

        <h2 style="margin:0 0 4px; font-size:24px; font-weight:400;">{memory.title}</h2>

        {memory.dateOfEventText && (
          <div style="font-size:13px; color:var(--ink-faded); font-family:sans-serif; margin-bottom:4px;">
            {memory.dateOfEventText}
          </div>
        )}

        {(memory.placeLabel || place) && (
          <div style="font-size:12px; color:var(--ink-faded); font-family:sans-serif; margin-bottom:8px;">
            {(memory.placeLabel || place?.label)}
            {place?.locality && `, ${place.locality}`}
            {place?.adminRegion && `, ${place.adminRegion}`}
            {place?.countryCode && ` ${place.countryCode}`}
          </div>
        )}

        {primaryPerson && (
          <button class="chip" onClick={() => onNavigate({ view: "person", personId: primaryPerson.id })}>
            {primaryPerson.displayName}
          </button>
        )}

        {memory.body && (
          <div style="font-size:15px; line-height:1.8; margin-top:16px; white-space:pre-wrap;">
            {memory.body}
          </div>
        )}

        {memory.transcriptText && (
          <div class="m-transcript" style="margin-top:16px;">
            <div class="section-heading" style="margin-top:0;">Transcript</div>
            {memory.transcriptText}
          </div>
        )}

        {perspectives.length > 0 && (
          <>
            <div class="section-heading">Perspectives ({perspectives.length})</div>
            {perspectives.map((p) => {
              const perspMediaType = p.mediaId ? getMediaType(manifest, p.mediaId) : null;
              const perspMediaUrl = p.mediaId ? getMediaUrl(manifest, p.mediaId) : null;
              return (
                <div key={p.id} style="margin-bottom:12px; padding:12px; background:var(--paper-deep); border:1px solid var(--rule); border-radius:4px;">
                  {p.body && <div style="font-size:14px; line-height:1.7; white-space:pre-wrap;">{p.body}</div>}
                  {perspMediaUrl && perspMediaType === "image" && (
                    <img
                      src={perspMediaUrl}
                      alt=""
                      style="max-width:100%; border-radius:4px; margin-top:8px;"
                      onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}}
                    />
                  )}
                  {perspMediaUrl && perspMediaType === "video" && (
                    <video controls preload="metadata" style="max-width:100%; border-radius:4px; margin-top:8px;">
                      <source src={perspMediaUrl} />
                    </video>
                  )}
                  {perspMediaUrl && perspMediaType === "audio" && (
                    <audio controls src={perspMediaUrl} style="width:100%; margin-top:8px;" />
                  )}
                  {p.contributorName && (
                    <div style="margin-top:6px; font-size:12px; color:var(--ink-faded); font-family:sans-serif;">
                      Shared by {p.contributorName}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {memory.captionOverride && (
          <div style="margin-top:12px; font-style:italic; color:var(--ink-soft); font-size:13px;">
            {memory.captionOverride}
          </div>
        )}

        {taggedPeople.length > 0 && (
          <>
            <div class="section-heading">People in this memory</div>
            <div class="tagged-people">
              {taggedPeople.map((p) =>
                p ? (
                  <button key={p.id} class="chip" onClick={() => onNavigate({ view: "person", personId: p.id })}>
                    {p.displayName}
                  </button>
                ) : null,
              )}
            </div>
          </>
        )}

        {relatedMemories.length > 0 && (
          <>
            <div class="section-heading">Related memories</div>
            {relatedMemories.map((rm) => (
              <div
                key={rm.id}
                class="memory-card"
                onClick={() => onNavigate({ view: "memory", memoryId: rm.id })}
              >
                <div class="m-title">{rm.title}</div>
                {rm.dateOfEventText && <div class="m-date">{rm.dateOfEventText}</div>}
              </div>
            ))}
          </>
        )}

        {memory.contributorName && (
          <div style="margin-top:16px; font-size:12px; color:var(--ink-faded); font-family:sans-serif;">
            Contributed by {memory.contributorName}
          </div>
        )}
      </div>
    </div>
  );
}