"use client";

import { use, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ElderComposer } from "@/components/elder/ElderComposer";
import { fetchInbox, type ElderInbox } from "@/lib/elder-api";

export default function ElderReplyPage({
  params,
}: {
  params: Promise<{ token: string; promptId: string }>;
}) {
  const { token, promptId } = use(params);
  const [inbox, setInbox] = useState<ElderInbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInbox(token).then(setInbox).catch((e: Error) => setError(e.message));
  }, [token]);

  const prompt = inbox?.pendingPrompts.find((p) => p.id === promptId);

  if (error) {
    return (
      <main style={pageStyle}>
        <p style={errStyle}>{error}</p>
      </main>
    );
  }
  if (!inbox) {
    return (
      <main style={pageStyle}>
        <p style={hintStyle}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Link href={`/elder/${encodeURIComponent(token)}`} style={backLinkStyle}>
          ← Back
        </Link>
        <ElderComposer
          token={token}
          promptId={promptId}
          questionText={prompt?.questionText ?? "Share a memory"}
          subjectName={inbox.associatedPerson?.name ?? null}
        />
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  padding: "24px 16px 80px",
  display: "flex",
  justifyContent: "center",
};
const containerStyle: CSSProperties = {
  width: "min(640px, 100%)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};
const backLinkStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  color: "var(--ink-soft)",
  textDecoration: "none",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "var(--ink-faded)",
};
const errStyle: CSSProperties = {
  ...hintStyle,
  color: "#8B2F2F",
};
