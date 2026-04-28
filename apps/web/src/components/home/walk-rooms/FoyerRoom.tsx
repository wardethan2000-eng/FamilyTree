"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";
import { EASE, getHeroExcerpt, isVideoMemory } from "../homeUtils";

interface FoyerRoomProps {
  treeName: string;
  featuredMemory: TreeHomeMemory | null;
  branchCue: string;
  memoryHref: string | null;
  branchHref: string | null;
  fullTreeHref: string;
  resurfacingCount: number;
  scaleLabel: string;
  historicalLabel: string;
  onDrift: () => void;
}

export function FoyerRoom({
  treeName,
  featuredMemory,
  branchCue,
  memoryHref,
  branchHref,
  fullTreeHref,
  resurfacingCount,
  scaleLabel,
  historicalLabel,
  onDrift,
}: FoyerRoomProps) {
  const mediaUrl = getProxiedMediaUrl(featuredMemory?.mediaUrl);
  const excerpt = getHeroExcerpt(featuredMemory);
  const isVideo = featuredMemory ? isVideoMemory(featuredMemory) : false;
  const usesMedia = Boolean(
    mediaUrl && featuredMemory?.kind === "photo",
  );

  const [contextVisible, setContextVisible] = useState(false);

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    const showContext = () => {
      clearTimeout(idleTimer);
      setContextVisible(false);
      idleTimer = setTimeout(() => setContextVisible(true), 3000);
    };
    const hideContext = () => {
      clearTimeout(idleTimer);
      setContextVisible(false);
      idleTimer = setTimeout(() => setContextVisible(true), 3000);
    };

    showContext();

    window.addEventListener("mousemove", hideContext);
    window.addEventListener("keydown", hideContext);
    window.addEventListener("wheel", hideContext, { passive: true });
    window.addEventListener("touchstart", hideContext, { passive: true });

    return () => {
      clearTimeout(idleTimer);
      window.removeEventListener("mousemove", hideContext);
      window.removeEventListener("keydown", hideContext);
      window.removeEventListener("wheel", hideContext);
      window.removeEventListener("touchstart", hideContext);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0f0d0a",
        overflow: "hidden",
      }}
    >
      {usesMedia && mediaUrl ? (
        <>
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
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(12%) brightness(0.55)",
              }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mediaUrl}
              alt={featuredMemory?.title ?? treeName}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "sepia(12%) brightness(0.55)",
                animation: "kenBurns 80s ease-in-out infinite",
                willChange: "transform",
              }}
            />
          )}
          {/* Cinematic vignette */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(15,13,10,0.10) 0%, rgba(15,13,10,0.55) 55%, rgba(15,13,10,0.92) 100%), linear-gradient(180deg, rgba(15,13,10,0.45) 0%, rgba(15,13,10,0.05) 35%, rgba(15,13,10,0.05) 55%, rgba(15,13,10,0.85) 100%)",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 18% 22%, rgba(201,161,92,0.18), transparent 28%), radial-gradient(circle at 80% 18%, rgba(78,93,66,0.16), transparent 24%), linear-gradient(180deg, #211d18 0%, #171410 100%)",
          }}
        />
      )}

      {/* Context overlay — bottom-left caption style */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "clamp(32px, 5vw, 64px) max(24px, 5vw)",
          background: "linear-gradient(180deg, transparent 0%, rgba(15,13,10,0.85) 40%)",
        }}
      >
        <div style={{ maxWidth: 760 }}>
          {/* Meta chip */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(246,241,231,0.40)",
              marginBottom: 10,
            }}
          >
            <span>Featured</span>
            <span>·</span>
            <span>{treeName}</span>
          </div>

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 5vw, 52px)",
              lineHeight: 1.08,
              color: "rgba(246,241,231,0.96)",
              maxWidth: "18ch",
              textWrap: "balance",
            }}
          >
            {featuredMemory?.title ?? treeName}
          </div>

          <div
            style={{
              marginTop: 10,
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              color: "rgba(246,241,231,0.50)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {(featuredMemory?.personName || featuredMemory?.dateOfEventText) && (
              <span>
                {featuredMemory?.personName ?? ""}
                {featuredMemory?.personName && featuredMemory?.dateOfEventText ? " · " : ""}
                {featuredMemory?.dateOfEventText ?? ""}
              </span>
            )}
            <span>{branchCue}</span>
          </div>

          {excerpt && (
            <p
              style={{
                margin: "12px 0 0",
                maxWidth: "55ch",
                fontFamily: "var(--font-body)",
                fontSize: 15,
                lineHeight: 1.7,
                color: "rgba(246,241,231,0.55)",
              }}
            >
              {excerpt}
            </p>
          )}

          {/* Action row */}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            {memoryHref && (
              <Link
                href={memoryHref}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink)",
                  background: "rgba(246,241,231,0.92)",
                  borderRadius: 999,
                  padding: "10px 16px",
                  textDecoration: "none",
                  transition: `background 200ms ${EASE}`,
                }}
              >
                Continue with this memory
              </Link>
            )}
            <button
              type="button"
              onClick={onDrift}
              style={{
                border: "none",
                background: "rgba(246,241,231,0.08)",
                padding: "10px 16px",
                borderRadius: 999,
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: 14,
                fontStyle: "italic",
                color: "rgba(246,241,231,0.68)",
                transition: `background 200ms ${EASE}`,
              }}
            >
              Drift through the archive
            </button>
          </div>

          {resurfacingCount > 1 && (
            <div
              style={{
                marginTop: 12,
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                color: "rgba(246,241,231,0.35)",
              }}
            >
              Quietly resurfacing from {resurfacingCount} featured memories.
            </div>
          )}
        </div>
      </div>

      {/* Context tooltip — top-right, minimal */}
      <div
        style={{
          position: "absolute",
          top: "clamp(20px, 3vw, 40px)",
          right: "max(20px, 4vw)",
          opacity: contextVisible ? 1 : 0,
          transform: contextVisible ? "translateY(0)" : "translateY(6px)",
          transition: `opacity 700ms ${EASE}, transform 700ms ${EASE}`,
          pointerEvents: contextVisible ? "auto" : "none",
          maxWidth: 360,
          padding: "10px 14px",
          borderRadius: 10,
          background: "rgba(246,241,231,0.92)",
          backdropFilter: "blur(8px)",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--ink-soft)",
        }}
      >
        {scaleLabel} · {historicalLabel}
      </div>
    </div>
  );
}