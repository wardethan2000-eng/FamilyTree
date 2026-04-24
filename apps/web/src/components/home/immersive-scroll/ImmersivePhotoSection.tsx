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
  const borderRadius = useTransform(scrollYProgress, [0.1, 0.35], [16, 6]);
  const vignetteOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.1, 0.88, 1], [0, 1, 1, 0]);
  const contextOpacity = useTransform(scrollYProgress, [0.44, 0.56, 0.80, 0.92], [0, 1, 1, 0]);
  const contextX = useTransform(contextOpacity, [0, 1], [24, 0]);

  const isVideo = isVideoMemory(memory);
  const relatedPeople = getRelatedPeople(memory, people);
  const commentary = getMemoryCommentary(memory);
  const mediaCount = memory.mediaItems?.length ?? (memory.mediaUrl ? 1 : 0);

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
          background: "#0f0d0a",
        }}
      >
        {isVideo ? (
          <div
            style={{
              position: "absolute",
              inset: "-20%",
              overflow: "hidden",
              filter: "blur(50px) saturate(0.5) brightness(0.35)",
              transform: "scale(1.2)",
              zIndex: 0,
            }}
          >
            <video
              src={mediaUrl}
              muted
              playsInline
              autoPlay
              loop
              aria-hidden="true"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-20%",
              backgroundImage: `url(${mediaUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(50px) saturate(0.5) brightness(0.35)",
              transform: "scale(1.2)",
              zIndex: 0,
            }}
          />
        )}

        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 35% 50%, rgba(176,139,62,0.06), transparent 55%), " +
              "radial-gradient(ellipse at 75% 40%, rgba(78,93,66,0.05), transparent 45%), " +
              "rgba(15,13,10,0.68)",
            zIndex: 1,
          }}
        />

        <div
          className="immersive-layout"
          style={{
            position: "relative",
            zIndex: 2,
            display: "grid",
            gridTemplateColumns: "1fr clamp(200px, 22vw, 300px)",
            height: "100vh",
            alignItems: "center",
          }}
        >
          <motion.a
            href={href}
            aria-label={`Open ${memory.title}`}
            className="immersive-media-frame"
            style={{
              display: "block",
              position: "relative",
              width: "100%",
              height: "100%",
              scale,
              borderRadius,
              opacity: cardOpacity,
              overflow: "hidden",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            {isVideo ? (
              <video
                src={mediaUrl}
                muted
                playsInline
                autoPlay
                loop
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <>
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    backgroundImage: `url(${mediaUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(2px) brightness(0.35)",
                  }}
                />
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
                    objectFit: "contain",
                    filter: "sepia(6%) brightness(0.88)",
                  }}
                />
              </>
            )}

            <motion.div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at 50% 45%, transparent 40%, rgba(15,13,10,0.55) 100%), " +
                  "linear-gradient(180deg, rgba(15,13,10,0.14) 0%, rgba(15,13,10,0.02) 30%, rgba(15,13,10,0.02) 60%, rgba(15,13,10,0.75) 100%)",
                opacity: vignetteOpacity,
                pointerEvents: "none",
              }}
            />

            <motion.div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "clamp(28px, 5vw, 64px) clamp(28px, 4vw, 56px)",
                zIndex: 3,
              }}
            >
              <div style={{ maxWidth: 580 }}>
                <div
                  style={{
                    display: "inline-flex",
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
                  {mediaCount > 1 && (
                    <>
                      <span style={{ opacity: 0.42 }}>·</span>
                      <span>{mediaCount} items</span>
                    </>
                  )}
                  {memory.dateOfEventText && (
                    <>
                      <span style={{ opacity: 0.42 }}>·</span>
                      <span>{memory.dateOfEventText}</span>
                    </>
                  )}
                </div>

                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(22px, 3.5vw, 44px)",
                    lineHeight: 1.12,
                    color: "rgba(246,241,231,0.95)",
                    maxWidth: "16ch",
                    textWrap: "balance",
                  }}
                >
                  {memory.title}
                </div>
              </div>
            </motion.div>
          </motion.a>

          <motion.aside
            className="immersive-context-rail"
            style={{
              opacity: contextOpacity,
              x: contextX,
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "clamp(20px, 3vw, 40px) clamp(14px, 2vw, 28px)",
              gap: 16,
              pointerEvents: "auto",
            }}
          >
            {memory.primaryPersonId && (
              <button
                type="button"
                onClick={() => onPersonClick(memory.primaryPersonId!)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  border: "1px solid rgba(246,241,231,0.10)",
                  borderRadius: 10,
                  background: "rgba(15,13,10,0.48)",
                  backdropFilter: "blur(14px)",
                  color: "rgba(246,241,231,0.85)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  textAlign: "left",
                  transition: "background 200ms, border-color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(246,241,231,0.10)";
                  e.currentTarget.style.borderColor = "rgba(246,241,231,0.22)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(15,13,10,0.48)";
                  e.currentTarget.style.borderColor = "rgba(246,241,231,0.10)";
                }}
              >
                {memory.personPortraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memory.personPortraitUrl}
                    alt={memory.personName ?? ""}
                    style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: "50%",
                      background: "rgba(246,241,231,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      fontSize: 13,
                      color: "rgba(246,241,231,0.55)",
                      flexShrink: 0,
                    }}
                  >
                    {memory.personName?.charAt(0) ?? "?"}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                    {memory.personName ?? "View person"}
                  </div>
                  {memory.dateOfEventText && (
                    <div style={{ fontSize: 11, color: "rgba(246,241,231,0.40)", marginTop: 2 }}>
                      {memory.dateOfEventText}
                    </div>
                  )}
                </div>
              </button>
            )}

            {relatedPeople.length > 0 && (
              <div
                style={{
                  border: "1px solid rgba(246,241,231,0.07)",
                  borderRadius: 10,
                  background: "rgba(15,13,10,0.38)",
                  backdropFilter: "blur(10px)",
                  padding: "10px 10px 8px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(246,241,231,0.28)",
                    marginBottom: 6,
                  }}
                >
                  Tagged
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {relatedPeople.slice(0, 5).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onPersonClick(person.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "none",
                        borderRadius: 6,
                        background: "transparent",
                        color: "rgba(246,241,231,0.62)",
                        padding: "5px 6px",
                        cursor: "pointer",
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        textAlign: "left",
                        transition: "background 180ms, color 180ms",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(246,241,231,0.08)";
                        e.currentTarget.style.color = "rgba(246,241,231,0.92)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(246,241,231,0.62)";
                      }}
                    >
                      {person.portraitUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.portraitUrl}
                          alt={person.name}
                          style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "rgba(246,241,231,0.06)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-display)",
                            fontSize: 10,
                            color: "rgba(246,241,231,0.35)",
                            flexShrink: 0,
                          }}
                        >
                          {person.name.charAt(0)}
                        </div>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {person.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {commentary && (
              <div
                style={{
                  border: "1px solid rgba(246,241,231,0.07)",
                  borderRadius: 10,
                  background: "rgba(15,13,10,0.32)",
                  backdropFilter: "blur(8px)",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(246,241,231,0.28)",
                    marginBottom: 6,
                  }}
                >
                  Context
                </div>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    lineHeight: 1.65,
                    color: "rgba(246,241,231,0.58)",
                    display: "-webkit-box",
                    WebkitLineClamp: 6,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {commentary}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => onMemoryClick(memory)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                width: "100%",
                border: "1px solid rgba(246,241,231,0.10)",
                borderRadius: 10,
                background: "rgba(246,241,231,0.06)",
                color: "rgba(246,241,231,0.72)",
                padding: "9px 14px",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                letterSpacing: "0.04em",
                transition: "background 200ms, color 200ms",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(246,241,231,0.14)";
                e.currentTarget.style.color = "rgba(246,241,231,0.95)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(246,241,231,0.06)";
                e.currentTarget.style.color = "rgba(246,241,231,0.72)";
              }}
            >
              Open memory
            </button>
          </motion.aside>
        </div>

        <style jsx>{`
          @media (max-width: 1024px) {
            .immersive-layout {
              grid-template-columns: 1fr clamp(160px, 18vw, 240px) !important;
            }
          }
          @media (max-width: 768px) {
            .immersive-layout {
              grid-template-columns: 1fr !important;
            }
            .immersive-context-rail {
              display: none !important;
            }
          }
        `}</style>
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
    .slice(0, 5);
}

function getMemoryCommentary(memory: TreeHomeMemory): string | null {
  const text =
    memory.kind === "voice"
      ? memory.transcriptText?.trim() || memory.body?.trim()
      : memory.body?.trim() || memory.transcriptText?.trim();
  if (!text) return null;
  return text.length > 380 ? `${text.slice(0, 377).trimEnd()}...` : text;
}

function handleMediaError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}