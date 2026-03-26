# Technology Stack

**Project:** DocumentGeneratingPlatform
**Researched:** 2026-03-26
**Overall recommendation:** Keep the existing Next.js + Supabase + server-managed multi-provider AI architecture, upgrade it to the current stable platform line, and harden it with durable jobs, distributed rate limiting, real test coverage, and production observability. Do not rewrite the core stack.

## Recommended Stack

### Core Platform

| Technology | Version | Purpose | Recommendation | Confidence |
|------------|---------|---------|----------------|------------|
| Next.js | 16.1.x | App framework, routing, server APIs | **Keep and upgrade** from 14.x. Next.js 16 is the active line, and 14.x/15.x/16.x all received 2025 security advisories around React Server Components, so staying old is unnecessary risk. Upgrade with codemods and treat async request API changes as a planned migration. | HIGH |
| React | 19.2 | UI runtime | **Keep and upgrade** alongside Next.js 16.1.x. This is the current documented React line. | HIGH |
| Node.js | 22 LTS baseline | Server runtime for route handlers, AI orchestration, file parsing, docx export, jobs | **Standardize on Node 22** for local, CI, and hosting. It is the safest current baseline across the surrounding ecosystem. | MEDIUM |
| TypeScript | 5.x current minor | App, domain, and API typing | **Keep** and tighten. Raise strictness incrementally instead of introducing a second schema/model layer. | HIGH |

### Database, Auth, and Persistence

| Technology | Version | Purpose | Recommendation | Confidence |
|------------|---------|---------|----------------|------------|
| Supabase Postgres | Managed current | System of record | **Keep as the primary datastore.** The app already fits a SQL-first, RLS-protected model well. Do not introduce a second primary database. | HIGH |
| Supabase Auth + `@supabase/ssr` | Current | Auth/session handling | **Keep**, but align server auth checks with current Supabase guidance: prefer claims validation in server code and keep cookie-based SSR integration. | HIGH |
| Supabase Storage | Current | Reference files / upload-backed assets | **Keep and use more deliberately** for user-uploaded reference material instead of filesystem assumptions. | MEDIUM |
| SQL migrations + generated TS types | Current | Schema evolution and app typing | **Double down here.** Keep SQL-first migrations and add generated DB types to reduce drift. | HIGH |
| pgTAP via Supabase test tooling | Current | RLS and schema tests | **Add immediately.** This is the right way to prove RLS, ownership, and workflow-integrity invariants. | HIGH |
| `pg_cron` | Current | Small scheduled DB jobs | **Add selectively** for low-frequency database maintenance and consistency checks only. Do not use it as a replacement for application workflow jobs. | HIGH |
| `pgvector` | Current | Semantic retrieval | **Do not add yet** unless retrieval over reference documents becomes a measured product need. Current product value is workflow reliability, not RAG breadth. | MEDIUM |

### AI and Workflow Execution

| Technology | Version | Purpose | Recommendation | Confidence |
|------------|---------|---------|----------------|------------|
| Existing server-managed provider abstraction | Existing domain layer | Claude / OpenAI-compatible / Doubao / GLM orchestration | **Keep.** It already matches the product’s governance requirements better than pushing model logic into the client or user-managed keys. | HIGH |
| Trigger.dev | 4.x | Durable background jobs, retries, long-running AI work, export pipelines | **Add.** This is the cleanest hardening move for AI-heavy brownfield Next.js apps on modern hosting: durable runs, retries, queues, monitoring, and no request-time coupling for longer tasks. Use it for draft generation, bulk regeneration, exports, backfills, and recovery jobs. | HIGH |
| Zod | 4.x current | API and workflow contracts | **Keep.** Zod remains the right boundary-validation layer for route handlers and job payloads. | HIGH |
| Vercel AI SDK | Current | Streaming/chat abstractions | **Do not rewrite to this yet.** It is useful for chat/streaming UX, but this product’s hard problems are workflow integrity, persistence, auditability, and provider governance. Adopt only tactically if you later need richer streaming UI primitives. | MEDIUM |
| LangChain / agent frameworks | N/A | Agent orchestration | **Do not adopt yet.** The platform is staged and document-centric, not open-ended agentic automation. These frameworks would add abstraction without solving the present reliability issues. | MEDIUM |

### Hardening and Operations

