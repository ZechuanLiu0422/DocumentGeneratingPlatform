# Project Research Summary

**Project:** DocumentGeneratingPlatform
**Domain:** AI-assisted official-document drafting platform
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

DocumentGeneratingPlatform is already a capable brownfield product for staged drafting of four Chinese official document types. The research is consistent on one point: the next milestone should not broaden scope or replace the core stack. The correct move is to harden the existing Next.js + Supabase + server-managed AI system into a workflow-safe, reviewable, and production-ready document platform. Experts build this kind of product by making the server the only authority for workflow state, grounding outputs in approved source material, and treating review, traceability, and export fidelity as first-class product features rather than cleanup work after generation.

The recommended approach is opinionated. Keep the monolith, upgrade the platform line, and add the missing operational rails: durable jobs, distributed rate limiting, observability, and tests at the database, domain, and browser layers. On the product side, focus the next milestone on trustworthy outputs and trustworthy workflow state: grounded drafting with visible source references, clear review/version flows, and official-format export that survives real use. This milestone should deepen the existing four document types rather than expand into new ones or generic chat UX.

The main risks are also clear. The biggest immediate failure mode is client-controlled workflow state corrupting drafts and versions. After that come weak auth/RLS verification, refactoring the giant `/generate` surface before test rails exist, and persisting AI output without stronger contracts and recovery paths. Mitigation is straightforward: narrow mutation contracts, add forged-payload and policy tests, split editable fields from protected workflow state, and postpone broader UI decomposition until the current behavior is pinned down.

## Key Findings

### Recommended Stack

The stack guidance is to preserve the current architecture and modernize it instead of rewriting it. Next.js, React, TypeScript, Supabase Postgres/Auth/Storage, and the existing multi-provider AI abstraction are still the right fit because the product's hard problems are workflow integrity, governance, and export reliability rather than framework capability. The next milestone should standardize on a modern supported platform line and add missing production infrastructure around the existing app.

**Core technologies:**
- Next.js 16.1.x + React 19.2 — current supported app/runtime baseline; upgrade to remove unnecessary platform risk and unlock current patterns.
- Node.js 22 LTS — standardize local, CI, and hosting runtime for stable surrounding-tool compatibility.
- Supabase Postgres/Auth/Storage — keep as the single source of truth with SQL-first migrations, RLS, and storage-backed reference assets.
- Existing server-managed AI provider layer — keep as the governance boundary for Claude, OpenAI-compatible, Doubao, and GLM routing.
- Trigger.dev 4.x — add for durable long-running generation, export, retries, and idempotent background work.
- Upstash Redis rate limiting — replace single-process throttling with distributed rate limiting suitable for real deployments.
- Sentry + Vitest + Playwright + pgTAP — add now for observability and coverage across route logic, browser flows, and RLS/invariants.

### Expected Features

The research says the product is past the point where "AI draft generation" is enough. Enterprise users now expect grounded drafting, traceable outputs, reliable review/version flows, and strong formatting/export behavior. The next milestone should close those trust gaps before pursuing more breadth.

**Must have (table stakes):**
- Grounded drafting from approved internal sources — outputs must reflect internal materials, not generic model prose.
- Inline rewrite and section regeneration — users expect to refine sections without restarting the whole document.
- Visible citations or source traceability — at least section-level provenance for generated claims.
- Reliable review, keep/discard/regenerate, and version restore — existing strengths that must become more dependable and clearer.
- Official-format export fidelity — generated documents must survive Word-based circulation with minimal cleanup.
- Reusable content library and audit trail — approved phrases, templates, and lifecycle accountability are baseline expectations.
- Predictable workflow state and resumability — users must be able to reopen drafts without stage corruption.

