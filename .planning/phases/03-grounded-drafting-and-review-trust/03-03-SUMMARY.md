---
phase: 03-grounded-drafting-and-review-trust
plan: 03
subsystem: review-freshness-and-export-gate
tags: [review-route, export-route, telemetry, generate-workspace, contracts]
provides:
  - Deterministic document-type review policy packs with persisted content-hash review state
  - Authoritative export gating against missing or stale `drafts.review_state`
  - Shared telemetry fields for `review_hash` and `review_status`
  - Narrow `/generate` messaging when review must be rerun before export
affects: [03-04 compare/accept flow, exported version trust]
tech-stack:
  added: []
  patterns: [contract-first trust gate, persisted review hash, provider-free route contracts]
key-files:
  created: [.planning/phases/03-grounded-drafting-and-review-trust/03-03-SUMMARY.md, tests/phase-03/contracts/export-review-gate-contract.test.ts, tests/phase-03/contracts/review-policy-contract.test.ts, tests/phase-03/telemetry/trust-route-telemetry.test.ts]
  modified: [app/api/ai/review/route.ts, app/api/generate/route.ts, app/generate/page.tsx, lib/collaborative-store.ts, lib/draft-save.ts, lib/generate-workspace.ts, lib/official-document-workflow.ts, tests/phase-02/contracts/route-contract-helpers.ts, .planning/STATE.md, tasks/todo.md]
requirements-completed: [TRUST-03]
completed: 2026-03-27
---

# Phase 3 Plan 3 Summary

## Outcome

Review is now freshness-aware instead of advisory. The review workflow emits document-type-specific deterministic checks, persists an authoritative `review_state` with a content hash, and export now refuses to run if that persisted review is missing or stale relative to accepted draft content.

## Verification

- `node --experimental-strip-types --test tests/phase-03/contracts/review-policy-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-03/contracts/export-review-gate-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-03/telemetry/trust-route-telemetry.test.ts`
- `npm run build`

## Key Decisions

- Kept deterministic review checks ahead of AI augmentation so trust-critical coverage does not depend on provider behavior.
- Treated `drafts.review_state` as the only freshness source for export; client-submitted content no longer defines trust eligibility.
- Extended the existing Phase 2 route test helper so direct module imports can rewrite nested project aliases without touching production code.

## Files

- `lib/official-document-workflow.ts` now exports deterministic policy-pack checks, review-hash computation, and persisted review-state shaping.
- `app/api/ai/review/route.ts` now saves `review_state`, snapshots it with accepted review versions, returns it to the client, and logs trust metadata.
- `app/api/generate/route.ts` now blocks export on missing/stale review state before document generation and carries review telemetry on both success and failure.
- `app/generate/page.tsx`, `lib/draft-save.ts`, and `lib/generate-workspace.ts` now preserve and surface narrow review freshness messaging in the existing workspace.
- `tests/phase-03/contracts/*.test.ts` and `tests/phase-03/telemetry/trust-route-telemetry.test.ts` lock the new review/export trust contract.

## Next

`03-04` can now build preview-first compare/accept flows on top of authoritative accepted draft content and review freshness.
