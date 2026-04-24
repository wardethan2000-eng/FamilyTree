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
  const contextOpacity = useTransform(scrollYProgress, [0.44, 0.56, 0.80, 0.92], [0, 1, 1, 0]);
  const contextX = useTransform(contextOpacity, [0, 1], [24, 0]);

  const isVideo = isVideoMemory(memory);
  const relatedPeople = getRelatedPeople(memory, people);
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
          <motion.div
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
              "radial-gradient(ellipse at 30% 40%, rgba(176,139,62,0.08), transparent 55%), " +
              "radial-gradient(ellipse at 70% 60%, rgba(78,93,66,0.06), transparent 50%), " +
              "rgba(15,13,10,0.72)",
            zIndex: 1,
          }}
        />

        <motion.a
          href={href}
          aria-label={`Open ${memory.title}`}
          style={{
            display: "block",
            position: "relative",
            zIndex: 2,
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
                width: "100%",
                height: "100%",
                objectFit: "cover",
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
                objectFit: "cover",
                filter: "sepia(6%) brightness(0.72)",
              }}
            />
          )}

          <motion.div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(15,13,10,0.65) 100%), " +
                "linear-gradient(180deg, rgba(15,13,10,0.18) 0%, rgba(15,13,10,0.04) 35%, rgba(15,13,10,0.04) 55%, rgba(15,13,10,0.82) 100%)",
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
              padding: "clamp(28px, 5vw, 64px) max(24px, 5vw)",
              opacity: captionOpacity,
              y: captionY,
            }}
          >
            <div style={{ maxWidth: 640 }}>
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
                  fontSize: "clamp(24px, 4vw, 48px)",
                  lineHeight: 1.12,
                  color: "rgba(246,241,231,0.95)",
                  maxWidth: "18ch",
                  textWrap: "balance",
                }}
              >
                {memory.title}
              </div>

              {memory.personName && (
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    color: "rgba(246,241,231,0.50)",
                  }}
                >
                  {memory.personName}
                </div>
              )}
            </div>
          </motion.div>
        </motion.a>

        {(relatedPeople.length > 0 || memory.primaryPersonId) && (
          <motion.div
            className="immersive-context-rail"
            style={{
              position: "absolute",
              zIndex: 3,
              right: "clamp(16px, 3vw, 48px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: "clamp(140px, 12vw, 220px)",
              opacity: contextOpacity,
              x: contextX,
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
                  border: "1px solid rgba(246,241,231,0.12)",
                  borderRadius: 12,
                  background: "rgba(15,13,10,0.52)",
                  backdropFilter: "blur(16px)",
                  color: "rgba(246,241,231,0.85)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  marginBottom: relatedPeople.length > 0 ? 12 : 0,
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  textAlign: "left",
                  transition: "background 200ms, border-color 200ms",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(246,241,231,0.12)";
                  e.currentTarget.style.borderColor = "rgba(246,241,231,0.24)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(15,13,10,0.52)";
                  e.currentTarget.style.borderColor = "rgba(246,241,231,0.12)";
                }}
              >
                {memory.personPortraitUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={memory.personPortraitUrl}
                    alt={memory.personName ?? ""}
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(246,241,231,0.10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: "var(--font-display)",
                      fontSize: 12,
                      color: "rgba(246,241,231,0.60)",
                      flexShrink: 0,
                    }}
                  >
                    {memory.personName?.charAt(0) ?? "?"}
                  </div>
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {memory.personName ?? "View person"}
                </span>
              </button>
            )}

            {relatedPeople.length > 0 && (
              <div
                style={{
                  border: "1px solid rgba(246,241,231,0.08)",
                  borderRadius: 12,
                  background: "rgba(15,13,10,0.44)",
                  backdropFilter: "blur(12px)",
                  padding: "10px 10px 8px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "rgba(246,241,231,0.32)",
                    marginBottom: 6,
                  }}
                >
                  People in frame
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {relatedPeople.slice(0, 4).map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onPersonClick(person.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        border: "none",
                        borderRadius: 8,
                        background: "transparent",
                        color: "rgba(246,241,231,0.68)",
                        padding: "4px 6px",
                        cursor: "pointer",
                        fontFamily: "var(--font-ui)",
                        fontSize: 12,
                        textAlign: "left",
                        transition: "background 180ms, color 180ms",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(246,241,231,0.08)";
                        e.currentTarget.style.color = "rgba(246,241,231,0.95)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "rgba(246,241,231,0.68)";
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
                            background: "rgba(246,241,231,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: "var(--font-display)",
                            fontSize: 10,
                            color: "rgba(246,241,231,0.42)",
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
          </motion.div>
        )}

        <style jsx>{`
          @media (max-width: 900px) {
            .immersive-context-rail {
              right: 12px !important;
              width: clamp(120px, 40vw, 180px) !important;
            }
          }
          @media (max-width: 640px) {
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

function handleMediaError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}