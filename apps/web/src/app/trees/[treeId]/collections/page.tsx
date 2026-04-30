"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getApiBase } from "@/lib/api-base";

const API = getApiBase();

interface CollectionItem {
  id: string;
  itemKind: string;
  itemId: string;
  sortOrder: number;
  captionOverride: string | null;
  sectionId: string | null;
}

interface CollectionSection {
  id: string;
  title: string;
  body: string | null;
  sectionKind: string;
  sortOrder: number;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  scopeKind: string;
  defaultViewMode: string;
  visibility: string;
  introText: string | null;
  dedicationText: string | null;
  createdAt: string;
  updatedAt: string;
  sections: CollectionSection[];
  items: CollectionItem[];
}

export default function CollectionsPage() {
  const params = useParams<{ treeId: string }>();
  const treeId = params?.treeId ?? "";
  const { data: session, isPending: sessionLoading } = useSession();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!treeId) return;
    setLoading(true);
    setErr(null);
    const res = await fetch(`${API}/api/trees/${treeId}/archive-collections`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { collections: Collection[] };
      setCollections(data.collections);
    } else {
      const d = await res.json().catch(() => ({}));
      setErr((d as { error?: string }).error ?? "Failed to load collections");
    }
    setLoading(false);
  }, [treeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (sessionLoading) return null;
  if (!session?.user) {
    return <main style={{ padding: 32, fontFamily: "var(--font-ui)" }}>Please sign in.</main>;
  }

  return (
    <main style={{ padding: "32px 24px", maxWidth: 800, margin: "0 auto", fontFamily: "var(--font-ui)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 400, margin: 0 }}>Local Archives</h1>
        <Link
          href={`/trees/${treeId}/collections/new`}
          style={{
            fontSize: 13,
            padding: "8px 16px",
            background: "var(--moss)",
            color: "var(--paper)",
            borderRadius: 6,
            textDecoration: "none",
          }}
        >
          Make a collection
        </Link>
      </div>

      {err && <p style={{ color: "var(--red)" }}>{err}</p>}
      {loading && <p style={{ color: "var(--ink-faded)" }}>Loading…</p>}

      {!loading && collections.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink-faded)", border: "1px solid var(--rule)", borderRadius: 8 }}>
          <p style={{ margin: "0 0 12px" }}>No collections yet.</p>
          <p style={{ margin: 0, fontSize: 13 }}>
            Create a local archive for a person, branch, or event — then download it to open offline.
          </p>
        </div>
      )}

      {!loading && collections.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/trees/${treeId}/collections/${c.id}`}
              style={{
                display: "block",
                padding: "16px 20px",
                border: "1px solid var(--rule)",
                borderRadius: 8,
                background: "var(--paper)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{c.name}</div>
              {c.description && (
                <div style={{ fontSize: 13, color: "var(--ink-faded)", marginBottom: 8 }}>{c.description}</div>
              )}
              <div style={{ fontSize: 11, color: "var(--ink-faded)", display: "flex", gap: 12 }}>
                <span>{c.scopeKind}</span>
                <span>{c.items.length} items</span>
                <span>{c.defaultViewMode} mode</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}