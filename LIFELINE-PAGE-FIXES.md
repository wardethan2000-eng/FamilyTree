# Lifeline (Personal Timeline) — Review & Fix Plan

> **Drafted:** 2026-04-27
> **Status:** Proposed fixes — not yet implemented
> **Scope:** Bugs, UX, performance, and polish issues identified by code review of the
> person timeline page (`/trees/:treeId/people/:personId/lifeline`).
> **Companion to:** `LIFELINE-IMPLEMENTATION-PLAN.md` (this document covers fixes to
> the V1 immersive redesign that shipped in commit `274ad6c`).

---

## Table of Contents

1. [Files Touched by This Review](#1-files-touched-by-this-review)
2. [Bugs (Functional)](#2-bugs-functional)
3. [UX & Correctness Issues](#3-ux--correctness-issues)
4. [Performance Issues](#4-performance-issues)
5. [Polish & Cleanup](#5-polish--cleanup)
6. [Suggested Fix Order](#6-suggested-fix-order)
7. [Out of Scope (Tracked Elsewhere)](#7-out-of-scope-tracked-elsewhere)

---

## 1. Files Touched by This Review

```
apps/web/src/app/trees/[treeId]/people/[personId]/lifeline/page.tsx
apps/web/src/components/lifeline/
  ├── LifelinePage.tsx
  ├── LifelineHeader.tsx
  ├── LifelineEraRail.tsx
  ├── LifelineYearGroup.tsx
  ├── LifelineAnchorRow.tsx
  ├── LifelineMemoryCard.tsx
  ├── LifelineUndated.tsx
  ├── lifelineTypes.ts
  ├── lifeline.module.css
  ├── useActiveEra.ts
  └── useScrollReveal.ts
apps/web/src/lib/date-utils.ts
```

---

## 2. Bugs (Functional)

### 2.1 — Era-rail navigation is broken
**Severity:** High — primary navigation affordance does nothing.
**Location:** `LifelinePage.tsx:194-201` (`handleEraClick`) +
`LifelineEraRail.tsx:26` + `LifelineYearGroup.tsx:21-27`.

**Problem:**

```ts
const target = document.querySelector(`[data-era="${eraLabel}"]`)
  || document.getElementById(`lifeline-year-0`);
if (target) {
  const yearEl = target.closest("[data-year]") || target;
  (yearEl as HTMLElement).scrollIntoView?.({ behavior: "smooth", block: "start" });
}
```

The only elements carrying `data-era` are the era-rail buttons themselves
(`LifelineEraRail.tsx:26`). The year-group rows only carry `data-year` and
`data-birth-year`. So:

1. `querySelector("[data-era=…]")` matches the **clicked button**.
2. `.closest("[data-year]")` returns `null` (the button is in the sticky sidebar).
3. The fallback `target` is the same button, which gets `scrollIntoView`'d —
   inside its own sticky container, producing no visible effect.
4. The secondary fallback `lifeline-year-0` is a non-existent id.

**Fix:**
- Add `data-era={group.era?.label ?? ""}` to the year-group root in
  `LifelineYearGroup.tsx`.
- Rewrite `handleEraClick` to look up the **first** year-group whose
  `data-era` matches.

```tsx
// LifelineYearGroup.tsx
<div
  ref={ref}
  id={`lifeline-year-${group.year}`}
  data-year={group.year}
  data-birth-year={birthYear ?? ""}
  data-era={group.era?.label ?? ""}
  className={...}
>
```

```ts
// LifelinePage.tsx
const handleEraClick = useCallback((eraLabel: string) => {
  const target = document.querySelector<HTMLElement>(
    `[data-year][data-era="${eraLabel}"]`
  );
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}, []);
```

**Test plan:**
- Click each era chip on a person with memories spanning every era.
- Verify mobile (`eraRibbonMobile`) and desktop (`eraRail`) both work.
- Verify a person with gaps (e.g., no Teen years) only shows visited eras and
  scrolling jumps to the next populated era.

---

### 2.2 — "Born" anchor row shows a person's name as the birthplace
**Severity:** High — actively misleading data.
**Location:** `LifelinePage.tsx:298-306`.

**Problem:**

```tsx
<LifelineAnchorRow
  year={birthYear}
  label="Born"
  accent="var(--gilt)"
  detail={person.birthDateText ?? String(birthYear)}
  place={person.relationships?.[0]?.fromPerson?.displayName ?? null}
/>
```

`relationships[0]` is whichever relationship arrived first from the API — could
be a parent, sibling, or spouse — and `fromPerson.displayName` is a **person's
name**, not a place. The `place` prop is then rendered visually as a location
under the birth year, so users see something like "Jane Smith" rendered as the
person's birthplace.

**Fix (short term):** drop the `place` prop until the API exposes a real
birthplace.

```tsx
<LifelineAnchorRow
  year={birthYear}
  label="Born"
  accent="var(--gilt)"
  detail={person.birthDateText ?? String(birthYear)}
/>
```

**Fix (longer term):** add `birthPlace?: { label: string } | null` to
`LifelinePerson` and surface it from the API; same treatment for `deathPlace`
on the "Passed" anchor row.

**Test plan:**
- Person with multiple relationships (parents + spouse + sibling): "Born" row
  no longer shows any name.
- Person with no relationships: no regression.

---

### 2.3 — Active era doesn't update when scrolling up
**Severity:** Medium — era highlight goes stale, undermining wayfinding.
**Location:** `useActiveEra.ts:18-30`.

**Problem:**

```ts
if (entries[0]?.isIntersecting) {
  ...
  if (era) setActiveEra(era.label);
}
```

The hook only updates on `isIntersecting === true`. Scrolling **up** never
clears or reassigns the active era until the next year group enters from above
— and with `rootMargin: "-30% 0px -60% 0px"` and one observer per element,
firing order can leave a stale era highlighted. Multiple year-groups can also
be intersecting simultaneously, and the hook just takes whichever fires last.

**Fix:** track all intersecting elements and pick the topmost in document order.

```ts
import { useEffect, useState } from "react";
import { LIFELINE_ERAS } from "@/lib/date-utils";

export function useActiveEra(yearElementIds: string[]) {
  const [activeEra, setActiveEra] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const intersecting = new Set<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target as HTMLElement);
          else intersecting.delete(entry.target as HTMLElement);
        }
        const top = [...intersecting].sort(
          (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top
        )[0];
        if (!top) return;
        const year = Number(top.dataset.year);
        const birth = Number(top.dataset.birthYear);
        if (!Number.isFinite(year) || !Number.isFinite(birth)) return;
        const age = year - birth;
        const era = LIFELINE_ERAS.find(
          (e) => age >= e.ageStart && age <= e.ageEnd
        );
        if (era) setActiveEra(era.label);
      },
      { rootMargin: "-30% 0px -60% 0px" }
    );

    for (const id of yearElementIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [yearElementIds]);

  return activeEra;
}
```

**Test plan:**
- Scroll down through eras; rail highlight tracks correctly.
- Scroll back up; rail highlight follows in reverse, not stuck.
- Use `prefers-reduced-motion` (instant scroll) and verify no flicker.

---

### 2.4 — Redundant `activeEra` state mirroring
**Severity:** Low — dead code that also has a subtle bug (era can never clear).
**Location:** `LifelinePage.tsx:55, 189-192`.

**Problem:**

```ts
const [activeEra, setActiveEra] = useState<string | null>(null);
const detectedActiveEra = useActiveEra(yearElementIds);
useEffect(() => {
  if (detectedActiveEra) setActiveEra(detectedActiveEra);
}, [detectedActiveEra]);
```

`setActiveEra` is never called from any other site. The mirror also blocks
`null` from ever propagating — once an era is detected, `activeEra` can never
return to `null`.

**Fix:** delete the local state and the mirror effect; pass the hook's return
value straight to the rail.

```ts
const activeEra = useActiveEra(yearElementIds);
// ... pass to <LifelineEraRail activeEra={activeEra} />
```

---

### 2.5 — `useEffect` data fetch over-fires on `session` reference changes
**Severity:** Low — extra fetches, no correctness break.
**Location:** `LifelinePage.tsx:113`.

**Problem:** dependency array uses `session` (whole object). The auth client
can mint a new object reference on every revalidation, causing a re-fetch and
loading flash even when the user hasn't changed.

**Fix:**

```ts
}, [treeId, personId, session?.user?.id, sessionPending, router]);
```

---

### 2.6 — Wizard refetch swallows errors and skips the `res.ok` check
**Severity:** Low — silent staleness after add.
**Location:** `LifelinePage.tsx:355-363`.

**Problem:**

```ts
.then((res) => res.json())   // no res.ok check — JSON parse can mask the error
.catch(() => {})              // error swallowed; loadError not updated
```

After adding a memory, if the refetch returns 4xx/5xx the page silently keeps
the stale `person` and the user never sees their new memory.

**Fix:** mirror the original fetch's error-handling, ideally by extracting a
`loadPerson()` helper used by both effects.

```ts
const loadPerson = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch(`${API}/api/trees/${treeId}/people/${personId}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Could not load person (${res.status})`);
    const data = (await res.json()) as PersonApiResponse;
    setPerson(data);
    setLoadError(null);
  } catch (err) {
    setLoadError(err instanceof Error ? err.message : "Could not load person");
  } finally {
    setLoading(false);
  }
}, [treeId, personId]);
```

---

### 2.7 — Back-link inconsistency between header variants
**Severity:** Low — copy/UX inconsistency.
**Location:** `LifelineHeader.tsx:40` vs `:80`.

- Portrait variant: `← {person.displayName}`
- Text variant:     `← Back to {person.displayName}`

Both also link to `?section=lifeline` — but the user is *leaving* the lifeline
page, so this is a confusing destination hint.

**Fix:** unify to `← Back to {displayName}` and route to `?section=overview`
(or no section) so the person page lands on its overview, not on a
lifeline-preview that the user just walked away from.

---

## 3. UX & Correctness Issues

### 3.1 — Audio & video controls inside `<Link>` swallow taps
**Severity:** Medium — interactive media is unusable.
**Location:** `LifelineMemoryCard.tsx:51-72` (voice) and `:118-139` (video).

The card is wrapped in a Next `<Link>` but contains `<audio controls>` /
`<video controls>`. Clicking play/seek/volume bubbles up and navigates to the
memory detail page mid-interaction.

**Fix options:**
- Stop propagation on the media element:
  ```tsx
  <audio
    src={mediaUrl}
    controls
    preload="metadata"
    className={styles.audioPlayer}
    onClick={(e) => e.stopPropagation()}
  />
  ```
- Or restructure the card so the media sits **outside** the link and an
  explicit "Open memory" affordance is the only navigation trigger.

The second option is preferable — clicking "play" on a voice memory then
having it scrub while the page transitions is jarring even with
`stopPropagation`.

**Test plan:** play/pause/seek a voice and a video memory directly from the
timeline; navigation should NOT occur from media controls but should still
occur from card chrome.

---

### 3.2 — Empty state hides when person has only a birth year
**Severity:** Low — "broken-feeling" empty timeline.
**Location:** `LifelinePage.tsx:259`.

```ts
const hasContent =
  grouped.years.length > 0 || grouped.undated.length > 0 || birthYear;
```

A person with only `birthDateText` and zero memories renders the timeline (a
single "Born" anchor floating in space) instead of the empty CTA. The empty
CTA is what prompts the user to add memories.

**Fix:**

```ts
const hasContent = grouped.years.length > 0 || grouped.undated.length > 0;
```

---

### 3.3 — `useScrollReveal` flashes everything on refetch
**Severity:** Low — visual jank after adding a memory.
**Location:** `useScrollReveal.ts` + `LifelineYearGroup.tsx`.

When `AddMemoryWizard.onSuccess` triggers a refetch, every group remounts,
all rows reset `visible=false`, then reveal as the IntersectionObserver fires.
The whole timeline flashes.

**Fix options:**
- Track "first load complete" in `LifelinePage` and pass a `disableReveal`
  prop down so subsequent renders skip the animation.
- Or check `getBoundingClientRect` synchronously on mount and set
  `visible=true` if the element is already in viewport.

---

### 3.4 — Relationship lifeline events only cover spouses
**Severity:** Medium (feature gap, not regression).
**Location:** `LifelinePage.tsx:148-158`, `LifelineYearGroup.tsx:77`.

Parent-child and sibling events are skipped. A timeline that ignores
"child born" misses some of the most natural anchor events. For each
parent_child relationship where this person is `fromPerson`, surface the
child's birth as an event in the parent's lifeline.

**Fix sketch:**

```ts
for (const rel of person.relationships) {
  if (rel.type === "spouse" && rel.startDateText) {
    const y = extractYear(rel.startDateText);
    if (y !== null) addEvent(y, rel);
  }
  if (rel.type === "parent_child" && rel.fromPerson.id === person.id) {
    // child's birth — needs childBirthDateText from API
    const y = extractYear(rel.startDateText);
    if (y !== null) addEvent(y, rel);
  }
}
```

The `LifelineRelationshipEvent` type may need a child-side date field;
coordinate with the API change.

---

### 3.5 — Era counts include contextual memories
**Severity:** Low — counts feel inflated.
**Location:** `LifelinePage.tsx:181`.

```ts
counts[group.era.label] = (counts[group.era.label] ?? 0) + group.memories.length;
```

`group.memories` mixes direct + contextual. Decide whether era-rail counts
mean "things on this person's lifeline" (current) or "their own memories"
(filter to `memoryContext !== "contextual"`), and pick one consistently.

---

## 4. Performance Issues

### 4.1 — Photo / document cards use raw `<img>`
**Location:** `LifelineMemoryCard.tsx:24, 98`.

No `width` / `height`, no `next/image`, no `sizes`. Causes layout shift and
serves full-resolution media for thumbnail-sized cards. Replace with
`next/image`, or pass intrinsic dimensions through from the API.

### 4.2 — `preload="metadata"` on every media card
**Location:** `LifelineMemoryCard.tsx:60, 121`.

Every audio/video on the page initiates a metadata probe on first paint. For
long lifelines this hammers the media proxy. Switch to `preload="none"` and
upgrade to `metadata` on intersection or hover.

---

## 5. Polish & Cleanup

### 5.1 — Hard-coded colors in header
**Location:** `LifelineHeader.tsx:112, 128, 131, 142, 147`.

`#F6F1E7` and `rgba(246, 241, 231, …)` are repeated. Lift them into design
tokens (`--paper-on-portrait`, `--ink-on-portrait`, etc.) so the system stays
consistent and dark-mode-safe.

### 5.2 — Dead CSS
**Location:** `lifeline.module.css`.

`compactHeader`, `compactPortrait`, `compactHeaderInfo`, `storyContinue` are
defined but referenced nowhere. Delete them, or wire them up to the variants
they were intended for.

### 5.3 — Inconsistent kind icons
**Location:** `lifelineTypes.ts:57-63`.

```ts
KIND_ICONS = {
  story: "✎",     // ✎
  photo: "◻",     // ◻
  voice: "🎤", // 🎤
  document: "□",  // □
  other: "✦",     // ✦
};
```

These render very differently across fonts/platforms. Replace with a coherent
icon set (the codebase already imports lucide / heroicons elsewhere — pick
one) so the visual hierarchy reads consistently.

### 5.4 — Inline `style={{ width: "100%" }}` on portrait header
**Location:** `LifelineHeader.tsx:35`. Move to the CSS module class.

### 5.5 — `LifelineUndated.tsx` placement
**Location:** `LifelinePage.tsx:327-331`.

The "Time unknown" section currently renders **after** the "Passed" anchor row,
which can be visually confusing for deceased people (it reads like
post-mortem memories). Consider rendering before the death anchor or in a
clearly separated trailing section.

---

## 6. Suggested Fix Order

| Order | Item | Section | Reason |
|------:|------|---------|--------|
| 1 | Era-rail navigation | 2.1 | Most visible "broken" bug |
| 2 | Active-era detection on scroll-up | 2.3 | Pairs with #1, same surface |
| 3 | Redundant `activeEra` mirror | 2.4 | Cleanup that prevents resurfacing |
| 4 | "Born" birthplace bug | 2.2 | Misleading data, trivial fix |
| 5 | Audio/video click swallow | 3.1 | High user-pain interaction bug |
| 6 | Wizard refetch hardening | 2.6 | Prevents stale data after add |
| 7 | Back-link consistency | 2.7 | Copy alignment |
| 8 | Fetch dep stability | 2.5 | Removes loading flashes |
| 9 | Empty-state condition | 3.2 | Better first-time experience |
| 10 | Reveal animation flicker | 3.3 | Polish after refetch |
| 11 | `next/image` migration | 4.1 | Performance win |
| 12 | `preload="none"` | 4.2 | Network/perf win |
| 13 | Era counts contextual filter | 3.5 | Number accuracy |
| 14 | Hard-coded colors → tokens | 5.1 | Design system hygiene |
| 15 | Dead CSS cleanup | 5.2 | Codebase hygiene |
| 16 | Kind icons → consistent set | 5.3 | Visual polish |
| 17 | Parent-child relationship events | 3.4 | Feature gap (requires API work) |

Items 1–10 are recommended for a single PR; 11–17 can be a follow-up.

---

## 7. Out of Scope (Tracked Elsewhere)

- The broader lifeline roadmap (life chapters, dedicated timeline API, advanced
  interactivity) lives in `LIFELINE-IMPLEMENTATION-PLAN.md` Phases 4–7.
- Memory creation/edit UX is owned by `MEMORY-PAGE-PLAN.md`.
- Sharing/visibility behavior on the lifeline is owned by
  `MEMORY-SHARING-PLAN.md`.
