"use client";

import { useMemo, useState } from "react";

interface FamilySelectorProps {
  people: Array<{ id: string; name: string; lastName?: string | null; maidenName?: string | null }>;
  activeFamily: string | null;
  onSelectFamily: (family: string | null) => void;
}

export function FamilySelector({
  people,
  activeFamily,
  onSelectFamily,
}: FamilySelectorProps) {
  const [open, setOpen] = useState(false);

  const familyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      const last = person.lastName?.trim();
      const maiden = person.maidenName?.trim();

      if (last) {
        counts.set(last, (counts.get(last) ?? 0) + 1);
      }
      if (maiden && maiden !== last) {
        counts.set(maiden, (counts.get(maiden) ?? 0) + 1);
      }

      if (!last && !maiden) {
        const parts = person.name.trim().split(/\s+/);
        if (parts.length >= 2) {
          const inferred = parts[parts.length - 1]!;
          if (inferred.length > 1 && inferred[0] === inferred[0]!.toUpperCase()) {
            counts.set(inferred, (counts.get(inferred) ?? 0) + 1);
          }
        }
      }
    }

    return [...counts.entries()]
      .filter(([, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1]);
  }, [people]);

  if (familyCounts.length <= 1) return null;

  const activeLabel = activeFamily ?? "All families";

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 12,
          color: activeFamily ? "white" : "var(--ink-faded)",
          background: activeFamily ? "var(--moss)" : "rgba(246,241,231,0.76)",
          border: activeFamily ? "1px solid rgba(78,93,66,0.28)" : "1px solid var(--rule)",
          borderRadius: 999,
          padding: "5px 12px",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          boxShadow: "none",
          transition: "background 220ms cubic-bezier(0.22,0.61,0.36,1), border-color 220ms cubic-bezier(0.22,0.61,0.36,1)",
        }}
      >
        {activeLabel}
        <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 18 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 19,
              minWidth: 160,
              background: "rgba(246,241,231,0.96)",
              border: "1px solid var(--rule)",
              borderRadius: 10,
              boxShadow: "0 12px 32px rgba(28,25,21,0.1)",
              backdropFilter: "blur(12px)",
              padding: "6px 4px",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => { onSelectFamily(null); setOpen(false); }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: activeFamily === null ? "var(--moss)" : "var(--ink-soft)",
                background: activeFamily === null ? "rgba(78,93,66,0.1)" : "transparent",
                border: "none",
                borderRadius: 6,
                padding: "7px 10px",
                cursor: "pointer",
              }}
            >
              All families
            </button>
            {familyCounts.map(([family, count]) => (
              <button
                key={family}
                type="button"
                onClick={() => { onSelectFamily(family === activeFamily ? null : family); setOpen(false); }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  color: family === activeFamily ? "var(--moss)" : "var(--ink-soft)",
                  background: family === activeFamily ? "rgba(78,93,66,0.1)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "7px 10px",
                  cursor: "pointer",
                }}
              >
                {family} <span style={{ color: "var(--ink-faded)", fontSize: 10, marginLeft: 4 }}>({count})</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}