# Heirloom
## A Living Family Archive — Implementation Specification

*Working name; alternatives include **Lineage**, **Kin**, **The Keep**, **Mantle**, **Evergreen**, **Hearth**. Use whichever feels most right at build time.*

---

## How to Read This Document

This is a specification for a production application. It is opinionated. Many decisions below are stated as givens rather than options, because the aesthetic and philosophical coherence of this product *is* the product — a memorial archive built with the instincts of a social network would fail, even if every individual feature were well-built. When implementation requires a tradeoff, resolve it by returning to **Part I: Soul**.

The roadmap in **Part XII** is phased. Do not attempt to build everything at once. Phase 1 alone, done with care, is already a useful and shippable product.

---

# PART I — SOUL

## Vision

Heirloom is a quiet, private web application that helps a family build a living archive of the people in it — past, present, and future. It is not a genealogy tool, not a social network, and not a photo-sharing service. It exists to preserve *texture*: the way a grandmother laughed, the stories only one cousin remembers, the recipe card in someone's handwriting, the voice on a three-minute memo saying hello.

The app treats memory as sacred and as fragile. Every design decision serves that posture.

## The Problem

Every family has knowledge that dies with its holders. A grandfather's stories are told over Thanksgiving dinners and never recorded. A mother's recipes live only in her head. Photographs accumulate in shoeboxes, hard drives, and cloud services that nobody will log into after the owner is gone. When an elder passes, the window closes — and the people left behind realize too late that they never asked the questions.

Existing tools fail this problem in specific ways. Ancestry.com is built for *lineage* (proving who descended from whom), not *memory* (what they were like). Photo apps are chronological dumps with no narrative structure. Social networks optimize for engagement and ephemerality, the opposite of what a memorial needs. Nothing on the market has the right posture, and so the work doesn't get done.

Heirloom is the tool for the work.

## Why Now

Three convergent shifts make this buildable today. Voice memos have become ambient — every elder with a smartphone can record, and every grandchild can nudge them to. Object storage has become cheap enough that preserving decades of family media is economically trivial. AI can transcribe voice memos into searchable text, making oral history genuinely archivable rather than just recorded. A project that would have been a multi-year startup in 2015 is a focused solo effort in 2026.

## Anti-Vision

Heirloom is **not**:

- A social network. There is no feed, no likes, no followers, no discovery, no algorithm.
- A growth-hack product. There are no viral loops, no share-to-unlock, no engagement streaks.
- A free service monetized by ads. This product will never carry advertising, because advertising in a memorial is obscene.
- A genealogy tool. Dates and places are a minor feature, not the point.
- A productivity app. There are no notifications optimized to pull users back in.
- A toy. The tone is closer to a hardcover book than a consumer app.

If in doubt, the product leans toward restraint.

## Core Principles

**Permanence is a feature.** Users will pour irreplaceable material into this system. Everything about the product — from the business model to the data export format — must credibly promise that their work is safe for decades, even if the company disappears.

**The subject is sovereign.** A person's own node is theirs. While they are living and participating, they decide what is remembered about them, what is private, what is shared. Others may contribute, but the subject is the editor.

**Silence over noise.** No notifications that don't matter. No red badges. No engagement metrics. The app should feel more like a cathedral than a mall.

**Sparse is honest.** A node with three photos and one story is not a failure. Many families will have rich archives for some members and almost nothing for others. The UI treats sparsity as normal, never shames an empty field.

**Time is generous.** Contributions arrive in their own time. A voice memo recorded today might be added to a grandfather's node ten years after his death. The product is designed around *decades*, not sessions.

**Grief-shaped, not happiness-shaped.** Some nodes belong to people who died young, died badly, or died recently. Every empty state, every prompt, every copy decision must read acceptably in that context.

---

# PART II — DESIGN LANGUAGE

## Aesthetic Direction

The visual identity lives in the overlap between *letterpress book*, *archival museum*, and *still garden*. Not modern-minimalist (cold). Not folksy-scrapbook (chaotic). The reference material is closer to: Kinfolk magazine, the British Library's online collections, a well-designed monograph, Muji's flagship stores, the Aesop aesthetic without the preciousness, the way an old family bible feels in your hands.

The screen should feel held, not swiped.

## Typography

**Display:** A literary serif with character. Candidates: *GT Sectra*, *Canela*, *Tiempos Headline*, *Editorial New*, or the free *EB Garamond* for budgets. The display face is used sparsely — person names, major section headings, titles. It should feel like it was set by a typographer.

**Body:** A readable serif for long-form content (stories, transcriptions). Candidates: *Source Serif 4*, *Crimson Pro*, *Cormorant Garamond*. Generous line-height (1.6–1.75). Measure capped around 65 characters.

**UI / Interface:** A quiet, low-contrast sans-serif for controls only — never for content. Candidates: *Söhne*, *Neue Haas Grotesk*, or free *Inter* / *IBM Plex Sans* as budget options. UI type is small, unobtrusive, and does not compete with content.

**Italic discipline:** The body italic is used for quoted speech, titles of works, and gentle emphasis. Never for decoration.

**Avoid:** All-caps headings (too loud), decorative scripts (too sentimental), variable-weight gimmicks.

## Color System

A muted, literary palette. All values are suggestions; final tokens should be defined as CSS custom properties.

```
--paper:         #F6F1E7   /* warm off-white, the dominant surface */
--paper-deep:    #EDE6D6   /* slightly deeper for raised panels */
--ink:           #1C1915   /* warm black for body text */
--ink-soft:      #403A2E   /* secondary text */
--ink-faded:     #847A66   /* captions, metadata */
--rule:          #D9D0BC   /* hairlines, separators */
--moss:          #4E5D42   /* primary accent — deep muted green */
--rose:          #A85D5D   /* secondary accent — muted terracotta */
--gilt:          #B08B3E   /* rare accent for anniversaries, honors */
--shadow:        rgba(28, 25, 21, 0.08)   /* soft, warm shadow */
```

