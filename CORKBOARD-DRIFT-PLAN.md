# Corkboard Drift Mode — Implementation Plan

> Drafted: 2026-04-26  
> Status: Planning

## 1. Overview

A new drift mode where memories are pinned to an infinite warm corkboard canvas in varied positions and orientations, connected by curved threads. Users travel between memories by following string/thread connections — moving smoothly through time with an immersive, creative animation that creates the sensation of moving through a family archive as a physical, spatial thing.

Unlike the current linear slideshow drift, corkboard drift is **spatial and explorable**. The camera glides between pins along threads, creating a journey through time rather than a sequence of fades.

### Core Metaphor

Imagine a detective's evidence board or a family's memory wall: photographs, notes, voice memos, and documents pinned at various angles, connected by red string or twine tracing relationships and timelines. The camera follows those strings from one pin to the next, smoothly panning and zooming across the board, creating an immersive sense of traveling through time and memory.

### Design Decisions (Confirmed)

- **Board style**: Warm cork texture — textured warm brown, using `--paper` and `--paper-deep` palette
- **Auto-play path**: Smart weave — camera alternates between temporal and person threads, interleaving different people's memories of the same era
- **Detail view**: Expand on board — the pin card smoothly expands in-place, other pins recede, the board stays visible behind

---

## 2. User Experience Flow

### Entry

1. User opens drift mode via the existing "Drift" button on the constellation/tree page
2. `DriftChooserSheet` presents a 5th option: **"Corkboard"** — *Memories pinned to a board, connected by threads of time.*
3. Optionally filtered by person or era (same filter options as other drift modes)
4. On selection, the current view dissolves into the corkboard

### Board Appearance

- The board fills the viewport with a warm cork/parchment texture
- Memories are scattered across the board as small cards ("pins") at varied angles and sizes
- Each pin is styled per its content type:
  - **Photos**: Polaroid-style card with thumbnail, white border, slight shadow
  - **Stories**: Cream note-card with title snippet and first line
  - **Voice**: Small card with waveform icon, duration, person name
  - **Documents**: Letter/envelope styled card with title
