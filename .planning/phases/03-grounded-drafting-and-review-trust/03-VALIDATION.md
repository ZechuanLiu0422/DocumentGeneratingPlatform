---
phase: 03
slug: grounded-drafting-and-review-trust
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for grounded drafting, trust metadata, review freshness, and compare-before-accept behavior.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + existing Playwright smoke + local Supabase seed/reset scripts |
| **Config file** | `playwright.config.ts` for seeded browser proof; no new non-Node runner for contracts |
| **Quick run command** | `npm run test:phase-03:contracts:harness` |
| **Full suite command** | `node --experimental-strip-types --test tests/phase-03/contracts/provenance-persistence-contract.test.ts tests/phase-03/contracts/change-candidate-contract.test.ts tests/phase-03/contracts/grounded-draft-route-contract.test.ts tests/phase-03/contracts/provenance-read-model-contract.test.ts tests/phase-03/contracts/review-policy-contract.test.ts tests/phase-03/contracts/export-review-gate-contract.test.ts tests/phase-03/contracts/acceptance-route-contract.test.ts tests/phase-03/telemetry/trust-route-telemetry.test.ts && npm run build && npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run test:phase-03:e2e` |
| **Estimated runtime** | ~240 seconds, excluding one-time browser install |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted command from the map below
- **After every wave:** Run all commands for plans completed in that wave
- **Before `$gsd-verify-work`:** Run the full suite command above
- **Max feedback latency:** 240 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | TRUST-01, TRUST-02, TRUST-04, TRUST-05 | harness smoke | `node --experimental-strip-types --test tests/phase-03/contracts/shared-fixtures.ts && rg -n "test:phase-03:contracts" package.json` | ✅ | ⬜ |
| 03-01-02 | 01 | 1 | TRUST-01, TRUST-02, TRUST-04, TRUST-05 | foundation contract | `node --experimental-strip-types --test tests/phase-03/contracts/provenance-persistence-contract.test.ts tests/phase-03/contracts/change-candidate-contract.test.ts` | ✅ | ⬜ |
| 03-02-01 | 02 | 2 | TRUST-01, TRUST-02 | route contract | `node --experimental-strip-types --test tests/phase-03/contracts/grounded-draft-route-contract.test.ts` | ✅ | ⬜ |
| 03-02-02 | 02 | 2 | TRUST-01, TRUST-02 | read model + build | `node --experimental-strip-types --test tests/phase-03/contracts/provenance-read-model-contract.test.ts && npm run build` | ✅ | ⬜ |
| 03-03-01 | 03 | 2 | TRUST-03 | review policy | `node --experimental-strip-types --test tests/phase-03/contracts/review-policy-contract.test.ts` | ✅ | ⬜ |
| 03-03-02 | 03 | 2 | TRUST-03 | export gate + telemetry + build | `node --experimental-strip-types --test tests/phase-03/contracts/export-review-gate-contract.test.ts tests/phase-03/telemetry/trust-route-telemetry.test.ts && npm run build` | ✅ | ⬜ |
| 03-04-01 | 04 | 3 | TRUST-04, TRUST-05 | acceptance route contract | `node --experimental-strip-types --test tests/phase-03/contracts/acceptance-route-contract.test.ts` | ✅ | ⬜ |
| 03-04-02 | 04 | 3 | TRUST-04, TRUST-05 | seeded browser wiring proof | `npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run build && npm run test:phase-03:e2e` | ✅ | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/phase-03/contracts/shared-fixtures.ts` — planned in `03-01` as the deterministic trust fixture baseline
- [x] `tests/phase-03/contracts/trust-contract-helpers.ts` — planned in `03-01` to reuse the Phase 2 temp-module route-loading pattern
- [x] `tests/phase-03/contracts/provenance-persistence-contract.test.ts` — planned in `03-01` for trust-state normalization coverage
- [x] `tests/phase-03/contracts/change-candidate-contract.test.ts` — planned in `03-01` for compare-before-accept schema coverage
- [x] `tests/phase-03/contracts/grounded-draft-route-contract.test.ts` — planned in `03-02` for grounded draft route coverage
- [x] `tests/phase-03/contracts/provenance-read-model-contract.test.ts` — planned in `03-02` for version/read-model provenance coverage
- [x] `tests/phase-03/contracts/review-policy-contract.test.ts` — planned in `03-03` for deterministic doc-type review checks
- [x] `tests/phase-03/contracts/export-review-gate-contract.test.ts` — planned in `03-03` for stale/missing review gating coverage
- [x] `tests/phase-03/telemetry/trust-route-telemetry.test.ts` — planned in `03-03` for review/export trust telemetry assertions
- [x] `tests/phase-03/contracts/acceptance-route-contract.test.ts` — planned in `03-04` for preview/accept/reject route semantics
- [x] `supabase/migrations/20260327173000_phase_03_review_state_jsonb.sql` — planned in `03-01` and consumed in `03-03` for authoritative review-state storage
- [x] `supabase/migrations/20260327180000_phase_03_pending_change_jsonb.sql` — planned in `03-04` for persisted preview candidate lifecycle state
- [x] `tests/e2e/generate-smoke.spec.ts` — reused in `03-04` for provider-free browser proof
- [x] `scripts/seed-phase-2.mjs` — reused in `03-04` for compare-ready seeded browser scenarios

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Provenance wording clarity for reviewers | TRUST-02 | Contract tests prove shape, but reviewer comprehension still depends on actual copy and layout | On a seeded or local draft with grounded sections, verify the provenance cards explain what source was used and why without implying legal/compliance certainty. |
| Diff usefulness on long sections | TRUST-04 | Route contracts prove compare payloads, but human usefulness depends on visual presentation | In `/generate`, open a compare candidate and confirm reviewers can identify the changed section and the before/after text without scrolling confusion. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or reuse an existing seeded browser contract
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all planned trust-contract test files
- [x] Core safety verification is provider-free; browser proof reuses local seeded flows and avoids paid-provider requirements
- [x] Browser proof is explicitly limited to seeded restore compare wiring; regenerate/revise semantics and snapshot-count rules are owned by route contracts
- [x] Feedback latency < 240s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-27
