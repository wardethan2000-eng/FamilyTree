"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AddMemoryWizard } from "@/components/tree/AddMemoryWizard";
import { PromptComposer } from "@/components/tree/PromptComposer";
import { Shimmer } from "@/components/ui/Shimmer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Person {
  id: string;
  displayName: string;
  essenceLine?: string | null;
  portraitUrl?: string | null;
}

interface Reply {
  id: string;
  kind: string;
  title: string;
  body?: string | null;
  mediaUrl?: string | null;
  dateOfEventText?: string | null;
}

interface Prompt {
  id: string;
  questionText: string;
  status: "pending" | "answered" | "dismissed";
  createdAt: string;
  toPersonId: string;
  personName: string | null;
  personPortraitUrl: string | null;
  fromUserName: string | null;
  fromUserId: string;
  replies?: Reply[];
}

const KIND_ICONS: Record<string, string> = {
  photo: "🖼",
  story: "📖",
  voice: "🎙",
  document: "📄",
  other: "✦",
};

const STATUS_LABEL: Record<Prompt["status"], string> = {
  pending: "Awaiting reply",
  answered: "Replied",
  dismissed: "Dismissed",
};

const STATUS_COLOR: Record<Prompt["status"], string> = {
  pending: "var(--gilt)",
  answered: "var(--moss)",
  dismissed: "var(--ink-faded)",
};

