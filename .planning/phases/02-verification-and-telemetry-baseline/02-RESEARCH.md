# Phase 2: Verification and Telemetry Baseline - Research

**Researched:** 2026-03-26
**Domain:** Next.js route-contract testing, Supabase auth/RLS regression, browser smoke automation, structured telemetry
**Confidence:** MEDIUM

## Summary

Phase 2 should stay aligned with the repo's current shape instead of introducing a broad new testing stack. The codebase already has a working `node:test` pattern in `tests/phase-01/*.test.ts`, direct exported route handlers under `app/api/**/route.ts`, centralized request/error helpers in `lib/api.ts`, and Supabase as the real authorization boundary. That means the safest baseline is: keep `node:test` for unit/contract/route tests, add a real Supabase-backed auth/RLS regression harness, add one seeded Playwright smoke for the generate workspace, and extend the existing JSON request logging into operator-grade workflow telemetry.

The biggest planning constraint is that SAFE-02 and SAFE-03 cannot be proven with mocks alone. Auth isolation is enforced by Supabase RLS policies in `supabase/migrations/*.sql`, so those checks need a real database and real authenticated clients. The browser smoke also should not call live AI providers in CI, because the current AI routes enforce quota, depend on provider env, and can create flaky or paid traffic. Seeded drafts are the right baseline.

The current repo already logs structured JSON per request through `logRequestResult(...)` in `lib/api.ts`, but that telemetry is too thin for SAFE-04. It lacks stable workflow fields like `draft_id`, workflow action/stage, export size, and provider failure classification. Phase 2 should therefore be log-first rather than vendor-first: enrich the existing structured logs, add explicit workflow/export events, and tighten `/api/health` so runtime-health inspection does not leak unnecessary provider metadata.

