"use client";

import { useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { AtriumSharedProps } from "../AtriumModeRouter";
import type { TreeHomeMemory } from "../homeTypes";
import { FilmstripCard } from "./FilmstripCard";

export function HorizontalFilmstrip({
  treeId,
  treeName,
  featuredMemory,
  trailSections,
  people,
  onPersonClick,
  onMemoryClick,
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

  const containerRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const cardWidth = 500;
  const gap = 24;
  const totalStripWidth = allMemories.length * (cardWidth + gap);
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
  const maxTranslate = Math.max(0, totalStripWidth - viewportWidth + 200);

  const scrollHeight = `${Math.ceil(totalStripWidth / viewportWidth) * 150}vh`;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -maxTranslate]);
  const bgX = useTransform(scrollYProgress, [0, 1], [0, -maxTranslate * 0.3]);

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: scrollHeight, background: "#0f0d0a" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background: "#0f0d0a",
        }}
      >
        {/* Background parallax layer */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            x: bgX,
            display: "flex",
            alignItems: "center",
            gap: cardWidth * 2,
            padding: "0 10vw",
            pointerEvents: "none",
          }}
        >
          {allMemories
            .filter((m) => m.mediaUrl && m.kind === "photo")
            .slice(0, 6)
            .map((memory, i) => (
              <div
                key={`bg-${memory.id}`}
                style={{
                  width: cardWidth * 1.5,
                  height: "70vh",
                  borderRadius: 12,
                  overflow: "hidden",
                  opacity: 0.15,
                  filter: "blur(40px) saturate(0.4) brightness(0.5)",
                  flexShrink: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getProxiedMediaUrl(memory.mediaUrl!) ?? ""}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            ))}
        </motion.div>

        {/* Main filmstrip layer */}
        <motion.div
          ref={stripRef}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap,
            padding: "0 10vw",
            x,
            willChange: "transform",
          }}
        >
          {allMemories.map((memory, i) => (
            <FilmstripCard
              key={memory.id}
              memory={memory}
              href={`/trees/${treeId}/memories/${memory.id}`}
              width={cardWidth}
              index={i}
            />
          ))}
        </motion.div>

        {/* Title overlay */}
        {treeName && (
          <div
            style={{
              position: "absolute",
              top: "clamp(20px, 3vw, 40px)",
              left: "10vw",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(18px, 2.5vw, 28px)",
              color: "rgba(246,241,231,0.55)",
              pointerEvents: "none",
            }}
          >
            {treeName}
          </div>
        )}
      </div>
    </div>
  );
}