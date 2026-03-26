# Stack

## Overview

- The application is a `Next.js 14` App Router project with `React 18`, `TypeScript`, and `Tailwind CSS`; see `package.json`, `app/`, and `app/globals.css`.
- Most product logic lives in route handlers under `app/api/*` plus workflow/helper modules in `lib/*`.
- The project is intended for deployment on Vercel, with Supabase handling auth and database concerns; this is described in `README.md` and `vercel.json`.

## Runtime

- The browser UI is implemented with client components such as `app/page.tsx`, `app/history/page.tsx`, `app/settings/page.tsx`, and the large workflow screen in `app/generate/page.tsx`.
- API endpoints that touch AI, parsing, or document generation explicitly opt into Node runtime via `export const runtime = 'nodejs'`; examples include `app/api/ai/intake/route.ts`, `app/api/ai/draft/route.ts`, and `app/api/generate/route.ts`.
- Middleware-based auth/session routing is handled in `middleware.ts` and `lib/supabase/middleware.ts`.

## Core Libraries

- Framework: `next`, `react`, `react-dom`.
- Validation: `zod` in `lib/validation.ts`.
- Supabase SSR + browser/server clients: `@supabase/ssr`, `@supabase/supabase-js`, implemented in `lib/supabase/server.ts`, `lib/supabase/browser.ts`, and `lib/supabase/middleware.ts`.
- AI SDKs: `@anthropic-ai/sdk` and `openai`, wrapped in `lib/official-document-ai.ts`.
- File/document processing: `docx` in `lib/document-generator.ts`, `mammoth` and `pdfjs-dist` in `lib/file-parser.ts`.

## Build And Local Tooling

- Development starts through `npm run dev`, which runs `node scripts/run-next-dev.mjs` instead of plain `next dev`.
- Production build/start still use `next build` and `next start`.
- Deployment/schema helpers live in `scripts/check-deploy.mjs`, `scripts/check-supabase-schema.mjs`, and `scripts/invite-user.mjs`.
- TypeScript path aliases are used throughout via imports like `@/lib/api`; see `tsconfig.json`.

## Frontend Styling

- Styling is utility-first Tailwind CSS configured by `tailwind.config.js` and `postcss.config.js`.
- There is no separate component library folder; page-level JSX and styling are co-located, especially in `app/generate/page.tsx`.

## Data And Template Assets

- Word document layout is template-driven through JSON files in `templates/notice.json`, `templates/letter.json`, `templates/request.json`, `templates/report.json`, and `templates/form-fields.json`.
- Database schema is versioned in SQL migrations under `supabase/migrations/`.

## Notable Traits

- The codebase mixes newer collaborative writing flows (`app/api/ai/*`, `lib/official-document-workflow.ts`, `lib/collaborative-store.ts`) with older single-shot generation endpoints like `app/api/polish/route.ts` and `app/api/refine/route.ts`.
- There is no dedicated test runner, lint config, or CI definition checked into the repository; quality gates are script-based and manual.