| Technology | Version | Purpose | Recommendation | Confidence |
|------------|---------|---------|----------------|------------|
| Upstash Redis + `@upstash/ratelimit` | Current | Distributed rate limiting | **Add now.** Replace the current single-process limiter with a shared, HTTP-friendly limiter that works cleanly with Next.js/serverless deployments. | HIGH |
| Sentry for Next.js | Current | Error tracking, tracing, job visibility | **Add now.** Instrument route handlers, background jobs, and critical workflow transitions. This is the fastest path to production-grade visibility. | HIGH |
| Playwright | Current | End-to-end and UAT-style regression tests | **Add now.** Use it to lock down auth, draft lifecycle, AI stages, restore/version flows, and export. | HIGH |
| Vitest + React Testing Library | Current | Unit/integration tests | **Add now.** Use for domain logic, validators, route helpers, and smaller UI/state seams. | HIGH |

### Frontend and Styling

| Technology | Version | Purpose | Recommendation | Confidence |
|------------|---------|---------|----------------|------------|
| Tailwind CSS | Stay on 3.x for now; evaluate 4.x later | Styling | **Keep for now.** Upgrading Tailwind is lower priority than workflow hardening and test coverage. Move to 4.x only when you are already touching the styling/tooling layer for substantive UI work. | MEDIUM |
| Server Components + Route Handlers | Next.js 16 style | UI/server split | **Keep, but push more orchestration out of the giant client page and into server-side modules plus jobs.** | HIGH |

## Prescriptive Strategy

### Keep

- Keep **Next.js + Supabase + server-managed AI** as the core architecture.
- Keep the **SQL-first / RLS-first** data model.
- Keep the **custom provider abstraction** instead of collapsing into a framework rewrite.
- Keep **Node runtime handlers** for AI, parsing, and `.docx` generation.

### Add Next

- Add **Trigger.dev 4.x** for durable AI and export jobs.
- Add **Upstash Redis rate limiting** for distributed protection and quota enforcement.
- Add **Sentry** for app and job observability.
- Add a **three-layer test stack**:
  - `pgTAP` for schema/RLS/invariants
  - `Vitest` for domain and route helper logic
  - `Playwright` for user-visible flows

### Do Not Adopt Yet

- Do **not** replace SQL migrations with Prisma or Drizzle-generated ownership of the schema. In this app, RLS and hand-authored SQL are the source of truth.
- Do **not** rewrite the AI layer around LangChain, LlamaIndex, or generic agent frameworks.
- Do **not** add vector search, a separate queue database, or real-time collaboration tech until the current workflow is stable and measured gaps justify them.
- Do **not** split the app into microservices. This should remain a well-tested monolith.

## Brownfield Upgrade Order

1. Upgrade to **Next.js 16.1.x + React 19.2** on a dedicated branch and clear the async request API changes.
2. Introduce **Vitest**, **Playwright**, and **pgTAP** before larger refactors.
3. Replace in-memory rate limiting with **Upstash Redis**.
4. Add **Sentry** instrumentation across API routes and workflow boundaries.
5. Introduce **Trigger.dev** for long-running AI and export work; keep fast synchronous reads/writes in normal route handlers.
6. Only after the above, refactor the large `/generate` page into smaller server/client boundaries.

## Concrete Recommendations

### Recommended package/service additions

```bash
# Testing
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
npm install -D @playwright/test

# Durable jobs
npm install @trigger.dev/sdk

# Distributed rate limiting
npm install @upstash/redis @upstash/ratelimit

# Observability
npm install @sentry/nextjs
```

### What this stack optimizes for

- **Workflow integrity over novelty**
- **Provider governance over chat-framework convenience**
- **Operational visibility over “works locally”**
- **Safe brownfield iteration over platform rewrites**

## Sources

- Next.js 16 release: https://nextjs.org/blog/next-16
- Next.js 16.1 release and upgrade guidance: https://nextjs.org/blog/next-16-1
- Next.js 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- Next.js Vitest guide: https://nextjs.org/docs/app/guides/testing/vitest
- React current versions: https://react.dev/versions
- React Compiler v1.0: https://react.dev/blog/2025/10/07/react-compiler-1
- Supabase Next.js SSR/Auth guidance: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Next.js Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Supabase database testing / pgTAP: https://supabase.com/docs/guides/local-development/testing/overview
- Supabase Cron / `pg_cron`: https://supabase.com/docs/guides/cron
- Trigger.dev docs: https://trigger.dev/docs
- Upstash rate limiting docs: https://upstash.com/docs/redis/overall/ratelimit
- Sentry Next.js docs: https://docs.sentry.io/platforms/javascript/guides/nextjs/

## Notes

- **Inference:** recommending Node 22 as the standard runtime is based on current ecosystem support across Next.js-adjacent tooling, not a single canonical Next.js runtime statement.
- **Inference:** deferring Tailwind 4, pgvector, Vercel AI SDK, and agent frameworks is a product-fit decision for this specific brownfield app, not a claim that those tools are generally weak.