A dark mode exists, but it is warm and low-contrast — more *candlelit reading room* than OLED black. Do not ship a pure-black dark mode.

## Motion

Motion in Heirloom breathes. It does not bounce, spring, or pop.

- **Durations:** 400–700ms for major transitions, 150–250ms for micro-interactions. Nothing instant, nothing gimmicky.
- **Easing:** Custom cubic-bezier curves that feel decelerated and weighted, roughly `cubic-bezier(0.22, 0.61, 0.36, 1)`. Think of a page turning, not a slide snapping.
- **Page transitions:** Cross-fades and gentle zooms, never hard route changes. When navigating into a person's node, the previous view dissolves rather than slides away.
- **Ambient motion:** Hero imagery has a barely-perceptible Ken Burns drift (30+ second cycles). Background gradients shift over minutes. The app is alive but calm.
- **Hover states:** Subtle — a 2px underline appearing, a photograph gaining 1px of shadow. No scale transforms on hover.
- **Never:** Parallax that makes people seasick. Confetti. Spring physics. Loading spinners (use shimmer instead, or a still letterpress mark).

## The "Cloud" Navigation Model

The defining interaction metaphor. Users should feel like they are *drifting through* a family's memory, not *searching* a database.

**The Atrium (home).** Not a dashboard. Not a feed. When a user enters the app, they land in an atrium: a softly-lit, mostly-empty space that surfaces one or two things — a memory from this day last year, an unanswered question waiting for them, a photograph they haven't seen in a while. Generous whitespace. The viewer can sit in the atrium and nothing demands their attention. Most visits might end here, and that is fine.

**The Constellation (tree view).** The family tree is rendered as a constellation of named points, gently connected by hairlines that indicate relationships. It is *not* a rigid pedigree chart. The user can pan infinitely and zoom smoothly. At low zoom, the constellation shows only names and portraits, like an astronomical chart. Zooming in on a name transitions (via a gentle zoom-through) into that person's node. The transition should feel like descending into a single star and finding a world there.

**Drift mode.** A distinctive feature: a "drift" button that takes the user on a gentle, slow serendipitous tour through the archive — one memory at a time, auto-advancing every 20-30 seconds, cross-fading, with just enough context to tell you whose memory you're looking at and who recorded it. Like a film of the family, assembled on the fly. Users can pause it, branch off into the person whose memory is showing, or just let it keep going. This is the "moving through a cloud" feeling, literally.

**Person node pages.** Each node is a single long-scroll page, structured like a book chapter. Vertical scroll, generous spacing. No tabs, no accordions — all of a person's material is present and discoverable by scrolling. Photographs, stories, voice memos, maps, and relationships flow down the page in a curated order.

**Searching.** Search exists but is understated. A small rule-accented search field, accessible via keyboard (⌘K / Ctrl+K) or a discreet icon. It searches across transcribed voice memos, story text, photo captions, and names. Results appear inline as a quiet list, not a screen-filling overlay.

## Imagery & Iconography

**Photographs:** Mounted, not bled. Every photograph has a generous matte around it by default, echoing a physical album. Aspect ratios are preserved; images are never cropped to fill containers. Subtle inner shadow gives a sense of depth.

**Icons:** Custom-drawn, thin-line, 1.5px stroke weight. Hand-tuned rather than generic icon-set. No Material Design, no Font Awesome. Lucide is acceptable as a starting point if heavily customized.

**Decorative elements:** Sparse letterpress-style marks — small printer's ornaments, hairline rules with center dots, Roman numeral section markers. Used once every few sections, never decoratively for its own sake.

## Tone of Voice

UX copy is written, not generated. Every string matters.

- **Instead of** "Add a new post" → "Add a memory"
- **Instead of** "Delete" → "Remove" (or "Archive" where soft-delete applies)
- **Instead of** "Successfully saved!" → "Saved."
- **Instead of** "Oops! Something went wrong." → "Something didn't save. We'll try again."
- **Instead of** "Share" → "Invite someone to contribute"
- **Instead of** "User profile" → the person's name, always.

The app never says "engagement," "feed," "post," "follow," "like," "user," or "content" anywhere a human will see it.

---

# PART III — ACCOUNTS & USER ROLES

## Account Model

Accounts are personal and portable. One person has one Heirloom account, regardless of how many trees they participate in. An account is *not* the same thing as a person-node — a person can have a node in a tree before they ever sign up, and a subject who joins later is *linked* to their node rather than replacing it.

**Authentication:** Magic-link email as primary, with passkey support as the modern upgrade. Passwords are a fallback for users who insist. Phone-number authentication is offered *specifically* for elderly users who are more comfortable with SMS.

**The low-friction elder path:** A major account type is the "lightweight participant." An elder can engage meaningfully without creating a full account — they respond to SMS or email prompts, and the system ingests their contributions under their node. A full account is offered but never required.

## Role Types

**Within a tree:**

- **Founder** — the person who created the tree. One per tree. Can transfer founderhood.
- **Steward** — trusted administrators, typically the founder's spouse or siblings. Can invite, manage permissions, edit any node. Multiple per tree.
- **Contributor** — can add memories to nodes they have access to, can be granted edit rights on specific nodes. Most family members are contributors.
- **Viewer** — can see content but not contribute. Used for distant relatives or family friends.
- **Subject** — a special role, not mutually exclusive with others: this is the person whose node it is. They have override rights on their own node while living.

