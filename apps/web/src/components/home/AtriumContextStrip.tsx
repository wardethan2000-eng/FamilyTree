"use client";

export function AtriumContextStrip({
  scaleLabel,
  historicalLabel,
  branchCue,
}: {
  scaleLabel: string;
  historicalLabel: string;
  branchCue: string;
}) {
  return (
    <section style={{ padding: "24px max(20px, 5vw) 0" }}>
      <div
        style={{
          border: "1px solid rgba(122,108,88,0.14)",
          borderRadius: 18,
          background:
            "linear-gradient(180deg, rgba(255,251,246,0.94) 0%, rgba(247,241,232,0.9) 100%)",
          padding: "18px clamp(18px, 3vw, 26px)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <ContextRun label="Family scale" value={scaleLabel} />
        <ContextRun label="Historical span" value={historicalLabel} />
        <ContextRun label="Branch focus" value={branchCue} />
      </div>
    </section>
  );
}

function ContextRun({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: "min(220px, 100%)", flex: "1 1 220px" }}>
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
          fontFamily: "var(--font-body)",
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--ink-soft)",
        }}
      >
        {value}
      </div>
    </div>
  );
}
