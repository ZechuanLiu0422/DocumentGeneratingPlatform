# Testing

## Current State

- There is no dedicated automated test suite in the repository.
- No `tests/`, `__tests__/`, `e2e/`, Playwright config, Vitest config, Jest config, or GitHub Actions workflow is present.
- `package.json` does not define a `test` script.

## Existing Verification Mechanisms

- `npm run build` is the main compile-time verification path.
- `npm run check:deploy` runs deployment-preflight validation through `scripts/check-deploy.mjs`.
- `npm run check:schema` runs runtime Supabase checks through `scripts/check-supabase-schema.mjs`.
- Operational verification is also documented in `README.md` and `DEPLOYMENT_CHECKLIST.md`.

## Runtime Safety Nets

- Input validation is strong because route handlers rely on zod schemas from `lib/validation.ts`.
- Auth boundaries are consistently enforced through `requireRouteUser(...)` in `lib/auth.ts`.
- Daily quotas and short-term rate limits in `lib/quota.ts` and `lib/ratelimit.ts` act as operational guardrails rather than formal tests.
- Migration drift is partially detected by schema mismatch handling in `lib/api.ts`.

## What Gets Manually Checked

- Login, password-change, draft loading, and history/settings flows are checked by visiting pages such as `app/login/page.tsx`, `app/change-password/page.tsx`, `app/page.tsx`, and `app/history/page.tsx`.
- Collaborative writing flows are manually exercised through `app/generate/page.tsx` and the `app/api/ai/*` routes.
- Export behavior is manually verified through `app/api/generate/route.ts` and `lib/document-generator.ts`.

## Coverage Gaps

- No automated regression coverage exists for the multi-step intake -> planning -> outline -> draft -> review flow.
- No tests assert the expected shape of the JSON stored in `drafts.planning`, `drafts.outline`, or `drafts.sections`.
- No unit tests protect prompt-generation or provider-routing logic in `lib/official-document-ai.ts` and `lib/official-document-workflow.ts`.
- No integration tests verify RLS expectations against the Supabase schema.
- No snapshot tests or golden files validate `.docx` export output from `lib/document-generator.ts`.

## Risky Areas Without Tests

- The very large `app/generate/page.tsx` interaction surface.
- The schema-sensitive persistence helpers in `lib/collaborative-store.ts`.
- File parsing in `lib/file-parser.ts`, especially PDF extraction behavior.
- The custom dev-runtime patcher in `scripts/run-next-dev.mjs`.

## Suggested Next Testing Steps

- Add unit tests for `lib/validation.ts`, `lib/api.ts`, and `lib/document-generator.ts`.
- Add route-level integration tests for `app/api/ai/intake/route.ts`, `app/api/ai/outline/route.ts`, and `app/api/ai/draft/route.ts`.
- Add an end-to-end smoke test for the core `/generate` authoring path.
