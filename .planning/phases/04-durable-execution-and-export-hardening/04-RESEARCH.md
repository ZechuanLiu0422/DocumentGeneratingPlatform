# Phase 4: Durable Execution and Export Hardening - Research

**Researched:** 2026-03-28
**Domain:** durable background operations, resumable generation/export workflows, distributed rate limiting, binary export delivery
**Confidence:** MEDIUM

## Summary

Phase 4 should harden the existing collaborative drafting workflow instead of introducing a second application stack. The repo already has the right brownfield anchors: authoritative draft state in `drafts`, append-only `document_versions`, persisted `review_state`, candidate compare/accept semantics in `pending_change`, structured route telemetry, and Supabase-backed quota accounting. What it does not have is any durable execution layer. All AI and export routes still run synchronously inside Next.js route handlers with `maxDuration = 60`, the burst limiter is a process-local `globalThis` map, and export still returns a DOCX buffer as base64 JSON that the browser decodes with `atob(...)`.

The safest implementation path is to add a narrow operations layer backed by Supabase/Postgres, then move long-running draft/revise/review/export work onto enqueue + claim + run + persist flows. The queue does not need a new external vendor in this phase. A Postgres-backed operations table plus lease-based claiming is enough to make execution resumable, idempotent, and multi-instance safe while keeping the current route/business-logic split intact. Export hardening should replace the current base64 round-trip with a server-owned binary delivery path, ideally backed by durable storage metadata rather than transient JSON payloads.

**Primary recommendation:** implement Phase 4 as four brownfield-safe cuts: operation contracts and persistence, distributed coordination/rate-limit hardening, async adoption for long-running AI work, and export delivery/storage hardening with browser proof.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | User can complete long-running generation and export work through durable background jobs instead of fragile request-bound execution | Add a persisted operations table, enqueue routes, lease-based claiming, and operation-status read models so draft and export work can continue or be resumed safely outside the initiating request |
| OPS-02 | Platform enforces distributed rate limits that remain effective across restarts and multiple instances | Replace `globalThis` in-memory burst limiting with a Postgres-backed limiter/lease counter keyed by user + action + window |
| OPS-03 | User can safely resume interrupted generation or export work without duplicate side effects or corrupted draft state | Persist idempotency keys, attempts, lease expiry, last known result/error, and authoritative draft/export status so retries are explicit and side effects are guarded |
| UX-03 | User can export a final document without base64 inflation or unnecessary client-side decode steps | Replace JSON base64 export responses with binary download/stream semantics and a server-owned retrieval path for completed exports |
</phase_requirements>

## Project Constraints (from AGENTS.md and planning state)

- Stay inside the WAT model: prefer extending existing routes, libs, and Supabase schema over adding a separate worker framework without clear need.
- Keep the core stack: Next.js App Router monolith, Supabase Auth/Postgres/RLS, current provider abstraction, and the existing route helper/error handling patterns.
- Keep brownfield impact narrow. `app/generate/page.tsx` is still monolithic; Phase 4 should avoid mixing durable-ops work with the larger Phase 5 UI decomposition.
- Preserve Phase 1 through Phase 3 guarantees: authoritative workflow stages, RLS-backed isolation, review freshness gating, compare-before-accept semantics, and seeded browser proof.
- Keep route behavior observable through the existing `lib/api.ts` structured logging path rather than introducing a parallel telemetry format.
- No repo-local `.claude/skills/` or `.agents/skills/` project rules were found; AGENTS.md remains the main project-specific execution constraint.

## Brownfield Constraints

- All long-running workflow routes are still request-bound Node handlers with `maxDuration = 60`:
  - `app/api/ai/intake/route.ts`
  - `app/api/ai/outline-plan/route.ts`
  - `app/api/ai/outline/route.ts`
  - `app/api/ai/draft/route.ts`
  - `app/api/ai/review/route.ts`
  - `app/api/ai/revise/route.ts`
  - `app/api/generate/route.ts`
