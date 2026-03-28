---
phase: 05-generate-workspace-decomposition
plan: 01
subsystem: ui
tags: [nextjs, react, playwright, workspace-bootstrap, deferred-loading]
requires:
  - phase: 04-durable-execution-and-export-hardening
    provides: durable operation polling, binary export delivery, and seeded browser verification for `/generate`
provides:
  - Generate workspace shell, bootstrap hook, and controller boundary files
  - Deferred loading for non-critical phrases, contacts, rules, assets, and version history
  - Phase 5 contract and browser proof for usable-first workspace readiness
affects: [05-02, 05-03, UX-01, UX-02]
tech-stack:
  added: []
  patterns: [shell-bootstrap-controller split, deferred non-critical panel loading, node:test plus Playwright refactor proof]
key-files:
  created:
    - app/generate/_components/GenerateWorkspaceShell.tsx
    - app/generate/_hooks/useGenerateWorkspaceBootstrap.ts
    - app/generate/_hooks/useGenerateWorkspaceController.ts
    - tests/phase-05/contracts/workspace-bootstrap-contract.test.ts
  modified:
    - app/generate/page.tsx
    - package.json
    - tests/e2e/generate-smoke.spec.ts
key-decisions:
  - "Use a thin shell/bootstrap/controller split first so later stage extraction can build on stable boundaries instead of re-cutting the monolithic page repeatedly."
  - "Only `/api/settings` plus draft hydration stay on the critical path; phrases, contacts, rules, assets, and version history load after the shell is already interactive."
patterns-established:
  - "Phase 5 readiness proofs combine a source-level boundary contract with a delayed-endpoint Playwright scenario."
  - "Non-critical `/generate` panel helpers must degrade to background hydration instead of blocking first render."
requirements-completed: [UX-01, UX-02]
duration: 4 min
completed: 2026-03-28
---

# Phase 05 Plan 01: Shell/Bootstrap Foundation Summary

**Generate workspace shell/controller boundaries plus deferred side-panel loading that makes the seeded draft usable before non-critical helpers finish**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T10:27:57Z
- **Completed:** 2026-03-28T10:31:31Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a dedicated [GenerateWorkspaceShell](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/_components/GenerateWorkspaceShell.tsx), [useGenerateWorkspaceBootstrap](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/_hooks/useGenerateWorkspaceBootstrap.ts), and [useGenerateWorkspaceController](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/_hooks/useGenerateWorkspaceController.ts) boundary so [page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) no longer owns the bootstrap contract inline.
- Added [tests/phase-05/contracts/workspace-bootstrap-contract.test.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/tests/phase-05/contracts/workspace-bootstrap-contract.test.ts) and Phase 5 npm/browser commands so the refactor has a reusable contract plus delayed-endpoint proof surface.
- Changed the bootstrap flow so only settings and selected-draft hydration gate first render while phrases, contacts, writing rules, reference assets, and version history hydrate in the background.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 5 verification harness for deferred bootstrap readiness** - `06b36e0` (test)
2. **Task 2: Introduce controller and shell boundaries, then defer non-critical panel loading** - `31c39ee` (feat)

## Files Created/Modified

- `app/generate/_components/GenerateWorkspaceShell.tsx` - extracted the top-level loading/header/error shell from the page body.
- `app/generate/_hooks/useGenerateWorkspaceBootstrap.ts` - moved the workspace bootstrap flow behind a dedicated hook and then narrowed the critical path to settings plus draft hydration.
- `app/generate/_hooks/useGenerateWorkspaceController.ts` - introduced controller-owned selectors and mutation helpers for stage readiness and shared planning/outline edits.
- `app/generate/page.tsx` - adopted the new shell/bootstrap/controller boundaries instead of keeping the boot sequence inline.
- `package.json` - added `test:phase-05:contracts` and `test:phase-05:e2e` commands.
- `tests/phase-05/contracts/workspace-bootstrap-contract.test.ts` - asserted the page imports the new boundaries and no longer contains the old six-request bootstrap promise.
- `tests/e2e/generate-smoke.spec.ts` - added the delayed-endpoint UX-01 scenario for background panel hydration.

## Decisions Made

- Kept the first extraction small and behavioral: introduce reusable boundaries first, then deepen stage/panel decomposition in later plans.
- Treated version history as non-critical panel data so review-stage readiness is no longer blocked on `/api/ai/versions`.
- Reused the existing seeded Playwright harness instead of introducing a component-test framework during the refactor phase.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial subagent handoff never returned a usable completion signal, so the plan was resumed locally to keep Wave 1 moving.
- The first browser proof attempt overlapped with an in-flight build and failed because Playwright started before `.next` finished. Re-running after the completed build produced the real green result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `05-02` can now extract intake/planning/outline modules onto the shell/controller boundary without reworking the first-load path again.
- `05-03` can reuse the deferred panel loading pattern for knowledge and version modules instead of reintroducing blocking sidebar fetches.

---
*Phase: 05-generate-workspace-decomposition*
*Completed: 2026-03-28*

## Self-Check: PASSED

- Found `.planning/phases/05-generate-workspace-decomposition/05-01-SUMMARY.md` on disk.
- Verified task commits `06b36e0` and `31c39ee` in git history.
