"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ApiMemory, ApiMemoryMediaItem, ApiPerson } from "./treeTypes";
import { getProxiedMediaUrl } from "@/lib/media-url";

interface DriftItem {
  key: string;
  memory: ApiMemory;
  person: ApiPerson;
  media: ApiMemoryMediaItem | null;
  itemIndex: number;
  itemCount: number;
}

interface DriftModeProps {
  treeId: string;
  people: ApiPerson[];
  onClose: () => void;
  onPersonDetail: (personId: string) => void;
  apiBase: string;
}

const PHOTO_DURATION_MS = 6000;
const STORY_MIN_MS = 8000;
const STORY_MAX_MS = 45000;
const WORDS_PER_MINUTE = 200;
const MEDIA_MAX_MS = 60000;
const DEFAULT_MEDIA_FALLBACK_MS = 15000;
const DOCUMENT_CARD_MS = 8000;

type DetectedKind = "image" | "video" | "audio" | "link" | "text";

function detectItemKind(item: DriftItem): DetectedKind {
  const mime = item.media?.mimeType ?? "";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/") || (item.media?.mediaUrl && !mime)) return "image";
  if (item.media?.linkedMediaPreviewUrl || item.media?.linkedMediaOpenUrl) return "link";
  if (item.memory.kind === "voice") return "audio";
  return "text";
}

function readingTimeMs(text: string | null | undefined): number {
  if (!text) return STORY_MIN_MS;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const ms = Math.round((words / WORDS_PER_MINUTE) * 60_000);
  return Math.min(STORY_MAX_MS, Math.max(STORY_MIN_MS, ms));
}

function formatKindLabel(kind: DetectedKind, memory: ApiMemory): string {
  switch (kind) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "audio":
      return memory.kind === "voice" ? "Voice" : "Audio";
    case "link":
      return "Linked media";
    case "text":
    default:
      return memory.kind === "story" ? "Story" : "Memory";
  }
}

