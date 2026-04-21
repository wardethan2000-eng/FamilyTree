"use client";

import Link from "next/link";

export function AtriumStartState({
  treeName,
  addPersonHref,
  onAddMemory,
}: {
  treeName: string;
  addPersonHref: string;
  onAddMemory: () => void;
}) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background:
          "radial-gradient(circle at 18% 24%, rgba(201,161,92,0.16), transparent 28%), radial-gradient(circle at 80% 18%, rgba(78,93,66,0.14), transparent 24%), linear-gradient(180deg, #211d18 0%, #171410 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "clamp(36px, 7vw, 68px) max(20px, 5vw) clamp(42px, 8vw, 84px)",
          minHeight: "clamp(380px, 62vh, 560px)",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(246,241,231,0.08)",
              backdropFilter: "blur(10px)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              color: "rgba(246,241,231,0.62)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            Start the archive
          </div>

          <h1
            style={{
              margin: "18px 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 6vw, 60px)",
              lineHeight: 1.02,
              fontWeight: 400,
              color: "rgba(246,241,231,0.95)",
              maxWidth: "12ch",
            }}
          >
            {treeName}
          </h1>

          <p
            style={{
              margin: "16px 0 0",
              maxWidth: "58ch",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              lineHeight: 1.8,
              color: "rgba(246,241,231,0.76)",
            }}
          >
            This atrium is waiting for its first memory. Add a story, photo, or voice note so the
            archive has something living at its center, or add the first person so future memories
            have a branch to gather around.
          </p>

          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={onAddMemory}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
                background: "rgba(246,241,231,0.95)",
                border: "none",
                borderRadius: 999,
                padding: "12px 18px",
                cursor: "pointer",
              }}
            >
              Add first memory
            </button>

            <Link
              href={addPersonHref}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "rgba(246,241,231,0.9)",
                background: "rgba(246,241,231,0.08)",
                border: "1px solid rgba(246,241,231,0.18)",
                borderRadius: 999,
                padding: "12px 18px",
                textDecoration: "none",
              }}
            >
              Add first person
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
