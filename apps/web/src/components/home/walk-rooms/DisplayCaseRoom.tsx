"use client";

import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";
import { EASE } from "../homeUtils";

interface TrailPerson {
  id: string;
  name: string;
  portraitUrl: string | null;
}

type VisualMediaItem = {
  mediaUrl: string | null;
  mimeType: string | null;
};

function getMemoryVisualItems(memory: TreeHomeMemory): VisualMediaItem[] {
  const items: VisualMediaItem[] = [];
  if (memory.mediaUrl) {
    items.push({ mediaUrl: getProxiedMediaUrl(memory.mediaUrl), mimeType: memory.mimeType ?? null });
  }
  if (memory.mediaItems) {
    for (const item of memory.mediaItems) {
      if (item.mediaUrl && !items.some((i) => i.mediaUrl === getProxiedMediaUrl(item.mediaUrl))) {
        items.push({ mediaUrl: getProxiedMediaUrl(item.mediaUrl), mimeType: item.mimeType ?? null });
      }
    }
  }
  return items;
}

function getMemoryExcerpt(memory: TreeHomeMemory): string | null {
  if (memory.kind === "voice") {
    if (memory.transcriptStatus === "completed" && memory.transcriptText) return memory.transcriptText;
    if (memory.transcriptStatus === "completed") return "Transcript unavailable.";
    if (memory.transcriptStatus === "queued" || memory.transcriptStatus === "processing") return "Transcribing…";
    return null;
  }
  if (memory.body?.trim()) return memory.body.trim();
  return null;
}

export function DisplayCaseRoom({
  title,
  description,
  memories,
  peopleById,
  onMemoryClick,
  onPersonClick,
}: {
  title: string;
  description: string;
  memories: TreeHomeMemory[];
  peopleById: Map<string, TrailPerson>;
  onMemoryClick: (memory: TreeHomeMemory) => void;
  onPersonClick: (personId: string) => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(48px, 8vw, 120px) max(20px, 5vw)",
        background: "var(--paper)",
      }}
    >
      <div style={{ maxWidth: 900, width: "100%" }}>
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--ink-faded)",
            marginBottom: 8,
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 15,
            fontStyle: "italic",
            lineHeight: 1.75,
            color: "var(--ink-soft)",
            marginBottom: 32,
            maxWidth: "60ch",
          }}
        >
          {description}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
            gap: "clamp(14px, 2.5vw, 22px)",
          }}
        >
          {memories.map((memory) => (
            <DisplayCaseCard
              key={memory.id}
              memory={memory}
              peopleById={peopleById}
              onMemoryClick={onMemoryClick}
              onPersonClick={onPersonClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DisplayCaseCard({
  memory,
  peopleById,
  onMemoryClick,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  peopleById: Map<string, TrailPerson>;
  onMemoryClick: (memory: TreeHomeMemory) => void;
  onPersonClick: (personId: string) => void;
}) {
  const visualItems = getMemoryVisualItems(memory);
  const mediaUrl = visualItems[0]?.mediaUrl ?? null;
  const excerpt = getMemoryExcerpt(memory);
  const isPhoto = memory.kind === "photo" && mediaUrl;

  return (
    <button
      type="button"
      onClick={() => onMemoryClick(memory)}
      style={{
        width: "100%",
        border: "1px solid rgba(122,108,88,0.14)",
        borderRadius: 14,
        background:
          "linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(244,237,226,0.92) 100%)",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
        color: "inherit",
        overflow: "hidden",
        transition: `box-shadow 300ms ${EASE}, border-color 300ms ${EASE}`,
      }}
    >
      {isPhoto ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3 / 2",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl!}
            alt={memory.title}
            onError={handleMediaError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(16%) sepia(8%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 50%, rgba(244,237,226,0.40) 100%)",
            }}
          />
        </div>
      ) : (
        <div style={{ padding: "14px 16px 0" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.10em",
              color: "var(--ink-faded)",
            }}
          >
            <span>{memory.dateOfEventText ?? "Undated"}</span>
          </div>
        </div>
      )}

      <div style={{ padding: "12px 16px 16px" }}>
        {isPhoto && (
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 10,
              textTransform: "uppercase" as const,
              letterSpacing: "0.10em",
              color: "var(--ink-faded)",
              marginBottom: 6,
            }}
          >
            {memory.dateOfEventText ?? "Undated"}
          </div>
        )}

        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(17px, 2.2vw, 21px)",
            lineHeight: 1.15,
            color: "var(--ink)",
          }}
        >
          {memory.title}
        </div>

        {memory.personName && (
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--ink-soft)",
            }}
          >
            {memory.personName}
          </div>
        )}

        {excerpt && !isPhoto && (
          <p
            style={{
              margin: "8px 0 0",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--ink-faded)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {excerpt}
          </p>
        )}
      </div>
    </button>
  );
}