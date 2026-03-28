# TODO

- [ ] Execute Phase 04 Plan 03 Task 1 with TDD red-green flow
- [ ] Verify Task 1 async draft/revise enqueue contract coverage and commit atomically
- [ ] Execute Phase 04 Plan 03 Task 2 with TDD red-green flow
- [ ] Verify Task 2 operation-status/polling/telemetry coverage and commit atomically
- [ ] Run Phase 04 Plan 03 verification, create `04-03-SUMMARY.md`, and update planning state artifacts
- [ ] Record Phase 04 Plan 03 execution review notes

## Phase 04 Plan 03 Execution Review

- Pending

- [x] Execute Phase 04 Plan 02 Task 1 with TDD red-green flow
- [x] Verify Task 1 distributed limiter contract coverage and commit atomically
- [x] Execute Phase 04 Plan 02 Task 2 with TDD red-green flow
- [x] Verify Task 2 lease/idempotency/runner drain coverage and commit atomically
- [x] Run Phase 04 Plan 02 verification, create `04-02-SUMMARY.md`, and update planning state artifacts
- [x] Record Phase 04 Plan 02 execution review notes

## Phase 04 Plan 02 Execution Review

- Executed on 2026-03-28 with four TDD commits: red/green for the persistent distributed limiter, then red/green for lease-aware coordination and autonomous runner drain coverage.
- Verification evidence: `node --experimental-strip-types --test tests/phase-04/ops/distributed-ratelimit.test.ts`, `npm run test:phase-04:ops:coordination`, and `npm run test:phase-04:ops`.
- Outcome: Phase 4 now has persistent burst limiting, lease/idempotency queue primitives, a protected `/api/operations/run` entrypoint, cron-based recovery wiring, and shared operation telemetry fields for later async route adoption.
- Execution note: the initial executor worker stalled after Task 1 returned its commits, so Task 2 and plan closeout were resumed locally from the committed baseline.

- [x] Execute Phase 04 Plan 01 Task 1 with TDD red-green flow
- [x] Verify Task 1 Phase 4 harness coverage and commit atomically
- [x] Execute Phase 04 Plan 01 Task 2 with TDD red-green flow
- [x] Verify Task 2 durable-operation foundation coverage and commit atomically
- [x] Run Phase 04 Plan 01 verification, create `04-01-SUMMARY.md`, and update planning state artifacts
- [x] Record Phase 04 Plan 01 execution review notes

## Phase 04 Plan 01 Execution Review

- Executed on 2026-03-28 with four TDD commits: red/green for the Phase 4 harness, then red/green for the durable-operation storage foundation.
- Verification evidence: `npm run test:phase-04:contracts:harness` and `npm run test:phase-04:contracts:foundation`.
- Outcome: Phase 4 now has a provider-free contract harness, durable-operation schemas, a dedicated `draft_operations` migration, and normalized store helpers for later queue/runner plans.

- [x] Inspect current long-running generation/export execution paths for Phase 4 planning
- [x] Inspect current rate-limit and quota enforcement boundaries for Phase 4 planning
- [x] Inspect current export response payload/transport flow for Phase 4 planning
- [x] Inspect existing persistence/state surfaces that could support resumable jobs with minimal schema churn
- [x] Summarize concrete file ownership boundaries for a Phase 4 plan split

- [x] Create Phase 04 planning checklist and initialize the phase-planning directory
- [x] Research Phase 04 durable execution and export hardening against the current brownfield stack
- [x] Generate executable PLAN.md files for Phase 04 durable execution work
- [x] Verify Phase 04 plans with the GSD plan checker and close any coverage gaps
- [x] Record Phase 04 planning review notes and artifact results

## Phase 04 Planning Review

