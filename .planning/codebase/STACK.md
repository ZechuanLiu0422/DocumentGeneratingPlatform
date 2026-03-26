# Technology Stack

**Analysis Date:** 2026-03-26

## Languages

**Primary:**
- TypeScript - application code in `app/**/*.ts(x)`, `lib/**/*.ts`, `middleware.ts`, and `types/**/*.ts`
- JavaScript (ES modules) - operational scripts in `scripts/*.mjs` and config in `next.config.js`

**Secondary:**
- SQL - Supabase schema and policy definitions in `supabase/migrations/*.sql`
- CSS - global styling in `app/globals.css`
- JSON - app templates in `templates/*.json`, deployment config in `vercel.json`, and package metadata in `package.json`

## Runtime

**Environment:**
- Node.js runtime for the Next.js app and scripts. Route handlers that perform AI calls, file parsing, auth, and exports explicitly opt into Node with `export const runtime = 'nodejs'` in files such as `app/api/generate/route.ts`, `app/api/upload-reference/route.ts`, and `app/api/ai/draft/route.ts`
- Browser runtime for client pages and Supabase browser auth in `app/**/*.tsx` and `lib/supabase/browser.ts`
- Supabase local development stack configured with PostgreSQL 15 in `supabase/config.toml`

**Package Manager:**
- npm - inferred from `package-lock.json` (lockfileVersion 3) and `package.json`
- Lockfile: present at `package-lock.json`

## Frameworks

**Core:**
- Next.js 14.2.0 - App Router web framework and API layer in `package.json`, with routes under `app/` and middleware in `middleware.ts`
- React 18.2.0 - UI runtime for pages in `app/*.tsx`
- Supabase SSR 0.9.0 plus Supabase JS 2.99.3 - auth/session/database clients in `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/supabase/middleware.ts`, and admin scripts in `scripts/*.mjs`

**Testing:**
- Not detected. No Jest, Vitest, Playwright, or test scripts are declared in `package.json`

**Build/Dev:**
- TypeScript 5 - type checking and editor support via `tsconfig.json`
- Tailwind CSS 3.4.0, PostCSS 8, Autoprefixer 10 - frontend styling toolchain declared in `package.json`
- Vercel Next.js deployment config in `vercel.json`

## Key Dependencies

**Critical:**
- `next` 14.2.0 - app framework for pages, route handlers, metadata, and middleware; see `app/layout.tsx` and `middleware.ts`
- `@supabase/ssr` 0.9.0 - cookie-aware server/browser session handling in `lib/supabase/server.ts` and `lib/supabase/browser.ts`
- `@supabase/supabase-js` 2.99.3 - database, auth, and admin access in `lib/collaborative-store.ts`, `lib/auth.ts`, `scripts/invite-user.mjs`, and `scripts/check-supabase-schema.mjs`
- `@anthropic-ai/sdk` 0.80.0 - Claude provider calls in `lib/official-document-ai.ts`
- `openai` 6.32.0 - OpenAI-compatible calls for OpenAI, Doubao, and GLM in `lib/official-document-ai.ts` and `lib/providers.ts`
- `zod` 4.3.6 - request and payload validation in `lib/validation.ts` and API routes under `app/api/`

**Infrastructure:**
- `mammoth` 1.12.0 - DOCX text extraction in `lib/file-parser.ts`
- `pdfjs-dist` 5.5.207 - PDF text extraction in `lib/file-parser.ts`
- `docx` 9.6.1 - `.docx` generation in `lib/document-generator.ts`

## Configuration

**Environment:**
- Public Supabase config is required through `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `lib/env.ts`
- At least one AI provider pair is required. Supported env pairs are defined in `lib/providers.ts` and surfaced in `.env.example`: `CLAUDE_API_KEY`/`CLAUDE_MODEL`, `OPENAI_API_KEY`/`OPENAI_MODEL`, `DOUBAO_API_KEY`/`DOUBAO_MODEL`, `GLM_API_KEY`/`GLM_MODEL`
- `SUPABASE_SERVICE_ROLE_KEY` is optional for normal app runtime but required by admin/schema scripts in `scripts/invite-user.mjs` and `scripts/check-supabase-schema.mjs`
- Environment file presence is detected locally via `.env`, `.env.local`, and `.env.example`; only `.env.example` is safe to read and document

**Build:**
- Next.js config lives in `next.config.js`
- TypeScript config lives in `tsconfig.json`
- Vercel deployment config lives in `vercel.json`
- Supabase local stack config lives in `supabase/config.toml`

## Platform Requirements

**Development:**
- Install npm dependencies from `package.json`
- Provide a populated `.env` or `.env.local` based on `.env.example`
- Run Supabase migrations from `supabase/migrations/*.sql` against the target project before using collaborative writing features; this is enforced by `scripts/check-deploy.mjs` and `scripts/check-supabase-schema.mjs`
- Run the app with `npm run dev`, which uses `scripts/run-next-dev.mjs`

**Production:**
- Primary deployment target is Vercel, indicated by `vercel.json` and `app/layout.tsx` metadata text mentioning Vercel
- Production also requires a Supabase project with Auth, Postgres, and the SQL migrations from `supabase/migrations/*.sql`

---

*Stack analysis: 2026-03-26*
