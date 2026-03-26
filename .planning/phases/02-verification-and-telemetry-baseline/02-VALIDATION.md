---
phase: 02
slug: verification-and-telemetry-baseline
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + Playwright Test + local Supabase CLI via repo-local scripts |
| **Config file** | `playwright.config.ts` for browser smoke; no dedicated config required for `node:test` |
| **Quick run command** | `npm run test:phase-02:contracts:harness` |
| **Full suite command** | `npm run test:phase-02:contracts && npm run test:phase-02:rls && npm run test:phase-02:e2e && node --experimental-strip-types --test tests/phase-02/telemetry/telemetry-contract.test.ts tests/phase-02/telemetry/workflow-route-telemetry.test.ts tests/phase-02/telemetry/health-contract.test.ts` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted command from the map below
- **After every plan wave:** Run `npm run test:phase-02:contracts && npm run test:phase-02:rls && node --experimental-strip-types --test tests/phase-02/telemetry/telemetry-contract.test.ts tests/phase-02/telemetry/workflow-route-telemetry.test.ts tests/phase-02/telemetry/health-contract.test.ts`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SAFE-01 | harness smoke | `npm run test:phase-02:contracts:harness && rg -n "test:phase-02:contracts" .github/workflows/phase-02-safety.yml` | ✅ | ✅ green |
| 02-01-02 | 01 | 1 | SAFE-01 | contract + build | `npm run test:phase-02:contracts && npm run build` | ✅ | ✅ green |
| 02-02-01 | 02 | 1 | SAFE-02 | fixture setup | `npm run test:phase-02:rls:reset && npm run test:phase-02:rls:seed` | ✅ | ✅ green |
| 02-02-02 | 02 | 1 | SAFE-02 | integration | `npm run test:phase-02:rls:reset && npm run test:phase-02:rls:seed && npm run test:phase-02:rls && npm run check:schema` | ✅ | ✅ green |
| 02-04-01 | 04 | 1 | SAFE-04 | unit + contract | `node --experimental-strip-types --test tests/phase-02/telemetry/telemetry-contract.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 1 | SAFE-04 | route contract + build | `node --experimental-strip-types --test tests/phase-02/telemetry/telemetry-contract.test.ts tests/phase-02/telemetry/workflow-route-telemetry.test.ts tests/phase-02/telemetry/health-contract.test.ts && npm run build` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | SAFE-03 | environment setup | `npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run test:phase-02:e2e:install && npm run build` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | SAFE-03 | browser smoke | `npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run test:phase-02:e2e:install && npm run build && npm run test:phase-02:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `.github/workflows/phase-02-safety.yml` — planned in `02-01` as CI workflow for SAFE-01 contract coverage
- [x] `playwright.config.ts` — planned in `02-03` as browser smoke configuration
- [x] `tests/phase-02/contracts/harness-smoke.test.ts` — planned in `02-01` for harness verification before deeper SAFE-01 tests
- [x] `tests/phase-02/contracts/validation-contract.test.ts` — planned in `02-01` for SAFE-01 validation coverage
- [x] `tests/phase-02/contracts/persistence-contract.test.ts` — planned in `02-01` for SAFE-01 persistence coverage
- [x] `tests/phase-02/contracts/workflow-route-contract.test.ts` — planned in `02-01` for SAFE-01 route-contract coverage
- [x] `tests/phase-02/auth-rls/auth-rls.test.ts` — planned in `02-02` for SAFE-02 multi-user isolation checks
- [x] `tests/e2e/generate-smoke.spec.ts` — planned in `02-03` for SAFE-03 seeded browser smoke
- [x] `tests/phase-02/telemetry/telemetry-contract.test.ts` — planned in `02-04` for SAFE-04 log-shape checks
- [x] `tests/phase-02/telemetry/workflow-route-telemetry.test.ts` — planned in `02-04` for SAFE-04 route-adoption checks
- [x] `tests/phase-02/telemetry/health-contract.test.ts` — planned in `02-04` for SAFE-04 health-contract checks
- [x] `scripts/seed-phase-2.mjs` — planned in `02-02` and reused in `02-03` for shared seeded data flow

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review log readability in the deployment environment | SAFE-04 | Structured payload shape can be automated, but operator usefulness depends on real log sinks and dashboards | Trigger one successful workflow step and one forced provider/export failure in a non-production environment, then confirm the emitted JSON is searchable by `draft_id`, `workflow_action`, and `error_code`. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 180s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-26
