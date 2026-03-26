# Architecture

**Analysis Date:** 2026-03-26

## Pattern Overview

**Overall:** Next.js App Router monolith with route-level orchestration, shared domain services in `lib/`, and Supabase as the persistence and auth boundary.

**Key Characteristics:**
- UI pages in `app/` call internal JSON APIs under `app/api/`; page components do not call providers or Supabase directly except browser-auth helpers such as `app/change-password/page.tsx`.
- Route handlers follow a consistent pipeline: validate input, require auth, enforce quota/rate limits, load context, run workflow/service code, persist draft/version state, return JSON. Evidence: `app/api/ai/intake/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/review/route.ts`, `app/api/generate/route.ts`.
- Shared business logic is centralized in `lib/official-document-workflow.ts`, `lib/collaborative-store.ts`, `lib/document-generator.ts`, and helper modules instead of being duplicated across routes.

## Layers

**Presentation Layer:**
- Purpose: Render the authenticated writing UI, settings, history, login, and password change flows.
- Location: `app/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, `app/change-password/page.tsx`
- Contains: Client components, fetch calls to internal APIs, local workflow state, stage tabs, and page-level interaction logic.
- Depends on: Internal API routes, browser navigation, and `lib/supabase/browser.ts` for password updates.
- Used by: End users in the browser.

**Middleware/Auth Gate Layer:**
- Purpose: Protect pages, refresh Supabase auth state, and enforce forced-password-change redirects.
- Location: `middleware.ts`, `lib/supabase/middleware.ts`
- Contains: Request interception, public-path checks, route redirects, session refresh logic.
- Depends on: Supabase SSR client config from `lib/env.ts`.
- Used by: Every non-static request except excluded `_next` assets.

**Route Handler Layer:**
- Purpose: Expose server-side application capabilities as internal HTTP endpoints.
- Location: `app/api/**/*.ts`
- Contains: CRUD endpoints (`app/api/drafts/route.ts`, `app/api/settings/route.ts`, `app/api/contacts/route.ts`, `app/api/common-phrases/route.ts`), auth endpoints (`app/api/login/route.ts`, `app/api/logout/route.ts`), and AI workflow endpoints (`app/api/ai/*/route.ts`).
- Depends on: `lib/api.ts`, `lib/auth.ts`, `lib/validation.ts`, `lib/quota.ts`, `lib/ratelimit.ts`, workflow/store modules.
- Used by: Client pages in `app/`.

**Workflow/Domain Layer:**
- Purpose: Turn user facts, structure plans, outlines, drafts, revisions, and review requests into deterministic workflow outputs.
- Location: `lib/official-document-workflow.ts`, `lib/official-document-ai.ts`, `lib/providers.ts`, `lib/validation.ts`
- Contains: Document-type rules, structured-output schemas, model prompts, token budgets, planning/outline/draft/review orchestration.
- Depends on: AI providers, Zod schemas, document-type configuration, and persisted rule/reference context.
- Used by: AI route handlers in `app/api/ai/*/route.ts`.

**Persistence/State Layer:**
- Purpose: Read and write drafts, versions, rules, references, profiles, contacts, phrases, and usage events.
- Location: `lib/collaborative-store.ts`, `lib/collaborative-route-helpers.ts`, `lib/supabase/server.ts`, `supabase/migrations/*.sql`
- Contains: Draft normalization, version snapshots, rule/reference queries, draft save/restore operations, and database schema definition.
- Depends on: Supabase client instances and SQL schema in `supabase/migrations/20260320120000_initial_schema.sql`, `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`.
- Used by: Route handlers and workflow context loaders.

**Document Export Layer:**
- Purpose: Convert finalized draft data into a `.docx` buffer using template-driven formatting.
- Location: `lib/document-generator.ts`, `templates/notice.json`, `templates/letter.json`, `templates/request.json`, `templates/report.json`
- Contains: Template mapping, paragraph/style assembly, attachment formatting, and Word buffer generation.
- Depends on: `docx` package and template JSON definitions.
- Used by: `app/api/generate/route.ts`.

**Operational Script Layer:**
- Purpose: Support development/runtime patching and environment/deployment checks outside request handling.
- Location: `scripts/run-next-dev.mjs`, `scripts/check-deploy.mjs`, `scripts/check-supabase-schema.mjs`, `scripts/invite-user.mjs`
- Contains: Dev-server bootstrap and runtime patching, deployment validation, schema checks, and admin invitation utilities.
- Depends on: Local filesystem, `.env`, and project layout.
- Used by: npm scripts in `package.json`.

## Data Flow

**Collaborative Writing Flow:**
1. `app/generate/page.tsx` collects user answers and selected assets, then posts to `app/api/ai/intake/route.ts`.
2. `app/api/ai/intake/route.ts` validates input, authenticates the user, enforces quota/limits, loads rules/references, runs `runIntakeWorkflow` from `lib/official-document-workflow.ts`, and persists draft state through `saveDraftState` in `lib/collaborative-store.ts`.
3. The page advances to planning and outline by calling `app/api/ai/outline-plan/route.ts` and `app/api/ai/outline/route.ts`, which reuse the same orchestration pattern and store results back into the `drafts.planning` and `drafts.outline` JSON fields.
4. Draft generation runs through `app/api/ai/draft/route.ts`, which either creates the full draft or regenerates a section, then snapshots the result into `document_versions` via `createVersionSnapshot`.
5. Review runs through `app/api/ai/review/route.ts`; export runs through `app/api/generate/route.ts`, which also stores a finalized record in `documents`.

**Settings and Reference Data Flow:**
1. `app/settings/page.tsx` loads profile, providers, common phrases, and contacts from `app/api/settings/route.ts`, `app/api/common-phrases/route.ts`, and `app/api/contacts/route.ts`.
2. These routes read/write per-user rows in `profiles`, `common_phrases`, and `contacts` using the Supabase server client and RLS-protected tables defined in `supabase/migrations/20260320120000_initial_schema.sql`.

**Authentication Flow:**
1. `app/login/page.tsx` posts credentials to `app/api/login/route.ts`.
2. `app/api/login/route.ts` signs in with Supabase and writes cookies through `createServerSupabaseClient` in `lib/supabase/server.ts`.
3. `middleware.ts` refreshes session state on subsequent requests through `updateSession` in `lib/supabase/middleware.ts` and redirects unauthenticated or password-reset-required users.

**State Management:**
- Persistent app state is server-backed, centered on the `drafts` row plus JSON fields for `collected_facts`, `planning`, `outline`, `sections`, `active_rule_ids`, and `active_reference_ids`. Evidence: `lib/collaborative-store.ts`, `app/api/drafts/route.ts`.
- Page-level UI state is local React state in page components, especially `app/generate/page.tsx`.
- There is no separate client state library; fetch + local component state is the active pattern.

## Key Abstractions

**Draft Record:**
- Purpose: The single persisted working object for collaborative document creation.
- Examples: `lib/collaborative-store.ts`, `app/api/drafts/route.ts`
- Pattern: JSON-heavy aggregate record in the `drafts` table, updated incrementally per workflow stage.

**Workflow Stage Machine:**
- Purpose: Represent progress across `intake`, `planning`, `outline`, `draft`, `review`, and `done`.
- Examples: `lib/validation.ts`, `app/generate/page.tsx`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`
- Pattern: Shared string enum persisted in DB and mirrored in client logic.

**Rule and Reference Context:**
- Purpose: Attach optional organizational rules and reference documents to AI operations.
- Examples: `lib/collaborative-route-helpers.ts`, `lib/collaborative-store.ts`, `app/api/reference-assets/route.ts`, `app/api/writing-rules/route.ts`
- Pattern: Context loader that merges persisted assets with per-request session references before workflow execution.

**Version Snapshot:**
- Purpose: Preserve notable draft states for restore and audit.
- Examples: `lib/collaborative-store.ts`, `app/api/ai/versions/route.ts`, `app/api/ai/versions/restore/route.ts`
- Pattern: Append-only snapshot rows in `document_versions`.

## Entry Points

**Main Application Shell:**
- Location: `app/layout.tsx`
- Triggers: All page requests.
- Responsibilities: Global metadata and top-level HTML/body wrapper.

**Authenticated Dashboard:**
- Location: `app/page.tsx`
- Triggers: Visiting `/`.
- Responsibilities: List drafts, navigate to generation/history/settings, and logout.

**Collaborative Editor:**
- Location: `app/generate/page.tsx`
- Triggers: Visiting `/generate` or `/generate?draft=<id>`.
- Responsibilities: Run the staged writing flow, call AI APIs, manage planning/outline/draft/review UI, and coordinate export actions.

**Edge Middleware:**
- Location: `middleware.ts`
- Triggers: Every matched request.
- Responsibilities: Session refresh, page protection, redirect logic.

**AI API Surface:**
- Location: `app/api/ai/intake/route.ts`, `app/api/ai/outline-plan/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/revise/route.ts`, `app/api/ai/review/route.ts`
- Triggers: Client fetches from the generate page.
- Responsibilities: Execute each workflow stage and persist results.

**Export API:**
- Location: `app/api/generate/route.ts`
- Triggers: Final export request from the editor.
- Responsibilities: Generate `.docx`, save final document row, mark draft `done`, create version snapshot.

## Error Handling

**Strategy:** Centralized route-level normalization with typed `AppError` plus uniform JSON error responses.

**Patterns:**
- Throw `AppError` for known user-facing failures, then route through `handleRouteError` in `lib/api.ts`.
- Parse and validate all request bodies with Zod schemas in `lib/validation.ts` before touching services.
- Detect outdated database schema via `isSchemaMismatchError` in `lib/api.ts` and return a migration-specific message instead of a generic 500.
- Enforce rate limits and daily quotas before invoking expensive provider workflows. Evidence: `lib/ratelimit.ts`, `lib/quota.ts`.

## Cross-Cutting Concerns

**Logging:** Structured request logging is centralized in `lib/api.ts` via `logRequestResult`, which emits JSON with route, request ID, user ID, provider, status, and duration.

**Validation:** Zod schemas in `lib/validation.ts` define shared request and data-shape contracts for routes and workflow outputs.

**Authentication:** Supabase Auth is the only active auth mechanism, wired through `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `lib/auth.ts`, `app/api/login/route.ts`, and `middleware.ts`.

**Authorization:** Per-user row ownership is enforced primarily by Supabase RLS policies in `supabase/migrations/*.sql`, with route code also filtering by `user_id`.

**Operational Safeguards:** Development bootstrapping and deployment checks live in `scripts/run-next-dev.mjs` and `scripts/check-deploy.mjs`; these are part of the operational architecture and should be updated alongside any runtime or schema changes.

---

*Architecture analysis: 2026-03-26*
