"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { AtriumSharedProps } from "../AtriumModeRouter";
import type { TreeHomeMemory } from "../homeTypes";
import { GalleryCell, type CellSpan } from "./GalleryCell";
import { GalleryExpandedView } from "./GalleryExpandedView";

type CellKind = "hero" | "landscape" | "portrait" | "standard" | "story" | "voice";

function getCellSpan(kind: CellKind): CellSpan {
  switch (kind) {
    case "hero":
      return { colSpan: 2, rowSpan: 2 };
    case "landscape":
      return { colSpan: 2, rowSpan: 1 };
    case "portrait":
      return { colSpan: 1, rowSpan: 2 };
    default:
      return { colSpan: 1, rowSpan: 1 };
  }
}

function classifyCell(memory: TreeHomeMemory, index: number): CellKind {
  if (index === 0) return "hero";
  if (memory.kind === "voice") return "voice";
  if (memory.kind === "story") return "story";
  if (memory.kind === "document") return "standard";
  return index % 5 === 0 ? "landscape" : index % 7 === 0 ? "portrait" : "standard";
}

export function GalleryWall({
  treeId,
  treeName,
  featuredMemory,
  trailSections,
  people,
  onPersonClick,
  onMemoryClick,
}: AtriumSharedProps) {
  const [expandedMemory, setExpandedMemory] = useState<TreeHomeMemory | null>(null);

  const allMemories = useMemo(() => {
    const result: TreeHomeMemory[] = [];
    if (featuredMemory) result.push(featuredMemory);
    for (const section of trailSections) {
      for (const memory of section.memories) {
        if (!result.some((m) => m.id === memory.id)) {
          result.push(memory);
        }
      }
    }
    return result;
  }, [featuredMemory, trailSections]);

  const cells = useMemo(
    () =>
      allMemories.map((memory, i) => {
        const kind = classifyCell(memory, i);
        const span = getCellSpan(kind);
        const mediaUrl =
          memory.mediaUrl && (memory.kind === "photo" || memory.kind === "document")
            ? getProxiedMediaUrl(memory.mediaUrl)
            : null;
        return { memory, kind, span, mediaUrl, index: i };
      }),
    [allMemories],
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f0d0a",
        padding: "clamp(24px, 4vw, 48px)",
      }}
    >
      {treeName && (
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(24px, 3vw, 36px)",
            color: "rgba(246,241,231,0.85)",
            marginBottom: "clamp(20px, 3vw, 36px)",
            marginLeft: 4,
          }}
        >
          {treeName}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "clamp(6px, 1vw, 12px)",
          gridAutoRows: "clamp(140px, 20vh, 240px)",
        }}
      >
        {cells.map((cell) => (
          <GalleryCell
            key={cell.memory.id}
            memory={cell.memory}
            kind={cell.kind}
            span={cell.span}
            mediaUrl={cell.mediaUrl}
            index={cell.index}
            onClick={() => setExpandedMemory(cell.memory)}
          />
        ))}
      </div>

      <AnimatePresence>
        {expandedMemory && (
          <GalleryExpandedView
            memory={expandedMemory}
            onClose={() => setExpandedMemory(null)}
            onPersonClick={onPersonClick}
            href={`/trees/${treeId}/memories/${expandedMemory.id}`}
          />
        )}
      </AnimatePresence>
    </div>
  );
}