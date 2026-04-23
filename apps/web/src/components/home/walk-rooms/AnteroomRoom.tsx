"use client";

import Link from "next/link";
import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import type { TreeHomeTodayHighlights } from "../homeTypes";
import { EASE } from "../homeUtils";

interface AnteroomRoomProps {
  treeId: string;
  today: TreeHomeTodayHighlights;
  onStartPersonDrift: (personId: string) => void;
  onStartRemembrance: (personId: string) => void;
}

function formatYearsOld(years: number | null, isLiving: boolean): string {
  if (years === null) return isLiving ? "Birthday" : "Born this day";
  if (years === 0) return isLiving ? "Born today" : "0";
  return isLiving ? `Turns ${years}` : `Would have been ${years}`;
}

function formatYearsAgo(years: number | null): string {
  if (years === null) return "Today";
  if (years === 0) return "Today";
  if (years === 1) return "1 year ago today";
  return `${years} years ago today`;
}

export function AnteroomRoom({
  today,
  onStartPersonDrift,
  onStartRemembrance,
}: AnteroomRoomProps) {
  const { birthdays, deathiversaries, memoryAnniversaries } = today;

  const todayBirthdays = birthdays.filter((p) => p.daysUntil === 0);
  const todayDeathiversaries = deathiversaries.filter((p) => p.daysUntil === 0);
  const todayMemoryAnniversaries = memoryAnniversaries.filter((p) => p.daysUntil === 0);

  const primaryItems: Array<{
    type: "birthday" | "deathiversary" | "anniversary";
    personName: string;
    portraitUrl: string | null;
    label: string;
    personId: string;
    isLiving: boolean;
  }> = [];

  for (const b of todayBirthdays) {
    primaryItems.push({
      type: "birthday",
      personName: b.name,
      portraitUrl: b.portraitUrl,
      label: formatYearsOld(b.yearsOld, b.isLiving),
      personId: b.personId,
      isLiving: b.isLiving,
    });
  }

  for (const d of todayDeathiversaries) {
    primaryItems.push({
      type: "deathiversary",
      personName: d.name,
      portraitUrl: d.portraitUrl,
      label: formatYearsAgo(d.yearsAgo),
      personId: d.personId,
      isLiving: false,
    });
  }

  for (const a of todayMemoryAnniversaries.slice(0, 2)) {
    primaryItems.push({
      type: "anniversary",
      personName: a.primaryPersonName ?? "This memory",
      portraitUrl: null,
      label: formatYearsAgo(a.yearsAgo),
      personId: a.primaryPersonId ?? "",
      isLiving: false,
    });
  }

  const upcoming = [
    ...birthdays.filter((p) => p.daysUntil > 0).slice(0, 3),
    ...deathiversaries.filter((p) => p.daysUntil > 0).slice(0, 2),
    ...memoryAnniversaries.filter((p) => p.daysUntil > 0).slice(0, 2),
  ].sort((a, b) => (a.daysUntil ?? 99) - (b.daysUntil ?? 99));

  const primary = primaryItems[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(32px, 6vw, 72px) max(20px, 5vw)",
        background: "var(--paper)",
      }}
    >
      <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: "var(--ink-faded)",
            marginBottom: 24,
          }}
        >
          On this day
        </div>

        {primary && (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              {primary.portraitUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getProxiedMediaUrl(primary.portraitUrl) ?? ""}
                  alt={primary.personName}
                  onError={handleMediaError}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--rule)",
                    boxShadow: "0 4px 16px rgba(40,30,18,0.10)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "var(--paper-deep)",
                    border: "2px solid var(--rule)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                    color: "var(--ink-faded)",
                  }}
                >
                  {primary.personName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(28px, 4vw, 40px)",
                lineHeight: 1.1,
                color: "var(--ink)",
              }}
            >
              {primary.personName}
            </div>

            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-body)",
                fontSize: 17,
                color: "var(--ink-soft)",
                fontStyle: primary.type === "deathiversary" ? "italic" : undefined,
              }}
            >
              {primary.label}
            </div>

            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              {primary.type === "birthday" && primary.isLiving && (
                <button
                  type="button"
                  onClick={() => onStartPersonDrift(primary.personId)}
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#fff",
                    background: "var(--moss)",
                    border: "1px solid rgba(78,93,66,0.28)",
                    borderRadius: 999,
                    padding: "10px 18px",
                    cursor: "pointer",
                    transition: `background 200ms ${EASE}`,
                  }}
                >
                  Celebrate with their memories
                </button>
              )}
              {primary.type === "deathiversary" && (
                <button
                  type="button"
                  onClick={() => onStartRemembrance(primary.personId)}
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "rgba(246,241,231,0.9)",
                    background: "var(--ink)",
                    border: "1px solid var(--rule)",
                    borderRadius: 999,
                    padding: "10px 18px",
                    cursor: "pointer",
                    transition: `background 200ms ${EASE}`,
                  }}
                >
                  Remember
                </button>
              )}
            </div>
          </>
        )}

        {primaryItems.length > 1 && (
          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              alignItems: "center",
            }}
          >
            {primaryItems.slice(1).map((item) => (
              <div
                key={`${item.type}-${item.personId}`}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--ink-soft)",
                }}
              >
                {item.personName} — {item.label}
              </div>
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <div
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--ink-faded)",
                marginBottom: 12,
              }}
            >
              Coming up
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {upcoming.map((item) => (
                <div
                  key={`${"personId" in item ? (item as { personId: string }).personId : "mem"}-${item.daysUntil}`}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--ink-soft)",
                  }}
                >
                  {"name" in item
                    ? (item as { name: string; daysUntil: number }).name
                    : "primaryPersonName" in item
                      ? (item as { primaryPersonName: string | null }).primaryPersonName
                      : "Someone"}{" "}
                  —{" "}
                  {item.daysUntil === 1
                    ? "Tomorrow"
                    : `In ${item.daysUntil} days`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}