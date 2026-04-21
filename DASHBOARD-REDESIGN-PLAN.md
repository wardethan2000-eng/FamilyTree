# Dashboard / Home Redesign Plan

## Purpose

Redesign the signed-in landing experience so it feels like entering a living family archive rather than opening a utility dashboard. The product should communicate memory, lineage, historical scale, and invitation to explore within seconds.

This effort spans four related surfaces:

- `/` — signed-in router
- `/dashboard` — cross-tree foyer
- `/trees/[treeId]/atrium` — immersive tree home
- `/trees/[treeId]` — constellation workspace

The core goal is not "make the dashboard prettier." The goal is to make the first signed-in experience feel like an heirloom archive.

---

## Review Of The Current Draft

The current draft is directionally strong in three ways:

- it correctly identifies the atrium as the best foundation for the real home experience
- it stays memory-first instead of drifting into social-feed patterns
- it separates the emotional front door from the deeper tree workspace

The draft still needs expansion in five areas before it becomes an implementation plan:

1. It does not fully resolve what "home" means.
   The current code routes `/` directly to a tree atrium, while `SPEC.md` also describes a cross-tree atrium concept. We need one implementation decision for this redesign cycle.

2. It is stronger on product vision than delivery shape.
   The plan needs concrete route behavior, API contracts, component seams, and acceptance criteria.

3. It skips the current frontend reality.
   The current atrium is a large client page that independently fetches tree, people, memories, inbox, and curation. The redesign should not pile more logic onto that pattern.

4. It does not separate MVP from later editorial tools.
   Hero rotation, scale, and discovery should work automatically before manual curation exists.

5. It does not yet cover sparse archives, mobile behavior, or rollout safety.
   The home page must still feel intentional when a tree has 3 people and 2 memories, not only when it has hundreds.

---

## Recommended Information Architecture

### Decision for this redesign cycle

For this cycle, the product should treat the tree atrium as the true home and the dashboard as a cross-tree foyer.

That means:

- `/trees/[treeId]/atrium` is the emotional front door
- `/dashboard` is where multi-tree users choose or switch archives
- `/trees/[treeId]` remains the structural exploration workspace

This keeps the redesign aligned with the current codebase and with the user's stated desire for a homepage that combines rotating memories with a sense of family scale.

### Signed-in routing

Recommended behavior for `/`:

- no trees: route to onboarding
- one tree: route to `/trees/[treeId]/atrium`
- multiple trees:
  - initial simple version: route to `/dashboard`
  - later refinement: route to last-opened tree atrium and keep `/dashboard` as an explicit "all archives" surface

### Why not make `/dashboard` do everything

If `/dashboard` tries to be both:

- a multi-tree chooser
- a tree-specific immersive memory homepage

it will become muddled. The redesign will be cleaner if the product has:

- one cross-tree surface for choosing archives
- one tree-specific surface for emotional entry

---

## Product Thesis

The landing experience should feel like a living family foyer:

1. Memory-first. Stories, voices, and images arrive before utility.
2. Scale-aware. The user immediately feels the breadth of the archive.
3. Lineage-aware. The user understands where they stand within the family shape.
4. Calm and editorial. The product feels archival, not social.
5. Inviting to drift. Exploration is encouraged without becoming noisy.

This is explicitly not:

- a feed
- an activity dashboard
- a notification center
- a directory of cards with thin metadata

---

## Ground Truth In The Current Code

### Current `/dashboard`

`apps/web/src/app/dashboard/page.tsx` currently:

- fetches tree memberships
- selects an active tree
- fetches that tree's people
- renders a functional people grid

It is currently a utilitarian selector, not a memorable landing experience.

### Current `/trees/[treeId]/atrium`

`apps/web/src/app/trees/[treeId]/atrium/page.tsx` already contains the strongest foundation:

- a featured memory hero
- drift CTA
- constellation CTA
- recent memory strip
- family member section
- inbox and curation nudges

This is the right place to deepen the experience first.

### Current technical constraint

The atrium currently fetches multiple resources client-side:

- tree
- people
- memories
- prompts inbox count
- curation queue count

This is manageable today, but it is the wrong foundation for a richer home page with hero rotation, era filtering, and multiple discovery lanes.

### Reuse opportunity

The constellation preview should reuse existing tree layout logic where possible instead of inventing a second family-shape model:

- `apps/web/src/components/tree/treeLayout.ts`
- `apps/web/src/components/tree/TreeCanvas.tsx`

The homepage preview should be lighter than the full workspace, but it should still derive from the same relationship truth.

---

## Experience Direction

## 1. Rotating memory stage