- `lib/official-document-workflow.ts` owns the business logic for intake, planning, outline, draft, revise, review, and review hashing; durable execution should wrap these workflows, not rewrite them.
- `lib/official-document-ai.ts` still performs direct provider calls inline and normalizes 429/401 style failures only after the request is already in flight.
- `lib/ratelimit.ts` uses a `globalThis` `Map`, so burst limits reset on restart and diverge across instances.
- `lib/quota.ts` already proves Postgres-backed counters are acceptable in this codebase; the durable limiter should reuse that operational posture instead of adding Redis-only assumptions.
- `app/api/generate/route.ts` currently returns `file_data: fileBuffer.toString('base64')`, and `app/generate/page.tsx` decodes it in the browser via `atob(...)`. That is the exact UX-03 anti-pattern to remove.
- `drafts` already carries `review_state`, `pending_change`, `workflow_stage`, `generated_content`, and `updated_at`; those fields are the natural brownfield anchor for resumable operation state and stale-result protection.
- `document_versions` already captures lifecycle snapshots with `stage`, `title`, `content`, `sections`, and `review_state`; it should remain the user-visible history trail, not become the internal job queue.

## Current Implementation Assessment

### What already exists

- Authoritative draft persistence and normalization live in `lib/collaborative-store.ts`.
- Phase 3 already introduced persisted compare/accept state through `pending_change`, including candidate ids, before/after snapshots, expiry, and base timestamps.
- Export freshness is already enforced through `draft.review_state` and `computeReviewContentHash(...)` in `app/api/generate/route.ts`.
- Daily quota is already distributed via `usage_events` in `lib/quota.ts`.
- Structured request logging and error shaping are already centralized in `lib/api.ts`.
- `vercel.json` explicitly documents the 60-second request ceiling for `app/api/**/*.ts`, which makes the current synchronous model an implementation constraint, not a theoretical risk.

### What is missing

- No persisted operation/job table for queued, running, succeeded, failed, or resumable work.
- No lease or claim mechanism for multi-instance-safe execution.
- No idempotency contract for export/draft/revise/review operations beyond route-level retries and optimistic draft timestamps.
- No distributed burst limiter; only quota is persistent.
- No operation status polling/read model for the browser.
- No durable export artifact metadata or binary retrieval route.
- No worker/runner harness for continuing queued work outside the initiating request.

### Requirement status by codebase reality

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| OPS-01 | Missing | All long-running generation and export work is request-bound and capped by route timeout |
| OPS-02 | Partial | Daily quota is persisted, but burst limiting is process-local and non-distributed |
| OPS-03 | Partial | Compare/accept has resumable semantics, but long-running generation/export work lacks durable retries and idempotent side-effect guards |
| UX-03 | Missing | Export still returns base64 JSON and requires browser-side decode before download |

## Standard Stack

Registry verification was not available during this repo-local planning pass. Versions below are repo-pinned or directly evidenced in the workspace.

### Core

| Library / Module | Version | Purpose | Why Standard Here |
|------------------|---------|---------|-------------------|
| Next.js | `14.2.0` | Route handlers and browser workspace | Existing API surface and UI already depend on it |
| React | `18.2.0` | Generate workspace UI | Current polling/status/download UX belongs here until Phase 5 |
| Supabase Postgres/Auth | `@supabase/supabase-js` `2.99.3`, `@supabase/ssr` `0.9.0` | Auth, persistence, RLS-backed state | Existing durable system boundary for drafts, versions, quota, and future operation records |
| `lib/official-document-workflow.ts` | repo module | Business logic for long-running document workflows | Correct layer to reuse from workers instead of duplicating AI logic in routes |
| `lib/collaborative-store.ts` | repo module | Authoritative draft/version persistence | Correct place to add operation-aware persistence helpers and stale-result protection |

### Supporting

| Library / Module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `node:test` | runtime baseline | Contract and integration tests | For operation schema, queue state, limiter, and download-contract proof |
| `@playwright/test` | `1.58.2` | Browser-level proof | For async progress/polling/export readiness flows |
| `docx` | `9.6.1` | DOCX buffer generation | Keep the existing generator; change delivery semantics around it |
| `lib/api.ts` | repo module | Structured logs and error shaping | Extend with operation id, attempt, lease owner, and export artifact metadata |

