---
phase: 02-verification-and-telemetry-baseline
plan: 03
subsystem: browser-smoke
tags: [playwright, e2e, seeded-fixtures, supabase, nextjs]
requires:
  - phase: 02-verification-and-telemetry-baseline
    provides: SAFE-02 local Supabase seed/auth baseline and deterministic fixture ids
provides:
  - Seeded Playwright config and auth bootstrap for local `/generate` smoke coverage
  - Repo-local browser install/seed/test commands for SAFE-03 maintainers
  - Deterministic review/export readiness proof on real seeded data without provider calls
affects: [phase-02 local verification, generate hydration confidence, brownfield browser diagnostics]
tech-stack:
  added: [Playwright Test]
  patterns: [scenario-file seed output, local Supabase env override for webServer, authenticated storage-state bootstrap]
key-files:
  created: [playwright.config.ts, tests/e2e/global-setup.ts, tests/e2e/generate-smoke.spec.ts]
  modified: [package.json, package-lock.json, scripts/seed-phase-2.mjs]
key-decisions:
  - "Reuse the Phase 2 seed harness and write a `.tmp/phase-02-e2e.json` scenario file instead of creating a second browser-only fixture path."
  - "Override `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` inside Playwright `webServer.env` so the local Next server talks to Docker-backed Supabase instead of hosted `.env.local` settings."
  - "Keep SAFE-03 selectors anchored to visible workflow labels and seeded content; no new `data-testid` hooks were needed."
patterns-established:
  - "Local browser smoke should prove hydrate/review/export readiness only and must avoid clicking live provider actions."
  - "In this environment, Docker-backed seeding and Playwright webServer port binding both require sandbox-free execution."
requirements-completed: [SAFE-03]
duration: 26 min
completed: 2026-03-27
---

# Phase 2 Plan 3: SAFE-03 Browser Smoke Summary

**Seeded Playwright smoke that signs in with a real local Supabase user, opens `/generate?draft=...`, and proves review/export readiness without live AI traffic**

## Performance

- **Duration:** 26 min
- **Started:** 2026-03-27T01:10:36+0800
- **Completed:** 2026-03-27T01:36:58+0800
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added repo-local SAFE-03 commands to seed the browser scenario, install Chromium, and run a single seeded Playwright smoke.
- Extended the Phase 2 seed harness to emit `.tmp/phase-02-e2e.json` containing local Supabase public env, Alice credentials, and the review-ready draft path.
- Added a Playwright config plus global login bootstrap that persists authenticated storage state against the local Next server.
- Added one Chromium smoke spec that proves `/generate` hydrates the seeded draft, shows version history, lands in review, and exposes the Word export affordance without triggering provider routes.

## Verification Evidence

- `npm run test:phase-02:rls:reset`
- `npm run test:phase-02:e2e:seed`
- `npm run test:phase-02:e2e:install`
- `npm run build`
- `npm run test:phase-02:e2e`

## Files Created/Modified

- `package.json` - Adds explicit SAFE-03 seed, browser-install, and smoke commands.
- `package-lock.json` - Captures deterministic Playwright dependency resolution.
- `scripts/seed-phase-2.mjs` - Emits the reusable `.tmp/phase-02-e2e.json` scenario and keeps seeded draft data aligned with the real `/generate` page shape.
- `playwright.config.ts` - Wires Chromium, storage state, local web server env overrides, and the SAFE-03 global setup.
- `tests/e2e/global-setup.ts` - Signs in the seeded user through the real login page and persists session state.
- `tests/e2e/generate-smoke.spec.ts` - Proves seeded `/generate` hydration, review readiness, version-history visibility, and export affordance availability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Normalized seeded attachment shape to match the current generate workspace**
- **Found during:** SAFE-03 browser verification
- **Issue:** The seeded draft stored attachments as `{ name }` objects, but the current `/generate` page renders attachments as strings, causing a production React render failure in the smoke run.
- **Fix:** Update the Phase 2 seed harness to store attachment names as string arrays for seeded browser coverage.
- **Files modified:** `scripts/seed-phase-2.mjs`
- **Verification:** `npm run test:phase-02:e2e:seed`, `npm run test:phase-02:e2e`

**2. [Rule 3 - Blocking] Aligned the smoke expectation with the actual preview title source**
- **Found during:** SAFE-03 browser verification
- **Issue:** The smoke asserted the draft metadata title, but the preview pane correctly renders `generated_title`, so the expectation was mismatched even though hydration succeeded.
- **Fix:** Record the preview title in the seeded scenario file and assert against that visible value.
- **Files modified:** `scripts/seed-phase-2.mjs`, `tests/e2e/generate-smoke.spec.ts`
- **Verification:** `npm run test:phase-02:e2e:seed`, `npm run test:phase-02:e2e`

## Issues Encountered

- Docker socket access is required here for seed commands that inspect the local Supabase stack.
- The Playwright smoke must run outside the sandbox in this environment because `next start` needs to bind `127.0.0.1:3000`.
- `NO_COLOR` warnings from the spawned Next/Playwright processes are noisy but non-blocking.

## User Setup Required

- Docker Desktop must be running before SAFE-03 seed or smoke commands are executed.
- Chromium should be installed once via `npm run test:phase-02:e2e:install` on fresh environments.

## Next Phase Readiness

- SAFE-03 is complete, so all four Phase 2 safety baselines are now green.
- Phase 3 can build on a real local browser proof for the generate workspace instead of relying only on route/unit coverage.

## Self-Check: PASSED

- Found `.planning/phases/02-verification-and-telemetry-baseline/02-03-SUMMARY.md` on disk.
- Verified `npm run test:phase-02:rls:reset`, `npm run test:phase-02:e2e:seed`, `npm run test:phase-02:e2e:install`, `npm run build`, and `npm run test:phase-02:e2e` all passed.
