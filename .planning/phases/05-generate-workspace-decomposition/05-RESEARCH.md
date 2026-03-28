# Phase 5: Generate Workspace Decomposition - Research

**Researched:** 2026-03-28
**Domain:** generate workspace decomposition, critical-path boot loading, brownfield React/Next refactor safety
**Confidence:** MEDIUM

## Summary

Phase 5 should decompose the `/generate` workspace without changing the authoritative workflow contracts that Phases 1 through 4 already hardened. The repo now has stable server-owned draft persistence, compare-before-accept behavior, durable operation polling, export download delivery, and seeded browser proof. That means this phase does not need new backend workflow semantics. It needs a frontend refactor that narrows the page surface, moves non-critical side-panel loading off the critical path, and preserves all existing route contracts.

The clearest bottleneck is `app/generate/page.tsx`: it is a single 2,894-line client page, it owns nearly all workspace state and handlers, and it still bootstraps six API resources in one blocking `Promise.all(...)` before the workspace becomes usable. The current startup path waits on `/api/settings`, `/api/common-phrases`, `/api/contacts`, `/api/drafts`, `/api/writing-rules`, and `/api/reference-assets` together even though phrases, contacts, rules, reference assets, and version history are side-panel concerns rather than prerequisites for entering the drafting flow.

**Primary recommendation:** plan Phase 5 as three brownfield-safe cuts: first split critical bootstrap from deferred panel data and establish a reusable workspace controller boundary; then extract stage-specific modules/hooks; then extract sidebar/history/reference concerns and add Phase 5 verification that proves the core workspace is usable before delayed side-panel endpoints finish.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | User can open the generate workspace without waiting for non-critical side-panel data to load | Split boot loading into critical workspace state (`settings`, selected `draft`, provider selection, current workflow snapshot) versus deferred panel data (`phrases`, `contacts`, `rules`, `reference assets`, `versions`) and prove it with delayed-endpoint browser coverage |
| UX-02 | Maintainer can evolve stage UI behavior through isolated modules/hooks instead of one monolithic page component | Extract stage-specific sections and controller hooks from `app/generate/page.tsx` into smaller files with stable props and helper boundaries rooted in existing `lib/generate-workspace.ts` contracts |
</phase_requirements>

## Project Constraints

- Stay inside the existing WAT model from `AGENTS.md`: reuse current routes and workspace helpers before inventing new execution layers.
- Keep brownfield impact narrow: Phase 5 is a UI decomposition/performance phase, not a workflow rewrite.
- Preserve Phase 1 through Phase 4 guarantees: authoritative workflow stages, compare-before-accept semantics, durable operation polling, export download delivery, and seeded local verification.
- Respect the repo convention that large workflows may stay in concentrated files temporarily, but prefer extraction before adding another large inline concern.
- No repo-local `.claude/skills/` or project `.agents/skills/` rules were found; `AGENTS.md` is the controlling project-specific guide.
- UI safety gate implication: this phase is a structural refactor that should preserve the established visual contract. No new visual design system or UI-SPEC is required if the plans explicitly keep the existing UX shape and behavior intact.

## Brownfield Constraints

- `app/generate/page.tsx` is the only file under `app/generate/`; there is no existing component or hook decomposition to extend incrementally.
- `app/generate/page.tsx` is 2,894 lines and owns:
  - bootstrapping and initial fetches
  - all workflow step state
  - intake/planning/outline/draft/review rendering
  - side-panel assets, phrases, contacts, writing rules, version history
  - durable operation polling and export/download UX
- The first-load effect currently blocks on all of these requests together:
  - `/api/settings`
  - `/api/common-phrases`
  - `/api/contacts`
  - `/api/drafts`
  - `/api/writing-rules`
  - `/api/reference-assets`
