# Codebase Structure

**Analysis Date:** 2026-03-26

## Directory Layout

```text
DocuGeneratingPlatform/
├── app/                    # Next.js App Router pages, layouts, error boundaries, and API routes
├── lib/                    # Shared server/client helpers, workflows, storage access, validation
├── supabase/               # Local Supabase config and SQL migrations
├── scripts/                # Dev/runtime/bootstrap and deployment utility scripts
├── templates/              # JSON templates used for Word document generation
├── types/                  # Project-level shared type declarations
├── tasks/                  # Project task tracking and lessons learned
├── .planning/codebase/     # Generated codebase map documents
├── .next/                  # Active generated Next.js build/dev output
├── .next_stale_*/          # Archived dev build outputs created by the custom dev script
├── workflows/              # Reserved by project instructions; currently no files
├── tools/                  # Reserved by project instructions; currently no files
└── package.json            # npm scripts and dependency manifest
```

## Directory Purposes

**`app/`:**
- Purpose: Houses all routable UI pages and all internal API endpoints.
- Contains: `page.tsx` entry pages, `layout.tsx`, `globals.css`, error boundaries, and route handlers under `app/api/`.
- Key files: `app/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, `app/change-password/page.tsx`, `app/api/ai/draft/route.ts`

**`app/api/`:**
- Purpose: Server-side application interface consumed by the frontend.
- Contains: Auth routes, CRUD routes for drafts/settings/contacts/phrases/assets, and AI workflow routes.
- Key files: `app/api/login/route.ts`, `app/api/logout/route.ts`, `app/api/drafts/route.ts`, `app/api/settings/route.ts`, `app/api/ai/intake/route.ts`, `app/api/ai/outline-plan/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/review/route.ts`, `app/api/generate/route.ts`

**`lib/`:**
- Purpose: Shared non-UI logic.
- Contains: Auth/session helpers, API error/logging utilities, Zod validation, provider config, collaborative workflow logic, Supabase data access, quota/rate-limit guards, document generation.
- Key files: `lib/api.ts`, `lib/auth.ts`, `lib/validation.ts`, `lib/providers.ts`, `lib/official-document-workflow.ts`, `lib/collaborative-store.ts`, `lib/document-generator.ts`

**`lib/supabase/`:**
- Purpose: Encapsulates Supabase client creation for server, browser, and middleware contexts.
- Contains: SSR/browser/middleware-specific client builders.
- Key files: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`

**`supabase/`:**
- Purpose: Database schema and local Supabase configuration.
- Contains: `config.toml` and ordered SQL migrations.
- Key files: `supabase/config.toml`, `supabase/migrations/20260320120000_initial_schema.sql`, `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`

**`scripts/`:**
- Purpose: Operational tooling used through npm scripts or manual maintenance.
- Contains: Development runtime patching, deploy checks, schema checks, admin invitation logic.
- Key files: `scripts/run-next-dev.mjs`, `scripts/check-deploy.mjs`, `scripts/check-supabase-schema.mjs`, `scripts/invite-user.mjs`

**`templates/`:**
- Purpose: Define document formatting and section layout for exported `.docx` files.
- Contains: One JSON template per supported official document type plus form metadata.
- Key files: `templates/notice.json`, `templates/letter.json`, `templates/request.json`, `templates/report.json`, `templates/form-fields.json`

**`tasks/`:**
- Purpose: Project-local execution notes and lessons.
- Contains: Current TODO tracking and recurring issue notes.
- Key files: `tasks/todo.md`, `tasks/lessons.md`

**`workflows/`:**
- Purpose: Reserved by project instructions for markdown SOPs.
- Contains: No files in the current repo state.
- Key files: Not applicable

**`tools/`:**
- Purpose: Reserved by project instructions for deterministic scripts.
- Contains: No files in the current repo state.
- Key files: Not applicable

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML shell for every page.
- `app/page.tsx`: Authenticated dashboard/home.
- `app/generate/page.tsx`: Main collaborative writing UI.
- `middleware.ts`: Global auth/session redirect layer.
- `app/api/login/route.ts`: Login entry point.
- `app/api/generate/route.ts`: Final Word export entry point.

**Configuration:**
- `package.json`: npm commands and dependencies.
- `tsconfig.json`: TypeScript and `@/*` alias configuration.
- `next.config.js`: Security headers and webpack fallbacks.
- `supabase/config.toml`: Local Supabase configuration.