The top of the tree atrium should become a rotating editorial memory stage.

It should:

- rotate through 4 to 8 selected memory candidates
- support photo, story, voice, and document memories
- rotate slowly with fades or dissolves
- show title, subject, date or era, and a short excerpt
- keep strong actions visible:
  - `Open memory`
  - `Begin drifting`
  - `Enter constellation`

It should avoid:

- loud carousel controls
- autoplay audio
- fast motion
- "engagement" treatments

### Hero selection v1

The first version should be automatic, not manually curated.

Candidate ranking should favor:

- photo memories with media
- voice memories with transcript text
- stories with strong title plus excerpt
- memories with useful date text
- memories tied to the current season, anniversaries, or resurfacing logic when available

The selector should also enforce diversity:

- do not show the same person repeatedly in sequence
- do not show only one memory kind
- avoid repeating the same hero within a short revisit window

### Sparse archive fallback

If there are not enough rich memories:

- show a typographic hero using the best story or voice excerpt
- if there are no memories at all, use the tree name plus a guided "start the archive" state

---

## 2. Sense-of-scale band

Directly below the hero, add a scale band that translates archive breadth into human language.

Suggested content:

- people count
- memory count
- generation depth estimate
- earliest known year and latest period
- optional "unfinished" signal for missing branches or weak coverage

The tone should be interpretive, not dashboard-like. Example:

- `124 people across 6 generations`
- `892 memories from the 1880s to today`
- `14 branches still waiting to be filled in`

---

## 3. Constellation preview

The home page should include a preview of family structure without dropping the user into the full workspace immediately.

This preview should:

- be read-first, not edit-first
- center on the current user's linked person when available
- otherwise center on the featured memory's primary person
- otherwise fall back to a root branch chosen by relationship density
- show just enough nodes and relationships to communicate shape
- route to `/trees/[treeId]` for deep exploration

The preview should not include heavy editing affordances.

---

## 4. Narrative discovery lanes

The current "Recently added" strip is too generic to carry the whole homepage.

Replace it with a small set of editorial lanes. Candidate lanes:

- `Resurfacing now`
  Older memories that feel newly relevant.

- `Voices in the archive`
  Voice memos, transcript excerpts, and perspective-heavy material.

- `People to revisit`
  High-density profiles, recently enriched people, or people related to the current hero.

- `Unfinished branches`
  Sparse branches, missing portraits, thin timelines, or family members who need stories.

- `Around one era`
  Memories clustered around the currently selected decade or generation.

These should feel like curated shelves or exhibits, not endless horizontally scrolling feeds.

---

## 5. Era navigation

An era ribbon or decade selector is one of the best ways to make the archive feel historically deep.

The first version should:

- support decade buckets
- update hero candidates
- update one or two supporting lanes
- preserve an "all eras" state

Generation-based filters can come later if decade-based navigation proves insufficient.

Why decade first:

- simpler to derive from existing date text
- easier for users to understand quickly
- lower ambiguity than generation math when data is incomplete

---

## 6. Dashboard as cross-tree foyer

Once the tree atrium is strong, redesign `/dashboard` to feel like entering a collection of family archives.

Each tree card should include:

- tree name
- role
- people count
- memory count
- era span
- one representative image or tonal panel
- a clear entry action into that tree's atrium

The dashboard should:

- prioritize the last-opened or primary tree
- stop centering the entire experience around a people grid
- feel visually related to the atrium

The dashboard should not try to replicate the full tree-home experience for every tree at once.

---

## 7. Editorial curation, later

Manual curation should come after the automated homepage feels alive.

Later curation features can include:

- pinning hero candidates
- featuring specific people or branches
- ordering lanes
- suppressing weak or repetitive candidates

This should enhance the system, not be required to make the homepage work.

---

## Visual And Interaction Principles

### Tone

- editorial
- cinematic
- warm
- quiet
- archival

### Layout

- generous spacing
- strong hierarchy
- fewer, richer modules
- less chrome, more atmosphere

### Motion

- slow fades
- soft reveals
- gentle drift
- pause on hover or focus
- respect reduced motion

### Anti-patterns

- infinite feeds
- social-media card systems
- dense analytics panels
- bright notification styling
- first-screen editing clutter

---

## Revised Implementation Phases

## Phase 0 - Product decisions and scope lock

### Goal

Resolve the architectural ambiguity before design and coding spread across multiple surfaces.

### Decisions to make

- confirm that the tree atrium is the primary home surface for this cycle
- confirm `/dashboard` as cross-tree foyer, not the emotional homepage
- confirm decade-based era navigation for v1
- confirm that branch bias means:
  - constellation preview centers on the user's branch when possible
  - hero and discovery remain tree-wide unless filtered
