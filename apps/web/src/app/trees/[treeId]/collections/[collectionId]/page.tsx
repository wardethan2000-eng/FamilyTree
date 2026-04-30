"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  includeContext: boolean;
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

export default function CollectionDetailPage() {
  const params = useParams<{ treeId: string; collectionId: string }>();
  const treeId = params?.treeId ?? "";
  const collectionId = params?.collectionId ?? "";
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    if (!treeId || !collectionId) return;
    setLoading(true);
    setErr(null);
    const res = await fetch(
      `${API}/api/trees/${treeId}/archive-collections/${collectionId}`,
      { credentials: "include" },
    );
    if (res.ok) {
      const data = (await res.json()) as { collection: Collection };
      setCollection(data.collection);
    } else {
      const d = await res.json().catch(() => ({}));
      setErr((d as { error?: string }).error ?? "Failed to load collection");
    }
    setLoading(false);
  }, [treeId, collectionId]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleExport() {
    if (!collection) return;
    setExporting(true);
    try {
      const res = await fetch(
        `${API}/api/trees/${treeId}/archive-collections/${collectionId}/export`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outputKind: "mini_zip" }),
        },
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${collection.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_archive.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1000);
      } else {
        const d = await res.json().catch(() => ({}));
        setErr((d as { error?: string }).error ?? "Export failed");
      }
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(
        `${API}/api/trees/${treeId}/archive-collections/${collectionId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.ok) {
        router.push(`/trees/${treeId}/collections`);
      } else {
        const d = await res.json().catch(() => ({}));
        setErr((d as { error?: string }).error ?? "Delete failed");
      }
    } finally {
      setDeleting(false);
    }
  }

  async function removeItem(itemId: string) {
    await fetch(
      `${API}/api/trees/${treeId}/archive-collections/${collectionId}/items/${itemId}`,
      { method: "DELETE", credentials: "include" },
    );
    void refresh();
  }

  if (sessionLoading) return null;
  if (!session?.user) {
    return <main style={{ padding: 32, fontFamily: "var(--font-ui)" }}>Please sign in.</main>;
  }

  if (loading) {
    return <main style={{ padding: 32, fontFamily: "var(--font-ui)", color: "var(--ink-faded)" }}>Loading…</main>;
  }

  if (!collection) {
    return <main style={{ padding: 32, fontFamily: "var(--font-ui)" }}>Collection not found.</main>;
  }

  const personItems = collection.items.filter((i) => i.itemKind === "person");
  const memoryItems = collection.items.filter((i) => i.itemKind === "memory");

  return (
    <main style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto", fontFamily: "var(--font-ui)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 4px" }}>{collection.name}</h1>
          {collection.description && (
            <div style={{ fontSize: 14, color: "var(--ink-faded)", marginTop: 4 }}>{collection.description}</div>
          )}
        </div>
        <span style={{
          fontSize: 11,
          padding: "4px 8px",
          borderRadius: 4,
          background: "var(--paper-deep)",
          color: "var(--ink-faded)",
          border: "1px solid var(--rule)",
        }}>
          {collection.scopeKind}
        </span>
      </div>

      {err && <p style={{ color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{err}</p>}

      {collection.introText && (
        <div style={{ marginBottom: 16, padding: 12, background: "var(--paper-deep)", borderRadius: 6, fontSize: 14, lineHeight: 1.6 }}>
          {collection.introText}
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
        People ({personItems.length})
      </div>
      {personItems.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-faded)", marginBottom: 20 }}>No people included.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {personItems.map((item) => (
            <span
              key={item.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                background: "var(--paper-deep)",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              {item.itemId.slice(0, 8)}…
              <button
                onClick={() => removeItem(item.id)}
                style={{ background: "none", border: "none", color: "var(--ink-faded)", cursor: "pointer", fontSize: 14, padding: 0 }}
                title="Remove"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
        Memories ({memoryItems.length})
      </div>
      {memoryItems.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--ink-faded)", marginBottom: 20 }}>No memories included.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
          {memoryItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--paper-deep)",
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1 }}>
                {item.captionOverride ?? `Memory ${item.itemId.slice(0, 8)}`}
              </span>
              <button
                onClick={() => removeItem(item.id)}
                style={{ background: "none", border: "none", color: "var(--ink-faded)", cursor: "pointer", fontSize: 14, padding: 0 }}
                title="Remove"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {collection.sections.length > 0 && (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: "var(--ink-soft)", fontWeight: 500 }}>
            Sections ({collection.sections.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {collection.sections.map((s) => (
              <div key={s.id} style={{ padding: "8px 12px", background: "var(--paper-deep)", borderRadius: 4, fontSize: 13 }}>
                <span style={{ color: "var(--ink-faded)", fontSize: 10, marginRight: 6 }}>{s.sectionKind}</span>
                {s.title}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{
        padding: 16,
        border: "1px solid var(--rule)",
        borderRadius: 8,
        background: "var(--paper)",
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>
          This archive will open without signing in. Anyone with the downloaded files can view what is included.
          Local archives cannot be revoked after download.
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || collection.items.length === 0}
          style={{
            padding: "10px 20px",
            background: "var(--moss)",
            color: "var(--paper)",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            cursor: exporting ? "not-allowed" : "pointer",
            opacity: exporting ? 0.6 : 1,
            width: "100%",
          }}
        >
          {exporting ? "Preparing download…" : "Download local archive"}
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ background: "none", border: "none", color: "var(--ink-faded)", fontSize: 12, cursor: "pointer" }}
          >
            Delete this collection
          </button>
        ) : (
          <div style={{ fontSize: 13 }}>
            <span style={{ color: "var(--red)", marginRight: 12 }}>Are you sure?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: "4px 12px",
                background: "var(--red)",
                color: "white",
                border: "none",
                borderRadius: 4,
                fontSize: 12,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.6 : 1,
                marginRight: 8,
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: "4px 12px",
                background: "none",
                border: "1px solid var(--rule)",
                borderRadius: 4,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </main>
  );
}