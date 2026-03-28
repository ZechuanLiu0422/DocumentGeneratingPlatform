# Roadmap: DocumentGeneratingPlatform

## Overview

This brownfield roadmap hardens the existing drafting platform in the order the codebase can safely absorb: first make workflow state authoritative, then add verification rails, then improve drafting trust, then move fragile long-running work into durable operations, and only after those contracts are stable split apart the generate surface for maintainability and performance.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions after planning

- [x] **Phase 1: Workflow Integrity Guardrails** - Make server-owned draft state and stage transitions authoritative.
- [x] **Phase 2: Verification and Telemetry Baseline** - Add automated safety rails and observability around workflow behavior.
- [x] **Phase 3: Grounded Drafting and Review Trust** - Make generated output reviewable, provenance-backed, and safer to accept.
- [x] **Phase 4: Durable Execution and Export Hardening** - Move fragile long-running work into resumable operational paths.
- [ ] **Phase 5: Generate Workspace Decomposition** - Reduce generate-surface complexity and improve load performance without changing trusted behavior.

## Phase Details

### Phase 1: Workflow Integrity Guardrails
**Goal**: Users can move through the drafting workflow without client-side writes corrupting protected draft state, versions, or stage metadata.
**Depends on**: Nothing (first phase)
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. User can save editable draft content and see that generated artifacts, workflow metadata, and version counters remain unchanged unless a server workflow action explicitly updates them.
  2. User can advance through intake, planning, outline, drafting, review, and export only by using supported workflow actions, not by posting forged client state.
  3. User can reopen an in-progress draft and resume from the last confirmed workflow stage with the expected content and stage status intact.
  4. User can restore a previous version and continue editing with consistent active content, workflow metadata, and version numbering.
**Plans**: 4 complete (`01-01` draft save hardening, `01-02` restore snapshot hardening, `01-03` generate workspace hydration alignment, `01-04` authoritative stage transition centralization)

### Phase 2: Verification and Telemetry Baseline
**Goal**: Maintainers and operators can prove workflow correctness, auth isolation, and runtime health before shipping refactors.
**Depends on**: Phase 1
**Requirements**: SAFE-01, SAFE-02, SAFE-03, SAFE-04
**Success Criteria** (what must be TRUE):
  1. Maintainer can run automated tests in CI that validate workflow routes, persistence helpers, and core validation contracts.
  2. Maintainer can run automated auth and RLS regression checks that demonstrate one user cannot read or mutate another user's drafting data.
  3. Maintainer can run a browser smoke test that exercises the core generate flow from loading a draft to review or export readiness.
  4. Operator can inspect structured telemetry for workflow errors, AI provider failures, and export performance without reproducing issues locally.
**Plans**: 4 complete (`02-01` contract-suite baseline, `02-02` local auth/RLS harness, `02-03` seeded browser smoke, `02-04` telemetry and health coverage)

### Phase 3: Grounded Drafting and Review Trust
**Goal**: Users can review and refine AI-generated content with clear provenance, focused regeneration controls, and document-specific checks.
**Depends on**: Phase 2
**Requirements**: TRUST-01, TRUST-02, TRUST-03, TRUST-04, TRUST-05
**Success Criteria** (what must be TRUE):
  1. User can generate draft sections using approved reference assets and recognize that the output is tied to organizational source material rather than generic model text alone.
  2. User can inspect provenance for generated sections during review and understand which sources informed the current content.
  3. User can run document-type-specific policy or compliance checks before export and see actionable issues that need review.
  4. User can compare meaningful differences between versions or regenerated content before accepting a change.
  5. User can regenerate or revise one section while keeping approved content in other sections unchanged.
**Plans**: 4 plans
Plans:
- [x] 03-01-PLAN.md — Trust contract and persistence foundation for provenance, review state, and compare payloads
- [x] 03-02-PLAN.md — Ground accepted draft sections in approved-source provenance and expose it in the existing workspace
- [x] 03-03-PLAN.md — Add document-type review packs, review freshness persistence, and export trust gating
- [x] 03-04-PLAN.md — Convert regenerate/revise/restore to compare-before-accept flows with section-scoped guarantees
**UI hint**: yes

### Phase 4: Durable Execution and Export Hardening
**Goal**: Users can complete long-running generation and export work reliably through resumable, operationally safe server execution.
**Depends on**: Phase 3
**Requirements**: OPS-01, OPS-02, OPS-03, UX-03
**Success Criteria** (what must be TRUE):
  1. User can start generation or export work that continues safely outside a fragile request-response window.
  2. User can retry or resume interrupted generation and export work without duplicate side effects or corrupted draft state.
  3. Platform behavior remains stable across restarts or multiple instances because rate limits and job coordination are enforced outside a single process.
  4. User can export a final document without waiting on wasteful base64-heavy client decode flows.
**Plans**: 4 plans
Plans:
- [x] 04-01-PLAN.md — Durable-operation contracts, migration, and provider-free harness foundation
- [x] 04-02-PLAN.md — Distributed limiter, lease/idempotency coordination, and autonomous runner drain path
- [x] 04-03-PLAN.md — Async draft/revise route adoption plus status polling and telemetry
- [x] 04-04-PLAN.md — Export artifact storage, binary download route, and browser export hardening

### Phase 5: Generate Workspace Decomposition
**Goal**: Users get a faster-loading generate workspace, and maintainers can evolve the stage UI through smaller, safer frontend modules.
**Depends on**: Phase 2, Phase 4
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. User can open the generate workspace and begin core drafting work before non-critical side-panel data finishes loading.
  2. Maintainer can change stage-specific UI behavior in isolated modules or hooks without editing one monolithic page file for every change.
  3. The generate experience preserves existing workflow behavior after the refactor because the UI now sits on already-tested server contracts.
**Plans**: 3 plans
Plans:
- [x] 05-01-PLAN.md — Shell/bootstrap split, controller foundation, and delayed-endpoint readiness proof
- [x] 05-02-PLAN.md — Intake/planning/outline module extraction on the shared controller boundary
- [ ] 05-03-PLAN.md — Draft/review/sidebar extraction plus final deferred-loading verification
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Workflow Integrity Guardrails | 4/4 | Complete | 2026-03-26 |
| 2. Verification and Telemetry Baseline | 4/4 | Complete | 2026-03-27 |
| 3. Grounded Drafting and Review Trust | 4/4 | Complete | 2026-03-27 |
| 4. Durable Execution and Export Hardening | 4/4 | Complete | 2026-03-28 |
| 5. Generate Workspace Decomposition | 2/3 | In Progress | - |