- Phase 04 planning completed on 2026-03-28 for durable execution and export hardening.
- Final artifact set written under `.planning/phases/04-durable-execution-and-export-hardening`: `04-RESEARCH.md`, `04-VALIDATION.md`, `04-01-PLAN.md`, `04-02-PLAN.md`, `04-03-PLAN.md`, `04-04-PLAN.md`.
- Wave/dependency layout after checker revisions:
- Wave 1: `04-01` durable-operation contracts and queue schema foundation.
- Wave 2: `04-02` distributed limiter, lease/idempotency coordination, autonomous runner drain path.
- Wave 3: `04-03` async draft/revise route adoption plus status polling and telemetry.
- Wave 4: `04-04` export artifact storage, binary download route, and browser export hardening.
- Requirement coverage:
- `OPS-01` → `04-01`, `04-03`, `04-04`
- `OPS-02` → `04-02`, with explicit async limiter migration carried into touched Phase 4 routes
- `OPS-03` → `04-01`, `04-02`, `04-03`, `04-04`
- `UX-03` → `04-04`
- Verification evidence:
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/04-durable-execution-and-export-hardening/04-01-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/04-durable-execution-and-export-hardening/04-01-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/04-durable-execution-and-export-hardening/04-02-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/04-durable-execution-and-export-hardening/04-02-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/04-durable-execution-and-export-hardening/04-03-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/04-durable-execution-and-export-hardening/04-03-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/04-durable-execution-and-export-hardening/04-04-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/04-durable-execution-and-export-hardening/04-04-PLAN.md`
- `gsd-plan-checker` re-review verdict: `FLAG` only, after blocker fixes; no remaining blockers.
- Checker-driven revisions that closed the original blockers:
- corrected waves to match dependencies
- made autonomous queue drain explicit through scheduler plus immediate self-kick
- made the distributed limiter migration explicitly async on touched Phase 4 routes
- narrowed `04-03` away from review-route churn
- fixed export storage to concrete Supabase Storage-backed artifact delivery
- signed off `04-VALIDATION.md` with the updated verification map

- [x] Inspect current macOS memory pressure and top resident-memory processes
- [x] Classify high-memory processes by safe-to-close priority and expected reclaim
- [x] Summarize concrete close recommendations and note anything to avoid killing

- [x] Begin Phase 3 execution and complete Wave 1 plan `03-01`
- [x] Verify Wave 1 outputs, write `03-01-SUMMARY.md`, and commit atomically
- [x] Execute Phase 03 Plan 02 and commit grounded provenance work atomically
- [x] Execute Phase 03 Plan 03 and commit review freshness/export gate work atomically
- [x] Verify Wave 2 outputs, write `03-02-SUMMARY.md` and `03-03-SUMMARY.md`
- [x] Execute Phase 03 Plan 04 and commit preview-first compare/accept work atomically
- [x] Run Phase 3 validation, update planning artifacts, and commit execution results
- [x] Record Phase 3 execution review notes

- [x] Create Phase 3 planning checklist and task breakdown for grounded drafting/review trust
- [x] Generate executable `03-01` through `03-04` plan files with wave ordering, requirement coverage, and brownfield-safe file ownership
- [x] Write `03-VALIDATION.md` with route-contract, browser-proof, and provider-free core safety verification
- [x] Verify the Phase 3 plan set against research constraints, explicit TRUST-04/TRUST-05 semantics, and current codebase boundaries
- [x] Record Phase 3 planning review notes

- [x] Research Phase 3 grounded drafting and review trust against the current brownfield stack
- [x] Write `.planning/phases/03-grounded-drafting-and-review-trust/03-RESEARCH.md`
- [x] Verify the Phase 3 research artifact covers TRUST-01 through TRUST-05 plus SAFE-03/SAFE-04 constraints

- [x] Begin Phase 2 execution and complete Wave 1 plans
- [x] Verify Wave 1 outputs and execute the dependent Wave 2 browser smoke plan
- [x] Execute Phase 02 Plan 01 and commit contract-suite work atomically
- [x] Execute Phase 02 Plan 02 and commit auth/RLS harness work atomically
- [x] Execute Phase 02 Plan 04 and commit telemetry baseline work atomically
- [x] Execute Phase 02 Plan 03 and commit seeded browser smoke work atomically
- [x] Run Phase 2 verification, update planning artifacts, and commit execution results
- [x] Record Phase 2 execution review notes

- [x] Create Phase 2 planning directory and planning checklist
- [x] Research Phase 2 verification and telemetry approaches against the current codebase
- [x] Generate executable PLAN.md files for Phase 2 verification-and-telemetry work
- [x] Verify Phase 2 plans with the GSD plan checker and close any coverage gaps
- [x] Record Phase 2 planning review notes and commit the resulting planning docs

- [x] Execute Phase 01 Plan 04 Task 1 with TDD red-green flow
- [x] Verify Task 1 workflow-stage ownership checks and commit atomically
- [x] Execute Phase 01 Plan 04 Task 2 with TDD route adoption flow
- [x] Verify Task 2 workflow-stage ownership checks plus lint and commit atomically
- [x] Create Phase 01 Plan 04 summary and update planning state artifacts
- [x] Record Phase 01 Plan 04 execution review notes

- [x] Execute Phase 01 Plan 02 Task 1 with TDD red-green flow
- [x] Verify Task 1 restore-contract checks and commit atomically
- [x] Execute Phase 01 Plan 02 Task 2 with TDD red-green flow
- [x] Verify Task 2 restore-contract checks plus lint and commit atomically
- [x] Create Phase 01 Plan 02 summary and update planning state artifacts
- [x] Record Phase 01 Plan 02 execution review notes

- [x] Execute Phase 01 Plan 01 Task 1 with TDD red-green flow
- [x] Verify Task 1 contract checks and commit atomically
- [x] Execute Phase 01 Plan 01 Task 2 with TDD red-green flow
- [x] Verify Task 2 contract checks plus lint and commit atomically
- [x] Create Phase 01 Plan 01 summary and update planning state artifacts
- [x] Record Phase 01 Plan 01 execution review notes

- [x] Begin Phase 1 execution and complete Wave 1 plans
- [x] Verify Wave 1 outputs and execute the dependent Wave 2 client-alignment plan

- [x] Execute Phase 01 Plan 03 Task 1 with TDD red-green flow
- [x] Verify Task 1 generate-workspace checks and commit atomically
- [x] Execute Phase 01 Plan 03 Task 2 with TDD save/restore hydration flow
- [x] Verify Task 2 generate-workspace checks plus lint and commit atomically
- [x] Create Phase 01 Plan 03 summary and update planning state artifacts
- [x] Record Phase 01 Plan 03 execution review notes
- [x] Run Phase 1 verification, update planning artifacts, and commit execution results
- [x] Record Phase 1 execution review notes

- [x] Revise Phase 1 plans to close the plan-checker blockers
- [x] Add explicit FLOW-02 coverage for authoritative workflow-stage transitions
- [x] Replace lint-only verification in Phase 1 plans with executable behavioral checks
- [x] Re-run Phase 1 plan review and confirm the blockers are resolved
- [x] Create Phase 1 planning directory and phase-planning checklist
- [x] Generate executable PLAN.md files for Phase 1 workflow-integrity work
- [x] Verify Phase 1 plans with the GSD plan checker and close any coverage gaps
- [x] Record Phase 1 planning review notes and commit the resulting planning docs

- [x] Initialize `.planning/PROJECT.md` for the brownfield document-generation platform
- [x] Create `.planning/config.json` with GSD workflow defaults for this repo
- [x] Produce `.planning/research/` project research artifacts
- [x] Generate `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, and `.planning/STATE.md`
- [x] Refresh `AGENTS.md`, verify planning artifacts, and commit initialization docs

