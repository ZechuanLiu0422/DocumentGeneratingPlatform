# Testing Patterns

**Analysis Date:** 2026-03-26

## Test Framework

**Runner:**
- Not detected.
- Config: Not detected in `package.json`, and no `jest.config.*`, `vitest.config.*`, `playwright.config.*`, or `pytest.ini` files are present at repo root.

**Assertion Library:**
- Not detected.

**Run Commands:**
```bash
npm run build         # Primary compile-time verification
npm run check:deploy  # Local deployment preflight from `scripts/check-deploy.mjs`
npm run check:schema  # Supabase schema smoke check from `scripts/check-supabase-schema.mjs`
```

## Test File Organization

**Location:**
- No automated test directories or co-located test files were found. A repo scan returned no `*.test.*` or `*.spec.*` files under `app/`, `components/`, `lib/`, `scripts/`, `tools/`, or `types/`.

**Naming:**
- Not applicable. No test file naming convention is currently established.

**Structure:**
```text
No `tests/`, `__tests__/`, `e2e/`, `*.test.*`, or `*.spec.*` files detected.
```

## Test Structure

**Suite Organization:**
```typescript
// Not applicable: no `describe(...)` / `it(...)` suites exist in the repository.
```

**Patterns:**
- Verification is command-driven rather than framework-driven. The current safety net is a combination of `npm run build`, `npm run check:deploy`, and `npm run check:schema` from `package.json`.
- API safety relies on runtime guards in production code: Zod parsing in `lib/validation.ts`, auth checks in `lib/auth.ts`, rate limiting in `lib/ratelimit.ts`, and quotas in `lib/quota.ts`.
- Manual regression notes are recorded in `tasks/todo.md` under `## Review`, including repeated `npm run build` runs and spot checks against dev routes.

## Mocking

**Framework:** Not applicable

**Patterns:**
```typescript
// Current repo pattern is smoke-checking live boundaries rather than mocking them.
const checks = [
  {
    label: 'drafts planning column',
    migration: '20260323150000_outline_planning_upgrade.sql',
    run: () => client.from('drafts').select('id,planning').limit(1),
  },
];
```

This pattern comes from `scripts/check-supabase-schema.mjs`.

**What to Mock:**
- No project-standard mocking library or helper exists yet.
- If automated tests are added, external AI providers from `lib/providers.ts` and Supabase clients from `lib/supabase/server.ts` are the first boundaries that should be isolated.

**What NOT to Mock:**
- Do not replace Zod schemas in `lib/validation.ts` with fake validators; those schemas are the contract worth asserting.
- Do not bypass route-level error normalization in `lib/api.ts`; tests should observe the real `AppError` to `handleRouteError(...)` flow.

## Fixtures and Factories

**Test Data:**
```typescript
// Not detected: no shared fixtures, factories, or seed builders in the repo.
```

**Location:**
- Not applicable. No fixture directories or helper factories are present.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not available: no coverage tool or script is configured in `package.json`.
```

## Test Types

**Unit Tests:**
- Not used. No unit test runner or assertion library is configured for helpers such as `lib/api.ts`, `lib/document-generator.ts`, or `lib/validation.ts`.

**Integration Tests:**
- Not used as a formal suite.
- The closest equivalent is direct environment or database smoke checking in `scripts/check-deploy.mjs` and `scripts/check-supabase-schema.mjs`.

**E2E Tests:**
- Not used.
- Manual UI verification is implied by the review log in `tasks/todo.md`, especially for `/generate`, `/login`, and dev startup behavior.

## Common Patterns

**Async Testing:**
```javascript
// Current repo verification pattern is executable smoke checks in Node scripts.
for (const check of checks) {
  const { error } = await check.run();
  if (error) {
    failed = true;
  }
}
```

This pattern is implemented in `scripts/check-supabase-schema.mjs`.

**Error Testing:**
```typescript
if (error || !user) {
  throw new AppError(401, '登录状态已失效，请重新登录', 'UNAUTHORIZED');
}
```

This production guard from `lib/auth.ts` is representative of the behavior that future tests should assert.

## Current Verification Surface

- `npm run build` validates that Next.js pages, routes, and TypeScript compile together. This is the only repo-wide automated check guaranteed to run without external services.
- `scripts/check-deploy.mjs` validates required env keys, AI provider configuration, and the presence of migration files before deployment.
- `scripts/check-supabase-schema.mjs` performs live Supabase queries for required tables and columns, so it acts as a schema smoke test rather than a pure unit test.
- `tasks/todo.md` serves as the historical record of manual verification. It documents repeated build runs and local checks for the `/generate` flow, login redirects, and dev runtime behavior.

## Highest-Risk Untested Areas

- `app/generate/page.tsx` contains the largest interactive surface and extensive local state, but has no component or browser automation coverage.
- `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, and neighboring AI routes orchestrate auth, quotas, persistence, and model workflows with no route-level automated regression tests.
- `lib/collaborative-store.ts` transforms Supabase rows into app state and versions, but there are no tests for normalization or persistence edge cases.
- `scripts/run-next-dev.mjs` mutates `.next/server/webpack-runtime.js` and renames `.next`, but that behavior is only validated manually.

## Guidance For New Tests

- Put pure logic tests first around `lib/validation.ts`, `lib/api.ts`, `lib/providers.ts`, and `lib/document-generator.ts`.
- Add route integration tests that exercise the real request pipeline used in `app/api/drafts/route.ts` and `app/api/ai/outline/route.ts`: request parsing, auth gating, quota/rate-limit behavior, and normalized error responses.
- Add one smoke-style browser test for the authoring workflow in `app/generate/page.tsx` before expanding coverage elsewhere.
- Reuse existing command-oriented verification scripts as setup or health checks rather than replacing them; `scripts/check-deploy.mjs` and `scripts/check-supabase-schema.mjs` already encode important deployment assumptions.

---

*Testing analysis: 2026-03-26*
