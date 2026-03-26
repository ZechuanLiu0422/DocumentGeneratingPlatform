# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- Use Next.js App Router special filenames for routes and pages: `app/layout.tsx`, `app/error.tsx`, `app/api/drafts/route.ts`.
- Use kebab-case for general modules and scripts: `lib/collaborative-store.ts`, `lib/official-document-workflow.ts`, `scripts/check-supabase-schema.mjs`.
- Use short role-based names for Supabase helpers: `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`.

**Functions:**
- Use camelCase for helpers and service functions: `createRequestContext` in `lib/api.ts`, `requireRouteUser` in `lib/auth.ts`, `getEnabledProviders` in `lib/providers.ts`.
- Use PascalCase for React components and `ErrorPageProps`-style prop types: `RootLayout` in `app/layout.tsx`, `StageTabs` and `GeneratePageContent` in `app/generate/page.tsx`.
- Route handlers export uppercase HTTP verbs exactly as Next.js expects: `GET`, `POST`, `DELETE` in `app/api/drafts/route.ts`.

**Variables:**
- Use camelCase for locals and state: `currentDraftId`, `workflowStage`, `enabledProviders`, `forwardedArgs` in `app/generate/page.tsx`, `lib/providers.ts`, and `scripts/run-next-dev.mjs`.
- Use SCREAMING_SNAKE_CASE for module-level constants: `MAX_PLANNING_SECTIONS` in `app/generate/page.tsx`, `DAILY_QUOTAS` in `lib/quota.ts`, `TARGET_SNIPPET` in `scripts/run-next-dev.mjs`.

**Types:**
- Prefer local `type` aliases over interfaces for DTOs and UI state: `Draft`, `PlanningOption`, `ReviewCheck` in `app/generate/page.tsx`; `DraftRecord`, `VersionRecord` in `lib/collaborative-store.ts`.
- Use string-literal unions for domain state instead of enums: `WorkflowStage` in `app/generate/page.tsx`, provider/doc type unions in `lib/collaborative-store.ts`.

## Code Style

**Formatting:**
- Follow the existing TypeScript/Next formatting style used in `app/layout.tsx`, `app/api/ai/outline/route.ts`, and `lib/validation.ts`: 2-space indentation, single quotes, and semicolons.
- Keep object and array literals multi-line when they become non-trivial, with trailing commas common in multiline structures; see `docTypes` in `app/generate/page.tsx` and schemas in `lib/validation.ts`.
- No repo-level Prettier or Biome config is present. Formatting is convention-driven rather than tool-enforced in files like `package.json` and `tsconfig.json`.

**Linting:**
- `package.json` defines `npm run lint` as `next lint`, so the expected lint baseline is Next.js defaults from the framework rather than a committed custom ESLint config.
- TypeScript is intentionally permissive: `tsconfig.json` has `"strict": false`, so code compensates with runtime validation in `lib/validation.ts`.

## Import Organization

**Order:**
1. Framework or Node imports first: `next/server` in `app/api/login/route.ts`, `fs/promises` and `child_process` in `scripts/run-next-dev.mjs`.
2. Internal alias imports second: `@/lib/api`, `@/lib/auth`, `@/lib/validation` in `app/api/drafts/route.ts`.
3. Side-effect stylesheet imports only in app entry files: `import './globals.css';` in `app/layout.tsx`.

**Path Aliases:**
- Use the `@/*` alias from `tsconfig.json` for app-local imports.
- Prefer `import type` for type-only dependencies in library code: `lib/collaborative-store.ts` imports `type { SupabaseClient }` and `type { AnalyzeResult }`.

## Error Handling

**Patterns:**
- Route handlers follow a shared request lifecycle:

```typescript
const context = createRequestContext(request, '/api/...');
try {
  const { supabase, user } = await requireRouteUser();
  const body = someSchema.parse(await request.json());
  return ok(context, payload);
} catch (error) {
  return handleRouteError(error, context);
}
```

- Use `AppError` from `lib/api.ts` for expected user-facing failures such as unauthorized access, quota overflow, invalid credentials, and incomplete planning data.
- Centralize error normalization in `lib/api.ts` instead of formatting route-local JSON errors.
- Allow broad `catch (error)` blocks at route boundaries, but keep thrown error types normalized through `handleRouteError`.

## Logging

**Framework:** `console`

**Patterns:**
- API routes log structured JSON via `logRequestResult` in `lib/api.ts`.
- UI/runtime errors log directly to the console in client components such as `app/error.tsx`.
- Operational scripts print plain-text progress and failures to stdout/stderr, as in `scripts/check-deploy.mjs` and `scripts/run-next-dev.mjs`.

## Comments

**When to Comment:**
- Comments are sparse. The codebase relies on descriptive names and explicit schema/type definitions rather than explanatory comments.
- Prefer self-describing helpers such as `getIncompletePlanningSections` in `app/generate/page.tsx` and `normalizeDraftRecord` in `lib/collaborative-store.ts` over inline commentary.

**JSDoc/TSDoc:**
- Not used in representative files: `app/generate/page.tsx`, `lib/api.ts`, `lib/validation.ts`, `scripts/check-deploy.mjs`.

## Function Design

**Size:**
- Small focused helpers are common in shared modules: `getClientIp` in `lib/api.ts`, `ensureProviderEnabled` in `lib/providers.ts`, `enforceRateLimit` in `lib/ratelimit.ts`.
- Large orchestration files are accepted where the workflow is complex: `app/generate/page.tsx` and `lib/official-document-workflow.ts` concentrate substantial logic in single files.

**Parameters:**
- Prefer a single object parameter when a function takes many related values: `loadRuleAndReferenceContext(...)` usage in `app/api/ai/outline/route.ts`, `recordUsageEvent(...)` in `lib/quota.ts`, `saveDraftState(...)` calls from AI routes.
- Keep scalar parameters for simple utilities: `enforceRateLimit(key, limit, windowMs, message)` in `lib/ratelimit.ts`.

**Return Values:**
- Return normalized plain objects from helpers instead of class instances: `createRequestContext` in `lib/api.ts`, `getProviderConfig` in `lib/providers.ts`, `normalizeDraftRecord` in `lib/collaborative-store.ts`.
- Route handlers return `NextResponse` JSON through `ok(...)` and `handleRouteError(...)`.

## Module Design

**Exports:**
- Prefer named exports in shared modules: `lib/api.ts`, `lib/quota.ts`, `lib/providers.ts`, `lib/validation.ts`.
- Use default exports for page and error components in the `app/` tree: `app/layout.tsx`, `app/error.tsx`, `app/change-password/page.tsx`.

**Barrel Files:**
- Not used. Import from concrete modules directly, for example `@/lib/api`, `@/lib/auth`, and `@/lib/validation` in `app/api/login/route.ts`.

## Practical Guidance

- Add new route handlers under `app/api/**/route.ts` and match the existing pattern from `app/api/drafts/route.ts` and `app/api/ai/outline/route.ts`.
- Define new request/response schemas in `lib/validation.ts` instead of validating inline in route files.
- Put shared persistence helpers in `lib/collaborative-store.ts` or a neighboring `lib/*` module rather than repeating Supabase query shapes across routes.
- Keep frontend page state in local `type` aliases and hook state if extending `app/generate/page.tsx`, but prefer extracting a helper or child component before adding another large inline concern.
- Reuse `@/` alias imports and existing Chinese product copy style when touching user-visible strings in `app/` and `app/api/`.

---

*Convention analysis: 2026-03-26*