**Core Logic:**
- `lib/official-document-workflow.ts`: AI workflow orchestration.
- `lib/collaborative-store.ts`: Draft/version persistence API.
- `lib/document-generator.ts`: `.docx` generation from templates.
- `lib/providers.ts`: Provider availability/config resolution.
- `lib/validation.ts`: Shared request/data schemas.

**Testing:**
- No dedicated test directory or test files detected in the current repo state.

## Naming Conventions

**Files:**
- Route files use Next conventions: `app/**/page.tsx`, `app/**/route.ts`, `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`.
- Shared modules in `lib/` use lowercase kebab-free filenames aligned to domain responsibility, for example `lib/collaborative-store.ts`, `lib/document-generator.ts`, `lib/official-document-workflow.ts`.
- SQL migrations use timestamp-prefixed snake_case filenames, for example `supabase/migrations/20260323150000_outline_planning_upgrade.sql`.
- Utility scripts use kebab-case `.mjs`, for example `scripts/run-next-dev.mjs`.

**Directories:**
- App routes mirror URL structure, for example `app/generate/`, `app/history/`, `app/settings/`, `app/login/`.
- API directories mirror endpoint paths, for example `app/api/ai/outline-plan/`, `app/api/ai/versions/restore/`.
- Supabase and script folders are top-level and single-purpose; there is no deep package-by-feature split outside `app/`.

## Where to Add New Code

**New Authenticated Page:**
- Primary code: create a new route in `app/<route>/page.tsx`
- Shared page-specific fetches: call an internal endpoint under `app/api/<resource>/route.ts`
- If the page needs shared helpers: add them under `lib/`

**New AI Workflow Step or Variant:**
- Route entry: add `app/api/ai/<step>/route.ts`
- Request/response schema: extend `lib/validation.ts`
- Business logic: add workflow functions to `lib/official-document-workflow.ts`
- Persistence changes: extend `lib/collaborative-store.ts` and, if needed, add a new migration under `supabase/migrations/`

**New Draft/Settings CRUD Endpoint:**
- Route implementation: `app/api/<resource>/route.ts`
- Auth wrapper: use `lib/auth.ts`
- Error/logging: use `lib/api.ts`
- Validation: add or extend schemas in `lib/validation.ts`

**New Database-backed Capability:**
- Schema: add a new timestamped SQL file in `supabase/migrations/`
- Data access: add typed helpers in `lib/collaborative-store.ts` or a focused new `lib/*-store.ts`
- Route integration: wire the new store helper into `app/api/.../route.ts`
- Deployment checks: update `scripts/check-deploy.mjs` if the new capability changes required setup

**New Export Format or Template Change:**
- Template definitions: update/add files in `templates/`
- Renderer logic: extend `lib/document-generator.ts`
- Export endpoint: keep `app/api/generate/route.ts` as the orchestration entry point

**Utilities:**
- Shared server/client helpers: `lib/`
- CLI or environment utilities: `scripts/`
- Do not place reusable logic directly inside page components or route files when it is needed in more than one endpoint/page.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated codebase reference docs consumed by planning/execution workflows.
- Generated: Yes
- Committed: Yes

**`.next/`:**
- Purpose: Active Next.js generated output for local build/dev.
- Generated: Yes
- Committed: No

**`.next_stale_*`:**
- Purpose: Archived `.next` directories created by `scripts/run-next-dev.mjs` before starting a fresh dev session.
- Generated: Yes
- Committed: No

**`workflows/`:**
- Purpose: Intended SOP storage per project instructions.
- Generated: No
- Committed: Yes

**`tools/`:**
- Purpose: Intended deterministic script storage per project instructions.
- Generated: No
- Committed: Yes

## Placement Guidance

Use `app/` only for route-facing code. Put orchestration rules, validation, provider logic, and persistence helpers in `lib/` so route handlers stay thin.

When a change requires DB shape updates, add a new migration file in `supabase/migrations/` instead of editing historical migrations. Keep route payload contracts aligned with `lib/validation.ts` and persisted JSON shapes aligned with `lib/collaborative-store.ts`.

Do not place new generated or temporary operational artifacts outside `.next*` or other disposable directories. Existing project instructions reserve `workflows/` and `tools/`, but there are no active implementations there yet; if those layers become real, keep markdown SOPs in `workflows/` and deterministic executables in `tools/`.

---

*Structure analysis: 2026-03-26*
