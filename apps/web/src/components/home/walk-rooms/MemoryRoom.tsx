"use client";

import Link from "next/link";
import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";
import { EASE, getHeroExcerpt, getVoiceTranscriptLabel } from "../homeUtils";

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

function getRelatedPeople(
  memory: TreeHomeMemory,
  peopleById: Map<string, TrailPerson>,
): TrailPerson[] {
  const ids = [
    memory.primaryPersonId,
    ...(memory.relatedPersonIds ?? []),
  ].filter((id): id is string => Boolean(id));
  const seen = new Set<string>();
  const result: TrailPerson[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const person = peopleById.get(id);
    if (person) result.push(person);
  }
  return result;
}

function getMemoryExcerpt(memory: TreeHomeMemory): string | null {
  if (memory.kind === "voice") return getVoiceTranscriptLabel(memory);
  if (memory.body?.trim()) return memory.body.trim();
  return null;
}

function NamePlate({
  light,
  personName,
  portraitUrl,
  onClick,
}: {
  light?: boolean;
  personName: string;
  portraitUrl?: string | null;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 10px 4px 6px",
        borderRadius: 999,
        border: "none",
        background: light ? "rgba(246,241,231,0.10)" : "rgba(246,241,231,0.06)",
        cursor: onClick ? "pointer" : "default",
        color: light ? "rgba(246,241,231,0.82)" : "var(--ink-soft)",
        fontFamily: "var(--font-ui)",
        fontSize: 12,
        transition: `background 200ms ${EASE}`,
      }}
    >
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={portraitUrl}
          alt=""
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: light ? "rgba(246,241,231,0.14)" : "var(--paper-deep)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: 10,
            color: light ? "rgba(246,241,231,0.70)" : "var(--ink-faded)",
          }}
        >
          {personName.charAt(0).toUpperCase()}
        </span>
      )}
      {personName}
    </button>
  );
}

export function MemoryRoom({
  memory,
  peopleById,
  memoryHref,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  peopleById: Map<string, TrailPerson>;
  memoryHref: string;
  onPersonClick: (personId: string) => void;
}) {
  const kind = memory.kind;
  const visualItems = getMemoryVisualItems(memory);
  const mediaUrl = visualItems[0]?.mediaUrl ?? null;
  const excerpt = getMemoryExcerpt(memory);
  const relatedPeople = getRelatedPeople(memory, peopleById);
  const usesMedia = Boolean(
    mediaUrl && (kind === "photo" || kind === "document"),
  );

  if (kind === "photo" && usesMedia) {
    return (
      <PhotoMemoryRoom
        memory={memory}
        mediaUrl={mediaUrl!}
        mediaCount={visualItems.length}
        excerpt={excerpt}
        relatedPeople={relatedPeople}
        memoryHref={memoryHref}
        onPersonClick={onPersonClick}
      />
    );
  }

  if (kind === "voice") {
    return (
      <VoiceMemoryRoom
        memory={memory}
        excerpt={excerpt}
        relatedPeople={relatedPeople}
        mediaUrl={mediaUrl}
        memoryHref={memoryHref}
        onPersonClick={onPersonClick}
      />
    );
  }

  if (kind === "document" && usesMedia) {
    return (
      <DocumentMemoryRoom
        memory={memory}
        mediaUrl={mediaUrl!}
        excerpt={excerpt}
        relatedPeople={relatedPeople}
        memoryHref={memoryHref}
        onPersonClick={onPersonClick}
      />
    );
  }

  return (
    <StoryMemoryRoom
      memory={memory}
      excerpt={excerpt}
      relatedPeople={relatedPeople}
      memoryHref={memoryHref}
      onPersonClick={onPersonClick}
    />
  );
}

