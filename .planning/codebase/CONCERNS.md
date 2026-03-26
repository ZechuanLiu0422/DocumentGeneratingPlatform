# Concerns

## High-Risk Areas

- `app/generate/page.tsx` is a very large client component that owns most of the product’s interactive state, request orchestration, and UI branching. This raises regression risk and makes focused testing/refactoring harder.
- The collaborative flow depends on ordered Supabase migrations in `supabase/migrations/`; `lib/api.ts` contains explicit schema-drift handling, which is a strong signal that out-of-date databases are a recurring operational risk.

## Runtime And Scalability Risks

- `lib/ratelimit.ts` stores rate-limit buckets in process memory. That works only per Node process and will not coordinate across multiple Vercel/serverless instances.
- `app/api/generate/route.ts` returns the full `.docx` as Base64 in JSON, which may become memory-heavy for larger documents and creates larger API responses than a storage/download URL approach.
- `lib/file-parser.ts` parses PDFs page-by-page inside the request path, which may stretch the `maxDuration = 60` window on slow or near-limit files.

## Maintainability Risks

- The workflow logic is split between older direct-generation endpoints like `app/api/polish/route.ts` and the newer collaborative path in `app/api/ai/*`, increasing the chance that bug fixes land in one path but not the other.
- `lib/official-document-workflow.ts` is a large, central orchestration file with many responsibilities: prompt building, normalization, validation, retries, and workflow transitions.
- Several places still rely on `any` casts or broad error typing: `lib/official-document-ai.ts`, `lib/collaborative-store.ts`, `lib/file-parser.ts`, and `app/generate/page.tsx`.

## Dev Environment Fragility

- `scripts/run-next-dev.mjs` patches `webpack-runtime.js` by string replacement. That is a pragmatic workaround, but it is tightly coupled to the generated Next.js runtime shape and could break after framework upgrades.
- The repository contains stale-build directories like `.next_stale_*`, which suggests recurring local-build instability around Next dev output handling.

## Data Model Concerns

- Large user-authored content is stored inline in Postgres rows: `drafts.generated_content`, `drafts.planning`, `drafts.outline`, `reference_assets.content`, and `document_versions.content`.
- Session reference uploads currently return extracted content directly from `app/api/upload-reference/route.ts` and do not persist files to object storage, limiting auditability and reusability.

## Product/UX Risks

- Login and password-change pages still use `useSearchParams` + `Suspense` in `app/login/page.tsx` and `app/change-password/page.tsx`, while `app/generate/page.tsx` recently moved away from `next/navigation` context dependence. Navigation patterns are therefore inconsistent across pages.
- The collaborative flow has many stage transitions and recovery branches, but there is no automated coverage ensuring version restore, outline confirmation, review regeneration, and export all stay in sync.

## Security And Ops Notes

- The code appears careful not to expose provider keys, but any accidental logging around provider config in `lib/providers.ts` or `lib/official-document-ai.ts` would be high impact because all provider credentials are platform-level.
- `scripts/check-deploy.mjs` validates a local `.env`, which is useful for local checks but does not guarantee parity with actual hosted Vercel environment configuration.
