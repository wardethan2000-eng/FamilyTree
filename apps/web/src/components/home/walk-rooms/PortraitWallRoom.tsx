"use client";

import Link from "next/link";
import { getProxiedMediaUrl, handleMediaError } from "@/lib/media-url";
import { EASE } from "../homeUtils";

interface PersonSummary {
  id: string;
  name: string;
  portraitUrl: string | null;
  essenceLine: string | null;
  birthYear: number | null;
  deathYear: number | null;
}

interface FamilyPresenceGroup {
  id: string;
  label: string;
  people: PersonSummary[];
}

export function PortraitWallRoom({
  focusPerson,
  focusPersonName,
  branchCue,
  groups,
  fullTreeHref,
  onPersonClick,
}: {
  focusPerson: PersonSummary | null;
  focusPersonName: string | null;
  branchCue: string;
  groups: FamilyPresenceGroup[];
  fullTreeHref: string;
  onPersonClick: (personId: string) => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(48px, 8vw, 120px) max(20px, 5vw)",
        background: "var(--paper)",
      }}
    >
      <div style={{ maxWidth: 760, width: "100%" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(28px, 4vw, 40px)",
            fontWeight: 400,
            color: "var(--ink)",
            lineHeight: 1.1,
          }}
        >
          Family presence
        </div>

        <div
          style={{
            marginTop: 10,
            fontFamily: "var(--font-body)",
            fontSize: 15,
            lineHeight: 1.75,
            color: "var(--ink-soft)",
            maxWidth: "56ch",
          }}
        >
          {focusPersonName
            ? `The branch around ${focusPersonName}.`
            : "The people who make up this archive."}
        </div>

        {focusPerson && (
          <div
            style={{
              marginTop: 36,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "28px 0",
            }}
          >
            {focusPerson.portraitUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getProxiedMediaUrl(focusPerson.portraitUrl) ?? ""}
                alt={focusPerson.name}
                onError={handleMediaError}
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "3px solid var(--rule)",
                  boxShadow: "0 4px 16px rgba(40,30,18,0.10)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  background: "var(--paper-deep)",
                  border: "3px solid var(--rule)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  color: "var(--ink-faded)",
                }}
              >
                {focusPerson.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                fontFamily: "var(--font-display)",
                fontSize: 24,
                color: "var(--ink)",
                textAlign: "center",
              }}
            >
              {focusPerson.name}
            </div>

            {focusPerson.essenceLine && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontStyle: "italic",
                  color: "var(--ink-soft)",
                }}
              >
                {focusPerson.essenceLine}
              </div>
            )}

            {focusPerson.birthYear !== null && (
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  color: "var(--ink-faded)",
                }}
              >
                {focusPerson.birthYear}
                {focusPerson.deathYear ? ` – ${focusPerson.deathYear}` : " – present"}
              </div>
            )}
          </div>
        )}

        {groups.map((group) => (
          <div key={group.id} style={{ marginTop: 28 }}>
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
              {group.label}
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {group.people.map((person) => (
                <PortraitPill
                  key={person.id}
                  person={person}
                  onClick={() => onPersonClick(person.id)}
                />
              ))}
            </div>
          </div>
        ))}

        <div
          style={{
            marginTop: 48,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Link
            href={fullTreeHref}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--moss)",
              textDecoration: "none",
              padding: "12px 24px",
              border: "1px solid var(--rule)",
              borderRadius: 999,
              transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
            }}
          >
            Open full tree →
          </Link>
        </div>
      </div>
    </div>
  );
}

function PortraitPill({
  person,
  onClick,
}: {
  person: PersonSummary;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 6px",
        borderRadius: 999,
        border: "1px solid var(--rule)",
        background: "var(--paper)",
        cursor: "pointer",
        transition: `background 200ms ${EASE}, border-color 200ms ${EASE}`,
        color: "inherit",
      }}
    >
      {person.portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={getProxiedMediaUrl(person.portraitUrl) ?? ""}
          alt=""
          onError={handleMediaError}
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "var(--paper-deep)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: 12,
            color: "var(--ink-faded)",
          }}
        >
          {person.name.charAt(0).toUpperCase()}
        </div>
      )}
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          color: "var(--ink-soft)",
        }}
      >
        {person.name}
      </span>
    </button>
  );
}