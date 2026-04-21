"use client";

import type { TreeHomeMemory } from "./homeTypes";
import { MemoryCard } from "./MemoryCard";

export function MemoryLane({
  title,
  countLabel,
  memories,
  onMemoryClick,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  countLabel: string;
  memories: TreeHomeMemory[];
  onMemoryClick: (memory: TreeHomeMemory) => void;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  if (memories.length === 0) return null;

  return (
    <section style={{ padding: "28px 0 0" }}>
      <div
        style={{
          padding: "0 max(24px, 5vw)",
          marginBottom: 16,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            color: "var(--ink)",
            margin: 0,
            fontWeight: 400,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--ink-faded)",
          }}
        >
          {countLabel}
        </span>
      </div>

      <div
        style={{
          overflowX: "auto",
          paddingBottom: 16,
          paddingLeft: "max(24px, 5vw)",
          paddingRight: "max(24px, 5vw)",
          display: "flex",
          gap: 12,
          scrollbarWidth: "none",
        }}
      >
        {memories.map((memory) => (
          <MemoryCard
            key={memory.id}
            memory={memory}
            onClick={() => onMemoryClick(memory)}
          />
        ))}
        {viewAllHref && viewAllLabel && (
          <a
            href={viewAllHref}
            style={{
              background: "var(--paper-deep)",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              flexShrink: 0,
              width: 200,
              height: 156,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                color: "var(--ink-faded)",
                textAlign: "center",
                maxWidth: 140,
              }}
            >
              {viewAllLabel}
            </span>
          </a>
        )}
      </div>
    </section>
  );
}