- Version history is also loaded separately through `/api/ai/versions?draftId=...`, which is non-critical for first render but still tied to page-level state.
- `tests/e2e/generate-smoke.spec.ts` proves core seeded flows already, but `.planning/codebase/TESTING.md` correctly notes there is still no decomposition-focused or component-level coverage for the largest interactive surface.

## Current Implementation Assessment

### What already exists

- `lib/generate-workspace.ts` already centralizes two important workspace boundaries:
  - `buildDraftSaveRequest(...)` for editable draft writes
  - `deriveHydratedDraftView(...)` for authoritative draft hydration into UI state
- Phase 4 already narrowed async workflow status into operation handles plus `/api/operations/[id]` polling, so Phase 5 can preserve those contracts while relocating UI logic.
- Existing seeded browser coverage in `tests/e2e/generate-smoke.spec.ts` gives a trustworthy regression base for unchanged workflow behavior.
- Page state is already grouped conceptually by step and by side-panel concern, even though it is still inline. That gives the planner clear extraction seams.

### What is missing

- No critical-path bootstrap boundary. Side-panel data blocks first render.
- No stage-level components. Intake, planning, outline, draft, and review render in one file.
- No focused workspace controller hook for mutations, async operation polling, or draft hydration.
- No dedicated Phase 5 tests that prove non-critical panel latency no longer blocks core authoring.
- No isolated file ownership for sidebars/history/reference assets, so any change still routes through the monolith.

### Requirement status by codebase reality

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| UX-01 | Partial | Core workspace can hydrate from an existing draft, but first render still waits on side-panel endpoints that should be deferrable |
| UX-02 | Missing | Stage behavior and panel behavior still live in one monolithic page file |

## Standard Stack

Versions below are repo-pinned or directly evidenced in the workspace.

| Library / Module | Version | Purpose | Why Standard Here |
|------------------|---------|---------|-------------------|
| Next.js | `14.2.0` | App Router page and route integration | Existing workspace already depends on it |
| React | `18.2.0` | Client-side workspace state and rendering | Current page is a client component and should stay one through this phase |
| `lib/generate-workspace.ts` | repo module | Workspace hydration and editable save shaping | Best brownfield anchor for moving state derivation out of `page.tsx` |
| `node:test` | runtime baseline | Contract-style verification | Matches existing phase contract coverage approach |
| `@playwright/test` | `1.58.2` | Browser proof under seeded local data | Best way to prove UX-01 without live providers |

## Recommended Decomposition Patterns

### Pattern 1: Separate critical bootstrap from deferred side-panel data

**What:** Only block initial workspace readiness on `settings` plus the selected draft lookup/hydration path. Load phrases, contacts, rules, reference assets, and versions after the primary workspace shell is interactive.

**When to use:** First plan slice. This is the only direct route to UX-01.

**Why:** The current blocking `Promise.all(...)` front-loads non-critical data. Users should be able to enter the current draft stage and begin editing while side-panel helpers continue loading.

**Concrete target state:**

- Critical boot path:
  - `/api/settings`
  - `/api/drafts` only insofar as it is needed to resolve the selected draft from `window.location.search`
  - provider resolution
  - `hydrateDraft(...)`
- Deferred loaders:
  - `/api/common-phrases`
  - `/api/contacts`
  - `/api/writing-rules`
  - `/api/reference-assets`
  - `/api/ai/versions?draftId=...`

### Pattern 2: Introduce a workspace controller boundary before broad JSX extraction

**What:** Move stateful orchestration and mutation handlers behind a controller hook or controller helper layer before extracting many render components.

**When to use:** Foundation for all later plan slices.

**Why:** Jumping straight from one 2,894-line page to many visual components without a controller boundary risks spreading fetch/mutation logic everywhere. `lib/generate-workspace.ts` already proves that central workspace helpers work in this repo.

**Concrete target state:**

- One controller boundary owns:
  - draft hydration
  - save/mutation handlers
  - operation polling state
  - workflow-stage navigation state
- Render modules receive props instead of issuing their own fetches unless the plan explicitly makes them deferred panel loaders

