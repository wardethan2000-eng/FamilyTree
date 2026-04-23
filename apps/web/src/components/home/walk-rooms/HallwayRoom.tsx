"use client";

export function HallwayRoom({
  title,
  description,
  pace,
}: {
  title: string;
  description: string;
  pace: "lingering" | "flowing";
}) {
  return (
    <div
      style={{
        minHeight: pace === "flowing" ? "50vh" : "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(32px, 6vw, 72px) max(24px, 5vw)",
        background:
          "linear-gradient(180deg, var(--paper) 0%, var(--paper-deep) 50%, var(--paper) 100%)",
      }}
    >
      <div
        style={{
          width: "min(280px, 40%)",
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(176,139,62,0.30) 20%, rgba(176,139,62,0.30) 80%, transparent 100%)",
        }}
      />

      <div
        style={{
          marginTop: "clamp(28px, 4vw, 48px)",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(28px, 4vw, 44px)",
          fontWeight: 400,
          lineHeight: 1.1,
          color: "var(--ink)",
          textAlign: "center",
          textWrap: "balance",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 18,
          fontFamily: "var(--font-body)",
          fontSize: 17,
          fontStyle: "italic",
          lineHeight: 1.75,
          color: "var(--ink-soft)",
          textAlign: "center",
          maxWidth: "56ch",
        }}
      >
        {description}
      </div>

      <div
        style={{
          marginTop: "clamp(28px, 4vw, 48px)",
          width: "min(280px, 40%)",
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(176,139,62,0.30) 20%, rgba(176,139,62,0.30) 80%, transparent 100%)",
        }}
      />
    </div>
  );
}