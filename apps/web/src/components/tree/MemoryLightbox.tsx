"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import {
  MemoryVisibilityControl,
  type TreeVisibilityLevel,
} from "@/components/tree/MemoryVisibilityControl";
import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";

type MemoryKind = "story" | "photo" | "voice" | "document" | "other";

export interface LightboxMemory {
  id: string;
  kind: MemoryKind;
  title: string;
  body?: string | null;
  transcriptText?: string | null;
  transcriptLanguage?: string | null;
  transcriptStatus?: "none" | "queued" | "processing" | "completed" | "failed";
  transcriptError?: string | null;
  dateOfEventText?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  linkedMediaProvider?: "google_drive" | null;
  linkedMediaOpenUrl?: string | null;
  linkedMediaSourceUrl?: string | null;
  linkedMediaLabel?: string | null;
  treeVisibilityLevel?: TreeVisibilityLevel;
  treeVisibilityIsOverride?: boolean;
  memoryContext?: "direct" | "contextual";
  memoryReasonLabel?: string | null;
  surfaceSuppressed?: boolean;
}

interface MemoryLightboxProps {
  memories: LightboxMemory[];
  initialIndex: number;
  onClose: () => void;
  canManageTreeVisibility?: boolean;
  canSuppressFromSurface?: boolean;
  updatingTreeVisibilityId?: string | null;
  updatingSurfaceSuppressionId?: string | null;
  onSetTreeVisibility?: (
    memoryId: string,
    visibility: TreeVisibilityLevel | null,
  ) => void;
  onSetSurfaceSuppression?: (memoryId: string, suppressed: boolean) => void;
}

