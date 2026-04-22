# Multi-Lineage And Cross-Scope Tree Navigation Plan

## Summary

Tessera should support one user owning and participating in multiple family lineages, with movement between them happening through shared people rather than through a separate archive-to-archive connection model.

This is the right direction for the current codebase because the platform already has:

- `tree_memberships` for one user belonging to many trees
- `tree_person_scope` for one person appearing in multiple trees
- global person records that can already be surfaced across tree contexts
- cross-tree person visibility and traversal endpoints already present in the API

The missing work is not foundational schema invention. The missing work is turning the current cross-tree scope model into a first-class product workflow:

- create multiple lineages intentionally
- add an existing person into another lineage cleanly
- detect and resolve duplicates before they multiply
- move between lineages from the person and tree interfaces
- preserve selected-person context when moving from one lineage to another

The guiding model should be:

- a `tree` is a lineage or archive context
- a user can belong to many lineages
- a person can appear in many lineages
- shared people are the bridges between lineages
- lineages are not connected directly; people are

Example:

- User has `Ward Family`
- User creates `Karsen Family`
- User’s spouse person record appears in both trees
- Selecting that spouse in the tree exposes movement into the other lineage
- Memories follow person scope and visibility rules, not archive-to-archive link rules

## Goals

- Allow one user to create and manage multiple family lineages.
- Make spouse-family and in-law-family use cases natural.
- Let the same person appear in multiple lineages without forcing duplicate person records.
- Allow users to move between lineages from the context of a selected person.
- Make lineage switching inside the tree intentional and understandable.
- Preserve current cross-tree scope architecture instead of adding a parallel tree-linking system.

## Non-Goals

- Do not reintroduce the retired connected-family handshake model.
- Do not add a direct `tree_links` or `lineage_connections` table in v1.
- Do not attempt fully automatic duplicate resolution across all trees.
- Do not merge trees into one global giant graph view in this phase.
- Do not redesign the atrium around cross-lineage traversal; the main work belongs in dashboard, person, and tree flows.

## Current State

### Relevant Schema

The existing schema already supports most of the required data behavior.

#### `trees`

Represents a lineage/archive context.

Relevant fields:

- `id`
- `name`
- `founderUserId`

#### `tree_memberships`

Lets one user belong to many trees already.

Relevant fields:

- `treeId`
- `userId`
- `role`

This is the main reason a single user can already participate in multiple lineages at the account level.

#### `people`

Represents a person record.

Relevant fields:

- `id`
- `treeId`
- `homeTreeId`
- `linkedUserId`

Important nuance:

- `treeId` still exists as the base/origin tree
- `homeTreeId` also exists and can be used to describe the person’s canonical home lineage
- the current platform has already moved toward a scoped multi-tree model rather than “one person only belongs to one tree forever”

#### `tree_person_scope`

This is the central cross-lineage table for the feature.

Relevant fields:

- `treeId`
- `personId`
- `displayNameOverride`
- `visibilityDefault`
- `addedByUserId`

This already allows one person to appear in multiple lineages.

#### `relationships`

Relevant fields:

- `treeId`
- `createdInTreeId`
- `fromPersonId`
- `toPersonId`
- `type`

This means relationships are still tree-scoped, which is acceptable for v1. A spouse relationship can exist in one lineage without requiring every lineage to share the same relationship object.

#### Cross-tree supporting memory model

Memories and media already contain transitional cross-tree support:

- `memories.contributingTreeId`
- `media.contributingTreeId`
- memory reach and visibility systems

This is sufficient for the plan here. The major work is not memory storage; it is lineage traversal and scope management.

### Existing API Capabilities

The following routes already exist and should be reused:

- `POST /api/trees`
- `GET /api/trees`
- `POST /api/trees/:treeId/scope/people`
- `GET /api/trees/:treeId/scope/people`
- `PATCH /api/trees/:treeId/scope/people/:personId`
- `DELETE /api/trees/:treeId/scope/people/:personId`
- `GET /api/people/:personId/trees`
- `GET /api/trees/:treeId/people/:personId/cross-tree`

There is already explicit product language in settings saying the old cross-tree handshake is retired and that shared relatives travel through tree scope.

### Existing UI Capabilities

- Dashboard already lists trees the user belongs to.
- Person page already loads:
  - visible trees for a person
  - cross-tree appearances
- Tree page already supports selected-person state.
- Tree canvas already exposes selected-person controls and routing hooks.

What is missing is not data access. It is workflow quality and navigation quality.

