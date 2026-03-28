---
phase: 04
slug: durable-execution-and-export-hardening
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-28
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for durable operation semantics, distributed coordination, and binary export delivery.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner + existing Playwright smoke + local Supabase-backed integration commands |
| **Config file** | `playwright.config.ts`; no new non-Node test framework |
| **Quick run command** | `npm run test:phase-04:contracts:harness` |
| **Full suite command** | `node --experimental-strip-types --test tests/phase-04/contracts/*.test.ts tests/phase-04/ops/*.test.ts tests/phase-04/telemetry/*.test.ts && npm run build && npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run test:phase-04:e2e` |
| **Estimated runtime** | ~300 seconds, excluding one-time browser install |

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
| 04-01-01 | 01 | 1 | OPS-01, OPS-03 | harness smoke | `npm run test:phase-04:contracts:harness` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | OPS-01, OPS-03 | operation contract | `node --experimental-strip-types --test tests/phase-04/contracts/operation-foundation-contract.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | OPS-02, OPS-03 | distributed limiter | `node --experimental-strip-types --test tests/phase-04/ops/distributed-ratelimit.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | OPS-02, OPS-03 | lease + idempotency + drain integration | `node --experimental-strip-types --test tests/phase-04/ops/operation-lease-contract.test.ts tests/phase-04/ops/operation-idempotency.test.ts tests/phase-04/ops/runner-drain-contract.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | OPS-01, OPS-03 | async route contract | `node --experimental-strip-types --test tests/phase-04/contracts/async-draft-route-contract.test.ts tests/phase-04/contracts/async-revise-route-contract.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | OPS-01, OPS-03 | status read-model + build | `node --experimental-strip-types --test tests/phase-04/contracts/operation-status-route-contract.test.ts tests/phase-04/telemetry/operation-route-telemetry.test.ts && npm run build` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 4 | OPS-01, OPS-03, UX-03 | export contract | `node --experimental-strip-types --test tests/phase-04/contracts/export-download-contract.test.ts tests/phase-04/ops/export-artifact-contract.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 4 | OPS-01, OPS-03, UX-03 | seeded browser proof | `npm run test:phase-02:rls:reset && npm run test:phase-02:e2e:seed && npm run build && npm run test:phase-04:e2e` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/phase-04/contracts/harness-smoke.test.ts` — reusable Phase 4 contract harness baseline
- [ ] `tests/phase-04/contracts/operation-foundation-contract.test.ts` — operation schema and transition guards
- [ ] `tests/phase-04/ops/distributed-ratelimit.test.ts` — persistent short-window limiter proof
- [ ] `tests/phase-04/ops/operation-lease-contract.test.ts` — claim/heartbeat/expiry semantics
- [ ] `tests/phase-04/ops/operation-idempotency.test.ts` — duplicate completion and retry safety
- [ ] `tests/phase-04/ops/runner-drain-contract.test.ts` — queued work drains to terminal state through the autonomous runner trigger
- [ ] `tests/phase-04/contracts/async-draft-route-contract.test.ts` — enqueue semantics for draft generation
- [ ] `tests/phase-04/contracts/async-revise-route-contract.test.ts` — enqueue semantics for revise flows
- [ ] `tests/phase-04/contracts/operation-status-route-contract.test.ts` — browser status/read-model contract
- [ ] `tests/phase-04/contracts/export-download-contract.test.ts` — no-base64 binary export contract
- [ ] `tests/phase-04/ops/export-artifact-contract.test.ts` — durable export artifact metadata and retrieval proof
- [ ] `tests/phase-04/telemetry/operation-route-telemetry.test.ts` — operation lifecycle logging fields
- [ ] `tests/e2e/generate-smoke.spec.ts` or a Phase 4 variant reuse path — async progress + export readiness browser proof
- [ ] repo-local Phase 4 npm scripts in `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Async progress wording and failure recovery clarity | OPS-01, OPS-03 | Contract tests prove status shape, but not whether users can understand pending/retry/error states | In `/generate`, trigger a queued operation and confirm pending, retryable failure, and completion states explain what the user should do next without needing DevTools. |
| Browser download UX for completed exports | UX-03 | Automated proof can validate headers/download path, but not whether the browser flow feels like a normal file export | Export a seeded draft, confirm the browser downloads a `.docx` directly without visible base64 decode lag or corrupted filename behavior. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all planned Phase 4 contract, ops, and telemetry references
- [x] Core durable-operation proof is local-stack-safe and does not require paid provider calls
- [x] Browser proof covers async status plus final binary export delivery
- [x] Feedback latency < 300s
- [x] `nyquist_compliant: true` set in frontmatter before final planning sign-off

**Approval:** approved 2026-03-28
