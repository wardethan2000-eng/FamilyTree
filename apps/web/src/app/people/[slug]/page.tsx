"use client";

import { use, useEffect, useState } from "react";
import { getApiBase } from "@/lib/api-base";
import { getProxiedMediaUrl } from "@/lib/media-url";

const API = getApiBase();

type PublicMemory = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  dateOfEventText: string | null;
  mediaUrl: string | null;
  mimeType: string | null;
  linkedMediaOpenUrl: string | null;
  linkedMediaPreviewUrl: string | null;
  linkedMediaLabel: string | null;
};

type PublicPersonPagePayload = {
  page: {
    slug: string;
    title: string;
    subtitle: string | null;
    obituaryText: string | null;
    serviceDetails: string | null;
    donationUrl: string | null;
    contactEmail: string | null;
    allowSearchIndexing: boolean;
    publishedAt: string | null;
  };
  person: {
    displayName: string;
    essenceLine: string | null;
    birthDateText: string | null;
    deathDateText: string | null;
    birthPlace: string | null;
    deathPlace: string | null;
    portraitUrl: string | null;
  };
  tree: { id: string; name: string };
  memories: PublicMemory[];
};

function dateRange(person: PublicPersonPagePayload["person"]): string | null {
  if (person.birthDateText && person.deathDateText) {
    return `${person.birthDateText} - ${person.deathDateText}`;
  }
  if (person.birthDateText) return `${person.birthDateText} -`;
  if (person.deathDateText) return `- ${person.deathDateText}`;
  return null;
}

