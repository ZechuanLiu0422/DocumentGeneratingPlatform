---
phase: 03-grounded-drafting-and-review-trust
plan: 02
subsystem: grounded-drafting-and-provenance
tags: [draft-route, provenance, references, generate-workspace, build]
provides:
  - Section-level evidence selection for full and section draft generation
  - Route-level protection against claiming grounding with no approved evidence context
  - Narrow provenance rendering inside the existing `/generate` draft, review, and preview surfaces
  - Provenance-aware draft hydration types that preserve trust metadata on the client
affects: [03-03 review freshness, 03-04 compare/accept UI]
tech-stack:
  added: []
  patterns: [heuristic evidence selection, additive provenance UI, contract-first route enforcement]
key-files:
  created: [tests/phase-03/contracts/grounded-draft-route-contract.test.ts, tests/phase-03/contracts/provenance-read-model-contract.test.ts]
  modified: [app/api/ai/draft/route.ts, app/generate/page.tsx, lib/generate-workspace.ts, lib/official-document-workflow.ts, lib/validation.ts, tests/phase-03/contracts/shared-fixtures.ts, tsconfig.json, .planning/STATE.md, tasks/todo.md]
requirements-completed: [TRUST-01, TRUST-02]
completed: 2026-03-27
---

# Phase 3 Plan 2 Summary

## Outcome

Accepted draft content now carries inspectable section provenance instead of only generic reference summaries. The workflow selects a small evidence set per section, the draft route enforces that grounding is only claimed when approved evidence exists, and the existing `/generate` page renders those accepted sources without a broad refactor.

## Verification

- `node --experimental-strip-types --test tests/phase-03/contracts/grounded-draft-route-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-03/contracts/provenance-read-model-contract.test.ts`
- `npm run build`

## Key Decisions

- Kept grounding heuristic and brownfield-safe: no retrieval service, no vector store, and no full reference corpus dump into the UI.
- Enforced trust at the route boundary by rejecting provenance-bearing responses when no approved evidence context is active.
- Added `allowImportingTsExtensions` to `tsconfig.json` because the repo already relies on explicit `.ts` imports in its contract helpers and tests.

## Files

- `lib/official-document-workflow.ts` now selects grounded evidence snippets and attaches section-level provenance to accepted draft output.
- `app/api/ai/draft/route.ts` now rejects invalid grounding claims and persists provenance-bearing sections.
- `app/generate/page.tsx` renders accepted provenance in the draft step, review step, and preview pane.
- `lib/generate-workspace.ts` preserves provenance through draft hydration.
- `tests/phase-03/contracts/grounded-draft-route-contract.test.ts` locks full/section draft route behavior and grounding enforcement.
- `tests/phase-03/contracts/provenance-read-model-contract.test.ts` locks versions/read-model exposure and the UI consumption boundary.

## Next

`03-03` can now build deterministic review freshness and export gating on the same accepted provenance-bearing section contract used by draft generation.
