"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import type { MemoryCardFlowNode } from "./treeTypes";

function MemoryCardNodeComponent({ data }: NodeProps<MemoryCardFlowNode>) {
  const { kind, title, bodyPreview, mediaUrl, year, contributorName, isOverflow, overflowCount } =
    data;

  if (isOverflow) {
    return (
      <div
        style={{
          width: 220,
          height: 110,
          background: "var(--paper)",
          border: "1px solid var(--rule)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "bloom 500ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--moss)",
            textDecoration: "underline",
          }}
        >
          View all {overflowCount} more →
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        height: 110,
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animation: "bloom 500ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        cursor: "pointer",
        transition: "box-shadow 150ms cubic-bezier(0.22, 0.61, 0.36, 1)",
      }}
    >
      {/* Photo thumbnail */}
      {kind === "photo" && mediaUrl && (
        <div style={{ height: 56, flexShrink: 0, overflow: "hidden" }}>
          <img
            src={mediaUrl}
            alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* Content area */}
      <div
        style={{
          flex: 1,
          padding: "6px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          overflow: "hidden",
        }}
      >
        {/* Ornament for stories */}
        {kind === "story" && (
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              color: "var(--ink-faded)",
              lineHeight: 1,
            }}
          >
            ·
          </span>
        )}

        {/* Title */}
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--ink)",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {title}
        </div>

        {/* Body preview */}
        {kind === "story" && bodyPreview && (
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              color: "var(--ink-faded)",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
            }}
          >
            {bodyPreview}
          </div>
        )}
      </div>

      {/* Footer: year + contributor */}
      <div
        style={{
          padding: "0 10px 6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {year && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              color: "var(--ink-faded)",
            }}
          >
            {year}
          </span>
        )}
        {contributorName && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              color: "var(--ink-faded)",
              marginLeft: "auto",
            }}
          >
            {contributorName}
          </span>
        )}
      </div>
    </div>
  );
}

export const MemoryCardNode = memo(MemoryCardNodeComponent);