**Should have (competitive):**
- Official-document policy checker before export — strongest near-term differentiator because it fits the niche directly.
- Citation-backed review mode — reviewers should inspect source support before approving sections.
- Template-constrained generation for `通知`, `函`, `请示`, and `报告` — enforce output shape, not just best-effort prompting.
- Organization memory with ranked exemplars — surface relevant prior documents and reusable patterns.
- Draft risk flags and version diff/redline — governance-focused review tools rather than generic AI flourishes.
- Chinese official-writing quality packs — domain-specific rules and phrase banks for the supported document set.

**Defer (v2+):**
- Real-time multi-user co-editing
- Generic chat-first writing workspace
- Expansion into many new document types
- User-managed model keys
- Autonomous sending/submission
- Broad multimodal content studio scope

### Architecture Approach

The architecture direction is to keep the app as a Next.js App Router monolith with Supabase as the data/auth boundary, but reshape it into a workflow-centered system. The browser should become a thin stage UI that owns transient UX state only. All stage transitions, generated artifacts, version mutations, and protected workflow fields should move behind workflow route handlers and shared application services. The immediate architectural target is not scale-by-topology; it is explicit write ownership, smaller testable boundaries, and a thinner `/generate` route shell.

**Major components:**
1. Generate route shell + `GenerateWorkspace` — minimal bootstrap, route/session state, and stage orchestration UI.
2. Stage modules (`Intake`, `Planning`, `Outline`, `Draft`, `Review`, `Versions`) — focused stage rendering and callbacks only.
3. Workflow route handlers + application services — authoritative mutation boundary for stage transitions, persistence, validation, and snapshots.
4. Draft read/edit services — explicit split between editable fields and protected workflow state.
5. Deferred side panels/data loaders — versions, assets, rules, phrases, and contacts loaded on demand instead of first paint.

### Critical Pitfalls

1. **Client remains a second source of truth for workflow state** — reject protected fields on generic draft routes and force workflow mutations through server-owned transitions only.
2. **Assuming Supabase auth/RLS alone is enough** — keep request-time access on user-scoped clients, isolate service-role usage, and add owner/other-user/anon policy tests.
3. **Refactoring the giant authoring page before tests exist** — add route, logic, and browser coverage before decomposing the UI.
4. **Persisting AI output as trusted structured state without schema/eval hardening** — validate outputs before persistence, version prompt/schema contracts, and keep failed generations out of canonical state.
5. **Mixing trusted instructions with untrusted references** — separate policy/rule context from retrieved content and run prompt-injection adversarial tests.
6. **Keeping long-running AI/export work inside synchronous requests** — move expensive work to durable jobs with idempotency and resumability.

## Implications for Roadmap

Based on the combined research, the roadmap should start with integrity and safety rails, then add trust-building product features on top of that foundation, and only then tackle asynchronous hardening and broader polish.

### Phase 1: Workflow Integrity and Safety Rails
**Rationale:** Everything else depends on trusted draft state and test coverage. This phase removes the highest-probability corruption and regression risks first.
**Delivers:** Protected draft mutation contracts, explicit editable vs workflow-owned write paths, auth/RLS negative coverage, baseline Vitest/Playwright/pgTAP coverage, initial Sentry instrumentation.
**Addresses:** Predictable workflow state, review/version reliability, security posture.
**Avoids:** Client-controlled workflow corruption, auth drift, unsafe refactors without tests.

### Phase 2: Grounded Drafting and Review Trust
**Rationale:** Once workflow state is trustworthy, the biggest product gap is output trustworthiness. Citations, grounded drafting, and reviewability make the product feel enterprise-ready.
**Delivers:** Approved-source grounding, section-level citations, review/audit improvements, version compare/redline, stronger template-constrained generation for the four supported document types, reusable content surfaced more explicitly in flow.
**Uses:** Existing provider abstraction, Supabase Storage/reference assets, document-type schemas, server-side workflow services.
**Implements:** Workflow application services, read-model normalization, stage-level review components.
**Avoids:** Unverifiable AI claims, untrusted retrieval behavior, policy-off outputs.

