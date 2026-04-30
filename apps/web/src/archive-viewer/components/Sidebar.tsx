import { h } from "preact";
import { useState } from "preact/hooks";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { dateSpan } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  activePersonId: string | null;
  onNavigate: (route: Route) => void;
  className: string;
  onCloseSidebar: () => void;
};

export function Sidebar({ manifest, activePersonId, onNavigate, className, onCloseSidebar }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? manifest.people.filter((p) =>
        p.displayName.toLowerCase().includes(query.toLowerCase()) ||
        p.alsoKnownAs.some((a) => a.toLowerCase().includes(query.toLowerCase())),
      )
    : manifest.people;

  const sorted = [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName));

  return (
    <nav class={className}>
      <div class="sidebar-search">
        <input
          type="text"
          placeholder="Search people\u2026"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              onNavigate({ view: "search", query: query.trim() });
              onCloseSidebar();
            }
          }}
        />
      </div>

      <div class="sidebar-heading">People ({manifest.people.length})</div>
      <div id="person-list">
        {sorted.map((p) => (
          <PersonButton
            key={p.id}
            person={p}
            manifest={manifest}
            active={p.id === activePersonId}
            onClick={() => {
              onNavigate({ view: "person", personId: p.id });
              onCloseSidebar();
            }}
          />
        ))}
        {sorted.length === 0 && <p class="empty" style="padding:12px 16px;">No matches</p>}
      </div>
    </nav>
  );
}

function PersonButton({
  person,
  manifest,
  active,
  onClick,
}: {
  person: { id: string; displayName: string; birthDateText: string | null; deathDateText: string | null; portraitMediaId: string | null };
  manifest: ArchiveExportManifest;
  active: boolean;
  onClick: () => void;
}) {
  const mediaUrl = person.portraitMediaId
    ? manifest.media.find((m) => m.id === person.portraitMediaId)?.localPath ?? null
    : null;
  const ds = dateSpan(person.birthDateText, person.deathDateText);

  return (
    <button class={`person-btn${active ? " active" : ""}`} onClick={onClick}>
      <span class="avatar">
        {mediaUrl ? (
          <img src={mediaUrl} alt="" onError={(e) => {(e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.textContent = person.displayName.charAt(0);}} />
        ) : (
          person.displayName.charAt(0)
        )}
      </span>
      <span class="info">
        <div class="name">{person.displayName}</div>
        {ds && <div class="dates">{ds}</div>}
      </span>
    </button>
  );
}