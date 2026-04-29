import { h } from "preact";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getPerson, getMemoriesForPerson, getRelationshipsForPerson, relationshipLabel, getMediaUrl, dateSpan, isFeaturedMemory } from "../utils.js";

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
  const mediaUrls = memory.mediaIds
    .map((id) => getMediaUrl(manifest, id))
    .filter(Boolean);
  const featured = isFeaturedMemory(manifest, personId, memory.id);

  return (
    <div class="memory-card" onClick={() => onNavigate({ view: "memory", memoryId: memory.id })}>
      {mediaUrls.length > 0 && (
        <div class="media-grid">
          {mediaUrls.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}} />
          ))}
          {mediaUrls.length > 4 && <div style="font-size:12px;color:var(--ink-faded);font-family:sans-serif;align-self:center;">+{mediaUrls.length - 4} more</div>}
        </div>
      )}
      <div class="m-title">{featured && "\u2605 "}{memory.title}</div>
      {memory.dateOfEventText && <div class="m-date">{memory.dateOfEventText}</div>}
      {memory.placeLabel && <div class="m-place">{memory.placeLabel}</div>}
    </div>
  );
}