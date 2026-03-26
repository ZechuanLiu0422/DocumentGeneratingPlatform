# External Integrations

**Analysis Date:** 2026-03-26

## APIs & External Services

**Backend platform:**
- Supabase - primary backend for auth, database access, and admin operations
  - SDK/Client: `@supabase/ssr` and `@supabase/supabase-js`
  - Evidence: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`, `lib/auth.ts`, `scripts/invite-user.mjs`, `scripts/check-supabase-schema.mjs`
  - Auth: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional `SUPABASE_SERVICE_ROLE_KEY`

**AI providers:**
- Anthropic Claude - document generation provider when `claude` is selected
  - SDK/Client: `@anthropic-ai/sdk`
  - Evidence: `lib/official-document-ai.ts`, `lib/providers.ts`
  - Auth: `CLAUDE_API_KEY`
- OpenAI - document generation provider when `openai` is selected
  - SDK/Client: `openai`
  - Evidence: `lib/official-document-ai.ts`, `lib/providers.ts`
  - Auth: `OPENAI_API_KEY`
- Doubao (Volcengine Ark OpenAI-compatible endpoint) - optional provider through OpenAI-compatible client
  - SDK/Client: `openai`
  - Evidence: `lib/providers.ts` sets `baseURL` to `https://ark.cn-beijing.volces.com/api/v3`
  - Auth: `DOUBAO_API_KEY`
- GLM (Zhipu OpenAI-compatible endpoint) - optional provider through OpenAI-compatible client
  - SDK/Client: `openai`
  - Evidence: `lib/providers.ts` sets `baseURL` to `https://open.bigmodel.cn/api/paas/v4`
  - Auth: `GLM_API_KEY`

**Document processing libraries:**
- Local-only DOCX/PDF parsing and generation; these are libraries, not network integrations
  - Parsing: `lib/file-parser.ts`
  - Generation: `lib/document-generator.ts`

## Data Storage

**Databases:**
- Supabase Postgres
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` for app clients, `SUPABASE_SERVICE_ROLE_KEY` for admin scripts
  - Client: `@supabase/supabase-js` and `@supabase/ssr`
  - Schema evidence: `supabase/migrations/20260320120000_initial_schema.sql`, `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`
  - Core tables: `profiles`, `documents`, `drafts`, `contacts`, `common_phrases`, `usage_events`, `writing_rules`, `reference_assets`, `document_versions`

**File Storage:**
- Local filesystem only during request processing
  - Evidence: uploaded files are read from `request.formData()` and parsed in memory in `app/api/upload-reference/route.ts`
  - Parsed text is stored in Postgres via `reference_assets.content` rather than object storage; see `app/api/reference-assets/route.ts` and `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`
  - Supabase Storage is enabled in `supabase/config.toml`, but no app code references storage buckets, uploads, or signed URLs

**Caching:**
- None
  - No Redis or external cache is configured
  - Request throttling is process-local memory in `lib/ratelimit.ts`

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: SSR cookie-based sessions and middleware enforcement via `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, and `lib/auth.ts`
  - Signup is disabled in local Supabase config: `supabase/config.toml`
  - Admin user provisioning uses `supabase.auth.admin.createUser` in `scripts/invite-user.mjs`
  - New user profile rows are created by a Postgres trigger on `auth.users` in `supabase/migrations/20260320120000_initial_schema.sql`

## Monitoring & Observability

**Error Tracking:**
- None
  - No Sentry, Bugsnag, Honeybadger, or similar SDK is present in `package.json` or source imports

**Logs:**
- Application-level structured response helpers plus script stdout/stderr
  - API request context and error handling live in `lib/api.ts`
  - Operational checks log to the console in `scripts/check-deploy.mjs`, `scripts/check-supabase-schema.mjs`, and `scripts/invite-user.mjs`
  - Usage auditing is persisted in the `usage_events` table through `lib/quota.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel
  - Evidence: `vercel.json`
  - Route function timeout policy: `app/api/**/*.ts` max duration 60 seconds in `vercel.json`

**CI Pipeline:**
- Not detected
  - No `.github/workflows/*`, Buildkite, CircleCI, or similar pipeline config exists in the repo root scan

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- One enabled AI provider pair:
- `CLAUDE_API_KEY` and `CLAUDE_MODEL`
- `OPENAI_API_KEY` and `OPENAI_MODEL`
- `DOUBAO_API_KEY` and `DOUBAO_MODEL`
- `GLM_API_KEY` and `GLM_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY` for admin flows and schema checks

**Secrets location:**
- Local developer secrets live in `.env` and `.env.local` and are referenced by `scripts/check-deploy.mjs`
- `.env.example` documents the expected keys without values
- Production/preview deployment secrets are expected in Vercel environments; `scripts/check-deploy.mjs` explicitly calls out Vercel Preview and Production configuration

## Webhooks & Callbacks

**Incoming:**
- None
  - No webhook routes or signature verification code are present under `app/api/`

**Outgoing:**
- AI completion requests to Anthropic, OpenAI, Doubao, and GLM from `lib/official-document-ai.ts`
- Supabase Auth and PostgREST requests from `lib/supabase/*.ts`, `lib/collaborative-store.ts`, and scripts in `scripts/*.mjs`

---

*Integration audit: 2026-03-26*
