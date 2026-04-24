"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import type { TreeHomeMemory } from "../homeTypes";

export function ImmersiveDocumentSection({
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

  const scale = useTransform(scrollYProgress, [0.15, 0.4], [0.4, 1]);
  const borderRadius = useTransform(scrollYProgress, [0.15, 0.4], [12, 4]);
  const contentOpacity = useTransform(scrollYProgress, [0.25, 0.4], [0, 1]);
  const contentY = useTransform(contentOpacity, [0, 1], [30, 0]);
  const cardOpacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <div
      ref={sectionRef}
      style={{ position: "relative", height: "260vh" }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--paper)",
          overflow: "hidden",
        }}
      >
        <motion.a
          href={href}
          style={{
            scale,
            borderRadius,
            opacity: cardOpacity,
            textDecoration: "none",
            color: "inherit",
            maxWidth: 620,
            width: "90%",
            background: "#fff",
            boxShadow: "0 16px 48px rgba(40,30,18,0.12)",
            overflow: "hidden",
            border: "1px solid var(--rule)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl}
            alt={memory.title}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{
              width: "100%",
              maxHeight: "55vh",
              objectFit: "contain",
              background: "var(--paper-deep)",
            }}
          />

          <motion.div
            style={{ padding: "22px 26px 26px", opacity: contentOpacity, y: contentY }}
          >
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
                fontSize: "clamp(20px, 3vw, 30px)",
                lineHeight: 1.12,
                color: "var(--ink)",
              }}
            >
              {memory.title}
            </div>

            {memory.personName && (
              <div
                style={{
                  marginTop: 8,
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: "var(--ink-soft)",
                }}
              >
                {memory.personName}
              </div>
            )}
          </motion.div>
        </motion.a>
      </div>
    </div>
  );
}