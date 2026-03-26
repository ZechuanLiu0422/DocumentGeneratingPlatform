---
phase: 01-workflow-integrity-guardrails
plan: 03
subsystem: ui
tags: [generate-workspace, hydration, drafts, restore, authoritative-snapshot]
requires:
  - phase: 01-workflow-integrity-guardrails
    provides: authoritative draft snapshots from save and restore endpoints
provides:
  - editable-only draft save payloads from the generate workspace
  - shared authoritative draft hydration for reopen, save, and restore flows
  - client contract coverage for save payload and hydration behavior
affects: [resume-flow, restore-flow, generate-ui]
tech-stack:
  added: []
  patterns: [shared hydration derivation, editable-only client save payloads]
key-files:
  created:
    - lib/generate-workspace.ts
    - .planning/phases/01-workflow-integrity-guardrails/01-03-SUMMARY.md
  modified:
    - app/generate/page.tsx
    - tests/phase-01/generate-workspace-contract.test.ts
key-decisions:
  - "Build the save request from a dedicated helper so the browser never sends workflow-owned draft fields."
  - "Hydrate save and restore responses through the same draft snapshot path already used for reopened drafts."
patterns-established:
  - "The generate workspace should trust server-returned draft snapshots instead of reconstructing workflow state locally."
  - "Client contract tests may assert source-level handler usage when the guarantee is structural."
requirements-completed: [FLOW-01, FLOW-03]
duration: 30min
completed: 2026-03-26
---

# Phase 01 Plan 03 Summary

**The generate workspace now saves and restores through editable-only requests and hydrates exclusively from authoritative server draft snapshots**

## Performance

- **Duration:** 30 min
- **Started:** 2026-03-26T16:40:00+08:00
- **Completed:** 2026-03-26T17:10:00+08:00
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Extracted shared helpers that define the editable-only save request and the authoritative draft-to-view-state hydration contract.
- Updated the generate workspace save flow to send only editable fields to `/api/drafts` and rehydrate from `data.draft`.
- Updated version restore handling to hydrate from `data.draft` instead of manually patching local state from `data.version`.
- Added executable contract tests for helper behavior plus source-level assertions over save and restore handler usage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract and test the editable save-payload and hydration contract** - `438360f` (feat)
2. **Task 2: Reuse authoritative hydration for version restore and resume flows** - `d0d8f7f` (feat)

## Files Created/Modified

- `lib/generate-workspace.ts` - Editable save-request builder and authoritative hydration derivation
- `app/generate/page.tsx` - Save and restore handlers now hydrate from returned `draft` snapshots
- `tests/phase-01/generate-workspace-contract.test.ts` - Helper plus page-contract coverage

## Decisions Made

- Kept the existing `hydrateDraft` entrypoint in the page and changed it to consume a derived view model so reopen, save, and restore share one hydration path.
- Left intake/planning/draft/review action handlers alone for this plan because the contract goal here is the draft save and restore boundary, not every workflow request shape.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

- The page had several workflow-owned fields embedded directly in the draft-save request body, so the save handler needed a focused cleanup before the authoritative snapshot path could be trusted.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 now has aligned server and client draft boundaries for save, reopen, and restore flows.
- The remaining work is phase-level verification and planning artifact completion.

---
*Phase: 01-workflow-integrity-guardrails*
*Completed: 2026-03-26*
