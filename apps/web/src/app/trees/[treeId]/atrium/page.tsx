"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AnimatePresence } from "framer-motion";
import { HomeSummaryBand } from "@/components/home/HomeSummaryBand";
import { MemoryLane } from "@/components/home/MemoryLane";
import { TreeHomeHero } from "@/components/home/TreeHomeHero";
import { DriftMode } from "@/components/tree/DriftMode";
import { AddMemoryWizard } from "@/components/tree/AddMemoryWizard";
import { SearchOverlay } from "@/components/tree/SearchOverlay";
import { Shimmer } from "@/components/ui/Shimmer";
import { isCanonicalTreeId, resolveCanonicalTreeId } from "@/lib/tree-route";
import { usePendingVoiceTranscriptionRefresh } from "@/lib/usePendingVoiceTranscriptionRefresh";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

interface Tree {
  id: string;
  name: string;
  role?: string;
}

interface Person {
  id: string;
  name: string;
  portraitUrl: string | null;
  essenceLine: string | null;
  birthYear: number | null;
  deathYear: number | null;
  linkedUserId: string | null;
}

interface Memory {
  id: string;
  kind: "story" | "photo" | "voice" | "document" | "other";
  title: string;
  body?: string | null;
  transcriptText?: string | null;
  transcriptLanguage?: string | null;
  transcriptStatus?: "none" | "queued" | "processing" | "completed" | "failed";
  transcriptError?: string | null;
  dateOfEventText?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  personName?: string | null;
  primaryPersonId?: string | null;
  personPortraitUrl?: string | null;
  createdAt?: string;
}

interface HomeStats {
  peopleCount: number;
  memoryCount: number;
  generationCount: number;
  peopleWithoutPortraitCount: number;
  peopleWithoutDirectMemoriesCount: number;
}

interface HomeCoverage {
  earliestYear: number | null;
  latestYear: number | null;
  decadeBuckets: Array<{
    startYear: number;
    label: string;
    count: number;
  }>;
}

interface HomePayload {
  tree: Tree;
  people: Array<
    Person & {
      displayName?: string;
      birthDateText?: string | null;
      deathDateText?: string | null;
    }
  >;
  memories: Memory[];
  heroCandidates: Memory[];
  inboxCount: number;
  curationCount: number;
  currentUserPersonId: string | null;
  stats: HomeStats;
  coverage: HomeCoverage;
}

function extractYear(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1]!, 10) : null;
}

function PersonCard({ person, onClick }: { person: Person; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: "none",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: hovered ? "var(--paper-deep)" : "none",
        transition: `background 150ms ${EASE}`,
      } as React.CSSProperties}
    >
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          overflow: "hidden",
          border: "1.5px solid var(--rule)",
          background: "var(--paper-deep)",
          flexShrink: 0,
        }}
      >
        {person.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.portraitUrl}
            alt={person.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: "var(--ink-faded)",
            }}
          >
            {person.name.charAt(0)}
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          color: "var(--ink)",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 80,
        }}
      >
        {person.name.split(" ")[0]}
      </div>
      {(person.birthYear ?? person.deathYear) && (
        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 10,
            color: "var(--ink-faded)",
          }}
        >
          {[person.birthYear, person.deathYear].filter(Boolean).join("–")}
        </div>
      )}
    </button>
  );
}