export default function InboxPage() {
  const params = useParams();
  const treeId = params.treeId as string;
  const router = useRouter();
  const { data: session } = useSession();

  const [inbox, setInbox] = useState<Prompt[]>([]);
  const [allPrompts, setAllPrompts] = useState<Prompt[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"inbox" | "all">("inbox");
  const [replyingToPrompt, setReplyingToPrompt] = useState<Prompt | null>(null);
  const [askingOpen, setAskingOpen] = useState(false);
  const [membership, setMembership] = useState<{ role: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [inboxRes, peopleRes] = await Promise.all([
        fetch(`${API}/api/trees/${treeId}/prompts/inbox`, { credentials: "include" }),
        fetch(`${API}/api/trees/${treeId}/people`, { credentials: "include" }),
      ]);

      if (inboxRes.ok) setInbox(await inboxRes.json());
      if (peopleRes.ok) {
        const pData = await peopleRes.json();
        setPeople(
          pData.map((p: { id: string; displayName: string; essenceLine?: string | null; portraitMediaId?: string | null; portraitUrl?: string | null }) => ({
            id: p.id,
            displayName: p.displayName,
            essenceLine: p.essenceLine,
            portraitUrl: p.portraitUrl ?? null,
          })),
        );
        // Check membership role (founder/steward can see all prompts)
        const treeRes = await fetch(`${API}/api/trees`, { credentials: "include" });
        if (treeRes.ok) {
          const trees = await treeRes.json();
          const myTree = (trees as Array<{ id: string; role: string }>).find((t) => t.id === treeId);
          if (myTree) setMembership({ role: myTree.role });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [treeId]);

  const fetchAllPrompts = useCallback(async () => {
    const res = await fetch(`${API}/api/trees/${treeId}/prompts`, { credentials: "include" });
    if (res.ok) setAllPrompts(await res.json());
  }, [treeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "all" && membership && ["founder", "steward"].includes(membership.role)) {
      fetchAllPrompts();
    }
  }, [activeTab, membership, fetchAllPrompts]);

  const handleDismiss = async (promptId: string) => {
    await fetch(`${API}/api/trees/${treeId}/prompts/${promptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
      credentials: "include",
    });
    setInbox((prev) =>
      prev.map((p) => (p.id === promptId ? { ...p, status: "dismissed" } : p)),
    );
  };

  const canSeeAll =
    membership && ["founder", "steward", "contributor"].includes(membership.role);
  const displayedPrompts = activeTab === "inbox" ? inbox : allPrompts;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        fontFamily: "var(--font-body)",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          background: "rgba(246,241,231,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => router.push(`/trees/${treeId}/atrium`)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-faded)",
            fontSize: 18,
            padding: "4px 8px",
            borderRadius: 6,
          }}
          title="Back to Atrium"
        >
          ⌂
        </button>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 400,
            color: "var(--ink)",
            margin: 0,
            flex: 1,
          }}
        >
          Inbox
        </h1>
        <button
          onClick={() => setAskingOpen(true)}
          style={{
            padding: "7px 16px",
            borderRadius: 8,
            border: "1.5px solid var(--moss)",
            background: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            color: "var(--moss)",
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          + Ask someone
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 0,
            borderBottom: "1px solid var(--rule)",
            marginBottom: 28,
          }}
        >
          {(["inbox", ...(canSeeAll ? ["all"] : [])] as Array<"inbox" | "all">).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 18px",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab ? "2px solid var(--ink)" : "2px solid transparent",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: activeTab === tab ? 500 : 400,
                color: activeTab === tab ? "var(--ink)" : "var(--ink-faded)",
                cursor: "pointer",
                marginBottom: -1,
                transition: "color 200ms",
                textTransform: "capitalize",
              }}
            >
              {tab === "inbox" ? `My inbox${inbox.length ? ` (${inbox.filter((p) => p.status === "pending").length})` : ""}` : "All prompts"}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <Shimmer key={i} height={110} borderRadius={12} />
            ))}
          </div>
        ) : displayedPrompts.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              color: "var(--ink-faded)",
              fontFamily: "var(--font-body)",
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>✦</p>
            <p style={{ fontSize: 16, marginBottom: 6 }}>
              {activeTab === "inbox"
                ? "No questions waiting for you."
                : "No prompts have been sent yet."}
            </p>
            <p style={{ fontSize: 14 }}>
              {activeTab === "inbox"
                ? "When someone asks you a question, it will appear here."
                : "Start a conversation by asking someone a question."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {displayedPrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                isOwn={activeTab === "all"}
                currentUserId={session?.user?.id}
                onReply={() => setReplyingToPrompt(prompt)}
                onDismiss={() => handleDismiss(prompt.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Reply via AddMemoryWizard */}
      {replyingToPrompt && (
        <AddMemoryWizard
          open={!!replyingToPrompt}
          onClose={() => setReplyingToPrompt(null)}
          treeId={treeId}
          people={people.map((p) => ({ id: p.id, name: p.displayName, portraitUrl: p.portraitUrl ?? null }))}
          defaultPersonId={replyingToPrompt.toPersonId}
          promptId={replyingToPrompt.id}
          promptQuestion={replyingToPrompt.questionText}
          onMemoryAdded={() => {
            setReplyingToPrompt(null);
            fetchData();
          }}
        />
      )}

      {/* Ask someone */}
      <PromptComposer
        open={askingOpen}
        onClose={() => setAskingOpen(false)}
        treeId={treeId}
        people={people}
        onPromptSent={fetchData}
      />
    </div>
  );
}

function PromptCard({
  prompt,
  isOwn,
  currentUserId,
  onReply,
  onDismiss,
}: {
  prompt: Prompt;
  isOwn: boolean;
  currentUserId?: string;
  onReply: () => void;
  onDismiss: () => void;
}) {
  const isRecipient = !isOwn;
  const canReply = isRecipient && prompt.status === "pending";
  const canDismiss = isRecipient && prompt.status === "pending";

  return (
    <div
      style={{
        background: prompt.status === "dismissed" ? "rgba(246,241,231,0.4)" : "var(--paper)",
        border: "1px solid var(--rule)",
        borderRadius: 12,
        padding: "18px 20px",
        opacity: prompt.status === "dismissed" ? 0.6 : 1,
        transition: "opacity 300ms",
      }}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        {/* Portrait */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--paper-deep)",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {prompt.personPortraitUrl ? (
            <img
              src={prompt.personPortraitUrl}
              alt={prompt.personName ?? ""}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-faded)" }}>
              {prompt.personName?.charAt(0) ?? "?"}
            </span>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "var(--ink-faded)",
              }}
            >
              {isOwn ? `Asked to ${prompt.personName ?? "someone"}` : `From ${prompt.fromUserName ?? "a family member"}`}
              {" · "}
              {new Date(prompt.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                fontWeight: 500,
                color: STATUS_COLOR[prompt.status],
                padding: "2px 8px",
                borderRadius: 20,
                border: `1px solid ${STATUS_COLOR[prompt.status]}`,
              }}
            >
              {STATUS_LABEL[prompt.status]}
            </span>
          </div>

          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--ink)",
              margin: "0 0 10px",
              lineHeight: 1.5,
            }}
          >
            {prompt.questionText}
          </p>

          {/* Replies */}
          {prompt.replies && prompt.replies.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {prompt.replies.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: "rgba(78,93,66,0.06)",
                    borderRadius: 8,
                    padding: "8px 12px",
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{KIND_ICONS[r.kind] ?? "✦"}</span>
                  <div>
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {r.title}
                    </span>
                    {r.dateOfEventText && (
                      <span
                        style={{
                          fontFamily: "var(--font-ui)",
                          fontSize: 11,
                          color: "var(--ink-faded)",
                          marginLeft: 8,
                        }}
                      >
                        {r.dateOfEventText}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          {(canReply || canDismiss) && (
            <div style={{ display: "flex", gap: 8 }}>
              {canReply && (
                <button
                  onClick={onReply}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 7,
                    border: "none",
                    background: "var(--moss)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Reply
                </button>
              )}
              {canDismiss && (
                <button
                  onClick={onDismiss}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 7,
                    border: "1.5px solid var(--rule)",
                    background: "none",
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: "var(--ink-faded)",
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
