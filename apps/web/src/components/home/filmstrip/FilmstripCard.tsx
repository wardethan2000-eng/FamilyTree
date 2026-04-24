"use client";

import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";

export function FilmstripCard({
  memory,
  href,
  width,
  index,
}: {
  memory: TreeHomeMemory;
  href: string;
  width: number;
  index: number;
}) {
  const mediaUrl = memory.mediaUrl ? getProxiedMediaUrl(memory.mediaUrl) : null;
  const isPhoto = memory.kind === "photo" && mediaUrl;
  const isVoice = memory.kind === "voice";
  const isDoc = memory.kind === "document" && mediaUrl;

  const cardHeight = isPhoto ? "65vh" : isVoice ? "40vh" : "50vh";

  return (
    <a
      href={href}
      style={{
        width,
        flexShrink: 0,
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Date label */}
      {memory.dateOfEventText && (
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(176,139,62,0.45)",
            marginBottom: 10,
          }}
        >
          {memory.dateOfEventText}
        </div>
      )}

      {/* Card body */}
      <div
        style={{
          width: "100%",
          height: cardHeight,
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
          background: isVoice
            ? "radial-gradient(ellipse at 50% 50%, rgba(78,93,66,0.18), transparent 65%), var(--ink)"
            : isPhoto || isDoc
              ? "#1a1815"
              : "var(--paper)",
          border: !isPhoto && !isVoice ? "1px solid var(--rule)" : undefined,
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        {isPhoto && mediaUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={memory.title}
              onError={handleMediaError}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(8%) brightness(0.65)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, transparent 50%, rgba(15,13,10,0.70) 100%)",
              }}
            />
          </>
        )}

        {isDoc && mediaUrl && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--paper-deep)",
              padding: 16,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={memory.title}
              onError={handleMediaError}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        )}

        {isVoice && (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(246,241,231,0.08)",
                border: "1px solid rgba(246,241,231,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: "voiceRing 2s ease-out infinite",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  color: "rgba(246,241,231,0.70)",
                }}
              >
                ◉
              </span>
            </div>
          </div>
        )}

        {memory.kind === "story" && (
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "20px 22px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--ink-faded)",
                marginBottom: 8,
              }}
            >
              Story
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--ink-soft)",
                display: "-webkit-box",
                WebkitLineClamp: 6,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {memory.body?.trim() ?? memory.title}
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      <div style={{ marginTop: 10 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            lineHeight: 1.15,
            color: isPhoto || isVoice ? "rgba(246,241,231,0.88)" : "var(--ink)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {memory.title}
        </div>
        {memory.personName && (
          <div
            style={{
              marginTop: 4,
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: isPhoto || isVoice ? "rgba(246,241,231,0.45)" : "var(--ink-faded)",
            }}
          >
            {memory.personName}
          </div>
        )}
      </div>
    </a>
  );
}