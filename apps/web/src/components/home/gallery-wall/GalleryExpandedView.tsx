"use client";

import { motion } from "framer-motion";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";
import { isVideoMemory } from "../homeUtils";

export function GalleryExpandedView({
  memory,
  onClose,
  href,
}: {
  memory: TreeHomeMemory;
  onClose: () => void;
  onPersonClick: (personId: string) => void;
  href: string;
}) {
  const mediaUrl = memory.mediaUrl ? getProxiedMediaUrl(memory.mediaUrl) : null;
  const isVideo = isVideoMemory(memory);
  const usesMedia = Boolean(mediaUrl && (memory.kind === "photo" || memory.kind === "document"));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,13,10,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          maxWidth: usesMedia ? "100%" : 700,
          width: "100%",
          maxHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "default",
          padding: "clamp(20px, 4vw, 48px)",
        }}
      >
        {usesMedia && mediaUrl && (
          <a href={href} style={{ display: "block", width: "100%", textAlign: "center" }}>
            {isVideo ? (
              <video
                src={mediaUrl}
                controls
                playsInline
                autoPlay
                style={{
                  maxHeight: "78vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <img
                src={mediaUrl}
                alt={memory.title}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                style={{
                  maxHeight: "78vh",
                  maxWidth: "100%",
                  objectFit: "contain",
                  filter: memory.kind === "photo" ? "sepia(6%) brightness(0.72)" : undefined,
                }}
              />
            )}
          </a>
        )}

        <div
          style={{
            position: "absolute",
            bottom: "clamp(20px, 4vw, 48px)",
            left: "clamp(20px, 4vw, 48px)",
            right: "clamp(20px, 4vw, 48px)",
            background: "linear-gradient(180deg, transparent 0%, rgba(15,13,10,0.85) 30%)",
            padding: "28px 0 0",
            pointerEvents: "none",
          }}
        >
          <div style={{ maxWidth: 680, pointerEvents: "auto" }}>
            <div
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(246,241,231,0.40)",
                marginBottom: 8,
              }}
            >
              {isVideo ? "Video" : memory.kind === "photo" ? "Photo" : memory.kind === "voice" ? "Voice" : memory.kind === "document" ? "Document" : "Story"}
              {memory.dateOfEventText && ` · ${memory.dateOfEventText}`}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(22px, 3vw, 36px)",
                lineHeight: 1.12,
                color: "rgba(246,241,231,0.95)",
                maxWidth: "18ch",
              }}
            >
              {memory.title}
            </div>
            {memory.personName && (
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  color: "rgba(246,241,231,0.50)",
                }}
              >
                {memory.personName}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(246,241,231,0.08)",
            border: "1px solid rgba(246,241,231,0.16)",
            borderRadius: 999,
            color: "rgba(246,241,231,0.72)",
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            padding: "8px 14px",
            cursor: "pointer",
            zIndex: 10,
          }}
        >
          × Close
        </button>
      </motion.div>
    </motion.div>
  );
}