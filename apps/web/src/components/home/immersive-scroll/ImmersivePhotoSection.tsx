"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { TreeHomeMemory } from "../homeTypes";
import { isVideoMemory } from "../homeUtils";

interface TrailPerson {
  id: string;
  name: string;
  portraitUrl: string | null;
}

export function ImmersivePhotoSection({
  memory,
  mediaUrl,
  href,
  people,
  onPersonClick,
  onMemoryClick,
}: {
  memory: TreeHomeMemory;
  mediaUrl: string;
  href: string;
  people: TrailPerson[];
  onPersonClick: (personId: string) => void;
  onMemoryClick: (memory: TreeHomeMemory) => void;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0.1, 0.35], [0.35, 1]);
  const borderRadius = useTransform(scrollYProgress, [0.1, 0.35], [16, 0]);
  const captionOpacity = useTransform(scrollYProgress, [0.35, 0.48], [0, 1]);
  const captionY = useTransform(captionOpacity, [0, 1], [20, 0]);
  const vignetteOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.1, 0.88, 1], [0, 1, 1, 0]);
  const isVideo = isVideoMemory(memory);
  const relatedPeople = getRelatedPeople(memory, people);
  const commentary = getMemoryCommentary(memory);
  const mediaCount = memory.mediaItems?.length ?? (memory.mediaUrl ? 1 : 0);

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: "180vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, #e7dcc7 0%, #cdbb98 38%, #8d7450 100%)",
        }}
      >
        {/* Blurred backdrop from the media itself */}
        {isVideo ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              filter: "blur(50px) saturate(0.3) brightness(0.25)",
              transform: "scale(1.06)",
              zIndex: 0,
              opacity: 0.82,
            }}
          >
            <video
              src={mediaUrl}
              muted
              playsInline
              autoPlay
              loop
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${mediaUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(50px) saturate(0.3) brightness(0.25)",
              transform: "scale(1.06)",
              zIndex: 0,
              opacity: 0.82,
            }}
          />
        )}

        {/* Warm atmospheric overlay */}
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 18% 18%, rgba(255,248,227,0.62), transparent 36%), radial-gradient(ellipse at 80% 22%, rgba(118,93,56,0.30), transparent 34%), radial-gradient(ellipse at 50% 100%, rgba(55,40,24,0.36), transparent 58%), linear-gradient(135deg, rgba(239,229,208,0.86) 0%, rgba(157,128,80,0.56) 48%, rgba(62,46,29,0.56) 100%)",
            zIndex: 1,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            opacity: 0.34,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            mixBlendMode: "soft-light",
          }}
        />

        <motion.div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
            alignItems: "center",
            gap: "clamp(18px, 3vw, 40px)",
            position: "relative",
            zIndex: 2,
            width: "100%",
            height: "100%",
            scale,
            borderRadius,
            opacity: cardOpacity,
            padding: "clamp(18px, 4vw, 56px)",
            boxSizing: "border-box",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <a
            href={href}
            aria-label={`Open ${memory.title}`}
            style={{
              position: "relative",
              display: "block",
              width: "100%",
              height: "min(78vh, 760px)",
              minHeight: "min(58vh, 520px)",
              overflow: "hidden",
              borderRadius: 22,
              border: "1px solid rgba(77,57,31,0.24)",
              background:
                "linear-gradient(135deg, rgba(255,250,238,0.72), rgba(210,191,152,0.36))",
              boxShadow:
                "0 30px 90px rgba(45,31,16,0.34), inset 0 0 0 10px rgba(248,241,224,0.24)",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 14,
                border: "1px solid rgba(255,248,228,0.28)",
                borderRadius: 16,
                pointerEvents: "none",
                zIndex: 3,
              }}
            />
            {isVideo ? (
              <video
                src={mediaUrl}
                muted
                playsInline
                autoPlay
                loop
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(248,241,224,0.14), rgba(55,40,24,0.34))",
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl}
                alt={memory.title}
                onError={handleMediaError}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(248,241,224,0.14), rgba(55,40,24,0.34))",
                  filter: "sepia(6%) brightness(0.86)",
                }}
              />
            )}

            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at 50% 40%, transparent 48%, rgba(60,42,23,0.28) 100%)",
                opacity: vignetteOpacity,
                pointerEvents: "none",
              }}
            />
          </a>

          <motion.aside
            style={{
              alignSelf: "stretch",
              minHeight: "min(58vh, 520px)",
              maxHeight: "78vh",
              overflow: "auto",
              background:
                "linear-gradient(180deg, rgba(255,250,238,0.86) 0%, rgba(234,220,190,0.78) 100%)",
              border: "1px solid rgba(88,67,38,0.20)",
              borderRadius: 24,
              boxShadow:
                "0 22px 70px rgba(45,31,16,0.22), inset 0 1px 0 rgba(255,255,255,0.42)",
              padding: "clamp(18px, 2.4vw, 28px)",
              opacity: captionOpacity,
              y: captionY,
              color: "#342719",
              backdropFilter: "blur(18px)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(52,39,25,0.54)",
                marginBottom: 12,
              }}
            >
              <span>{isVideo ? "Video memory" : "Photo memory"}</span>
              {mediaCount > 1 && (
                <>
                  <span>·</span>
                  <span>{mediaCount} items</span>
                </>
              )}
            </div>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 3vw, 44px)",
                lineHeight: 1.05,
                color: "#24190f",
                textWrap: "balance",
              }}
            >
              {memory.title}
            </div>

            <div
              style={{
                marginTop: 18,
                display: "grid",
                gap: 10,
              }}
            >
              {memory.dateOfEventText && (
                <MemoryFact label="Date" value={memory.dateOfEventText} />
              )}
              {memory.personName && (
                <MemoryFact label="Primary person" value={memory.personName} />
              )}
              {memory.createdAt && (
                <MemoryFact label="Added" value={formatAddedDate(memory.createdAt)} />
              )}
            </div>

            {relatedPeople.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={sectionLabelStyle}>People in this memory</div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {relatedPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onPersonClick(person.id);
                      }}
                      style={{
                        border: "1px solid rgba(88,67,38,0.18)",
                        borderRadius: 999,
                        background: "rgba(255,252,242,0.62)",
                        padding: person.portraitUrl ? "4px 10px 4px 4px" : "7px 11px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        color: "#342719",
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        boxShadow: "0 4px 14px rgba(54,38,20,0.08)",
                      }}
                    >
                      {person.portraitUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.portraitUrl}
                          alt=""
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            objectFit: "cover",
                          }}
                        />
                      )}
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {commentary && (
              <div style={{ marginTop: 24 }}>
                <div style={sectionLabelStyle}>Commentary</div>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    lineHeight: 1.72,
                    color: "rgba(52,39,25,0.76)",
                  }}
                >
                  {commentary}
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: 26,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onMemoryClick(memory);
                }}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 650,
                  border: "1px solid rgba(52,39,25,0.22)",
                  borderRadius: 999,
                  background: "#342719",
                  color: "#fff8ea",
                  padding: "11px 15px",
                  cursor: "pointer",
                }}
              >
                Open memory
              </button>
              {memory.primaryPersonId && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPersonClick(memory.primaryPersonId!);
                  }}
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    border: "1px solid rgba(52,39,25,0.18)",
                    borderRadius: 999,
                    background: "rgba(255,252,242,0.62)",
                    color: "#342719",
                    padding: "11px 15px",
                    cursor: "pointer",
                  }}
                >
                  Visit person
                </button>
              )}
            </div>
          </motion.aside>
        </motion.div>

        <motion.div
          style={{
            position: "absolute",
            left: "clamp(18px, 4vw, 56px)",
            bottom: "clamp(16px, 3vw, 36px)",
            zIndex: 3,
            opacity: captionOpacity,
            y: captionY,
            display: "none",
          }}
        >
          <div style={{ maxWidth: 720 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(246,241,231,0.40)",
                marginBottom: 10,
              }}
            >
              <span>{isVideo ? "Video" : "Photo"}</span>
              {memory.dateOfEventText && (
                <>
                  <span>·</span>
                  <span>{memory.dateOfEventText}</span>
                </>
              )}
            </div>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 4vw, 48px)",
                lineHeight: 1.12,
                color: "rgba(246,241,231,0.95)",
                maxWidth: "18ch",
                textWrap: "balance",
              }}
            >
              {memory.title}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const sectionLabelStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "rgba(52,39,25,0.48)",
} as const;

function MemoryFact({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "82px 1fr",
        gap: 12,
        alignItems: "baseline",
      }}
    >
      <div style={sectionLabelStyle}>{label}</div>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 14,
          lineHeight: 1.5,
          color: "rgba(52,39,25,0.76)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function getRelatedPeople(memory: TreeHomeMemory, people: TrailPerson[]) {
  const personIds = [
    memory.primaryPersonId,
    ...(memory.relatedPersonIds ?? []),
  ].filter((id): id is string => Boolean(id));
  const uniqueIds = [...new Set(personIds)];
  return uniqueIds
    .map((personId) => people.find((person) => person.id === personId))
    .filter((person): person is TrailPerson => Boolean(person))
    .slice(0, 6);
}

function getMemoryCommentary(memory: TreeHomeMemory): string | null {
  const text =
    memory.kind === "voice"
      ? memory.transcriptText?.trim() || memory.body?.trim()
      : memory.body?.trim() || memory.transcriptText?.trim();
  if (!text) return null;
  return text.length > 420 ? `${text.slice(0, 417).trimEnd()}...` : text;
}

function formatAddedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function handleMediaError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}
