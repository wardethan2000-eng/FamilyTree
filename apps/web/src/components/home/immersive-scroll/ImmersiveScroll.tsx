"use client";

import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import type { AtriumSharedProps } from "../AtriumModeRouter";
import type { TreeHomeMemory } from "../homeTypes";
import { ImmersivePhotoSection } from "./ImmersivePhotoSection";
import { ImmersiveStorySection } from "./ImmersiveStorySection";
import { ImmersiveVoiceSection } from "./ImmersiveVoiceSection";
import { ImmersiveDocumentSection } from "./ImmersiveDocumentSection";
import { EraDivider } from "./EraDivider";

export function ImmersiveScroll({
  treeId,
  treeName,
  featuredMemory,
  trailSections,
  people,
  onPersonClick,
  onMemoryClick,
  onDrift,
}: AtriumSharedProps) {
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

  const sections: Array<{ type: "memory"; memory: TreeHomeMemory } | { type: "era"; label: string }> = useMemo(() => {
    const result: Array<{ type: "memory"; memory: TreeHomeMemory } | { type: "era"; label: string }> = [];
    let lastSectionIdx = -1;

    for (let i = 0; i < allMemories.length; i++) {
      const memory = allMemories[i]!;
      let sectionIdx = -1;
      for (let s = 0; s < trailSections.length; s++) {
        if (trailSections[s]!.memories.some((m) => m.id === memory.id)) {
          sectionIdx = s;
          break;
        }
      }
      if (sectionIdx > lastSectionIdx && sectionIdx >= 0 && trailSections[sectionIdx]) {
        if (lastSectionIdx >= 0) {
          result.push({ type: "era", label: trailSections[sectionIdx]!.title });
        }
        lastSectionIdx = sectionIdx;
      }
      result.push({ type: "memory", memory });
    }
    return result;
  }, [allMemories, trailSections]);

  return (
    <div
      style={{
        background:
          "radial-gradient(ellipse at 10% 30%, rgba(176,139,62,0.05), transparent 50%), radial-gradient(ellipse at 90% 70%, rgba(78,93,66,0.05), transparent 50%), #0f0d0a",
        minHeight: "100vh",
      }}
    >
      {sections.map((section, i) => {
        if (section.type === "era") {
          return <EraDivider key={`era-${i}`} label={section.label} />;
        }

        const memory = section.memory;
        const href = `/trees/${treeId}/memories/${memory.id}`;

        if (memory.kind === "photo" && memory.mediaUrl) {
          return (
            <ImmersivePhotoSection
              key={memory.id}
              memory={memory}
              mediaUrl={getProxiedMediaUrl(memory.mediaUrl)!}
              href={href}
            />
          );
        }

        if (memory.kind === "voice") {
          return (
            <ImmersiveVoiceSection
              key={memory.id}
              memory={memory}
              href={href}
            />
          );
        }

        if (memory.kind === "document" && memory.mediaUrl) {
          return (
            <ImmersiveDocumentSection
              key={memory.id}
              memory={memory}
              mediaUrl={getProxiedMediaUrl(memory.mediaUrl)!}
              href={href}
            />
          );
        }

        return (
          <ImmersiveStorySection
            key={memory.id}
            memory={memory}
            href={href}
          />
        );
      })}
    </div>
  );
}