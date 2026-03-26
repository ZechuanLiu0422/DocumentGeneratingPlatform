# Architecture

## High-Level Shape

- The product is a server-rendered Next.js application with a mostly client-driven UI and server route handlers.
- The dominant user journey is the collaborative document-writing flow on `app/generate/page.tsx`.
- Data persistence, auth, draft state, and version history are delegated to Supabase through helper modules in `lib/supabase/*` and `lib/collaborative-store.ts`.

## Main Workflow

- Step 1: user information is collected on `app/generate/page.tsx` and submitted to `app/api/ai/intake/route.ts`.
- Step 2: intake calls `runIntakeWorkflow` in `lib/official-document-workflow.ts`, then persists draft state through `saveDraftState` in `lib/collaborative-store.ts`.
- Step 3: structure planning runs through `app/api/ai/outline-plan/route.ts`.
- Step 4: outline generation/confirmation runs through `app/api/ai/outline/route.ts` and `app/api/ai/outline/confirm/route.ts`.
- Step 5: draft generation and section regeneration run through `app/api/ai/draft/route.ts`.
- Step 6: revision/review/export run through `app/api/ai/revise/route.ts`, `app/api/ai/review/route.ts`, and `app/api/generate/route.ts`.

## Layering

- Presentation layer: page components in `app/*.tsx`.
- Transport layer: route handlers in `app/api/*`.
- Shared route concerns: `lib/api.ts` for request context + error handling, `lib/auth.ts` for authenticated Supabase access, `lib/ratelimit.ts` and `lib/quota.ts` for request controls.
- Domain layer: `lib/official-document-workflow.ts` and `lib/official-document-ai.ts`.
- Persistence layer: `lib/collaborative-store.ts` and the Supabase client helpers in `lib/supabase/*`.

## Request Pattern

- Most routes create a request context using `createRequestContext` from `lib/api.ts`.
- Authenticated routes call `requireRouteUser` from `lib/auth.ts`.
- Request bodies are validated with zod schemas from `lib/validation.ts`.
- Happy-path responses go through `ok(...)`; failures go through `handleRouteError(...)`.
- Many AI routes also record usage in `usage_events` through `recordUsageEvent(...)`.

## State Model

- Drafts are the central aggregate record in `drafts`, mirrored in the `DraftRecord` type in `lib/collaborative-store.ts`.
- Workflow progress is stored on the draft itself through `workflow_stage`, `collected_facts`, `planning`, `outline`, `sections`, `generated_title`, and `generated_content`.
- Snapshot history is stored separately in `document_versions`, created by `createVersionSnapshot(...)`.

## UI Composition

- `app/generate/page.tsx` owns a large amount of screen state with many `useState` hooks for facts, planning options, outline sections, generated sections, review checks, versions, rules, and reference assets.
- Smaller pages such as `app/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, and `app/change-password/page.tsx` mostly fetch route data directly and render simple CRUD flows.

## Entry Points

- App entry: `app/layout.tsx` and `app/page.tsx`.
- Auth/session gate: `middleware.ts`.
- Collaborative writing entry: `app/generate/page.tsx`.
- Export entry: `app/api/generate/route.ts`.

## Architectural Biases

- The codebase prefers centralized workflow functions over putting AI prompt logic directly in route handlers.
- It also prefers JSONB-driven workflow state on a single draft row instead of many normalized relational tables for intermediate authoring stages.
