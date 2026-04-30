/* eslint-disable @next/next/no-img-element */
import type { ArchiveExportManifest, ExportMemory } from "../types.js";
import type { Route } from "../hooks/useHashRouter.js";
import { getMedia, getMediaUrl, getPerson, isImageMedia } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  onNavigate: (route: Route) => void;
};

export function StorybookMode({ manifest, onNavigate }: Props) {
  const sections = manifest.sections.length > 0
    ? manifest.sections
    : [{ id: "all", title: manifest.collection.name, body: manifest.collection.introText, itemIds: manifest.memories.map((m) => m.id) }];

  return (
    <div class="fade-in storybook-view">
      <div class="storybook-title">
        <h2>{manifest.collection.name}</h2>
        {manifest.collection.description && <p>{manifest.collection.description}</p>}
      </div>

      {sections.map((section) => {
        const memories = section.itemIds
          .map((id) => manifest.memories.find((memory) => memory.id === id))
          .filter(Boolean) as ExportMemory[];
        return (
          <section key={section.id} class="storybook-section">
            <div class="section-heading">{section.title}</div>
            {section.body && <p class="storybook-intro">{section.body}</p>}
            {memories.length === 0 ? (
              <p class="empty">No memories in this section.</p>
            ) : (
              memories.map((memory) => <StorybookMemory key={memory.id} manifest={manifest} memory={memory} onNavigate={onNavigate} />)
            )}
          </section>
        );
      })}
    </div>
  );
}

function StorybookMemory({
  manifest,
  memory,
  onNavigate,
}: {
  manifest: ArchiveExportManifest;
  memory: ExportMemory;
  onNavigate: (route: Route) => void;
}) {
  const person = getPerson(manifest, memory.primaryPersonId);
  const imageId = memory.mediaIds.find((id) => isImageMedia(getMedia(manifest, id)));
  const imageUrl = getMediaUrl(manifest, imageId);

  return (
    <article class="storybook-memory">
      {imageUrl && (
        <button class="storybook-image" onClick={() => onNavigate({ view: "memory", memoryId: memory.id })}>
          <img src={imageUrl} alt={memory.title} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </button>
      )}
      <div>
        <button class="storybook-memory-title" onClick={() => onNavigate({ view: "memory", memoryId: memory.id })}>
          {memory.title}
        </button>
        <div class="storybook-meta">
          {[person?.displayName, memory.dateOfEventText, memory.placeLabel].filter(Boolean).join(" · ")}
        </div>
        {memory.body && <p>{memory.body.length > 700 ? `${memory.body.slice(0, 700)}...` : memory.body}</p>}
        {memory.transcriptText && !memory.body && <p>{memory.transcriptText.length > 700 ? `${memory.transcriptText.slice(0, 700)}...` : memory.transcriptText}</p>}
      </div>
    </article>
  );
}
