"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { VoiceRecorderField } from "@/components/tree/VoiceRecorderField";
import {
  presignElderUpload,
  submitElderMemory,
  uploadFileToPresigned,
  type ElderSubmitInput,
} from "@/lib/elder-api";

type Mode = "voice" | "story" | "photo";

const DRAFT_PREFIX = "tessera-elder-draft:";

export interface ElderComposerProps {
  token: string;
  promptId?: string;
  questionText?: string | null;
  subjectName?: string | null;
  initialFile?: File | null;
  onSubmitted?: (memory: { id: string; mediaUrl: string | null; kind: string }) => void;
}

export function ElderComposer({
  token,
  promptId,
  questionText,
  subjectName,
  initialFile,
  onSubmitted,
}: ElderComposerProps) {
  const [mode, setMode] = useState<Mode>(initialFile ? "photo" : "voice");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ mediaUrl: string | null; kind: string } | null>(null);

  const draftKey = useMemo(
    () => `${DRAFT_PREFIX}${token}:${promptId ?? "compose"}`,
    [token, promptId],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { body?: string; mode?: Mode };
      if (parsed.body) setBody(parsed.body);
      if (
        parsed.mode === "voice" ||
        parsed.mode === "story" ||
        parsed.mode === "photo"
      ) {
        if (!initialFile) setMode(parsed.mode);
      }
    } catch {}
  }, [draftKey, initialFile]);

  useEffect(() => {
    if (done) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ body, mode }));
    } catch {}
  }, [draftKey, body, mode, done]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitError(null);
      const needsFile = mode === "voice" || mode === "photo";
      if (needsFile && !file) {
        setSubmitError(
          mode === "voice"
            ? "Please record or upload your voice first."
            : "Please choose a photo to share.",
        );
        return;
      }
      if (mode === "story" && !body.trim()) {
        setSubmitError("Please type a few words to share.");
        return;
      }
      setSubmitting(true);
      try {
        const mediaIds: string[] = [];
        if (needsFile && file) {
          const { mediaId, uploadUrl } = await presignElderUpload(token, file);
          await uploadFileToPresigned(file, uploadUrl);
          mediaIds.push(mediaId);
        }
        const input: ElderSubmitInput = {
          kind: mode,
          body: body.trim() || undefined,
          mediaIds: mediaIds.length ? mediaIds : undefined,
        };
        const result = (await submitElderMemory(token, input, promptId)) as {
          id: string;
          mediaUrl: string | null;
          kind: string;
        };
        try {
          window.localStorage.removeItem(draftKey);
        } catch {}
        setDone({ mediaUrl: result.mediaUrl, kind: result.kind });
        onSubmitted?.(result);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not submit");
      } finally {
        setSubmitting(false);
      }
    },
    [body, draftKey, file, mode, onSubmitted, promptId, token],
  );

  if (done) {
    return (
      <div style={cardStyle}>
        <div style={checkStyle}>✓</div>
        <h2 style={headlineStyle}>Saved.</h2>
        <p style={leadStyle}>The family will see it soon.</p>
        {done.mediaUrl && done.kind === "photo" && (
          <img
            src={done.mediaUrl}
            alt="What you sent"
            style={{ marginTop: 12, maxWidth: "100%", borderRadius: 10 }}
          />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={cardStyle}>
      {questionText && (
        <>
          <p style={topMetaStyle}>
            {subjectName ? `About ${subjectName}` : "Your reply"}
          </p>
          <h1 style={questionStyle}>{questionText}</h1>
        </>
      )}

      <div style={modeRowStyle} role="tablist" aria-label="How would you like to reply">
        <ModeButton active={mode === "voice"} onClick={() => { setMode("voice"); setFile(null); }} icon="🎤" label="Speak" />
        <ModeButton active={mode === "story"} onClick={() => { setMode("story"); setFile(null); }} icon="✎" label="Type" />
        <ModeButton active={mode === "photo"} onClick={() => { setMode("photo"); setFile(null); }} icon="📷" label="Photo" />
      </div>

      {mode === "voice" && (
        <div style={primaryFieldStyle}>
          <VoiceRecorderField value={file} onChange={setFile} />
          <p style={hintStyle}>Tap the big button to record. Take your time.</p>
        </div>
      )}

      {mode === "story" && (
        <div style={primaryFieldStyle}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Write whatever comes to mind…"
            style={bigTextAreaStyle}
            autoFocus
          />
          <p style={hintStyle}>Any length is fine.</p>
        </div>
      )}

      {mode === "photo" && (
        <div style={primaryFieldStyle}>
          <label style={photoDropStyle}>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <span style={photoDropIconStyle}>📷</span>
            <span style={photoDropLabelStyle}>
              {file ? file.name : "Tap to choose a photo or video"}
            </span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Add a note (optional)…"
            style={smallTextAreaStyle}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          ...primaryButtonStyle,
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? "wait" : "pointer",
        }}
      >
        {submitting ? "Sending…" : promptId ? "Send my reply" : "Send memory"}
      </button>
      {submitError && <p style={errorStyle}>{submitError}</p>}
    </form>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{ ...modeButtonStyle, ...(active ? modeButtonActiveStyle : null) }}
    >
      <span style={modeIconStyle} aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

const cardStyle: CSSProperties = {
  width: "min(640px, 100%)",
  background: "var(--paper-deep)",
  border: "1px solid var(--rule)",
  borderRadius: 14,
  padding: "28px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};
const topMetaStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--ink-faded)",
};
const questionStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 28,
  fontWeight: 400,
  lineHeight: 1.25,
  color: "var(--ink)",
};
const headlineStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-display)",
  fontSize: 30,
  fontWeight: 400,
};
const leadStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-body)",
  fontSize: 18,
  lineHeight: 1.6,
  color: "var(--ink-soft)",
};
const modeRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 8,
};
const modeButtonStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  padding: "16px 8px",
  border: "1px solid var(--rule)",
  borderRadius: 12,
  background: "var(--paper)",
  color: "var(--ink-soft)",
  fontFamily: "var(--font-ui)",
  fontSize: 15,
  fontWeight: 500,
  cursor: "pointer",
};
const modeButtonActiveStyle: CSSProperties = {
  background: "var(--moss)",
  color: "#fff",
  borderColor: "var(--moss)",
};
const modeIconStyle: CSSProperties = { fontSize: 24, lineHeight: 1 };
const primaryFieldStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 10 };
const bigTextAreaStyle: CSSProperties = {
  width: "100%",
  border: "1px solid var(--rule)",
  borderRadius: 12,
  padding: "16px 14px",
  background: "var(--paper)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: 19,
  lineHeight: 1.55,
  resize: "vertical",
  minHeight: 180,
};
const smallTextAreaStyle: CSSProperties = { ...bigTextAreaStyle, fontSize: 16, minHeight: 70 };
const photoDropStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  padding: "32px 16px",
  border: "2px dashed var(--rule)",
  borderRadius: 12,
  background: "var(--paper)",
  cursor: "pointer",
  textAlign: "center",
};
const photoDropIconStyle: CSSProperties = { fontSize: 38, lineHeight: 1 };
const photoDropLabelStyle: CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 16,
  color: "var(--ink-soft)",
};
const primaryButtonStyle: CSSProperties = {
  marginTop: 6,
  border: "none",
  borderRadius: 12,
  padding: "18px 20px",
  background: "var(--moss)",
  color: "#fff",
  fontFamily: "var(--font-ui)",
  fontSize: 19,
  fontWeight: 600,
  cursor: "pointer",
};
const errorStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "#8B2F2F",
};
const hintStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "var(--ink-faded)",
  lineHeight: 1.5,
};
const checkStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "var(--moss)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 28,
  fontFamily: "var(--font-ui)",
};
