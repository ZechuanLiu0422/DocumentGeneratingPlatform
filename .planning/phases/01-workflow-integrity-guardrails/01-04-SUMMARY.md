---
phase: 01-workflow-integrity-guardrails
plan: 04
subsystem: api
tags: [workflow-stage, routes, guardrails, nextjs, authoritative-transitions]
requires: []
provides:
  - centralized authoritative workflow stage action map
  - route-level stage transition adoption across intake, planning, outline, draft, review, revise, and export
  - executable checks that the supported transition routes use the shared helper
affects: [draft-flow, restore-flow, generate-workspace]
tech-stack:
  added: []
  patterns: [centralized workflow action maps, route adoption contract tests]
key-files:
  created:
    - lib/workflow-stage.ts
    - .planning/phases/01-workflow-integrity-guardrails/01-04-SUMMARY.md
  modified:
    - app/api/ai/intake/route.ts
    - app/api/ai/outline-plan/route.ts
    - app/api/ai/outline/route.ts
    - app/api/ai/outline/confirm/route.ts
    - app/api/ai/draft/route.ts
    - app/api/ai/review/route.ts
    - app/api/ai/revise/route.ts
    - app/api/generate/route.ts
    - tests/phase-01/workflow-stage-ownership.test.ts
key-decisions:
  - "Represent stage ownership as named workflow actions instead of scattering literal stage strings across routes."
  - "Use a source-level contract test to prove the real stage-writing routes adopt the shared helper."
patterns-established:
  - "Routes that advance workflow stage should call the centralized workflow-stage helper instead of hard-coding stage literals."
  - "Guardrail tests may inspect route source when the contract is structural rather than data-driven."
requirements-completed: [FLOW-02]
duration: 35min
completed: 2026-03-26
---

# Phase 01 Plan 04 Summary

**Authoritative workflow-stage transitions now flow through a shared action map that every stage-writing server route adopts**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-26T15:20:00+08:00
- **Completed:** 2026-03-26T15:55:00+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Created a centralized authoritative action-to-stage map for intake, planning, outline, confirmation, draft generation, review, revision, and export flows.
- Refactored every supported stage-writing route to derive its target workflow stage from the shared helper instead of open-coded literals.
- Expanded the workflow-stage contract test so it verifies both the mapping table and route adoption across the actual API surface.

## Task Commits

Each task was committed atomically:

1. **Task 1: Centralize the authoritative workflow-stage map** - `1928bb0` (feat)
2. **Task 2: Adopt authoritative stage transitions across all stage-writing routes** - `f47b91b` (feat)

## Files Created/Modified

- `lib/workflow-stage.ts` - Shared authoritative workflow action map and lookup helpers
- `app/api/ai/intake/route.ts` - Intake readiness now resolves stage through the shared helper
- `app/api/ai/outline-plan/route.ts` - Planning generation now uses the shared helper
- `app/api/ai/outline/route.ts` - Outline generation now uses the shared helper
- `app/api/ai/outline/confirm/route.ts` - Outline confirmation now uses the shared helper
- `app/api/ai/draft/route.ts` - Draft generation now uses the shared helper
- `app/api/ai/review/route.ts` - Review completion now uses the shared helper
- `app/api/ai/revise/route.ts` - Revision application now uses the shared helper
- `app/api/generate/route.ts` - Export completion now uses the shared helper
- `tests/phase-01/workflow-stage-ownership.test.ts` - Mapping plus route-adoption contract coverage

## Decisions Made

- Introduced `getIntakeWorkflowAction()` so intake remains explicit about readiness-driven branching while still routing through the shared ownership model.
- Kept the route-adoption verification lightweight by asserting source snippets rather than adding runtime integration scaffolding for every endpoint.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The initial parallel executor run left Task 1 uncommitted, so this plan was resumed locally and split into two clean commits to preserve the intended task boundaries.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 now has explicit server ownership over supported workflow transitions, which unblocks the remaining restore and generate-workspace hydration work.
- `01-03` can rely on stable authoritative workflow stages returned from server snapshots without guessing route behavior.

---
*Phase: 01-workflow-integrity-guardrails*
*Completed: 2026-03-26*
