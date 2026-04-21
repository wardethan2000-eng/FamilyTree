"use client";

import Link from "next/link";

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

export function AtriumFamilyPresence({
  focusPerson,
  focusPersonName,
  groups,
  scaleLabel,
  historicalLabel,
  fullTreeHref,
  addPersonHref,
  onPersonClick,
}: {
  focusPerson: PersonSummary | null;
  focusPersonName: string | null;
  groups: FamilyPresenceGroup[];
  scaleLabel: string;
  historicalLabel: string;
  fullTreeHref: string;
  addPersonHref: string;
  onPersonClick: (personId: string) => void;
}) {
  return (
    <section style={{ padding: "32px max(20px, 5vw) 64px" }}>
      <div
        style={{
          marginBottom: 18,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(26px, 3vw, 34px)",
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            Family presence
          </h2>
          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 720,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              lineHeight: 1.75,
              color: "var(--ink-soft)",
            }}
          >
            See where this memory sits in the family, who is closest to it, and how wide the branch
            feels around the story.
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href={fullTreeHref}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            color: "var(--moss)",
            textDecoration: "none",
          }}
        >
          Open full tree →
        </Link>
      </div>

      <div
        style={{
          border: "1px solid rgba(122,108,88,0.2)",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(243,236,225,0.92) 100%)",
          boxShadow: "0 12px 28px rgba(40,30,18,0.05)",
          padding: "clamp(20px, 4vw, 34px)",
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
        }}
      >
        <article
          style={{
            border: "1px solid rgba(122,108,88,0.16)",
            borderRadius: 20,
            background: "rgba(255,255,255,0.48)",
            padding: "20px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink-faded)",
              marginBottom: 12,
            }}
          >
            At the center
          </div>

          {focusPerson ? (
            <>
              <Portrait person={focusPerson} size={92} />
              <div
                style={{
                  marginTop: 14,
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  lineHeight: 1.1,
                  color: "var(--ink)",
                }}
              >
                {focusPerson.name}
              </div>
              {formatLifespan(focusPerson) && (
                <div
                  style={{
                    marginTop: 6,
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: "var(--ink-faded)",
                  }}
                >
                  {formatLifespan(focusPerson)}
                </div>
              )}
              <p
                style={{
                  margin: "12px 0 0",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: "var(--ink-soft)",
                }}
              >
                {focusPerson.essenceLine ??
                  `${focusPersonName ?? focusPerson.name} is the clearest anchor for this part of the archive right now.`}
              </p>
            </>
          ) : (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body)",
                fontSize: 15,
                lineHeight: 1.75,
                color: "var(--ink-soft)",
              }}
            >
              Add people to give this archive a clearer family center.
            </p>
          )}

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gap: 10,
            }}
          >
            <PresenceMetric label="Family scale" value={scaleLabel} />
            <PresenceMetric label="Historical span" value={historicalLabel} />
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link href={fullTreeHref} style={presenceLinkStyle}>
              Open full tree
            </Link>
            <Link href={addPersonHref} style={presenceLinkStyle}>
              Add person
            </Link>
          </div>
        </article>

        <div style={{ display: "grid", gap: 16 }}>
          {groups.length > 0 ? (
            groups.map((group) => (
              <article
                key={group.id}
                style={{
                  border: "1px solid rgba(122,108,88,0.14)",
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.38)",
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
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
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onPersonClick(person.id)}
                      style={{
                        border: "none",
                        background: "none",
                        padding: 0,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "left",
                        minWidth: "min(220px, 100%)",
                      }}
                    >
                      <Portrait person={person} size={52} />
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 16,
                            color: "var(--ink)",
                            lineHeight: 1.2,
                          }}
                        >
                          {person.name}
                        </div>
                        {formatLifespan(person) && (
                          <div
                            style={{
                              marginTop: 2,
                              fontFamily: "var(--font-ui)",
                              fontSize: 11,
                              color: "var(--ink-faded)",
                            }}
                          >
                            {formatLifespan(person)}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <article
              style={{
                border: "1px solid rgba(122,108,88,0.14)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.38)",
                padding: "18px 20px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: "var(--ink-soft)",
                }}
              >
                This branch will feel more inhabited as relationships and portraits gather around it.
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function PresenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-faded)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          lineHeight: 1.7,
          color: "var(--ink-soft)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Portrait({
  person,
  size,
}: {
  person: PersonSummary;
  size: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
        border: "1px solid rgba(122,108,88,0.24)",
        background: "var(--paper-deep)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {person.portraitUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={person.portraitUrl}
            alt={person.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </>
      ) : (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: Math.max(18, Math.floor(size / 2.6)),
            color: "var(--ink-faded)",
          }}
        >
          {person.name.charAt(0)}
        </span>
      )}
    </div>
  );
}

function formatLifespan(person: PersonSummary) {
  const years = [person.birthYear, person.deathYear].filter(
    (value): value is number => value !== null,
  );
  return years.length > 0 ? years.join("–") : null;
}

const presenceLinkStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--moss)",
  textDecoration: "none",
} as const;
