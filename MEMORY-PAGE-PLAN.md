# Memory Page Plan

> **Reviewed:** 2026-04-21

## Direction

Memories should become first-class destinations instead of staying as small utility cards with a lightbox. A person page should feel like a calm, editorial chapter. A memory should have enough room for narrative, media, voice, context, and multiple perspectives.

## Product Model

### 1. Person page = curated chapter surface

The person page should show selected memory previews, not the full memory payload.

Each preview should emphasize:

- hero media or a strong thumbnail
- title
- short excerpt
- date and place when available
- subtle context labels such as shared lineage or contributor count

The person page should stay readable and aesthetically quiet. It should not become a feed of settings panels or full memory internals.

### 2. Memory page = canonical memory destination

Each memory should have its own route, likely:

- `/trees/[treeId]/memories/[memoryId]`

That page should support:

- full story or commentary
- gallery of multiple images and videos
- audio playback and transcript
- date and place context
- related people
- multiple family-member perspectives or reflections
- prompt/reply provenance where relevant
- permissions and moderation controls in a tucked-away settings menu for authorized users

## UX Recommendation

Use a two-layer experience:

- person page shows larger editorial previews
- clicking a preview opens a full memory page
- media lightbox remains available inside the memory page for zooming or focused media viewing

This keeps the person page beautiful while allowing memories to grow into richer historical objects.

## Preview Design Guidance

Memory previews on person pages should move away from small admin-like cards and toward chapter excerpts.

Suggested preview structure:

- large visual anchor when media exists
- strong title treatment
- 1 to 3 sentence excerpt
- optional metadata row for date, place, contributors, and context
- subtle affordance like `Open memory`

Preview sizes can vary:

- feature memory block for the strongest or newest memory
- medium cards for supporting memories
- grouped story strips or decade-based sections if needed

## Memory Page Layout

Suggested full memory page sections:

1. Hero
- title
- key image or media carousel
- date, place, people, and contribution metadata

2. Narrative
- main story text
- transcript if voice exists

3. Media
- additional photos and videos
- audio clips
- documents

4. Perspectives
- reflections or additions from other family members

5. Related context
- connected people
- related memories
- prompt/reply lineage when applicable

6. Authorized controls
- settings menu for visibility
- moderation or surface controls
- edit actions

## Technical Plan

### Phase 1

**Status: Completed**

- [x] add dedicated memory route and page shell (`/trees/[treeId]/memories/[memoryId]`)
- [x] keep current person-page previews but route clicks to the memory page
- [x] move current lightbox usage behind the memory page media gallery

### Phase 2

**Status: Partially completed**

- [x] expand memory model to support multiple media items (`memory_media` table)
- [x] support multiple contributions/perspectives on one memory (`memory_perspectives` table)
- [ ] improve preview design on person pages (still uses older card style)

### Phase 3

**Status: Not started**

- [ ] add editorial curation tools for featured memories and ordering
- [ ] add related-memory and cross-person context modules

## Immediate Build Recommendation

Build the dedicated memory page next, then convert person-page memory cards into larger chapter-style previews that link there. That gives the product a structure that can support richer family history without cluttering the person page.