function PhotoMemoryRoom({
  memory,
  mediaUrl,
  mediaCount,
  excerpt,
  relatedPeople,
  memoryHref,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  mediaUrl: string;
  mediaCount: number;
  excerpt: string | null;
  relatedPeople: TrailPerson[];
  memoryHref: string;
  onPersonClick: (personId: string) => void;
}) {
  return (
    <Link
      href={memoryHref}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        minHeight: "100vh",
        background: "#1c1915",
        textDecoration: "none",
        color: "inherit",
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl}
        alt={memory.title}
        onError={handleMediaError}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "sepia(14%) brightness(0.65)",
          animation: "kenBurnsSlow 30s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(28,25,21,0.10) 0%, rgba(28,25,21,0.08) 40%, rgba(28,25,21,0.70) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 900,
          padding: "clamp(32px, 6vw, 72px) max(20px, 5vw) clamp(36px, 7vw, 72px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(246,241,231,0.56)",
          }}
        >
          <span>Photo</span>
          {memory.dateOfEventText && (
            <>
              <span style={{ opacity: 0.42 }}>·</span>
              <span>{memory.dateOfEventText}</span>
            </>
          )}
          {mediaCount > 1 && (
            <>
              <span style={{ opacity: 0.42 }}>·</span>
              <span>{mediaCount} items</span>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 6vw, 64px)",
            lineHeight: 0.98,
            color: "rgba(246,241,231,0.97)",
            maxWidth: "13ch",
            textWrap: "balance",
          }}
        >
          {memory.title}
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          {memory.personName && (
            <NamePlate light personName={memory.personName} portraitUrl={memory.personPortraitUrl} />
          )}
          {relatedPeople.length > 0 &&
            relatedPeople.slice(0, 3).map((person) => (
              <NamePlate
                key={person.id}
                light
                personName={person.name}
                portraitUrl={person.portraitUrl}
                onClick={() => onPersonClick(person.id)}
              />
            ))}
        </div>

        {excerpt && (
          <p
            style={{
              margin: "18px 0 0",
              maxWidth: "56ch",
              fontFamily: "var(--font-body)",
              fontSize: 17,
              lineHeight: 1.82,
              color: "rgba(246,241,231,0.80)",
            }}
          >
            {excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}

function StoryMemoryRoom({
  memory,
  excerpt,
  relatedPeople,
  memoryHref,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  excerpt: string | null;
  relatedPeople: TrailPerson[];
  memoryHref: string;
  onPersonClick: (personId: string) => void;
}) {
  const truncatedBody =
    memory.body && memory.body.trim().length > 1800
      ? memory.body.trim().slice(0, 1800) + "…"
      : memory.body?.trim() ?? null;

  return (
    <Link
      href={memoryHref}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--paper)",
        textDecoration: "none",
        color: "inherit",
        padding: "clamp(48px, 8vw, 120px) max(24px, 6vw)",
      }}
    >
      <div
        style={{
          maxWidth: 680,
          width: "100%",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "var(--ink-faded)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span>Story</span>
          {memory.dateOfEventText && (
            <>
              <span style={{ opacity: 0.42 }}>·</span>
              <span>{memory.dateOfEventText}</span>
            </>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(32px, 5vw, 52px)",
            lineHeight: 1.02,
            color: "var(--ink)",
            maxWidth: "15ch",
            textWrap: "balance",
          }}
        >
          {memory.title}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
          }}
        >
          {memory.personName && (
            <NamePlate personName={memory.personName} portraitUrl={memory.personPortraitUrl} />
          )}
          {relatedPeople.length > 0 &&
            relatedPeople.slice(0, 3).map((person) => (
              <NamePlate
                key={person.id}
                personName={person.name}
                portraitUrl={person.portraitUrl}
                onClick={() => onPersonClick(person.id)}
              />
            ))}
        </div>

        {truncatedBody && (
          <div
            style={{
              marginTop: 32,
              fontFamily: "var(--font-body)",
              fontSize: 19,
              lineHeight: 1.8,
              color: "var(--ink-soft)",
              maxWidth: "65ch",
            }}
          >
            {truncatedBody.split("\n").map((paragraph, i) => (
              <p key={i} style={{ margin: "0 0 1em", textIndent: i > 0 ? "2em" : undefined }}>
                {paragraph}
              </p>
            ))}
            {memory.body && memory.body.trim().length > 1800 && (
              <div
                style={{
                  marginTop: 16,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  color: "var(--moss)",
                  fontStyle: "italic",
                }}
              >
                Continue reading →
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function VoiceMemoryRoom({
  memory,
  excerpt,
  relatedPeople,
  mediaUrl,
  memoryHref,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  excerpt: string | null;
  relatedPeople: TrailPerson[];
  mediaUrl: string | null;
  memoryHref: string;
  onPersonClick: (personId: string) => void;
}) {
  const isProcessing =
    memory.transcriptStatus === "queued" || memory.transcriptStatus === "processing";

  return (
    <Link
      href={memoryHref}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 25% 40%, rgba(78,93,66,0.14), transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(42,36,28,0.20), transparent 55%), var(--ink)",
        textDecoration: "none",
        color: "inherit",
        padding: "clamp(48px, 8vw, 120px) max(24px, 6vw)",
      }}
    >
      <div style={{ maxWidth: 600, width: "100%", textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(246,241,231,0.08)",
            border: "2px solid rgba(246,241,231,0.16)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            animation: "voiceRing 2s ease-out infinite",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: "rgba(246,241,231,0.80)",
            }}
          >
            ◉
          </span>
        </div>

        {mediaUrl && (
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(246,241,231,0.44)",
            }}
          >
            {isProcessing ? "Transcribing…" : "Voice recording"}
          </div>
        )}

        <div
          style={{
            marginTop: 24,
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(246,241,231,0.56)",
          }}
        >
          Voice · {memory.dateOfEventText ?? "Undated"}
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 5vw, 48px)",
            lineHeight: 1.02,
            color: "rgba(246,241,231,0.97)",
          }}
        >
          {memory.title}
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {memory.personName && (
            <NamePlate light personName={memory.personName} portraitUrl={memory.personPortraitUrl} />
          )}
          {relatedPeople.length > 0 &&
            relatedPeople.slice(0, 3).map((person) => (
              <NamePlate
                key={person.id}
                light
                personName={person.name}
                portraitUrl={person.portraitUrl}
                onClick={() => onPersonClick(person.id)}
              />
            ))}
        </div>

        {excerpt && (
          <p
            style={{
              margin: "28px auto 0",
              maxWidth: "56ch",
              fontFamily: "var(--font-body)",
              fontSize: 16,
              lineHeight: 1.8,
              color: "rgba(246,241,231,0.72)",
              fontStyle: "italic",
            }}
          >
            {excerpt.length > 500 ? excerpt.slice(0, 500) + "…" : excerpt}
          </p>
        )}
      </div>
    </Link>
  );
}

