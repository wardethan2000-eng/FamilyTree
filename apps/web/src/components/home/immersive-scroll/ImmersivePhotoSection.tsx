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

interface MemoryPalette {
  paper: string;
  wash: string;
  deep: string;
  accent: string;
  accentSoft: string;
  ink: string;
}

const MEMORY_PALETTES: MemoryPalette[] = [
  {
    paper: "#eadcc2",
    wash: "#b88d54",
    deep: "#332416",
    accent: "#80633b",
    accentSoft: "rgba(176,139,62,0.28)",
    ink: "#2b2117",
  },
  {
    paper: "#dfe4d1",
    wash: "#798764",
    deep: "#202719",
    accent: "#4e5d42",
    accentSoft: "rgba(78,93,66,0.30)",
    ink: "#202719",
  },
  {
    paper: "#ead2c8",
    wash: "#a85d5d",
    deep: "#351f1f",
    accent: "#8c4848",
    accentSoft: "rgba(168,93,93,0.26)",
    ink: "#2c1b1b",
  },
  {
    paper: "#d8dfdf",
    wash: "#6d8589",
    deep: "#17262a",
    accent: "#456267",
    accentSoft: "rgba(69,98,103,0.28)",
    ink: "#17262a",
  },
];

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

  const scale = useTransform(scrollYProgress, [0.1, 0.35], [0.36, 1]);
  const borderRadius = useTransform(scrollYProgress, [0.1, 0.35], [16, 22]);
  const mediaOpacity = useTransform(scrollYProgress, [0, 0.1, 0.88, 1], [0, 1, 1, 0]);
  const contextOpacity = useTransform(scrollYProgress, [0.28, 0.42, 0.78, 0.9], [0, 1, 1, 0]);
  const contextY = useTransform(contextOpacity, [0, 1], [18, 0]);
  const vignetteOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0.08, 0.72]);

  const isVideo = isVideoMemory(memory);
  const relatedPeople = getRelatedPeople(memory, people);
  const commentary = getMemoryCommentary(memory);
  const mediaCount = memory.mediaItems?.length ?? (memory.mediaUrl ? 1 : 0);
  const palette = getMemoryPalette(memory);

  return (
    <div
      ref={sectionRef}
      className="immersive-photo-section"
      style={{ position: "relative", height: "180vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
          background: palette.deep,
        }}
      >
        {isVideo ? (
          <video
            src={mediaUrl}
            muted
            playsInline
            autoPlay
            loop
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "-4%",
              width: "108%",
              height: "108%",
              objectFit: "cover",
              filter: "blur(46px) saturate(0.55) brightness(0.42)",
              opacity: 0.58,
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-4%",
              backgroundImage: `url(${mediaUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(46px) saturate(0.55) brightness(0.42)",
              opacity: 0.58,
            }}
          />
        )}

        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              `radial-gradient(ellipse at 18% 20%, ${palette.paper}c7, transparent 34%), ` +
              `radial-gradient(ellipse at 82% 24%, ${palette.accentSoft}, transparent 30%), ` +
              `radial-gradient(ellipse at 50% 100%, ${palette.deep}, transparent 62%), ` +
              `linear-gradient(135deg, ${palette.paper}d9 0%, ${palette.wash}a8 46%, ${palette.deep}d9 100%)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            mixBlendMode: "soft-light",
            opacity: 0.42,
          }}
        />

        <motion.a
          href={href}
          aria-label={`Open ${memory.title}`}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            zIndex: 3,
            width: "min(66vw, 1040px)",
            height: "min(80vh, 760px)",
            minWidth: "min(92vw, 420px)",
            transform: "translate(-50%, -50%)",
            scale,
            opacity: mediaOpacity,
            borderRadius,
            overflow: "hidden",
            border: `1px solid ${palette.accentSoft}`,
            background:
              `radial-gradient(ellipse at 50% 50%, rgba(255,250,238,0.18), ${palette.deep}5c), ${palette.deep}`,
            boxShadow:
              `0 34px 110px ${palette.deep}99, 0 0 0 12px rgba(255,250,238,0.12), inset 0 0 0 1px rgba(255,255,255,0.18)`,
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 14,
              zIndex: 3,
              border: "1px solid rgba(255,250,238,0.22)",
              borderRadius: 16,
              pointerEvents: "none",
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
                filter: "sepia(5%) brightness(0.9)",
              }}
            />
          )}
          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                `radial-gradient(ellipse at 50% 42%, transparent 52%, ${palette.deep}55 100%)`,
              opacity: vignetteOpacity,
              pointerEvents: "none",
            }}
          />
        </motion.a>

        <motion.div
          className="memory-title-context"
          style={{
            position: "absolute",
            zIndex: 4,
            left: "clamp(16px, 2.8vw, 48px)",
            top: "clamp(84px, 16vh, 150px)",
            width: "clamp(150px, 14vw, 260px)",
            opacity: contextOpacity,
            y: contextY,
          }}
        >
          <ContextKicker palette={palette}>
            {isVideo ? "Video memory" : "Photo memory"}
            {mediaCount > 1 ? ` / ${mediaCount} items` : ""}
          </ContextKicker>
          <h2
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 4vw, 54px)",
              lineHeight: 0.96,
              color: palette.ink,
              textWrap: "balance",
              textShadow: "0 1px 18px rgba(255,250,238,0.28)",
            }}
          >
            {memory.title}
          </h2>
          <button
            type="button"
            onClick={() => onMemoryClick(memory)}
            style={{
              marginTop: 18,
              border: `1px solid ${palette.accentSoft}`,
              borderRadius: 999,
              background: "rgba(255,250,238,0.46)",
              color: palette.ink,
              padding: "9px 13px",
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              fontWeight: 650,
              cursor: "pointer",
              backdropFilter: "blur(10px)",
            }}
          >
            Open memory
          </button>
        </motion.div>

        <motion.div
          className="memory-details-context"
          style={{
            position: "absolute",
            zIndex: 4,
            right: "clamp(16px, 2.8vw, 48px)",
            top: "clamp(100px, 18vh, 170px)",
            width: "clamp(150px, 14vw, 260px)",
            opacity: contextOpacity,
            y: contextY,
          }}
        >
          <ContextCard palette={palette}>
            <ContextKicker palette={palette}>Memory details</ContextKicker>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {memory.dateOfEventText && <MemoryFact label="Date" value={memory.dateOfEventText} />}
              {memory.personName && <MemoryFact label="Person" value={memory.personName} />}
              {memory.createdAt && <MemoryFact label="Added" value={formatAddedDate(memory.createdAt)} />}
            </div>
            {memory.primaryPersonId && (
              <button
                type="button"
                onClick={() => onPersonClick(memory.primaryPersonId!)}
                style={{
                  marginTop: 14,
                  border: `1px solid ${palette.accentSoft}`,
                  borderRadius: 999,
                  background: "rgba(255,250,238,0.42)",
                  color: palette.ink,
                  padding: "8px 12px",
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Visit person
              </button>
            )}
          </ContextCard>
        </motion.div>

        {(relatedPeople.length > 0 || commentary) && (
          <motion.div
            className="memory-people-context"
            style={{
              position: "absolute",
              zIndex: 4,
              right: "clamp(16px, 3.4vw, 64px)",
              bottom: "clamp(26px, 8vh, 76px)",
              width: "clamp(180px, 17vw, 320px)",
              opacity: contextOpacity,
              y: contextY,
            }}
          >
            <ContextCard palette={palette}>
              {relatedPeople.length > 0 && (
                <>
                  <ContextKicker palette={palette}>People in frame</ContextKicker>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {relatedPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => onPersonClick(person.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          border: `1px solid ${palette.accentSoft}`,
                          borderRadius: 999,
                          background: "rgba(255,250,238,0.48)",
                          color: palette.ink,
                          padding: person.portraitUrl ? "4px 9px 4px 4px" : "7px 10px",
                          fontFamily: "var(--font-ui)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {person.portraitUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={person.portraitUrl}
                            alt=""
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        )}
                        {person.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {commentary && (
                <p
                  style={{
                    margin: relatedPeople.length > 0 ? "16px 0 0" : 0,
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    lineHeight: 1.68,
                    color: palette.ink,
                  }}
                >
                  {commentary}
                </p>
              )}
            </ContextCard>
          </motion.div>
        )}

        <style jsx>{`
          @media (max-width: 1180px) {
            .memory-details-context,
            .memory-people-context {
              display: none !important;
            }

            .memory-title-context {
              width: min(30vw, 240px) !important;
            }
          }

          @media (max-width: 860px) {
            .memory-title-context {
              left: 18px !important;
              right: 18px !important;
              top: auto !important;
              bottom: 32px !important;
              width: auto !important;
            }
          }

          @media (max-height: 720px) {
            .memory-people-context {
              display: none !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

function ContextCard({
  palette,
  children,
}: {
  palette: MemoryPalette;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${palette.accentSoft}`,
        borderRadius: 18,
        background: "rgba(255,250,238,0.34)",
        boxShadow: `0 18px 60px ${palette.deep}40, inset 0 1px 0 rgba(255,255,255,0.28)`,
        backdropFilter: "blur(16px)",
        padding: "14px 16px",
      }}
    >
      {children}
    </div>
  );
}

function ContextKicker({
  palette,
  children,
}: {
  palette: MemoryPalette;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        color: palette.accent,
      }}
    >
      {children}
    </div>
  );
}

function MemoryFact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 10 }}>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(52,39,25,0.50)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          lineHeight: 1.45,
          color: "rgba(35,25,15,0.76)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function getMemoryPalette(memory: TreeHomeMemory): MemoryPalette {
  const basis = `${memory.id}:${memory.dateOfEventText ?? ""}:${memory.personName ?? ""}`;
  let hash = 0;
  for (let index = 0; index < basis.length; index += 1) {
    hash = (hash * 31 + basis.charCodeAt(index)) >>> 0;
  }
  return MEMORY_PALETTES[hash % MEMORY_PALETTES.length] ?? MEMORY_PALETTES[0]!;
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
  return text.length > 340 ? `${text.slice(0, 337).trimEnd()}...` : text;
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
