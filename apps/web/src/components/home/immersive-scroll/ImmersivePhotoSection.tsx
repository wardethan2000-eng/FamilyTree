"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { TreeHomeMemory } from "../homeTypes";

export function ImmersivePhotoSection({
  memory,
  mediaUrl,
  href,
}: {
  memory: TreeHomeMemory;
  mediaUrl: string;
  href: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0.15, 0.45], [0.35, 1]);
  const borderRadius = useTransform(scrollYProgress, [0.15, 0.45], [16, 0]);
  const captionOpacity = useTransform(scrollYProgress, [0.45, 0.6], [0, 1]);
  const captionY = useTransform(captionOpacity, [0, 1], [20, 0]);
  const vignetteOpacity = useTransform(scrollYProgress, [0.2, 0.5], [0, 1]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: "280vh" }}
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
        <motion.a
          href={href}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={memory.title}
            onError={handleMediaError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "sepia(8%) brightness(0.62)",
            }}
          />

          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(15,13,10,0.7) 100%), linear-gradient(180deg, rgba(15,13,10,0.2) 0%, rgba(15,13,10,0.05) 40%, rgba(15,13,10,0.05) 60%, rgba(15,13,10,0.85) 100%)",
              opacity: vignetteOpacity,
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
              pointerEvents: captionOpacity.get() > 0.5 ? "auto" : "none",
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
                <span>Photo</span>
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
      </div>
    </div>
  );
}

function handleMediaError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}