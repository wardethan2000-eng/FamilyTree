"use client";

import { useState, useMemo, type ReactNode } from "react";
import { EASE } from "@/components/home/homeUtils";

export type MosaicTileWeight = "hero" | "large" | "medium" | "small";

interface MosaicSurfaceProps {
  children: ReactNode;
}

function getMortar(): React.CSSProperties {
  return {
    gap: "6px",
  };
}

export function MosaicSurface({ children }: MosaicSurfaceProps) {
  return (
    <div
      className="mosaic-surface"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridAutoRows: "auto",
        ...getMortar(),
      }}
    >
      {children}
      <style>{`
        @media (max-width: 900px) {
          .mosaic-surface {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .mosaic-surface > * {
            grid-column: span 2 !important;
          }
        }
        @media (max-width: 600px) {
          .mosaic-surface {
            grid-template-columns: 1fr !important;
          }
          .mosaic-surface > * {
            grid-column: span 1 !important;
          }
        }
      `}</style>
    </div>
  );
}

interface MosaicTileProps {
  children: ReactNode;
  weight?: MosaicTileWeight;
  colSpan?: number;
  rowSpan?: number;
  href?: string;
  as?: "article" | "div" | "a";
  accent?: "moss" | "rose" | "gilt" | "ink-soft" | null;
  onHover?: (hovered: boolean) => void;
  onFocus?: (focused: boolean) => void;
  staggerIndex?: number;
}

const ACCENT_MAP: Record<string, { rest: string; hover: string }> = {
  moss: { rest: "rgba(78,93,66,0.22)", hover: "rgba(78,93,66,0.45)" },
  rose: { rest: "rgba(168,93,93,0.18)", hover: "rgba(168,93,93,0.4)" },
  gilt: { rest: "rgba(176,139,62,0.22)", hover: "rgba(176,139,62,0.45)" },
  "ink-soft": { rest: "rgba(64,58,46,0.18)", hover: "rgba(64,58,46,0.38)" },
};

export function MosaicTile({
  children,
  weight = "medium",
  colSpan,
  rowSpan,
  href,
  accent,
  onHover,
  onFocus,
  staggerIndex = 0,
}: MosaicTileProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;

  const computedColSpan = colSpan ?? (weight === "hero" ? 4 : weight === "large" ? 3 : weight === "medium" ? 2 : 1);
  const computedRowSpan = rowSpan ?? (weight === "hero" ? 2 : 1);

  const accentStyles = accent ? ACCENT_MAP[accent] : null;

  const baseStyle: React.CSSProperties = {
    gridColumn: `span ${computedColSpan}`,
    gridRow: `span ${computedRowSpan}`,
    position: "relative",
    overflow: "hidden",
    borderRadius: weight === "hero" ? 20 : 12,
    border: active
      ? `1px solid ${accentStyles?.hover ?? "rgba(78,93,66,0.35)"}`
      : `1px solid ${accentStyles?.rest ?? "rgba(128,107,82,0.16)"}`,
    background: active
      ? "linear-gradient(180deg, rgba(252,248,242,0.96) 0%, rgba(242,235,224,0.96) 100%)"
      : "linear-gradient(180deg, rgba(246,241,231,0.94) 0%, rgba(237,230,218,0.94) 100%)",
    transform: active ? "translateY(-2px)" : "none",
    boxShadow: active
      ? "0 20px 48px rgba(40,30,18,0.14)"
      : "0 6px 16px rgba(40,30,18,0.06)",
    transition: `transform 280ms ${EASE}, box-shadow 280ms ${EASE}, border-color 280ms ${EASE}`,
    cursor: href ? "pointer" : "default",
    textDecoration: "none",
    animation: `bloom 600ms ${EASE} ${staggerIndex * 80}ms both`,
    minHeight: weight === "hero" ? 320 : weight === "large" ? 260 : weight === "medium" ? 200 : 160,
  };

  const Tag = href ? "a" : "div";

  return (
    <Tag
      href={href}
      style={baseStyle}
      onMouseEnter={() => {
        setHovered(true);
        onHover?.(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHover?.(false);
      }}
      onFocusCapture={() => {
        setFocused(true);
        onFocus?.(true);
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
          onFocus?.(false);
        }
      }}
    >
      {children}
    </Tag>
  );
}

export function computeTileWeight(memoryCount: number, peopleCount: number): MosaicTileWeight {
  const score = Math.log2(memoryCount + 1) + 0.3 * Math.log2(peopleCount + 1);
  if (score >= 5) return "hero";
  if (score >= 3) return "large";
  if (score >= 1.5) return "medium";
  return "small";
}

export function computeColSpan(weight: MosaicTileWeight, totalItems: number): number {
  if (totalItems === 1) return 4;
  if (totalItems === 2) return 2;
  if (weight === "hero") return 4;
  if (weight === "large") return 3;
  if (weight === "medium") return 2;
  return 1;
}