# Agent Instructions

You're working inside the **WAT framework** (Workflows, Agents, Tools). This architecture separates concerns so that probabilistic AI handles reasoning while deterministic code handles execution. That separation is what makes this system reliable.

## The WAT Architecture

**Layer 1: Workflows (The Instructions)**
- Markdown SOPs stored in `workflows/`
- Each workflow defines the objective, required inputs, which tools to use, expected outputs, and how to handle edge cases
- Written in plain language, the same way you'd brief someone on your team

**Layer 2: Agents (The Decision-Maker)**
- This is your role. You're responsible for intelligent coordination.
- Read the relevant workflow, run tools in the correct sequence, handle failures gracefully, and ask clarifying questions when needed
- You connect intent to execution without trying to do everything yourself
- Example: If you need to pull data from a website, don't attempt it directly. Read `workflows/scrape_website.md`, figure out the required inputs, then execute `tools/scrape_single_site.py`

**Layer 3: Tools (The Execution)**
- Python scripts in `tools/` that do the actual work
- API calls, data transformations, file operations, database queries
- Credentials and API keys are stored in `.env`
- These scripts are consistent, testable, and fast

**Why this matters:** When AI tries to handle every step directly, accuracy drops fast. If each step is 90% accurate, you're down to 59% success after just five steps. By offloading execution to deterministic scripts, you stay focused on orchestration and decision-making where you excel.

## How to Operate

**1. Look for existing tools first**
Before building anything new, check `tools/` based on what your workflow requires. Only create new scripts when nothing exists for that task.

**2. Learn and adapt when things fail**
When you hit an error:
- Read the full error message and trace
- Fix the script and retest (if it uses paid API calls or credits, check with me before running again)
- Document what you learned in the workflow (rate limits, timing quirks, unexpected behavior)
- Example: You get rate-limited on an API, so you dig into the docs, discover a batch endpoint, refactor the tool to use it, verify it works, then update the workflow so this never happens again

**3. Keep workflows current**
Workflows should evolve as you learn. When you find better methods, discover constraints, or encounter recurring issues, update the workflow. That said, don't create or overwrite workflows without asking unless I explicitly tell you to. These are your instructions and need to be preserved and refined, not tossed after one use.

## The Self-Improvement Loop

Every failure is a chance to make the system stronger:
1. Identify what broke
2. Fix the tool
3. Verify the fix works
4. Update the workflow with the new approach
5. Move on with a more robust system

This loop is how the framework improves over time.

## File Structure

**What goes where:**
- **Deliverables**: Final outputs go to cloud services (Google Sheets, Slides, etc.) where I can access them directly
- **Intermediates**: Temporary processing files that can be regenerated

**Directory layout:**
```
.tmp/           # Temporary files (scraped data, intermediate exports). Regenerated as needed.
tools/          # Python scripts for deterministic execution
workflows/      # Markdown SOPs defining what to do and how
.env            # API keys and environment variables (NEVER store secrets anywhere else)
credentials.json, token.json  # Google OAuth (gitignored)
```

**Core principle:** Local files are just for processing. Anything I need to see or use lives in cloud services. Everything in `.tmp/` is disposable.

## Bottom Line

You sit between what I want (workflows) and what actually gets done (tools). Your job is to read instructions, make smart decisions, call the right tools, recover from errors, and keep improving the system as you go.

Stay pragmatic. Stay reliable. Keep learning.

<!-- GSD:project-start source:PROJECT.md -->
## Project

**DocumentGeneratingPlatform**

DocumentGeneratingPlatform is a brownfield AI-assisted official-document drafting platform built with Next.js, Supabase, and server-managed multi-provider AI integrations. It helps authenticated users produce four common Chinese official document types (`通知`, `函`, `请示`, `报告`) through a staged workflow covering intake, planning, outline generation, drafting, review, history, and Word export.

**Core Value:** Users can turn incomplete inputs into a reliable, policy-aligned official document draft quickly without losing control of drafts, versions, or organizational writing context.

### Constraints