**Primary recommendation:** Use `node:test` for SAFE-01 route/unit coverage, local Supabase + seeded multi-user clients for SAFE-02, a seeded Playwright Chromium smoke for SAFE-03, and enriched JSON logs plus a reduced-scope health check for SAFE-04.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAFE-01 | Maintainer can run automated tests for validation, persistence helpers, and workflow route contracts in CI | Use `node:test` for pure helper tests and direct route-handler contract tests; no runner migration required because the current Phase 1 suite already passes under Node 24 |
| SAFE-02 | Maintainer can run automated auth/RLS regression checks that prove one user cannot access or mutate another user's drafting data | Use a real local Supabase stack with seeded users and authenticated anon clients; do not use service-role-only checks because they bypass RLS |
| SAFE-03 | Maintainer can run at least one browser-level smoke test covering the core generate workflow from draft load to review/export readiness | Use Playwright against a seeded review-ready or draft-ready fixture so the browser proves page hydration/navigation without calling paid AI routes |
| SAFE-04 | Operator can inspect structured error and performance telemetry for workflow stages, AI providers, and export failures | Extend `lib/api.ts` request logs with workflow metadata, add explicit export timing/size logs, and reduce `/api/health` exposure while keeping runtime diagnostics |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Work inside the WAT model: prefer existing deterministic scripts/tools before adding new ones.
- Do not replace the core stack. Stay on Next.js 14, Supabase Auth/Postgres/RLS, and the current server-managed provider abstraction.
- Keep AI keys server-only.
- Keep user data isolation enforced by Supabase auth plus RLS.
- Treat `supabase/migrations/*.sql` ordering as operationally mandatory.
- Early phases must add safety rails before larger architectural refactors.
- Add new API behavior under `app/api/**/route.ts` using the existing route pattern: validate input, require auth, enforce quota/rate limits, run workflow code, persist state, return JSON.
- Put shared schemas in `lib/validation.ts`, not inline.
- Use shared helpers in `lib/*` for persistence instead of duplicating Supabase query logic.
- Use `AppError` and `handleRouteError(...)` for expected failures.
- API routes already log structured JSON through `logRequestResult(...)`; Phase 2 should extend that pattern rather than replace it.
- No project-local `.claude/skills/` or `.agents/skills/` directories exist, so there are no additional repo-specific skill rules to follow.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | Local env `v24.14.0` | Unit, contract, route-handler, and telemetry tests | Already works in this repo today; avoids unnecessary runner migration and matches the Phase 1 suite style |
| `@playwright/test` | `1.55.0` | Real-browser smoke coverage for `/generate` | Standard browser automation stack with first-class traces, retries, and CI support |
| `supabase` CLI | `2.53.0` | Local Supabase stack and deterministic RLS regression runs | Standard local-development path for real Postgres/Auth/RLS verification instead of remote shared-state tests |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Docker | Local env `28.1.1` | Runtime dependency for local Supabase services | Required when running local Supabase in CI or on a maintainer machine |
| npm / npx | Local env `11.9.0` | Unified test and setup entrypoints | Use for package scripts, Playwright install, and CLI invocation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` | Vitest | Better plugin ecosystem and module-mocking ergonomics, but adds runner churn the repo does not need for Phase 2 |
| Local Supabase stack | Shared hosted Supabase project | Easier initial setup, but nondeterministic data state and riskier CI isolation |
| Seeded browser smoke | Full live AI E2E | Closer to production, but slower, flaky, quota-sensitive, and potentially paid |

**Installation:**
```bash
npm install -D @playwright/test supabase
```

**Version verification:**
- `@playwright/test` `1.55.0` verified from the npm package page on 2026-03-26.
- `supabase` CLI `2.53.0` verified from the npm package page on 2026-03-26.
- `node:test` is built into the local Node runtime already installed at `v24.14.0`.

## Architecture Patterns

### Recommended Project Structure

```text
tests/
├── contracts/           # Pure helper and route-contract tests
├── auth-rls/            # Real multi-user Supabase regression tests
├── telemetry/           # Log-shape and health-contract tests
└── e2e/                 # Playwright smoke specs
scripts/
├── seed-phase-2.mjs     # Seed users + fixture drafts for SAFE-02/03
└── test-env.mjs         # Optional setup orchestration for local/CI runs
```

### Pattern 1: Keep Pure Contract Tests on `node:test`

**What:** Test schemas, helper transforms, source-adoption contracts, export helpers, and telemetry payload shaping with zero app-server boot.

**When to use:** Anything that can be asserted from pure inputs/outputs or source-level route ownership guarantees.

**Example:**
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

test('draft save rejects workflow-owned keys', () => {
  assert.throws(() => draftSaveSchema.parse(payloadWithWorkflowFields));
});
```

Source: https://nodejs.org/api/test.html

### Pattern 2: Invoke Exported Route Handlers Directly

**What:** Call `POST(request)` / `GET(request)` from `app/api/**/route.ts` with `NextRequest` inputs while stubbing auth, workflow, quota, and persistence boundaries.

**When to use:** SAFE-01 route-contract coverage for `app/api/drafts/route.ts`, `app/api/ai/intake/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/review/route.ts`, `app/api/generate/route.ts`, and restore/version routes.

**Example:**
```typescript
const request = new NextRequest('http://localhost/api/drafts', {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: { 'content-type': 'application/json' },
});

const response = await POST(request);
assert.equal(response.status, 200);
```

Source: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

### Pattern 3: Run RLS Regression Against a Real Supabase Instance

**What:** Seed at least two users plus rows for `drafts`, `document_versions`, `documents`, `writing_rules`, `reference_assets`, `contacts`, `common_phrases`, and `usage_events`, then prove user A cannot read/update/delete user B data with authenticated clients.

**When to use:** SAFE-02 only. This must be real Postgres + real policies, not mocked repository calls.

