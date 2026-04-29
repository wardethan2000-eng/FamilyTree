"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { getApiBase } from "@/lib/api-base";

const API = getApiBase();

interface DupItem {
  id: string;
  originalFilename: string;
  mediaUrl: string | null;
  memoryId: string | null;
  memoryTitle: string | null;
}

interface DupGroup {
  checksum: string | null;
  perceptualHash: string | null;
  items: DupItem[];
}

export default function DuplicateReviewPage() {
  const { treeId, batchId } = useParams<{ treeId: string; batchId: string }>();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [groups, setGroups] = useState<DupGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/signin");
  }, [isPending, session, router]);

  const fetchDuplicates = useCallback(async () => {
    if (!treeId || !batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/api/trees/${treeId}/import-batches/${batchId}/duplicates`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Could not load duplicates.");
      const data = (await res.json()) as { groups: DupGroup[] };
      setGroups(data.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load duplicates.");
    } finally {
      setLoading(false);
    }
  }, [treeId, batchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchDuplicates();
  }, [fetchDuplicates]);

  async function handleAction(itemIds: string[], action: string, personId?: string) {
    if (!treeId || !batchId) return;
    const key = itemIds.join(",");
    setApplying((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(
        `${API}/api/trees/${treeId}/import-batches/${batchId}/items`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds, action, personId }),
        },
      );
      if (!res.ok) throw new Error("Action failed.");
      await fetchDuplicates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setApplying((prev) => ({ ...prev, [key]: false }));
    }
  }

  if (loading) {
    return (
      <main style={pageStyle}>
        <p style={hintStyle}>Loading duplicates...</p>
      </main>
    );
  }

  if (groups.length === 0) {
    return (
      <main style={pageStyle}>
        <div style={containerStyle}>
          <Link href={`/trees/${treeId}/import`} style={backLinkStyle}>
            Back to imports
          </Link>
          <h1 style={titleStyle}>No duplicates found</h1>
          <p style={leadStyle}>All items in this batch have been reviewed or have no duplicates.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <Link href={`/trees/${treeId}/import`} style={backLinkStyle}>
          Back to imports
        </Link>

        <header>
          <h1 style={titleStyle}>Review duplicates</h1>
          <p style={leadStyle}>
            These items look like duplicates. Choose which ones to keep, mark them as not duplicates, or skip them.
          </p>
        </header>

        {error && <p style={errorStyle}>{error}</p>}

        {groups.map((group, gi) => {
          const allIds = group.items.map((i) => i.id);
          const key = allIds.join(",");
          const isApplying = applying[key] ?? false;
          return (
            <section key={group.items.map((i) => i.id).join("-")} style={groupStyle}>
              <h3 style={groupTitleStyle}>
                Group {gi + 1} — {group.items.length} similar item{group.items.length === 1 ? "" : "s"}
                {group.perceptualHash && (
                  <span style={hashBadgeStyle}>hash: {group.perceptualHash.slice(0, 8)}</span>
                )}
              </h3>
              <div style={{ display: "grid", gap: 8 }}>
                {group.items.map((item) => (
                  <div key={item.id} style={itemRowStyle}>
                    {item.mediaUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.mediaUrl}
                        alt={item.originalFilename}
                        style={thumbStyle}
                      />
                    ) : (
                      <div style={thumbPlaceholderStyle}>No preview</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={fileNameStyle}>{item.originalFilename}</div>
                      {item.memoryTitle && (
                        <div style={memoryTitleStyle}>Memory: {item.memoryTitle}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleAction(allIds, "mark_not_duplicate")}
                  disabled={isApplying}
                  style={actionButtonStyle}
                >
                  Not duplicates
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(allIds, "mark_reviewed")}
                  disabled={isApplying}
                  style={skipButtonStyle}
                >
                  Keep all
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(allIds, "skip")}
                  disabled={isApplying}
                  style={skipButtonStyle}
                >
                  Skip all
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  color: "var(--ink)",
  padding: "48px 24px",
};
const containerStyle: CSSProperties = {
  width: "min(760px, 100%)",
  margin: "0 auto",
  display: "grid",
  gap: 24,
};
const backLinkStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-faded)",
  textDecoration: "none",
};
const titleStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 34,
  fontWeight: 400,
  margin: "0 0 8px",
};
const leadStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  lineHeight: 1.7,
  color: "var(--ink-soft)",
  margin: 0,
};
const groupStyle: CSSProperties = {
  background: "var(--paper-deep)",
  border: "1px solid var(--rule)",
  borderRadius: 12,
  padding: 20,
  display: "grid",
  gap: 12,
};
const groupTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 16,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const hashBadgeStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 11,
  fontWeight: 400,
  color: "var(--ink-faded)",
  background: "var(--paper)",
  border: "1px solid var(--rule)",
  borderRadius: 4,
  padding: "2px 6px",
};
const itemRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px",
  background: "var(--paper)",
  borderRadius: 8,
};
const thumbStyle: CSSProperties = {
  width: 64,
  height: 64,
  objectFit: "cover",
  borderRadius: 6,
  background: "var(--rule)",
};
const thumbPlaceholderStyle: CSSProperties = {
  width: 64,
  height: 64,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--rule)",
  borderRadius: 6,
  fontSize: 10,
  color: "var(--ink-faded)",
};
const fileNameStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 600,
};
const memoryTitleStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  color: "var(--ink-soft)",
};
const actionButtonStyle: CSSProperties = {
  border: "none",
  borderRadius: 8,
  background: "var(--moss)",
  color: "var(--paper)",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  fontWeight: 700,
  padding: "10px 16px",
  cursor: "pointer",
};
const skipButtonStyle: CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 8,
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  padding: "10px 16px",
  cursor: "pointer",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--ink-faded)",
};
const errorStyle: CSSProperties = {
  ...hintStyle,
  color: "var(--rose)",
};