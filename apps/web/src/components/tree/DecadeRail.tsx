"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

interface DecadeRailProps {
  decades: number[];
  activeDecade: number | null;
  onSelectDecade: (decade: number | null) => void;
}

export function DecadeRail({
  decades,
  activeDecade,
  onSelectDecade,
}: DecadeRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [hoveredDecade, setHoveredDecade] = useState<number | null>(null);
  const scrollAccumulator = useRef(0);
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      scrollAccumulator.current += e.deltaY;

      const friction = 80;
      if (Math.abs(scrollAccumulator.current) >= friction) {
        const direction = scrollAccumulator.current > 0 ? 1 : -1;
        scrollAccumulator.current = 0;

        if (activeDecade === null) {
          const startDecade = direction === 1 ? decades[0] : decades[decades.length - 1];
          if (startDecade != null) onSelectDecade(startDecade);
          return;
        }

        const currentIndex = decades.indexOf(activeDecade);
        if (currentIndex === -1) return;

        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < decades.length) {
          onSelectDecade(decades[newIndex]!);
        }
      }

      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
      wheelTimeout.current = setTimeout(() => {
        scrollAccumulator.current = 0;
      }, 300);
    },
    [activeDecade, decades, onSelectDecade],
  );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    rail.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      rail.removeEventListener("wheel", handleWheel);
      if (wheelTimeout.current) clearTimeout(wheelTimeout.current);
    };
  }, [handleWheel]);

  if (decades.length === 0) return null;

  return (
    <div
      ref={railRef}
      style={{
        position: "absolute",
        left: 16,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "12px 8px",
        borderRadius: 16,
        background: "rgba(246,241,231,0.82)",
        backdropFilter: "blur(10px)",
        border: "1px solid var(--rule)",
        boxShadow: "0 8px 20px rgba(28,25,21,0.06)",
        cursor: "ns-resize",
        userSelect: "none",
      }}
    >
      {activeDecade !== null && (
        <button
          type="button"
          onClick={() => onSelectDecade(null)}
          style={{
            background: "transparent",
            border: "1px solid var(--rule)",
            borderRadius: "50%",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--ink-faded)",
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            marginBottom: 4,
            padding: 0,
            transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--paper-deep)";
            e.currentTarget.style.borderColor = "var(--moss)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "var(--rule)";
          }}
          title="Show all decades"
        >
          ×
        </button>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 6,
            bottom: 6,
            width: 1,
            background: "var(--rule)",
            transform: "translateX(-50%)",
            opacity: 0.5,
          }}
        />

        {decades.map((decade) => {
          const isActive = decade === activeDecade;
          const isHovered = decade === hoveredDecade;
          const distance = activeDecade !== null
            ? Math.abs(decades.indexOf(decade) - decades.indexOf(activeDecade))
            : 0;

          let fontSize = 10;
          let fontWeight = 400;
          let fontFamily = "var(--font-ui)";
          let opacity = activeDecade === null ? 0.5 : Math.max(0.3, 1 - distance * 0.12);
          let height = 22;
          let color = "var(--ink-faded)";

          if (isActive) {
            fontSize = 15;
            fontWeight = 500;
            fontFamily = "var(--font-display)";
            opacity = 1;
            height = 32;
            color = "var(--ink)";
          } else if (isHovered) {
            opacity = 1;
            fontSize = 13;
          } else if (distance === 1) {
            fontSize = 12;
            opacity = Math.max(0.45, opacity);
          }

          return (
            <button
              key={decade}
              type="button"
              onClick={() => {
                onSelectDecade(activeDecade === decade ? null : decade);
              }}
              onMouseEnter={() => setHoveredDecade(decade)}
              onMouseLeave={() => setHoveredDecade(null)}
              style={{
                background: isActive
                  ? "rgba(78,93,66,0.1)"
                  : isHovered
                    ? "rgba(78,93,66,0.06)"
                    : "transparent",
                border: isActive
                  ? "1px solid rgba(78,93,66,0.3)"
                  : "1px solid transparent",
                borderRadius: 8,
                padding: "2px 10px",
                height,
                minWidth: 44,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                fontFamily,
                fontSize,
                fontWeight,
                color,
                opacity,
                transition: `all 350ms ${EASE}`,
                position: "relative",
                zIndex: isActive ? 2 : 1,
              }}
            >
              {decade}s
            </button>
          );
        })}
      </div>
    </div>
  );
}