## Product Model

### Terminology

Use consistent language:

- `Lineage` for the user-facing concept
- `Tree` for the technical/storage concept

In UI:

- dashboard can say `Your lineages`
- settings can still refer to `tree settings` if needed internally
- person pages can say `Appears in other lineages`

### Conceptual Rule

The platform should treat a lineage as a curated view onto a shared family world, not as a sealed container.

That means:

- one user can own many lineages
- one person can exist in many lineages
- one selected person can be the navigation bridge between lineages
- memories remain governed by visibility and reach rather than copied blindly

### Example

User flow:

1. User creates `Ward Family`.
2. User creates `Karsen Family`.
3. User adds spouse person into `Karsen Family` scope.
4. User opens spouse in `Ward Family`.
5. UI shows `Also appears in Karsen Family`.
6. User clicks `Open in Karsen Family`.
7. App routes to the other lineage’s tree centered on that same person.

This is the target behavior.

## Key UX Changes

### 1. Dashboard: Multi-Lineage Ownership

The dashboard should explicitly support multi-lineage ownership.

Requirements:

- Show all lineages the user belongs to.
- Distinguish:
  - founded by you
  - shared with you
- Add strong `Create lineage` CTA.
- Allow naming with real family-language examples:
  - `Ward Family`
  - `Karsen Family`
  - `Maternal Line`
  - `Dad's Side`
  - `Chosen Family`

Recommended dashboard additions:

- section: `Your lineages`
- per-lineage metadata:
  - name
  - role
  - people count
  - memory count
  - last opened
- quick actions:
  - `Open atrium`
  - `Open tree`
  - `Settings`

### 2. Person Page: Cross-Lineage Bridge

The person page should become the main place to manage where a person appears.

Current support exists through:

- `GET /api/people/:personId/trees`
- `GET /api/trees/:treeId/people/:personId/cross-tree`

Required UI additions:

- prominent section: `Appears in other lineages`
- list all visible lineages containing this person
- per lineage:
  - lineage name
  - display name in that lineage
  - count of visible memories in that lineage
  - open action

New primary actions:

- `Add to another lineage`
- `Open in [lineage name]`
- `Review duplicates before adding` when needed

This should not be buried in settings-like copy. It should be a first-class chapter/sidebar section on the person page.

### 3. Tree: Selected-Person Lineage Switcher

The tree page should allow movement between lineages from the currently selected person.

Desired behavior:

- user selects a person in the tree
- if that person appears in multiple lineages, show a small switcher
- switcher offers:
  - current lineage
  - other lineages where this person appears
  - explicit `Open in [lineage]`

This should preserve subject continuity.

Important:

- switching lineage should not reset to a generic tree root
- it should carry selected person context

Recommended route behavior:

- `/trees/:treeId?focusPersonId=:personId`

On load:

- if `focusPersonId` exists and person is in scope, auto-select that person
- center tree on that person’s lineage focus

This is likely the cleanest way to make cross-lineage movement feel deliberate and stable.

### 4. Atrium

The atrium should remain lineage-specific.

Do not turn the atrium into a cross-lineage router.

Possible light addition:

- if the featured branch focus person exists in other lineages, add a small coda:
  - `Also appears in Karsen Family`

But the main implementation should remain on:

- dashboard
- person page
- tree selected-person UI

## Core User Flows

### Flow A: Create spouse’s family lineage

1. User opens dashboard.
2. Clicks `Create lineage`.
3. Creates `Karsen Family`.
4. Opens `Ward Family`.
5. Opens spouse’s person page.
6. Clicks `Add to another lineage`.
7. Chooses `Karsen Family`.
8. System adds the existing spouse person to `Karsen Family` scope.
9. User opens `Karsen Family` tree and continues building spouse-side parents, siblings, grandparents.

### Flow B: Navigate between lineages through a spouse

1. User is in `Ward Family` tree.
2. User selects spouse.
3. Selected-person controls show `Appears in: Karsen Family`.
4. User clicks `Open in Karsen Family`.
5. App routes to `/trees/:karsenTreeId?focusPersonId=:spousePersonId`.
6. Tree opens centered on spouse in spouse-family lineage.

### Flow C: Prevent duplicate spouse records

1. User tries to add spouse to another lineage.
2. System detects candidate duplicate people already in target lineage.
3. User is shown options:
  - `Use existing person in that lineage`
  - `Add this shared person to that lineage`
  - `Merge duplicates`
4. User chooses intentionally before data is duplicated.