**System-level:**

- Account holders are not categorized globally. Roles exist only within the context of a specific tree.

## Multiple Trees

A single account can participate in multiple trees simultaneously (one's paternal family, maternal family, spouse's family, chosen family). The app supports this gracefully. The home atrium surfaces content from across all a user's trees, and a tree-picker is always available.

**Trees can be merged** (carefully, with explicit confirmation from stewards of both) when two families unite — for example, when a couple wants to combine their parental trees into a shared family tree for their children.

---

# PART IV — DATA MODEL

Presented here at a level sufficient to guide schema design. Final schema should be SQL (Postgres) with careful indexing.

## Entities

### `Tree`
- `id`, `name`, `founder_account_id`
- `created_at`, `settings` (theme preferences, default permissions)
- `storage_config` — hosted vs. BYO-storage settings

### `Account`
- `id`, `email`, `phone`, `display_name`
- `auth_method`, `created_at`
- `preferences` (notification cadence, language, accessibility)

### `TreeMembership`
- `tree_id`, `account_id`, `role` (founder/steward/contributor/viewer)
- `joined_at`, `invited_by`

### `Person`
- `id`, `tree_id`
- `display_name`, `also_known_as` (array — maiden names, nicknames, former names)
- `birth_date` (partial — year alone is acceptable), `death_date`
- `birth_place`, `death_place`
- `gender_identity` (freeform, optional), `pronouns`
- `is_living` (computed from death_date)
- `portrait_media_id`
- `short_description` — one line ("Loved the garden")
- `linked_account_id` — nullable; populated if the subject has claimed the node
- `visibility_default` (within tree)

### `Relationship`
- `id`, `tree_id`
- `person_a_id`, `person_b_id`
- `type` (see Part V for the full taxonomy)
- `start_date`, `end_date` (for marriages, partnerships that end)
- `notes` (private to stewards — e.g., "estranged since 1987")
- `legally_recognized`, `biologically_related` — independent booleans
- `verified_by_subject` — did the person(s) confirm this relationship?

### `Memory`
- `id`, `tree_id`, `primary_person_id`
- `contributor_account_id`
- `media_id` (nullable — a memory can be text-only)
- `kind` (photo / voice / video / story / recipe / object / place)
- `title`, `body` (rich text for stories)
- `date_of_event` (partial — "summer of 1973" is valid)
- `date_contributed`
- `co_subjects` (other persons tagged in this memory)
- `location` (optional lat/lng or place name)
- `transcript` (for voice/video, auto-generated then editable)
- `visibility` — overrides node default if set
- `unlock_date` — nullable; for time-locked memories

### `Media`
- `id`, `tree_id`
- `storage_backend` (hosted / byo-google-drive / byo-s3 / etc.)
- `storage_path` or `external_reference`
- `mime_type`, `size_bytes`, `duration_seconds` (for audio/video)
- `checksum`
- `derived_variants` (thumbnails, transcoded formats)

### `Prompt` (the question-of-the-week system)
- `id`, `tree_id`
- `target_person_id` — who is being asked
- `question_text`
- `queued_by_account_id` — who suggested this prompt
- `channel` (sms / email / in-app)
- `scheduled_for`, `sent_at`, `responded_at`
- `response_memory_id` — links to the resulting memory, if any
- `status` (queued / sent / answered / skipped / retired)

### `PromptLibrary`
- System-provided library of ~200 evocative, tiered prompts
- Curated, not AI-generated at runtime
- Tiered: *warm-up*, *middle*, *deep*, *legacy*

### `Invitation`
- `id`, `tree_id`, `invited_by_account_id`
- `email` or `phone`, `proposed_role`
- `linked_person_id` (nullable — if inviting the subject of a specific node)
- `token`, `expires_at`, `accepted_at`

### `Permission` (fine-grained, override layer)
- `id`, `resource_type` (person/memory), `resource_id`
- `subject_type` (account/role/everyone), `subject_id`
- `access_level` (none/view/contribute/edit/admin)
- `granted_by_account_id`, `granted_at`

---

# PART V — THE FULL RELATIONSHIP TAXONOMY

Family is complicated. The relationship model must handle all of this without collapsing into either oversimplification ("parent/child/spouse") or bureaucratic over-categorization. The guiding rule: **biology, law, and social reality are three independent axes, and any relationship can exist on any combination of them.**

## The Three Axes

Every relationship carries (up to) three independent flags:

- **Biological** — shared genetic material
- **Legal** — recognized by law (adoption, marriage, guardianship)
- **Social** — recognized by the family as real

A step-parent who raised a child is `legal: false, biological: false, social: true`. An adoptive parent is `biological: false, legal: true, social: true`. A sperm donor known to the family is `biological: true, legal: false, social: ?` — the family decides.

## Parent / Child

- Biological parent
- Adoptive parent (legally adopted)
- Step-parent (by marriage to a biological/adoptive parent)
- Foster parent
- Guardian (legal but not adoptive)
- "Raised by" — the social parent regardless of legal status
- Donor / gestational (optional, privacy-sensitive, usually hidden by default)

The UI should let a person have multiple parents of each type. A child with two mothers, a biological father, a step-father who raised them, and grandparents who were primary caregivers can all be represented without forcing anyone into a "real vs. not-real" hierarchy.

## Sibling

