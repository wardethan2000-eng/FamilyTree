"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type TreeEntry = {
  id: string;
  name: string;
  role: string;
};

export function ArchiveSwitcher({
  currentTreeId,
  currentTreeName,
}: {
  currentTreeId: string;
  currentTreeName: string;
}) {
  const [trees, setTrees] = useState<TreeEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTrees = async () => {
      try {
        const res = await fetch("/api/trees", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setTrees(data as TreeEntry[]);
        }
      } catch {}
    };
    void fetchTrees();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (trees.length <= 1) return null;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Switch archive"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "5px 10px",
          fontSize: 12,
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          borderRadius: 999,
          border: "1px solid var(--rule)",
          background: "var(--paper-deep)",
          color: "var(--ink)",
          cursor: "pointer",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        {currentTreeName}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : undefined }}
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 50,
            minWidth: 180,
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 4,
          }}
        >
          {trees.map((tree) => {
            const isCurrent = tree.id === currentTreeId;
            return (
              <Link
                key={tree.id}
                href={`/trees/${tree.id}/home`}
                role="option"
                aria-selected={isCurrent}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: isCurrent ? "var(--moss)" : "transparent",
                  color: isCurrent ? "#fff" : "var(--ink)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "none",
                  textAlign: "left",
                }}
              >
                {tree.name}
                {isCurrent && (
                  <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>current</span>
                )}
              </Link>
            );
          })}
          <div style={{ borderTop: "1px solid var(--rule)", margin: "4px 0" }} />
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--ink-faded)",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              textDecoration: "none",
              textAlign: "left",
            }}
          >
            All archives
          </Link>
        </div>
      )}
    </div>
  );
}