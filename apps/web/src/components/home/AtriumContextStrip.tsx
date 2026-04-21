"use client";

import type { TreeHomeCoverage, TreeHomeStats } from "./homeTypes";

export function AtriumContextStrip({
  stats,
  coverage,
  branchCue,
}: {
  stats: TreeHomeStats | null;
  coverage: TreeHomeCoverage | null;
  branchCue: string;
}) {
  return (
    <section style={{ padding: "24px max(20px, 5vw) 0" }}>
      <div
        style={{
          border: "1px solid rgba(122,108,88,0.2)",
          borderRadius: 22,
          background:
            "linear-gradient(180deg, rgba(255,250,244,0.96) 0%, rgba(244,237,226,0.9) 100%)",
          padding: "18px clamp(18px, 3vw, 28px)",
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          boxShadow: "0 10px 26px rgba(40,30,18,0.04)",
        }}
      >
        <ContextBlock
          label="Family scale"
          value={formatScaleValue(stats)}
        />
        <ContextBlock
          label="Historical span"
          value={formatHistoricalValue(coverage)}
        />
        <ContextBlock
          label="Branch focus"
          value={branchCue}
        />
      </div>
    </section>
  );
}

function ContextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
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
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 18,
          lineHeight: 1.35,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function formatScaleValue(stats: TreeHomeStats | null) {
  const peopleCount = stats?.peopleCount ?? 0;
  const generationCount = stats?.generationCount ?? 0;

  if (peopleCount === 0) return "No one has been added yet.";
  if (generationCount > 0) {
    return `${peopleCount} ${peopleCount === 1 ? "person" : "people"} across ${generationCount} ${generationCount === 1 ? "generation" : "generations"}`;
  }
  return `${peopleCount} ${peopleCount === 1 ? "person" : "people"} gathering here`;
}

function formatHistoricalValue(coverage: TreeHomeCoverage | null) {
  if (!coverage || (coverage.earliestYear === null && coverage.latestYear === null)) {
    return "Dates are still gathering around the archive.";
  }
  if (coverage.earliestYear !== null && coverage.latestYear !== null) {
    if (coverage.earliestYear === coverage.latestYear) {
      return `Memories centered on ${coverage.earliestYear}`;
    }
    return `Memories from ${coverage.earliestYear} to ${coverage.latestYear}`;
  }
  const knownYear = coverage.earliestYear ?? coverage.latestYear;
  return `Memories gathering around ${knownYear}`;
}