export default function AtriumPage() {
  const router = useRouter();
  const params = useParams<{ treeId: string }>();
  const { treeId } = params;
  const { data: session, isPending } = useSession();
  const needsNormalization = !isCanonicalTreeId(treeId);

  const [tree, setTree] = useState<Tree | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [heroCandidates, setHeroCandidates] = useState<Memory[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [coverage, setCoverage] = useState<HomeCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [driftOpen, setDriftOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [curationCount, setCurationCount] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  // Global ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/signin");
  }, [session, isPending, router]);

  useEffect(() => {
    if (!session || !needsNormalization) return;

    let cancelled = false;
    void (async () => {
      const resolvedTreeId = await resolveCanonicalTreeId(API, treeId);
      if (cancelled) return;
      if (resolvedTreeId && resolvedTreeId !== treeId) {
        router.replace(`/trees/${resolvedTreeId}/atrium`);
        return;
      }
      if (!resolvedTreeId) {
        setLoadError("This tree link is invalid or no longer points to an available tree.");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsNormalization, router, session, treeId]);

  useEffect(() => {
    if (!session || !treeId || !isCanonicalTreeId(treeId)) return;
    const fetchHome = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${API}/api/trees/${treeId}/home`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Failed to load this tree.");
        }
        const data = (await res.json()) as HomePayload;
        setTree(data.tree);
        setPeople(
          data.people.map((p) => ({
            id: p.id,
            name: p.displayName ?? p.name ?? "",
            portraitUrl: p.portraitUrl,
            essenceLine: p.essenceLine,
            birthYear: extractYear(p.birthDateText ?? null),
            deathYear: extractYear(p.deathDateText ?? null),
            linkedUserId: p.linkedUserId,
          })),
        );
        setMemories(data.memories);
        setHeroIndex(0);
        setHeroCandidates(data.heroCandidates);
        setHomeStats(data.stats);
        setCoverage(data.coverage);
        setInboxCount(data.inboxCount);
        setCurationCount(data.curationCount);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load this tree.",
        );
      } finally {
        setLoading(false);
      }
    };
    void fetchHome();
  }, [session, treeId]);

  const handlePersonClick = useCallback(
    (personId: string) => {
      router.push(`/trees/${treeId}/people/${personId}`);
    },
    [router, treeId]
  );

  const refreshHome = useCallback(async () => {
    const res = await fetch(`${API}/api/trees/${treeId}/home`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as HomePayload;
    setTree(data.tree);
    setPeople(
      data.people.map((p) => ({
        id: p.id,
        name: p.displayName ?? p.name ?? "",
        portraitUrl: p.portraitUrl,
        essenceLine: p.essenceLine,
        birthYear: extractYear(p.birthDateText ?? null),
        deathYear: extractYear(p.deathDateText ?? null),
        linkedUserId: p.linkedUserId,
      })),
    );
    setMemories(data.memories);
    setHeroIndex(0);
    setHeroCandidates(data.heroCandidates);
    setHomeStats(data.stats);
    setCoverage(data.coverage);
    setInboxCount(data.inboxCount);
    setCurationCount(data.curationCount);
  }, [treeId]);

  usePendingVoiceTranscriptionRefresh({
    items: memories.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      transcriptStatus: memory.transcriptStatus,
    })),
    refresh: refreshHome,
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (heroCandidates.length < 2 || heroPaused) return;
    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroCandidates.length);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [heroCandidates.length, heroPaused]);

  const apiPeople = people.map((p) => ({
    id: p.id,
    name: p.name,
    portraitUrl: p.portraitUrl,
  }));

  const featuredMemory =
    (heroCandidates.length > 0
      ? heroCandidates[heroIndex % heroCandidates.length]
      : null) ??
    memories.find((m) => m.kind === "photo" && m.mediaUrl) ??
    memories.find((m) => m.kind === "story") ??
    memories[0] ??
    null;
  const recentMemories = memories.slice(0, 12);
  const voiceMemories = memories.filter((memory) => memory.kind === "voice").slice(0, 8);

  if (isPending || loading || (needsNormalization && !loadError)) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--paper)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <Shimmer width={180} height={14} />
        <Shimmer width={280} height={10} />
      </main>
    );
  }

  if (loadError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            border: "1px solid var(--rule)",
            background: "var(--paper)",
            borderRadius: 12,
            padding: 24,
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 400,
              color: "var(--ink)",
            }}
          >
            This atrium could not be opened.
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body)",
              fontSize: 17,
              lineHeight: 1.7,
              color: "var(--ink-soft)",
            }}
          >
            {loadError}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 52,
          background: "rgba(246,241,231,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 12,
        }}
      >
        <a
          href="/dashboard"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            color: "var(--ink-faded)",
            textDecoration: "none",
            padding: "4px 0",
          }}
        >
          ← Home
        </a>
        <span style={{ color: "var(--rule)", fontSize: 12 }}>·</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 17,
            color: "var(--ink)",
          }}
        >
          {tree?.name ?? "Heirloom"}
        </span>

        <div style={{ flex: 1 }} />

        <a
          href={`/trees/${treeId}/map`}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--ink-faded)",
            background: "var(--paper-deep)",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            padding: "5px 12px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          Map
        </a>

        {/* Inbox bell */}
        <a
          href={`/trees/${treeId}/inbox`}
          style={{
            position: "relative",
            fontFamily: "var(--font-ui)",
            fontSize: 18,
            color: "var(--ink-faded)",
            background: "var(--paper-deep)",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            padding: "5px 10px",
            cursor: "pointer",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
          }}
          title="Inbox"
        >
          ✉
          {inboxCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "var(--rose)", color: "#fff", fontFamily: "var(--font-ui)", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {inboxCount > 9 ? "9+" : inboxCount}
            </span>
          )}
        </a>

        {/* Curation nudge */}
        {curationCount > 0 && (
          <a
            href={`/trees/${treeId}/curation`}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--amber, #c97d1a)",
              background: "var(--paper-deep)",
              border: "1px solid var(--amber, #c97d1a)",
              borderRadius: 6,
              padding: "5px 12px",
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
            title="Curation queue"
          >
            ✎ {curationCount} need{curationCount === 1 ? "s" : ""} attention
          </a>
        )}

        <button
          onClick={() => setSearchOpen(true)}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--ink-faded)",
            background: "var(--paper-deep)",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            padding: "5px 12px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>⌕</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Search
            <kbd
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 10,
                background: "var(--paper)",
                border: "1px solid var(--rule)",
                borderRadius: 3,
                padding: "1px 4px",
                color: "var(--ink-faded)",
              }}
            >
              ⌘K
            </kbd>
          </span>
        </button>

        <button
          onClick={() => setWizardOpen(true)}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 500,
            color: "white",
            background: "var(--moss)",
            border: "none",
            borderRadius: 6,
            padding: "5px 14px",
            cursor: "pointer",
          }}
        >
          + Add memory
        </button>
      </header>

      <TreeHomeHero
        treeName={tree?.name ?? "Family Archive"}
        featuredMemory={featuredMemory}
        heroIndex={heroCandidates.length > 0 ? heroIndex % heroCandidates.length : 0}
        heroCount={heroCandidates.length}
        onPauseChange={setHeroPaused}
        onSelectHero={setHeroIndex}
      />

      {/* CTA row */}
      <section
        style={{
          padding: "28px max(24px, 5vw)",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setDriftOpen(true)}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontStyle: "italic",
            color: "var(--paper)",
            background: "var(--ink)",
            border: "none",
            borderRadius: 8,
            padding: "11px 24px",
            cursor: "pointer",
            letterSpacing: "0.01em",
            transition: `opacity 200ms ${EASE}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.85"; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Begin drifting ›
        </button>

        {featuredMemory && (
          <a
            href={`/trees/${treeId}/memories/${featuredMemory.id}`}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              color: "var(--ink)",
              background: "var(--paper-deep)",
              border: "1px solid var(--rule)",
              borderRadius: 8,
              padding: "10px 22px",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Open memory →
          </a>
        )}

        <a
          href={`/trees/${treeId}`}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 14,
            color: "var(--moss)",
            background: "none",
            border: "1.5px solid var(--moss)",
            borderRadius: 8,
            padding: "10px 22px",
            textDecoration: "none",
            transition: `background 200ms ${EASE}`,
            display: "inline-block",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(78,93,66,0.08)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
        >
          Enter the constellation →
        </a>

        <div style={{ flex: 1 }} />

        <div
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            color: "var(--ink-faded)",
          }}
        >
          {homeStats?.peopleCount ?? people.length}{" "}
          {(homeStats?.peopleCount ?? people.length) === 1 ? "person" : "people"} ·{" "}
          {homeStats?.memoryCount ?? memories.length}{" "}
          {(homeStats?.memoryCount ?? memories.length) === 1 ? "memory" : "memories"}
        </div>
      </section>

      {/* Divider */}
      <hr
        style={{
          border: "none",
          borderTop: "1px solid var(--rule)",
          margin: "0 max(24px, 5vw)",
        }}
      />

      <HomeSummaryBand stats={homeStats} coverage={coverage} />

      <MemoryLane
        title="Resurfacing now"
        countLabel={`${recentMemories.length} memories`}
        memories={recentMemories}
        onMemoryClick={(memory) => {
          router.push(`/trees/${treeId}/memories/${memory.id}`);
        }}
        viewAllHref={`/trees/${treeId}`}
        viewAllLabel={
          memories.length > recentMemories.length
            ? `+${memories.length - recentMemories.length} more in the constellation`
            : undefined
        }
      />

      {/* Divider */}
      {recentMemories.length > 0 && (
        <hr
          style={{
            border: "none",
            borderTop: "1px solid var(--rule)",
            margin: "20px max(24px, 5vw) 0",
          }}
        />
      )}

      {voiceMemories.length > 0 && (
        <>
          <MemoryLane
            title="Voices in the archive"
            countLabel={`${voiceMemories.length} voice memories`}
            memories={voiceMemories}
            onMemoryClick={(memory) => {
              router.push(`/trees/${treeId}/memories/${memory.id}`);
            }}
          />
          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--rule)",
              margin: "20px max(24px, 5vw) 0",
            }}
          />
        </>
      )}

      {/* The family */}
      <section style={{ padding: "28px max(24px, 5vw) 60px" }}>
        <div
          style={{
            marginBottom: 20,
            display: "flex",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              color: "var(--ink)",
              margin: 0,
              fontWeight: 400,
            }}
          >
            The family
          </h2>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--ink-faded)",
            }}
          >
            {people.length} {people.length === 1 ? "person" : "people"}
          </span>
          <div style={{ flex: 1 }} />
          <a
            href={`/trees/${treeId}/people/new`}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "var(--moss)",
              textDecoration: "none",
            }}
          >
            + Add person
          </a>
        </div>

        {people.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              fontFamily: "var(--font-body)",
              fontStyle: "italic",
              fontSize: 15,
              color: "var(--ink-faded)",
            }}
          >
            No one in the archive yet.{" "}
            <a
              href={`/trees/${treeId}/people/new`}
              style={{ color: "var(--moss)", textDecoration: "underline" }}
            >
              Add the first person
            </a>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
            }}
          >
            {people.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                onClick={() => handlePersonClick(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* DriftMode */}
      <AnimatePresence>
        {driftOpen && (
          <DriftMode
            treeId={treeId}
            people={people.map((p) => ({
              id: p.id,
              name: p.name,
              birthYear: p.birthYear,
              deathYear: p.deathYear,
              essenceLine: p.essenceLine,
              portraitUrl: p.portraitUrl,
              linkedUserId: p.linkedUserId,
            }))}
            onClose={() => setDriftOpen(false)}
            onPersonDetail={handlePersonClick}
            apiBase={API}
          />
        )}
      </AnimatePresence>

      {/* Add Memory wizard */}
      {wizardOpen && (
        <AddMemoryWizard
          treeId={treeId}
          people={apiPeople}
          apiBase={API}
          onClose={() => setWizardOpen(false)}
          onSuccess={refreshHome}
        />
      )}

      {/* Search overlay */}
      <SearchOverlay
        treeId={treeId}
        people={people.map((p) => ({
          id: p.id,
          name: p.name,
          portraitUrl: p.portraitUrl,
          essenceLine: p.essenceLine,
          birthYear: p.birthYear,
          deathYear: p.deathYear,
        }))}
        memories={memories}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </main>
  );
}
