"use client";

import { EASE } from "@/components/home/homeUtils";

interface NewArchiveTileProps {
  colSpan: number;
  staggerIndex: number;
  onClick: () => void;
}

export function NewArchiveTile({ colSpan, staggerIndex, onClick }: NewArchiveTileProps) {
  return (
    <button
      onClick={onClick}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: "span 1",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 160,
        borderRadius: 12,
        border: "1px dashed rgba(128,107,82,0.28)",
        background: "transparent",
        cursor: "pointer",
        transition: `border-color 280ms ${EASE}, background 280ms ${EASE}`,
        animation: `bloom 600ms ${EASE} ${staggerIndex * 80}ms both`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(78,93,66,0.4)";
        e.currentTarget.style.background = "rgba(78,93,66,0.04)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(128,107,82,0.28)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          lineHeight: 1,
          color: "var(--ink-faded)",
        }}
      >
        +
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "rgba(63,53,41,0.44)",
        }}
      >
        New archive
      </span>
    </button>
  );
}