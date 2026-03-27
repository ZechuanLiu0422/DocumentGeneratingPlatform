---
phase: 03-grounded-drafting-and-review-trust
plan: 04
subsystem: compare-before-accept
tags: [pending-change, restore, revise, regenerate, seeded-playwright, contracts]
provides:
  - Preview-first regenerate, revise, and restore route contracts with explicit accept/reject decisions
  - Authoritative `drafts.pending_change` lifecycle with user binding, expiry, and stale-base protection
  - Narrow compare/accept UI for trusted before/after review in `/generate`
  - Provider-free seeded browser proof for restore compare, reject, and accept flows
affects: [Phase 03 execution closeout, review freshness flow, seeded browser harness]
tech-stack:
  added: [drafts.pending_change jsonb migration]
  patterns: [preview-first candidate contract, accepted-snapshot stale detection, deterministic seeded browser proof]
key-files:
  created: [.planning/phases/03-grounded-drafting-and-review-trust/03-04-SUMMARY.md, supabase/migrations/20260327180000_phase_03_pending_change_jsonb.sql, tests/phase-03/contracts/acceptance-route-contract.test.ts]
  modified: [app/api/ai/draft/route.ts, app/api/ai/revise/route.ts, app/api/ai/versions/restore/route.ts, app/generate/page.tsx, lib/api.ts, lib/collaborative-store.ts, lib/draft-save.ts, lib/generate-workspace.ts, lib/validation.ts, lib/version-restore.ts, package.json, playwright.config.ts, scripts/seed-phase-2.mjs, tests/e2e/generate-smoke.spec.ts, tests/e2e/global-setup.ts, tests/phase-03/contracts/grounded-draft-route-contract.test.ts, .planning/STATE.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/phases/03-grounded-drafting-and-review-trust/03-VALIDATION.md, tasks/todo.md]
requirements-completed: [TRUST-04, TRUST-05]
completed: 2026-03-27
---

# Phase 3 Plan 4 Summary

## Outcome

Regenerate, revise, and restore no longer overwrite accepted content immediately. Each action now creates a preview candidate, persists it in `drafts.pending_change`, and requires an explicit accept or reject decision before the accepted draft changes.

## Verification

- `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-03/contracts/acceptance-route-contract.test.ts`
- `npm run test:phase-03:contracts`
- `node --experimental-strip-types --test tests/phase-03/telemetry/trust-route-telemetry.test.ts`
- `npm run build`
- `npm run test:phase-03:e2e`

## Key Decisions

- Kept `drafts.pending_change jsonb` as the only persisted preview-state mechanism instead of echoing full candidate payloads through the client.
- Treated a candidate as still fresh when the accepted draft snapshot still matches `pending_change.before`, even if a database `updated_at` trigger rewrites the timestamp.
- Forced Phase 3 Playwright proof to seed before every run and use a dedicated high port so browser verification cannot reuse stale local servers or mutated drafts.

## Files

- `app/api/ai/draft/route.ts`, `app/api/ai/revise/route.ts`, and `app/api/ai/versions/restore/route.ts` now implement preview/accept/reject contracts with candidate binding, stale detection, and explicit clear-on-reject rules.
- `lib/version-restore.ts`, `lib/collaborative-store.ts`, `lib/draft-save.ts`, `lib/generate-workspace.ts`, and `lib/validation.ts` now normalize pending-change state, compare accepted snapshots, and hydrate preview state back into the workspace.
- `app/generate/page.tsx` now exposes a compare panel with explicit accept/reject actions while preserving the existing trusted workspace structure.
- `tests/phase-03/contracts/acceptance-route-contract.test.ts` and `tests/e2e/generate-smoke.spec.ts` lock the route and browser semantics for preview-first trust behavior.

## Deviations Fixed During Execution

- Local Supabase rewrites `drafts.updated_at` on update, which broke exact timestamp matching for restore acceptance. The final contract compares the accepted snapshot against `pending_change.before` before rejecting a candidate as stale.
- Existing Playwright runs were reusing occupied local ports and mutated seeded drafts. The final harness now seeds before every run and starts a fresh server on an isolated test port.

## Next

Phase 03 is now complete. The next planning target is Phase 04, which can build on authoritative accepted-content, review freshness, and compare-before-accept trust contracts.