- Pins are connected by thin curved lines ("threads"):
  - **Temporal threads** (default visible): Connect memories chronologically — `var(--ink-faded)` (#847A66)
  - **Person threads** (toggleable): Connect memories of the same person — `var(--moss)` (#4E5D42)
  - **Branch threads** (toggleable): Connect memories in the same family branch — `var(--rose)` (#A85D5D)

### Auto-Play (Smart Weave)

- The camera starts centered on the first (or "start here") pin
- It smoothly glides along the temporal thread to the next pin (1.8s transition, easing `[0.22, 0.61, 0.36, 1]`)
- At each pin, the card expands to show full detail (photo with Ken Burns, story text, voice waveform)
- After the display duration (reusing existing timings: 16s for photos, reading-pace for stories, etc.), the camera glides to the next pin
- Smart weave logic:
  1. Follow the temporal backbone chronologically by default
  2. When a person-thread intersects the current era, optionally weave to that person's perspective
  3. After 1-3 memories from one person, weave back to the temporal backbone or another person
  4. This creates the "perspective weave" experience from the drift expansion plan
- An opacity pulse travels along the active thread as the camera moves (like light traveling along a string)
- Visited pins get a subtle desaturated "visited" state
- Unfocused pins in the background soften (opacity 0.4, blur 1.5px) creating depth of field
- Adjacent pins (connected by thread) stay more visible (opacity 0.7)

### Manual Exploration

- User can pause auto-play (space bar or tap)
- Drag to pan across the board
- Scroll/pinch to zoom in and out (range 0.3x–2.5x)
- Click any pin to focus on it — camera glides there then expands the detail view
- Click a visible thread to follow it — camera travels to the connected pin
- Arrow keys follow the active thread forward/backward
- Shift+Arrow jumps to the next memory (same as current drift behavior)
- Escape closes the detail view, or closes corkboard mode entirely

### Remembrance Mode

- Board shifts to monochrome: `var(--ink)` background with cream/white pins and threads
- All photos and images displayed in grayscale
- Threads are white/cream colored
- Only chronological path (no person/branch weaving)
- 1.6x pacing multiplier (same as current remembrance drift)
- Header: "In memory of [name]"

---

## 3. Technical Architecture

### 3.1. New Component Structure

```
apps/web/src/components/corkboard/
├── CorkboardDrift.tsx       # Root component: data fetch, state, render orchestration
├── CorkboardPin.tsx          # Individual memory card on the board
├── CorkboardThread.tsx        # SVG bezier thread connecting pins
├── CorkboardCamera.tsx       # Virtual camera controller (smooth pan/zoom)
├── CorkboardLayout.ts         # Position/scatter algorithm + connection computation
├── CorkboardBackdrop.tsx      # Warm cork texture background
├── corkboardTypes.ts          # Types: PinPosition, ThreadConnection, CameraState, etc.
└── corkboardAnimations.ts     # Shared Framer Motion variants, easings, constants
```

### 3.2. Modified Files

| File | Change |
|------|--------|
| `apps/web/src/components/tree/DriftMode.tsx` | Export `DriftFilter` type with `"corkboard"` mode added |
| `apps/web/src/components/tree/DriftChooserSheet.tsx` | Add "Corkboard" as 5th mode option |
| `apps/web/src/app/trees/[treeId]/tree/page.tsx` | Route `mode: "corkboard"` to `<CorkboardDrift>` |
| `apps/web/src/app/globals.css` | Add corkboard-specific CSS classes (~200 lines) |
| `apps/web/src/lib/corkboard-seen.ts` | (Optional) Separate seen-tracking for corkboard mode, or reuse existing |

### 3.3. No Backend Changes (Phase A)

The existing `GET /api/trees/:treeId/drift` endpoint returns everything needed:
- Memory list with person, kind, title, body, media, transcript, date
- Person data with portraits
- No layout data needed from server — all computed client-side

Phase D may add an optional `?layout=corkboard` parameter for server-side connection pre-computation, but this is not required for launch.

---

## 4. Component Specifications

### 4.1. CorkboardDrift.tsx — Root Component

**Props** (matches existing `DriftModeProps`):

```typescript
interface CorkboardDriftProps {
  treeId: string;
  people: ApiPerson[];
  onClose: () => void;
  onPersonDetail: (personId: string) => void;
  apiBase: string;
  initialFilter?: DriftFilter | null;
}
```

**State**:

```typescript
// Data
const [memories, setMemories] = useState<DriftFeedMemory[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState<string | null>(null);

// Layout (computed from memories)
const [pins, setPins] = useState<PinPosition[]>([]);
const [threads, setThreads] = useState<ThreadConnection[]>([]);

// Camera
const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });
const [focusedPinId, setFocusedPinId] = useState<string | null>(null);
const [isExpanded, setIsExpanded] = useState(false);

// Playback
const [isPlaying, setIsPlaying] = useState(true);
const [visitedPinIds, setVisitedPinIds] = useState<Set<string>>(new Set());
const [traverseOrder, setTraverseOrder] = useState<string[]>([]); // smart-weave ordering
const [currentTraverseIndex, setCurrentTraverseIndex] = useState(0);
```

**Lifecycle**:

1. On mount: fetch drift feed (same endpoint as current `DriftMode`)
2. On data arrival: compute `CorkboardLayout.positions(memories)` → `PinPosition[]`
3. On data arrival: compute `CorkboardLayout.connections(memories)` → `ThreadConnection[]`
4. On data arrival: compute `CorkboardLayout.smartWeave(memories, threads)` → traversal order
5. If playing: auto-advance through traversal order using timed durations per memory kind
6. On close: persist seen-map (reusing existing `loadSeenMap` / `persistSeenMap`)

**Keyboard Handlers** (reusing pattern from `DriftMode`):

- `Escape`: close detail view, or close corkboard mode
- `ArrowRight`: advance to next in traversal
- `ArrowLeft`: go back in traversal
- `Shift+ArrowRight/Left`: jump to next/previous memory
- `Space`: toggle play/pause

### 4.2. CorkboardLayout.ts — Position & Connection Algorithm

#### Pin Placement: Golden-Angle Spiral with Collision Avoidance

```typescript
interface PinPosition {
  id: string;            // memory ID
  x: number;             // board X position (px)
  y: number;             // board Y position (px)
  rotation: number;      // degrees, -12 to +12, weighted toward 0
  scale: number;         // visual scale: photos 1.0, stories 0.85, voice 0.7
  width: number;         // computed card width
  height: number;        // computed card height
}
```

**Algorithm**:

1. Sort memories chronologically by `dateOfEventText` (extract year)
2. Group memories by `primaryPersonId`
3. For each person-group, allocate a sector of the board (using golden angle distribution around center)
4. Within each sector, place that person's memories roughly chronologically (top-to-bottom or left-to-right)
5. For each memory, compute a position using:
   - Base position from golden-angle spiral: `angle = i * 137.508°, radius = sqrt(i) * spacing`
   - Jitter: random offset ±40px in each axis, seeded by `memoryId` for determinism
   - Rotation: `random(-12, 12)`, weighted toward 0 using a normal-ish distribution
   - Scale: based on memory kind (photos larger, voice smaller)
6. Post-process with collision avoidance pass:
   - Minimum 180px center-to-center distance between any two pins
   - If overlap detected, push apart iteratively (max 20 passes)
   - Constrain all pins within board bounds (with 200px padding from edges)
7. Place a "start here" pin near center-top, slightly larger, rotation 0°

**Board Dimensions**:

- Default board: `4000 × 3000` px for up to 50 memories
- Scale up proportionally: `max(4000, count * 80) × max(3000, count * 60)`
- Viewport camera starts centered at `(boardWidth/2, boardHeight/2)` at zoom `0.6`

**Determinism**:

- Use a seeded PRNG (reusing `mulberry32` pattern from `drift.ts`) with seed from `treeId`
- Same tree + same memories → same layout every time
- When new memories are added, the seed incorporates memory count so layout adjusts

#### Connection Computation

```typescript
interface ThreadConnection {
  from: string;          // source memory ID
  to: string;            // target memory ID
  type: "temporal" | "person" | "branch";
  strength: number;      // 0.3-1.0, affects thread opacity/width
}

function computeConnections(memories: DriftFeedMemory[]): ThreadConnection[] {
  // 1. Temporal threads: sort by dateOfEventText year, connect each to next
  // 2. Person threads: group by primaryPersonId, connect each person's memories sequentially
  // 3. Branch threads: if branch data available, group by branch, connect within
  // 4. Strength: temporal=0.8, person=0.5, branch=0.4 (dimmer for less-primary connections)
  // 5. Deduplicate: if temporal and person threads overlap (same edge), keep the stronger one
}
```

#### Smart Weave Traversal

```typescript
function computeSmartWeave(
  memories: DriftFeedMemory[],
  connections: ThreadConnection[],
  seenMap: Record<string, number>
): string[] {
  // 1. Start with chronological order as backbone
  // 2. At each pin, check: do person-threads branch off here?
  // 3. If yes, with 60% probability, follow the person-thread for 1-3 memories
  // 4. Then return to the temporal backbone
  // 5. Bias toward unseen memories (reusing seenMap logic)
  // 6. Never visit the same pin twice unless it's the only option
  // 7. Remembrance override: forced chronological, single person, no weaving
}
```

### 4.3. CorkboardCamera.tsx — Virtual Camera

```typescript
interface CameraState {
  x: number;      // viewport center X on the board
  y: number;      // viewport center Y on the board
  zoom: number;   // 0.3 to 2.5
}
```

**Behaviors**:

| Action | Behavior |
|--------|----------|
| Auto-advance | Camera smoothly pans from current pin center to next pin center, 1.8s duration, `[0.22, 0.61, 0.36, 1]` easing |
| Manual pan | Drag to move camera position, with momentum (decay 0.92) |
| Manual zoom | Scroll to zoom, centered on cursor position, range 0.3x–2.5x |
| Pin click | Camera animates to center on that pin over 1.8s, then pin expands |
| Idle (>5s) | Camera drifts at 0.3px/s in a gentle random direction, creating ambient life |
| Expand | When a pin expands, camera adjusts to keep the expanded card well-framed |

**Implementation**:

- Use Framer Motion's `motion.div` with `animate` prop for smooth camera transitions
- The board is rendered inside a `motion.div` whose `style.transform` is computed from camera state
- `x, y, zoom` map to CSS transform: `translate3d(-x*zoom + vpWidth/2, -y*zoom + vpHeight/2, 0) scale(zoom)`
- Momentum panning reuses the physics approach from `useMomentumCamera.ts` but adapted for the board coordinate system

### 4.4. CorkboardPin.tsx — Memory Cards

**Visual Specifications**:

Each pin renders as a `motion.div` with:
- `position: absolute` at computed `(x, y)` on the board
- `transform: rotate(${rotation}deg) scale(${scale})`
- Content determined by `kind`:

#### Photo Pin
```
┌─────────────────────┐
│                     │
│   [   photo     ]   │
│   [   thumbnail ]   │
│                     │
│                     │
├─────────────────────┤
│ Person Name         │
│ Summer 1972         │
└─────────────────────┘
```
- White border (12px) mimicking a Polaroid
- Thumbnail loads lazily, with Ken Burns effect when expanded
- Shadow: `0 4px 16px rgba(28, 25, 21, 0.15)`
- Size: ~220×280px

#### Story Pin
```
┌─────────────────────┐
│                     │
│ Memory Title        │
│                     │
│ The first line of   │
│ the story text...   │
│                     │
│ Person · Apr 1986   │
└─────────────────────┘
```
- Cream background (`var(--paper-deep)`), slightly rough edge aesthetic
- Serif font for title
- Size: ~180×220px

#### Voice Pin
```
┌────────────────┐
│ ≋ Listening    │
│                │
│ 3:24           │
│                │
│ Person · 2001  │
└────────────────┘
```
- Waveform icon (reusing the orb concept from current drift)
- Duration display
- Size: ~160×140px

#### Document Pin
```
┌─────────────────────┐
│                     │
│ ≡ Document Title   │
│                     │
│ Person · Date      │
└─────────────────────┘
```
- Letter/envelope aesthetic, slightly folded corner
- Size: ~160×200px

**Expanded State**:

When focused and expanded, the pin transitions to:
- `scale(1.4)` with 0.6s easing
- Content area fills ~60% of viewport, centered at pin's board position
- Full photo/story/voice/video detail renders inside
- Other pins fade to `opacity: 0.4, filter: blur(1.5px)`
- Adjacent connected pins stay at `opacity: 0.7, filter: blur(0.5px)`
- Connecting threads to this pin glow (opacity 0.6→0.8)
- Attribution bar appears at bottom (reusing `.drift-bottom` pattern)
- Play/pause and advance controls appear subtly

**Pushpin Decoration**:

Each pin has a small CSS pushpin at the top-center:
- Circular, 10px diameter
- `background: var(--rose)` for default, `var(--gilt)` for the "start here" pin
- `box-shadow: 0 1px 3px rgba(0,0,0,0.3)` for depth
- Positioned slightly above the card edge, overlapping it

### 4.5. CorkboardThread.tsx — Connection Lines

**Rendering**:
- SVG `<path>` elements overlaid on the board
- `d` attribute computed as quadratic bezier curves
- Control points offset perpendicular to the line between pins, with random jitter (seeded)
- This creates slightly curved, organic-feeling threads rather than straight lines

**Visual Properties**:
- `stroke-width`: 1.5px default, 2.5px when the camera is following this thread
- `stroke`: color based on thread type
  - Temporal: `var(--ink-faded)` (#847A66) — subtle
  - Person: `var(--moss)` (#4E5D42) — warm green, like garden twine
  - Branch: `var(--rose)` (#A85D5D) — muted terracotta
- `stroke-linecap: round`
- `opacity`: varies by thread type (temporal 0.5, person 0.35, branch 0.3)
- `fill: none`

**Animation**:
- When camera is traveling along a thread, an opacity pulse travels from source to destination pin
- Implemented via SVG `stroke-dashoffset` animation:
  ```
  stroke-dasharray: 8 16
  animate stroke-dashoffset from 0 to -24 over 1.8s
  ```
- This creates a "light walking along a string" effect
- Non-active threads: static, no animation

**End markers**:
- Small circles (r=3px) at each endpoint where thread meets pin
- Same stroke color, filled
- Creates a visual "connection point" like string tied to a pin

### 4.6. CorkboardBackdrop.tsx — Board Texture

**Implementation**:
- Full-viewport `<div>` at `z-index: 0` behind all pins and threads
- CSS background built from layers:

```css
.corkboard-backdrop {
  background:
    /* Layer 3: Vignette (edges darker) */
    radial-gradient(ellipse at center, transparent 55%, rgba(28, 25, 21, 0.12) 100%),
    /* Layer 2: Noise/grain texture (inline SVG data URI) */
    url("data:image/svg+xml,..."), /* subtle grain pattern */
    /* Layer 1: Warm cork gradient */
    radial-gradient(ellipse at 30% 20%, #EDE6D6 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, #E2D9C4 0%, transparent 50%),
    linear-gradient(135deg, #F6F1E7 0%, #EDE6D6 50%, #E2D9C4 100%);
  background-color: var(--paper);
}
```

- Board edge: `box-shadow: inset 0 0 80px rgba(28, 25, 21, 0.08)` giving subtle depth
- The board div is sized to `boardWidth × boardHeight` and positioned/transformed by the camera

**Dark Mode**:
```css
[data-theme="dark"] .corkboard-backdrop {
  background:
    /* Same layer structure but with dark palette */
    radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.3) 100%),
    url("data:image/svg+xml,..."), /* subtle noise */
    radial-gradient(ellipse at 30% 20%, rgba(30,20,15,0.5) 0%, transparent 50%),
    linear-gradient(135deg, #1a1612 0%, #0f0d0a 100%);
  background-color: var(--ink);
}
```

### 4.7. corkboardAnimations.ts — Shared Animation Config

```typescript
export const EASE_TESSERA: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

export const CAMERA_TRANSITION = { duration: 1.8, ease: EASE_TESSERA };
export const PIN_EXPAND = { duration: 0.6, ease: EASE_TESSERA };
export const PIN_CONTRACT = { duration: 0.4, ease: EASE_TESSERA };
export const THREAD_PULSE = { duration: 0.5, ease: "easeOut" as const };
export const BOARD_ENTRY = { duration: 1.2, ease: EASE_TESSERA };
export const CONTENT_REVEAL = { duration: 0.8, ease: EASE_TESSERA };

export const AMBIENT_DRIFT_SPEED = 0.3; // px per second when idle
export const IDLE_THRESHOLD_MS = 5000;    // time before ambient drift starts
export const UNFOCUSED_BLUR = "1.5px";
export const UNFOCUSED_OPACITY = 0.4;
export const ADJACENT_OPACITY = 0.7;

export const PIN_ROTATION_RANGE = 12; // degrees, +/- from upright
export const PIN_MIN_SPACING = 180;    // px center-to-center minimum
export const BOARD_PADDING = 200;      // px from edge
export const BOARD_BASE_WIDTH = 4000;
export const BOARD_BASE_HEIGHT = 3000;

// Duration overrides per memory kind (reusing drift timings)
export const DURATION_PHOTO = 16000;    // ms
export const DURATION_STORY_MIN = 12000;
export const DURATION_STORY_MAX = 45000;
export const DURATION_MEDIA_MAX = 60000;
export const DURATION_DOCUMENT = 14000;
export const WORDS_PER_MINUTE = 200;
export const REMEMBRANCE_PACING = 1.6;
```

### 4.8. corkboardTypes.ts — Type Definitions

```typescript
import type { ApiMemory, ApiMemoryMediaItem, ApiPerson } from "../tree/treeTypes";
import type { DriftFilter } from "../tree/DriftMode";

export interface CorkboardMemory {
  id: string;
  memory: ApiMemory;
  person: ApiPerson;
  media: ApiMemoryMediaItem | null;
  itemIndex: number;
  itemCount: number;
  kind: "image" | "video" | "audio" | "link" | "text";
}

export interface PinPosition {
  id: string;
  memoryId: string;
  x: number;
  y: number;
  rotation: number;     // degrees
  scale: number;        // visual multiplier
  width: number;
  height: number;
  isStartPin: boolean;
}

export interface ThreadConnection {
  id: string;           // "from-to" for uniqueness
  from: string;          // memory ID
  to: string;            // memory ID
  type: "temporal" | "person" | "branch";
  strength: number;      // 0.3 to 1.0
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface CorkboardDriftProps {
  treeId: string;
  people: ApiPerson[];
  onClose: () => void;
  onPersonDetail: (personId: string) => void;
  apiBase: string;
  initialFilter?: DriftFilter | null;
}

export type ThreadVisibility = {
  temporal: boolean;
  person: boolean;
  branch: boolean;
};
```

---

## 5. CSS Additions (globals.css)

Approximately 200 lines of new CSS classes in the `.corkboard-*` namespace:

| Class | Purpose |
|-------|---------|
| `.corkboard-root` | Full-viewport container, overflow hidden, cursor grab/grabbing |
| `.corkboard-board` | The scrollable board surface, positioned by camera transform |
| `.corkboard-backdrop` | Cork texture background on the board |
| `.corkboard-pin` | Base pin card: absolute position, rotation, shadow, transition |
| `.corkboard-pin--photo` | Polaroid variant: white border, larger size |
| `.corkboard-pin--story` | Note-card variant: cream bg, serif text |
| `.corkboard-pin--voice` | Audio card variant: waveform icon, compact |
| `.corkboard-pin--document` | Letter variant: folded corner accent |
| `.corkboard-pin--expanded` | Expanded state: scale 1.4, full detail visible |
| `.corkboard-pin--visited` | Visited pin: reduced saturation, subtle opacity |
| `.corkboard-pin--unfocused` | Non-focused pins when one is expanded: blur + opacity |
| `.corkboard-pin--adjacent` | Pins connected by thread to the focused one: softer blur |
| `.corkboard-pushpin` | Small decorative pushpin at top of each card |
| `.corkboard-pushpin--start` | Gold/gilt pushpin for the start pin |
| `.corkboard-thread-layer` | SVG overlay for threads, pointer-events none |
| `.corkboard-thread-path` | Individual thread path styling |
| `.corkboard-thread-path--active` | Thread currently being followed: brighter, wider, pulsing |
| `.corkboard-controls` | Bottom control bar: play/pause, thread toggles, close |
| `.corkboard-controls--playing` | Control bar when autoplay is active |
| `.corkboard-attribution` | Person name + memory title + date bar |
| `.corkboard-expanded-content` | Content area within an expanded pin |
| `.corkboard-start-here` | Initial "start here" pin, slightly larger |
| `.corkboard-remembrance` | Root modifier for remembrance mode (monochrome) |

**Color Tokens** (reusing existing CSS custom properties):

| Token | Usage |
|-------|-------|
| `--paper` (#F6F1E7) | Board base color |
| `--paper-deep` (#EDE6D6) | Pin card background (stories, documents) |
| `--ink` (#1C1915) | Thread color (temporal) |
| `--ink-faded` (#847A66) | Thread color (temporal dimmed) |
| `--moss` (#4E5D42) | Thread color (person), pushpin color |
| `--rose` (#A85D5D) | Thread color (branch) |
| `--gilt` (#B08B3E) | Start pin pushpin, accent |
| `--shadow` (rgba(28,25,21,0.08)) | Pin shadows |

---

## 6. Integration Points

### 6.1. DriftChooserSheet Modification

Add a 5th `ChoiceRow` to the `mode === "menu"` section:

```tsx
<ChoiceRow
  title="Corkboard"
  subtitle="Memories pinned to a board, connected by threads of time."
  onClick={() => pick({ mode: "corkboard" })}
/>
```

This requires updating `DriftFilter` to include `"corkboard"` as a mode value.

### 6.2. DriftFilter Type Update

In `DriftMode.tsx`, the `DriftFilter` type currently is:

```typescript
export type DriftFilter = {
  mode?: "remembrance";
  personId?: string;
  yearStart?: number;
  yearEnd?: number;
};
```

Update to:

```typescript
export type DriftFilter = {
  mode?: "remembrance" | "corkboard";
  personId?: string;
  yearStart?: number;
  yearEnd?: number;
};
```

### 6.3. Tree Page Routing

In `/app/trees/[treeId]/tree/page.tsx`, the parent component already conditionally renders `DriftMode`. Add a parallel conditional for `CorkboardDrift`:

```tsx
{driftFilter?.mode === "corkboard" ? (
  <CorkboardDrift
    treeId={treeId}
    people={people}
    onClose={closeDrift}
    onPersonDetail={handlePersonDetail}
    apiBase={apiBase}
    initialFilter={driftFilter}
  />
) : driftFilter ? (
  <DriftMode
    treeId={treeId}
    people={people}
    onClose={closeDrift}
    onPersonDetail={handlePersonDetail}
    apiBase={apiBase}
    initialFilter={driftFilter}
  />
) : null}
```

### 6.4. Data Fetching

Reuse the existing `GET /api/trees/:treeId/drift` endpoint exactly as-is. The corkboard component fetches the same data and computes layout client-side.

The response includes:
- `memories[]`: id, primaryPersonId, primaryPerson (id, name, portraitUrl), kind, title, body, transcriptText, transcriptStatus, dateOfEventText, mediaUrl, mimeType, mediaItems[]
- `seed`: deterministic seed for shuffle (can be reused for layout determinism)
- Filtering works identically: `personId`, `mode=remembrance`, `yearStart`, `yearEnd`

### 6.5. Seen Memory Tracking

Reuse `loadSeenMap`/`persistSeenMap` from `DriftMode.tsx` with the same `tessera:drift:seen:` prefix. Corkboard mode benefits from the same unseen-memory bias.

---

## 7. Animation Specifications

All animations follow the product's motion philosophy from SPEC.md and UI-INSPIRATION-BRIEF.md: **slow, weighted, archival**. No bouncy springs, no flashy transitions.

| Animation | Property | Duration | Easing | Description |
|-----------|----------|----------|--------|-------------|
| Camera pan between pins | `x, y` transform | 1800ms | `[0.22, 0.61, 0.36, 1]` | Gliding through space, like pushing a viewfinder across a board |
| Camera zoom adjust | `scale` transform | 1200ms | `[0.22, 0.61, 0.36, 1]` | Gentle zoom in/out when approaching/leaving a pin |
| Pin focus expand | `scale, opacity` | 600ms | `[0.22, 0.61, 0.36, 1]` | Card grows to reveal detail |
| Pin unfocus contract | `scale, opacity` | 400ms | `[0.22, 0.61, 0.36, 1]` | Card shrinks back |
| Unfocused pins dimming | `opacity, filter` | 500ms | ease-out | Soft depth-of-field effect |
| Thread pulse | `stroke-dashoffset` | 1800ms | linear | Light traveling along the string |
| Thread highlight | `opacity, stroke-width` | 500ms | ease-out | Thread becoming more visible |
| Content reveal | `opacity, translateY` | 800ms | `[0.22, 0.61, 0.36, 1]` | Content fading in within expanded pin |
| Board enter | `opacity` | 1200ms | `[0.22, 0.61, 0.36, 1]` | Dissolving from constellation into board |
| Ambient idle drift | `x, y` (continuous) | continuous | linear | 0.3px/s drift while paused |
| Ken Burns (photo in expanded) | `scale` | varies | linear | Slow 1.0→1.06 zoom over display duration |
| Board exit | `opacity` | 500ms | `[0.22, 0.61, 0.36, 1]` | Fading back to normal view |

**Reduced Motion**: When `prefers-reduced-motion: reduce` is active:
- Disable ambient drift
- Disable Ken Burns
- Camera transitions become 300ms instead of 1800ms
- Pin expand/contract becomes instant
- Thread pulse is disabled

---

## 8. Responsive Design

### Desktop (≥1024px)
- Full board experience with all features
- Pan with mouse drag, zoom with scroll
- Side-by-side thread type toggle controls
- Full expanded detail view (~60% viewport)

### Tablet (768–1023px)
- Slightly smaller pins (0.85x scale)
- Touch drag to pan, pinch to zoom
- Bottom-sheet style controls instead of side controls
- Expanded detail takes ~80% viewport

### Mobile (<768px)
- Smaller pins (0.7x scale), fewer visible on screen
- Swipe to pan, pinch to zoom
- Expanded detail takes full viewport (fallback to overlay behavior)
- Controls collapse to minimal bottom bar
- Thread toggle available via a menu button

---

## 9. Accessibility

- **Keyboard navigation**: Full arrow key support for following threads, space for play/pause, escape to close
- **Screen readers**: Each pin has `aria-label` with memory title, person name, and date. Active pin announces content.
- **Focus management**: When a pin expands, focus moves into the expanded content. On collapse, focus returns to the pin.
- **High contrast**: Corkboard respects system high-contrast mode — threads become higher opacity, pins get distinct borders
- **Reduced motion**: All animations respect `prefers-reduced-motion` as specified above

---

## 10. Performance Considerations

- **Board rendering**: For up to 400 memories (current drift limit), render all pins and threads as DOM elements. Beyond 400, consider virtualizing off-screen pins.
- **SVG threads**: Rendered as a single SVG layer with all `<path>` elements. SVG is efficient for this count of lines.
- **Image loading**: Pin thumbnails use `loading="lazy"` and `decoding="async"`. Expanded content loads full-resolution on demand.
- **Camera animation**: Use CSS transforms with `will-change: transform` for hardware acceleration. Framer Motion's `animate` prop handles this.
- **Layout computation**: `computePositions` and `computeConnections` run once on data arrival. For up to 400 memories, this takes <50ms.
- **Memory usage**: Pin components use `React.memo` to avoid re-renders when other pins change state.

---

## 11. Implementation Phases

### Phase A: Core Board & Layout

**Goal**: A pannable/zoomable corkboard with pins at varied positions and orientations, connected by temporal threads. Manual exploration only.

**Tasks**:
1. Create `corkboardTypes.ts` — Type definitions
2. Create `corkboardAnimations.ts` — Animation constants and variants
3. Create `CorkboardLayout.ts` — Pin placement algorithm (golden-angle spiral + collision avoidance) and connection computation
4. Create `CorkboardBackdrop.tsx` — Warm cork texture background
5. Create `CorkboardPin.tsx` — Memory card rendering for each kind (photo, story, voice, document)
6. Create `CorkboardThread.tsx` — SVG bezier thread paths between pins
7. Create `CorkboardDrift.tsx` — Root component with data fetching, board rendering, pan/zoom handlers
8. Add corkboard CSS to `globals.css`
9. Integrate: add "Corkboard" option to `DriftChooserSheet`, update `DriftFilter` type, add routing in tree page
10. Test: verify board renders, pins are placed correctly, threads connecttemporally-adjacent memories, manual pan/zoom works

### Phase B: Camera Journey & Smart Weave

**Goal**: Auto-play mode that travels between pins following the smart-weave traversal, with smooth camera animation and expand-on-board detail view.

**Tasks**:
1. Implement `computeSmartWeave()` in `CorkboardLayout.ts`
2. Create `CorkboardCamera.tsx` — Virtual camera with smooth Framer Motion transitions
3. Implement auto-advance logic in `CorkboardDrift.tsx` (timed duration per memory kind)
4. Implement expand-on-board detail view in `CorkboardPin.tsx`
5. Add thread highlight animation (traveling pulse along active thread)
6. Add thread type toggle controls (temporal/person/branch visibility)
7. Add keyboard navigation (arrow keys, space, escape)
8. Add play/pause controls and progress indicator
9. Test: verify camera transitions are smooth, smart weave logic produces sensible paths, expanded content renders correctly

### Phase C: Immersion Effects & Polish

**Goal**: The "moving through time" immersion — parallax, depth of field, visited states, remembrance mode.

**Tasks**:
1. Parallax: subtle scale change on background pins as camera passes (1.0→1.02)
2. Depth of field: unfocused pins get `filter: blur(1.5px); opacity: 0.4`, adjacent pins get `filter: blur(0.5px); opacity: 0.7`
3. Visited state: pins the camera has passed get reduced saturation and slight opacity decrease
4. Ambient idle drift (0.3px/s when paused for >5 seconds)
5. Remembrance mode: monochrome board, white threads, chronological path only, "In memory of" header, 1.6x pacing
6. Person/branch thread visibility toggles
7. Mobile responsive adjustments (smaller pins, bottom sheet controls, full-viewport expand)
8. Accessibility: ARIA labels, focus management, `prefers-reduced-motion` support
9. Board entry animation (dissolve from constellation view)
10. Test: full QA pass across mobile/tablet/desktop, low-memory devices, 400-memory datasets, remembrance mode

### Phase D: Enhanced Connections & Optimization (Future)

**Goal**: Richer thread types, backend optimization, interactive thread following.

**Tasks**:
1. Backend: optional `?layout=corkboard` parameter returning pre-computed thread connections
2. Branch-aware threads (using `memoryBranches` data)
3. Place-based threads (memories sharing the same `placeId`)
4. Perspective weave clusters (when multiple people have memories of the same event)
5. Interactive thread switching: tap a person-thread to diverge from current path
6. Pin entry animation: on board open, pins animate in one-by-one as if being pinned
7. Performance optimization: virtualize off-screen pins for >400 memories
8. Pin save/bookmark: ability to mark a memory to return to

---

## 12. Testing Strategy

### Unit Tests
- `CorkboardLayout.ts`: Pin placement algorithm (golden-angle, collision avoidance, determinism)
- `CorkboardLayout.ts`: Connection computation (temporal, person, branch threads)
- `CorkboardLayout.ts`: Smart weave traversal order (chronological backbone, person-weave alternation, no revisits)
- `corkboardTypes.ts`: Type correctness

### Integration Tests
- Data fetching from drift endpoint renders pins correctly
- `DriftFilter` with `mode: "corkboard"` is parsed and applied
- Seen-memory bias works in corkboard mode
- Remembrance mode produces monochrome, chronological-only board

### Visual/Manual Tests
- Board renders with varied pin positions and rotations
- Threads curve organically between pins
- Camera transitions are smooth and immersive
- Expanded detail view shows full content without layout issues
- Mobile layout is usable with touch gestures
- Accessibility: keyboard-only navigation completes a full drift session

---

## 13. Relationship to Existing Drift Mode

Corkboard drift is a **sibling mode** of the existing slideshow drift, not a replacement. Both share:

- The same data endpoint (`/api/trees/:treeId/drift`)
- The same `DriftFilter` type (with the new `mode: "corkboard"` option)
- The same `DriftChooserSheet` entry point
- The same seen-memory tracking logic
- The same keyboard shortcuts (with additions for pan/zoom)

They differ in:

| Aspect | Slideshow Drift | Corkboard Drift |
|--------|----------------|-----------------|
| Layout | Sequential, full-screen | Spatial, board-based |
| Navigation | Left/right, auto-advance | Pan/zoom/click, auto-glide |
| Memory transition | Cross-fade | Camera glide across board |
| Context | Previous/next peek | All pins visible, spatial |
| Connection visibility | None | Thread lines between memories |
| Time representation | Sequential order | Spatial arrangement |
| Person context | Attribution bar | Thread colors + clustering |

The user chooses which mode they want in `DriftChooserSheet`.

---

## 14. Key Design Principles (Aligned with SPEC.md)

1. **Motion breathes**: All animations use `[0.22, 0.61, 0.36, 1]` easing. Camera glides, never snaps.
2. **Warm paper, not dark tech**: The board uses `--paper` and `--paper-deep`, threads use `--moss`, `--rose`, `--ink-faded`. Never pure black or tech-dark.
3. **Content over chrome**: Pins and threads are minimal. The memory content is always the focus.
4. **Never flashy**: No confetti, bouncing, or aggressive zoom. Immersion comes from smooth movement and spatial context.
5. **Sparse is honest**: Three memories on a board is as valid as three hundred. Empty space is dignified space.
6. **Grief-shaped**: Remembrance mode shifts to monochrome, slows down, removes person-weaving. The board holds space for sorrow.
7. **Quiet controls**: Navigation controls are peripheral and minimal. Content at center.