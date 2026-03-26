---
phase: 02-verification-and-telemetry-baseline
plan: 04
subsystem: telemetry
tags: [telemetry, health, route-logging, node:test, nextjs]
requires:
  - phase: 02-verification-and-telemetry-baseline
    provides: SAFE-01 route test harness and SAFE-02 local verification baseline
provides:
  - Shared structured telemetry payload builder in `lib/api.ts`
  - Workflow/export route telemetry adoption for the key brownfield AI endpoints
  - Reduced `/api/health` response contract with executable coverage
affects: [02-03 browser smoke diagnostics, operators, route failure triage, health probes]
tech-stack:
  added: []
  patterns: [shared JSON log payload builder, route-level telemetry context attachment, reduced health contract]
key-files:
  created: [tests/phase-02/telemetry/telemetry-contract.test.ts, tests/phase-02/telemetry/workflow-route-telemetry.test.ts, tests/phase-02/telemetry/health-contract.test.ts]
  modified: [lib/api.ts, app/api/health/route.ts, app/api/ai/intake/route.ts, app/api/ai/outline-plan/route.ts, app/api/ai/outline/route.ts, app/api/ai/draft/route.ts, app/api/ai/review/route.ts, app/api/ai/revise/route.ts, app/api/generate/route.ts, package.json]
key-decisions:
  - "Keep SAFE-04 inside the existing `lib/api.ts` JSON logging path instead of adding a vendor telemetry SDK."
  - "Attach workflow/export metadata to the shared request context at the route layer so success and failure logs stay consistent."
  - "Shrink `/api/health` to coarse liveness/degraded checks and stop exposing provider inventory in the response body."
patterns-established:
  - "Phase 2 route telemetry is proven by spying on shared API helpers rather than snapshotting raw console output."
  - "Provider failures are classified from existing `AI_*` error codes through the shared log payload builder."
requirements-completed: [SAFE-04]
duration: 15 min
completed: 2026-03-27
---

# Phase 2 Plan 4: SAFE-04 Telemetry Summary

**Structured workflow/export telemetry and a reduced health contract built on top of the existing `lib/api.ts` JSON logging path**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-27T00:55:21+0800
- **Completed:** 2026-03-27T01:10:36+0800
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Extracted a reusable log payload builder in `lib/api.ts` and added provider-failure classification derived from existing `AI_*` error codes.
- Attached `draft_id`, `doc_type`, `workflow_action`, and `workflow_stage` metadata to the intake, planning, outline, draft, review, revise, and export routes.
- Added export-specific telemetry for file size and reduced `/api/health` to an operator-safe `status + checks` contract.
- Added executable telemetry, route-adoption, and health-contract tests, then verified the app still builds successfully.

## Verification Evidence

- `npm run test:phase-02:telemetry`
- `npm run build`

## Files Created/Modified

- `lib/api.ts` - Adds `buildLogPayload(...)`, provider failure classification, and shared log shaping for route success/failure.
- `app/api/health/route.ts` - Returns a reduced health payload without provider inventory leakage.
- `app/api/ai/intake/route.ts` - Attaches intake telemetry metadata to the shared request context.
- `app/api/ai/outline-plan/route.ts` - Attaches planning telemetry metadata to the shared request context.
- `app/api/ai/outline/route.ts` - Attaches outline telemetry metadata to the shared request context.
- `app/api/ai/draft/route.ts` - Attaches draft telemetry metadata to the shared request context.
- `app/api/ai/review/route.ts` - Attaches review telemetry metadata to the shared request context.
- `app/api/ai/revise/route.ts` - Attaches revise telemetry metadata to the shared request context.
- `app/api/generate/route.ts` - Attaches export telemetry metadata, preserves pre-export stage on failures, and logs export size.
- `package.json` - Adds a repo-local SAFE-04 telemetry test command.
- `tests/phase-02/telemetry/telemetry-contract.test.ts` - Verifies the shared structured log payload shape and provider-failure classification.
- `tests/phase-02/telemetry/workflow-route-telemetry.test.ts` - Verifies key workflow/export routes pass required metadata into the shared logging path.
- `tests/phase-02/telemetry/health-contract.test.ts` - Verifies the reduced `/api/health` response shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reused the existing temp-module route loader for telemetry tests**
- **Found during:** Task 1 red phase
- **Issue:** Direct `node:test` imports of `lib/api.ts` failed because raw Node ESM could not resolve `next/server` the same way Next.js does.
- **Fix:** Reused the existing Phase 2 temp-module import helper so telemetry tests can load `lib/api.ts` and route modules through rewritten import paths.
- **Files modified:** `tests/phase-02/telemetry/telemetry-contract.test.ts`, `tests/phase-02/telemetry/workflow-route-telemetry.test.ts`
- **Verification:** `npm run test:phase-02:telemetry`

**2. [Rule 3 - Blocking] Loaded draft stage before export generation so failure telemetry keeps the active workflow stage**
- **Found during:** Task 2 verification
- **Issue:** Export failures raised before the route fetched draft state, so failure telemetry lacked `workflow_stage`.
- **Fix:** Load the draft earlier in `app/api/generate/route.ts` and attach the current stage to the shared context before export generation begins.
- **Files modified:** `app/api/generate/route.ts`
- **Verification:** `npm run test:phase-02:telemetry`

## Issues Encountered

- `node:test` still emits `MODULE_TYPELESS_PACKAGE_JSON` warnings for `.ts` test files; they remain non-blocking.
- The reduced health contract changed the response shape intentionally, so future callers should not depend on provider inventory being present.

## User Setup Required

None beyond the normal repo dependencies.

## Next Phase Readiness

- SAFE-04 is complete, so Phase 2 Wave 1 is fully closed.
- SAFE-03 can now build on the verified local seed harness and the improved route telemetry for browser-smoke debugging.

## Self-Check: PASSED

- Found `.planning/phases/02-verification-and-telemetry-baseline/02-04-SUMMARY.md` on disk.
- Verified `npm run test:phase-02:telemetry` and `npm run build` both passed.
