---
phase: 03-grounded-drafting-and-review-trust
plan: 01
subsystem: trust-contract-foundation
tags: [node:test, zod, supabase, restore, provenance]
provides:
  - Phase 3 repo-local contract scripts and harness wiring
  - Shared trust fixtures and helper wrappers for later route contracts
  - Additive provenance and review-state schemas
  - Draft/version normalization plus restore compare helpers for trust metadata
  - Explicit `review_state jsonb` migration for drafts and version snapshots
affects: [03-02 grounded draft provenance, 03-03 review freshness, 03-04 preview-first acceptance]
tech-stack:
  added: []
  patterns: [Node built-in contract runner, additive JSONB persistence, route-neutral compare preview helpers]
key-files:
  created: [tests/phase-03/contracts/shared-fixtures.ts, tests/phase-03/contracts/trust-contract-helpers.ts, tests/phase-03/contracts/provenance-persistence-contract.test.ts, tests/phase-03/contracts/change-candidate-contract.test.ts, supabase/migrations/20260327173000_phase_03_review_state_jsonb.sql]
  modified: [package.json, lib/validation.ts, lib/collaborative-store.ts, lib/version-restore.ts, .planning/STATE.md, tasks/todo.md]
requirements-completed: [TRUST-01, TRUST-02, TRUST-04, TRUST-05]
completed: 2026-03-27
---

# Phase 3 Plan 1 Summary

## Outcome

Built the provider-free Phase 3 trust foundation before any route or UI behavior changed. The codebase now has explicit provenance schemas, persisted review freshness contracts, additive draft/version normalization, and restore preview helpers that expose changed versus unchanged sections.

## Verification

- `node --experimental-strip-types --test tests/phase-03/contracts/shared-fixtures.ts`
- `rg -n "test:phase-03:contracts" package.json`
- `node --experimental-strip-types --test tests/phase-03/contracts/provenance-persistence-contract.test.ts tests/phase-03/contracts/change-candidate-contract.test.ts`

## Key Decisions

- Reused the Phase 2 route-loading helper pattern through a thin Phase 3 wrapper instead of introducing a second contract harness.
- Kept provenance and review freshness additive to the existing section JSON and draft/version records rather than rewriting the collaborative store shape.
- Added route-neutral restore candidate helpers now so later preview-first route work can share one diff contract.

## Files

- `package.json` adds Phase 3 harness, foundation, and suite commands on the existing `node:test` runner.
- `lib/validation.ts` defines provenance, review-state, and candidate accept/reject schemas.
- `lib/collaborative-store.ts` now normalizes and persists `review_state` plus section provenance on drafts and versions.
- `lib/version-restore.ts` now builds explicit restore preview payloads with changed and unchanged section ids.
- `supabase/migrations/20260327173000_phase_03_review_state_jsonb.sql` adds `review_state jsonb` to `drafts` and `document_versions`.
- `tests/phase-03/contracts/` introduces deterministic fixtures, helper wrappers, and foundation contract coverage.

## Next

Wave 2 can now build grounded drafting and review freshness on top of a stable trust contract instead of implicit JSON assumptions.
