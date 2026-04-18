"use client";

import { use, useEffect, useRef, useState } from "react";
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
  const other =
    r.fromPerson.id === personId ? r.toPerson : r.fromPerson;
  const label = r.fromPerson.id === personId ? fromLabel : toLabel;
  return `${label} ${other.displayName}`;
}

export default function PersonPage({
  params,
}: {
  params: Promise<{ treeId: string; personId: string }>;
}) {
  const { treeId, personId } = use(params);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [allPeople, setAllPeople] = useState<PersonSummary[]>([]);

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
    const res = await fetch(
      `${API}/api/trees/${treeId}/people/${personId}`,
      { credentials: "include" },
    );
    if (!res.ok) {
      router.replace(`/dashboard?treeId=${treeId}`);
      return;
    }
    setPerson((await res.json()) as Person);
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
    const res = await fetch(
      `${API}/api/trees/${treeId}/people/${personId}`,
      {
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
      },
    );
    if (res.ok) {
      setEditing(false);
      await loadPerson();
    }
    setSavingEdit(false);
  }

  async function uploadPortrait(file: File) {
    setUploadingPortrait(true);
    // 1. Presign
    const presignRes = await fetch(
      `${API}/api/trees/${treeId}/media/presign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      },
    );
    if (!presignRes.ok) {
      setUploadingPortrait(false);
      return;
    }
    const { mediaId, uploadUrl } = (await presignRes.json()) as {
      mediaId: string;
      uploadUrl: string;
    };

    // 2. PUT directly to MinIO
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });

    // 3. PATCH person with new portraitMediaId
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
      const presignRes = await fetch(
        `${API}/api/trees/${treeId}/media/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            filename: memoryFile.name,
            contentType: memoryFile.type,
            sizeBytes: memoryFile.size,
          }),
        },
      );
      if (presignRes.ok) {
        const { mediaId, uploadUrl } = (await presignRes.json()) as {
          mediaId: string;
          uploadUrl: string;
        };
        await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": memoryFile.type },
          body: memoryFile,
        });
        resolvedMediaId = mediaId;
      }
    }

    const res = await fetch(
      `${API}/api/trees/${treeId}/people/${personId}/memories`,
      {
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
      },
    );
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

  if (isPending || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-400">Loading…</p>
      </main>
    );
  }

  if (!person) return null;

  const otherPeople = allPeople.filter((p) => p.id !== personId);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-6 py-4 flex items-center gap-4">
        <a
          href={`/dashboard?treeId=${treeId}`}
          className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          ← Back
        </a>
        <p className="text-xs uppercase tracking-widest text-stone-400">
          FamilyTree
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 space-y-12">
        {/* Portrait + Identity */}
        <section className="flex items-start gap-6">
          <div className="relative shrink-0">
            {person.portraitUrl ? (
              <img
                src={person.portraitUrl}
                alt={person.displayName}
                className="h-28 w-28 rounded-2xl object-cover"
              />
            ) : (
              <div className="h-28 w-28 rounded-2xl bg-stone-100 flex items-center justify-center text-4xl font-medium text-stone-300">
                {person.displayName[0]}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPortrait}
              className="absolute -bottom-2 -right-2 rounded-full bg-white border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50 shadow-sm"
            >
              {uploadingPortrait ? "…" : "📷"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPortrait(file);
              }}
            />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <input
                  type="text"
                  required
                  value={editForm.displayName}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <input
                  type="text"
                  value={editForm.essenceLine}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, essenceLine: e.target.value }))
                  }
                  placeholder="Essence line"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editForm.birthDateText}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        birthDateText: e.target.value,
                      }))
                    }
                    placeholder="Birth date"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    type="text"
                    value={editForm.deathDateText}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        deathDateText: e.target.value,
                      }))
                    }
                    placeholder="Death date"
                    className="rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </div>
                <input
                  type="text"
                  value={editForm.birthPlace}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, birthPlace: e.target.value }))
                  }
                  placeholder="Birthplace"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
                <label className="flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={editForm.isLiving}
                    onChange={(e) =>
                      setEditForm((f) => ({
                        ...f,
                        isLiving: e.target.checked,
                      }))
                    }
                  />
                  Still living
                </label>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
                  >
                    {savingEdit ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h1 className="text-2xl font-semibold text-stone-950">
                    {person.displayName}
                  </h1>
                  {person.linkedUserId === session?.user.id && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                      you
                    </span>
                  )}
                </div>
                {person.essenceLine && (
                  <p className="mt-1 text-base text-stone-500 italic">
                    {person.essenceLine}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-400">
                  {person.birthDateText && (
                    <span>b. {person.birthDateText}</span>
                  )}
                  {person.deathDateText && (
                    <span>d. {person.deathDateText}</span>
                  )}
                  {person.birthPlace && <span>{person.birthPlace}</span>}
                  {!person.isLiving && !person.deathDateText && (
                    <span>Deceased</span>
                  )}
                </div>
                <button
                  onClick={() => startEditing(person)}
                  className="mt-3 text-xs text-stone-400 hover:text-stone-700 transition-colors"
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Relationships */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">
              Relationships
            </h2>
            {otherPeople.length > 0 && (
              <button
                onClick={() => setShowRelForm((s) => !s)}
                className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
              >
                {showRelForm ? "Cancel" : "+ Add"}
              </button>
            )}
          </div>

          {showRelForm && (
            <form
              onSubmit={saveRelationship}
              className="rounded-xl border border-stone-200 bg-white p-4 space-y-3"
            >
              <div>
                <label className="block text-xs text-stone-500 mb-1">
                  Relationship type
                </label>
                <select
                  value={relForm.type}
                  onChange={(e) =>
                    setRelForm((f) => ({
                      ...f,
                      type: e.target.value as RelationshipType,
                    }))
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="parent_child">Parent / Child</option>
                  <option value="sibling">Sibling</option>
                  <option value="spouse">Spouse / Partner</option>
                </select>
              </div>
              {relForm.type === "parent_child" && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">
                    Direction
                  </label>
                  <select
                    value={relForm.direction}
                    onChange={(e) =>
                      setRelForm((f) => ({
                        ...f,
                        direction: e.target.value as "from" | "to",
                      }))
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  >
                    <option value="from">
                      {person.displayName} is the parent
                    </option>
                    <option value="to">
                      {person.displayName} is the child
                    </option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-stone-500 mb-1">
                  Other person
                </label>
                <select
                  required
                  value={relForm.otherPersonId}
                  onChange={(e) =>
                    setRelForm((f) => ({
                      ...f,
                      otherPersonId: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  <option value="">Select…</option>
                  {otherPeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={savingRel}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {savingRel ? "Saving…" : "Add relationship"}
              </button>
            </form>
          )}

          {person.relationships.length === 0 ? (
            <p className="text-sm text-stone-400">No relationships recorded.</p>
          ) : (
            <ul className="space-y-2">
              {person.relationships.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-stone-100 bg-white px-4 py-3 text-sm text-stone-700"
                >
                  {relationshipLabel(r, personId)}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Memories */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-900">Memories</h2>
            <button
              onClick={() => setShowMemoryForm((s) => !s)}
              className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
            >
              {showMemoryForm ? "Cancel" : "+ Add memory"}
            </button>
          </div>

          {showMemoryForm && (
            <form
              onSubmit={saveMemory}
              className="rounded-xl border border-stone-200 bg-white p-4 space-y-3"
            >
              <div className="flex gap-2">
                {(["story", "photo"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setMemoryForm((f) => ({ ...f, kind: k }))
                    }
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      memoryForm.kind === k
                        ? "bg-stone-900 text-white"
                        : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {k === "story" ? "Story" : "Photo"}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                value={memoryForm.title}
                onChange={(e) =>
                  setMemoryForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Title"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              {memoryForm.kind === "story" && (
                <textarea
                  required
                  rows={4}
                  value={memoryForm.body}
                  onChange={(e) =>
                    setMemoryForm((f) => ({ ...f, body: e.target.value }))
                  }
                  placeholder="Write the memory…"
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                />
              )}
              {memoryForm.kind === "photo" && (
                <input
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) =>
                    setMemoryFile(e.target.files?.[0] ?? null)
                  }
                  className="w-full text-sm text-stone-500"
                />
              )}
              <input
                type="text"
                value={memoryForm.dateOfEventText}
                onChange={(e) =>
                  setMemoryForm((f) => ({
                    ...f,
                    dateOfEventText: e.target.value,
                  }))
                }
                placeholder="Date of event (optional)"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              <button
                type="submit"
                disabled={savingMemory}
                className="rounded-lg bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {savingMemory ? "Saving…" : "Add memory"}
              </button>
            </form>
          )}

          {person.memories.length === 0 ? (
            <p className="text-sm text-stone-400">No memories yet.</p>
          ) : (
            <ul className="space-y-4">
              {person.memories.map((m) => (
                <li
                  key={m.id}
                  className="rounded-2xl border border-stone-100 bg-white p-5"
                >
                  {m.mediaUrl && (
                    <img
                      src={m.mediaUrl}
                      alt={m.title}
                      className="w-full rounded-xl object-cover max-h-96 mb-4"
                    />
                  )}
                  <h3 className="font-semibold text-stone-900">{m.title}</h3>
                  {m.dateOfEventText && (
                    <p className="mt-0.5 text-xs text-stone-400">
                      {m.dateOfEventText}
                    </p>
                  )}
                  {m.body && (
                    <p className="mt-3 text-sm leading-7 text-stone-600 whitespace-pre-wrap">
                      {m.body}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