- [x] Refresh `.planning/codebase/` documents for the current codebase state
- [x] Run parallel mapper agents for tech, architecture, quality, and concerns
- [x] Verify all 7 refreshed codebase documents exist with updated line counts
- [x] Record refresh review notes and commit the regenerated docs

- [x] Create `.planning/codebase/` for the initial brownfield codebase map
- [x] Run parallel mapper agents for tech, architecture, quality, and concerns
- [x] Verify all 7 codebase documents exist with line counts
- [x] Record codebase mapping review notes and commit the generated docs

- [x] Fetch upstream install instructions and confirm required local paths
- [x] Install `obra/superpowers` into `~/.codex/superpowers`
- [x] Symlink repo skills into `~/.agents/skills/superpowers`
- [x] Verify the symlink target and record review notes

- [x] 消除 `/generate` 对 `next/navigation` hook 的依赖，规避运行时 `useContext` 空指针
- [x] 运行构建验证并补充 review 记录

- [x] 增加“重新生成正文”入口，复用 full draft 生成链路覆盖当前整稿
- [x] 在分段成文/定稿检查阶段补充确认交互，避免误触覆盖正文
- [x] 运行构建验证并补充 review 记录

- [x] 修复 dev 启动脚本的 `.next` 隔离与 `--port` 参数透传，降低 `webpack-runtime` 首次请求竞态
- [x] 静态检查启动脚本与 runtime 修补逻辑，并记录当前环境下的验证边界

