# Structure

## Top-Level Layout

- `app/`: App Router pages plus all HTTP route handlers.
- `lib/`: shared business logic, persistence helpers, validation, auth, and AI orchestration.
- `supabase/`: local Supabase config plus ordered SQL migrations.
- `templates/`: JSON definitions used by the Word export generator.
- `scripts/`: local operational and troubleshooting scripts.
- `tasks/`: local working notes, lessons, and TODO tracking.
- `.planning/codebase/`: generated codebase map output.

## App Directory

- UI pages live directly under `app/`, including `app/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, and `app/change-password/page.tsx`.
- Error and fallback routes are handled by `app/error.tsx`, `app/global-error.tsx`, and `app/not-found.tsx`.
- API handlers live under `app/api/`, with collaborative-writing routes grouped in `app/api/ai/*`.
- Non-AI CRUD-style routes include `app/api/drafts/route.ts`, `app/api/history/route.ts`, `app/api/contacts/route.ts`, `app/api/common-phrases/route.ts`, `app/api/reference-assets/route.ts`, and `app/api/writing-rules/route.ts`.

## Lib Directory

- `lib/api.ts`: request context, normalized errors, JSON responses, and logging.
- `lib/auth.ts`: authenticated Supabase route access.
- `lib/providers.ts`: provider catalog and env-backed enablement.
- `lib/official-document-ai.ts`: low-level model calls and older direct-generation prompts.
- `lib/official-document-workflow.ts`: collaborative writing workflow orchestration.
- `lib/collaborative-store.ts`: draft/rule/reference/version persistence.
- `lib/collaborative-route-helpers.ts`: route-level context assembly for rules and references.
- `lib/file-parser.ts` and `lib/document-generator.ts`: upload parsing and `.docx` generation.
- `lib/supabase/*`: browser/server/middleware clients.

## Naming Patterns

- Route handlers are consistently named `route.ts` under nested folders such as `app/api/ai/review/route.ts`.
- Domain helpers are plain TypeScript modules with noun-oriented names, for example `lib/quota.ts` and `lib/validation.ts`.
- SQL migrations use timestamp-prefixed filenames in `supabase/migrations/`.

## Data-Driven Assets

- Export document presentation is driven by `templates/*.json` rather than hardcoded formatting values in JSX.
- Schema evolution is tracked through SQL migrations instead of code-first ORM definitions.

## Operational Files

- `start.command` and `start.bat` are convenience launchers for local usage.
- `scripts/run-next-dev.mjs` is a custom dev entrypoint to isolate stale `.next` state and patch webpack runtime chunk paths.
- `DEPLOYMENT_CHECKLIST.md`, `README.md`, `AGENTS.md`, and `CLAUDE.md` hold human-facing operating guidance.

## Missing Structural Areas

- There is no `components/` directory; reusable UI is mostly embedded in page files, especially `app/generate/page.tsx`.
- There is no `tests/`, `__tests__/`, `e2e/`, `.github/workflows/`, or separate `docs/` directory in the repository.