**Example:**
```typescript
const alice = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${aliceJwt}` } } });
const { data, error } = await alice.from('drafts').select('id').eq('id', bobDraftId);
assert.equal(data?.length ?? 0, 0);
```

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

### Pattern 4: Seed the Browser Smoke From Persisted Draft State

**What:** Open `/generate?draft=<fixture-id>` in Playwright after seeding a draft that already contains planning/outline/sections/history.

**When to use:** SAFE-03. The smoke should prove page bootstrapping, stage hydration, step navigation, version history visibility, and review/export readiness without live provider calls.

**Example:**
```typescript
test('seeded draft loads into generate workspace', async ({ page }) => {
  await page.goto(`/generate?draft=${fixtureDraftId}`);
  await expect(page.getByText('AI 协作式公文工作台')).toBeVisible();
  await expect(page.getByRole('button', { name: '5. 定稿检查' })).toBeEnabled();
});
```

Source: https://playwright.dev/docs/intro

### Anti-Patterns to Avoid

- **Live paid-model CI runs:** SAFE-03 should not depend on real AI responses.
- **Service-role-only auth tests:** service-role bypasses RLS and cannot prove SAFE-02.
- **Browser tests for route/persistence contracts:** use browser only for true UI wiring; everything else should be route or helper tests.
- **Telemetry stored only in ad-hoc DB tables:** Phase 2 should extend structured logs first; vendor/storage decisions can stay deferred.
- **New custom auth abstraction for tests:** use real Supabase session/JWT behavior, not a fake ownership layer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation | Custom Puppeteer scripts or DOM polling helpers | `@playwright/test` | Stable browser fixtures, traces, retries, and CI ergonomics already solved |
| RLS verification | Mocked repository ownership checks | Real Supabase local stack | Only real Postgres policies prove auth isolation |
| Test coverage collection | Bespoke Istanbul wiring just for Phase 2 | Node's built-in test coverage | Lowest-friction baseline for the existing runner |
| Telemetry baseline | Plaintext console strings | Structured JSON logs from `lib/api.ts` | Operators need parseable fields, not free-form text |

**Key insight:** The repo already has the right seams for contracts and logs; the missing piece is execution discipline, not a large new framework.

## Common Pitfalls

### Pitfall 1: SAFE-03 accidentally becomes a paid AI end-to-end test

**What goes wrong:** The browser smoke clicks through intake/outline/draft using real providers, so tests depend on env secrets, quota, latency, and model nondeterminism.

**Why it happens:** The current UI wires directly to `app/api/ai/*` routes, and those routes perform real provider calls plus quota/rate checks.

**How to avoid:** Seed draft state directly in Supabase so the browser starts from an existing draft and only verifies page hydration/navigation/export readiness.

**Warning signs:** CI failures mention provider errors, quota errors, or inconsistent generated content.

### Pitfall 2: SAFE-02 is “tested” with the service-role key

**What goes wrong:** Regression tests pass even if RLS is broken because service-role access bypasses user policies.

**Why it happens:** The repo already uses the service role in `scripts/check-supabase-schema.mjs`, which is valid for schema checks but invalid for auth-isolation proof.

**How to avoid:** Use service-role only for setup/seeding. Run assertions through user-scoped anon/authenticated clients.

**Warning signs:** Cross-user reads unexpectedly return data in setup scripts, or the same client is used for setup and assertions.

### Pitfall 3: Route tests try to prove too much

**What goes wrong:** SAFE-01 route tests start booting the whole app or touching real Supabase/provider dependencies, becoming flaky and slow.

**Why it happens:** The route files currently combine auth, quota, workflow calls, persistence, and error normalization in one function.

**How to avoid:** Route-contract tests should mock boundary modules and assert request parsing, auth gating, workflow-stage mapping, and response shape only.

**Warning signs:** Route tests require `.env`, network, or real provider keys just to run.

### Pitfall 4: Browser smoke breaks on incidental UI copy/layout changes

**What goes wrong:** The test uses brittle CSS selectors or deep DOM structure in a 2,269-line page component.

**Why it happens:** `app/generate/page.tsx` is monolithic and has many repeated buttons/sections.

**How to avoid:** Use role/text selectors tied to stable workflow labels, and add minimal `data-testid` hooks only where roles are ambiguous.

**Warning signs:** Failing selectors after harmless styling/copy refactors.

### Pitfall 5: Telemetry remains too shallow to diagnose failures

**What goes wrong:** Logs show route, status, and duration, but operators still cannot connect an export failure to a draft, workflow stage, or provider attempt.

**Why it happens:** `logRequestResult(...)` currently emits only generic request metadata.

**How to avoid:** Add `draft_id`, `doc_type`, `workflow_action`, `workflow_stage`, `error_code`, `export_size_bytes`, and explicit provider-failure fields.

**Warning signs:** Reproducing issues locally is still required to know what failed.

## Code Examples

Verified patterns from official sources:

### Node Test Runner Baseline

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

test('basic contract', () => {
  assert.equal(1 + 1, 2);
});
```

Source: https://nodejs.org/api/test.html

### Playwright Smoke Test Shape

```typescript
import { test, expect } from '@playwright/test';

test('basic smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
```

Source: https://playwright.dev/docs/intro

### Local Supabase Workflow

```bash
supabase start
supabase db reset
```

Source: https://supabase.com/docs/guides/local-development

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Build-only safety (`npm run build`) | Layered verification: helper contracts, route contracts, real RLS checks, seeded browser smoke | Current ecosystem baseline | Refactors become locally provable before shipping |
| Browser E2E for all workflow behavior | One narrow seeded smoke plus lower-level contract coverage | Current best practice for brownfield monoliths | Keeps UI confidence without paying the cost of full live E2E |
| Plain request logs only | Structured workflow telemetry with request and domain metadata | Current observability baseline | Operators can triage runtime issues without reproduction |

**Deprecated/outdated:**

- Treating `npm run build` plus manual clicking as sufficient regression coverage for workflow refactors.
- Treating service-role schema checks as evidence of RLS correctness.

## Open Questions

1. **Should SAFE-03 click the real export button or stop at export readiness?**
   - What we know: `app/api/generate/route.ts` still returns base64 JSON and performs document writes plus version snapshots.
   - What's unclear: Whether CI should verify download side effects now or defer until Phase 4 export hardening.
   - Recommendation: For Phase 2, stop at review/export readiness or perform a single seeded export assertion only if fixture setup is cheap and stable.

2. **How should local Supabase be started in CI?**
   - What we know: Docker is installed locally, but `supabase` CLI is not currently installed.
   - What's unclear: Whether CI runners already include the CLI, or whether Phase 2 must install it via npm on every run.
   - Recommendation: Plan explicit CLI installation/setup in Wave 0 instead of assuming it exists.

3. **Should telemetry persist beyond stdout in Phase 2?**
   - What we know: The app already emits JSON logs and records coarse `usage_events`.
   - What's unclear: Whether operators already have log aggregation in the deployment platform.
   - Recommendation: Keep Phase 2 log-first; only add persistent storage if a real operator workflow requires it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node:test`, Next app, scripts | ✓ | `v24.14.0` | — |
| npm / npx | package scripts, dev dependency install | ✓ | `11.9.0` | — |
| Docker | Local Supabase stack | ✓ | `28.1.1` | None for local Supabase |
| Supabase CLI | SAFE-02 local RLS regression | ✗ | — | Install `supabase` package and run via `npx` |
| Playwright CLI / browsers | SAFE-03 browser smoke | ✗ | — | Install `@playwright/test` and browser binaries |
| `psql` | Optional DB inspection/debugging | ✗ | — | Use Supabase CLI and JS clients instead |
| `.env` / `.env.local` | Existing app/service config | ✓ | present | — |

**Missing dependencies with no fallback:**
- None, as long as Phase 2 explicitly installs the Supabase CLI wrapper and Playwright browsers.

**Missing dependencies with fallback:**
- Supabase CLI: fallback is installing `supabase` as a dev dependency and running it through `npx`.
- `psql`: fallback is using seeded JS-client assertions instead of direct SQL shells.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner + Playwright Test |
| Config file | none today for `node:test`; `playwright.config.ts` should be added in Wave 0 |
| Quick run command | `node --test tests/phase-01/*.test.ts` |
| Full suite command | `node --test tests/**/*.test.ts && playwright test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | Validation, persistence helpers, and workflow route contracts stay correct | unit + contract | `node --test tests/contracts/**/*.test.ts` | ❌ Wave 0 |
| SAFE-02 | Cross-user reads/mutations are blocked by auth/RLS | integration | `node --test tests/auth-rls/**/*.test.ts` | ❌ Wave 0 |
| SAFE-03 | Seeded generate workspace reaches review/export-ready state in a real browser | smoke | `playwright test tests/e2e/generate-smoke.spec.ts --project=chromium` | ❌ Wave 0 |
| SAFE-04 | Structured logs and health contracts expose actionable metadata | unit + contract | `node --test tests/telemetry/**/*.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test {targeted test files}`
- **Per wave merge:** `node --test tests/**/*.test.ts`
- **Phase gate:** `node --test tests/**/*.test.ts && playwright test`

