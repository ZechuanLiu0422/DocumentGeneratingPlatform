# Phase 3: Grounded Drafting and Review Trust - Research

**Researched:** 2026-03-27
**Domain:** grounded drafting, provenance-backed review, document-specific policy checks, diff/acceptance flows
**Confidence:** MEDIUM

## Summary

Phase 3 should deepen the existing drafting workflow rather than introduce a new authoring framework. The repo already has the right brownfield primitives: approved `reference_assets`, server-owned AI routes, section-aware drafting and revising, append-only `document_versions`, a seeded Playwright smoke path, and route-level telemetry. What is missing is trust metadata and acceptance control. Today the system can pass references into prompts, regenerate one section, and create snapshots, but it cannot prove which sources informed a section, compare a candidate change before acceptance, or run document-type-specific checks with export freshness guarantees.

The safest implementation path is to keep the current `drafts` and `document_versions` aggregate model, extend the `sections` JSON shape with optional trust metadata, and add preview-first route contracts for regenerate/revise/restore flows instead of auto-applying every AI change. Provenance and policy checks should be owned by `lib/official-document-workflow.ts` and persisted through `lib/collaborative-store.ts`, while `/generate` remains a thin client orchestrator that renders source chips, compare panels, and accept/reject actions.

SAFE-03 and SAFE-04 are real constraints now, not future ideas. Phase 3 must preserve the seeded browser path in [`tests/e2e/generate-smoke.spec.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/tests/e2e/generate-smoke.spec.ts) and keep all new workflow actions observable through the existing `lib/api.ts` structured logging path. The phase is successful when trust behavior becomes inspectable and testable without destabilizing the proven generate workspace.

**Primary recommendation:** implement Phase 3 as four small brownfield-safe cuts: provenance contract, grounded section generation, policy-check freshness/gating, and compare-before-accept flows for section regenerate/revise/restore.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRUST-01 | User can generate draft content grounded in approved reference assets rather than generic model-only output | Add a server-owned reference excerpt selector plus per-section provenance metadata persisted with generated sections and version snapshots |
| TRUST-02 | User can inspect source provenance for generated sections during review | Extend section/read-model payloads to include provenance cards and render them in `/generate` review/draft panels |
| TRUST-03 | User can run document-type-specific policy or compliance checks before export | Expand `reviewWorkflow` into deterministic doc-type policy packs plus AI checks, persist the latest review result hash, and block stale export |
| TRUST-04 | User can compare meaningful draft/version differences before accepting regenerated or restored content | Add preview-first regenerate/revise/restore contracts that return candidate diffs and require explicit accept/reject |
| TRUST-05 | User can regenerate or revise a single section without losing approved content in other sections | Keep current section-targeted workflow APIs, but change them from immediate overwrite to section-scoped candidate application with unchanged-section guarantees |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Stay inside the WAT model: prefer existing repo routes, libs, scripts, and Supabase data contracts before adding new tooling.
- Keep the core stack: Next.js 14 App Router, Supabase Auth/Postgres/RLS, and the current server-managed provider abstraction.
- Keep AI keys server-only.
- Keep user isolation enforced by Supabase auth plus RLS.
- Treat `supabase/migrations/*.sql` ordering as operationally mandatory.
- Keep brownfield changes minimal and local; do not introduce broad framework churn.
- Add new API behavior under `app/api/**/route.ts` using the existing request pipeline: validate, auth, rate-limit/quota, workflow call, persist, return JSON.
- Put shared schemas in `lib/validation.ts`, not inline in route files.
- Put shared persistence logic in `lib/*` instead of duplicating Supabase queries in routes.
- Use `AppError` and `handleRouteError(...)` for expected failures.
- Preserve the existing structured telemetry pattern in `lib/api.ts`.
- No project-local `.claude/skills/` or `.agents/skills/` directories exist, so there are no extra repo-specific skill rules beyond `CLAUDE.md` and `AGENTS.md`.

## Brownfield Constraints

- [`app/generate/page.tsx`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) is still a large client component, so Phase 3 should avoid a simultaneous large UI decomposition. Add trust UI as narrow components or helper renderers first.
- [`app/api/ai/draft/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/draft/route.ts), [`app/api/ai/revise/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/revise/route.ts), and [`app/api/ai/versions/restore/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/versions/restore/route.ts) currently auto-apply changes. That behavior conflicts with TRUST-04 and should be narrowed before UI polish.
- [`lib/collaborative-store.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-store.ts) persists `sections` as JSONB inside `drafts` and `document_versions`. This is the safest place to add section trust metadata without creating a new relational graph in Phase 3.
- [`lib/official-document-workflow.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts) already merges rules and references into prompts, but today `formatReferences(...)` passes style summaries only. There is no persisted evidence map proving which asset influenced which section.
- Review is currently shallow: [`reviewWorkflow(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts) merges a few deterministic checks with generic AI review checks, but it does not compute doc-type-specific policy packs or freshness against current content.
- SAFE-03 already seeds a real `/generate` browser path with local Supabase and Playwright. Phase 3 changes must keep selectors stable enough to extend rather than replace that smoke.
- SAFE-04 telemetry already attaches `draft_id`, `workflow_action`, `workflow_stage`, and export metadata. New trust routes should extend that same metadata rather than invent a parallel log format.

## Current Implementation Assessment

### What already exists

- Approved reference assets exist and are user-selectable through [`app/api/reference-assets/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/reference-assets/route.ts).
- Session and persisted references are already loaded into AI workflows through [`loadRuleAndReferenceContext(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-route-helpers.ts).
- Section-scoped drafting exists today:
  - [`regenerateSectionWorkflow(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts)
  - section-targeted revise in [`reviseWorkflow(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts)
- Version snapshots already capture stage/title/content/sections in `document_versions`.
- Restore already returns `draft`, `restoredVersion`, and `restoredSnapshot` through [`buildRestoreResponse(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/version-restore.ts).

### What is missing

- No provenance shape in `DraftSectionRecord`, `VersionRecord`, or route responses.
- No excerpt/chunk selection step over approved references.
- No preview/accept/reject flow for section regenerate, full revise, or version restore.
- No meaningful diff representation; version history shows only `change_summary`.
- No persistent review result or review freshness hash.
- No document-type-specific policy packs beyond required ending, attachment mention, and recipient repetition.
- No export preflight that proves review results correspond to the current content.

### Requirement status by codebase reality

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| TRUST-01 | Partial: references are passed into prompts | No grounded excerpt selection, no persisted evidence, no section-to-source mapping |
| TRUST-02 | Missing | No provenance in DB, API, or UI |
| TRUST-03 | Partial | Review checks exist but are generic, not policy-pack driven, and not freshness-gated before export |
| TRUST-04 | Missing | Restore/regenerate auto-apply with no compare step |
| TRUST-05 | Partial | Section regenerate/revise preserve other sections in code, but user cannot inspect candidate diffs before overwrite |

## Standard Stack

Registry verification was not available during this offline repo research pass. Versions below are the repo-pinned or locally installed versions actually present in this workspace and should be treated as the current implementation baseline, not registry-latest claims.

### Core

| Library / Module | Version | Purpose | Why Standard Here |
|------------------|---------|---------|-------------------|
| Next.js | `14.2.0` | App Router pages and route handlers | Already owns the generate workspace and API surface |
| React | `18.2.0` | Client workspace UI | Existing `/generate` page is already client-driven |
| `@supabase/supabase-js` + Supabase SSR | `2.99.3` / `0.9.0` | Auth, persistence, RLS-backed reads/writes | Existing trust boundary for drafts, versions, rules, and references |
| `lib/official-document-workflow.ts` | repo module | Draft, revise, review workflow logic | Correct place for provenance selection and policy-pack logic |
| `lib/collaborative-store.ts` | repo module | Draft/version persistence | Correct place to extend section JSON and review metadata persistence |

### Supporting

| Library / Module | Version | Purpose | When to Use |
|------------------|---------|---------|-------------|
| `node:test` | `v24.14.0` runtime | Route/unit/persistence contracts | For provenance, diff, review-hash, and acceptance contract tests |
| `@playwright/test` | `1.58.2` | Browser smoke and trust UI assertions | For seeded compare/provenance/export-preflight flows |
| `playwright.config.ts` | repo config | Seeded browser setup | Reuse SAFE-03 storage state and local Supabase env override |
| `lib/api.ts` telemetry path | repo module | Structured request/error logging | Extend for `candidate_id`, `compare_mode`, `review_hash`, `review_status` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extending section JSON with provenance | New relational provenance tables | Cleaner normalization later, but too much migration/UI/query churn for this brownfield phase |
| Preview-first regenerate/revise/restore | Keep auto-apply behavior | Simpler routes, but fails TRUST-04 and weakens user trust |
| Existing review route plus deterministic policy packs | Separate compliance service/framework | Overkill for current four document types and current monolith |
| Lightweight targeted diff helper | Hand-rolled text diff logic | Custom diff logic is easy to get wrong; prefer a small library or a minimal compare format with explicit paragraph/section semantics |

**Installation baseline:**
```bash
# Existing repo baseline; Phase 3 should avoid broad new framework installs.
npm install
```

**Recommended add-only dependency policy:**
- Default: no new framework
- Acceptable if needed: one lightweight text diff helper only, verified against the registry during planning

## Recommended Data Contracts

### Pattern 1: Extend section records with optional trust metadata

**What:** Keep `sections` inside `drafts` and `document_versions`, but extend each section with optional provenance and review metadata.

**Recommended shape:**
```ts
type SectionSourceRef = {
  sourceType: 'reference_asset' | 'session_reference' | 'writing_rule';
  sourceId: string;
  label: string;
  excerpt: string;
  rationale: string;
};

type DraftSectionRecord = {
  id: string;
  heading: string;
  body: string;
  provenance?: {
    grounded: boolean;
    sources: SectionSourceRef[];
  };
};
```

**When to use:** TRUST-01 and TRUST-02. Persist this shape on accepted draft content and accepted version snapshots only.

**Why:** This avoids a new provenance table while giving the UI enough stable data to render source inspection and version history even if the underlying asset changes later.

### Pattern 2: Add preview-first candidate contracts

**What:** Change section regenerate, revise, and restore from “mutate immediately” to “return candidate, diff, and acceptance token.”

**Recommended response shape:**
```ts
type DraftChangeCandidate = {
  candidateId: string;
  targetType: 'section' | 'full' | 'restore';
  changedSectionIds: string[];
  before: { title: string; sections: DraftSectionRecord[] };
  after: { title: string; sections: DraftSectionRecord[] };
  diffSummary: string[];
};
```

**When to use:** TRUST-04 and TRUST-05.

**Why:** This keeps acceptance explicit, makes browser behavior testable, and avoids corrupting trusted content with every intermediate AI attempt.

### Pattern 3: Persist review freshness, not just review messages

**What:** Persist the latest review result alongside a hash or signature of the reviewed content.

**Recommended shape:**
```ts
type DraftReviewState = {
  contentHash: string;
  docType: 'notice' | 'letter' | 'request' | 'report';
  checks: ReviewCheck[];
  ranAt: string;
  status: 'pass' | 'warning' | 'fail';
};
```

**When to use:** TRUST-03.

**Why:** Export can then reject stale reviews instead of pretending the last review still applies after content changes.

## Architecture Patterns

### Recommended Project Structure

```text
app/api/ai/
├── draft/route.ts                 # generate preview candidate + accept path
├── revise/route.ts                # revise preview candidate + accept path
├── review/route.ts                # policy-pack + AI review + freshness hash
├── versions/route.ts              # list versions with summary metadata
└── versions/restore/route.ts      # restore preview candidate + accept path
lib/
├── official-document-workflow.ts  # grounded excerpt selection, policy packs, candidate generation
├── collaborative-store.ts         # accepted-content persistence + review state persistence
├── version-restore.ts             # restore candidate and diff shaping
├── generate-workspace.ts          # read-model helpers for trust metadata
└── api.ts                         # trust route telemetry metadata
tests/phase-03/
├── contracts/                     # provenance, candidate, diff, and export-preflight contracts
├── telemetry/                     # trust-route metadata
└── e2e/                           # seeded provenance/diff/export readiness flows
```

### Pattern 1: Ground references before generation, then persist accepted evidence

**What:** For each section brief, select a small set of approved excerpts from `reference_assets` and `sessionReferences`, feed those excerpts to the prompt, and persist the selected excerpts on the accepted section.

**When to use:** Full draft generation and section regeneration only.

**Recommended implementation rule:** Do not persist all active references on a section. Persist only the excerpts actually chosen for that section, capped to 2-4 evidence items.

### Pattern 2: Keep candidate changes ephemeral until acceptance

**What:** Generate candidate content and diff metadata in the route, return it to the client, and only persist on an explicit accept action.

**When to use:** Section regenerate, section revise, full revise, and version restore.

**Recommended implementation rule:** Candidate state should live in response payloads or short-lived draft-side JSON only if the UI truly needs recovery after refresh. Do not create permanent version snapshots for rejected candidates.

### Pattern 3: Deterministic policy packs first, AI review second

**What:** Expand `reviewWorkflow(...)` so deterministic doc-type-specific checks run first and AI review augments, but never replaces, them.

**When to use:** Review stage and export preflight.

**Recommended doc-type checks to add immediately:**
- `notice`: explicit work requirement/action section presence, clear notification ending
- `letter`: proper counterpart/request framing, cooperative closing
- `request`: single request focus, justification completeness, approval closing
- `report`: progress/issues/next-step coverage, report ending

### Pattern 4: Export must respect review freshness

**What:** [`app/api/generate/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/generate/route.ts) should reject export if the latest saved review hash does not match the current title + sections content.

**When to use:** TRUST-03 final slice.

**Recommended failure mode:** Return a normalized `REVIEW_STALE` or `REVIEW_REQUIRED` error and keep the user in review, rather than silently exporting unchecked content.

## Anti-Patterns to Avoid

- **Do not add a new retrieval/vector stack in Phase 3.** Approved reference assets already exist; start with deterministic excerpt selection over current stored content.
- **Do not auto-apply regenerated or restored content once TRUST-04 work starts.** That preserves the old unsafe behavior.
- **Do not create snapshots for every rejected candidate.** Version history should reflect accepted milestones, not experimentation noise.
- **Do not store provenance only as asset ids.** The UI and version history need stable human-readable excerpts, not a second lookup that may drift.
- **Do not rely on AI review alone for policy checks.** Deterministic doc-type checks are the trustworthy baseline.
- **Do not break SAFE-03 by rewriting the whole `/generate` UI in the same phase.** Trust features should be additive and test-extensible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full retrieval system | Embeddings/vector DB for four doc types in this phase | Deterministic excerpt selection over existing reference asset content | Smaller, auditable, and brownfield-safe |
| Rich compare engine | Large custom diff algorithm across arbitrary text | Section-aware compare format plus a lightweight diff helper if needed | Prevents diff correctness bugs and keeps Phase 3 scoped |
| Separate compliance service | New policy engine framework | Deterministic policy-pack functions inside `reviewWorkflow(...)` | Current rule surface is small and doc-type-specific |
| New observability stack | Vendor SDK or sidecar just for trust flows | Existing `lib/api.ts` telemetry enrichment | SAFE-04 already chose the log-first path |

**Key insight:** Phase 3 is mainly a contract-and-acceptance problem, not a platform-rewrite problem.

## Common Pitfalls

### Pitfall 1: “Grounded” means every active reference id gets attached to every section

**What goes wrong:** The system marks all selected assets as sources for all sections, which produces provenance theater rather than useful evidence.
**Why it happens:** It is easier than selecting real section-specific excerpts.
**How to avoid:** Persist only the excerpts actually chosen for the generated section and cap the evidence count.
**Warning signs:** Every section shows the same asset list regardless of content.

### Pitfall 2: Candidate compare still overwrites the accepted draft under the hood

**What goes wrong:** The UI shows a compare modal, but the route already saved the candidate and bumped version history.
**Why it happens:** Teams bolt compare UI on top of old mutate-now routes.
**How to avoid:** Split generate/revise/restore into preview and accept contracts before shipping the UI.
**Warning signs:** Refreshing the page before clicking “accept” still shows the candidate content.

### Pitfall 3: Review checks are informative only, so export can still ship stale content

**What goes wrong:** Users run review, edit content afterward, and export unchecked text because the system never verifies freshness.
**Why it happens:** Review is treated as a one-off advisory step instead of a pre-export contract.
**How to avoid:** Persist a review content hash and reject export when it is stale.
**Warning signs:** Export succeeds immediately after a content mutation without rerunning review.

### Pitfall 4: Provenance rendering makes the generate page even harder to change

**What goes wrong:** All trust UI is added inline into the already-large page component.
**Why it happens:** It is faster in the short term.
**How to avoid:** Extract narrow render helpers or child components for source chips, compare cards, and review freshness banners.
**Warning signs:** `app/generate/page.tsx` grows by hundreds of lines with duplicated trust markup.

### Pitfall 5: Version restore diff is computed against the wrong baseline

**What goes wrong:** Restore compare uses the latest version snapshot rather than the currently accepted draft state.
**Why it happens:** The version list already exists, so teams compare snapshot-to-snapshot instead of snapshot-to-live-draft.
**How to avoid:** Always diff the candidate restore result against the current accepted draft view.
**Warning signs:** Compare output ignores unsaved or post-snapshot edits.

## Code Examples

Verified repo-aligned patterns:

### Accepted section persistence should stay in the store layer

```ts
await saveDraftState(supabase, {
  userId,
  draftId,
  docType,
  provider,
  baseFields,
  workflow: {
    workflow_stage,
    sections: acceptedSections,
    generated_title,
    generated_content,
    version_count,
  },
});
```

Pattern source: [`saveDraftState(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-store.ts)

### Trust routes should keep telemetry in the shared API path

```ts
const context = createRequestContext(request, '/api/ai/revise');
context.workflow_action = 'revise';
context.draft_id = body.draftId;
context.workflow_stage = draft.workflow_stage;

return ok(context, payload, 200, {
  candidate_id: candidateId,
  changed_section_count: changedSectionIds.length,
});
```

Pattern source: existing route telemetry style in [`app/api/ai/revise/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/revise/route.ts) and [`app/api/generate/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/generate/route.ts)

### Review should merge deterministic checks with AI checks

```ts
const deterministicChecks = buildDocTypePolicyChecks(...);
const aiChecks = await callStructuredModel(...);
const mergedChecks = mergeChecksByCode(deterministicChecks, aiChecks);
```

Pattern source: deterministic + AI merge already present in [`reviewWorkflow(...)`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts)

## Smallest Safe Implementation Slices

### Slice 1: Provenance contract and persistence

**Purpose:** Create the minimal section metadata needed for TRUST-01 and TRUST-02 without changing route topology.

**Scope:**
- Extend section types in [`lib/collaborative-store.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-store.ts)
- Extend validation/read-model helpers in [`lib/generate-workspace.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/generate-workspace.ts)
- Add optional provenance rendering in `/generate`

**Why first:** Every later trust feature depends on having a stable accepted-content shape.

### Slice 2: Grounded excerpt selection for full draft and section regenerate

**Purpose:** Move from “references were available” to “this section used these approved excerpts.”

**Scope:**
- Add deterministic excerpt selection in [`lib/official-document-workflow.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts)
- Feed selected excerpts into `generateDraftWorkflow(...)` and `regenerateSectionWorkflow(...)`
- Persist selected evidence on accepted sections

**Why second:** This completes TRUST-01 while still using the current save/version path.

### Slice 3: Policy-check packs plus review freshness

**Purpose:** Make review meaningful and export-safe for TRUST-03.

**Scope:**
- Expand review checks by doc type
- Persist latest review result + content hash on the draft
- Reject export if the review is stale or missing

**Why third:** This uses existing review/export routes and telemetry without needing compare UI first.

### Slice 4: Compare-before-accept for regenerate, revise, and restore

**Purpose:** Satisfy TRUST-04 and fully satisfy TRUST-05.

**Scope:**
- Add preview responses and accept endpoints/actions
- Render compare UI in `/generate`
- Keep unchanged sections immutable across section-targeted actions

**Why fourth:** It is the highest UX surface area and should build on the now-stable provenance/review contracts.

## Planning Guidance

### Recommended plan cuts

| Plan Cut | Requirements | Files Likely Touched | Notes |
|----------|--------------|----------------------|-------|
| `03-01` Provenance contract and read model | TRUST-01, TRUST-02 | `lib/collaborative-store.ts`, `lib/generate-workspace.ts`, `lib/validation.ts`, `app/generate/page.tsx` | Keep data-shape change isolated first |
| `03-02` Grounded excerpt selection in draft workflows | TRUST-01, TRUST-05 | `lib/official-document-workflow.ts`, `app/api/ai/draft/route.ts`, tests | Full draft + section regenerate only |
| `03-03` Review policy packs and export freshness gate | TRUST-03 | `lib/official-document-workflow.ts`, `app/api/ai/review/route.ts`, `app/api/generate/route.ts`, `lib/collaborative-store.ts` | Reuse SAFE-04 telemetry fields |
| `03-04` Candidate compare and acceptance flow | TRUST-04, TRUST-05 | `app/api/ai/revise/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/versions/restore/route.ts`, `app/generate/page.tsx` | Highest UI and route coordination cost |

### Order and dependency guidance

1. Do the data-contract slice before any compare UI.
2. Add grounded generation before review gating so provenance exists when checks run.
3. Land review freshness before compare flows if planner wants export safety early.
4. Keep `/generate` refactoring localized; Phase 5 is still the proper decomposition phase.

## Open Questions

1. **Should accepted provenance store raw excerpts or only source ids + offsets?**
   - What we know: The UI and version history need stable human-readable evidence.
   - What is unclear: Whether source content will be edited after upload.
   - Recommendation: Store excerpt text plus source metadata on accepted sections in Phase 3; optimize later if storage pressure appears.

2. **Should export hard-block on warnings or only failures?**
   - What we know: The product promise is trust, not zero-warning perfection.
   - What is unclear: Product tolerance for exporting with non-fatal advisory findings.
   - Recommendation: Hard-block only `fail` checks, but require a fresh review run before every export.

3. **Does compare preview need persisted draft-local candidate storage?**
   - What we know: Ephemeral response-only candidates are simpler and safer.
   - What is unclear: Whether the UX must survive refresh/navigation before acceptance.
   - Recommendation: Start with response-local candidates only; do not create candidate persistence until a real UX need appears.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node:test`, Next routes, scripts | ✓ | `v24.14.0` | — |
| npm | package scripts | ✓ | `11.9.0` | — |
| Playwright CLI | SAFE-03 extension and trust UI smoke | ✓ | `1.58.2` | — |
| Supabase CLI | local seeded auth/RLS/browser flows | ✓ | `2.84.4` | — |
| Docker | local Supabase stack | ✓ | `28.1.1` | — |

**Missing dependencies with no fallback:**
- None found for this phase's current local validation path

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` on Node `v24.14.0` plus `@playwright/test` `1.58.2` |
| Config file | [`playwright.config.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/playwright.config.ts) |
| Quick run command | `node --experimental-strip-types --test tests/phase-03/contracts/*.test.ts` |
| Full suite command | `npm run test:phase-02:contracts && npm run test:phase-02:telemetry && npm run test:phase-02:e2e` plus new Phase 3 commands |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-01 | Accepted sections persist grounded source evidence from approved assets | unit + route contract | `node --experimental-strip-types --test tests/phase-03/contracts/provenance-contract.test.ts` | ❌ Wave 0 |
| TRUST-02 | Review/draft UI shows section provenance cards for accepted content | e2e | `playwright test --config=playwright.config.ts --project=chromium tests/e2e/generate-provenance.spec.ts` | ❌ Wave 0 |
| TRUST-03 | Review computes doc-type policy checks and export rejects stale/missing review | unit + route contract | `node --experimental-strip-types --test tests/phase-03/contracts/review-policy-contract.test.ts tests/phase-03/contracts/export-preflight-contract.test.ts` | ❌ Wave 0 |
| TRUST-04 | Regenerate/revise/restore return candidate compare data and require explicit accept | route contract + e2e | `node --experimental-strip-types --test tests/phase-03/contracts/candidate-acceptance-contract.test.ts` | ❌ Wave 0 |
| TRUST-05 | Section-only regenerate/revise keep untouched sections unchanged until accepted | unit + route contract | `node --experimental-strip-types --test tests/phase-03/contracts/section-scope-contract.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted Phase 3 `node:test` contract run plus any touched existing Phase 2 contract/telemetry test
- **Per wave merge:** targeted Playwright trust smoke plus relevant Phase 2 smoke
- **Phase gate:** all targeted Phase 3 contracts green, existing SAFE-03 smoke green, and export-preflight checks green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/phase-03/contracts/provenance-contract.test.ts` — accepted section provenance shape and persistence
- [ ] `tests/phase-03/contracts/review-policy-contract.test.ts` — doc-type policy pack coverage
- [ ] `tests/phase-03/contracts/export-preflight-contract.test.ts` — stale review rejection
- [ ] `tests/phase-03/contracts/candidate-acceptance-contract.test.ts` — preview/accept route contracts
- [ ] `tests/phase-03/contracts/section-scope-contract.test.ts` — unchanged-section guarantees
- [ ] `tests/phase-03/telemetry/trust-route-telemetry.test.ts` — `candidate_id`, `review_hash`, compare metadata
- [ ] `tests/e2e/generate-provenance.spec.ts` — seeded provenance + diff acceptance smoke
- [ ] package scripts for Phase 3 contract/telemetry/e2e commands

## Sources

### Primary (HIGH confidence)

- [`app/generate/page.tsx`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) - current draft/review/version UI behavior and missing compare/provenance surfaces
- [`app/api/ai/draft/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/draft/route.ts) - current full/section draft generation behavior
- [`app/api/ai/review/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/review/route.ts) - current review persistence behavior
- [`app/api/ai/revise/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/revise/route.ts) - current auto-apply revise behavior
- [`app/api/ai/versions/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/versions/route.ts) - version listing surface
- [`app/api/ai/versions/restore/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/ai/versions/restore/route.ts) - current auto-apply restore behavior
- [`app/api/reference-assets/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/reference-assets/route.ts) - approved reference asset storage
- [`app/api/generate/route.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/generate/route.ts) - export path and telemetry pattern
- [`lib/official-document-workflow.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/official-document-workflow.ts) - current generation/revise/review logic and deterministic checks
- [`lib/collaborative-store.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-store.ts) - current draft/version persistence contracts
- [`lib/collaborative-route-helpers.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/collaborative-route-helpers.ts) - rule/reference loading
- [`lib/version-restore.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/version-restore.ts) - restore merge/response behavior
- [`tests/e2e/generate-smoke.spec.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/tests/e2e/generate-smoke.spec.ts) - SAFE-03 baseline browser constraint
- [`playwright.config.ts`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/playwright.config.ts) - current seeded browser harness
- [`package.json`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/package.json) - actual current testing/tooling stack

### Secondary (MEDIUM confidence)

- [`.planning/ROADMAP.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/ROADMAP.md) - Phase 3 goal and success criteria
- [`.planning/REQUIREMENTS.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/REQUIREMENTS.md) - TRUST requirement definitions
- [`.planning/STATE.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/STATE.md) - SAFE-03/SAFE-04 constraints and current planning focus
- [`.planning/codebase/ARCHITECTURE.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/codebase/ARCHITECTURE.md) - repo architecture seams
- [`.planning/codebase/CONCERNS.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/codebase/CONCERNS.md) - brownfield fragility and UI concentration
- [`.planning/research/ARCHITECTURE.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/research/ARCHITECTURE.md) - server-owned workflow guidance
- [`.planning/research/PITFALLS.md`](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/research/PITFALLS.md) - trust and context-boundary risks

### Tertiary (LOW confidence)

- None. This research pass relied on local repo state only.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - derived from the current repo and installed local toolchain
- Architecture: MEDIUM - grounded in current code, but Phase 3 still needs planner choices on preview persistence and diff helper usage
- Pitfalls: HIGH - directly supported by the current route/UI/store behavior

**Research date:** 2026-03-27
**Valid until:** 2026-04-10