export function MemoryLightbox({
  memories,
  initialIndex,
  onClose,
  canManageTreeVisibility,
  canSuppressFromSurface,
  updatingTreeVisibilityId,
  updatingSurfaceSuppressionId,
  onSetTreeVisibility,
  onSetSurfaceSuppression,
}: MemoryLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const memory = memories[index];

  const prev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const next = useCallback(() => {
    setIndex((i) => (i < memories.length - 1 ? i + 1 : i));
  }, [memories.length]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  // Reset audio when index changes
  useEffect(() => {
    setPlaying(false);
    setShowSettings(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [index]);

  // Scroll filmstrip to keep active thumb in view
  useEffect(() => {
    const strip = filmstripRef.current;
    if (!strip) return;
    const thumb = strip.children[index] as HTMLElement | undefined;
    if (thumb) thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  if (!memory) return null;

  const mime = memory.mimeType?.toLowerCase() ?? "";
  const resolvedMediaUrl = getProxiedMediaUrl(memory.mediaUrl);
  const isPhoto = memory.kind === "photo" || mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isPdf = mime === "application/pdf";
  const isVoice = memory.kind === "voice" && !isVideo;
  const isStory = memory.kind === "story" || memory.kind === "document";
  const transcriptText =
    memory.transcriptStatus === "completed" ? memory.transcriptText?.trim() : null;
  const canManageSurfaceVisibility =
    Boolean(canManageTreeVisibility && onSetTreeVisibility) ||
    Boolean(
      canSuppressFromSurface &&
        onSetSurfaceSuppression &&
        memory.memoryContext === "contextual",
    );

  const toggleAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => null);
      setPlaying(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(28, 25, 21, 0.96)",
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
      }}
      onClick={onClose}
    >
      {/* Top bar: close + title */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "16px 24px",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(246,241,231,0.5)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            cursor: "pointer",
            padding: 0,
            letterSpacing: "0.02em",
          }}
        >
          × Close
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              color: "rgba(246,241,231,0.85)",
            }}
          >
            {memory.title}
          </span>
          {memory.dateOfEventText && (
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "rgba(246,241,231,0.4)",
                marginLeft: 10,
              }}
            >
              {memory.dateOfEventText}
            </span>
          )}
          {memory.linkedMediaOpenUrl && (
            <div style={{ marginTop: 6 }}>
              <a
                href={memory.linkedMediaOpenUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "rgba(246,241,231,0.55)",
                  textDecoration: "none",
                }}
              >
                Open in Google Drive
              </a>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          {canManageSurfaceVisibility && (
            <button
              type="button"
              onClick={() => setShowSettings((current) => !current)}
              style={{
                border: "1px solid rgba(246,241,231,0.16)",
                background: showSettings ? "rgba(246,241,231,0.14)" : "rgba(246,241,231,0.06)",
                borderRadius: 999,
                color: "rgba(246,241,231,0.8)",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                letterSpacing: "0.08em",
                padding: "7px 12px",
                textTransform: "uppercase",
              }}
            >
              Memory settings
            </button>
          )}
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "rgba(246,241,231,0.35)",
            }}
          >
            {index + 1} / {memories.length}
          </span>
          {showSettings && canManageSurfaceVisibility && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 10px)",
                right: 0,
                width: 280,
                borderRadius: 14,
                border: "1px solid rgba(246,241,231,0.14)",
                background: "rgba(28,25,21,0.94)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 10,
                    color: "rgba(246,241,231,0.42)",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                    textTransform: "uppercase",
                  }}
                >
                  Memory settings
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "rgba(246,241,231,0.64)",
                    lineHeight: 1.5,
                  }}
                >
                  These controls are only visible to people who can manage this memory in the tree.
                </div>
              </div>

              {canManageTreeVisibility && onSetTreeVisibility && (
                <div
                  style={{
                    paddingTop: 12,
                    borderTop: "1px solid rgba(246,241,231,0.1)",
                  }}
                >
                  <MemoryVisibilityControl
                    memory={memory}
                    disabled={updatingTreeVisibilityId === memory.id}
                    onChange={(visibility) => onSetTreeVisibility(memory.id, visibility)}
                  />
                </div>
              )}

              {canSuppressFromSurface &&
                onSetSurfaceSuppression &&
                memory.memoryContext === "contextual" && (
                  <div
                    style={{
                      paddingTop: 12,
                      borderTop: "1px solid rgba(246,241,231,0.1)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 11,
                        color: "rgba(246,241,231,0.55)",
                        lineHeight: 1.5,
                      }}
                    >
                      {memory.surfaceSuppressed
                        ? "This contextual memory is hidden from this chapter page."
                        : "This contextual memory currently appears on this chapter page."}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSetSurfaceSuppression(
                          memory.id,
                          !memory.surfaceSuppressed,
                        )
                      }
                      disabled={updatingSurfaceSuppressionId === memory.id}
                      style={{
                        border: "1px solid rgba(246,241,231,0.16)",
                        background: "rgba(246,241,231,0.06)",
                        borderRadius: 999,
                        color: "rgba(246,241,231,0.88)",
                        cursor:
                          updatingSurfaceSuppressionId === memory.id ? "default" : "pointer",
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        padding: "9px 12px",
                      }}
                    >
                      {updatingSurfaceSuppressionId === memory.id
                        ? memory.surfaceSuppressed
                          ? "Restoring…"
                          : "Hiding…"
                        : memory.surfaceSuppressed
                        ? "Restore to this page"
                        : "Hide from this page"}
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Prev arrow */}
        <NavArrow direction="left" disabled={index === 0} onClick={prev} />

        {/* Content */}
        {isPhoto && resolvedMediaUrl && (
          <img
            key={memory.id}
            src={resolvedMediaUrl}
            alt={memory.title}
            onError={handleMediaError}
            style={{
              maxWidth: "calc(100vw - 160px)",
              maxHeight: "calc(100vh - 220px)",
              objectFit: "contain",
              userSelect: "none",
              animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          />
        )}

        {isVideo && resolvedMediaUrl && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={memory.id}
            src={resolvedMediaUrl}
            controls
            style={{
              maxWidth: "calc(100vw - 160px)",
              maxHeight: "calc(100vh - 220px)",
              borderRadius: 6,
              animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          />
        )}

        {isPdf && resolvedMediaUrl && (
          <div
            key={memory.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          >
            <iframe
              src={resolvedMediaUrl}
              title={memory.title}
              style={{
                width: "min(760px, calc(100vw - 160px))",
                height: "calc(100vh - 280px)",
                border: "1px solid rgba(246,241,231,0.15)",
                borderRadius: 6,
                background: "#fff",
              }}
            />
            <a
              href={resolvedMediaUrl}
              download={memory.title}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "rgba(246,241,231,0.55)",
                textDecoration: "none",
              }}
            >
              ↓ Download PDF
            </a>
          </div>
        )}

        {isVoice && (
          <div
            key={memory.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 32,
              maxWidth: 520,
              padding: "0 24px",
              animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          >
            {/* Waveform visualizer */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
              {Array.from({ length: 40 }, (_, i) => {
                const height = 20 + Math.abs(Math.sin(i * 0.7) * 45) + Math.abs(Math.cos(i * 1.3) * 20);
                return (
                  <div
                    key={i}
                    style={{
                      width: 4,
                      height,
                      borderRadius: 2,
                      background: playing
                        ? i < (index / memories.length) * 40
                          ? "var(--moss)"
                          : "rgba(246,241,231,0.3)"
                        : "rgba(246,241,231,0.25)",
                      transition: "background var(--duration-focus)",
                      animation: playing ? `wavePulse ${0.6 + (i % 5) * 0.1}s ease-in-out infinite alternate` : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* Play button */}
            <button
              onClick={toggleAudio}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(246,241,231,0.1)",
                border: "1px solid rgba(246,241,231,0.25)",
                color: "rgba(246,241,231,0.9)",
                fontFamily: "var(--font-ui)",
                fontSize: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {playing ? "⏸" : "▶"}
            </button>

            {resolvedMediaUrl && (
              <audio
                ref={audioRef}
                src={resolvedMediaUrl}
                onEnded={() => setPlaying(false)}
              />
            )}

            {memory.body && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: "rgba(246,241,231,0.6)",
                  textAlign: "center",
                  fontStyle: "italic",
                  margin: 0,
                }}
              >
                {memory.body}
              </p>
            )}
            {memory.transcriptStatus && memory.transcriptStatus !== "none" && (
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 8,
                  border: "1px solid rgba(246,241,231,0.14)",
                  background: "rgba(246,241,231,0.05)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "rgba(246,241,231,0.45)",
                    marginBottom: 8,
                  }}
                >
                  Transcript
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    lineHeight: 1.85,
                    color: "rgba(246,241,231,0.7)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {memory.transcriptStatus === "completed"
                    ? transcriptText ?? "Transcript unavailable."
                    : memory.transcriptStatus === "failed"
                    ? memory.transcriptError ?? "Transcription failed."
                    : "Transcribing…"}
                </div>
                {memory.transcriptLanguage && transcriptText && (
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: "var(--font-ui)",
                      fontSize: 11,
                      color: "rgba(246,241,231,0.4)",
                    }}
                  >
                    Language: {memory.transcriptLanguage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(isStory || (!isPhoto && !isVideo && !isPdf && !isVoice)) && (
          <div
            key={memory.id}
            style={{
              maxWidth: 640,
              padding: "0 48px",
              animation: "fadeIn 300ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 400,
                color: "rgba(246,241,231,0.92)",
                margin: "0 0 20px",
                lineHeight: 1.3,
              }}
            >
              {memory.title}
            </h2>
            {memory.body && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 17,
                  lineHeight: 1.95,
                  color: "rgba(246,241,231,0.65)",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {memory.body}
              </p>
            )}
            {memory.linkedMediaOpenUrl && (
              <div style={{ marginTop: 18 }}>
                <a
                  href={memory.linkedMediaOpenUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: "rgba(246,241,231,0.55)",
                    textDecoration: "none",
                  }}
                >
                  Open in Google Drive
                </a>
              </div>
            )}
          </div>
        )}

        {/* Next arrow */}
        <NavArrow direction="right" disabled={index === memories.length - 1} onClick={next} />
      </div>

      {/* Filmstrip */}
      {memories.length > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          ref={filmstripRef}
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 24px",
            overflowX: "auto",
            flexShrink: 0,
            scrollbarWidth: "none",
            justifyContent: memories.length <= 8 ? "center" : "flex-start",
          }}
        >
          {memories.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setIndex(i)}
              style={{
                width: 52,
                height: 40,
                borderRadius: 3,
                overflow: "hidden",
                flexShrink: 0,
                border: i === index ? "1.5px solid rgba(246,241,231,0.6)" : "1.5px solid transparent",
                padding: 0,
                cursor: "pointer",
                background:
                  m.kind === "photo" && m.mediaUrl
                    ? "none"
                    : "rgba(246,241,231,0.08)",
                transition: "border-color var(--duration-micro)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {m.kind === "photo" && getProxiedMediaUrl(m.mediaUrl) ? (
                <img
                  src={getProxiedMediaUrl(m.mediaUrl) ?? undefined}
                  alt={m.title}
                  onError={handleMediaError}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 16, opacity: 0.5 }}>
                  {m.kind === "voice" ? "🎙" : m.kind === "story" ? "✦" : "◻"}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavArrow({
  direction,
  disabled,
  onClick,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "absolute",
        [direction]: 16,
        top: "50%",
        transform: "translateY(-50%)",
        background: "rgba(246,241,231,0.06)",
        border: "1px solid rgba(246,241,231,0.1)",
        borderRadius: 4,
        width: 44,
        height: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        color: disabled ? "rgba(246,241,231,0.15)" : "rgba(246,241,231,0.7)",
        fontFamily: "var(--font-ui)",
        fontSize: 18,
        transition: "background var(--duration-micro)",
        zIndex: 5,
      }}
    >
      {direction === "left" ? "←" : "→"}
    </button>
  );
}
