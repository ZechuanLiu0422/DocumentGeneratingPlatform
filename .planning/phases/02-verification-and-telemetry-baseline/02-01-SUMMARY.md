---
phase: 02-verification-and-telemetry-baseline
plan: 01
subsystem: testing
tags: [node:test, nextjs, contracts, ci, route-handlers]
requires:
  - phase: 01-workflow-integrity-guardrails
    provides: Authoritative workflow-stage handling and Phase 1 node:test contract patterns
provides:
  - Repo-local SAFE-01 contract scripts on the existing node:test runner
  - CI workflow wiring for the Phase 2 contract baseline
  - Shared fixtures and direct route-loader helpers for staged workflow contract tests
  - Validation, persistence, and workflow route contract coverage for SAFE-01
affects: [02-02 auth-rls harness, 02-03 browser smoke, 02-04 telemetry baseline, phase-02 testing]
tech-stack:
  added: []
  patterns: [Node built-in contract runner, rewritten temp-module loading for App Router route tests, serialized contract execution]
key-files:
  created: [.github/workflows/phase-02-safety.yml, tests/phase-02/contracts/shared-fixtures.ts, tests/phase-02/contracts/route-contract-helpers.ts, tests/phase-02/contracts/harness-smoke.test.ts, tests/phase-02/contracts/validation-contract.test.ts, tests/phase-02/contracts/persistence-contract.test.ts, tests/phase-02/contracts/workflow-route-contract.test.ts]
  modified: [package.json]
key-decisions:
  - "Keep SAFE-01 on node:test and extend the existing Phase 1 runner instead of adding Vitest or Jest."
  - "Load App Router route handlers through rewritten temp .ts modules under .tmp so tests can resolve next/server and @/* imports without changing production code."
  - "Run the SAFE-01 contract suite with --test-concurrency=1 because the route-loader helper uses scoped global mocks that need deterministic execution."
patterns-established:
  - "Phase 2 contract tests use shared deterministic fixtures instead of inline payload objects."
  - "Route contracts invoke exported POST handlers directly and stub only external boundaries."
requirements-completed: [SAFE-01]
duration: 24 min
completed: 2026-03-26
---

# Phase 2 Plan 1: SAFE-01 Contract Baseline Summary

**Node:test SAFE-01 baseline covering validation schemas, persistence shaping, and staged workflow route contracts with CI wiring**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-26T15:24:51Z
- **Completed:** 2026-03-26T15:49:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added repo-local `node:test` scripts and a dedicated GitHub Actions workflow for the Phase 2 SAFE-01 suite.
- Built reusable shared fixtures and route-loading helpers so Phase 2 tests can invoke real route handlers without booting Next.js or calling live providers.
- Added executable contract coverage for request validation, persistence normalization, and direct workflow/export route behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the reusable `node:test` contract harness for Phase 2** - `e10f925` (test), `67d8a5e` (feat)
2. **Task 2: Prove validation, persistence, and workflow route contracts with executable tests** - `0e89958` (test), `513bad0` (feat)

## Files Created/Modified
- `package.json` - Adds SAFE-01 local, harness, and CI contract commands on the existing node runner.
- `.github/workflows/phase-02-safety.yml` - Runs the SAFE-01 contract suite on push and pull request changes.
- `tests/phase-02/contracts/shared-fixtures.ts` - Centralizes deterministic request and stored-row fixtures for Phase 2 contracts.
- `tests/phase-02/contracts/route-contract-helpers.ts` - Loads route handlers through rewritten temp modules and provides JSON request builders.
- `tests/phase-02/contracts/harness-smoke.test.ts` - Proves the scripts, CI wiring, fixtures, and route helper surface are wired correctly.
- `tests/phase-02/contracts/validation-contract.test.ts` - Verifies core schema acceptance and rejection cases for workflow and export payloads.
- `tests/phase-02/contracts/persistence-contract.test.ts` - Verifies draft/version normalization and `saveDraftState(...)` shaping behavior.
- `tests/phase-02/contracts/workflow-route-contract.test.ts` - Verifies unauthorized, validation, and success-shape contracts across staged AI routes and export.

## Decisions Made

- Reused the existing `node --experimental-strip-types --test` approach from Phase 1 rather than introducing a second test framework.
- Encoded route-handler loading in test helpers instead of changing production route imports solely for testability.
- Serialized the SAFE-01 suite for deterministic mock behavior instead of adding a broader mocking library.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added rewritten temp-module loading for route and library imports**
- **Found during:** Task 1 and Task 2
- **Issue:** Node ESM could not resolve bare `next/server` or `@/*` imports when contract tests imported route handlers directly.
- **Fix:** Added `route-contract-helpers.ts` logic that rewrites route and library imports into temp `.ts` modules under `.tmp`, preserving real handler behavior while keeping tests on `node:test`.
- **Files modified:** `tests/phase-02/contracts/route-contract-helpers.ts`
- **Verification:** `npm run test:phase-02:contracts:harness`, `npm run test:phase-02:contracts`
- **Committed in:** `67d8a5e`, `513bad0`

**2. [Rule 3 - Blocking] Serialized SAFE-01 test execution to avoid mock cache races**
- **Found during:** Task 2
- **Issue:** The route mock registry could produce stale auth/module bindings when `node:test` ran files concurrently.
- **Fix:** Added `--test-concurrency=1` to the Phase 2 contract scripts.
- **Files modified:** `package.json`
- **Verification:** `npm run test:phase-02:contracts`
- **Committed in:** `513bad0`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required to keep SAFE-01 on the planned brownfield runner without introducing a new framework or changing production route code.

## Issues Encountered

- Direct route imports initially failed under Node ESM because the app code uses bare `next/server` and `@/*` aliases that are valid in Next.js but not in raw Node resolution. This was resolved inside the test helper layer.
- The contract runner emits `MODULE_TYPELESS_PACKAGE_JSON` warnings for `.ts` tests. These warnings do not fail the suite or build and were left unchanged for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SAFE-01 is complete and running in CI with one repo-local entrypoint.
- The shared Phase 2 fixture and route-loader utilities are ready for `02-02` and `02-03` to reuse.
- No blocker remains for Phase 2 Plan 02.

## Self-Check: PASSED

- Found `.planning/phases/02-verification-and-telemetry-baseline/02-01-SUMMARY.md` on disk.
- Verified task commits `e10f925`, `67d8a5e`, `0e89958`, and `513bad0` exist in git history.
