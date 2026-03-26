# Conventions

## Route Handler Pattern

- API handlers usually follow the same structure:
- create a context with `createRequestContext(...)` from `lib/api.ts`
- authenticate with `requireRouteUser(...)` from `lib/auth.ts`
- parse input with zod schemas from `lib/validation.ts`
- enforce rate and/or quota controls via `lib/ratelimit.ts` and `lib/quota.ts`
- return responses with `ok(...)` or `handleRouteError(...)`
- Examples: `app/api/ai/intake/route.ts`, `app/api/ai/draft/route.ts`, `app/api/reference-assets/route.ts`.

## Validation Style

- Request validation is centralized in `lib/validation.ts`; route files import schemas instead of defining local ad hoc parsing.
- Schemas are generally strict on field lengths and enums, especially for workflow JSON such as `planningSectionSchema`, `outlineSectionSchema`, and `draftSectionSchema`.

## Persistence Pattern

- Draft persistence flows through `saveDraftState(...)` in `lib/collaborative-store.ts`.
- Read/update logic prefers normalized helper functions like `getDraftById(...)`, `fetchWritingRules(...)`, and `fetchReferenceAssets(...)` instead of embedding repeated Supabase queries in every route.
- Version history is captured explicitly through `createVersionSnapshot(...)`.

## Error Handling

- User-facing errors are translated into `AppError` instances in `lib/api.ts`.
- Unknown errors are normalized by `handleRouteError(...)`, with special handling for schema mismatch cases to surface missing-migration issues.
- Several files still use broad `catch (error: any)` or row coercions like `row: any`; examples appear in `lib/official-document-ai.ts`, `lib/collaborative-store.ts`, `lib/file-parser.ts`, and `app/generate/page.tsx`.

## Import And Module Style

- Absolute alias imports using `@/` are preferred over long relative paths.
- Files use named exports for helpers and route-local `POST`/`GET`/`PATCH`/`DELETE` exports for handlers.
- Most code stays ASCII-only even though product copy is Chinese.

## UI Patterns

- Simple pages like `app/page.tsx` and `app/history/page.tsx` fetch JSON directly from route handlers with `fetch(...)`.
- The main workflow page `app/generate/page.tsx` keeps a large amount of local state in React hooks rather than splitting into many child components or reducers.
- Styling is done inline with Tailwind utility classes instead of CSS modules or component-level stylesheets.

## Workflow Conventions

- Collaborative authoring advances through fixed stages: `intake`, `planning`, `outline`, `draft`, `review`, `done`; see `lib/validation.ts` and `lib/collaborative-store.ts`.
- AI-heavy routes consistently declare `export const runtime = 'nodejs'` and `export const maxDuration = 60`.
- Daily quotas are action-based and logged in `usage_events`, while short-term limits are enforced by in-memory buckets.

## Formatting And Content Rules

- Word output is template-driven through `lib/document-generator.ts` and `templates/*.json`.
- Prompting in `lib/official-document-ai.ts` and `lib/official-document-workflow.ts` is heavily specialized around GB/T 9704-2012 public-document writing rules.