### Wave 0 Gaps

- [ ] Add package scripts for `test`, `test:contracts`, `test:rls`, `test:e2e`, and `test:ci`
- [ ] Add `playwright.config.ts`
- [ ] Add `tests/contracts/` for route and helper contracts
- [ ] Add `tests/auth-rls/` with multi-user seeded assertions
- [ ] Add `tests/e2e/generate-smoke.spec.ts`
- [ ] Add `tests/telemetry/` for log payload and health response contracts
- [ ] Add deterministic seed/setup tooling for fixture users and drafts
- [ ] Decide whether to silence or address the current `MODULE_TYPELESS_PACKAGE_JSON` warning emitted by `node --test`

## Recommended Plan Split

1. **02-01 Test Runner and Contract Baseline**
   - Add package scripts and directory conventions.
   - Expand `node:test` coverage for `lib/validation.ts`, `lib/document-generator.ts`, `lib/api.ts`, and the Phase 1 helper contracts.
   - Add direct route-handler contract tests for the key workflow routes with mocked boundaries.

2. **02-02 Auth and RLS Regression Harness**
   - Install/use local Supabase CLI.
   - Seed at least two users plus per-user rows across every drafting table.
   - Add read/update/delete denial checks and prove positive same-user access.

3. **02-03 Seeded Browser Smoke**
   - Add Playwright config and local app boot strategy.
   - Seed one fixture draft that can open directly into a meaningful late-stage workspace state.
   - Prove load, stage navigation, version visibility, and review/export readiness.

