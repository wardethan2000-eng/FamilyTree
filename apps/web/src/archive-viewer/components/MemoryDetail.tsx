import { h } from "preact";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getMemory, getPerson, getMediaUrl, getPerspectivesForMemory } from "../utils.js";

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
  const mediaUrls = memory.mediaIds
    .map((id) => getMediaUrl(manifest, id))
    .filter(Boolean) as string[];

  const hasAudio = mediaUrls.some((url) => url.match(/\.(mp3|wav|ogg|m4a|webm)$/i));
  const audioUrl = hasAudio ? mediaUrls.find((url) => url.match(/\.(mp3|wav|ogg|m4a|webm)$/i)) : null;
  const imageUrls = mediaUrls.filter((url) => !url.match(/\.(mp3|wav|ogg|m4a|webm)$/i));

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

        {imageUrls.length > 0 && (
          <div class="media-gallery">
            {imageUrls.map((url, i) => (
              <img key={i} src={url} alt={memory.title} onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}} />
            ))}
          </div>
        )}

        {audioUrl && (
          <audio class="audio-player" controls src={audioUrl}>
            Your browser does not support audio playback.
          </audio>
        )}

        <h2 style="margin:0 0 4px; font-size:24px; font-weight:400;">{memory.title}</h2>

        {memory.dateOfEventText && (
          <div style="font-size:13px; color:var(--ink-faded); font-family:sans-serif; margin-bottom:4px;">
            {memory.dateOfEventText}
          </div>
        )}

        {memory.placeLabel && (
          <div style="font-size:12px; color:var(--ink-faded); font-family:sans-serif; margin-bottom:8px;">
            {memory.placeLabel}
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
            {perspectives.map((p) => (
              <div key={p.id} style="margin-bottom:12px; padding:12px; background:var(--paper-deep); border:1px solid var(--rule); border-radius:4px;">
                {p.body && <div style="font-size:14px; line-height:1.7; white-space:pre-wrap;">{p.body}</div>}
                {p.mediaId && (
                  <img
                    src={getMediaUrl(manifest, p.mediaId) ?? ""}
                    alt=""
                    style="max-width:100%; border-radius:4px; margin-top:8px;"
                    onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}}
                  />
                )}
                {p.contributorName && (
                  <div style="margin-top:6px; font-size:12px; color:var(--ink-faded); font-family:sans-serif;">
                    Shared by {p.contributorName}
                  </div>
                )}
              </div>
            ))}
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

        {memory.contributorName && (
          <div style="margin-top:16px; font-size:12px; color:var(--ink-faded); font-family:sans-serif;">
            Contributed by {memory.contributorName}
          </div>
        )}
      </div>
    </div>
  );
}