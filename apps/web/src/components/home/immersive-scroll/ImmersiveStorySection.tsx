"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { TreeHomeMemory } from "../homeTypes";

export function ImmersiveStorySection({
  memory,
  href,
}: {
  memory: TreeHomeMemory;
  href: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const bgOpacity = useTransform(scrollYProgress, [0.05, 0.2], [0, 1]);
  const contentOpacity = useTransform(scrollYProgress, [0.15, 0.28], [0, 1]);
  const contentY = useTransform(contentOpacity, [0, 1], [40, 0]);

  const truncatedBody =
    memory.body && memory.body.trim().length > 2200
      ? memory.body.trim().slice(0, 2200) + "…"
      : memory.body?.trim() ?? null;

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: "160vh" }}
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
        }}
      >
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--paper)",
            opacity: bgOpacity,
          }}
        />

        <motion.a
          href={href}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            maxWidth: 700,
            width: "100%",
            padding: "clamp(32px, 6vw, 80px) max(24px, 5vw)",
            textDecoration: "none",
            color: "inherit",
            opacity: contentOpacity,
            y: contentY,
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
              marginBottom: 18,
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
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px, 5vw, 48px)",
              lineHeight: 1.08,
              color: "var(--ink)",
              maxWidth: "15ch",
              textWrap: "balance",
            }}
          >
            {memory.title}
          </div>

          {memory.personName && (
            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--ink-soft)",
              }}
            >
              {memory.personName}
            </div>
          )}

          {truncatedBody && (
            <div
              style={{
                marginTop: 28,
                fontFamily: "var(--font-body)",
                fontSize: 19,
                lineHeight: 1.85,
                color: "var(--ink-soft)",
                maxWidth: "65ch",
              }}
            >
              {truncatedBody.split("\n").map((paragraph, i) => (
                <p
                  key={i}
                  style={{
                    margin: "0 0 1em",
                    textIndent: i > 0 ? "2em" : undefined,
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </div>
          )}
        </motion.a>
      </div>
    </div>
  );
}