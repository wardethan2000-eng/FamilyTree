"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type RelationshipType = "parent_child" | "sibling" | "spouse";

type Person = {
  id: string;
  displayName: string;
  essenceLine: string | null;
  birthDateText: string | null;
  deathDateText: string | null;
  birthPlace: string | null;
  deathPlace: string | null;
  isLiving: boolean;
  linkedUserId: string | null;
  portraitUrl: string | null;
  memories: Memory[];
  relationships: Relationship[];
};

type Memory = {
  id: string;
  kind: "story" | "photo";
  title: string;
  body: string | null;
  dateOfEventText: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

type Relationship = {
  id: string;
  type: RelationshipType;
  fromPerson: { id: string; displayName: string };
  toPerson: { id: string; displayName: string };
};

type PersonSummary = { id: string; displayName: string };

function relationshipLabel(r: Relationship, personId: string): string {
  const labels: Record<RelationshipType, [string, string]> = {
    parent_child: ["Parent of", "Child of"],
    sibling: ["Sibling of", "Sibling of"],
    spouse: ["Spouse of", "Spouse of"],
  };
  const [fromLabel, toLabel] = labels[r.type];
  const other = r.fromPerson.id === personId ? r.toPerson : r.fromPerson;
  const label = r.fromPerson.id === personId ? fromLabel : toLabel;
  return `${label} ${other.displayName}`;
}

function extractYear(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/\b(\d{4})\b/);
  return m ? parseInt(m[1]!, 10) : null;
}

