# Domain Pitfalls

**Domain:** Brownfield Next.js + Supabase + AI document workflow hardening
**Researched:** 2026-03-26

## Critical Pitfalls

Mistakes here usually force rework, data cleanup, or emergency production controls.

### Pitfall 1: Letting the browser remain a second source of truth for workflow state
**What goes wrong:** Teams keep a convenience write path where the client can post full draft objects, workflow stages, generated artifacts, or version counters directly. That creates two authorities: the UI and the server workflow.
**Why it happens:** Brownfield teams try to preserve velocity during refactors, so they tighten auth/RLS but do not narrow the mutation surface. In this repo, that risk is already visible in the direct draft write path called out in `CONCERNS.md`.
**Consequences:** Corrupted workflow history, skipped stages, broken restore/version logic, and support cases where the database contains states the trusted AI routes would never produce.
**Warning signs:**
- API handlers accept client-supplied `workflow_stage`, `planning`, `outline`, `sections`, `generated_*`, or `version_count`.
- Support/debugging requires asking "which route wrote this row?"
- Route tests assert ownership but not field-level mutation authority.
- Frontend optimistic state is routinely written back wholesale.
**Prevention:** Make workflow progression server-authoritative. Split draft fields into `user_editable` vs `server_managed`, reject writes to protected fields in the generic drafts route, and have AI/stage routes mutate state through one store abstraction only.
**Detection:** A contract test that posts a forged draft payload and proves protected fields are ignored or rejected. Audit logs should identify the exact route/class of mutation for every workflow state change.
**Phase where it should be addressed:** Phase 1 - Workflow integrity hardening

### Pitfall 2: Assuming Supabase auth plus RLS is enough while server code quietly bypasses the real trust model
**What goes wrong:** Teams believe "RLS is on" means data access is safe, but server code using elevated credentials, weak policies, or nullable auth assumptions still creates cross-tenant or privilege bugs.
**Why it happens:** Supabase makes the happy path fast, and brownfield apps often mix anon/authenticated SSR clients with service-role admin flows without a clean boundary.
**Consequences:** Silent authorization drift, accidental broad reads/writes from server routes, and policies that pass basic manual testing but fail under edge cases.
**Warning signs:**
- Policies depend on `auth.uid()` semantics without explicitly handling unauthenticated/null cases.
- Service-role usage leaks into normal request paths instead of admin-only jobs.
- Tests cover "owner can access" but not "other authenticated user cannot" and "unauthenticated user cannot."
- Debugging access bugs requires reading both SQL policies and route code because neither is authoritative alone.
**Prevention:** Treat RLS as a database guardrail, not your full authorization model. Keep request-time reads/writes on user-scoped clients, isolate service-role usage to explicit admin/background operations, and add negative policy tests for every sensitive table involved in drafts, rules, assets, and versions.
**Detection:** Policy tests that run the same query as owner, other user, and unauthenticated user. Review any server module that can instantiate privileged Supabase clients.
**Phase where it should be addressed:** Phase 1 - Auth/RLS verification baseline

### Pitfall 3: Refactoring the giant authoring page before test rails exist
**What goes wrong:** Teams correctly identify the monolithic page as a problem, then start splitting components/hooks without first pinning current behavior with route, state, and browser coverage.
**Why it happens:** The UI complexity is obvious and painful, while the missing test harness is invisible work. In brownfield projects that creates pressure to "clean up first."
**Consequences:** Regressions in stage transitions, save timing, restore behavior, export state, and quota/rate-limit UX that only appear after release.
**Warning signs:**
- The first decomposition PR is larger than the first test PR.
- Manual QA becomes the only confidence mechanism for intake, outline, draft, revise, review, and export flows.
- Review comments say "looks cleaner" but cannot point to preserved behavior.
- Build-only checks are treated as sufficient for high-churn workflow code.
**Prevention:** Freeze behavior before structural refactors. Add logic tests around validation/store helpers, route integration tests around critical AI and draft handlers, and one browser smoke flow for the authoring path before moving page responsibilities.
**Detection:** Require every refactor PR touching `app/generate/page.tsx` or workflow routes to include either new tests or an explicit statement that existing tests covered the behavior.
**Phase where it should be addressed:** Phase 1 - Test baseline before UI decomposition

