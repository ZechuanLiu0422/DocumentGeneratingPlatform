---
phase: 02-verification-and-telemetry-baseline
plan: 02
subsystem: auth-rls
tags: [supabase, rls, local-dev, seeded-fixtures, node:test]
requires:
  - phase: 02-verification-and-telemetry-baseline
    provides: SAFE-01 contract baseline and repo-local Phase 2 test commands
provides:
  - Deterministic local Supabase reset/seed scripts for SAFE-02 and SAFE-03
  - Real authenticated anon-client helpers for seeded Phase 2 users
  - Executable multi-user RLS regression coverage across the core drafting tables
affects: [02-03 browser smoke seed flow, phase-02 local verification, supabase local auth config]
tech-stack:
  added: [supabase CLI repo-local scripts]
  patterns: [local Supabase env discovery, service-role setup with anon-client proof, deterministic seeded fixture ids]
key-files:
  created: [scripts/seed-phase-2.mjs, tests/phase-02/auth-rls/supabase-auth-helpers.ts, tests/phase-02/auth-rls/auth-rls.test.ts]
  modified: [package.json, package-lock.json, supabase/config.toml, .gitignore]
key-decisions:
  - "Derive local Supabase URL and keys from `npx supabase status -o env` so SAFE-02 always targets the local Docker stack instead of hosted `.env.local` settings."
  - "Keep service-role access confined to deterministic fixture setup; all SAFE-02 assertions run through authenticated anon clients subject to real RLS."
  - "Enable local email auth in `supabase/config.toml` because seeded password login is required proof for SAFE-02."
patterns-established:
  - "Phase 2 seeded users and fixture ids are shared artifacts that later SAFE-03 browser smoke can reuse."
  - "Local Supabase verification should restart the full stack after auth-config changes so new `GOTRUE_*` settings take effect."
requirements-completed: [SAFE-02]
duration: 63 min
completed: 2026-03-27
---

# Phase 2 Plan 2: SAFE-02 Auth/RLS Summary

**Local Supabase auth/RLS harness that proves seeded users cannot read, update, or delete each other's drafting data through real authenticated anon clients**

## Performance

- **Duration:** 63 min
- **Started:** 2026-03-26T15:52:09Z
- **Completed:** 2026-03-27T00:55:21+0800
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added repo-local SAFE-02 commands to reset, seed, and run a local Supabase RLS regression suite.
- Built a deterministic seed harness with two fixed users plus stable rows across `drafts`, `document_versions`, `documents`, `writing_rules`, `reference_assets`, `contacts`, `common_phrases`, and `usage_events`.
- Added auth helpers and executable node:test coverage that prove self-owned access works while cross-user reads and draft mutations are blocked by real RLS.
- Enabled local email auth in Supabase config so seeded password sign-in works against the local auth boundary.

## Verification Evidence

- `npm run test:phase-02:rls:reset`
- `npm run test:phase-02:rls:seed`
- `npm run test:phase-02:rls`
- `npm run check:schema`
- `curl -s http://127.0.0.1:54321/auth/v1/settings`

## Files Created/Modified

- `package.json` - Adds explicit repo-local SAFE-02 start/reset/seed/test commands.
- `package-lock.json` - Captures deterministic lockfile state for the repo-local Supabase CLI workflow.
- `supabase/config.toml` - Enables local email auth so seeded password sign-in works for SAFE-02 proof.
- `scripts/seed-phase-2.mjs` - Seeds deterministic users and fixture rows, and discovers local Supabase env from CLI output.
- `tests/phase-02/auth-rls/supabase-auth-helpers.ts` - Signs in seeded users through local auth and returns authenticated anon clients.
- `tests/phase-02/auth-rls/auth-rls.test.ts` - Proves read/update/delete isolation and self-owned access.
- `.gitignore` - Ignores local Supabase runtime artifacts created during SAFE-02 verification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Normalized quoted values from `supabase status -o env`**
- **Found during:** Task 1 verification
- **Issue:** The CLI returns quoted env values, which produced an invalid `supabaseUrl` when the seed harness parsed `API_URL`.
- **Fix:** Strip wrapping quotes while parsing CLI env output in the shared seed helper.
- **Files modified:** `scripts/seed-phase-2.mjs`
- **Verification:** `npm run test:phase-02:rls:seed`

**2. [Rule 3 - Blocking] Re-enabled local email auth and restarted the full Supabase stack**
- **Found during:** Task 2 verification
- **Issue:** Local auth returned `Email logins are disabled`, so anon-client password sign-in could not prove RLS against the real auth boundary.
- **Fix:** Enable signup/email auth in `supabase/config.toml`, stop the local stack, restart it, and confirm `/auth/v1/settings` reports `external.email: true`.
- **Files modified:** `supabase/config.toml`
- **Verification:** `npx supabase stop --no-backup`, `npm run test:phase-02:rls:reset`, `curl -s http://127.0.0.1:54321/auth/v1/settings`, `npm run test:phase-02:rls`

## Issues Encountered

- Docker socket access is required in this environment for commands that inspect or control the local Supabase stack.
- `npm run check:schema` targets the configured hosted Supabase project from `.env.local`, so it required network-enabled execution in this environment even though SAFE-02 proof stayed local.
- Node still emits `MODULE_TYPELESS_PACKAGE_JSON` warnings for `.ts` test files; the warnings are noisy but non-blocking.

## User Setup Required

- Docker Desktop must be running before SAFE-02 local verification commands are executed.

## Next Phase Readiness

- SAFE-02 is complete and provides a reusable seeded local Supabase baseline for SAFE-03 browser smoke tests.
- No blocker remains for Phase 2 Plan 04.

## Self-Check: PASSED

- Found `.planning/phases/02-verification-and-telemetry-baseline/02-02-SUMMARY.md` on disk.
- Verified `npm run test:phase-02:rls:reset`, `npm run test:phase-02:rls:seed`, `npm run test:phase-02:rls`, and `npm run check:schema` all passed.
