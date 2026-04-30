import { h } from "preact";
import { useState } from "preact/hooks";
import { useHashRouter, type Route } from "./hooks/useHashRouter.js";
import type { ArchiveExportManifest } from "./types.js";
import { Home } from "./components/Home.js";
import { PersonPage } from "./components/PersonPage.js";
import { MemoryDetail } from "./components/MemoryDetail.js";
import { DriftMode } from "./components/DriftMode.js";
import { SearchPage } from "./components/SearchPage.js";
import { SectionView } from "./components/SectionView.js";
import { Sidebar } from "./components/Sidebar.js";

declare global {
  interface Window {
    ARCHIVE_DATA: ArchiveExportManifest;
  }
}

function getPrimaryPersonIdForMemory(manifest: ArchiveExportManifest, memoryId: string): string | null {
  const m = manifest.memories.find((mem) => mem.id === memoryId);
  return m?.primaryPersonId ?? null;
}

export function App() {
  const manifest = window.ARCHIVE_DATA;
  const { route, navigate } = useHashRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const personId =
    route.view === "person"
      ? route.personId
      : route.view === "memory"
        ? getPrimaryPersonIdForMemory(manifest, route.memoryId)
        : route.view === "section"
          ? null
          : null;
  const showSidebar = route.view !== "drift";

  return (
    <div>
      {route.view === "drift" ? null : (
        <header>
          <button class="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            &#9776;
          </button>
          <h1>{manifest.tree.name}</h1>
          <span class="meta">Offline archive</span>
          <button class="chip" onClick={() => navigate({ view: "drift" })}>
            Drift
          </button>
        </header>
      )}

      {route.view === "drift" ? (
        <DriftMode manifest={manifest} onClose={() => navigate({ view: "home" })} />
      ) : (
        <div class="layout">
          {showSidebar && (
            <Sidebar
              manifest={manifest}
              activePersonId={personId}
              onNavigate={navigate}
              className={sidebarOpen ? "sidebar open" : "sidebar"}
              onCloseSidebar={() => setSidebarOpen(false)}
            />
          )}
          <main class="main">
            {route.view === "home" && <Home manifest={manifest} onNavigate={navigate} />}
            {route.view === "person" && (
              <PersonPage manifest={manifest} personId={route.personId} onNavigate={navigate} />
            )}
            {route.view === "section" && (
              <SectionView manifest={manifest} sectionId={route.sectionId} onNavigate={navigate} />
            )}
            {route.view === "search" && (
              <SearchPage manifest={manifest} query={route.query} onNavigate={navigate} />
            )}
          </main>
        </div>
      )}

      {route.view === "memory" && (
        <MemoryDetail manifest={manifest} memoryId={route.memoryId} onNavigate={navigate} />
      )}
    </div>
  );
}