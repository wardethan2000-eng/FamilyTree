"use client";

import type { TreeHomeCoverage } from "./homeTypes";

type EraValue = "all" | number;

export function EraRibbon({
  coverage,
  selectedEra,
  onSelectEra,
}: {
  coverage: TreeHomeCoverage | null;
  selectedEra: EraValue;
  onSelectEra: (value: EraValue) => void;
}) {
  if (!coverage || coverage.decadeBuckets.length === 0) return null;

  return (
    <section
      style={{
        padding: "26px max(24px, 5vw) 0",
      }}
    >
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--ink)",
          }}
        >
          Browse by era
        </h2>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--ink-faded)",
          }}
        >
          Filter the atrium through the decades already present in the archive.
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
          scrollbarWidth: "none",
        }}
      >
        <EraChip
          label="All eras"
          detail={`${coverage.decadeBuckets.length} decades`}
          active={selectedEra === "all"}
          onClick={() => onSelectEra("all")}
        />
        {coverage.decadeBuckets.map((bucket) => (
          <EraChip
            key={bucket.startYear}
            label={bucket.label}
            detail={`${bucket.count} ${bucket.count === 1 ? "memory" : "memories"}`}
            active={selectedEra === bucket.startYear}
            onClick={() => onSelectEra(bucket.startYear)}
          />
        ))}
      </div>
    </section>
  );
}

function EraChip({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail: string;
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
        padding: "10px 14px",
        minWidth: "fit-content",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 15,
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 2,
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          opacity: 0.85,
        }}
      >
        {detail}
      </div>
    </button>
  );
}