function DocumentMemoryRoom({
  memory,
  mediaUrl,
  excerpt,
  relatedPeople,
  memoryHref,
  onPersonClick,
}: {
  memory: TreeHomeMemory;
  mediaUrl: string;
  excerpt: string | null;
  relatedPeople: TrailPerson[];
  memoryHref: string;
  onPersonClick: (personId: string) => void;
}) {
  return (
    <Link
      href={memoryHref}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--paper)",
        textDecoration: "none",
        color: "inherit",
        padding: "clamp(48px, 8vw, 120px) max(24px, 6vw)",
      }}
    >
      <div
        style={{
          maxWidth: 600,
          width: "100%",
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(40,30,18,0.10)",
          overflow: "hidden",
          border: "1px solid var(--rule)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={memory.title}
          onError={handleMediaError}
          style={{
            width: "100%",
            maxHeight: "60vh",
            objectFit: "contain",
            background: "var(--paper-deep)",
          }}
        />

        <div style={{ padding: "20px 24px 24px" }}>
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--ink-faded)",
            }}
          >
            Document · {memory.dateOfEventText ?? "Undated"}
          </div>

          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 3vw, 32px)",
              lineHeight: 1.08,
              color: "var(--ink)",
            }}
          >
            {memory.title}
          </div>

          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
            }}
          >
            {memory.personName && (
              <NamePlate personName={memory.personName} portraitUrl={memory.personPortraitUrl} />
            )}
          </div>

          {excerpt && (
            <p
              style={{
                margin: "14px 0 0",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                lineHeight: 1.75,
                color: "var(--ink-soft)",
                maxWidth: "50ch",
              }}
            >
              {excerpt}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}