"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { TreeHomeMemory } from "../homeTypes";

export function ImmersiveVoiceSection({
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

  const contentOpacity = useTransform(scrollYProgress, [0.1, 0.22], [0, 1]);
  const contentY = useTransform(contentOpacity, [0, 1], [40, 0]);

  const transcript =
    memory.transcriptStatus === "completed" && memory.transcriptText
      ? memory.transcriptText
      : memory.transcriptStatus === "queued" || memory.transcriptStatus === "processing"
        ? "Transcribing…"
        : null;

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
          background:
            "radial-gradient(ellipse at 25% 40%, rgba(78,93,66,0.14), transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(42,36,28,0.20), transparent 55%), var(--ink)",
          overflow: "hidden",
        }}
      >
        <motion.a
          href={href}
          style={{
            position: "relative",
            maxWidth: 600,
            width: "100%",
            textAlign: "center",
            padding: "0 max(24px, 5vw)",
            textDecoration: "none",
            color: "inherit",
            opacity: contentOpacity,
            y: contentY,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "rgba(246,241,231,0.08)",
              border: "2px solid rgba(246,241,231,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 28px",
              animation: "voiceRing 2s ease-out infinite",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                color: "rgba(246,241,231,0.80)",
              }}
            >
              ◉
            </span>
          </div>

          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "rgba(246,241,231,0.40)",
              marginBottom: 18,
            }}
          >
            Voice · {memory.dateOfEventText ?? "Undated"}
          </div>

          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 4vw, 44px)",
              lineHeight: 1.1,
              color: "rgba(246,241,231,0.97)",
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
                color: "rgba(246,241,231,0.52)",
              }}
            >
              {memory.personName}
            </div>
          )}

          {transcript && (
            <p
              style={{
                margin: "24px auto 0",
                maxWidth: "54ch",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.8,
                color: "rgba(246,241,231,0.68)",
                fontStyle: "italic",
              }}
            >
              {transcript.length > 600 ? transcript.slice(0, 600) + "…" : transcript}
            </p>
          )}
        </motion.a>
      </div>
    </div>
  );
}