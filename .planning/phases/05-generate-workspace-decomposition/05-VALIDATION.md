---
phase: 05
slug: generate-workspace-decomposition
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for generate workspace shell readiness and frontend decomposition safety.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + existing Playwright smoke + Next build |
| **Config file** | `playwright.config.ts`; no new non-Node test framework |
| **Quick run command** | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/*.test.ts` |
| **Full suite command** | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/*.test.ts && npm run build && npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && playwright test --config=playwright.config.ts --project=chromium tests/e2e/generate-smoke.spec.ts --grep "UX-01|UX-02|Phase 5"` |
| **Estimated runtime** | ~300 seconds on the local seeded stack |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted command from the map below
- **After every wave:** Run all commands for plans completed in that wave
- **Before `$gsd-verify-work`:** Run the full suite command above
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | UX-01 | shell bootstrap contract | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/workspace-bootstrap-contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | UX-01 | delayed-panel browser proof | `npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && playwright test --config=playwright.config.ts --project=chromium tests/e2e/generate-smoke.spec.ts --grep "UX-01|Phase 5"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | UX-02 | stage module boundary contract | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/stage-module-contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | UX-02 | build + controller integration | `npm run build` | ✅ existing | ⬜ pending |
| 05-03-01 | 03 | 2 | UX-01, UX-02 | panel extraction + helper boundary contract | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/sidebar-decomposition-contract.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | UX-01, UX-02 | full seeded browser regression | `node --experimental-strip-types --experimental-test-module-mocks --test-concurrency=1 --test tests/phase-05/contracts/*.test.ts && npm run build && npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && playwright test --config=playwright.config.ts --project=chromium tests/e2e/generate-smoke.spec.ts --grep "UX-01|UX-02|Phase 5"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase-05/contracts/workspace-bootstrap-contract.test.ts` — core shell and deferred-data contract
- [ ] `tests/phase-05/contracts/stage-module-contract.test.ts` — stage extraction/helper-boundary proof
- [ ] `tests/phase-05/contracts/sidebar-decomposition-contract.test.ts` — non-critical panel extraction and helper usage proof
- [ ] package.json Phase 5 verification scripts if the planner chooses script aliases instead of direct commands
- [ ] Playwright scenario updates in `tests/e2e/generate-smoke.spec.ts` to cover delayed non-critical endpoints under seeded data

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workspace feels usable before panel helpers finish loading | UX-01 | Browser automation can prove visibility and clickability, but not whether the transition feels confusing | Load `/generate` with delayed non-critical endpoints and confirm the current stage, main form controls, and save/generate actions are understandable before the side panels finish hydrating. |
| Extracted modules preserve the current visual contract | UX-02 | Build/tests can confirm behavior, but not subtle layout regressions or duplicated panel affordances | Walk intake, planning, outline, draft, and review after decomposition and confirm the visual flow matches the pre-refactor workspace rather than introducing a redesign. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing Phase 5 verification references
- [x] Browser proof remains provider-free and seeded on the local stack
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter before final planning sign-off

**Approval:** approved 2026-03-28
