import { h } from "preact";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "./../hooks/useHashRouter.js";
import { searchManifest } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  onNavigate: (route: Route) => void;
};

export function Home({ manifest, onNavigate }: Props) {
  const personCount = manifest.people.length;
  const memoryCount = manifest.memories.length;
  const recentMemories = [...manifest.memories]
    .filter((m) => m.dateOfEventText)
    .sort((a, b) => (b.dateOfEventText ?? "").localeCompare(a.dateOfEventText ?? ""))
    .slice(0, 5);

  return (
    <div class="welcome fade-in">
      <h2>{manifest.collection.name}</h2>
      <p>
        {personCount} {personCount === 1 ? "person" : "people"}, {memoryCount}{" "}
        {memoryCount === 1 ? "memory" : "memories"}.
      </p>
      {manifest.collection.introText && (
        <p style="margin-top:16px; font-style:italic;">{manifest.collection.introText}</p>
      )}
      {manifest.collection.dedicationText && (
        <p style="margin-top:8px; font-style:italic; color:var(--ink-faded);">Dedicated to {manifest.collection.dedicationText}</p>
      )}
      <p style="margin-top:24px;">Select a person from the sidebar to explore their memories and connections.</p>

      {recentMemories.length > 0 && (
        <div style="margin-top:40px;">
          <div class="section-heading">Recent Memories</div>
          {recentMemories.map((m) => (
            <div
              key={m.id}
              class="memory-card"
              onClick={() => onNavigate({ view: "memory", memoryId: m.id })}
            >
              <div class="m-title">{m.title}</div>
              {m.dateOfEventText && <div class="m-date">{m.dateOfEventText}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}