"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { handleMediaError } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";

export interface CellSpan {
  colSpan: number;
  rowSpan: number;
}

export function GalleryCell({
  memory,
  kind,
  span,
  mediaUrl,
  index,
  onClick,
}: {
  memory: TreeHomeMemory;
  kind: string;
  span: CellSpan;
  mediaUrl: string | null;
  index: number;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  const isPhoto = kind === "hero" || kind === "landscape" || kind === "portrait" || (kind === "standard" && mediaUrl);
  const isVoice = kind === "voice";
  const isStory = kind === "story";

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.6, delay: index * 0.04, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={onClick}
      style={{
        gridColumn: `span ${span.colSpan}`,
        gridRow: `span ${span.rowSpan}`,
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        background: isVoice
          ? "radial-gradient(ellipse at 50% 50%, rgba(78,93,66,0.18), transparent 65%), var(--ink)"
          : isStory
            ? "var(--paper)"
            : "#1a1815",
        border: isStory ? "1px solid var(--rule)" : undefined,
        transition: "box-shadow 200ms ease",
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
              filter: "sepia(8%) brightness(0.62)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 40%, rgba(15,13,10,0.75) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: span.colSpan > 1 ? 20 : 15,
                lineHeight: 1.15,
                color: "rgba(246,241,231,0.92)",
              }}
            >
              {memory.title}
            </div>
            {memory.dateOfEventText && (
              <div
                style={{
                  marginTop: 3,
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  color: "rgba(246,241,231,0.40)",
                }}
              >
                {memory.dateOfEventText}
              </div>
            )}
          </div>
        </>
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
            gap: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
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
                fontSize: 14,
                color: "rgba(246,241,231,0.70)",
              }}
            >
              ◉
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 15,
              color: "rgba(246,241,231,0.85)",
              textAlign: "center",
              lineHeight: 1.2,
              padding: "0 10px",
            }}
          >
            {memory.title}
          </div>
        </div>
      )}

      {isStory && (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: 14,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.10em",
              color: "var(--ink-faded)",
              marginBottom: 6,
            }}
          >
            Story
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              lineHeight: 1.15,
              color: "var(--ink)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {memory.title}
          </div>
        </div>
      )}
    </motion.div>
  );
}