### Pitfall 4: Treating AI outputs as trusted structured state without evals, schema hardening, and recovery paths
**What goes wrong:** Teams persist model output directly into planning/outline/sections JSON and only validate the happy path. Failures from provider variance, malformed structure, or prompt drift show up later as corrupted drafts rather than immediate errors.
**Why it happens:** Multi-provider abstractions create an illusion of interchangeability, but output reliability differs by model, prompt version, and temperature/settings.
**Consequences:** Broken stage transitions, hidden quality regressions after model/config changes, and support cases where older drafts cannot round-trip because stored AI artifacts no longer match app expectations.
**Warning signs:**
- Prompt changes ship without replaying representative drafts.
- Stored JSON shape changes are not versioned.
- "Fallback parsing" grows more complex but still writes partially trusted output.
- Operators can switch providers/models without a compatibility checklist.
**Prevention:** Version prompts and output schemas, validate AI responses before persistence, keep failed generations out of the canonical draft state, and build a small eval set of representative official-document cases covering all four document types and key edge conditions.
**Detection:** Golden-case evals on every prompt/provider change, plus round-trip tests for persisted planning/outline/section payloads.
**Phase where it should be addressed:** Phase 2 - AI contract and evaluation layer

### Pitfall 5: Feeding untrusted references, user notes, or retrieved content into the model without prompt-injection boundaries
**What goes wrong:** Teams expand AI quality by adding more context from references, prior drafts, common phrases, or uploaded material, but treat that material as benign. Untrusted content can steer instructions, leak hidden prompts, or override workflow rules.
**Why it happens:** Retrieval improves quality quickly, and the abuse mode is less visible than traditional auth bugs. Official AI docs now explicitly treat prompt injection as a primary risk when models consume external content or call tools.
**Consequences:** Unsafe or policy-off document generation, hidden system prompt leakage, incorrect use of tools/actions, and reduced trust in organization-specific writing guidance.
**Warning signs:**
- Retrieved/reference text is concatenated into prompts with no provenance or trust labeling.
- The model can act on instructions found inside user documents or historical drafts.
- There is no distinction between policy/rule context and untrusted source material.
- Review failures sound like "the model followed the source document instead of our workflow."
**Prevention:** Separate trusted instructions from untrusted document context, clearly delimit retrieved material, restrict tool/action permissions based on route intent, and require model outputs to cite or map back to approved source segments before they are promoted into canonical workflow state.
**Detection:** Adversarial eval cases with hostile reference text such as "ignore previous instructions" or requests to reveal hidden prompts. Monitor for prompt leakage phrases and anomalous tool/action attempts.
**Phase where it should be addressed:** Phase 2 - AI safety and context-boundary hardening

### Pitfall 6: Keeping long-running AI generation and export work inside synchronous web requests
**What goes wrong:** Teams harden correctness but leave slow outline/draft/review/export operations tied to request lifecycles with per-request memory, timeout, and retry semantics.
**Why it happens:** The synchronous UX works for low traffic, and queue/worker adoption feels like premature scaling until latency spikes or provider instability appears.
**Consequences:** Timeouts, duplicate generations on retries, worker starvation, poor tail latency, and partial saves when one provider call succeeds and a later persistence step fails.
**Warning signs:**
- Route handlers need elevated `maxDuration` to stay stable.
- Retries from the browser can create duplicate versions or repeated AI spend.
- Export or generation requests compete with normal page/API traffic.
- There is no idempotency key tying one user action to one durable workflow job.
**Prevention:** Introduce job semantics before scale pain becomes acute: idempotency keys, durable status records, resumable stage execution, and a queue/worker boundary for expensive generation/export steps.
**Detection:** Trace median and p95 latency by stage, count duplicate generations per draft, and alert on timeout/retry clusters.
**Phase where it should be addressed:** Phase 3 - Async job and idempotency architecture

## Moderate Pitfalls

