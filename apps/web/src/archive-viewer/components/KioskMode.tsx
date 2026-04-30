/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { ArchiveExportManifest, ExportMemory } from "../types.js";
import { getMedia, getMediaUrl, getPerson, isImageMedia } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  onClose: () => void;
};

const ADVANCE_MS = 18000;

export function KioskMode({ manifest, onClose }: Props) {
  const slides = manifest.memories.filter((memory) => memory.mediaIds.some((id) => isImageMedia(getMedia(manifest, id))) || memory.body || memory.transcriptText);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = slides[index];
  const next = useCallback(() => setIndex((prev) => (prev + 1) % slides.length), [slides.length]);
  const previous = useCallback(() => setIndex((prev) => (prev - 1 + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (!playing || slides.length === 0) return;
    timerRef.current = setTimeout(next, ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, index, next, slides.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") previous();
      if (e.key === "p") setPlaying((value) => !value);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, onClose, previous]);

  if (!current) {
    return (
      <div class="kiosk-view">
        <p>No kiosk-ready memories are included in this archive.</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div class="kiosk-view">
      <KioskSlide manifest={manifest} memory={current} />
      <div class="kiosk-controls">
        <button onClick={previous} title="Previous">←</button>
        <button onClick={() => setPlaying(!playing)} title={playing ? "Pause" : "Play"}>{playing ? "Pause" : "Play"}</button>
        <button onClick={next} title="Next">→</button>
        <span>{index + 1} / {slides.length}</span>
        <button onClick={onClose} title="Close">Close</button>
      </div>
    </div>
  );
}

function KioskSlide({ manifest, memory }: { manifest: ArchiveExportManifest; memory: ExportMemory }) {
  const person = getPerson(manifest, memory.primaryPersonId);
  const imageId = memory.mediaIds.find((id) => isImageMedia(getMedia(manifest, id)));
  const imageUrl = getMediaUrl(manifest, imageId);
  const text = memory.body ?? memory.transcriptText ?? "";

  return (
    <section class="kiosk-slide">
      {imageUrl && (
        <div class="kiosk-image-wrap">
          <img src={imageUrl} alt={memory.title} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div class="kiosk-copy">
        <h2>{memory.title}</h2>
        <div class="kiosk-meta">
          {[person?.displayName, memory.dateOfEventText, memory.placeLabel].filter(Boolean).join(" · ")}
        </div>
        {text && <p>{text.length > 520 ? `${text.slice(0, 520)}...` : text}</p>}
      </div>
    </section>
  );
}