4. **02-04 Telemetry and Runtime Health Baseline**
   - Enrich request logs in `lib/api.ts`.
   - Add workflow/export-specific telemetry fields in key routes.
   - Reduce `/api/health` exposure while preserving operator usefulness.
   - Add telemetry contract tests.

## Sources

### Primary (HIGH confidence)

- Internal repo evidence:
  - `lib/api.ts` for current structured request logging
  - `tests/phase-01/*.test.ts` for current working `node:test` pattern
  - `app/api/ai/*.ts`, `app/api/drafts/route.ts`, `app/api/generate/route.ts` for route-contract surfaces
  - `supabase/migrations/*.sql` for actual RLS policies and workflow schema
  - `app/generate/page.tsx` for browser smoke surface and late-stage hydration path
- Node.js test runner docs: https://nodejs.org/api/test.html
- Node.js TypeScript docs: https://nodejs.org/api/typescript.html
- Playwright docs: https://playwright.dev/docs/intro
- Next.js route handlers docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Supabase local development docs: https://supabase.com/docs/guides/local-development
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security

### Secondary (MEDIUM confidence)

- npm package page for `@playwright/test`: https://www.npmjs.com/package/@playwright/test
- npm package page for `supabase`: https://www.npmjs.com/package/supabase

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - matches current repo behavior and official docs
- Architecture: HIGH - based directly on current route/page/store/migration surfaces
- Pitfalls: MEDIUM - mostly repo-grounded, but some are predictive CI/operability risks

**Research date:** 2026-03-26
**Valid until:** 2026-04-25