## Technical Plan

### Phase 1: First-Class Multi-Lineage UX

Objective:

- make multiple lineages visible and manageable for one user

Implementation:

- improve dashboard tree listing and creation affordances
- update language from implicit `archives`/`trees` toward explicit `lineages` where user-facing
- add per-lineage open actions

Technical notes:

- no schema changes required
- existing `POST /api/trees` and `GET /api/trees` cover this phase

### Phase 2: Person-to-Lineage Scope Management

Objective:

- allow adding an existing person into another lineage from the person page

Implementation:

- add UI on person page for `Add to another lineage`
- fetch candidate target trees:
  - user’s visible trees
  - excluding current tree
  - excluding trees where person already exists in scope
- submit using existing route:
  - `POST /api/trees/:targetTreeId/scope/people`

Recommended API addition:

- add helper endpoint for targetability:
  - `GET /api/people/:personId/available-trees`

Possible response:

```ts
type AvailableTreeForPerson = {
  treeId: string;
  treeName: string;
  role: "founder" | "steward" | "contributor" | "viewer";
  alreadyInScope: boolean;
  canAddToScope: boolean;
};
```

This avoids pushing too much filtering logic into the client.

### Phase 3: Tree Cross-Lineage Navigation

Objective:

- move between lineages while preserving selected-person context

Implementation:

- add `focusPersonId` query param support on tree page
- on tree load:
  - validate `focusPersonId`
  - if in scope, auto-select person
  - fit bounds around that person’s lineage focus
- add selected-person lineage switcher inside tree canvas shell or side panel

UI recommendation:

- when a person is selected, show:
  - `Viewing Ethan in Ward Family`
  - chips for `Open in Karsen Family`, etc.

Potential route examples:

- `/trees/ward-tree-id?focusPersonId=ethan-person-id`
- `/trees/karsen-tree-id?focusPersonId=ethan-person-id`

### Phase 4: Duplicate Detection Before Scope Expansion

Objective:

- stop shared-lineage expansion from multiplying duplicates

Current support:

- person page already has duplicate candidate loading
- merge flows already exist

Implementation:

- before adding person to another lineage, check duplicate candidates inside target tree
- if duplicates exist, block silent add and require explicit resolution

Recommended API addition:

- `GET /api/trees/:treeId/people/:personId/scope-conflicts?targetTreeId=:targetTreeId`

Possible response:

```ts
type ScopeConflictResponse = {
  targetTree: {
    id: string;
    name: string;
  };
  existingScopedMatch: boolean;
  duplicateCandidates: Array<{
    personId: string;
    displayName: string;
    confidence: number;
    reasons: string[];
  }>;
};
```

Behavior:

- if `existingScopedMatch`, surface `Open there`
- if high-confidence duplicates, offer merge/reuse flow
- if no conflicts, allow add immediately

### Phase 5: Relationship And Memory Continuity

Objective:

- make cross-lineage scope expansion feel structurally coherent

Important current constraint:

- relationships are tree-scoped
- scope-sharing a person into another lineage does not automatically port every relationship

That is acceptable for v1, but the UX should reflect it honestly.

Expected v1 behavior:

- adding spouse into target lineage only adds the person to scope
- target lineage’s own tree structure is built there through local relationships
- cross-lineage movement works because the person is shared, not because every surrounding relationship is copied

Possible future enhancement:

- “suggest nearby relatives also in scope”
- after adding a person into a lineage, recommend:
  - parents
  - children
  - spouse
  - siblings

This could be:

- a post-add prompt
- a batch scope-add tool

But it should not be automatic in v1.

## Data Model Guidance

### Do Not Add A Tree-Link Table In V1

Do not create tables like:

- `tree_connections`
- `lineage_bridges`
- `archive_links`

Reason:

- the shared person already is the bridge
- adding tree-to-tree connection tables creates a second source of truth
- it reintroduces the old conceptual model the app is already moving away from

### Keep `tree_person_scope` As The Bridge Layer

This should remain the core cross-lineage membership system.

Primary concept:

- person belongs canonically somewhere
- person is visible in multiple lineages through scope

### Use `homeTreeId` More Intentionally

Current schema already includes `people.homeTreeId`.

Recommended product meaning:

- the lineage where this person primarily originates
- not an exclusivity constraint
- useful for:
  - provenance
  - duplicate resolution
  - UI language like `Originally from Ward Family`

## API Worklist

### Reuse Existing