export function DriftMode({
  treeId,
  people,
  onClose,
  onPersonDetail,
  apiBase,
}: DriftModeProps) {
  const [items, setItems] = useState<DriftItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const byMemoryId = new Map<string, { memory: ApiMemory; person: ApiPerson }>();
      const peopleById = new Map(people.map((p) => [p.id, p]));
      await Promise.all(
        people.map(async (person) => {
          try {
            const res = await fetch(
              `${apiBase}/api/trees/${treeId}/people/${person.id}`,
              { credentials: "include" }
            );
            if (!res.ok) return;
            const data = await res.json();
            for (const memory of (data.memories ?? []) as ApiMemory[]) {
              if (byMemoryId.has(memory.id)) continue;
              const subject =
                peopleById.get(memory.primaryPersonId) ?? person;
              byMemoryId.set(memory.id, {
                memory: { ...memory, personId: subject.id },
                person: subject,
              });
            }
          } catch {
            // ignore individual failures
          }
        })
      );

      const memoryEntries = Array.from(byMemoryId.values());
      // Shuffle at memory granularity so multi-item memories stay together.
      for (let i = memoryEntries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [memoryEntries[i], memoryEntries[j]] = [
          memoryEntries[j]!,
          memoryEntries[i]!,
        ];
      }

      const flat: DriftItem[] = [];
      for (const { memory, person } of memoryEntries) {
        const mediaItems = (memory.mediaItems ?? []).filter(
          (item) => item.mediaUrl || item.linkedMediaPreviewUrl || item.linkedMediaOpenUrl,
        );
        if (mediaItems.length === 0) {
          // Text-only memory (story, etc.) — or a memory whose media failed to surface.
          flat.push({
            key: `${memory.id}:solo`,
            memory,
            person,
            media: null,
            itemIndex: 0,
            itemCount: 1,
          });
        } else {
          mediaItems.forEach((item, idx) => {
            flat.push({
              key: `${memory.id}:${item.id}`,
              memory,
              person,
              media: item,
              itemIndex: idx,
              itemCount: mediaItems.length,
            });
          });
        }
      }

      setItems(flat);
      setCurrentIndex(0);
      setIsLoading(false);
    };
    fetchAll();
  }, [treeId, people, apiBase]);

  const current = items[currentIndex] ?? null;
  const currentKind: DetectedKind | null = current ? detectItemKind(current) : null;

  const computedDurationMs = useMemo(() => {
    if (!current || !currentKind) return PHOTO_DURATION_MS;
    switch (currentKind) {
      case "image":
        return PHOTO_DURATION_MS;
      case "text":
        return readingTimeMs(current.memory.body ?? current.memory.transcriptText ?? "");
      case "link":
        return DOCUMENT_CARD_MS;
      case "video":
      case "audio":
        return MEDIA_MAX_MS;
      default:
        return PHOTO_DURATION_MS;
    }
  }, [current, currentKind]);

  const advance = useCallback(() => {
    setProgress(0);
    setCurrentIndex((i) => (items.length === 0 ? 0 : (i + 1) % items.length));
  }, [items.length]);

  const stepBack = useCallback(() => {
    setProgress(0);
    setCurrentIndex((i) =>
      items.length === 0 ? 0 : (i - 1 + items.length) % items.length
    );
  }, [items.length]);

  // Timer + progress for photo/text/link kinds (video/audio drive their own).
  useEffect(() => {
    if (!isPlaying || items.length === 0 || !currentKind) return;
    if (currentKind === "video" || currentKind === "audio") return;

    startedAtRef.current = Date.now();
    setProgress(0);

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setProgress(Math.min(100, (elapsed / computedDurationMs) * 100));
    }, 50);

    timerRef.current = setTimeout(advance, computedDurationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [isPlaying, currentIndex, currentKind, computedDurationMs, advance, items.length]);

  // Reset progress when switching items of any kind.
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  // Pause/resume media when isPlaying toggles
  useEffect(() => {
    if (currentKind === "video" && videoRef.current) {
      if (isPlaying) void videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
    if (currentKind === "audio" && audioRef.current) {
      if (isPlaying) void audioRef.current.play().catch(() => {});
      else audioRef.current.pause();
    }
  }, [isPlaying, currentKind, currentIndex]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") stepBack();
      if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [advance, stepBack, onClose]);

  const resolvedMediaUrl = getProxiedMediaUrl(current?.media?.mediaUrl ?? null);
  const resolvedLinkPreview = current?.media?.linkedMediaPreviewUrl ?? null;

  const bottomCaptionBody = useMemo(() => {
    if (!current) return null;
    if (currentKind === "audio") {
      const transcript = current.memory.transcriptText;
      if (transcript) return transcript;
    }
    return null;
  }, [current, currentKind]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "none",
          border: "none",
          color: "var(--ink-faded)",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          cursor: "pointer",
          zIndex: 10,
        }}
      >
        × Exit drift
      </button>

      {/* Kind chip + item N/M */}
      {current && !isLoading && currentKind && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "var(--ink-faded)",
            zIndex: 10,
          }}
        >
          {formatKindLabel(currentKind, current.memory)}
          {current.itemCount > 1
            ? ` · ${current.itemIndex + 1} / ${current.itemCount}`
            : ""}
          {current.memory.dateOfEventText
            ? ` · ${current.memory.dateOfEventText}`
            : ""}
        </div>
      )}

      {/* Autoplay toggle */}
      <button
        onClick={() => setIsPlaying((p) => !p)}
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          background: "none",
          border: "1px solid rgba(217,208,188,0.3)",
          borderRadius: 20,
          color: "var(--paper-deep)",
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          cursor: "pointer",
          padding: "5px 14px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isPlaying ? "var(--moss)" : "var(--ink-faded)",
            display: "inline-block",
          }}
        />
        {isPlaying ? "Playing" : "Paused"}
      </button>

      {/* Navigation zones */}
      <button
        onClick={stepBack}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "25%",
          height: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          zIndex: 5,
          color: "transparent",
        }}
        aria-label="Previous"
      >
        ←
      </button>
      <button
        onClick={advance}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "25%",
          height: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          zIndex: 5,
          color: "transparent",
        }}
        aria-label="Next"
      >
        →
      </button>

      {isLoading && (
        <div
          style={{
            width: 200,
            height: 20,
            borderRadius: 4,
            background: "rgba(246,241,231,0.1)",
            backgroundImage:
              "linear-gradient(90deg, rgba(246,241,231,0.05) 25%, rgba(246,241,231,0.15) 50%, rgba(246,241,231,0.05) 75%)",
            backgroundSize: "400px 100%",
            animation: "shimmer 1.5s infinite",
          }}
        />
      )}

      {!isLoading && items.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "var(--paper-deep)",
            fontFamily: "var(--font-body)",
            maxWidth: 480,
            padding: "0 40px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              marginBottom: 12,
            }}
          >
            Nothing to drift through yet.
          </div>
          <div style={{ fontSize: 15, color: "var(--ink-faded)" }}>
            Add photos, stories, or voice recordings to a person and they'll
            start showing up here.
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!isLoading && current && currentKind && (
          <motion.div
            key={current.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            style={{
              maxWidth: 860,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "0 40px",
              gap: 20,
            }}
          >
            {currentKind === "image" && resolvedMediaUrl && (
              <img
                src={resolvedMediaUrl}
                alt={current.memory.title}
                style={{
                  maxHeight: "62vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            )}

            {currentKind === "video" && resolvedMediaUrl && (
              <video
                ref={videoRef}
                src={resolvedMediaUrl}
                autoPlay
                playsInline
                controls={false}
                muted={false}
                onLoadedMetadata={() => {
                  startedAtRef.current = Date.now();
                }}
                onTimeUpdate={(e) => {
                  const el = e.currentTarget;
                  if (el.duration && Number.isFinite(el.duration)) {
                    setProgress(Math.min(100, (el.currentTime / el.duration) * 100));
                    if (el.currentTime * 1000 >= MEDIA_MAX_MS) {
                      advance();
                    }
                  }
                }}
                onEnded={advance}
                style={{
                  maxHeight: "62vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                  display: "block",
                  background: "black",
                }}
              />
            )}

            {currentKind === "audio" && resolvedMediaUrl && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle at 30% 30%, var(--moss), rgba(0,0,0,0.2))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--paper)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    animation: isPlaying
                      ? "driftPulse 2.4s ease-in-out infinite"
                      : "none",
                  }}
                >
                  Listening
                </div>
                <audio
                  ref={audioRef}
                  src={resolvedMediaUrl}
                  autoPlay
                  controls={false}
                  onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (el.duration && Number.isFinite(el.duration)) {
                      setProgress(
                        Math.min(100, (el.currentTime / el.duration) * 100),
                      );
                      if (el.currentTime * 1000 >= MEDIA_MAX_MS) {
                        advance();
                      }
                    }
                  }}
                  onEnded={advance}
                  onError={() => {
                    setTimeout(advance, DEFAULT_MEDIA_FALLBACK_MS);
                  }}
                />
                {bottomCaptionBody && (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 16,
                      color: "var(--paper-deep)",
                      lineHeight: 1.7,
                      maxWidth: "60ch",
                      textAlign: "center",
                      margin: 0,
                      maxHeight: "28vh",
                      overflow: "hidden",
                    }}
                  >
                    {bottomCaptionBody}
                  </p>
                )}
              </div>
            )}

            {currentKind === "link" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                {resolvedLinkPreview && (
                  <img
                    src={resolvedLinkPreview}
                    alt={current.memory.title}
                    style={{
                      maxHeight: "52vh",
                      maxWidth: "100%",
                      objectFit: "contain",
                      display: "block",
                      opacity: 0.95,
                    }}
                  />
                )}
                {current.media?.linkedMediaOpenUrl && (
                  <a
                    href={current.media.linkedMediaOpenUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "var(--paper-deep)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      textDecoration: "underline",
                    }}
                  >
                    {current.media.linkedMediaLabel || "Open in Drive ↗"}
                  </a>
                )}
              </div>
            )}

            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: currentKind === "text" ? 32 : 24,
                color: "var(--paper-deep)",
                textAlign: "center",
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {current.memory.title}
            </h2>

            {currentKind === "text" && (current.memory.body || current.memory.transcriptText) && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 17,
                  color: "var(--paper-deep)",
                  lineHeight: 1.8,
                  maxWidth: "60ch",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {current.memory.body || current.memory.transcriptText}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom attribution + person link */}
      {current && !isLoading && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: 40,
            right: 40,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--ink-faded)",
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                color: "var(--paper-deep)",
              }}
            >
              {current.person.name}
            </div>
            <div>
              {current.memory.title}
              {current.memory.dateOfEventText
                ? ` · ${current.memory.dateOfEventText}`
                : ""}
            </div>
          </div>

          <button
            onClick={() => onPersonDetail(current.person.id)}
            style={{
              background: "none",
              border: "none",
              color: "var(--paper-deep)",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Open {current.person.name}'s archive →
          </button>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: "rgba(217,208,188,0.15)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--moss)",
            transition: "width 50ms linear",
          }}
        />
      </div>

      <style jsx global>{`
        @keyframes driftPulse {
          0%, 100% { transform: scale(1); opacity: 0.92; }
          50% { transform: scale(1.06); opacity: 1; }
        }
      `}</style>
    </motion.div>
  );
}