### Pitfall 7: Letting Next.js caching and server/client boundaries create auth or freshness bugs
**What goes wrong:** Teams optimize data fetching or refactor components without fully understanding App Router caching, dynamic rendering, and server-only boundaries. Authenticated users then see stale draft state or sensitive server logic drifts toward client bundles.
**Prevention:** Mark authenticated workflow reads/writes with explicit cache behavior, verify cookie-dependent routes/components are dynamic where needed, and use `server-only` boundaries for provider/env modules.
**Warning signs:**
- "Refresh fixes it" bugs around drafts, quotas, or settings.
- A route/component behaves differently between local dev and production caching.
- Shared utility modules start importing env/provider logic into mixed server/client trees.
**Phase where it should be addressed:** Phase 2 - Data-fetching boundary review

### Pitfall 8: Evolving JSONB workflow shapes without a migration and compatibility strategy
**What goes wrong:** Teams keep using flexible JSONB blobs for planning, outline, sections, and facts, but change shapes in app code only. Old drafts then fail new validators or silently lose information.
**Prevention:** Add explicit version metadata to stored workflow payloads, write migration/backfill scripts for shape changes, and require old-draft compatibility tests before schema/prompt changes ship.
**Warning signs:**
- Validators keep accumulating optional branches for "legacy" payloads.
- Fixes for one draft record break another older record.
- DB migrations add columns, but JSONB shape changes are undocumented.
**Phase where it should be addressed:** Phase 2 - Persistence contract stabilization

### Pitfall 9: Hardening runtime behavior while ignoring operator visibility
**What goes wrong:** Teams lock down code paths but still cannot answer basic production questions: which model/provider failed, which stage retried, which policy blocked a save, or why export latency spiked.
**Prevention:** Add structured logs, per-stage metrics, provider-tagged errors, draft/job correlation IDs, and dashboards before major rollout changes.
**Warning signs:**
- Incident debugging depends on reproducing the issue locally.
- Logs show route names but not draft ID, stage, provider, or user-safe correlation IDs.
- Operators cannot separate model failure from validation failure from persistence failure.
**Phase where it should be addressed:** Phase 3 - Observability before scale-up

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Workflow integrity | Protecting routes with auth but still allowing client-controlled workflow fields | Narrow mutation contracts and add forged-payload tests |
| Auth/RLS | Relying on RLS without negative policy tests or clean service-role boundaries | Add owner/other-user/anon policy coverage and audit privileged clients |
| Test baseline | Starting UI decomposition before behavior is pinned | Add route, logic, and browser smoke coverage first |
| AI contracts | Switching providers/prompts without evals or schema versioning | Create representative eval corpus and prompt/schema versioning |
| Retrieval/context | Mixing trusted instructions with untrusted reference text | Delimit untrusted content and run prompt-injection adversarial tests |
| Persistence | Shipping JSON shape changes with no compatibility plan | Add payload versions, migration scripts, and round-trip tests |
| Async scale | Keeping expensive AI/export work inside request lifecycles | Add idempotent jobs, durable status, and queue-backed execution |
| Observability | Hardening blindly without stage-level telemetry | Add correlation IDs, structured logs, and latency/error dashboards |

## Sources

- Next.js documentation: Data Security, Server/Client Components, and caching guidance. Confidence: HIGH. https://nextjs.org/docs/app/guides/data-security ; https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning ; https://nextjs.org/docs/app/deep-dive/caching
- Supabase documentation: Row Level Security guidance, including `auth.uid()` behavior and bypass considerations. Confidence: HIGH. https://supabase.com/docs/guides/database/postgres/row-level-security
- Anthropic documentation: guardrails, prompt leak reduction, and evaluation guidance for Claude systems. Confidence: MEDIUM. https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-prompt-leak ; https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails
- OpenAI documentation: prompt injection and safety best practices for applications that consume untrusted model input/context. Confidence: MEDIUM. https://platform.openai.com/docs/guides/safety-best-practices ; https://platform.openai.com/docs/guides/prompt-injection
- Local project context: `PROJECT.md`, `CONCERNS.md`, and `TESTING.md`. Confidence: HIGH for repo-specific prioritization.