- [x] 重构正文生成输入，改为基于 section brief 成文，避免把提纲解释文本直接喂给模型
- [x] 为 full draft / section rewrite 增加质量闸门、一次自动修复式重试，以及明确失败错误码
- [x] 移除提纲式正文兜底逻辑，确保生成失败时不污染草稿和版本快照
- [x] 为不同 AI 任务配置差异化 token 上限
- [x] 运行构建验证并补充 review 记录

- [x] 梳理“保存草稿”和“AI 生成”对应的页面、接口与共享依赖，定位共同故障点
- [x] 实施最小修复，避免继续返回“系统繁忙，请稍后重试”
- [x] 运行验证并记录结果
- [x] 复现“结构共创/提纲生成”最新报错并定位触发链路
- [x] 修复运行时报错，确保新 `planning` 流程与旧快捷路径都可用
- [x] 重新验证本地 dev 流程并补充 review 记录

## Review

- Phase 3 execution completed on 2026-03-27 across plans `03-01` through `03-04`, closing TRUST-01 through TRUST-05 before any durable-operations work starts.
- `03-04` finished the preview-first trust boundary: regenerate, revise, and restore now return pending candidates first, persist them in `drafts.pending_change`, and require explicit accept/reject before accepted content changes.
- Phase 3 validation evidence:
- `npm run test:phase-03:contracts`
- `node --experimental-strip-types --test tests/phase-03/telemetry/trust-route-telemetry.test.ts`
- `npm run build`
- `npm run test:phase-03:e2e`
- Execution issues closed during Phase 3 finish:
- replaced exact `updated_at` equality checks with accepted-snapshot matching so local Supabase trigger rewrites do not produce false `STALE_CANDIDATE` failures
- forced seeded Playwright proof to reseed on every run and use an isolated test port so browser validation cannot reuse stale local servers or mutated drafts
- Next action after this closeout: plan Phase 04 durable execution and export hardening on top of the now-authoritative trust contracts.

- Phase 3 planning completed on 2026-03-27 for `03-grounded-drafting-and-review-trust`.
- Executable plan set written under `.planning/phases/03-grounded-drafting-and-review-trust/`:
- `03-01-PLAN.md` — trust contract and persistence foundation
- `03-02-PLAN.md` — grounded draft provenance and narrow review UI
- `03-03-PLAN.md` — document-type review packs plus export freshness gating
- `03-04-PLAN.md` — compare-before-accept flows with section-scoped guarantees
- `03-VALIDATION.md` — provider-free Node/route contracts plus seeded browser proof strategy
- Wave structure:
- Wave 1: `03-01`
- Wave 2: `03-02`, `03-03`
- Wave 3: `03-04`
- Validation outcome:
- `gsd-tools` frontmatter validation passed for all four plans
- `gsd-tools verify plan-structure` passed for all four plans with no errors or warnings
- Research constraints preserved in the plan set:
- no broad `/generate` decomposition in Phase 3
- Phase 2 node:test, telemetry, and seeded Playwright patterns reused instead of introducing new frameworks
- TRUST-04 compare/accept semantics and TRUST-05 section-scoped unchanged-section guarantees are explicit route contracts, not implied UI behavior
- core safety verification stays provider-free; browser proof reuses the seeded restore/compare path instead of paid-provider calls

- Phase 03 Plan 03 completed on 2026-03-27.
- Review now persists deterministic document-type checks as authoritative `drafts.review_state` content hashes, and export rejects both missing and stale review state before document generation starts.
- Verification evidence for `03-03`:
- `node --experimental-strip-types --test tests/phase-03/contracts/review-policy-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-03/contracts/export-review-gate-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-03/telemetry/trust-route-telemetry.test.ts`
- `npm run build`

- Phase 2 execution completed on 2026-03-27 across plans `02-01` through `02-04`, closing SAFE-01 through SAFE-04 before any larger brownfield refactor work.
- SAFE-03 now has a deterministic local Playwright smoke built on the shared Phase 2 seed harness; it logs in as `phase2.alice@example.com`, opens `/generate?draft=8e274be8-48e6-4065-9b9b-6f8435b6878b`, and proves review/export readiness without live provider calls.
- Phase 2 verification evidence now includes `npm run test:phase-02:contracts`, `npm run test:phase-02:rls`, `npm run test:phase-02:e2e`, `npm run test:phase-02:telemetry`, and `npm run build`, with the SAFE-03-specific setup path also verified via `npm run test:phase-02:e2e:seed` and `npm run test:phase-02:e2e:install`.
- Environment note: local SAFE-02/SAFE-03 proof depends on Docker Desktop, Docker socket access for Supabase inspection, and sandbox-free execution when Playwright starts the local Next server on `127.0.0.1:3000`.