function paragraphs(text: string | null) {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function PublicPersonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [payload, setPayload] = useState<PublicPersonPagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch(`${API}/api/public/person-pages/${slug}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("This public page is not available.");
        }
        const data = (await res.json()) as PublicPersonPagePayload;
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "This public page is not available.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main style={shellStyle}>
        <div style={{ width: "min(720px, 100%)", display: "flex", flexDirection: "column", gap: 16 }}>
          {[280, 520, 420, 340].map((width) => (
            <div
              key={width}
              style={{
                width,
                maxWidth: "100%",
                height: 14,
                borderRadius: 999,
                background: "var(--paper-deep)",
              }}
            />
          ))}
        </div>
      </main>
    );
  }

  if (error || !payload) {
    return (
      <main style={shellStyle}>
        <section style={{ maxWidth: 620 }}>
          <p style={eyebrowStyle}>Public page</p>
          <h1 style={titleStyle}>Page unavailable</h1>
          <p style={bodyStyle}>{error ?? "This public page is not available."}</p>
        </section>
      </main>
    );
  }

  const range = dateRange(payload.person);
  const portraitUrl = getProxiedMediaUrl(payload.person.portraitUrl) ?? payload.person.portraitUrl;

  return (
    <main style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <section
        style={{
          minHeight: "72vh",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          alignItems: "end",
          position: "relative",
          overflow: "hidden",
          background: "var(--ink)",
        }}
      >
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={payload.person.displayName}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.54,
              filter: "sepia(0.18) brightness(0.78)",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #403A2E, #A85D5D 55%, #4E5D42)",
              opacity: 0.72,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(28,25,21,0.86), rgba(28,25,21,0.18))",
          }}
        />
        <div style={{ position: "relative", width: "min(1080px, 100%)", padding: "96px 28px 52px", margin: "0 auto" }}>
          <p style={{ ...eyebrowStyle, color: "rgba(246,241,231,0.74)" }}>
            Remembering
          </p>
          <h1 style={{ ...titleStyle, color: "#F6F1E7", fontSize: "clamp(46px, 8vw, 92px)" }}>
            {payload.page.title}
          </h1>
          {range && (
            <p style={{ ...bodyStyle, color: "rgba(246,241,231,0.78)", marginTop: 12 }}>
              {range}
            </p>
          )}
          {(payload.page.subtitle ?? payload.person.essenceLine) && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 22,
                lineHeight: 1.55,
                color: "rgba(246,241,231,0.9)",
                maxWidth: 760,
                margin: "18px 0 0",
                fontStyle: "italic",
              }}
            >
              {payload.page.subtitle ?? payload.person.essenceLine}
            </p>
          )}
        </div>
      </section>

      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", padding: "54px 28px 96px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 56, alignItems: "start" }}>
          <article>
            <p style={eyebrowStyle}>Life remembered</p>
            <h2 style={sectionTitleStyle}>Obituary</h2>
            {paragraphs(payload.page.obituaryText).length > 0 ? (
              paragraphs(payload.page.obituaryText).map((paragraph) => (
                <p key={paragraph} style={bodyStyle}>
                  {paragraph}
                </p>
              ))
            ) : (
              <p style={bodyStyle}>
                This page has been published for {payload.person.displayName}.
              </p>
            )}

            {payload.memories.length > 0 && (
              <section style={{ marginTop: 64 }}>
                <p style={eyebrowStyle}>Featured memories</p>
                <h2 style={sectionTitleStyle}>Stories and keepsakes</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
                  {payload.memories.map((memory) => {
                    const memoryImage =
                      getProxiedMediaUrl(memory.mediaUrl ?? memory.linkedMediaPreviewUrl) ??
                      memory.mediaUrl ??
                      memory.linkedMediaPreviewUrl;
                    return (
                      <section key={memory.id} style={memoryCardStyle}>
                        {memoryImage && memory.mimeType?.startsWith("image/") && (
                          <img
                            src={memoryImage}
                            alt={memory.title}
                            style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 6, marginBottom: 14 }}
                          />
                        )}
                        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink)", margin: 0, fontWeight: 400 }}>
                          {memory.title}
                        </h3>
                        {memory.dateOfEventText && (
                          <p style={{ ...eyebrowStyle, marginTop: 8 }}>{memory.dateOfEventText}</p>
                        )}
                        {memory.body && <p style={{ ...bodyStyle, fontSize: 17 }}>{memory.body}</p>}
                        {memory.linkedMediaOpenUrl && (
                          <a href={memory.linkedMediaOpenUrl} style={linkStyle}>
                            Open media
                          </a>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
            )}
          </article>

          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {(payload.person.birthPlace || payload.person.deathPlace) && (
              <section style={sidePanelStyle}>
                <p style={eyebrowStyle}>Places</p>
                {payload.person.birthPlace && (
                  <p style={factStyle}>
                    <span>Born</span>
                    {payload.person.birthPlace}
                  </p>
                )}
                {payload.person.deathPlace && (
                  <p style={factStyle}>
                    <span>Died</span>
                    {payload.person.deathPlace}
                  </p>
                )}
              </section>
            )}
            {payload.page.serviceDetails && (
              <section style={sidePanelStyle}>
                <p style={eyebrowStyle}>Service</p>
                {paragraphs(payload.page.serviceDetails).map((paragraph) => (
                  <p key={paragraph} style={{ ...bodyStyle, fontSize: 16 }}>
                    {paragraph}
                  </p>
                ))}
              </section>
            )}
            {(payload.page.donationUrl || payload.page.contactEmail) && (
              <section style={sidePanelStyle}>
                <p style={eyebrowStyle}>Family notes</p>
                {payload.page.donationUrl && (
                  <a href={payload.page.donationUrl} style={buttonLinkStyle}>
                    Memorial donations
                  </a>
                )}
                {payload.page.contactEmail && (
                  <a href={`mailto:${payload.page.contactEmail}`} style={linkStyle}>
                    Contact the family
                  </a>
                )}
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--paper)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 28,
};

const eyebrowStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  fontSize: 12,
  color: "var(--ink-faded)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  margin: "0 0 10px",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 58,
  lineHeight: 1.02,
  color: "var(--ink)",
  fontWeight: 400,
  margin: 0,
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 38,
  color: "var(--ink)",
  fontWeight: 400,
  margin: "0 0 24px",
};

const bodyStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 19,
  lineHeight: 1.75,
  color: "var(--ink-soft)",
  margin: "0 0 18px",
};

const sidePanelStyle: React.CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 8,
  padding: 18,
  background: "rgba(237,230,214,0.58)",
};

const memoryCardStyle: React.CSSProperties = {
  border: "1px solid var(--rule)",
  borderRadius: 8,
  padding: 18,
  background: "rgba(246,241,231,0.92)",
};

const factStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontFamily: "var(--font-body)",
  fontSize: 17,
  color: "var(--ink-soft)",
  lineHeight: 1.45,
  margin: "0 0 14px",
};

const linkStyle: React.CSSProperties = {
  fontFamily: "var(--font-ui)",
  color: "var(--moss)",
  fontSize: 14,
};

const buttonLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "#F6F1E7",
  background: "var(--moss)",
  borderRadius: 999,
  padding: "10px 14px",
  textDecoration: "none",
  marginBottom: 12,
};