## Recommended Durable Operation Contracts

### Pattern 1: Add a dedicated operation record instead of overloading `pending_change`

**What:** Introduce a new persisted operation table for long-running server work.

**Recommended shape:**

```ts
type DraftOperation = {
  id: string;
  user_id: string;
  draft_id: string | null;
  operation_type: 'draft_generate' | 'draft_regenerate' | 'draft_revise' | 'review' | 'export';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  idempotency_key: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
```

**When to use:** All long-running generation/review/export flows in this phase.

**Why:** `pending_change` is already the persisted compare/accept contract for short-lived user decisions. Reusing it for worker lifecycle would blur responsibilities and make resumability harder to reason about.

### Pattern 2: Persist export artifacts as server-owned metadata, not JSON payload bytes

**What:** Store export job output metadata separately from the route response and deliver the final file through a binary response path.

**Recommended shape:**

```ts
type ExportArtifact = {
  id: string;
  operation_id: string;
  user_id: string;
  draft_id: string | null;
  file_name: string;
  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  storage_path: string;
  byte_size: number;
  created_at: string;
  expires_at: string | null;
};
```

**When to use:** UX-03 and export resumability.

**Why:** A queued export needs a durable retrieval path after completion. Streaming a single synchronous response removes base64 inflation, but durable retries also need a place to keep the successful export artifact between requests.

### Pattern 3: Make lease-based claiming and idempotency explicit

**What:** The runner should claim a queued operation with a lease token/expiry, heartbeat while running, and finish through a single authoritative completion path.

**When to use:** OPS-01 through OPS-03.

**Why:** This is the minimum distributed coordination needed to survive restarts, duplicate delivery, and multiple instances without inventing a new orchestrator stack.

### Pattern 4: Move burst limiting into Postgres-backed coordination

**What:** Replace the `globalThis` in-memory limiter with a persistent keyed counter/lease table or an atomic Postgres function.

**Recommended rule:** Keep the existing `enforceDailyQuota(...)` posture, but add a second helper for short-window limits keyed by `user_id + action + window`.

**Why:** The repo already trusts Supabase/Postgres for cross-request counting. That is the most brownfield-consistent place to move the limiter.

## Architecture Patterns

### Recommended Project Structure

```text
app/api/
├── ai/draft/route.ts                # enqueue or resolve draft-generation operations
├── ai/revise/route.ts               # enqueue or resolve revise operations
├── ai/review/route.ts               # enqueue or resolve review operations if long-running
├── generate/route.ts                # create export operation or binary download redirect
├── operations/[id]/route.ts         # operation status/read model
├── operations/[id]/download/route.ts # binary artifact delivery for completed exports
└── operations/run/route.ts          # protected runner/claim endpoint if Next routes remain the worker entrypoint
lib/
├── operation-store.ts               # queue persistence, claiming, heartbeat, completion, retry
├── distributed-ratelimit.ts         # Postgres-backed limiter
├── operation-runner.ts              # operation dispatch into official-document-workflow/document-generator
├── official-document-workflow.ts    # existing draft/revise/review logic reused by runner
├── collaborative-store.ts           # authoritative draft/version updates from operation results
├── document-generator.ts            # existing DOCX buffer builder reused by export runner
└── api.ts                           # telemetry fields for operation lifecycle
supabase/migrations/
├── phase_04_operations*.sql         # operation and limiter tables
└── phase_04_export_artifacts*.sql   # artifact metadata if separate from operations
tests/phase-04/
├── contracts/                       # schema and route contracts
├── ops/                             # claim/retry/idempotency integration tests
├── telemetry/                       # operation logging contracts
└── e2e/                             # browser proof for async progress + export download
```

### Pattern 1: Routes should enqueue first, not perform long work inline

**What:** Draft/revise/review/export routes validate/authenticate/authorize, create or reuse an idempotent operation record, then return an operation handle immediately.