- Phase 2 planning completed on 2026-03-26 for [ROADMAP.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) phase `Verification and Telemetry Baseline`.
- Final executable plan set written under [.planning/phases/02-verification-and-telemetry-baseline](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline):
- [02-01-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline/02-01-PLAN.md)
- [02-02-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline/02-02-PLAN.md)
- [02-03-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline/02-03-PLAN.md)
- [02-04-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline/02-04-PLAN.md)
- [02-VALIDATION.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/02-verification-and-telemetry-baseline/02-VALIDATION.md)
- Wave layout chosen to minimize brownfield risk:
- Wave 1: `02-01` node:test contracts, `02-02` real Supabase auth/RLS harness, `02-04` structured telemetry + health hardening
- Wave 2: `02-03` seeded Playwright smoke, depending on `02-02` for the shared local Supabase seed/auth fixture path
- Requirement coverage:
- `SAFE-01` → `02-01`
- `SAFE-02` → `02-02`
- `SAFE-03` → `02-03`
- `SAFE-04` → `02-04`
- Validation evidence:
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/02-verification-and-telemetry-baseline/02-01-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/02-verification-and-telemetry-baseline/02-01-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/02-verification-and-telemetry-baseline/02-02-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/02-verification-and-telemetry-baseline/02-02-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/02-verification-and-telemetry-baseline/02-03-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/02-verification-and-telemetry-baseline/02-03-PLAN.md`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" frontmatter validate .planning/phases/02-verification-and-telemetry-baseline/02-04-PLAN.md --schema plan`
- `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" verify plan-structure .planning/phases/02-verification-and-telemetry-baseline/02-04-PLAN.md`
- `test -f .planning/phases/02-verification-and-telemetry-baseline/02-VALIDATION.md && echo VALIDATION_CREATED=true || echo VALIDATION_CREATED=false`
- `gsd-plan-checker` re-review verdict: `PASS`
- Revision loop closed the initial checker blockers by:
- adding CI wiring plus a harness-smoke verify path to `02-01`
- switching `02-02` and `02-03` verification to repo-local npm scripts instead of a bare global Supabase CLI assumption
- adding explicit Playwright browser install/setup to `02-03`
- adding route-level telemetry adoption tests plus the approved Nyquist contract to `02-04` / `02-VALIDATION`
- Research constraints preserved in the plan set:
- `node:test` retained for SAFE-01
- SAFE-02 explicitly requires real local Supabase plus authenticated anon clients
- SAFE-03 is seeded and provider-free in CI
- SAFE-04 extends `lib/api.ts` JSON logging instead of adding a new observability system

- Phase 1 execution completed on 2026-03-26 for [ROADMAP.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) phase `Workflow Integrity Guardrails`.
- Completed plan stack and commit trail:
- `21a9921` + `ed761a6` + `75cd5e2` + `facc21b` for `01-01`
- `1928bb0` + `f47b91b` for `01-04`
- `287e3cf` + `90a654b` for `01-02`
- `438360f` + `d0d8f7f` for `01-03`
- Final verification evidence:
- `node --experimental-strip-types --test tests/phase-01/draft-save-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-01/version-restore-contract.test.ts`
- `node --experimental-strip-types --test tests/phase-01/workflow-stage-ownership.test.ts`
- `node --experimental-strip-types --test tests/phase-01/generate-workspace-contract.test.ts`
- `npm run build`
- Build-time fixes discovered and closed during final verification:
- narrowed `/generate` `docType` state/handler typing so the extracted save helper compiles cleanly under Next type checking
- removed the `.ts` extension dependency from [workflow-stage.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/workflow-stage.ts) so the helper works in both Node strip-types tests and Next production builds
- Planning artifacts updated after verification:
- [STATE.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/STATE.md) now marks Phase 1 complete and Phase 2 ready for planning
- [ROADMAP.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) now shows Phase 1 as complete with 4/4 plans finished
- [REQUIREMENTS.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/REQUIREMENTS.md) now marks `FLOW-01` through `FLOW-04` complete

