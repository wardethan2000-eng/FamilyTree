import { h } from "preact";
import type { ArchiveExportManifest, ExportSection } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getMemory, getPerson, getMediaUrl } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  sectionId: string;
  onNavigate: (route: Route) => void;
};

export function SectionView({ manifest, sectionId, onNavigate }: Props) {
  const section = manifest.sections.find((s) => s.id === sectionId);
  if (!section) return <p class="empty">Section not found.</p>;

  const sectionMemories = section.itemIds
    .map((id) => getMemory(manifest, id))
    .filter(Boolean);

  const sectionPeople = section.itemIds
    .filter((id) => !getMemory(manifest, id))
    .map((id) => getPerson(manifest, id))
    .filter(Boolean);

  return (
    <div class="fade-in">
      <h2 style="font-size:24px; font-weight:400; margin:0 0 8px;">{section.title}</h2>
      {section.body && (
        <div style="font-size:15px; line-height:1.7; color:var(--ink-soft); margin-bottom:20; white-space:pre-wrap;">
          {section.body}
        </div>
      )}

      {sectionPeople.length > 0 && (
        <>
          <div class="section-heading">People</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
            {sectionPeople.map((p) => (
              <button
                key={p.id}
                class="chip"
                onClick={() => onNavigate({ view: "person", personId: p.id })}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        </>
      )}

      {sectionMemories.length > 0 && (
        <>
          <div class="section-heading">Memories ({sectionMemories.length})</div>
          {sectionMemories.map((m) => {
            const mediaUrls = m.mediaIds.map((id) => getMediaUrl(manifest, id)).filter(Boolean) as string[];
            return (
              <div
                key={m.id}
                class="memory-card"
                onClick={() => onNavigate({ view: "memory", memoryId: m.id })}
              >
                {mediaUrls.length > 0 && (
                  <div class="media-grid">
                    {mediaUrls.slice(0, 4).map((url, i) => (
                      <img key={i} src={url} alt="" onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}} />
                    ))}
                  </div>
                )}
                <div class="m-title">{m.title}</div>
                {m.dateOfEventText && <div class="m-date">{m.dateOfEventText}</div>}
                {m.captionOverride && (
                  <div style="font-size:12px; font-style:italic; color:var(--ink-faded); margin-top:2px;">
                    {m.captionOverride}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {sectionPeople.length === 0 && sectionMemories.length === 0 && (
        <p class="empty">No items in this section.</p>
      )}
    </div>
  );
}