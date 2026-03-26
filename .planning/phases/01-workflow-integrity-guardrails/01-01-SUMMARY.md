---
phase: 01-workflow-integrity-guardrails
plan: 01
subsystem: api
tags: [drafts, workflow, validation, authoritative-snapshot, nextjs]
requires: []
provides:
  - editable-only draft save validation
  - authoritative draft snapshot responses from /api/drafts
  - reusable protected-field preservation helpers for draft saves
affects: [generate-workspace, restore-flow, workflow-integrity]
tech-stack:
  added: [eslint, eslint-config-next]
  patterns: [editable-only request schemas, authoritative snapshot responses, pure payload sanitizers]
key-files:
  created:
    - lib/draft-save.ts
    - .eslintrc.json
  modified:
    - app/api/drafts/route.ts
    - lib/validation.ts
    - package.json
    - package-lock.json
    - tests/phase-01/draft-save-contract.test.ts
key-decisions:
  - "Split editable browser draft fields from server-owned workflow state with a strict save schema."
  - "Made /api/drafts return the saved server snapshot so the client can hydrate from authoritative data."
  - "Added project ESLint config so the plan's lint verification can run non-interactively."
patterns-established:
  - "Browser draft-save routes should accept editable fields only and reject workflow-owned keys."
  - "Server save endpoints should return normalized authoritative draft snapshots for client hydration."
requirements-completed: [FLOW-01]
duration: 45min
completed: 2026-03-26
---

# Phase 01 Plan 01 Summary

**Editable-only `/api/drafts` writes now preserve server-owned workflow metadata and return the authoritative saved draft snapshot**

## Performance

- **Duration:** 45 min
- **Started:** 2026-03-26T14:30:00+08:00
- **Completed:** 2026-03-26T15:15:00+08:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Split draft-save validation away from the broader workflow schema so browser saves can only submit editable base fields.
- Added pure draft-save helpers to build sanitized insert/update payloads, preserve protected workflow columns, and normalize server draft rows for UI hydration.
- Updated `/api/drafts` GET and POST to reuse the shared helpers and return authoritative `draft` snapshots after saves.
- Added executable contract coverage for schema rejection, payload preservation, and snapshot response shaping.
- Added the minimal ESLint config needed for `next lint` verification in this repo.

## Task Commits

Each task was committed atomically:

1. **Task 1: Split editable draft input from server-owned workflow state** - `21a9921` (test), `ed761a6` (feat)
2. **Task 2: Sanitize `/api/drafts` writes and return authoritative saved drafts** - `facc21b` (feat)

## Files Created/Modified

- `lib/draft-save.ts` - Pure helpers for editable draft payload building, protected-field preservation, and response normalization
- `app/api/drafts/route.ts` - Sanitized save flow and authoritative draft snapshot responses
- `lib/validation.ts` - Strict editable-only draft save schema
- `tests/phase-01/draft-save-contract.test.ts` - Executable draft-save contract coverage
- `package.json` - ESLint dependencies for plan verification
- `package-lock.json` - Lockfile updates for lint dependencies
- `.eslintrc.json` - Non-interactive Next ESLint baseline

## Decisions Made

- Kept the broader workflow schemas untouched and introduced a separate draft-save schema instead of overloading existing route validation.
- Returned normalized `draft` objects from `/api/drafts` instead of a `draftId`-only success payload so later client hydration work can trust server state.
- Centralized route mapping logic into `lib/draft-save.ts` so the contract is testable without route integration scaffolding.

## Deviations from Plan

None - plan executed as specified. The only supporting addition was the minimal ESLint setup required to satisfy the documented lint verification step.

## Issues Encountered

- The repo did not have a committed ESLint config for `next lint`, so verification needed `eslint`, `eslint-config-next`, and `.eslintrc.json` added before the lint step could run cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-03` can now consume authoritative `draft` snapshots from `/api/drafts`.
- `01-02` restore responses should mirror this same authoritative draft-shape contract.

---
*Phase: 01-workflow-integrity-guardrails*
*Completed: 2026-03-26*
