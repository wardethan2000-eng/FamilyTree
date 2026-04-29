import { h } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import type { ArchiveExportManifest, ExportMemory } from "../types.js";
import { getMediaUrl } from "../utils.js";

type Props = {
  manifest: ArchiveExportManifest;
  onClose: () => void;
};

const ADVANCE_MS = 25000;

export function DriftMode({ manifest, onClose }: Props) {
  const memories = manifest.memories.filter((m) => m.kind === "photo" || (m.kind === "story" && m.body));
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [imageVisible, setImageVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current: ExportMemory | undefined = memories[index];

  const advance = useCallback(() => {
    setImageVisible(false);
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % memories.length);
    }, 500);
  }, [memories.length]);

  const goBack = useCallback(() => {
    setImageVisible(false);
    setTimeout(() => {
      setIndex((prev) => (prev - 1 + memories.length) % memories.length);
    }, 500);
  }, [memories.length]);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(advance, ADVANCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, index, advance]);

  useEffect(() => {
    const t = setTimeout(() => setImageVisible(true), 100);
    return () => clearTimeout(t);
  }, [index]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") advance();
      if (e.key === "ArrowLeft") goBack();
      if (e.key === "p") setPlaying((p) => !p);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, advance, goBack]);

  if (!current) {
    return (
      <div class="drift-overlay">
        <div class="drift-content">
          <p style="color:var(--ink-faded); font-size:18px;">No memories available for drift mode.</p>
          <button class="chip" style="margin-top:16px; color:var(--paper); border-color:rgba(255,255,255,0.2);" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const primaryPerson = manifest.people.find((p) => p.id === current.primaryPersonId);
  const imageUrl = current.mediaIds.length > 0 ? getMediaUrl(manifest, current.mediaIds[0]) : null;

  return (
    <div class="drift-overlay">
      <div class="drift-content">
        {imageUrl && (
          <img
            class={`drift-image${imageVisible ? " visible" : ""}`}
            src={imageUrl}
            alt={current.title}
            onError={(e) => {(e.target as HTMLImageElement).style.display = "none";}}
          />
        )}
        {imageVisible && (
          <div style="animation: fadeIn 0.8s ease 0.5s both;">
            <div class="drift-title">{current.title}</div>
            {primaryPerson && <div class="drift-person">{primaryPerson.displayName}</div>}
            {current.dateOfEventText && <div class="drift-date">{current.dateOfEventText}</div>}
            {current.body && current.kind === "story" && (
              <div class="drift-body" style={{ maxHeight: "30vh", overflow: "hidden" }}>
                {current.body.slice(0, 600)}
                {current.body.length > 600 ? "\u2026" : ""}
              </div>
            )}
          </div>
        )}
      </div>
      <div class="drift-controls">
        <button onClick={goBack} title="Previous">&#8592;</button>
        <button onClick={() => setPlaying(!playing)} title={playing ? "Pause" : "Play"}>
          {playing ? "\u275A\u275A" : "\u25B6"}
        </button>
        <button onClick={advance} title="Next">&#8594;</button>
        <span class="progress-text">
          {index + 1} / {memories.length}
        </span>
        <button onClick={onClose} title="Close drift" style="margin-left:auto;">&#10005;</button>
      </div>
    </div>
  );
}