- Phase 1 planning completed on 2026-03-26 for [ROADMAP.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) phase `Workflow Integrity Guardrails`.
- Initial planner pass produced 3 plans in 2 waves under [.planning/phases/01-workflow-integrity-guardrails](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/01-workflow-integrity-guardrails), then the checker found 2 blockers:
- `FLOW-02` coverage was incomplete because authoritative stage-transition routes were not explicitly planned
- verification relied on `npm run lint` only, which was too weak for workflow-contract changes
- Revision added `01-04-PLAN.md` to centralize authoritative workflow-stage transitions across intake/planning/outline/draft/review/export routes, and strengthened verification across the plan set with executable behavior checks.
- Final verified plan set:
- [01-01-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/01-workflow-integrity-guardrails/01-01-PLAN.md)
- [01-02-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/01-workflow-integrity-guardrails/01-02-PLAN.md)
- [01-03-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/01-workflow-integrity-guardrails/01-03-PLAN.md)
- [01-04-PLAN.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/phases/01-workflow-integrity-guardrails/01-04-PLAN.md)
- Final wave structure:
- Wave 1: `01-01`, `01-02`, `01-04`
- Wave 2: `01-03`
- Checker outcome after revision: 0 blockers, 1 warning. The remaining warning is that `01-04-PLAN.md` spans 10 files and should be executed with extra discipline or split later if execution friction appears.
- Coverage verification from checker:
- `FLOW-01` → Plans `01`, `03`
- `FLOW-02` → Plan `04`
- `FLOW-03` → Plans `02`, `03`
- `FLOW-04` → Plan `02`
- Verification evidence for the planning run:
- planner output reported 4 executable plan files written for Phase 1
- checker output reported requirement coverage pass, dependency correctness pass, verification derivation pass, and CLAUDE/AGENTS compliance pass
- direct filesystem verification confirmed all four `*-PLAN.md` files exist in the phase directory
- Worktree note: `tasks/lessons.md` had unrelated pre-existing modifications during the planning run and was intentionally left out of the planning-doc commit.

- Brownfield GSD project initialization completed on 2026-03-26 for the existing official-document generation platform.
- Created and committed [.planning/PROJECT.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/PROJECT.md) plus [.planning/config.json](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/config.json) using recommended defaults: `yolo`, `standard` granularity, parallel execution, committed docs, and research/plan-check/verifier enabled.
- Research stage completed via parallel researcher agents and synthesized into `.planning/research/`: `STACK.md` (136 lines), `FEATURES.md` (172), `ARCHITECTURE.md` (425), `PITFALLS.md` (136), `SUMMARY.md` (161).
- Defined 19 v1 requirements in [.planning/REQUIREMENTS.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/REQUIREMENTS.md), centered on workflow integrity, safety rails, grounded drafting trust, durable operations, and generate-workspace maintainability.
- Roadmapper produced a 5-phase roadmap with full traceability coverage in [.planning/ROADMAP.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) and [.planning/STATE.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/STATE.md):
- Phase 1: Workflow Integrity Guardrails
- Phase 2: Verification and Telemetry Baseline
- Phase 3: Grounded Drafting and Review Trust
- Phase 4: Durable Execution and Export Hardening
- Phase 5: Generate Workspace Decomposition
- Verification checks included reading the generated `PROJECT.md`, `config.json`, `SUMMARY.md`, `REQUIREMENTS.md`, `ROADMAP.md`, and `STATE.md`, plus `ls -la .planning/research`, `wc -l .planning/research/*.md`, and final `git status --short`.
- Workflow note: `node "$HOME/.codex/get-shit-done/bin/gsd-tools.cjs" generate-claude-md` updated [CLAUDE.md](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/CLAUDE.md) rather than `AGENTS.md`; kept that generated project guide as-is because the repo already has a hand-authored `AGENTS.md`.

- Codebase map refresh completed on 2026-03-26 via four parallel `gsd-codebase-mapper` agents with isolated scopes: tech, arch, quality, and concerns.
- Refreshed outputs verified in `.planning/codebase/`: `STACK.md` (85 lines), `INTEGRATIONS.md` (117), `ARCHITECTURE.md` (166), `STRUCTURE.md` (187), `CONVENTIONS.md` (118), `TESTING.md` (151), `CONCERNS.md` (138).
- Verification commands:
- `ls -la .planning/codebase`
- `wc -l .planning/codebase/*.md`
- `git status --short`
- Worktree after refresh only contained the seven regenerated codebase documents plus `tasks/todo.md`, so the documentation commit was safe to create without bundling unrelated changes.