- confirm that manual curation is not required for MVP

### Additional output

- define home-page non-goals
- define success metrics
- define sparse-archive behavior

### Exit criteria

- route roles are agreed
- v1 scope is frozen
- unresolved product questions are written down explicitly

---

## Phase 1 - Home data contract and ranking logic

### Goal

Create one coherent tree-home payload instead of assembling the homepage from unrelated client fetches.

### API addition

Add:

- `GET /api/trees/:treeId/home`

### Proposed payload shape

The payload should include:

- tree summary
- membership role
- current user linked person id, if any
- counts:
  - people
  - memories
  - generations
  - branches needing attention
- date coverage:
  - earliest year
  - latest year
  - decade buckets
- hero candidates
- resurfacing lane candidates
- voices lane candidates
- people-to-revisit lane candidates
- unfinished-archive prompts
- preview constellation seed data
- inbox count
- curation count

### Data source guidance

Build this on top of existing tree-scoped read logic rather than inventing new access rules:

- `apps/api/src/lib/cross-tree-read-service.ts`
- `apps/api/src/routes/trees.ts`
- `apps/api/src/routes/memories.ts`

### Ranking logic v1

Start simple and deterministic:

- hero candidates from top-ranked memories with diversity constraints
- resurfacing from older memories with media, transcripts, or historically relevant dates
- voices from voice memories and perspectives with usable transcript snippets
- unfinished from missing portraits, missing dates, sparse people, and thin branches

### Important constraint

Do not block this phase on a perfect recommendation engine. The first pass should be explainable and stable.

### Exit criteria

- one API response powers the atrium
- all home sections can render from that payload
- payload handles empty, small, and rich archives cleanly

---

## Phase 2 - Frontend foundation and component extraction

### Goal

Stop treating the atrium as one growing page file and create reusable home components.

### Frontend work

Create a new home component area, for example:

- `apps/web/src/components/home/TreeHomeHero.tsx`
- `apps/web/src/components/home/ScaleBand.tsx`
- `apps/web/src/components/home/EraRibbon.tsx`
- `apps/web/src/components/home/ConstellationPreview.tsx`
- `apps/web/src/components/home/DiscoveryLane.tsx`
- `apps/web/src/components/home/ArchivePromptPanel.tsx`

Refactor:

- `apps/web/src/app/trees/[treeId]/atrium/page.tsx`

into a composition layer instead of a monolith.

### Styling direction

The current codebase mixes inline-style-heavy atrium code with Tailwind-based dashboard code.

This phase should introduce a minimal shared visual language for home surfaces:

- section spacing primitives
- surface treatments
- typographic scales
- home-page tokens for hero, rules, overlays, and muted metadata

This does not require a full design system rewrite.

### Exit criteria

- new atrium sections live in dedicated components
- the page can evolve without turning into a 1500-line route file
- dashboard and atrium can share visual primitives

---

## Phase 3 - Rotating hero implementation

### Goal

Turn the current atrium hero into the emotional center of the archive.

### Work

- replace the single featured memory with a rotating stage
- support photo, story, voice, and document states
- add slow timed rotation
- add manual previous/next controls if needed, but keep them quiet
- pause rotation on hover, focus, or reduced-motion preference
- preserve direct routes to:
  - memory page
  - drift mode
  - constellation

### Behavioral details

- hero should remain stable during a session
- image transitions should cross-fade rather than slide
- transcript and excerpt text should clamp gracefully on mobile
- memory opens should go to canonical memory pages, not person pages by default

### Exit criteria

- the first screen is visibly memory-led
- hero works across multiple memory kinds
- motion stays calm and accessible

---

## Phase 4 - Scale band, era ribbon, and constellation preview

### Goal

Give the user immediate historical and structural context after the hero.

### Work

- add the scale band
- add decade-based era ribbon
- connect era selection to hero and one or two lanes
- add read-first constellation preview

### Reuse strategy

The preview should reuse the same relationship and layout truth as the main constellation where practical, but render a smaller non-editable subset.

### Mobile behavior

- scale band stacks cleanly
- era ribbon remains tappable without horizontal chaos
- constellation preview degrades to a simpler framed view when space is tight

### Exit criteria

- users can feel archive breadth in under one screen
- era filtering works without full page reload behavior
- preview clearly hands off to the full constellation

---

## Phase 5 - Discovery lanes and contribution prompts

### Goal

Replace generic summary strips with purposeful paths into the archive.

### Work

