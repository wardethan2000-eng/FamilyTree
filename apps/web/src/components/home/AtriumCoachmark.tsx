"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_PREFIX = "tessera_home_coachmark_dismissed_";

interface AtriumCoachmarkProps {
  treeId: string;
  treeName: string;
  onAddMemory: () => void;
  treeHref: string;
}

export function AtriumCoachmark({
  treeId,
  treeName,
  onAddMemory,
  treeHref,
}: AtriumCoachmarkProps) {
  // Start hidden to avoid SSR/CSR mismatch; decide after mount.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_PREFIX + treeId);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [treeId]);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_PREFIX + treeId, "1");
    } catch {
      // non-fatal
    }
    setVisible(false);
  };

  return (
    <section style={{ padding: "16px max(20px, 5vw) 0" }}>
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(78,93,66,0.28)",
          background:
            "linear-gradient(180deg, rgba(246,243,234,0.95) 0%, rgba(238,233,220,0.92) 100%)",
          borderRadius: 14,
          padding: "16px clamp(16px, 3vw, 22px) 18px",
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss welcome"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "transparent",
            border: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 20,
            color: "var(--ink-faded)",
            cursor: "pointer",
            lineHeight: 1,
            minHeight: 44,
            minWidth: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>

        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--ink-faded)",
          }}
        >
          Welcome to {treeName}
        </p>
        <h3
          style={{
            margin: "6px 0 0",
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--ink)",
          }}
        >
          A quick tour
        </h3>

        <ol
          style={{
            margin: "12px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <Step
            number="1"
            title="This is Home"
            body="The memories your family has shared surface here."
          />
          <Step
            number="2"
            title="The Family tree shows how everyone connects"
            body="Open it from the top nav any time."
          />
          <Step
            number="3"
            title="Add a memory or invite a relative"
            body="Start whenever you're ready — there's no wrong order."
          />
        </ol>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onAddMemory();
              dismiss();
            }}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              background: "var(--ink)",
              color: "white",
              border: "none",
              borderRadius: 999,
              padding: "10px 18px",
              cursor: "pointer",
              minHeight: 44,
            }}
          >
            Add a memory
          </button>
          <Link
            href={treeHref}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--moss)",
              textDecoration: "none",
              padding: "10px 4px",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Open the family tree →
          </Link>
          <button
            type="button"
            onClick={dismiss}
            style={{
              marginLeft: "auto",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              background: "transparent",
              border: "none",
              color: "var(--ink-faded)",
              cursor: "pointer",
              padding: "10px 8px",
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 999,
          background: "rgba(78,93,66,0.18)",
          color: "var(--moss)",
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          fontWeight: 600,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {number}
      </span>
      <div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--ink)",
            lineHeight: 1.4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 2,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--ink-soft)",
            lineHeight: 1.5,
          }}
        >
          {body}
        </div>
      </div>
    </li>
  );
}
