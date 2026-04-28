"use client";

import { useEffect, useRef, useState } from "react";
import type { AtriumMode } from "./AtriumModeRouter";

const MODE_OPTIONS: { value: AtriumMode; label: string; icon: string }[] = [
  { value: "scroll", label: "Scroll", icon: "↕" },
  { value: "gallery", label: "Gallery", icon: "▦" },
  { value: "filmstrip", label: "Filmstrip", icon: "≡" },
];

export function ViewModeDropdown({
  mode,
  onChange,
}: {
  mode: AtriumMode;
  onChange: (m: AtriumMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const current = (MODE_OPTIONS.find((o) => o.value === mode) ?? MODE_OPTIONS[0])!;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`View mode: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "6px 10px",
          fontSize: 11,
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          borderRadius: 6,
          border: "1px solid var(--rule)",
          background: "var(--paper-deep)",
          color: "var(--ink-faded)",
          cursor: "pointer",
          lineHeight: 1,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 13 }}>{current.icon}</span>
        {current.label}
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
          style={{ marginLeft: 2, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : undefined }}
        >
          <path
            d="M1 1L5 5L9 1"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 50,
            minWidth: 140,
            background: "var(--paper)",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            padding: 4,
          }}
        >
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="option"
              aria-selected={mode === opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                border: "none",
                background:
                  mode === opt.value ? "var(--moss)" : "transparent",
                color: mode === opt.value ? "#fff" : "var(--ink)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 15, width: 18, textAlign: "center" }}>
                {opt.icon}
              </span>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}