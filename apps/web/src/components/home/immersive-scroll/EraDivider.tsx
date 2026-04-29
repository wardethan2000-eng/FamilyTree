"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function EraDivider({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        minHeight: "18vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0d0a",
        scrollSnapAlign: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 0.61, 0.36, 1] }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: "min(200px, 40%)",
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(176,139,62,0.30) 20%, rgba(176,139,62,0.30) 80%, transparent 100%)",
          }}
        />
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(20px, 3vw, 32px)",
            fontWeight: 400,
            lineHeight: 1.1,
            color: "rgba(246,241,231,0.60)",
            textAlign: "center",
            textWrap: "balance",
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: "min(200px, 40%)",
            height: 1,
            background:
              "linear-gradient(90deg, transparent 0%, rgba(176,139,62,0.30) 20%, rgba(176,139,62,0.30) 80%, transparent 100%)",
          }}
        />
      </motion.div>
    </div>
  );
}
