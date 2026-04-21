"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ApiMemory, ApiPerson } from "./treeTypes";
import { getProxiedMediaUrl } from "@/lib/media-url";

interface MemoryOverlayProps {
  memory: ApiMemory | null;
  person: ApiPerson | null;
  allMemories: ApiMemory[];
  onClose: () => void;
  onPersonDetail: (personId: string) => void;
}

export function MemoryOverlay({
  memory,
  person,
  allMemories,
  onClose,
  onPersonDetail,
}: MemoryOverlayProps) {
  const isOpen = memory !== null;
  const resolvedMediaUrl = getProxiedMediaUrl(memory?.mediaUrl);

  return (
    <AnimatePresence>
      {isOpen && memory && person && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "var(--ink)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
            style={{
              maxWidth: 760,
              width: "100%",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: -36,
                right: 0,
                background: "none",
                border: "none",
                color: "var(--ink-faded)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              esc to close
            </button>

            {/* Photo */}
            {memory.kind === "photo" && resolvedMediaUrl && (
              <img
                src={resolvedMediaUrl}
                alt={memory.title}
                style={{
                  width: "100%",
                  maxHeight: "60vh",
                  objectFit: "contain",
                  display: "block",
                  marginBottom: 24,
                }}
              />
            )}

            {/* Title */}
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                color: "var(--paper)",
                lineHeight: 1.25,
                marginBottom: 12,
                fontWeight: 400,
              }}
            >
              {memory.title}
            </h2>

            {/* Story body */}
            {memory.kind === "story" && memory.body && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  color: "var(--paper-deep)",
                  lineHeight: 1.8,
                  maxWidth: "60ch",
                  marginBottom: 24,
                }}
              >
                {memory.body}
              </p>
            )}

            {/* Attribution + date */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid rgba(217,208,188,0.2)",
                paddingTop: 16,
                marginTop: 16,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  color: "var(--ink-faded)",
                }}
              >
                A memory of {person.name}
                {memory.dateOfEventText ? ` · ${memory.dateOfEventText}` : ""}
              </span>

              <button
                onClick={() => onPersonDetail(person.id)}
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
                Open {person.name}'s archive →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
