"use client";

import { AnimatePresence, motion } from "framer-motion";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { TreeHomeMemory } from "./homeTypes";
import { getHeroExcerpt } from "./homeUtils";

const HERO_EASE = [0.22, 0.61, 0.36, 1] as const;

export function TreeHomeHero({
  treeName,
  featuredMemory,
  heroIndex,
  heroCount,
  onPauseChange,
  onSelectHero,
}: {
  treeName: string;
  featuredMemory: TreeHomeMemory | null;
  heroIndex: number;
  heroCount: number;
  onPauseChange: (paused: boolean) => void;
  onSelectHero: (index: number) => void;
}) {
  const featuredMemoryMediaUrl = getProxiedMediaUrl(featuredMemory?.mediaUrl);
  const heroExcerpt = getHeroExcerpt(featuredMemory);

  return (
    <section
      onMouseEnter={() => onPauseChange(true)}
      onMouseLeave={() => onPauseChange(false)}
      style={{
        position: "relative",
        height: "min(60vh, 480px)",
        overflow: "hidden",
        background: "var(--ink)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={featuredMemory?.id ?? "empty"}
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.2 }}
          transition={{ duration: 0.7, ease: HERO_EASE }}
          style={{ position: "absolute", inset: 0 }}
        >
          {featuredMemory?.kind === "photo" && featuredMemoryMediaUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featuredMemoryMediaUrl}
                alt={featuredMemory.title}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "sepia(20%) brightness(0.7)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(to top, rgba(28,25,21,0.85) 0%, rgba(28,25,21,0.2) 60%, transparent 100%)",
                }}
              />
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `
                  radial-gradient(ellipse at 30% 60%, rgba(176,139,62,0.18) 0%, transparent 60%),
                  radial-gradient(ellipse at 80% 20%, rgba(78,93,66,0.15) 0%, transparent 50%),
                  #1C1915
                `,
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`content-${featuredMemory?.id ?? "empty"}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.45, ease: HERO_EASE }}
          style={{
            position: "absolute",
            bottom: 40,
            left: "max(40px, 5vw)",
            right: "max(40px, 5vw)",
          }}
        >
          {featuredMemory ? (
            <>
              <div
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  color: "rgba(246,241,231,0.55)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 8,
                }}
              >
                {featuredMemory.kind === "photo"
                  ? "From the archive"
                  : featuredMemory.kind === "story"
                    ? "A story"
                    : featuredMemory.kind === "voice"
                      ? "A voice"
                      : "A memory"}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(24px, 4vw, 40px)",
                  color: "rgba(246,241,231,0.95)",
                  lineHeight: 1.2,
                  marginBottom: 10,
                  maxWidth: "60ch",
                }}
              >
                {featuredMemory.title}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: 14,
                  color: "rgba(246,241,231,0.65)",
                }}
              >
                {featuredMemory.personName ?? ""}
                {featuredMemory.personName && featuredMemory.dateOfEventText ? " · " : ""}
                {featuredMemory.dateOfEventText ?? ""}
              </div>
              {heroExcerpt && (
                <div
                  style={{
                    marginTop: 14,
                    maxWidth: "60ch",
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "rgba(246,241,231,0.78)",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {heroExcerpt}
                </div>
              )}
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 11,
                  color: "rgba(246,241,231,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  marginBottom: 10,
                }}
              >
                A private family archive
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px, 5vw, 52px)",
                  color: "rgba(246,241,231,0.9)",
                  lineHeight: 1.15,
                }}
              >
                {treeName}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: 15,
                  color: "rgba(246,241,231,0.5)",
                  marginTop: 10,
                }}
              >
                Begin by adding the first memory.
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {heroCount > 1 && (
        <div
          style={{
            position: "absolute",
            right: "max(24px, 5vw)",
            bottom: 22,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              color: "rgba(246,241,231,0.58)",
            }}
          >
            {heroIndex + 1} / {heroCount}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {Array.from({ length: heroCount }).map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show hero ${index + 1}`}
                onClick={() => onSelectHero(index)}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  background:
                    index === heroIndex ? "rgba(246,241,231,0.95)" : "rgba(246,241,231,0.35)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
