---
phase: 01
slug: workflow-integrity-guardrails
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for workflow-integrity hardening.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | No dedicated config required |
| **Quick run command** | `node --experimental-strip-types --test tests/phase-01/draft-save-contract.test.ts` |
| **Full suite command** | `node --experimental-strip-types --test tests/phase-01/draft-save-contract.test.ts tests/phase-01/version-restore-contract.test.ts tests/phase-01/generate-workspace-contract.test.ts tests/phase-01/workflow-stage-ownership.test.ts` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** run that task's targeted command from the map below
- **After every plan:** run the relevant plan-level test file(s)
- **Before phase closeout:** full Phase 1 suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FLOW-01 | schema contract | `node --experimental-strip-types --test tests/phase-01/draft-save-contract.test.ts` | ✅ | historical |
| 01-01-02 | 01 | 1 | FLOW-01 | route/helper contract + lint | `node --experimental-strip-types --test tests/phase-01/draft-save-contract.test.ts` | ✅ | historical |
| 01-02-01 | 02 | 1 | FLOW-03, FLOW-04 | restore merge contract | `node --experimental-strip-types --test tests/phase-01/version-restore-contract.test.ts` | ✅ | historical |
| 01-02-02 | 02 | 1 | FLOW-03, FLOW-04 | restore route contract + lint | `node --experimental-strip-types --test tests/phase-01/version-restore-contract.test.ts` | ✅ | historical |
| 01-03-01 | 03 | 2 | FLOW-01, FLOW-03 | workspace payload/hydration contract | `node --experimental-strip-types --test tests/phase-01/generate-workspace-contract.test.ts` | ✅ | historical |
| 01-03-02 | 03 | 2 | FLOW-01, FLOW-03 | save/restore hydration alignment + lint | `node --experimental-strip-types --test tests/phase-01/generate-workspace-contract.test.ts` | ✅ | historical |
| 01-04-01 | 04 | 1 | FLOW-02 | stage-map contract | `node --experimental-strip-types --test tests/phase-01/workflow-stage-ownership.test.ts` | ✅ | historical |
| 01-04-02 | 04 | 1 | FLOW-02 | route adoption contract + lint | `node --experimental-strip-types --test tests/phase-01/workflow-stage-ownership.test.ts` | ✅ | historical |

*Status: ⬜ pending · ✅ green · ❌ red · historical = backfilled from completed phase artifacts*

---

## Wave 0 Requirements

- [x] `tests/phase-01/draft-save-contract.test.ts` — required for FLOW-01 save-contract proof
- [x] `tests/phase-01/version-restore-contract.test.ts` — required for FLOW-03/FLOW-04 restore proof
- [x] `tests/phase-01/generate-workspace-contract.test.ts` — required for authoritative client hydration proof
- [x] `tests/phase-01/workflow-stage-ownership.test.ts` — required for FLOW-02 stage-transition ownership proof
- [x] `lib/draft-save.ts` — required as pure draft-save preservation helper boundary
- [x] `lib/version-restore.ts` — required as pure restore merge helper boundary
- [x] `lib/generate-workspace.ts` — required as shared save/hydration helper boundary
- [x] `lib/workflow-stage.ts` — required as centralized authoritative stage-transition boundary

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generate workspace resume/restore feels coherent in the browser | FLOW-03, FLOW-04 | Contract tests prove data shaping, but browser confidence still benefits from one local reopen/restore check | Open an in-progress draft in `/generate`, save editable changes, restore a prior version, and confirm the UI lands on the expected stage with coherent title/sections/history. |

---

## Validation Sign-Off

- [x] All Phase 1 tasks map to executable verification
- [x] Sampling continuity is maintained across all four plans
- [x] Wave 0 artifacts cover all required helper and contract boundaries
- [x] No watch-mode or long-running commands are required
- [x] Feedback latency stays under 30 seconds for the contract suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-26
