"use client";

import { use, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ElderComposer } from "@/components/elder/ElderComposer";

export default function ElderComposePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  useEffect(() => {
    // Web Share Target POSTs to this URL with FormData; capture via launch queue
    // when supported, otherwise look for query string title/text.
    const w = window as Window & {
      launchQueue?: { setConsumer: (cb: (params: unknown) => void) => void };
    };
    if (w.launchQueue) {
      try {
        w.launchQueue.setConsumer((p) => {
          const launchParams = p as { files?: FileSystemFileHandle[] };
          if (launchParams.files && launchParams.files.length) {
            launchParams.files[0]!
              .getFile()
              .then((f) => setSharedFile(f))
              .catch(() => {});
          }
        });
      } catch {}
    }
  }, []);

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Link href={`/elder/${encodeURIComponent(token)}`} style={backLinkStyle}>
          ← Back
        </Link>
        <ElderComposer token={token} initialFile={sharedFile} />
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