**When to use:** Every operation expected to exceed a safe request window or require resumability.

**Why:** This narrows route responsibilities and makes timeouts/retries operational rather than user-visible failures.

### Pattern 2: Operation completion must own all durable side effects

**What:** Only the worker completion path should persist the final draft mutation, version snapshot, review state, document row, and artifact metadata.

**When to use:** OPS-03.

**Why:** This is the cleanest way to prevent duplicate side effects from retries or double submission.

### Pattern 3: Browser should poll operation status, not hold the long-running request open

**What:** `app/generate/page.tsx` should transition from “await final payload” to “start operation, poll status, hydrate final result when complete.”

**When to use:** Draft/revise/export flows that move async in this phase.

**Why:** This removes coupling between user connection stability and operation success without forcing the full Phase 5 UI refactor now.

## Validation Architecture

Phase 4 needs more than lint/build proof. It changes execution semantics, so validation must prove queue/idempotency behavior, multi-instance-safe coordination, and binary export delivery.

**Recommended validation stack:**

- `node:test` contract tests for operation schemas, route payloads, status read models, and binary download headers
- local Supabase-backed integration tests for claim/lease/retry/idempotency behavior
- seeded Playwright proof for async progress, completion refresh, and export download wiring
- `npm run build` to guard App Router/client integration regressions

**Recommended test slices:**

1. Operation foundation contracts
   - operation schema normalization
   - idempotency key reuse behavior
   - status transition guards
2. Coordination and limiter proof
   - lease claim/heartbeat/expiry behavior
   - retry after stale lease
   - Postgres-backed short-window rate limit enforcement
3. Async route adoption proof
   - enqueue responses from draft/revise/review/export routes
   - authoritative draft mutation only on completion
   - duplicate-completion protection
4. Export hardening proof
   - completed export returns binary/stream response or durable artifact download route
   - no `file_data` base64 JSON in final export contract
   - seeded browser flow can download without `atob(...)`

**Wave recommendation for planning:** put the operation schema/test harness and distributed limiter in Wave 1 so later async-route and browser plans build on stable primitives instead of faking the queue.

## Recommended Plan Slices

### Slice 1: Durable operation foundation

- Add Postgres schema and shared TS contracts for operations, statuses, idempotency, and export artifacts
- Add `lib/operation-store.ts` and Phase 4 contract harness/tests
- Preserve current synchronous behavior until the queue contract is proven

### Slice 2: Distributed coordination and limiter hardening

- Replace `lib/ratelimit.ts` process-local map with persistent coordination
- Add lease claim/heartbeat/expiry semantics
- Add idempotent completion helpers and retry policies

### Slice 3: Async generation/revise/review adoption

- Convert the highest-risk long-running AI routes to enqueue + poll flows
- Reuse existing workflow functions from `lib/official-document-workflow.ts`
- Update `app/generate/page.tsx` only where needed to handle operation status/progress

### Slice 4: Export delivery and browser hardening

- Replace base64 JSON export payload with binary download or durable artifact retrieval
- Ensure export operation completion owns `documents` insert, `drafts` stage update, and version snapshot creation exactly once
- Extend seeded browser proof to cover async export readiness and binary delivery

## Key Risks and Mitigations

| Risk | Why It Matters | Mitigation |
|------|----------------|------------|
| Mixing queue lifecycle into `pending_change` | Collides short-lived compare UX with long-running server execution | Keep a separate operation model and leave `pending_change` focused on compare/accept |
| Duplicating side effects on retry | Could create duplicate version snapshots or export rows | Make completion idempotent and keyed by operation record |
| Over-refactoring `app/generate/page.tsx` during ops work | Increases Phase 4 scope and overlaps Phase 5 | Limit UI work to operation status/download handling only |
| Introducing a queue without executable proof | Easy to hand-wave, hard to trust | Put operation contracts and local Supabase-backed lease tests in Wave 1 |
| Keeping export synchronous while only removing base64 | Solves UX-03 partially but misses OPS-01/OPS-03 | Plan export on the same durable-ops backbone as generation |

