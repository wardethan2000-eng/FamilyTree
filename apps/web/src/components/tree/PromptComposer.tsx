"use client";

import { useState, useEffect, useCallback } from "react";

interface Person {
  id: string;
  displayName: string;
  essenceLine?: string | null;
  portraitUrl?: string | null;
}

interface PromptComposerProps {
  open: boolean;
  onClose: () => void;
  treeId: string;
  people: Person[];
  apiBase?: string;
  defaultPersonId?: string;
  onPromptSent?: () => void;
}

const SUGGESTED_TEMPLATES = [
  "What is your earliest childhood memory?",
  "How did you meet your spouse?",
  "What was the hardest moment of your life, and how did you get through it?",
  "What traditions from your childhood do you wish had been passed down?",
  "Tell me about the place you grew up. What did it feel like?",
  "Who in the family had the biggest influence on you, and why?",
  "What do you want your grandchildren to know about you?",
  "What was your proudest moment?",
  "Describe a typical day from when you were young.",
  "Is there a family story you've always wanted to tell?",
];

export function PromptComposer({
  open,
  onClose,
  treeId,
  people,
  apiBase,
  defaultPersonId,
  onPromptSent,
}: PromptComposerProps) {
  const [selectedPersonId, setSelectedPersonId] = useState(defaultPersonId ?? "");
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const apiBase_ = apiBase ?? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000");

  useEffect(() => {
    if (open) {
      setSelectedPersonId(defaultPersonId ?? "");
      setQuestionText("");
      setError(null);
      setShowTemplates(false);
    }
  }, [open, defaultPersonId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    },
    [open, onClose],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (!selectedPersonId) {
      setError("Please choose who you're asking.");
      return;
    }
    if (!questionText.trim()) {
      setError("Please write your question.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase_}/api/trees/${treeId}/prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toPersonId: selectedPersonId, questionText: questionText.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "Failed to send prompt");
      }
      onPromptSent?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const selectedPerson = people.find((p) => p.id === selectedPersonId);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(28,25,21,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(540px, 95vw)",
          background: "var(--paper)",
          borderRadius: 16,
          boxShadow: "0 24px 64px rgba(28,25,21,0.22)",
          overflow: "hidden",
          animation: "promptSlideIn 350ms cubic-bezier(0.22, 0.61, 0.36, 1) both",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 400,
                color: "var(--ink)",
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Ask a question
            </h2>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--ink-faded)",
                margin: "4px 0 0",
              }}
            >
              Invite someone to share a memory or story.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-faded)",
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 4px",
              borderRadius: 4,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 28px 28px" }}>
          {/* Person selector */}
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-soft)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Who are you asking?
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 8,
              marginBottom: 20,
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {people.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPersonId(p.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 8px",
                  borderRadius: 10,
                  border: `1.5px solid ${selectedPersonId === p.id ? "var(--moss)" : "var(--rule)"}`,
                  background: selectedPersonId === p.id ? "rgba(78,93,66,0.07)" : "var(--paper)",
                  cursor: "pointer",
                  transition: "all 200ms",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "var(--paper-deep)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {p.portraitUrl ? (
                    <img
                      src={p.portraitUrl}
                      alt={p.displayName}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        color: "var(--ink-faded)",
                      }}
                    >
                      {p.displayName.charAt(0)}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    color: selectedPersonId === p.id ? "var(--moss)" : "var(--ink)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    fontWeight: selectedPersonId === p.id ? 500 : 400,
                  }}
                >
                  {p.displayName.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Question */}
          <label
            style={{
              display: "block",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--ink-soft)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Your question
            {selectedPerson && (
              <span
                style={{ color: "var(--moss)", textTransform: "none", fontWeight: 400, marginLeft: 4 }}
              >
                for {selectedPerson.displayName}
              </span>
            )}
          </label>
          <textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder="Write your question here…"
            rows={3}
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 10,
              border: "1.5px solid var(--rule)",
              background: "var(--paper)",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              color: "var(--ink)",
              resize: "vertical",
              outline: "none",
              transition: "border-color 200ms",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--moss)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--rule)")}
          />

          {/* Suggested prompts */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "var(--moss)",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 14 }}>{showTemplates ? "▾" : "▸"}</span>
              Suggested questions
            </button>
            {showTemplates && (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  maxHeight: 160,
                  overflowY: "auto",
                  padding: "4px 0",
                }}
              >
                {SUGGESTED_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setQuestionText(t);
                      setShowTemplates(false);
                    }}
                    style={{
                      background: "none",
                      border: "1px solid var(--rule)",
                      borderRadius: 6,
                      padding: "7px 10px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      fontSize: 13,
                      color: "var(--ink-soft)",
                      transition: "background 150ms",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(78,93,66,0.06)")
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: "var(--rose)",
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "1.5px solid var(--rule)",
                background: "none",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--ink-soft)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !selectedPersonId || !questionText.trim()}
              style={{
                padding: "9px 22px",
                borderRadius: 8,
                border: "none",
                background:
                  submitting || !selectedPersonId || !questionText.trim()
                    ? "var(--rule)"
                    : "var(--moss)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 500,
                color:
                  submitting || !selectedPersonId || !questionText.trim()
                    ? "var(--ink-faded)"
                    : "#fff",
                cursor:
                  submitting || !selectedPersonId || !questionText.trim()
                    ? "not-allowed"
                    : "pointer",
                transition: "background 200ms",
              }}
            >
              {submitting ? "Sending…" : "Send question"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes promptSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
