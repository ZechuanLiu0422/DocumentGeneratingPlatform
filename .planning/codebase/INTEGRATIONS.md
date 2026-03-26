# Integrations

## Supabase

- Supabase is the primary external platform for auth and data persistence.
- Public client configuration comes from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; see `.env.example` and `lib/env.ts`.
- Server and browser clients are created in `lib/supabase/server.ts` and `lib/supabase/browser.ts`.
- Session refresh and cookie propagation happen in `lib/supabase/middleware.ts`, which is used by `middleware.ts`.

## Database Tables

- Core tables are created in `supabase/migrations/20260320120000_initial_schema.sql`: `profiles`, `documents`, `drafts`, `contacts`, `common_phrases`, and `usage_events`.
- Collaborative-writing features are added in `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`: `writing_rules`, `reference_assets`, and `document_versions`.
- Planning-specific state is added in `supabase/migrations/20260323150000_outline_planning_upgrade.sql`, especially the `planning` JSON column on `drafts`.
- RLS is enabled broadly across these tables in the migration files, and route handlers filter rows by `user_id`.

## Authentication

- User login and logout are handled through Supabase Auth in `app/api/login/route.ts` and `app/api/logout/route.ts`.
- Mandatory password rotation is enforced through `middleware.ts` plus the UI in `app/change-password/page.tsx`.
- Route-level auth for API handlers is centralized in `lib/auth.ts` via `requireRouteUser`.

## AI Providers

- Provider discovery and enablement logic live in `lib/providers.ts`.
- Supported providers are `claude`, `openai`, `doubao`, and `glm`.
- `claude` uses the Anthropic SDK in `lib/official-document-ai.ts`.
- `openai`, `doubao`, and `glm` all use the OpenAI-compatible client path in `lib/official-document-ai.ts`, with custom `baseURL` values for `doubao` and `glm`.
- Provider credentials are environment-driven and never stored in the database according to `README.md`, `.env.example`, and `lib/providers.ts`.

## File Parsing And Export

- Uploaded references are parsed locally in `lib/file-parser.ts` using `mammoth` for `.docx` and `pdfjs-dist` for `.pdf`.
- Final Word output is generated in-memory by `lib/document-generator.ts` using the `docx` package and JSON templates from `templates/*`.
- The export endpoint `app/api/generate/route.ts` returns a Base64 payload instead of uploading the file to object storage.

## Deployment And Operations

- Vercel is the intended deployment target per `README.md` and `vercel.json`.
- `scripts/check-deploy.mjs` validates local env vars and migration presence before deployment.
- `scripts/check-supabase-schema.mjs` performs runtime checks against the Supabase schema.

## Internal Integration Surfaces

- Collaborative context assembly happens in `lib/collaborative-route-helpers.ts`, which merges stored rules/assets with transient session references.
- Usage quotas are backed by the `usage_events` table in `lib/quota.ts`.
- Rate limits are enforced in-memory in `lib/ratelimit.ts`, separate from database-backed daily quotas.

## Missing Integrations

- There is no integration with Supabase Storage or any other blob store yet; `README.md` lists storage-backed export history as future work.
- No external queue, cache, or observability provider is configured in the repository.
