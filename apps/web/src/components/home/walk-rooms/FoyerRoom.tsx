"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProxiedMediaUrl } from "@/lib/media-url";
import type { TreeHomeMemory } from "../homeTypes";
import { EASE, getHeroExcerpt } from "../homeUtils";

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
        overflow: "hidden",
        background: "#1c1915",
      }}
    >
      {usesMedia && mediaUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={featuredMemory?.title ?? treeName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "sepia(18%) brightness(0.6)",
              animation: "kenBurns 40s ease-in-out infinite",
              willChange: "transform",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(96deg, rgba(28,25,21,0.92) 0%, rgba(28,25,21,0.72) 42%, rgba(28,25,21,0.48) 100%), linear-gradient(180deg, rgba(28,25,21,0.16) 0%, rgba(28,25,21,0.5) 100%)",
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

      <div
        style={{
          position: "relative",
          padding: "clamp(28px, 6vw, 56px) max(20px, 5vw) clamp(36px, 7vw, 72px)",
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ maxWidth: 760 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(246,241,231,0.08)",
              backdropFilter: "blur(10px)",
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              color: "rgba(246,241,231,0.62)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            <span>Featured memory</span>
            <span style={{ opacity: 0.55 }}>·</span>
            <span>{treeName}</span>
          </div>

          <div
            style={{
              marginTop: 16,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px, 6vw, 58px)",
              lineHeight: 1.02,
              color: "rgba(246,241,231,0.96)",
              maxWidth: "15ch",
            }}
          >
            {featuredMemory?.title ?? treeName}
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              color: "rgba(246,241,231,0.72)",
            }}
          >
            {(featuredMemory?.personName || featuredMemory?.dateOfEventText) && (
              <span>
                {featuredMemory?.personName ?? ""}
                {featuredMemory?.personName && featuredMemory?.dateOfEventText ? " · " : ""}
                {featuredMemory?.dateOfEventText ?? ""}
              </span>
            )}
            <span
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                background: "rgba(246,241,231,0.08)",
              }}
            >
              {branchCue}
            </span>
          </div>

          {excerpt && (
            <p
              style={{
                margin: "18px 0 0",
                maxWidth: "60ch",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.8,
                color: "rgba(246,241,231,0.8)",
              }}
            >
              {excerpt}
            </p>
          )}

          <div
            style={{
              marginTop: 26,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {memoryHref && (
              <Link
                href={memoryHref}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--ink)",
                  background: "rgba(246,241,231,0.95)",
                  borderRadius: 999,
                  padding: "12px 18px",
                  textDecoration: "none",
                  transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
                }}
              >
                Continue with this memory
              </Link>
            )}

            {branchHref && (
              <Link
                href={branchHref}
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  color: "rgba(246,241,231,0.9)",
                  background: "rgba(246,241,231,0.08)",
                  border: "1px solid rgba(246,241,231,0.18)",
                  borderRadius: 999,
                  padding: "12px 18px",
                  textDecoration: "none",
                  transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
                }}
              >
                Follow this branch
              </Link>
            )}

            <Link
              href={fullTreeHref}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "rgba(246,241,231,0.9)",
                background: "rgba(246,241,231,0.08)",
                border: "1px solid rgba(246,241,231,0.18)",
                borderRadius: 999,
                padding: "12px 18px",
                textDecoration: "none",
                transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
              }}
            >
              Open full tree
            </Link>
          </div>

          <button
            type="button"
            onClick={onDrift}
            style={{
              marginTop: 16,
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontStyle: "italic",
              color: "rgba(246,241,231,0.76)",
            }}
          >
            Drift through the archive
          </button>

          {resurfacingCount > 1 && (
            <div
              style={{
                marginTop: 18,
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: "rgba(246,241,231,0.58)",
              }}
            >
              Quietly resurfacing from {resurfacingCount} featured memories.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "clamp(24px, 4vw, 48px)",
          right: "max(20px, 5vw)",
          opacity: contextVisible ? 1 : 0,
          transform: contextVisible ? "translateY(0)" : "translateY(8px)",
          transition: `opacity 700ms ${EASE}, transform 700ms ${EASE}`,
          pointerEvents: contextVisible ? "auto" : "none",
          maxWidth: 440,
          padding: "14px 18px",
          borderRadius: 12,
          background: "rgba(246,241,231,0.92)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(176,139,62,0.18)",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.65,
          color: "var(--ink-soft)",
        }}
      >
        {scaleLabel} · {historicalLabel}
      </div>
    </div>
  );
}