function getDecade(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

type Tab = "memories" | "stories" | "about";

export default function PersonPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPeople, setAllPeople] = useState<PersonSummary[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("memories");
  const [activeDecade, setActiveDecade] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: "",
    essenceLine: "",
    birthDateText: "",
    deathDateText: "",
    birthPlace: "",
    deathPlace: "",
    isLiving: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Portrait upload
  const [uploadingPortrait, setUploadingPortrait] = useState(false);

  // Add memory
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [memoryForm, setMemoryForm] = useState({
    kind: "story" as "story" | "photo",
    title: "",
    body: "",
    dateOfEventText: "",
    mediaId: "",
  });
  const [memoryFile, setMemoryFile] = useState<File | null>(null);
  const [savingMemory, setSavingMemory] = useState(false);

  // Add relationship
  const [showRelForm, setShowRelForm] = useState(false);
  const [relForm, setRelForm] = useState({
    otherPersonId: "",
    type: "parent_child" as RelationshipType,
    direction: "from" as "from" | "to",
  });
  const [savingRel, setSavingRel] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/signin");
  }, [session, isPending, router]);

  useEffect(() => {
    if (session) {
      loadPerson();
      loadAllPeople();
    }
  }, [session, treeId, personId]);

  async function loadPerson() {
    setLoading(true);
    const res = await fetch(`${API}/api/trees/${treeId}/people/${personId}`, {
      credentials: "include",
    });
    if (!res.ok) {
      router.replace(`/dashboard?treeId=${treeId}`);
      return;
    }
    const data = (await res.json()) as Person;
    setPerson(data);
    // Set initial active decade from first memory
    const firstYear = data.memories
      .map((m) => extractYear(m.dateOfEventText))
      .find((y) => y !== null);
    if (firstYear) setActiveDecade(getDecade(firstYear));
    setLoading(false);
  }

  async function loadAllPeople() {
    const res = await fetch(`${API}/api/trees/${treeId}/people`, {
      credentials: "include",
    });
    if (res.ok) setAllPeople((await res.json()) as PersonSummary[]);
  }

  function startEditing(p: Person) {
    setEditForm({
      displayName: p.displayName,
      essenceLine: p.essenceLine ?? "",
      birthDateText: p.birthDateText ?? "",
      deathDateText: p.deathDateText ?? "",
      birthPlace: p.birthPlace ?? "",
      deathPlace: p.deathPlace ?? "",
      isLiving: p.isLiving,
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSavingEdit(true);
    const res = await fetch(`${API}/api/trees/${treeId}/people/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        displayName: editForm.displayName,
        essenceLine: editForm.essenceLine || null,
        birthDateText: editForm.birthDateText || null,
        deathDateText: editForm.deathDateText || null,
        birthPlace: editForm.birthPlace || null,
        deathPlace: editForm.deathPlace || null,
        isLiving: editForm.isLiving,
      }),
    });
    if (res.ok) {
      setEditing(false);
      await loadPerson();
    }
    setSavingEdit(false);
  }

  async function uploadPortrait(file: File) {
    setUploadingPortrait(true);
    const presignRes = await fetch(`${API}/api/trees/${treeId}/media/presign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
    });
    if (!presignRes.ok) { setUploadingPortrait(false); return; }
    const { mediaId, uploadUrl } = (await presignRes.json()) as { mediaId: string; uploadUrl: string };
    await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
    await fetch(`${API}/api/trees/${treeId}/people/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ portraitMediaId: mediaId }),
    });
    await loadPerson();
    setUploadingPortrait(false);
  }

  async function saveMemory(e: React.FormEvent) {
    e.preventDefault();
    setSavingMemory(true);
    let resolvedMediaId = memoryForm.mediaId;
    if (memoryForm.kind === "photo" && memoryFile) {
      const presignRes = await fetch(`${API}/api/trees/${treeId}/media/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: memoryFile.name, contentType: memoryFile.type, sizeBytes: memoryFile.size }),
      });
      if (presignRes.ok) {
        const { mediaId, uploadUrl } = (await presignRes.json()) as { mediaId: string; uploadUrl: string };
        await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": memoryFile.type }, body: memoryFile });
        resolvedMediaId = mediaId;
      }
    }
    const res = await fetch(`${API}/api/trees/${treeId}/people/${personId}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        kind: memoryForm.kind,
        title: memoryForm.title,
        body: memoryForm.kind === "story" ? memoryForm.body : undefined,
        mediaId: memoryForm.kind === "photo" ? resolvedMediaId || undefined : undefined,
        dateOfEventText: memoryForm.dateOfEventText || undefined,
      }),
    });
    if (res.ok) {
      setShowMemoryForm(false);
      setMemoryForm({ kind: "story", title: "", body: "", dateOfEventText: "", mediaId: "" });
      setMemoryFile(null);
      await loadPerson();
    }
    setSavingMemory(false);
  }

  async function saveRelationship(e: React.FormEvent) {
    e.preventDefault();
    setSavingRel(true);
    const res = await fetch(`${API}/api/trees/${treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fromPersonId: relForm.direction === "from" ? personId : relForm.otherPersonId,
        toPersonId: relForm.direction === "from" ? relForm.otherPersonId : personId,
        type: relForm.type,
      }),
    });
    if (res.ok) {
      setShowRelForm(false);
      setRelForm({ otherPersonId: "", type: "parent_child", direction: "from" });
      await loadPerson();
    }
    setSavingRel(false);
  }

  // IntersectionObserver to track active decade as user scrolls
  const decadeSectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerDecadeSection = useCallback((decade: string, el: HTMLElement | null) => {
    if (el) decadeSectionRefs.current.set(decade, el);
  }, []);

  useEffect(() => {
    const sections = Array.from(decadeSectionRefs.current.entries());
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const decade = [...decadeSectionRefs.current.entries()].find(
              ([, el]) => el === entry.target
            )?.[0];
            if (decade) setActiveDecade(decade);
          }
        }
      },
      { threshold: 0.4, root: mainRef.current }
    );
    sections.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [person]);

  if (isPending || loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[160, 240, 200].map((w, i) => (
            <div key={i} style={{ width: w, height: 12, borderRadius: 4, background: "var(--paper-deep)", backgroundImage: "linear-gradient(90deg, var(--paper-deep) 25%, var(--rule) 50%, var(--paper-deep) 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.5s infinite" }} />
          ))}
        </div>
      </main>
    );
  }

  if (!person) return null;

  const otherPeople = allPeople.filter((p) => p.id !== personId);

  // Compute decades from memories
  const decadeMap = new Map<string, Memory[]>();
  for (const m of person.memories) {
    const year = extractYear(m.dateOfEventText);
    if (year) {
      const decade = getDecade(year);
      if (!decadeMap.has(decade)) decadeMap.set(decade, []);
      decadeMap.get(decade)!.push(m);
    }
  }
  const decades = Array.from(decadeMap.keys()).sort();

  // No-date memories
  const undatedMemories = person.memories.filter(
    (m) => !extractYear(m.dateOfEventText)
  );

  const storyMemories = person.memories.filter((m) => m.kind === "story");
  const photoMemories = person.memories.filter((m) => m.kind === "photo");

  const dateRange =
    person.birthDateText && person.deathDateText
      ? `${person.birthDateText} – ${person.deathDateText}`
      : person.birthDateText
      ? `${person.birthDateText} –`
      : person.deathDateText
      ? `– ${person.deathDateText}`
      : null;

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column" }}>

      {/* Back nav */}
      <header style={{ padding: "16px 24px", borderBottom: "1px solid var(--rule)", display: "flex", alignItems: "center", gap: 16, background: "rgba(246,241,231,0.88)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
        <a
          href={`/trees/${treeId}`}
          style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-faded)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}
        >
          ← The Constellation
        </a>
        <span style={{ color: "var(--rule)" }}>·</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink-soft)" }}>
          {person.displayName}
        </span>
      </header>

      {/* Portrait header */}
      <div style={{ position: "relative", height: 320, overflow: "hidden", flexShrink: 0 }}>
        {person.portraitUrl ? (
          <img
            src={person.portraitUrl}
            alt={person.displayName}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.6) sepia(0.2)" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(160deg, var(--paper-deep) 0%, var(--rule) 100%)" }} />
        )}

        {/* Name overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "48px 40px 32px", background: "linear-gradient(to top, rgba(28,25,21,0.7) 0%, transparent 100%)" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 400, color: "#F6F1E7", lineHeight: 1.1, margin: 0 }}>
              {person.displayName}
            </h1>
            {dateRange && (
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "rgba(246,241,231,0.7)", marginTop: 6 }}>
                {dateRange}
              </p>
            )}
            {person.essenceLine && (
              <p style={{ fontFamily: "var(--font-body)", fontSize: 16, fontStyle: "italic", color: "rgba(246,241,231,0.85)", marginTop: 8 }}>
                {person.essenceLine}
              </p>
            )}
          </div>
        </div>

        {/* Portrait upload button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPortrait}
          style={{ position: "absolute", top: 16, right: 16, background: "rgba(246,241,231,0.85)", border: "1px solid var(--rule)", borderRadius: 20, padding: "5px 12px", fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-soft)", cursor: "pointer" }}
        >
          {uploadingPortrait ? "Uploading…" : "Change portrait"}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadPortrait(file); }}
        />
      </div>

      {/* Edit form (shown inline if editing) */}
      {editing && (
        <div style={{ background: "var(--paper-deep)", borderBottom: "1px solid var(--rule)", padding: "24px 40px" }}>
          <form onSubmit={saveEdit} style={{ maxWidth: 600, display: "flex", flexDirection: "column", gap: 12 }}>
            <input type="text" required value={editForm.displayName}
              onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Full name"
              style={inputStyle} />
            <input type="text" value={editForm.essenceLine}
              onChange={(e) => setEditForm((f) => ({ ...f, essenceLine: e.target.value }))}
              placeholder="Essence line (one sentence)"
              style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input type="text" value={editForm.birthDateText}
                onChange={(e) => setEditForm((f) => ({ ...f, birthDateText: e.target.value }))}
                placeholder="Birth date" style={inputStyle} />
              <input type="text" value={editForm.deathDateText}
                onChange={(e) => setEditForm((f) => ({ ...f, deathDateText: e.target.value }))}
                placeholder="Death date" style={inputStyle} />
            </div>
            <input type="text" value={editForm.birthPlace}
              onChange={(e) => setEditForm((f) => ({ ...f, birthPlace: e.target.value }))}
              placeholder="Birthplace" style={inputStyle} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-soft)" }}>
              <input type="checkbox" checked={editForm.isLiving}
                onChange={(e) => setEditForm((f) => ({ ...f, isLiving: e.target.checked }))} />
              Still living
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={savingEdit} style={primaryBtnStyle}>
                {savingEdit ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} style={secondaryBtnStyle}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid var(--rule)", background: "var(--paper)", position: "sticky", top: 53, zIndex: 19 }}>
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 40px", display: "flex", gap: 0 }}>
          {([
            { id: "memories", label: `Memories ${person.memories.length > 0 ? person.memories.length : ""}` },
            { id: "stories", label: `Stories ${storyMemories.length > 0 ? storyMemories.length : ""}` },
            { id: "about", label: "About" },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: activeTab === tab.id ? "var(--ink)" : "var(--ink-faded)",
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--moss)" : "2px solid transparent",
                padding: "14px 20px 12px",
                cursor: "pointer",
                transition: "color 200ms",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div style={{ flex: 1, display: "flex", maxWidth: 960, margin: "0 auto", width: "100%", padding: "0 40px", gap: 0 }}>

        {/* Decade sidebar */}
        <aside style={{ width: 120, flexShrink: 0, paddingTop: 40, position: "sticky", top: 100, alignSelf: "flex-start", display: decades.length > 0 && activeTab === "memories" ? "block" : "none" }}>
          {decades.map((decade) => (
            <button
              key={decade}
              onClick={() => {
                const el = decadeSectionRefs.current.get(decade);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveDecade(decade);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "none",
                border: "none",
                padding: "8px 0",
                cursor: "pointer",
                width: "100%",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: activeDecade === decade ? "var(--moss)" : "var(--rule)", flexShrink: 0, transition: "background 200ms" }} />
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: activeDecade === decade ? "var(--ink)" : "var(--ink-faded)", transition: "color 200ms" }}>
                {decade}
              </span>
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main ref={mainRef} style={{ flex: 1, paddingTop: 40, paddingBottom: 80, paddingLeft: decades.length > 0 && activeTab === "memories" ? 32 : 0 }}>

          {/* ── Memories tab ── */}
          {activeTab === "memories" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: 0, fontWeight: 400 }}>
                  Memories
                </h2>
                <button onClick={() => setShowMemoryForm((s) => !s)} style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--moss)", background: "none", border: "1px solid var(--moss)", borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}>
                  {showMemoryForm ? "Cancel" : "+ Add memory"}
                </button>
              </div>

              {showMemoryForm && <MemoryForm memoryForm={memoryForm} setMemoryForm={setMemoryForm} memoryFile={memoryFile} setMemoryFile={setMemoryFile} savingMemory={savingMemory} saveMemory={saveMemory} />}

              {/* Decades */}
              {decades.map((decade) => (
                <section key={decade} ref={(el) => registerDecadeSection(decade, el)} style={{ marginBottom: 48 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-soft)", fontStyle: "italic" }}>{decade}</span>
                    <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {decadeMap.get(decade)!.map((m) => <MemoryCard key={m.id} memory={m} />)}
                  </div>
                </section>
              ))}

              {undatedMemories.length > 0 && (
                <section style={{ marginBottom: 48 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-soft)", fontStyle: "italic" }}>Undated</span>
                    <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    {undatedMemories.map((m) => <MemoryCard key={m.id} memory={m} />)}
                  </div>
                </section>
              )}

              {person.memories.length === 0 && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--ink-faded)" }}>
                  No memories recorded yet.
                </p>
              )}
            </div>
          )}

          {/* ── Stories tab ── */}
          {activeTab === "stories" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: 0, fontWeight: 400 }}>Stories</h2>
                <button onClick={() => { setShowMemoryForm(true); setMemoryForm((f) => ({ ...f, kind: "story" })); setActiveTab("memories"); }}
                  style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--moss)", background: "none", border: "1px solid var(--moss)", borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}>
                  + Add story
                </button>
              </div>
              {storyMemories.length === 0 ? (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--ink-faded)" }}>No stories yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                  {storyMemories.map((m) => (
                    <article key={m.id} style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 40 }}>
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", fontWeight: 400, margin: "0 0 8px" }}>{m.title}</h3>
                      {m.dateOfEventText && <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-faded)", marginBottom: 16 }}>{m.dateOfEventText}</p>}
                      {m.body && <p style={{ fontFamily: "var(--font-body)", fontSize: 17, lineHeight: 1.85, color: "var(--ink-soft)", whiteSpace: "pre-wrap", margin: 0 }}>{m.body}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── About tab ── */}
          {activeTab === "about" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink)", margin: 0, fontWeight: 400 }}>About</h2>
                {!editing && (
                  <button onClick={() => startEditing(person)} style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-faded)", background: "none", border: "1px solid var(--rule)", borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}>
                    Edit
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  ["Birth", person.birthDateText],
                  ["Birthplace", person.birthPlace],
                  ["Death", person.deathDateText],
                  ["Status", person.isLiving ? "Living" : "Deceased"],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} style={{ display: "flex", gap: 24 }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-faded)", width: 80, flexShrink: 0 }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--ink)" }}>{value}</span>
                  </div>
                ))}

                {person.linkedUserId === session?.user.id && (
                  <div style={{ display: "flex", gap: 24 }}>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--ink-faded)", width: 80 }}>Account</span>
                    <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--moss)" }}>This is you</span>
                  </div>
                )}
              </div>

              {/* Relationships */}
              <div style={{ marginTop: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", margin: 0, fontWeight: 400 }}>Relationships</h3>
                  {otherPeople.length > 0 && (
                    <button onClick={() => setShowRelForm((s) => !s)}
                      style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--moss)", background: "none", border: "1px solid var(--moss)", borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}>
                      {showRelForm ? "Cancel" : "+ Add"}
                    </button>
                  )}
                </div>

                {showRelForm && (
                  <form onSubmit={saveRelationship} style={{ background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 8, padding: 16, marginBottom: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                    <select value={relForm.type} onChange={(e) => setRelForm((f) => ({ ...f, type: e.target.value as RelationshipType }))} style={inputStyle}>
                      <option value="parent_child">Parent / Child</option>
                      <option value="sibling">Sibling</option>
                      <option value="spouse">Spouse / Partner</option>
                    </select>
                    {relForm.type === "parent_child" && (
                      <select value={relForm.direction} onChange={(e) => setRelForm((f) => ({ ...f, direction: e.target.value as "from" | "to" }))} style={inputStyle}>
                        <option value="from">{person.displayName} is the parent</option>
                        <option value="to">{person.displayName} is the child</option>
                      </select>
                    )}
                    <select required value={relForm.otherPersonId} onChange={(e) => setRelForm((f) => ({ ...f, otherPersonId: e.target.value }))} style={inputStyle}>
                      <option value="">Select person…</option>
                      {otherPeople.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                    </select>
                    <button type="submit" disabled={savingRel} style={primaryBtnStyle}>
                      {savingRel ? "Saving…" : "Add relationship"}
                    </button>
                  </form>
                )}

                {person.relationships.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--ink-faded)" }}>No relationships recorded.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {person.relationships.map((r) => (
                      <a key={r.id} href={`/trees/${treeId}/people/${r.fromPerson.id === personId ? r.toPerson.id : r.fromPerson.id}`}
                        style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 6, textDecoration: "none" }}>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink)" }}>
                          {relationshipLabel(r, personId)}
                        </span>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-faded)" }}>→</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 6,
  border: "1px solid var(--rule)",
  padding: "9px 12px",
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "var(--ink)",
  background: "var(--paper)",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtnStyle: React.CSSProperties = {
  background: "var(--ink)",
  color: "var(--paper)",
  border: "none",
  borderRadius: 6,
  padding: "9px 20px",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  background: "none",
  color: "var(--ink-soft)",
  border: "1px solid var(--rule)",
  borderRadius: 6,
  padding: "9px 20px",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  cursor: "pointer",
};

