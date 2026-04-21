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
  branchCue,
  nearbyPeople,
  groups,
  fullTreeHref,
  addPersonHref,
  onPersonClick,
}: {
  focusPerson: PersonSummary | null;
  focusPersonName: string | null;
  branchCue: string;
  nearbyPeople: PersonSummary[];
  groups: FamilyPresenceGroup[];
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
              maxWidth: 760,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              lineHeight: 1.75,
              color: "var(--ink-soft)",
            }}
          >
            Stay with the branch around this memory before handing off to the full tree.
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
          border: "1px solid rgba(122,108,88,0.18)",
          borderRadius: 24,
          background:
            "linear-gradient(180deg, rgba(255,250,244,0.98) 0%, rgba(243,236,225,0.92) 100%)",
          boxShadow: "0 12px 28px rgba(40,30,18,0.05)",
          padding: "clamp(20px, 4vw, 34px)",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
            alignItems: "center",
          }}
        >
          <div>
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
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(28px, 4vw, 40px)",
                    lineHeight: 1.04,
                    color: "var(--ink)",
                    maxWidth: "10ch",
                  }}
                >
                  {focusPerson.name}
                </div>
                {formatLifespan(focusPerson) && (
                  <div
                    style={{
                      marginTop: 8,
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
                    margin: "14px 0 0",
                    fontFamily: "var(--font-body)",
                    fontSize: 15,
                    lineHeight: 1.75,
                    color: "var(--ink-soft)",
                    maxWidth: "44ch",
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
              <PresenceLine label="Branch focus" value={branchCue} />
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
          </div>

          <div
            style={{
              minHeight: 320,
              border: "1px solid rgba(122,108,88,0.14)",
              borderRadius: 22,
              background:
                "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.35) 40%, rgba(244,237,226,0.26) 100%)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 28% 24%, rgba(201,161,92,0.16), transparent 22%), radial-gradient(circle at 72% 76%, rgba(78,93,66,0.12), transparent 20%)",
              }}
            />

            {focusPerson ? (
              <>
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    display: "grid",
                    justifyItems: "center",
                    gap: 10,
                    zIndex: 2,
                  }}
                >
                  <PortraitButton person={focusPerson} size={112} onClick={onPersonClick} />
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 20,
                      color: "var(--ink)",
                      textAlign: "center",
                    }}
                  >
                    {focusPerson.name}
                  </div>
                </div>

                {nearbyPeople.map((person, index) => {
                  const position = orbitPositions[index % orbitPositions.length] ?? orbitPositions[0]!;
                  return (
                    <div
                      key={person.id}
                      style={{
                        position: "absolute",
                        top: position.top,
                        left: position.left,
                        transform: "translate(-50%, -50%)",
                        zIndex: 1,
                      }}
                    >
                      <PortraitButton person={person} size={76} onClick={onPersonClick} />
                    </div>
                  );
                })}

                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0.35,
                  }}
                >
                  {nearbyPeople.slice(0, orbitPositions.length).map((person, index) => {
                    const position = orbitPositions[index] ?? orbitPositions[0]!;
                    return (
                      <line
                        key={person.id}
                        x1="50"
                        y1="50"
                        x2={position.x}
                        y2={position.y}
                        stroke="rgba(122,108,88,0.28)"
                        strokeWidth="0.4"
                      />
                    );
                  })}
                </svg>
              </>
            ) : (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  lineHeight: 1.75,
                  color: "var(--ink-soft)",
                }}
              >
                This branch will feel more inhabited as relationships and portraits gather around it.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {groups.length > 0 ? (
            groups.map((group) => (
              <article
                key={group.id}
                style={{
                  borderTop: "1px solid rgba(122,108,88,0.12)",
                  paddingTop: 16,
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
                    gap: 14,
                  }}
                >
                  {group.people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onPersonClick(person.id)}
                      style={{
                        border: "none",
                        background: "rgba(255,255,255,0.36)",
                        borderRadius: 16,
                        padding: "10px 12px",
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
                borderTop: "1px solid rgba(122,108,88,0.12)",
                paddingTop: 16,
                fontFamily: "var(--font-body)",
                fontSize: 15,
                lineHeight: 1.75,
                color: "var(--ink-soft)",
              }}
            >
              This branch will feel more inhabited as relationships and portraits gather around it.
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function PresenceLine({ label, value }: { label: string; value: string }) {
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

function PortraitButton({
  person,
  size,
  onClick,
}: {
  person: PersonSummary;
  size: number;
  onClick: (personId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(person.id)}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <Portrait person={person} size={size} />
    </button>
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
        boxShadow: "0 10px 24px rgba(40,30,18,0.08)",
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

const orbitPositions = [
  { top: "22%", left: "24%", x: 24, y: 22 },
  { top: "18%", left: "74%", x: 74, y: 18 },
  { top: "48%", left: "16%", x: 16, y: 48 },
  { top: "48%", left: "84%", x: 84, y: 48 },
  { top: "78%", left: "26%", x: 26, y: 78 },
  { top: "80%", left: "72%", x: 72, y: 80 },
  { top: "30%", left: "50%", x: 50, y: 30 },
  { top: "68%", left: "50%", x: 50, y: 68 },
];

const presenceLinkStyle = {
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  color: "var(--moss)",
  textDecoration: "none",
} as const;
