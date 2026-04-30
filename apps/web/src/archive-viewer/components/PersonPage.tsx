import { h } from "preact";
import type { ArchiveExportManifest, ExportPlace } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getPerson, getMemoriesForPerson, getRelationshipsForPerson, relationshipLabel, getMediaUrl, getMediaType, dateSpan, isFeaturedMemory } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  personId: string;
  onNavigate: (route: Route) => void;
};

export function PersonPage({ manifest, personId, onNavigate }: Props) {
  const person = getPerson(manifest, personId);
  if (!person) return <p class="empty">Person not found.</p>;

  const memories = getMemoriesForPerson(manifest, personId);
  const rels = getRelationshipsForPerson(manifest, personId);
  const portraitUrl = getMediaUrl(manifest, person.portraitMediaId);
  const ds = dateSpan(person.birthDateText, person.deathDateText);

  const placeIds = new Set<string>();
  const placeLabels = new Map<string, string>();
  for (const m of memories) {
    if (m.placeId) {
      placeIds.add(m.placeId);
    }
    if (m.placeLabel && m.placeId) {
      placeLabels.set(m.placeId, m.placeLabel);
    }
  }
  const personPlaces = (manifest.places ?? []).filter((p) => placeIds.has(p.id));

  return (
    <div class="fade-in">
      <div class="person-header">
        {portraitUrl && (
          <img
            class="person-portrait"
            src={portraitUrl}
            alt={person.displayName}
            onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}}
          />
        )}
        <h2>{person.displayName}</h2>
        {ds && <div class="dates">{ds}</div>}
        {person.essenceLine && <div class="essence">{person.essenceLine}</div>}
        {person.alsoKnownAs.length > 0 && (
          <div style="margin-top:6px; font-size:12px; color:var(--ink-faded); font-family:sans-serif;">
            Also known as: {person.alsoKnownAs.join(", ")}
          </div>
        )}
      </div>

      {rels.length > 0 && (
        <>
          <div class="section-heading">Connections</div>
          <div>
            {rels.map((r) => {
              const otherId = r.fromPersonId === personId ? r.toPersonId : r.fromPersonId;
              const other = getPerson(manifest, otherId);
              if (!other) return null;
              return (
                <button
                  key={r.id}
                  class="chip"
                  onClick={() => onNavigate({ view: "person", personId: otherId })}
                >
                  {relationshipLabel(r.type, r.fromPersonId, r.toPersonId, personId)} · {other.displayName}
                </button>
              );
            })}
          </div>
        </>
      )}

      {personPlaces.length > 0 && (
        <>
          <div class="section-heading">Places</div>
          <div>
            {personPlaces.map((p) => (
              <span key={p.id} class="chip" style="cursor:default;">
                {placeLabels.get(p.id) || p.label}
                {p.locality && <span style="opacity:0.6;">, {p.locality}</span>}
              </span>
            ))}
          </div>
        </>
      )}

      <div class="section-heading">Memories ({memories.length})</div>
      {memories.length === 0 ? (
        <p class="empty">No memories recorded yet.</p>
      ) : (
        memories.map((m) => (
          <MemoryCard key={m.id} manifest={manifest} memory={m} personId={personId} onNavigate={onNavigate} />
        ))
      )}
    </div>
  );
}

function MemoryCard({
  manifest,
  memory,
  personId,
  onNavigate,
}: {
  manifest: ArchiveExportManifest;
  memory: { id: string; title: string; dateOfEventText: string | null; body: string | null; kind: string; mediaIds: string[]; placeLabel: string | null };
  personId: string;
  onNavigate: (route: Route) => void;
}) {
  const mediaItems = memory.mediaIds
    .map((id) => ({ id, url: getMediaUrl(manifest, id), type: getMediaType(manifest, id) }))
    .filter((item): item is { id: string; url: string; type: "image" | "video" | "audio" | "unknown" } => item.url !== null);
  const imageUrls = mediaItems.filter((m) => m.type === "image").map((m) => m.url);
  const hasVideo = mediaItems.some((m) => m.type === "video");
  const hasAudio = mediaItems.some((m) => m.type === "audio");
  const featured = isFeaturedMemory(manifest, personId, memory.id);
  const kindIcons: Record<string, string> = { story: "\uD83D\uDCDD", photo: "\uD83D\uDCF7", voice: "\uD83C\uDFA4", document: "\uD83D\uDCC4" };

  return (
    <div class="memory-card" onClick={() => onNavigate({ view: "memory", memoryId: memory.id })}>
      {imageUrls.length > 0 && (
        <div class="media-grid">
          {imageUrls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}} />
          ))}
          {imageUrls.length > 4 && <div style="font-size:12px;color:var(--ink-faded);font-family:sans-serif;align-self:center;">+{imageUrls.length - 4} more</div>}
        </div>
      )}
      <div class="m-title">
        {featured && "\u2605 "}
        {kindIcons[memory.kind] ? `${kindIcons[memory.kind]} ` : ""}
        {memory.title}
        {hasVideo && " \uD83C\uDFA5"}
        {hasAudio && " \uD83C\uDFA7"}
      </div>
      {memory.dateOfEventText && <div class="m-date">{memory.dateOfEventText}</div>}
      {memory.placeLabel && <div class="m-place">{memory.placeLabel}</div>}
    </div>
  );
}