function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <article style={{ background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 8, overflow: "hidden" }}>
      {memory.mediaUrl && memory.kind === "photo" && (
        <img src={memory.mediaUrl} alt={memory.title} style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: 20 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink)", margin: "0 0 6px", fontWeight: 400 }}>{memory.title}</h3>
        {memory.dateOfEventText && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--ink-faded)", margin: "0 0 12px" }}>{memory.dateOfEventText}</p>
        )}
        {memory.body && (
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, lineHeight: 1.8, color: "var(--ink-soft)", margin: 0, whiteSpace: "pre-wrap" }}>{memory.body}</p>
        )}
      </div>
    </article>
  );
}

function MemoryForm({
  memoryForm,
  setMemoryForm,
  memoryFile,
  setMemoryFile,
  savingMemory,
  saveMemory,
}: {
  memoryForm: { kind: "story" | "photo"; title: string; body: string; dateOfEventText: string; mediaId: string };
  setMemoryForm: React.Dispatch<React.SetStateAction<typeof memoryForm>>;
  memoryFile: File | null;
  setMemoryFile: (f: File | null) => void;
  savingMemory: boolean;
  saveMemory: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={saveMemory} style={{ background: "var(--paper-deep)", border: "1px solid var(--rule)", borderRadius: 8, padding: 20, marginBottom: 28, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {(["story", "photo"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setMemoryForm((f) => ({ ...f, kind: k }))}
            style={{ flex: 1, borderRadius: 6, padding: "8px", fontFamily: "var(--font-ui)", fontSize: 13, border: "1px solid", borderColor: memoryForm.kind === k ? "var(--moss)" : "var(--rule)", background: memoryForm.kind === k ? "var(--moss)" : "none", color: memoryForm.kind === k ? "var(--paper)" : "var(--ink-soft)", cursor: "pointer" }}>
            {k === "story" ? "Story" : "Photo"}
          </button>
        ))}
      </div>
      <input type="text" required value={memoryForm.title}
        onChange={(e) => setMemoryForm((f) => ({ ...f, title: e.target.value }))}
        placeholder="Title" style={inputStyle} />
      {memoryForm.kind === "story" && (
        <textarea required rows={4} value={memoryForm.body}
          onChange={(e) => setMemoryForm((f) => ({ ...f, body: e.target.value }))}
          placeholder="Write the memory…"
          style={{ ...inputStyle, resize: "none" }} />
      )}
      {memoryForm.kind === "photo" && (
        <input type="file" accept="image/*" required
          onChange={(e) => setMemoryFile(e.target.files?.[0] ?? null)}
          style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--ink-soft)" }} />
      )}
      <input type="text" value={memoryForm.dateOfEventText}
        onChange={(e) => setMemoryForm((f) => ({ ...f, dateOfEventText: e.target.value }))}
        placeholder="Date of event (e.g. 1964, Summer 1972)"
        style={inputStyle} />
      <button type="submit" disabled={savingMemory} style={primaryBtnStyle}>
        {savingMemory ? "Saving…" : "Add memory"}
      </button>
    </form>
  );
}
