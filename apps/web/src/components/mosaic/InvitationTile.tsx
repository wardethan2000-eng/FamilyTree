"use client";

import { EASE } from "@/components/home/homeUtils";

interface InvitationTileProps {
  treeName: string;
  invitedByName: string;
  proposedRole: string;
  linkedPersonName: string | null;
  colSpan: number;
  staggerIndex: number;
}

export function InvitationTile({
  treeName,
  invitedByName,
  proposedRole,
  linkedPersonName,
  colSpan,
  staggerIndex,
}: InvitationTileProps) {
  return (
    <div
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: "span 1",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid rgba(176,139,62,0.28)",
        background: "linear-gradient(180deg, rgba(252,248,240,0.9) 0%, rgba(247,240,224,0.9) 100%)",
        boxShadow: "0 6px 16px rgba(40,30,18,0.04)",
        padding: "clamp(16px, 2.5vw, 22px)",
        animation: `bloom 600ms ${EASE} ${staggerIndex * 80}ms both`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "var(--gilt)",
          borderRadius: "12px 12px 0 0",
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--gilt)",
          marginBottom: 6,
          display: "block",
        }}
      >
        Pending invitation
      </span>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          lineHeight: 1.15,
          color: "var(--ink)",
          marginBottom: 6,
        }}
      >
        {treeName}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.6,
          color: "rgba(53,44,33,0.72)",
        }}
      >
        <strong>{invitedByName}</strong> invited you as {proposedRole}
        {linkedPersonName ? ` for ${linkedPersonName}` : ""}.
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          color: "var(--ink-faded)",
        }}
      >
        Check your inbox for details.
      </div>
    </div>
  );
}