- Full biological sibling
- Half-sibling (shared parent specified)
- Step-sibling (by parents' marriage)
- Adoptive sibling (siblings through adoption, no biological relation)
- Foster sibling
- Chosen sibling (explicit, for deep non-blood bonds)

## Partnership

- Spouse (current) — with date of marriage
- Spouse (former) — divorced, with dates
- Spouse (deceased) — with dates
- Partner (unmarried, current)
- Partner (former)
- Engaged (current)
- Co-parent (explicit, regardless of romantic status)

A single person can have multiple past partnerships. The tree should render current partnerships prominently and past ones with appropriate distance.

## Extended

- Aunt/uncle (by blood, by marriage, by choice)
- Cousin (with degree if specified — first, second, once-removed, etc.)
- Niece/nephew (with corresponding variants)
- Grandparent / grandchild (biological, step-, adoptive)
- Great-grandparent, great-grandchild, etc. — computed, not manually entered
- In-laws (computed from partnerships)

## Chosen Family

A first-class category, not an afterthought. A godparent, an honorary aunt, a family friend who functioned as a sibling — these are modeled as full relationships with explicit "chosen" type. The tree renders them as real because they are.

## Edge Cases The Model Must Handle

- **Name changes.** Maiden names, remarriage names, chosen names (for trans people or any reason). Every person has a `display_name` and an `also_known_as` array. When a person changes their name, their prior names are preserved as history, not erased, but the current name is used throughout. The subject has sovereignty over this.
- **Pronoun changes.** Stored on the person, editable by the subject, respected by all UI copy.
- **Gender-neutral relationship labels.** "Parent" is always available; "mother" and "father" are specifications. "Sibling" is always available. The UI offers neutral terms as first-class, not as an accessibility afterthought.
- **Multiple parentage beyond two.** A child has three legal parents? Two biological mothers and a donor? The data model accommodates; the UI reflects it simply.
- **Estrangement.** A relationship can be marked `estranged` (private, steward-only) which affects prompt routing (don't suggest the estranged party for memories of this person) but does not erase the relationship from the tree. Some families need the record to exist even where the contact doesn't.
- **Disputed relationships.** Two family members have different accounts of a relationship — "he was my father" vs. a family that denies it. The relationship can be marked as `disputed`, visible only to the person who asserts it and the stewards. This is rare but must be handled gracefully.
- **Adoptees who know their birth family.** Both sets of parents are modeled. The subject decides which are primary in the display.
- **Posthumous discoveries.** A relative discovered through DNA testing after death. The relationship can be added with appropriate markers of how and when it was learned.
- **Secrecy.** Some relationships carry family secrets (affairs, hidden children, unacknowledged parentage). The model supports private relationships visible only to specified accounts, and it does not judge.

## Relationship Display

The tree visualization is not a pedigree chart. Biological parent-child lines are thin and dark; marriage lines are doubled hairlines; chosen-family lines are dashed. Step and adoptive relationships carry small textural distinctions but are rendered with equal visual weight — *nothing in the graphic design communicates that one kind of family is more real than another*.

---

# PART VI — PERMISSIONS ARCHITECTURE

The defining constraint: **every piece of content in this system is potentially sensitive, and the permissions system is the product's most important trust mechanism.**

## The Four Layers

Permissions are resolved top-down. More restrictive always wins.

### Layer 1: Tree-Level Membership
Who is in the tree at all. Set by founder/stewards via invitation.

### Layer 2: Node-Level Default
For each person node, what is the default visibility of that node's contents to tree members? Set by node stewards. Options:
- **All members** — every tree member can see everything by default.
- **Family circle** — only members with an explicit family relationship (not just any tree viewer).
- **Named circle** — an explicitly curated list (e.g., "immediate family only").

### Layer 3: Content-Level Override
Any individual memory can override the node default:
- **More open** (rare) — "this photo is for everyone in the tree, even if most of this node is private"
- **More restricted** — "this voice memo is only for my children"
- **Time-locked** — "unlock on my 90th birthday" or "unlock after my death"

### Layer 4: Subject Sovereignty
While a subject is living and has a linked account, they have override rights on their own node. They can:
- Make any memory of themselves private.
- Request that another contributor's memory be hidden.
- Request deletion (the system offers a 30-day soft delete with recovery).
- Transfer stewardship of their node.

If a contributor and subject disagree about a memory, **the subject wins**, full stop. The contributor is notified and the memory is archived, not destroyed — a steward can recover it if the subject later changes their mind.

## Role Capabilities at a Glance

| Capability | Founder | Steward | Contributor | Viewer | Subject |
|------------|---------|---------|-------------|--------|---------|
| Invite members | ✓ | ✓ | ✗ | ✗ | ✗ |
| Edit any node | ✓ | ✓ | ✗ | ✗ | n/a |
| Edit own linked node | n/a | n/a | n/a | n/a | ✓ |
| Add memories | ✓ | ✓ | ✓ | ✗ | ✓ |
| Remove own contributions | ✓ | ✓ | ✓ | n/a | ✓ |
| Remove others' contributions | ✓ | ✓ | ✗ | ✗ | (on own node only) |
| Transfer founderhood | ✓ | ✗ | ✗ | ✗ | n/a |
| Change tree-level permissions | ✓ | ✓ | ✗ | ✗ | n/a |

## Succession (What Happens When Someone Dies)

The hardest permissions case. When a subject dies:

1. The system does **not** automatically detect death — a steward marks the node. The subject's linked account becomes inactive (no login, but contributions preserved).
2. Pre-designated **literary executors** (set by the subject while living) inherit the subject's override rights. If none are set, stewardship reverts to tree stewards.
3. Any **posthumous unlocks** set by the subject trigger. ("Open my letter to my daughter when I die.")
4. Memories the subject had kept private default to remaining private. They are not automatically released to the family, because the subject chose privacy. A literary executor can selectively release.
5. The subject's own contributions elsewhere (memories they added to *other* people's nodes) remain.

## Account Deletion

Living users can delete their account at any time. Their contributions default to remaining in the trees they participated in (attributed anonymously or under their name per their preference), because those contributions belong to the families, not just the contributor. They can optionally purge their contributions at deletion time, with a clear warning about the consequences.

---

# PART VII — FEATURES

## The Atrium (Home)

Quiet landing space. Shows:

- **One thing from today in history** — a memory from this day in a past year, if one exists. If nothing, a blank space with a gentle prompt.
- **Quiet nudges** — "Your grandfather has a new voice memo waiting to be heard." "Aunt Rose added a story to your mother's node." No badges, no counts, just prose.
- **The drift button** — a single quiet affordance to start a drift session.
- **Tree picker** (if the user participates in multiple trees).

Designed so a user can visit for thirty seconds and leave, or sit for an hour.

## Person Node Page

A single scroll. From top to bottom, roughly:

1. **Portrait** — a large, matted photograph of the person.
2. **Name** — in display serif, large but not shouting.
3. **Essence line** — a single line of text ("Loved the garden, terrible at cards"). Written by the subject or a steward.
4. **Life span** — dates in small caps, discreet: "1924 – 2017" or simply "b. 1988" for the living.
5. **Voices** — voice memos, rendered as simple waveform rows with play buttons and durations. Each has a title and a contributor credit.
6. **Stories** — longer-form written memories. Each with title, contributor, date-of-event. Rendered as typeset prose.
7. **Photographs** — a gallery, matted, roughly chronological by default but re-orderable.
8. **Hands** — scanned handwriting, recipe cards, letters. A tender category.
9. **Places** — a small embedded map with pinned locations significant to this person.
10. **Things** — photographed objects with captions ("Her mother's ring. Passed to me on my 18th birthday.")
11. **Relationships** — a quiet block listing the people this person is connected to, with small portraits. Clicking one drifts the user to that node.
12. **Timeline** (optional, collapsed by default) — for genealogical completeness without dominating the page.

Each section only renders if it has content. A sparse node is beautiful, not incomplete.

## The Constellation (Tree View)

A pannable, zoomable canvas. Nodes are rendered as small portraits with names beneath. Relationships are rendered as hairlines — style varies by relationship type (see Part V). At low zoom, the whole family is visible as a constellation. At high zoom, individual portraits and a small snippet of each person's essence line are visible. Zooming on a name transitions into that person's node.

Implemented with an SVG or Canvas renderer. Physics-based layout (force-directed) with manual-override pinning available to stewards — sometimes a family's structure needs human curation to feel right.

## The Drift

A quiet full-screen mode. The app surfaces one memory at a time, auto-advancing every 20–30 seconds with slow cross-fades. Voice memos play aloud; photographs display with Ken Burns drift; stories render as a page of prose, auto-scrolled to match reading time. Small text at the bottom corner notes whose memory this is and who recorded it. The viewer can pause, advance manually, branch into the person's full node, or close.

Drift sessions are gently curated: they favor memories the viewer has seen less, and they respect permissions. An anniversary can seed a themed drift ("Memories of your mother, on what would have been her birthday").

## The Prompt System (Question of the Week)

The feature that sets Heirloom apart from passive archives. Designed around the reality that elders will not remember to open an app, but they *will* answer a question texted to them by their grandchild.

**The flow:**

1. A family member (usually a contributor) queues a question for a specific elder. They can pick from the prompt library ("What was your mother's kitchen like?") or write their own.
2. Multiple questions can be queued; the system sends one per week by default (configurable: daily, weekly, biweekly, monthly).
3. The question is delivered via the elder's preferred channel — SMS is the most common and the one the design is optimized for.
4. The SMS is a single short message: the question, then a short link. No branding, no clutter.
5. The link opens a page with three enormous elements: the question in large type, a voice record button, and a text field. No navigation, no login if the elder is on their claimed device.
6. The elder records a voice reply (most common), writes a text reply, or attaches a photo. They tap done.
7. The reply is automatically filed as a memory on their node, transcribed (for voice), and shown to the family as a new contribution.
8. The elder receives a short acknowledgment ("Saved. Thank you.") and, optionally, a gentle indicator that their grandchild will see it.

**The prompt library** is ~200 hand-curated questions, tiered:

- *Warm-up*: "What was your favorite breakfast as a child?" / "Where did you grow up?"
- *Middle*: "Tell me about your first job." / "What was your mother like when she was tired?"
- *Deep*: "What is something you wish you had said to your father?" / "What is a regret you have made peace with?"
- *Legacy*: "What do you want your great-grandchildren to know about you?" / "If your life had a chapter title, what would this one be called?"

Family members can queue specific questions or let the system auto-queue based on tier and what has been answered before. The library is curated, never AI-generated in real time — the questions are the product's most important copy.

## Invitations & Onboarding

Founders create a tree in under two minutes. The onboarding flow asks:

1. What should this tree be called? (Usually a family name: "The Chen Family")
2. Who are you in it? (Creates the founder's own person-node)
3. Who is one other person you'd like to add first?

That's it. The rest is added over time.

Invitations are sent by email or SMS. The invitee clicks the link, sees the tree as it exists, and is guided through claiming their own node (if they have one) or being added as a contributor. The tone is inviting, not bureaucratic — "Your cousin Maya invited you to help remember the Chen family" rather than "You have been granted Contributor access to shared resource."

**The elder invitation** is a specifically designed flow. An elder does not need to create an account to participate — a contributor can set up the elder's node, enter the elder's phone number, and begin queueing questions immediately. The elder's first contact with Heirloom is a text message: *"Hi Gramma, it's Maya. I'm making a family memory book with your stories. I'll send you a question each week — just tap and answer. Here's the first one: ..."*

## Anniversaries & Surfacing

The app quietly notices dates. On a birthday — especially of someone who has died — the atrium will surface that person, offer a drift session of their memories, and optionally notify stewards with a quiet message: *"Your grandmother would have been 90 today. A few of her voice memos are ready for you when you are."*

Other surfaces:
- "This day last year" (and five years, ten years...)
- First anniversaries of losses (handled with particular care, with the ability to opt out)
- Holidays specific to the family (configurable)

Never push notifications for these — they appear in the atrium when visited. Optional weekly email digests summarize what's been added.

## Search & Discovery

Search across: person names, story text, voice memo transcripts, photo captions, place names, dates. A unified search with filters. Results rendered quietly, inline.

Discovery within the tree: "recently added," "least-seen memories," "memories about [person]," "everything from [year range]." All accessible from a quiet menu, never pushed.

## Export & the Static Archive

A core feature, not an afterthought. At any time, a steward can click "Create archive" and receive a `.zip` containing:

- Every photo, voice memo, video, and document, in their original formats.
- Every story, transcript, caption, and metadata as plain text (Markdown) and structured JSON.
- A self-contained HTML viewer that renders the whole tree — person pages, relationships, media — as a static site that works offline, forever, on any computer with a browser. No server required.

The export format is documented, open, and stable. Families who outgrow Heirloom or outlive the service still have their archive, in a form they can open in 2050.

**Physical book generation** (optional, probably paid): the steward selects a person (or the whole tree) and the system generates a print-ready PDF — typeset like a proper book, with photographs, stories, and a relationship appendix. The PDF can be printed locally or sent to a print-on-demand partner.

---

# PART VIII — KEY USER FLOWS (NARRATIVE)

## Flow 1: Starting a Tree

Sarah, 34, has been meaning to do something about her grandmother's stories for years. She hears about Heirloom. She signs up with email, creates "The Alvarez Family," adds herself, adds her grandmother Rosa (96, lives alone, uses a flip phone for texts), and her mother Elena (who gave her the idea). She enters Rosa's phone number, then picks a question from the library: *"What did your kitchen smell like when you were a child?"* She queues it for Wednesday morning.

Wednesday at 9am, Rosa gets a text from an unknown number: *"Hi Abuela, it's Sarah. I'm making a family memory book. Each week I'll send you a question — just tap the link and talk for a minute. This week: What did your kitchen smell like when you were a child?"* Rosa taps. A page opens with the question in large type and a big red record button. She taps it, talks for three minutes about her mother's mole negro, her father coming home smelling of the bakery. She taps done.

Thursday morning, Sarah opens Heirloom. The atrium has one quiet line of text: *"Abuela Rosa answered. Three minutes."* She taps. The voice memo plays while the transcript renders beneath. She cries a little. She adds two more questions to the queue.

This is the product working.

## Flow 2: Being Invited

Marcus, 52, gets an email from his niece. *"I'm putting together something for our family — photos, stories, voice memos. I've added you and I'd love for you to add whatever you remember about Grandpa James. No rush."* He clicks the link. A quietly-designed page shows his grandfather's node as it exists — three photos his niece uploaded, one story. He scrolls, reads, and clicks "Add a memory." He writes three paragraphs about a fishing trip in 1984. He uploads a photograph he's had scanned on his hard drive for a decade and never known what to do with.

## Flow 3: Drifting

It's Sunday evening. Elena, Sarah's mother, opens Heirloom on her iPad. The atrium shows one photograph she's never seen — her sister at seventeen, standing on a beach, hair blowing. Elena taps "Drift." The app dissolves into full-screen. Her sister's photograph holds for twenty seconds, slowly zooming. It dissolves into a voice memo of their mother, laughing at something off-mic. It dissolves into a paragraph her daughter wrote about Elena herself. Elena lets it run for forty-five minutes, making dinner with one eye on the screen.

## Flow 4: A Subject Claiming Their Node

Rosa's great-nephew, visiting from out of town, shows Rosa her node on his phone. "Abuela, this is you. Everyone writes these things about you and you can see them." Rosa looks. "That's not how the mole was. And that photo — that's not 1952, that's 1954. Can I fix it?" The great-nephew taps "Claim this node as yourself," enters Rosa's phone number for confirmation, and hands her the phone. Rosa is now the subject of her own node. She corrects the date, edits the mole description, adds two lines of her own.

---

# PART IX — STORAGE & INFRASTRUCTURE

## Recommended Architecture

**Hosted mode (default, for MVP):**

- **Object storage:** Cloudflare R2 for media (zero egress fees, S3-compatible API, ~$0.015/GB/month). Backups to Backblaze B2 ($0.006/GB/month) in a separate account for redundancy.
- **Database:** Postgres (Neon, Supabase, or self-hosted on a VPS). All textual content, metadata, relationships, permissions.
- **App server:** A modest VPS or serverless deployment (Fly.io, Railway, or Vercel for a Next.js app). Not compute-intensive.
- **Transcoding:** A small background worker (ffmpeg) that converts voice memos to compressed `.mp3` and video to web-compatible `.mp4`/`.webm`. Triggered on upload.
- **Transcription:** Whisper (OpenAI API, or self-hosted whisper.cpp for cost control). Runs on every voice memo; transcripts are stored as editable text.
- **Email/SMS:** Postmark for email, Twilio for SMS. Both have generous free tiers for early volume.

Expected cost for the first 100 active families: $40–80/month. For 1,000 families: $200–400/month.

## BYO-Storage Mode (Phase 2+)

An advanced option: the user connects their own Google Drive, Dropbox, or S3-compatible bucket. Heirloom stores only metadata; media lives in the user's cloud. Benefits:

- Near-zero media cost for Heirloom.
- Data permanence — users keep their media if Heirloom disappears.
- Philosophically aligned: "your memories, in your cloud, we're just the interface."

Costs: more engineering complexity (OAuth for each provider, handling rate limits, handling deleted-out-from-under-us files). Offered as a premium option or to privacy-conscious families, not as the default.

## The Static Export (Non-Negotiable)

Ship this in Phase 1, even if the app is otherwise minimal. Every family must be able to download a complete archive that works offline and outlives the service. The export is both a feature and a promise — it's the honest answer to "what if you disappear?" and it dramatically lowers the risk of adoption.

## Monetization (Aligned With Soul)

A small annual fee per tree. Recommended: **$30–60/year per family tree**, with a single-payer (the founder or a steward) covering all participants. A free tier may exist for trees under a small size cap (say, 500 MB and 10 members) to let families try the product and let small families use it indefinitely.

**Never ads.** Not in the app, not in emails. The product's trust depends on this.

Optional premium adds (phase 3+): physical book printing (margin on print-on-demand), BYO-storage (lower ongoing cost for the family, slight premium for setup), multi-tree discounts.

---

# PART X — TECH STACK RECOMMENDATIONS

Opinionated recommendations. Substitutions are fine with reason.

- **Framework:** Next.js (App Router) with React Server Components, or SvelteKit if you prefer. Both render well, both support the quiet, content-first nature of the product.
- **Styling:** Tailwind with a carefully customized theme file enforcing the design tokens from Part II. Do not use a generic component library (no shadcn-out-of-the-box, no MUI, no Chakra) — build your own restrained primitives. The app's identity depends on not looking like every other React app.
- **Database:** Postgres. Use Prisma or Drizzle for schema/migrations.
- **Auth:** Clerk, Auth.js, or a custom magic-link implementation. Prioritize passwordless flows.
- **Media:** Cloudflare R2 with signed URLs for private media. Client-side resizing before upload to control bandwidth.
- **Background jobs:** A simple queue (BullMQ, or Cloudflare Queues) for transcoding and transcription.
- **Transcription:** Whisper API (hosted) initially; migrate to self-hosted whisper.cpp if volume justifies.
- **Tree visualization:** Custom SVG or Canvas renderer. Do not use an off-the-shelf family-tree component; they will all look wrong. `d3-force` for layout if you want physics.
- **Animations:** Framer Motion (React) or View Transitions API for page transitions. CSS-driven animation for ambient motion.
- **Typography:** Self-host fonts. Subset aggressively. The display face is used for headings only; don't load weights you won't use.
- **Analytics:** Minimal, privacy-respecting (Plausible or nothing). No Google Analytics. No Meta Pixel. Ever.

---

# PART XI — SENSITIVE CONSIDERATIONS

Some parts of this product will be used in grief, in conflict, and in the aftermath of trauma. The product must handle these cases with care.

## Death

- A steward marks a node as "passed" with a date. The node's copy gently shifts ("Rosa Alvarez, 1928 – 2024") but does not get wrapped in funeral iconography. The person is still the person.
- Any time-locked memories the deceased had set trigger on the death date.
- The system offers condolences once, quietly, in an email — not in the app interface.
- Stewards can optionally run a one-time "memorial drift" as a shared experience with family.

## Recent Loss

When a death is very recent (< 30 days), the app dampens its surfacing behavior. No "remember this day last year" prompts. No anniversary reminders. The atrium is quieter than usual. This is configurable by stewards.

## Estrangement

A relationship marked as estranged:
- Is preserved in the tree structure.
- Does not trigger mutual prompts ("would you like to ask your brother about this?" is never shown across an estranged line).
- Is visible to stewards but not necessarily to general viewers.
- Can be ended (by the subject) if reconciliation occurs.

## Abuse Histories

The product does not pretend families are uniformly loving. A survivor contributing to a family tree may not want to include an abuser, or may want to include them without sentimentality. The tree supports:
- Adding a person as a relationship without inviting them to participate.
- Private annotations visible only to the contributor.
- The ability to exclude specific individuals from ever seeing certain content.

The product never adds editorial language like "celebrate their life" — it leaves space for complexity.

## Children

Children under 13 are not given accounts (COPPA-compliant). They can be nodes in a tree. When they come of age, they can claim their node and inherit full subject rights.

Stewards are explicitly reminded: material about living children is visible to everyone the steward has granted access to. Default permissions for children's material should be stricter than the tree default.

## Name Changes & Trans Family Members

A subject changes their name (for any reason — marriage, divorce, gender, preference). The app:
- Immediately uses the new name throughout the UI.
- Preserves prior names in the `also_known_as` array, visible only to stewards by default.
- Never forces deadnames to appear anywhere.
- The subject can configure whether prior names are visible to other viewers.

## Disputed Accounts

Two family members remember an event differently. Both accounts belong. The product does not force reconciliation — both stories live on the relevant node, attributed to their contributors, dated, without editorial mediation.

---

# PART XII — PHASED ROADMAP

## Phase 1 — The Keepsake (MVP, ~3 months solo)

The smallest version of Heirloom that is useful.

- Founder creates a tree.
- Founder adds person-nodes with name, dates, portrait, essence line.
- Founder or contributors upload photographs and write stories onto any node.
- Basic relationship model: parent/child, sibling, spouse. No chosen family yet.
- Person node page (long-scroll design).
- Simple tree view (not yet the polished constellation — a functional family-tree graph).
- Invitations by email; contributors can join.
- Export to `.zip` archive with static HTML viewer. **Ship this in Phase 1.**
- One account tier, no payment yet (beta free).

**Success criterion:** one real family uses it for three months and tells someone else about it unprompted.

## Phase 2 — The Voice (~2 months)

The feature that sets Heirloom apart from a glorified photo album.

- Voice memo upload.
- Automatic transcription via Whisper.
- The Prompt system: question library, SMS delivery, lightweight elder reply page.
- Multiple contributors per node, with proper permissions.
- The full relationship taxonomy (Part V).
- Claim-your-own-node flow for subjects.
- Subject sovereignty rights enforced.

## Phase 3 — The Atmosphere (~2 months)

The aesthetic and experiential layer that makes the product feel complete.

- The Constellation tree view (polished SVG renderer).
- The Drift mode.
- The Atrium home, with anniversary surfacing.
- Custom-drawn iconography and type system fully realized.
- Dark mode.
- Mobile app (PWA or native shell).
- Pricing launched: $36/year per tree, 30-day free trial.

## Phase 4 — The Weight (~2 months)

Features that help families invest more deeply.

- Physical book generation (PDF export, print-on-demand partnership).
- Time-locked memories ("open on my 90th birthday").
- Literary executor designation and succession flow.
- Video upload and playback.
- Handwriting OCR for scanned letters and recipe cards.
- Multi-tree membership and merging.

## Phase 5 — The Long Quiet

Only after Phase 4 is stable. Improvements and careful expansion.

- BYO-storage option.
- Self-hosted deployment for technical families who prefer it.
- Language localization (start with Spanish, then expand).
- Accessibility audit and improvements (screen reader, high-contrast, large-type modes — these should be pretty good from Phase 1 but need formal pass).
- Refined mobile-app experience.
- Deeper AI-assisted features (suggesting prompt questions based on existing content, auto-detecting likely duplicate photos) — carefully, never intrusively.

---

# PART XIII — ANTI-FEATURES

Things Heirloom will not do, documented so future contributors do not accidentally build them.

- **No social feed.** There is no "what's new across all trees." There is no public discovery of other families.
- **No likes, reactions, or emoji responses.** The response to a memory is to sit with it, or to add one of your own.
- **No streaks, badges, or gamification.** This is not a fitness tracker.
- **No AI-generated content in user-facing surfaces.** Transcripts are AI; everything else — prompts, copy, descriptions — is hand-written. The app will not "generate" a memory about someone.
- **No ads. Ever.**
- **No data sale. Ever.** Aggregate anonymous metrics for product improvement only.
- **No "suggested relatives" via DNA or external databases.** This is not that product.
- **No public profiles, SEO-indexed pages, or any form of public discovery.**
- **No push notifications pulling users back to the app.** Weekly email digests, opt-in only. SMS only for prompt deliveries to elders.
- **No video reactions or stories-like ephemeral content.**
- **No "year in review" auto-generated slideshows posted to social media.**
- **No public API in Phase 1–4.** The data is private; we don't expose it to third-party apps until there's a strong trust model around it.

If a feature feels like it belongs in a consumer social app, it does not belong here.

---

# APPENDIX A — PROMPT LIBRARY SAMPLES

A taste of the curation bar. The full library is ~200 questions, organized by tier and theme.

**Warm-up (kitchen, everyday, easy to answer):**
- What did breakfast smell like in the house you grew up in?
- What's a song you remember your mother singing?
- Tell me about your first pet.
- What did your street look like at dusk?

**Middle (relationships, work, small truths):**
- What was your mother like when she was tired?
- What did your father do with his hands when he wasn't working?
- Who was your first real friend, and how did you meet?
- What is something small your grandmother taught you that you still do?

**Deep (regret, love, the long arc):**
- What is something you wish you had said to your father?
- Describe the moment you knew you loved the person you loved.
- What is a decision you're glad you made, even though it was hard?
- What did you learn the year you turned thirty?

**Legacy (toward the end):**
- What do you want your great-grandchildren to know about you?
- If your life had a chapter title, what would this one be called?
- What did you love most about being alive?
- What do you hope is remembered? What do you hope is forgotten?

---

# APPENDIX B — COPY DIRECTORY

Key strings, drafted. Implement these as a centralized copy file.

**Empty states:**
- Empty atrium: *"Nothing urgent today. A quiet place to sit, when you have a moment."*
- Empty node: *"Rosa's page is waiting. Add a photograph, a story, a memory."*
- No memories yet: *"Nothing here yet. That's alright."*

**Prompts / CTAs:**
- "Add a memory"
- "Invite someone to contribute"
- "Start a new question"
- "Drift through the family"
- "Create an archive"

**Confirmations:**
- "Saved."
- "Invitation sent to Maya."
- "Archive ready. This file is yours to keep."

**Sensitive moments:**
- Death date entered: *"We're sorry. The tree now remembers Rosa Alvarez, 1928 – 2024."*
- First anniversary approaching: *"Next week will be a year. Would you like us to be quieter for a while?"*

---

# CLOSING

Heirloom is, at its core, a well-designed container for a kind of love that most technology doesn't accommodate. It will not be used by millions of people. It will be used by thousands of families, and it will matter to them more than almost any software they own. Build it like it matters, because it does.

When in doubt, return to the soul. Serve the families. Distrust anything that feels like growth hacking. Remember that the best version of this product is the one a grandchild, in thirty years, will open and hear their great-grandmother's voice — a voice that would otherwise be lost — and think: *someone cared enough to build the thing that kept her here.*
