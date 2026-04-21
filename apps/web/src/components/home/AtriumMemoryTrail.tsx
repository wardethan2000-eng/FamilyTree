"use client";

import Link from "next/link";
import { MemoryCard } from "./MemoryCard";
import type { TreeHomeCoverage, TreeHomeMemory } from "./homeTypes";

type EraValue = "all" | number;

interface TrailSection {
  id: string;
  title: string;
  description: string;
  memories: TreeHomeMemory[];
}

export function AtriumMemoryTrail({
  coverage,
  sections,
  selectedEra,
  selectedEraLabel,
  onSelectEra,
  onMemoryClick,
  openArchiveHref,
}: {
  coverage: TreeHomeCoverage | null;
  sections: TrailSection[];
  selectedEra: EraValue;
  selectedEraLabel: string;
  onSelectEra: (value: EraValue) => void;
  onMemoryClick: (memory: TreeHomeMemory) => void;
  openArchiveHref: string;
}) {
  return (
    <section style={{ padding: "30px max(20px, 5vw) 0" }}>
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3vw, 34px)",
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            Follow the thread
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 720,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              lineHeight: 1.75,
              color: "var(--ink-soft)",
            }}
          >
            Begin with one memory, stay close to its branch, and let the archive widen outward from
            there.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href={openArchiveHref}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            color: "var(--moss)",
            textDecoration: "none",
          }}
        >
          Open the full archive →
        </Link>
      </div>

      {coverage && coverage.decadeBuckets.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 10,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "none",
          }}
        >
          <EraChip
            label="All eras"
            active={selectedEra === "all"}
            onClick={() => onSelectEra("all")}
          />
          {coverage.decadeBuckets.map((bucket) => (
            <EraChip
              key={bucket.startYear}
              label={`${bucket.label} · ${bucket.count}`}
              active={selectedEra === bucket.startYear}
              onClick={() => onSelectEra(bucket.startYear)}
            />
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--rule)",
            borderRadius: 18,
            background:
              "linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(242,235,224,0.94) 100%)",
            padding: "24px clamp(18px, 3vw, 28px)",
            boxShadow: "0 10px 26px rgba(40,30,18,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 24,
              color: "var(--ink)",
            }}
          >
            Nothing surfaced for {selectedEraLabel.toLowerCase()} yet
          </div>
          <p
            style={{
              margin: "10px 0 0",
              maxWidth: 620,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              lineHeight: 1.75,
              color: "var(--ink-soft)",
            }}
          >
            Try another era, or open the full archive while this branch gathers more dated memories.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 22, minWidth: 0 }}>
          {sections.map((section) => (
            <article
              key={section.id}
              style={{
                width: "100%",
                minWidth: 0,
                border: "1px solid rgba(122,108,88,0.18)",
                borderRadius: 20,
                background:
                  "linear-gradient(180deg, rgba(255,250,244,0.92) 0%, rgba(247,241,231,0.72) 100%)",
                padding: "18px 0 18px",
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  padding: "0 clamp(18px, 3vw, 28px)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--ink-faded)",
                    marginBottom: 6,
                  }}
                >
                  {section.title}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    lineHeight: 1.7,
                    color: "var(--ink-soft)",
                    maxWidth: 720,
                  }}
                >
                  {section.description}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  minWidth: 0,
                  maxWidth: "100%",
                  overflowX: "auto",
                  padding: "0 clamp(18px, 3vw, 28px)",
                  paddingBottom: 4,
                  scrollSnapType: "x proximity",
                  scrollbarWidth: "none",
                }}
              >
                {section.memories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    onClick={() => onMemoryClick(memory)}
                  />
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EraChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: active ? "1px solid var(--moss)" : "1px solid var(--rule)",
        background: active ? "rgba(78,93,66,0.08)" : "var(--paper-deep)",
        color: active ? "var(--ink)" : "var(--ink-faded)",
        borderRadius: 999,
        padding: "9px 13px",
        minWidth: "fit-content",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}