### Phase 3: Durable Jobs and Operational Hardening
**Rationale:** After correctness and trust are in place, move expensive generation/export work out of request lifecycles and harden production behavior.
**Delivers:** Trigger.dev-backed generation/export jobs, idempotency keys, Upstash rate limiting, structured stage/job telemetry, provider-tagged failures, resumable long-running operations.
**Uses:** Trigger.dev, Upstash Redis, Sentry, existing monolith boundaries.
**Implements:** Queue-backed execution for expensive stages and export.
**Avoids:** Timeouts, duplicate generations, retry-related corruption, poor incident visibility.

### Phase 4: Generate Surface Decomposition and Performance Cleanup
**Rationale:** The UI should be decomposed only after contracts and tests are stable. This phase improves maintainability and performance without risking hidden behavior changes early.
**Delivers:** Thin `app/generate/page.tsx` route shell, `GenerateWorkspace`, extracted stage modules/hooks, deferred loading for secondary data, cleaner client/server boundaries.
**Uses:** Locked server contracts, test baseline, normalized read models.
**Implements:** Stage-based frontend composition and on-demand data loading.
**Avoids:** Large unsafe refactors and bundle/startup regressions.

### Phase Ordering Rationale

- Integrity comes first because grounded drafting, review, and async execution are all unsafe if workflow state can still be overwritten from the client.
- Trust features come before broad UI cleanup because they create the clearest user-facing improvement for the official-document niche.
- Async jobs come after contract hardening because durable execution without idempotent, authoritative state just makes corruption harder to diagnose.
- UI decomposition comes last because the current architecture research explicitly warns against structural cleanup before test rails and write boundaries are stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** Grounded drafting, citation model, and policy-checker design need focused research on provenance UX, retrieval boundaries, and evaluation strategy.
- **Phase 3:** Durable job orchestration and idempotent stage execution need implementation research for the current provider/export flows.

Phases with standard patterns (skip research-phase):
- **Phase 1:** Route contract narrowing, auth/RLS tests, Sentry setup, and baseline test harnesses are well-documented and should move directly into requirements/planning.
- **Phase 4:** Stage extraction and lazy-loading patterns are standard once the server contracts are fixed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based mostly on current official docs and a clear brownfield-fit recommendation, not speculative tooling trends. |
| Features | MEDIUM-HIGH | Strong market signal from current enterprise document products; differentiator choices still require product judgment. |
| Architecture | HIGH | Closely matched to current repo problems and grounded in App Router/Supabase patterns that fit the existing system. |
| Pitfalls | HIGH | Strong alignment between official platform guidance and the repo's documented risk profile. |

**Overall confidence:** HIGH

### Gaps to Address

- Citation representation in `.docx` export — define whether citations stay section-level in-app only, appear inline, or render as appendix/endnotes before implementation starts.
- Policy checker scope — decide whether the first version is rule-based validation only or includes model-assisted checks with human review.
- Historical exemplar retrieval strategy — confirm metadata/search approach before adding ranked organization memory.
- Local runtime fragility around custom Next dev patching — validate whether it remains in scope for this milestone's production-readiness work or should be isolated separately.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — platform direction, operational tooling, and upgrade order
- `.planning/research/FEATURES.md` — table stakes, differentiators, and anti-features
- `.planning/research/ARCHITECTURE.md` — workflow-centered monolith shape and write-ownership rules
- `.planning/research/PITFALLS.md` — critical failure modes, phase warnings, and mitigation strategy
- `.planning/PROJECT.md` — current product scope, active requirements, and constraints
- Official Next.js, Supabase, Trigger.dev, Sentry, Microsoft, Google, Adobe, and PandaDoc documentation cited in the research files

### Secondary (MEDIUM confidence)
- Product-fit inferences about deferring pgvector, Vercel AI SDK, agent frameworks, and broad collaboration scope until workflow trust is solved

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
