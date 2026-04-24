"use client";

import { useMemo, useRef, useState, useEffect } from "react";
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
  const [viewportWidth, setViewportWidth] = useState(1200);

  useEffect(() => {
    setViewportWidth(window.innerWidth);
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const cardWidthVw = 38;
  const gap = 32;
  const cardWidthPx = Math.round(viewportWidth * cardWidthVw / 100);
  const totalStripWidth = allMemories.length * (cardWidthPx + gap) + viewportWidth * 0.3;
  const scrollDistance = Math.max(totalStripWidth - viewportWidth, viewportWidth * 0.5);
  const scrollVh = Math.max(300, Math.ceil(scrollDistance / viewportWidth * 100) + 50);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -scrollDistance]);
  const bgX = useTransform(scrollYProgress, [0, 1], [0, -scrollDistance * 0.25]);
  const fgX = useTransform(scrollYProgress, [0, 1], [0, -scrollDistance * 0.05]);

  const photoMemories = useMemo(
    () => allMemories.filter((m) => m.mediaUrl && m.kind === "photo" && !m.mimeType?.startsWith("video/")),
    [allMemories],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", height: `${scrollVh}vh` }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(176,139,62,0.06), transparent 50%), radial-gradient(ellipse at 80% 30%, rgba(78,93,66,0.06), transparent 45%), radial-gradient(ellipse at 50% 70%, rgba(168,93,93,0.04), transparent 50%), #0f0d0a",
        }}
      >
        {/* Background atmosphere layer: large blurred memories drifting slowly */}
        <motion.div
          style={{
            position: "absolute",
            inset: "-10vh -10vw",
            x: bgX,
            display: "flex",
            alignItems: "center",
            gap: "clamp(200px, 30vw, 500px)",
            padding: "0 5vw",
            pointerEvents: "none",
          }}
        >
          {photoMemories.slice(0, 8).map((memory, i) => (
            <div
              key={`bg-${memory.id}`}
              style={{
                width: "clamp(300px, 50vw, 700px)",
                height: "80vh",
                borderRadius: 24,
                overflow: "hidden",
                opacity: 0.12,
                filter: "blur(60px) saturate(0.5) brightness(0.4) sepia(20%)",
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

        {/* Vignette on top of background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(15,13,10,0.5) 100%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Main filmstrip layer */}
        <motion.div
          style={{
            position: "relative",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap,
            padding: `0 ${viewportWidth * 0.1}px`,
            x,
            willChange: "transform",
          }}
        >
          {allMemories.map((memory, i) => (
            <FilmstripCard
              key={memory.id}
              memory={memory}
              href={`/trees/${treeId}/memories/${memory.id}`}
              width={cardWidthPx}
              index={i}
            />
          ))}
        </motion.div>

        {/* Foreground date-era labels that drift slightly */}
        <motion.div
          style={{
            position: "absolute",
            zIndex: 3,
            top: "clamp(16px, 2.5vw, 32px)",
            left: 0,
            right: 0,
            x: fgX,
            display: "flex",
            gap,
            padding: `0 ${viewportWidth * 0.1}px`,
            pointerEvents: "none",
          }}
        >
          {allMemories.map((memory, i) => (
            <div
              key={`label-${memory.id}`}
              style={{
                width: cardWidthPx,
                flexShrink: 0,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(176,139,62,0.35)",
              }}
            >
              {memory.dateOfEventText ?? ""}
            </div>
          ))}
        </motion.div>

        {/* Title */}
        {treeName && (
          <div
            style={{
              position: "absolute",
              bottom: "clamp(20px, 3vw, 40px)",
              left: "clamp(20px, 5vw, 60px)",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(16px, 2vw, 24px)",
              color: "rgba(246,241,231,0.30)",
              pointerEvents: "none",
              zIndex: 4,
            }}
          >
            {treeName}
          </div>
        )}
      </div>
    </div>
  );
}