- `POST /api/trees`
- `GET /api/trees`
- `POST /api/trees/:treeId/scope/people`
- `GET /api/people/:personId/trees`
- `GET /api/trees/:treeId/people/:personId/cross-tree`

### Add

#### 1. `GET /api/people/:personId/available-trees`

Purpose:

- list user-visible trees where the person could be added

Response should include:

- tree id
- tree name
- user role
- already in scope
- whether user can add to scope

#### 2. `GET /api/trees/:treeId/people/:personId/scope-conflicts?targetTreeId=:targetTreeId`

Purpose:

- preflight duplicate detection before scope-add

#### 3. Optional: `POST /api/trees/:treeId/scope/people/batch`

Purpose:

- allow adding a selected person plus adjacent relatives in one steward action

Payload example:

```ts
{
  personIds: string[];
}
```

This is optional for first implementation.

## Frontend Worklist

### Dashboard

- redesign tree list as lineage list
- add `Create lineage`
- add clearer open actions

### Person Page

- elevate cross-tree section
- add `Add to another lineage`
- add `Open in lineage`
- add conflict-resolution modal before adding

### Tree Page / TreeCanvas

- support `focusPersonId` query param
- initialize selection from `focusPersonId`
- expose lineage switcher for selected shared people
- preserve camera focus when switching lineages

### Memory / Atrium

- only minor lineage-awareness additions if needed
- do not overcomplicate these surfaces in this phase

## Duplicate Handling Strategy

This is the main implementation risk.

### Problem

A spouse may already exist as a separate person record in the spouse-family lineage.

If the user adds their spouse person to that lineage without checks, the target lineage can end up with:

- existing spouse record
- newly scoped spouse record

That breaks navigation and trust.

### Required Safeguards

Before scope-add:

- run duplicate candidate lookup in target lineage
- if strong candidates exist, require user choice

Resolution options:

- `Use existing person in target lineage`
- `Add this shared person anyway`
- `Merge duplicates first`

Recommended default:

- bias toward reuse/merge, not duplicate creation

## Permissions

Lineage expansion should obey current tree membership roles.

Recommended rules:

- `founder` and `steward`:
  - can add existing people to lineage scope
  - can resolve duplicates
  - can merge
- `contributor`:
  - can view cross-lineage appearances
  - can navigate into lineages where they have membership
  - should not add arbitrary people to another lineage unless explicitly allowed later
- `viewer`:
  - read-only

This matches the current tree-scope management posture.

## Routing And State Details

### Tree routing

Add support for:

- `focusPersonId`

Recommended behavior:

- read from `useSearchParams`
- after people load:
  - if `focusPersonId` exists and person is in scope:
    - set selected person
    - set lineage mode to reasonable default, likely `birth`
    - fit bounds for that person

### Person cross-lineage movement

Buttons should route to:

- `/trees/:targetTreeId/people/:personId`
- `/trees/:targetTreeId?focusPersonId=:personId`

Use:

- person page route when the user wants chapter context
- tree route when the user wants lineage/constellation context

## Testing Plan

### Unit / Integration

- one user can create multiple trees
- one person can be added into another tree scope
- `GET /api/people/:personId/trees` returns all visible trees correctly
- `GET /api/trees/:treeId/people/:personId/cross-tree` excludes current tree and includes visible others
- duplicate preflight detects target-tree candidates
- tree route centers selected person when `focusPersonId` is present

### Manual QA

#### Scenario 1: spouse family

- create user
- create tree A and tree B
- create spouse in tree A
- add spouse into tree B scope
- verify spouse visible in both
- verify person page shows both lineages
- verify tree switch works

#### Scenario 2: duplicate spouse

- create spouse copy independently in tree B
- attempt to add shared spouse from tree A into tree B
- verify duplicate warning appears
- verify merge/reuse choices work

#### Scenario 3: permissions

- test founder/steward/contributor/viewer behavior

## Rollout Order

Recommended implementation order:

1. Dashboard multi-lineage improvements
2. Person-page `Add to another lineage`
3. Available-trees + conflict-check API helpers
4. Tree `focusPersonId` support
5. Selected-person lineage switcher in tree
6. Duplicate-resolution polish

This keeps product value shipping early while reducing data risk.

## Recommendation

Implement this as:

- multi-lineage ownership
- shared-person scope expansion
- person-driven lineage bridging
- selected-person lineage switching in the tree

Do not implement it as:

- tree-to-tree handshake
- direct archive connections
- automatic relationship copying across lineages

The existing architecture is already close to the right design. The work is to complete the product layer around it.