### Pattern 3: Extract by responsibility, not by arbitrary JSX chunk size

**What:** Split modules along the existing workflow and panel seams:

- Stage surfaces:
  - intake
  - planning
  - outline
  - draft
  - review
- Side/panel surfaces:
  - phrases/contacts
  - writing rules
  - reference assets/upload
  - version history
  - operation status / pending change banner

**When to use:** After the controller and boot split exist.

**Why:** UX-02 is about maintainability of stage behavior. Extraction should map to how maintainers reason about the product, not to arbitrary line-count reduction.

## Testing Strategy Recommendations

### Browser proof for UX-01

Add a Phase 5 Playwright scenario that delays one or more non-critical endpoints, such as `/api/writing-rules` and `/api/reference-assets`, and proves:

- the selected draft still hydrates
- the current workflow stage view is visible
- core authoring controls are usable
- the delayed panel content appears later without breaking the shell

This is stronger than a unit assertion because UX-01 is about observable user readiness under real request timing.

### Contract proof for UX-02

Add Phase 5 contract-style tests that assert the controller and extracted modules keep using the authoritative helpers instead of reintroducing raw inline payload shaping. A good baseline is to preserve usage of `buildDraftSaveRequest(...)`, `deriveHydratedDraftView(...)`, and the Phase 4 operation polling path while the file topology changes.

## Recommended Plan Shape

The safest plan split is:

1. **Foundation / shell split**
   - Establish controller boundary
   - Move critical bootstrap off non-critical panel fetches
   - Add Phase 5 test harness and readiness proof
2. **Stage module extraction**
   - Pull intake/planning/outline or equivalent step surfaces into isolated modules/hooks
   - Keep existing behavior and route contracts unchanged
3. **Draft/review and sidebar extraction**
   - Move side-panel/history/reference/version/operation concerns out of the monolith
   - Add final browser/build verification for unchanged workflow behavior plus deferred loading

Wave shape should likely be `1 + 2 parallelizable plans`: once the shell/controller boundary exists, stage extraction and panel extraction can proceed with largely disjoint write scopes.

## Risks and Mitigations

| Risk | Why it matters | Mitigation |
|------|----------------|-----------|
| Decomposition accidentally changes workflow behavior | This page is the primary UI for all phases of drafting | Keep server contracts unchanged and preserve seeded browser proof throughout |
| Deferred loading breaks assumptions in controls that expect rules/assets immediately | Current file assumes all data exists by the time boot completes | Gate non-critical panels with local loading states and keep core actions independent from panel readiness |
| Handler extraction spreads fetch logic across many files | Maintainability can get worse instead of better | Introduce one controller boundary before broad JSX extraction |
| Phase 5 silently becomes a redesign | UI safety gate exists for frontend phases | Lock the phase to structural decomposition and critical-path loading only; preserve established visuals and interactions |

## Validation Architecture

Phase 5 should reuse the existing verification stack rather than introducing a new framework.

- **Contract layer:** use `node:test` for Phase 5 controller/module topology checks and helper-boundary assertions
- **Browser layer:** reuse seeded Playwright coverage to prove delayed non-critical endpoints do not block core workspace readiness
- **Build gate:** keep `npm run build` in the final verification path because module extraction can break import boundaries or client/server usage quickly in Next.js

Recommended commands once Phase 5 tests exist:

- Quick contract run:
  - `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/*.test.ts`
- Full phase run:
  - `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/*.test.ts && npm run build && npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && playwright test --config=playwright.config.ts --project=chromium tests/e2e/generate-smoke.spec.ts --grep "UX-01|UX-02|Phase 5"`

## Recommendation

Plan Phase 5 around preserving existing trusted workflow behavior while changing only three things:

1. what blocks first render
2. where workspace orchestration lives
3. which files own each stage and side-panel concern

Anything broader risks turning a maintainability/performance phase into another behavior phase, which the roadmap explicitly avoids.
