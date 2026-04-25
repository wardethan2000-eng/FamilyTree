"use client";

import { useState } from "react";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { TreeHomeCoverage, TreeHomeMemory, TreeHomeStats } from "@/components/home/homeTypes";
import { EASE, getCoverageRangeLabel, getHeroExcerpt } from "@/components/home/homeUtils";
import type { MosaicTileWeight } from "./MosaicTile";

interface ArchiveTileProps {
  treeName: string;
  treeId: string;
  role: string;
  stats: TreeHomeStats;
  coverage: TreeHomeCoverage;
  heroMemory: TreeHomeMemory | null;
  isFoundedByYou: boolean;
  isPrimary: boolean;
  weight: MosaicTileWeight;
  colSpan: number;
  staggerIndex: number;
  href: string;
}

export function ArchiveTile({
  treeName,
  treeId,
  role,
  stats,
  coverage,
  heroMemory,
  isFoundedByYou,
  isPrimary,
  weight,
  colSpan,
  staggerIndex,
  href,
}: ArchiveTileProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  const heroImage = getProxiedMediaUrl(heroMemory?.mediaUrl);
  const heroExcerpt = getHeroExcerpt(heroMemory);
  const isHero = weight === "hero";

  const style: React.CSSProperties = {
    gridColumn: `span ${colSpan}`,
    gridRow: isHero ? "span 2" : "span 1",
    position: "relative",
    overflow: "hidden",
    borderRadius: isHero ? 20 : 12,
    border: active
      ? "1px solid rgba(78,93,66,0.35)"
      : "1px solid rgba(128,107,82,0.16)",
    background: isPrimary
      ? "linear-gradient(180deg, rgba(247,242,233,0.98) 0%, rgba(238,229,216,0.98) 100%)"
      : "linear-gradient(180deg, rgba(246,241,231,0.94) 0%, rgba(237,230,218,0.94) 100%)",
    transform: active ? "translateY(-2px)" : "none",
    boxShadow: active
      ? "0 20px 48px rgba(40,30,18,0.14)"
      : isHero
        ? "0 12px 30px rgba(40,30,18,0.08)"
        : "0 6px 16px rgba(40,30,18,0.04)",
    transition: `transform 280ms ${EASE}, box-shadow 280ms ${EASE}, border-color 280ms ${EASE}`,
    cursor: "pointer",
    textDecoration: "none",
    animation: `bloom 600ms ${EASE} ${staggerIndex * 80}ms both`,
    minHeight: isHero ? 320 : weight === "large" ? 260 : 200,
  };

  return (
    <a
      href={href}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      {heroImage && (
        <>
          <img
            src={heroImage}
            alt={heroMemory?.title ?? treeName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: isPrimary ? 0.24 : 0.16,
              filter: "sepia(18%) saturate(0.85)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(247,242,233,0.68) 0%, rgba(237,228,214,0.94) 72%, rgba(235,225,210,1) 100%)",
            }}
          />
        </>
      )}

      {!heroImage && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(circle at 18% 20%, rgba(201,161,92,0.14), transparent 34%),
              radial-gradient(circle at 82% 18%, rgba(92,110,84,0.10), transparent 30%),
              linear-gradient(180deg, rgba(247,242,233,1) 0%, rgba(238,229,216,1) 100%)
            `,
          }}
        />
      )}

      <div
        style={{
          position: "relative",
          padding: isHero ? "clamp(22px, 4vw, 32px)" : "clamp(16px, 2.5vw, 22px)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: isHero ? 14 : 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: isFoundedByYou ? "var(--moss)" : "rgba(63,53,41,0.55)",
            }}
          >
            {isPrimary ? "Primary archive" : "Archive"}
          </span>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              color: "rgba(63,53,41,0.4)",
            }}
          >
            ·
          </span>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              textTransform: "capitalize",
              color: "rgba(63,53,41,0.55)",
            }}
          >
            {role}
          </span>
        </div>

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: isHero ? "clamp(26px, 3vw, 38px)" : "clamp(20px, 2vw, 26px)",
            lineHeight: 1.1,
            color: "var(--ink)",
            maxWidth: isHero ? "18ch" : "14ch",
          }}
        >
          {treeName}
        </div>

        <div
          style={{
            marginTop: isHero ? 12 : 8,
            display: "flex",
            flexWrap: "wrap",
            gap: isHero ? 10 : 6,
          }}
        >
          <TileMetric label="people" value={`${stats.peopleCount}`} />
          <TileMetric label="memories" value={`${stats.memoryCount}`} />
          {coverage.earliestYear !== null && (
            <TileMetric label="span" value={getCoverageRangeLabel(coverage)} />
          )}
        </div>

        {active && heroExcerpt && (
          <div
            style={{
              marginTop: isHero ? 14 : 10,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "rgba(53,44,33,0.72)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {heroExcerpt}
          </div>
        )}

        <div
          style={{
            marginTop: "auto",
            paddingTop: isHero ? 18 : 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: active ? "var(--ink)" : "var(--moss)",
              transition: `color 200ms ${EASE}`,
            }}
          >
            Enter Home →
          </span>
        </div>
      </div>
    </a>
  );
}

function TileMetric({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "rgba(63,53,41,0.52)",
      }}
    >
      {value} {label}
    </span>
  );
}