- **Tech stack**: Continue building on Next.js 14, Supabase Auth/Postgres/RLS, and the existing server-managed AI provider abstraction — replacing the core stack would create unnecessary churn
- **Security**: AI keys must remain server-only, and user data must continue to be isolated by Supabase auth plus RLS — this is already a stated baseline in `README.md`
- **Operational**: Collaborative writing features depend on executing all SQL migrations in `supabase/migrations/*.sql` in order — partial schema rollout breaks saves, AI stages, and version restore
- **Product scope**: The current value proposition is document-generation reliability, not broad document collaboration or generalized content authoring — roadmap choices should reinforce this
- **Quality**: The repo currently lacks automated tests, so early phases need to create safety rails before major architectural changes
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript - application code in `app/**/*.ts(x)`, `lib/**/*.ts`, `middleware.ts`, and `types/**/*.ts`
- JavaScript (ES modules) - operational scripts in `scripts/*.mjs` and config in `next.config.js`
- SQL - Supabase schema and policy definitions in `supabase/migrations/*.sql`
- CSS - global styling in `app/globals.css`
- JSON - app templates in `templates/*.json`, deployment config in `vercel.json`, and package metadata in `package.json`
## Runtime
- Node.js runtime for the Next.js app and scripts. Route handlers that perform AI calls, file parsing, auth, and exports explicitly opt into Node with `export const runtime = 'nodejs'` in files such as `app/api/generate/route.ts`, `app/api/upload-reference/route.ts`, and `app/api/ai/draft/route.ts`
- Browser runtime for client pages and Supabase browser auth in `app/**/*.tsx` and `lib/supabase/browser.ts`
- Supabase local development stack configured with PostgreSQL 15 in `supabase/config.toml`
- npm - inferred from `package-lock.json` (lockfileVersion 3) and `package.json`
- Lockfile: present at `package-lock.json`
## Frameworks
- Next.js 14.2.0 - App Router web framework and API layer in `package.json`, with routes under `app/` and middleware in `middleware.ts`
- React 18.2.0 - UI runtime for pages in `app/*.tsx`
- Supabase SSR 0.9.0 plus Supabase JS 2.99.3 - auth/session/database clients in `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`, and admin scripts in `scripts/*.mjs`
- Not detected. No Jest, Vitest, Playwright, or test scripts are declared in `package.json`
- TypeScript 5 - type checking and editor support via `tsconfig.json`
- Tailwind CSS 3.4.0, PostCSS 8, Autoprefixer 10 - frontend styling toolchain declared in `package.json`
- Vercel Next.js deployment config in `vercel.json`
## Key Dependencies
- `next` 14.2.0 - app framework for pages, route handlers, metadata, and middleware; see `app/layout.tsx` and `middleware.ts`
- `@supabase/ssr` 0.9.0 - cookie-aware server/browser session handling in `lib/supabase/server.ts` and `lib/supabase/browser.ts`
- `@supabase/supabase-js` 2.99.3 - database, auth, and admin access in `lib/collaborative-store.ts`, `lib/auth.ts`, `scripts/invite-user.mjs`, and `scripts/check-supabase-schema.mjs`
- `@anthropic-ai/sdk` 0.80.0 - Claude provider calls in `lib/official-document-ai.ts`
- `openai` 6.32.0 - OpenAI-compatible calls for OpenAI, Doubao, and GLM in `lib/official-document-ai.ts` and `lib/providers.ts`
- `zod` 4.3.6 - request and payload validation in `lib/validation.ts` and API routes under `app/api/`
- `mammoth` 1.12.0 - DOCX text extraction in `lib/file-parser.ts`
- `pdfjs-dist` 5.5.207 - PDF text extraction in `lib/file-parser.ts`
- `docx` 9.6.1 - `.docx` generation in `lib/document-generator.ts`
## Configuration
- Public Supabase config is required through `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `lib/env.ts`
- At least one AI provider pair is required. Supported env pairs are defined in `lib/providers.ts` and surfaced in `.env.example`: `CLAUDE_API_KEY`/`CLAUDE_MODEL`, `OPENAI_API_KEY`/`OPENAI_MODEL`, `DOUBAO_API_KEY`/`DOUBAO_MODEL`, `GLM_API_KEY`/`GLM_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY` is optional for normal app runtime but required by admin/schema scripts in `scripts/invite-user.mjs` and `scripts/check-supabase-schema.mjs`
- Environment file presence is detected locally via `.env`, `.env.local`, and `.env.example`; only `.env.example` is safe to read and document
- Next.js config lives in `next.config.js`
- TypeScript config lives in `tsconfig.json`
- Vercel deployment config lives in `vercel.json`
- Supabase local stack config lives in `supabase/config.toml`
## Platform Requirements
- Install npm dependencies from `package.json`
- Provide a populated `.env` or `.env.local` based on `.env.example`
- Run Supabase migrations from `supabase/migrations/*.sql` against the target project before using collaborative writing features; this is enforced by `scripts/check-deploy.mjs` and `scripts/check-supabase-schema.mjs`
- Run the app with `npm run dev`, which uses `scripts/run-next-dev.mjs`
- Primary deployment target is Vercel, indicated by `vercel.json` and `app/layout.tsx` metadata text mentioning Vercel
- Production also requires a Supabase project with Auth, Postgres, and the SQL migrations from `supabase/migrations/*.sql`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use Next.js App Router special filenames for routes and pages: `app/layout.tsx`, `app/error.tsx`, `app/api/drafts/route.ts`.
- Use kebab-case for general modules and scripts: `lib/collaborative-store.ts`, `lib/official-document-workflow.ts`, `scripts/check-supabase-schema.mjs`.
- Use short role-based names for Supabase helpers: `lib/supabase/browser.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`.
- Use camelCase for helpers and service functions: `createRequestContext` in `lib/api.ts`, `requireRouteUser` in `lib/auth.ts`, `getEnabledProviders` in `lib/providers.ts`.
- Use PascalCase for React components and `ErrorPageProps`-style prop types: `RootLayout` in `app/layout.tsx`, `StageTabs` and `GeneratePageContent` in `app/generate/page.tsx`.
- Route handlers export uppercase HTTP verbs exactly as Next.js expects: `GET`, `POST`, `DELETE` in `app/api/drafts/route.ts`.
- Use camelCase for locals and state: `currentDraftId`, `workflowStage`, `enabledProviders`, `forwardedArgs` in `app/generate/page.tsx`, `lib/providers.ts`, and `scripts/run-next-dev.mjs`.
- Use SCREAMING_SNAKE_CASE for module-level constants: `MAX_PLANNING_SECTIONS` in `app/generate/page.tsx`, `DAILY_QUOTAS` in `lib/quota.ts`, `TARGET_SNIPPET` in `scripts/run-next-dev.mjs`.
- Prefer local `type` aliases over interfaces for DTOs and UI state: `Draft`, `PlanningOption`, `ReviewCheck` in `app/generate/page.tsx`; `DraftRecord`, `VersionRecord` in `lib/collaborative-store.ts`.
- Use string-literal unions for domain state instead of enums: `WorkflowStage` in `app/generate/page.tsx`, provider/doc type unions in `lib/collaborative-store.ts`.
## Code Style
- Follow the existing TypeScript/Next formatting style used in `app/layout.tsx`, `app/api/ai/outline/route.ts`, and `lib/validation.ts`: 2-space indentation, single quotes, and semicolons.
- Keep object and array literals multi-line when they become non-trivial, with trailing commas common in multiline structures; see `docTypes` in `app/generate/page.tsx` and schemas in `lib/validation.ts`.
- No repo-level Prettier or Biome config is present. Formatting is convention-driven rather than tool-enforced in files like `package.json` and `tsconfig.json`.
- `package.json` defines `npm run lint` as `next lint`, so the expected lint baseline is Next.js defaults from the framework rather than a committed custom ESLint config.
- TypeScript is intentionally permissive: `tsconfig.json` has `"strict": false`, so code compensates with runtime validation in `lib/validation.ts`.
## Import Organization
- Use the `@/*` alias from `tsconfig.json` for app-local imports.
- Prefer `import type` for type-only dependencies in library code: `lib/collaborative-store.ts` imports `type { SupabaseClient }` and `type { AnalyzeResult }`.
## Error Handling
- Route handlers follow a shared request lifecycle:
- Use `AppError` from `lib/api.ts` for expected user-facing failures such as unauthorized access, quota overflow, invalid credentials, and incomplete planning data.
- Centralize error normalization in `lib/api.ts` instead of formatting route-local JSON errors.
- Allow broad `catch (error)` blocks at route boundaries, but keep thrown error types normalized through `handleRouteError`.
## Logging
- API routes log structured JSON via `logRequestResult` in `lib/api.ts`.
- UI/runtime errors log directly to the console in client components such as `app/error.tsx`.
- Operational scripts print plain-text progress and failures to stdout/stderr, as in `scripts/check-deploy.mjs` and `scripts/run-next-dev.mjs`.
## Comments
- Comments are sparse. The codebase relies on descriptive names and explicit schema/type definitions rather than explanatory comments.
- Prefer self-describing helpers such as `getIncompletePlanningSections` in `app/generate/page.tsx` and `normalizeDraftRecord` in `lib/collaborative-store.ts` over inline commentary.
- Not used in representative files: `app/generate/page.tsx`, `lib/api.ts`, `lib/validation.ts`, `scripts/check-deploy.mjs`.
## Function Design
- Small focused helpers are common in shared modules: `getClientIp` in `lib/api.ts`, `ensureProviderEnabled` in `lib/providers.ts`, `enforceRateLimit` in `lib/ratelimit.ts`.
- Large orchestration files are accepted where the workflow is complex: `app/generate/page.tsx` and `lib/official-document-workflow.ts` concentrate substantial logic in single files.
- Prefer a single object parameter when a function takes many related values: `loadRuleAndReferenceContext(...)` usage in `app/api/ai/outline/route.ts`, `recordUsageEvent(...)` in `lib/quota.ts`, `saveDraftState(...)` calls from AI routes.
- Keep scalar parameters for simple utilities: `enforceRateLimit(key, limit, windowMs, message)` in `lib/ratelimit.ts`.
- Return normalized plain objects from helpers instead of class instances: `createRequestContext` in `lib/api.ts`, `getProviderConfig` in `lib/providers.ts`, `normalizeDraftRecord` in `lib/collaborative-store.ts`.
- Route handlers return `NextResponse` JSON through `ok(...)` and `handleRouteError(...)`.
## Module Design
- Prefer named exports in shared modules: `lib/api.ts`, `lib/quota.ts`, `lib/providers.ts`, `lib/validation.ts`.
- Use default exports for page and error components in the `app/` tree: `app/layout.tsx`, `app/error.tsx`, `app/change-password/page.tsx`.
- Not used. Import from concrete modules directly, for example `@/lib/api`, `@/lib/auth`, and `@/lib/validation` in `app/api/login/route.ts`.
## Practical Guidance
- Add new route handlers under `app/api/**/route.ts` and match the existing pattern from `app/api/drafts/route.ts` and `app/api/ai/outline/route.ts`.
- Define new request/response schemas in `lib/validation.ts` instead of validating inline in route files.
- Put shared persistence helpers in `lib/collaborative-store.ts` or a neighboring `lib/*` module rather than repeating Supabase query shapes across routes.
- Keep frontend page state in local `type` aliases and hook state if extending `app/generate/page.tsx`, but prefer extracting a helper or child component before adding another large inline concern.
- Reuse `@/` alias imports and existing Chinese product copy style when touching user-visible strings in `app/` and `app/api/`.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- UI pages in `app/` call internal JSON APIs under `app/api/`; page components do not call providers or Supabase directly except browser-auth helpers such as `app/change-password/page.tsx`.
- Route handlers follow a consistent pipeline: validate input, require auth, enforce quota/rate limits, load context, run workflow/service code, persist draft/version state, return JSON. Evidence: `app/api/ai/intake/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/review/route.ts`, `app/api/generate/route.ts`.
- Shared business logic is centralized in `lib/official-document-workflow.ts`, `lib/collaborative-store.ts`, `lib/document-generator.ts`, and helper modules instead of being duplicated across routes.
## Layers
- Purpose: Render the authenticated writing UI, settings, history, login, and password change flows.
- Location: `app/page.tsx`, `app/generate/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, `app/login/page.tsx`, `app/change-password/page.tsx`
- Contains: Client components, fetch calls to internal APIs, local workflow state, stage tabs, and page-level interaction logic.
- Depends on: Internal API routes, browser navigation, and `lib/supabase/browser.ts` for password updates.
- Used by: End users in the browser.
- Purpose: Protect pages, refresh Supabase auth state, and enforce forced-password-change redirects.
- Location: `middleware.ts`, `lib/supabase/middleware.ts`
- Contains: Request interception, public-path checks, route redirects, session refresh logic.
- Depends on: Supabase SSR client config from `lib/env.ts`.
- Used by: Every non-static request except excluded `_next` assets.
- Purpose: Expose server-side application capabilities as internal HTTP endpoints.
- Location: `app/api/**/*.ts`
- Contains: CRUD endpoints (`app/api/drafts/route.ts`, `app/api/settings/route.ts`, `app/api/contacts/route.ts`, `app/api/common-phrases/route.ts`), auth endpoints (`app/api/login/route.ts`, `app/api/logout/route.ts`), and AI workflow endpoints (`app/api/ai/*/route.ts`).
- Depends on: `lib/api.ts`, `lib/auth.ts`, `lib/validation.ts`, `lib/quota.ts`, `lib/ratelimit.ts`, workflow/store modules.
- Used by: Client pages in `app/`.
- Purpose: Turn user facts, structure plans, outlines, drafts, revisions, and review requests into deterministic workflow outputs.
- Location: `lib/official-document-workflow.ts`, `lib/official-document-ai.ts`, `lib/providers.ts`, `lib/validation.ts`
- Contains: Document-type rules, structured-output schemas, model prompts, token budgets, planning/outline/draft/review orchestration.
- Depends on: AI providers, Zod schemas, document-type configuration, and persisted rule/reference context.
- Used by: AI route handlers in `app/api/ai/*/route.ts`.
- Purpose: Read and write drafts, versions, rules, references, profiles, contacts, phrases, and usage events.
- Location: `lib/collaborative-store.ts`, `lib/collaborative-route-helpers.ts`, `lib/supabase/server.ts`, `supabase/migrations/*.sql`
- Contains: Draft normalization, version snapshots, rule/reference queries, draft save/restore operations, and database schema definition.
- Depends on: Supabase client instances and SQL schema in `supabase/migrations/20260320120000_initial_schema.sql`, `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`.
- Used by: Route handlers and workflow context loaders.
- Purpose: Convert finalized draft data into a `.docx` buffer using template-driven formatting.
- Location: `lib/document-generator.ts`, `templates/notice.json`, `templates/letter.json`, `templates/request.json`, `templates/report.json`
- Contains: Template mapping, paragraph/style assembly, attachment formatting, and Word buffer generation.
- Depends on: `docx` package and template JSON definitions.
- Used by: `app/api/generate/route.ts`.
- Purpose: Support development/runtime patching and environment/deployment checks outside request handling.
- Location: `scripts/run-next-dev.mjs`, `scripts/check-deploy.mjs`, `scripts/check-supabase-schema.mjs`, `scripts/invite-user.mjs`
- Contains: Dev-server bootstrap and runtime patching, deployment validation, schema checks, and admin invitation utilities.
- Depends on: Local filesystem, `.env`, and project layout.
- Used by: npm scripts in `package.json`.
## Data Flow
- Persistent app state is server-backed, centered on the `drafts` row plus JSON fields for `collected_facts`, `planning`, `outline`, `sections`, `active_rule_ids`, and `active_reference_ids`. Evidence: `lib/collaborative-store.ts`, `app/api/drafts/route.ts`.
- Page-level UI state is local React state in page components, especially `app/generate/page.tsx`.
- There is no separate client state library; fetch + local component state is the active pattern.
## Key Abstractions
- Purpose: The single persisted working object for collaborative document creation.
- Examples: `lib/collaborative-store.ts`, `app/api/drafts/route.ts`
- Pattern: JSON-heavy aggregate record in the `drafts` table, updated incrementally per workflow stage.
- Purpose: Represent progress across `intake`, `planning`, `outline`, `draft`, `review`, and `done`.
- Examples: `lib/validation.ts`, `app/generate/page.tsx`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`
- Pattern: Shared string enum persisted in DB and mirrored in client logic.
- Purpose: Attach optional organizational rules and reference documents to AI operations.
- Examples: `lib/collaborative-route-helpers.ts`, `lib/collaborative-store.ts`, `app/api/reference-assets/route.ts`, `app/api/writing-rules/route.ts`
- Pattern: Context loader that merges persisted assets with per-request session references before workflow execution.
- Purpose: Preserve notable draft states for restore and audit.
- Examples: `lib/collaborative-store.ts`, `app/api/ai/versions/route.ts`, `app/api/ai/versions/restore/route.ts`
- Pattern: Append-only snapshot rows in `document_versions`.
## Entry Points
- Location: `app/layout.tsx`
- Triggers: All page requests.
- Responsibilities: Global metadata and top-level HTML/body wrapper.
- Location: `app/page.tsx`
- Triggers: Visiting `/`.
- Responsibilities: List drafts, navigate to generation/history/settings, and logout.
- Location: `app/generate/page.tsx`
- Triggers: Visiting `/generate` or `/generate?draft=<id>`.
- Responsibilities: Run the staged writing flow, call AI APIs, manage planning/outline/draft/review UI, and coordinate export actions.
- Location: `middleware.ts`
- Triggers: Every matched request.
- Responsibilities: Session refresh, page protection, redirect logic.
- Location: `app/api/ai/intake/route.ts`, `app/api/ai/outline-plan/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/revise/route.ts`, `app/api/ai/review/route.ts`
- Triggers: Client fetches from the generate page.
- Responsibilities: Execute each workflow stage and persist results.
- Location: `app/api/generate/route.ts`
- Triggers: Final export request from the editor.
- Responsibilities: Generate `.docx`, save final document row, mark draft `done`, create version snapshot.
## Error Handling
- Throw `AppError` for known user-facing failures, then route through `handleRouteError` in `lib/api.ts`.
- Parse and validate all request bodies with Zod schemas in `lib/validation.ts` before touching services.
- Detect outdated database schema via `isSchemaMismatchError` in `lib/api.ts` and return a migration-specific message instead of a generic 500.
- Enforce rate limits and daily quotas before invoking expensive provider workflows. Evidence: `lib/ratelimit.ts`, `lib/quota.ts`.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
