import { h } from "preact";
import { useState, useMemo } from "preact/hooks";
import type { ArchiveExportManifest } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { searchManifest } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  query: string;
  onNavigate: (route: Route) => void;
};

export function SearchPage({ manifest, query, onNavigate }: Props) {
  const [inputValue, setInputValue] = useState(query);

  if (inputValue !== query && document.activeElement?.tagName !== "INPUT") {
    setInputValue(query);
  }

  const results = useMemo(() => searchManifest(manifest, query), [manifest, query]);

  return (
    <div class="fade-in">
      <h2 style="font-size:24px; font-weight:400; margin:0 0 16px;">Search</h2>
      <input
        type="text"
        value={inputValue}
        onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && inputValue.trim()) {
            onNavigate({ view: "search", query: inputValue.trim() });
          }
        }}
        placeholder="Search memories, people, places\u2026"
        style="width:100%; padding:12px 16px; border:1px solid var(--rule); border-radius:6px; font-size:15px; background:var(--paper-deep); color:var(--ink); outline:none; margin-bottom:24px;"
      />

      {query && (
        <>
          {results.people.length > 0 && (
            <>
              <div class="section-heading">People ({results.people.length})</div>
              {results.people.map((p) => (
                <div
                  key={p.id}
                  class="search-result-item"
                  onClick={() => onNavigate({ view: "person", personId: p.id })}
                >
                  <div class="sr-title" dangerouslySetInnerHTML={{ __html: highlight(p.displayName, query) }} />
                  {p.essenceLine && <div class="sr-sub" dangerouslySetInnerHTML={{ __html: highlight(p.essenceLine, query) }} />}
                </div>
              ))}
            </>
          )}

          {results.memories.length > 0 && (
            <>
              <div class="section-heading">Memories ({results.memories.length})</div>
              {results.memories.map((m) => (
                <div
                  key={m.id}
                  class="search-result-item"
                  onClick={() => onNavigate({ view: "memory", memoryId: m.id })}
                >
                  <div class="sr-title" dangerouslySetInnerHTML={{ __html: highlight(m.title, query) }} />
                  {m.dateOfEventText && <div class="sr-sub">{m.dateOfEventText}</div>}
                  {m.body && (
                    <div
                      class="sr-sub"
                      dangerouslySetInnerHTML={{ __html: highlight(m.body.slice(0, 120), query) + (m.body.length > 120 ? "\u2026" : "") }}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          {(results.places ?? []).length > 0 && (
            <>
              <div class="section-heading">Places ({results.places.length})</div>
              {(results.places ?? []).map((p: { id: string; label: string; locality?: string; adminRegion?: string }) => (
                <div key={p.id} class="search-result-item">
                  <div class="sr-title" dangerouslySetInnerHTML={{ __html: highlight(p.label, query) }} />
                  {(p.locality || p.adminRegion) && (
                    <div class="sr-sub">{[p.locality, p.adminRegion].filter(Boolean).join(", ")}</div>
                  )}
                </div>
              ))}
            </>
          )}

          {results.people.length === 0 && results.memories.length === 0 && (results.places ?? []).length === 0 && (
            <p class="empty">No results for "{query}"</p>
          )}
        </>
      )}
    </div>
  );
}

function highlight(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const regex = new RegExp(`(${escapeRegex(escapeHtml(query))})`, "gi");
  return escaped.replace(regex, "<mark>$1</mark>");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}