- replace the current recent memories strip with 2 to 4 narrative lanes
- create flexible lane layouts:
  - shelf
  - staggered cards
  - featured item plus supporting stack
- add unfinished-archive prompts
- connect lane CTAs to person pages, memory pages, or relevant creation flows

### Contribution philosophy

Contribution nudges should feel like stewardship, not productivity management.

Good:

- `This branch still has no voices recorded.`
- `Three siblings have no portrait yet.`

Bad:

- `Complete 5 profile tasks now.`

### Exit criteria

- homepage feels layered and exploratory
- users can enter through multiple narrative paths
- prompts encourage contribution without social-app pressure

---

## Phase 6 - Dashboard redesign

### Goal

Make `/dashboard` feel like a calm archive foyer for multi-tree users.

### Work

- replace the current active-tree people grid focus with archive entry cards
- show one primary tree card prominently
- show secondary tree cards in a quieter grid
- carry over the same visual language as the atrium
- provide clean routing into each tree atrium

### Optional later refinement

Persist last-opened tree and use it to improve both:

- dashboard ordering
- `/` signed-in routing behavior

### Exit criteria

- multi-tree users understand where to go immediately
- dashboard feels related to the atrium, not like an old admin page

---

## Phase 7 - Editorial controls and personalization

### Goal

Add optional control only after the automated experience already works.

### Work

- pin hero candidates
- suppress weak candidates
- feature a person or branch for a period of time
- remember recent user selections such as last era or last opened tree

### Exit criteria

- curation improves quality without becoming mandatory operational overhead

---

## Phase 8 - Performance, accessibility, and rollout

### Goal

Ship a premium-feeling home page without making it fragile.

### Work

- payload optimization
- image optimization
- shimmer and empty-state refinement
- reduced-motion support
- keyboard and focus review
- mobile layout QA
- regression testing for auth and tree routing

### Rollout approach

Roll out in this order:

1. new home API plus current atrium compatibility
2. refactored atrium shell
3. hero
4. scale, era, preview
5. lanes
6. dashboard

This keeps the highest-value emotional improvements landing first while reducing coordination risk.

### Exit criteria

- performance remains acceptable on media-heavy trees
- loading and empty states feel intentional
- new homepage is stable before dashboard becomes dependent on the same primitives

---

## Recommended Build Order

1. Phase 0 - scope lock
2. Phase 1 - home payload and ranking
3. Phase 2 - atrium refactor into reusable components
4. Phase 3 - rotating hero
5. Phase 4 - scale band, era ribbon, constellation preview
6. Phase 5 - discovery lanes and archive prompts
7. Phase 6 - dashboard redesign
8. Phase 7 - editorial controls
9. Phase 8 - polish and rollout

This order matters. The tree atrium should be proven first. The dashboard should inherit that language, not define it.

---

## Likely Code Surfaces

Frontend:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/dashboard/page.tsx`
- `apps/web/src/app/trees/[treeId]/atrium/page.tsx`
- new files under `apps/web/src/components/home/`
- `apps/web/src/app/globals.css`

Backend:

- `apps/api/src/routes/trees.ts`
- `apps/api/src/lib/cross-tree-read-service.ts`
- possibly shared summary helpers near existing tree and memory read services

Shared reuse:

- `apps/web/src/components/tree/treeLayout.ts`
- `apps/web/src/components/tree/TreeCanvas.tsx`

---

## Open Product Questions

These should be answered explicitly before implementation gets deep:

1. Do we want the signed-in default for multi-tree users to remain `/dashboard`, or eventually become the last-opened tree atrium?
2. Should hero selection incorporate anniversaries and birthdays in v1, or only generic archival quality signals?
3. Should era navigation affect all lanes, or only the hero plus one contextual lane in the first release?
4. How much of the constellation should be visible before the preview becomes visually noisy on laptop screens?
5. Should unfinished-archive prompts be visible to all members, or primarily to contributors and stewards?

---

## Success Criteria

The redesign is successful if the signed-in home experience:

- feels emotionally distinct from a feed or admin dashboard
- immediately communicates that this is a family memory archive
- gives the user a sense of lineage and historical depth
- creates strong paths into memory pages, drift, and constellation exploration
- works for both tiny and large archives
- works for both single-tree and multi-tree users
- remains calm and archival rather than loud or social

---

## Summary

The strongest path is:

- treat `/trees/[treeId]/atrium` as the real home page
- redesign it first around a rotating memory stage, scale, era, and family-shape preview
- then redesign `/dashboard` as the cross-tree foyer

That sequence fits the current codebase, matches the product thesis, and gives the redesign a clear emotional center instead of spreading the concept across too many surfaces at once.
