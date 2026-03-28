# Phase 1: Workflow Integrity Guardrails - Research

**Researched:** 2026-03-26
**Domain:** authoritative draft persistence, workflow-stage ownership, restore hydration, brownfield route hardening
**Confidence:** MEDIUM

## Summary

Phase 1 needed to solve the highest-risk integrity gap in the existing drafting platform: the browser could send workflow-owned fields back to the server and potentially overwrite protected state. The safest brownfield approach was not a large rewrite. It was to narrow the `/api/drafts` contract to editable fields only, preserve server-owned workflow columns on update, return authoritative draft snapshots from save and restore routes, and centralize real stage transitions in a shared server helper instead of scattered literals.

The codebase already had the right ingredients for this approach: direct App Router handlers under `app/api/**/route.ts`, shared schemas in `lib/validation.ts`, persistence helpers in `lib/collaborative-store.ts`, and a monolithic `/generate` page that could be taught to hydrate from server-returned `draft` objects. That meant Phase 1 could stay surgical and prove correctness with focused `node:test` contract coverage rather than introducing new infrastructure.

The main architectural constraint was that workflow integrity is not just a save-route problem. It spans four linked behaviors:
- editable draft saves must reject workflow-owned keys
- restore must return a coherent authoritative draft snapshot
- the generate workspace must hydrate from server snapshots instead of speculative local reconstruction
- only supported server workflow actions should advance `workflow_stage`

**Primary recommendation:** implement Phase 1 as four integrity cuts matching those four behaviors: draft-save contract hardening, restore snapshot hardening, generate-workspace hydration alignment, and authoritative stage-transition centralization.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FLOW-01 | Saving a draft must not let browser payloads overwrite protected workflow state | Split editable save schema from full workflow schema; preserve protected columns on update; return authoritative saved draft |
| FLOW-02 | Workflow stage advances only through supported server actions | Centralize action-to-stage mappings in a shared server helper and adopt it across real workflow routes |
| FLOW-03 | Reopening an in-progress draft resumes from the last confirmed server state | Use a single authoritative hydration path in the client for fetched and restored drafts |
| FLOW-04 | Restoring a version yields coherent content and metadata without corrupting version history | Merge restored content onto the current authoritative draft, append a restored snapshot, and return normalized `draft` state |
</phase_requirements>

## Project Constraints

- Preserve the existing Next.js App Router plus Supabase stack; no framework migration.
- Keep shared validation in `lib/validation.ts`, not inline in route files.
- Prefer pure helpers in `lib/*` for payload shaping and merge behavior so contracts are executable.
- Use route handlers under `app/api/**/route.ts` as the authoritative mutation surface.
- Avoid client-owned workflow reconstruction where the server can return normalized draft state directly.
- Minimize brownfield blast radius: tighten contracts and hydration behavior before adding new capabilities.

## Standard Stack

### Core

| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Node.js built-in `node:test` | Contract and helper verification | Already fits the repo's lightweight execution style and is sufficient for payload/merge/transition contracts |
| Next.js App Router route handlers | Authoritative mutation surfaces | Existing API shape already lives in `app/api/**/route.ts` |
| Supabase client/store helpers | Draft and version persistence | Existing persistence model already depends on Supabase-backed draft/version state |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| Zod schemas in `lib/validation.ts` | Narrow browser write contracts | Use for request parsing and explicit rejection of protected fields |
| Pure helper modules in `lib/*` | Payload shaping and merge logic | Use when route behavior needs source-level contract tests without live infra |

## Architecture Patterns

### Pattern 1: Separate Editable Save Input From Full Draft Shape

**What:** Use a dedicated save schema for `/api/drafts` that only accepts editable fields instead of the full workflow aggregate.

**Why:** The browser should never be allowed to post `workflowStage`, `planning`, `outline`, `sections`, generated content, or version counters back into authoritative persistence.

### Pattern 2: Return Authoritative `draft` Snapshots From Mutating Routes

**What:** Save and restore routes should return normalized draft state, not just success booleans or raw version rows.

**Why:** The UI can then hydrate from one server-owned shape for save, reopen, and restore instead of patching fields manually.

### Pattern 3: Keep Merge Logic Pure and Testable

**What:** Extract payload-shaping and restore-merge behavior into `lib/draft-save.ts`, `lib/version-restore.ts`, and `lib/generate-workspace.ts`.

**Why:** Integrity rules are easiest to defend with executable contracts against pure functions.

### Pattern 4: Centralize Workflow Stage Ownership

**What:** Move action-to-stage mapping into a single helper such as `lib/workflow-stage.ts`.

**Why:** Stage ownership should be explicit and auditable, not implied by route-local string literals.

## Recommended Phase Split

1. **01-01 Draft save hardening**
   - Introduce editable-only save schema
   - Preserve protected workflow fields on update
   - Return authoritative saved draft
2. **01-02 Restore snapshot hardening**
   - Merge restored content onto current draft coherently
   - Preserve non-restored workflow metadata
   - Return normalized restored draft
3. **01-03 Generate workspace hydration alignment**
   - Send editable-only save payloads
   - Hydrate from returned `draft`
   - Reuse the same path for reopen and restore
4. **01-04 Authoritative stage transition centralization**
   - Make supported workflow stage transitions explicit
   - Adopt the helper across intake/planning/outline/draft/review/export routes

## Risks and Mitigations

| Risk | Why It Matters | Mitigation |
|------|----------------|------------|
| Route still writes protected fields from `body.*` | FLOW-01 fails even if schema narrows | Add source-level contract tests and inspect route mapping directly |
| Restore returns raw version data instead of normalized draft state | Client hydration stays brittle | Re-read or normalize the draft after restore and return `draft` |
| `/generate` keeps patching local state after restore | FLOW-03/FLOW-04 remain fragile | Introduce shared hydration helpers and use server snapshots everywhere |
| Stage transitions remain scattered route literals | FLOW-02 stays implicit and easy to regress | Add a shared stage helper and test allowed mappings |

## Success Shape

Phase 1 is successful when:
- browser draft saves cannot directly mutate workflow-owned state
- restore yields a coherent authoritative draft snapshot
- the generate workspace trusts server-returned `draft` objects for save/reopen/restore
- only supported workflow actions can advance the workflow stage

## Recommendation

Do not retrofit new infrastructure here. Phase 1 should remain a brownfield integrity pass that hardens contracts, hydration, and stage ownership with targeted helper extraction and executable checks.
