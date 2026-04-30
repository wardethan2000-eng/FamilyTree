"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getApiBase } from "@/lib/api-base";

const API = getApiBase();

interface DraftItem {
  itemKind: string;
  itemId: string;
  label: string;
}

interface DraftPerson {
  id: string;
  displayName: string;
  portraitMediaId: string | null;
}

interface Draft {
  name: string;
  description: string | null;
  scopeKind: string;
  scope: Record<string, string>;
  defaultViewMode: string;
  people: DraftPerson[];
  draftItems: DraftItem[];
  warnings: string[];
}

type Step = "choose" | "review" | "create";

export default function NewCollectionPage() {
  const params = useParams<{ treeId: string }>();
  const treeId = params?.treeId ?? "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionLoading } = useSession();

  const [step, setStep] = useState<Step>("choose");
  const [scopeKind, setScopeKind] = useState("person");
  const [personId, setPersonId] = useState("");
  const [people, setPeople] = useState<{ id: string; displayName: string }[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState("chapter");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!treeId) return;
    fetch(`${API}/api/trees/${treeId}/people`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPeople((d as { people: { id: string; displayName: string }[] }).people ?? []))
      .catch(() => {});
  }, [treeId]);

  useEffect(() => {
    const qp = searchParams?.get("personId");
    if (qp) {
      setPersonId(qp);
      setScopeKind("person");
    }
  }, [searchParams]);

  async function generateDraft() {
    if (scopeKind === "person" && !personId) return;
    setDrafting(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/trees/${treeId}/archive-collections/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeKind,
          scope: scopeKind === "person" ? { personId } : {},
          defaultViewMode: viewMode,
        }),
      });
      if (res.ok) {
        setDraft((await res.json()) as Draft);
        setStep("review");
      } else {
        const d = await res.json().catch(() => ({}));
        setErr((d as { error?: string }).error ?? "Failed to generate draft");
      }
    } finally {
      setDrafting(false);
    }
  }

  async function createCollection() {
    if (!draft) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/api/trees/${treeId}/archive-collections`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          scopeKind: draft.scopeKind,
          scopeJson: JSON.stringify(draft.scope),
          defaultViewMode: viewMode,
          visibility: "private",
          items: draft.draftItems.map((item, i) => ({
            itemKind: item.itemKind,
            itemId: item.itemId,
            sortOrder: i,
          })),
        }),
      });
      if (res.ok) {
        const d = (await res.json()) as { id: string };
        router.push(`/trees/${treeId}/collections/${d.id}`);
      } else {
        const d = await res.json().catch(() => ({}));
        setErr((d as { error?: string }).error ?? "Failed to create collection");
      }
    } finally {
      setCreating(false);
    }
  }

  if (sessionLoading) return null;
  if (!session?.user) {
    return <main style={{ padding: 32, fontFamily: "var(--font-ui)" }}>Please sign in.</main>;
  }

  return (
    <main style={{ padding: "32px 24px", maxWidth: 700, margin: "0 auto", fontFamily: "var(--font-ui)" }}>
      {step === "choose" && (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 24px" }}>Make a collection</h1>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--ink-soft)" }}>
              What is this collection about?
            </label>
            <select
              value={scopeKind}
              onChange={(e) => setScopeKind(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-deep)", color: "var(--ink)" }}
            >
              <option value="person">A person</option>
              <option value="couple">A couple</option>
              <option value="branch">A family branch</option>
              <option value="event">An event</option>
              <option value="place">A place</option>
              <option value="theme">A theme</option>
              <option value="manual">Manual selection</option>
            </select>
          </div>

          {scopeKind === "person" && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--ink-soft)" }}>
                Choose a person
              </label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-deep)", color: "var(--ink)" }}
              >
                <option value="">Select a person…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, color: "var(--ink-soft)" }}>
              Default viewing mode
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1px solid var(--rule)", borderRadius: 6, background: "var(--paper-deep)", color: "var(--ink)" }}
            >
              <option value="chapter">Chapter</option>
              <option value="drift">Drift</option>
              <option value="gallery">Gallery</option>
              <option value="storybook">Storybook</option>
            </select>
          </div>

          {err && <p style={{ color: "var(--red)", fontSize: 13 }}>{err}</p>}

          <button
            onClick={generateDraft}
            disabled={drafting || (scopeKind === "person" && !personId)}
            style={{
              padding: "10px 20px",
              background: "var(--moss)",
              color: "var(--paper)",
              border: "none",
              borderRadius: 6,
              fontSize: 14,
              cursor: drafting ? "not-allowed" : "pointer",
              opacity: drafting ? 0.6 : 1,
            }}
          >
            {drafting ? "Preparing draft…" : "Next: Review included items"}
          </button>
        </>
      )}

      {step === "review" && draft && (
        <>
          <h1 style={{ fontSize: 24, fontWeight: 400, margin: "0 0 24px" }}>Review collection</h1>

          <div style={{ padding: 16, border: "1px solid var(--rule)", borderRadius: 8, marginBottom: 20, background: "var(--paper)" }}>
            <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>{draft.name}</div>
            {draft.description && <div style={{ fontSize: 13, color: "var(--ink-faded)", marginBottom: 12 }}>{draft.description}</div>}
            <div style={{ fontSize: 11, color: "var(--ink-faded)", display: "flex", gap: 12 }}>
              <span>{draft.scopeKind}</span>
              <span>{draft.defaultViewMode} mode</span>
              <span>{draft.people.length} people</span>
              <span>{draft.draftItems.filter((i) => i.itemKind === "memory").length} memories</span>
            </div>
          </div>

          {draft.warnings.length > 0 && (
            <div style={{ padding: 12, border: "1px solid #e8c07a", borderRadius: 6, marginBottom: 16, background: "#fef9ef" }}>
              {draft.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 13, color: "#8a6d3b" }}>{w}</div>
              ))}
            </div>
          )}

          <h2 style={{ fontSize: 15, fontWeight: 500, margin: "0 0 8px" }}>Included items</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
            {draft.draftItems.map((item, i) => (
              <div
                key={i}
                style={{ padding: "8px 12px", background: "var(--paper-deep)", borderRadius: 4, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}
              >
                <span style={{
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 3,
                  background: item.itemKind === "person" ? "var(--moss)" : "var(--rule)",
                  color: item.itemKind === "person" ? "var(--paper)" : "var(--ink-soft)",
                }}>{item.itemKind}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {err && <p style={{ color: "var(--red)", fontSize: 13 }}>{err}</p>}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep("choose")}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "1px solid var(--rule)",
                borderRadius: 6,
                fontSize: 14,
                color: "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              Back
            </button>
            <button
              onClick={createCollection}
              disabled={creating}
              style={{
                padding: "10px 20px",
                background: "var(--moss)",
                color: "var(--paper)",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                cursor: creating ? "not-allowed" : "pointer",
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? "Creating…" : "Create collection"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}