- Codebase map output created in `.planning/codebase/`: `STACK.md`, `INTEGRATIONS.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`.
- Mapping process note: the dedicated `gsd-codebase-mapper` subagents failed twice due upstream stream disconnects, so the run was completed via the workflow's sequential local-analysis fallback.
- Verification: `wc -l .planning/codebase/*.md` returned 43-55 lines per document, and the secret-pattern grep over `.planning/codebase/*.md` returned no matches.

- Install source: `https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.codex/INSTALL.md`
- Expected setup from upstream instructions:
- clone `https://github.com/obra/superpowers.git` to `~/.codex/superpowers`
- create symlink from `~/.agents/skills/superpowers` to `~/.codex/superpowers/skills`
- verify the symlink resolves correctly
- Result: cloned repo to `/Users/agent/.codex/superpowers`, created `/Users/agent/.agents/skills/superpowers` symlink, and verified `readlink` resolves to `/Users/agent/.codex/superpowers/skills`

- Root cause: 协作写作版本引入了 `drafts` 新字段、`writing_rules / reference_assets / document_versions` 新表，以及 `usage_events` 新 action 约束；但 README、部署清单和 `check:deploy` 仍只要求首个 migration，容易导致数据库未升级时“保存草稿”和“AI 生成”同时失败。
- Code change: 为后端统一错误处理增加 schema mismatch 识别，遇到缺列、缺表、旧约束等典型异常时，返回“请执行最新 Supabase migrations”的明确提示，而不是笼统的“系统繁忙”。
- Guardrail: `scripts/check-deploy.mjs` 现在会列出仓库内全部 migration，并明确要求按顺序全部执行。
- Docs: README 与部署清单已同步更新为执行全部 migration，尤其是 `20260321110000_collaborative_writing_upgrade.sql`。
- Additional runtime fix: 当前出现的 `Cannot find module './948.js'` 是 `.next` 开发产物错位导致，旧 `webpack-runtime.js` 仍按 `.next/server/948.js` 加载，而实际 chunk 位于 `.next/server/chunks/948.js`。已将旧 `.next` 隔离为 `.next_stale_20260323_1`，并重建干净产物。
- Outline planning upgrade: 新增“结构共创”阶段，AI 会先给出 3 种差异明显的结构建议，用户选定后可继续调段数、顺序和每段主题，再生成正式提纲。
- Data model/API: `drafts` 新增 `planning` 持久化字段，工作流阶段新增 `planning`，新增 `/api/ai/outline-plan`，并让 `/api/ai/outline` 支持基于已确认结构生成正式提纲。
- Frontend flow: 生成页步骤栏扩展为 5 步，新增结构建议卡片、方案选择、段落顺序调整、新增/删除段落和“基于该结构生成正式提纲”入口，同时保留“直接生成提纲”快捷路径。
- Latest runtime fix: 结构共创现在允许“保存编辑中的未完成段落”，但在“生成正式提纲”前会先校验每一段是否补全；同时前端把结构共创段数限制为最多 8 段，避免用户新增空白段或超上限时直接打到后端报错。
- Backend guardrail: `/api/ai/outline` 不再盲目信任草稿里已有的 `planning.sections`；如果从历史草稿恢复到不完整结构，会返回明确的“请先补全结构段落”提示，而不是继续在后续工作流里隐式失败。
- Dev runtime fix: 本地 `next dev` 生成的 `.next/server/webpack-runtime.js` 会错误地按 `./<id>.js` 加载数字 chunk，但真实文件位于 `.next/server/chunks/<id>.js`。已新增 [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs)，在 `npm run dev` 启动后自动修补 runtime，使数字 chunk 走 `chunks/<id>.js`，避免再次出现 `Cannot find module './682.js'` / `./948.js`。
- Planning UX simplification: 结构共创卡片默认只保留“段落标题 / 本段内容”两个主编辑项，`purpose / orderReason` 改为“AI 结构说明”折叠区中的只读信息，不再让用户在主流程里维护结构解释字段。
- Planning normalization: `/api/ai/outline` 现在只要求确认结构时提供 `headingDraft / topicSummary`，并在正式提纲生成前统一自动补齐/重写 `purpose / orderReason`，避免旧解释字段与用户调整后的结构脱节。
- Draft generation root cause: “分段成文”原先直接把完整 outline JSON 喂给模型，且在模型输出截断/解析失败时静默退回 `purpose + keyPoints` 拼正文，导致提纲说明混入正文、正文像提纲扩写。
- Prompt/input refactor: 正文生成与单段重写现在统一改为基于 section brief 成文，只暴露 `id / heading / mustCover / writingTask` 作为写作约束，不再把完整提纲解释文本直接提供给模型复述。
- Quality gate: full draft 和 section rewrite 都新增结构一致性、正文长度、句群完整度、提纲目的复述、关键要点照抄等校验；首次不合格会自动带着问题清单重试 1 次，仍失败则返回明确错误码 `DRAFT_GENERATION_INVALID / SECTION_GENERATION_INVALID`。
- Failure semantics: 已移除 `purpose + keyPoints` 的正文兜底，以及 `normalizeDraftSections` 用 `outline.purpose` 填空正文的逻辑；生成失败时不会保存 `sections / generated_content`，也不会创建错误版本快照。
- Token budget: `callModel` 现在支持按任务传入 `maxTokens`，并为 intake / outline / planning / draft / section rewrite / revise / review 分别配置了不同预算，优先降低多段正文 JSON 被截断的概率。
- Dev startup regression: 用户再次报告 `Cannot find module './948.js'` 时，仓库内 `.next/server/webpack-runtime.js` 实际已被修补为 `chunks/948.js`，说明问题不再是“补丁缺失”，而是 `next dev` 首次产物与首个请求之间存在竞态，同时启动脚本未隔离旧 `.next`，也没有透传 `--port` 参数。
- Dev script fix: [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs) 现在会在启动前自动把已有 `.next` 重命名为 `.next_stale_<timestamp>`，避免 `next build` 与 `next dev` 共用缓存；同时改为转发 CLI 参数并默认绑定 `127.0.0.1`，和 `start.command` 的动态端口逻辑保持一致。
- Draft UX addition: 在 [app/generate/page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) 为“分段成文”和“定稿检查”阶段新增“重新生成正文”按钮，直接复用现有 full draft 接口，让用户无需先清空正文也能按当前提纲整稿重生成。
- Safety guard: 当当前已有正文时，“重新生成正文”会先弹出确认框，明确告知会覆盖现有整稿内容；触发时会先清空当前定稿检查结果，避免旧 review 状态误导用户。
- Generate page runtime fix: 针对用户再次反馈的 `Cannot read properties of null (reading 'useContext')`，已将 [app/generate/page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) 从 `useRouter / useSearchParams / Suspense` 方案改为浏览器原生导航和 `window.location.search` 读取草稿 id，避免该页面在运行时依赖 app router context。
- Verification:
- `npm run check:deploy`
- `npm run build`
- 启动全新 `npm run dev` 后，访问 `/generate` 不再出现 `Cannot find module './948.js'`，而是正常进入登录重定向流程
- `npm run build`（结构共创方案上线后再次验证通过）
- `npm run build`（补上结构共创本地校验、草稿宽松保存与 outline 路由兜底校验后再次通过）
- `npm run dev`（通过新启动脚本自动修补 `.next/server/webpack-runtime.js` 的 chunk 路径）
- `curl -i http://127.0.0.1:3003/login` 返回 `200 OK`
- `curl -I http://127.0.0.1:3003/does-not-exist` 返回登录重定向 `307`，未再触发 `_not-found/page` 的 chunk 缺失报错
- `npm run build`（结构共创轻量化改版后再次通过）
- `npm run build`（正文生成改为 brief 驱动、增加质量闸门与 token 分级后再次通过）
- 静态检查 [scripts/run-next-dev.mjs](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/scripts/run-next-dev.mjs) 与当前 [.next/server/webpack-runtime.js](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.next/server/webpack-runtime.js)，确认 runtime 目标路径已是 `chunks/<id>.js`
- `PORT=3003 npm run dev -- --port 3003` 在当前沙箱环境下因 `listen EPERM` 无法完成端口监听，说明此处无法做真正的本地 dev 端到端验证；脚本级修复已完成，但仍需你在本机正常终端再跑一次 `npm run dev`
- `npm run build`（新增“重新生成正文”入口与覆盖确认后再次通过）
- `npm run build`（`/generate` 去掉 `next/navigation` hook 依赖后再次通过）
