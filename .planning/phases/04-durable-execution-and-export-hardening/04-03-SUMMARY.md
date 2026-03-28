---
phase: 04-durable-execution-and-export-hardening
plan: 03
subsystem: operations
tags: [durable-operations, async-routes, polling, telemetry, nextjs]
requires:
  - phase: 04-durable-execution-and-export-hardening
    provides: durable operation schema, lease-safe coordination, protected runner path
provides:
  - Durable draft and revise enqueue contracts backed by operation handles
  - Operation-status read model with completed draft hydration for browser resume
  - Narrow `/generate` polling and refresh-safe operation recovery
affects: [04-04, durable-operations, generate-workspace, telemetry]
tech-stack:
  added: [operation status route]
  patterns: [queued route contracts, localStorage-backed resume polling, shared lifecycle telemetry]
key-files:
  created:
    - app/api/operations/[id]/route.ts
    - tests/phase-04/contracts/async-draft-route-contract.test.ts
    - tests/phase-04/contracts/async-revise-route-contract.test.ts
    - tests/phase-04/contracts/operation-status-route-contract.test.ts
    - tests/phase-04/telemetry/operation-route-telemetry.test.ts
  modified:
    - app/api/ai/draft/route.ts
    - app/api/ai/revise/route.ts
    - app/generate/page.tsx
    - lib/collaborative-store.ts
    - lib/official-document-workflow.ts
    - lib/operation-runner.ts
    - lib/operation-store.ts
    - lib/validation.ts
    - package.json
key-decisions:
  - "Keep queued draft/revise completion authoritative in the runner path and expose read-model hydration through a separate status route instead of reusing the enqueue response."
  - "Use per-draft localStorage operation tracking in `/generate` as the narrowest refresh-safe resume mechanism until Phase 5 decomposes the workspace."
patterns-established:
  - "Async route adoption lands as queued contract tests first, then authoritative runner reuse, then browser polling against a stable status read model."
  - "Operation lifecycle metadata continues to flow through `lib/api.ts` instead of adding route-specific logging formats."
requirements-completed: [OPS-01, OPS-03]
duration: 10 min
completed: 2026-03-28
---

# Phase 04 Plan 03: Async Route and Status Resume Summary

**Durable draft and revise operation handles, browser polling, and refresh-safe status hydration on the existing generate workspace**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-28T04:49:09Z
- **Completed:** 2026-03-28T04:59:28Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Moved long-running draft and revise route work onto durable operation handles while reusing the existing workflow layer and authoritative completion helpers.
- Added [route.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/operations/[id]/route.ts) as the browser-facing operation status read model, including completed draft hydration for async resume.
- Updated [page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) with narrow localStorage-backed polling so queued draft/revise work survives refresh without a broader Phase 5 refactor.

## Task Commits

Each task was committed atomically:

1. **Task 1: Convert draft and revise routes to enqueue durable operations** - `19d3895` (test), `25a4540` (feat)
2. **Task 2: Add operation-status read models, minimal polling UX, and lifecycle telemetry** - `7a32117` (test), `19f3068` (feat)

## Files Created/Modified

- `app/api/ai/draft/route.ts` - returns durable operation handles for full draft generation and section regeneration instead of holding the request open.
- `app/api/ai/revise/route.ts` - returns durable operation handles for preview rewrite work while preserving compare-before-accept semantics.
- `app/api/operations/[id]/route.ts` - exposes queued/running/succeeded/failed operation state plus completed draft hydration for browser resume.
- `app/generate/page.tsx` - stores active operation ids per draft, polls operation status, and rehydrates completed draft/revise results after refresh.
- `lib/operation-runner.ts` - dispatches queued draft/revise work back into the existing workflow layer with typed session-reference handling.
- `lib/collaborative-store.ts` - owns authoritative draft and pending-change persistence on async completion.
- `lib/operation-store.ts` - narrows queued execution results safely for typed completion and supports status reads.
- `lib/validation.ts` - exports the operation insert input type so defaults remain internal to the store boundary.
- `tests/phase-04/contracts/async-draft-route-contract.test.ts` - proves queued full draft and regenerate route semantics.
- `tests/phase-04/contracts/async-revise-route-contract.test.ts` - proves queued revise preview semantics and runner reuse.
- `tests/phase-04/contracts/operation-status-route-contract.test.ts` - proves status read models for queued/running/succeeded/failed states.
- `tests/phase-04/telemetry/operation-route-telemetry.test.ts` - proves lifecycle metadata stays on the shared telemetry path.

## Decisions Made

- The status route returns hydrated draft state only for succeeded draft operations, keeping queued/running/error reads small while giving the browser a single authoritative resume payload.
- Browser resume state is keyed by draft id in localStorage so refresh recovery stays narrow and does not require a server-side session state redesign.
- Type-boundary fixes for operation insert defaults and runner result narrowing landed in the same feature commit because they were required for the new async path to pass build-time validation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Final build verification surfaced three strict TypeScript boundary issues in the new durable-operation path: the operation insert input type was too strict for defaulted fields, session-reference analysis typing was narrower than the route helper contract, and queue-drain result normalization needed explicit narrowing. All three were corrected before closeout.

## User Setup Required

None immediately. The new polling path relies on the existing operation runner configuration already introduced in `04-02`.

## Next Phase Readiness

- `04-04` can now move export onto the same durable operation backbone and reuse the status route plus narrow polling UX already in place on `/generate`.
- Export hardening no longer needs to solve browser resume or lifecycle telemetry from scratch; it can focus on artifact persistence and binary download delivery.

---
*Phase: 04-durable-execution-and-export-hardening*
*Completed: 2026-03-28*

## Self-Check: PASSED

- Found `.planning/phases/04-durable-execution-and-export-hardening/04-03-SUMMARY.md` on disk.
- Verified task commits `19d3895`, `25a4540`, `7a32117`, and `19f3068` in git history.
