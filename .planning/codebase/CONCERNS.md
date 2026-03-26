# Codebase Concerns

**Analysis Date:** 2026-03-26

## Tech Debt

**Single-page workflow UI owns too much behavior:**
- Issue: The entire collaborative drafting experience lives in one 2,269-line client component with data bootstrapping, workflow state, mutation handlers, version restore, export, and settings-side effects all mixed together.
- Files: `app/generate/page.tsx`
- Impact: Small changes in one stage can regress unrelated stages, and targeted fixes are expensive because there is no component or hook boundary around intake, planning, outline, drafting, review, or export behavior.
- Fix approach: Split `app/generate/page.tsx` into stage-specific components plus shared hooks for draft loading, mutations, and optimistic UI state.

**Workflow state can be mutated through two different write paths:**
- Issue: The direct draft API accepts a full client-supplied workflow snapshot, while the AI routes also persist authoritative workflow state through shared store helpers.
- Files: `app/api/drafts/route.ts`, `app/api/ai/intake/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/draft/route.ts`, `lib/collaborative-store.ts`
- Impact: The draft record shape is easy to desynchronize because browser code can overwrite server-managed fields such as `workflow_stage`, `planning`, `outline`, `sections`, `generated_content`, and `version_count`.
- Fix approach: Restrict `app/api/drafts/route.ts` to editable user inputs only, and keep workflow progression fields writeable only from server-side workflow routes.

## Known Bugs

**Rate limiting does not survive restarts and does not work across instances:**
- Symptoms: Limits are enforced only inside the current Node.js process and disappear on restart or when traffic is distributed across multiple server instances.
- Files: `lib/ratelimit.ts`
- Trigger: Any deployment topology with more than one app instance, serverless cold starts, or a local/server restart.
- Workaround: None in code; the only durable limit today is the database-backed daily quota in `lib/quota.ts`.

**Dev cache isolation leaves stale build directories behind indefinitely:**
- Symptoms: Every `npm run dev` run can rename `.next` to a new `.next_stale_*` directory, and existing stale directories are already present in the repo workspace.
- Files: `scripts/run-next-dev.mjs`, `.next_stale_20260323_1`, `.next_stale_20260324111535`
- Trigger: Starting the dev server when `.next` already contains build output.
- Workaround: Manual cleanup of `.next_stale_*` directories.

## Security Considerations

**Client-controlled draft metadata bypasses workflow integrity:**
- Risk: An authenticated client can POST arbitrary values for workflow state, version counters, generated title/content, selected rules, and stored outline/planning JSON.
- Files: `app/api/drafts/route.ts`, `lib/validation.ts`
- Current mitigation: Authentication and RLS only ensure the caller owns the draft; they do not validate that workflow fields were produced by trusted server logic.
- Recommendations: Accept only user-editable fields on this route, recompute protected fields server-side, and reject client writes to `workflow_stage`, `planning`, `outline`, `sections`, `generated_*`, and `version_count`.

**Health endpoint exposes deployment details without authentication:**
- Risk: The route reports whether public Supabase env is configured and which AI providers are enabled.
- Files: `app/api/health/route.ts`, `lib/providers.ts`, `lib/env.ts`
- Current mitigation: It avoids leaking secret values directly.
- Recommendations: Either require authentication, or reduce the response to a simple liveness signal without provider/config metadata.

**User invite script emits temporary passwords and uses weak randomness:**
- Risk: Temporary credentials are generated with `Math.random()` and printed to stdout, which is easy to leak through shell history, CI logs, or shared terminals.
- Files: `scripts/invite-user.mjs`
- Current mitigation: The script marks `must_change_password: true` in user metadata.
- Recommendations: Generate passwords with `crypto.randomBytes`, avoid logging raw passwords by default, and require an explicit `--show-password` flag if printing is necessary.

## Performance Bottlenecks

**Export path base64-encodes the entire DOCX into JSON:**
- Problem: The server converts the document buffer to base64 JSON, and the browser decodes it back into bytes before download.
- Files: `app/api/generate/route.ts`, `app/generate/page.tsx`
- Cause: The export API returns `{ file_data, file_name }` instead of streaming a binary response.
- Improvement path: Return `application/vnd.openxmlformats-officedocument.wordprocessingml.document` directly with `Content-Disposition`, and let the browser download the stream without base64 inflation.

**Version snapshots perform extra count queries on every snapshot creation:**
- Problem: Each call to `createVersionSnapshot` inserts a version and then runs an additional full `count(*)` query to update `drafts.version_count`.
- Files: `lib/collaborative-store.ts`
- Cause: `createVersionSnapshot()` calls `countVersions()` after each insert.
- Improvement path: Maintain `version_count` with an increment update or a database trigger instead of recounting versions each time.

**Generate page bootstraps with many full-list fetches up front:**
- Problem: The page loads settings, phrases, contacts, drafts, rules, and reference assets on initial mount whether or not the user needs all of them immediately.
- Files: `app/generate/page.tsx`, `app/api/settings/route.ts`, `app/api/common-phrases/route.ts`, `app/api/contacts/route.ts`, `app/api/drafts/route.ts`, `app/api/writing-rules/route.ts`, `app/api/reference-assets/route.ts`
- Cause: A single `Promise.all()` block eagerly requests all sidebar and workflow data.
- Improvement path: Keep critical bootstrap data small, then lazy-load drafts, rules, and reference assets on demand or after first paint.

## Fragile Areas

**Workflow persistence depends on large JSON blobs with migration-coupled shapes:**
- Files: `lib/collaborative-store.ts`, `lib/validation.ts`, `supabase/migrations/20260321110000_collaborative_writing_upgrade.sql`, `supabase/migrations/20260323150000_outline_planning_upgrade.sql`
- Why fragile: `planning`, `outline`, `sections`, `collected_facts`, and related arrays are stored as JSONB blobs, so schema evolution is enforced mostly in application code rather than relational constraints.
- Safe modification: Change validation, route persistence, and migration files together; treat shape changes as full-stack changes instead of local refactors.
- Test coverage: No automated tests exercise migration compatibility or draft-shape round trips.

**Custom Next dev patch is carrying framework instability in local runtime:**
- Files: `scripts/run-next-dev.mjs`, `.next/server/webpack-runtime.js`
- Why fragile: Local development depends on repeatedly rewriting Next’s generated runtime file to repair chunk resolution, which is tightly coupled to a specific emitted code pattern.
- Safe modification: Treat Next upgrades and dev-runtime changes as high-risk; verify the patch against actual generated output after every framework bump.
- Test coverage: No automated verification checks that the runtime patch still matches the emitted webpack runtime.

## Scaling Limits

**App-level throttling is single-process only:**
- Current capacity: One in-memory `Map` per Node.js process.
- Limit: Cross-instance traffic is effectively unbounded because each instance enforces its own counters.
- Scaling path: Move request throttling to Redis, Postgres, or an edge/WAF layer with shared counters.

**Long-running AI routes are tuned for small-user interactive traffic only:**
- Current capacity: AI routes run in-process with `maxDuration = 60`, synchronous JSON request/response bodies, and per-request provider calls.
- Limit: Concurrent drafting/review/export requests will compete for the same app worker capacity and increase tail latency quickly.
- Scaling path: Move AI jobs and export generation onto a queue/worker model and store intermediate results outside request lifecycles.

## Dependencies at Risk

**`next@14.2.0` is currently entangled with custom runtime surgery:**
- Risk: The project already needs a generated-file patch to keep local `next dev` stable, which indicates the framework/runtime boundary is brittle here.
- Impact: Framework upgrades can silently break local development or invalidate the patch logic in `scripts/run-next-dev.mjs`.
- Migration plan: Upgrade only with explicit verification of dev startup, route rendering, and emitted runtime structure; remove the patch once the underlying Next behavior is no longer required.

## Missing Critical Features

**Automated test suite is not present:**
- Problem: There are no detected `*.test.*` or `*.spec.*` files, and `package.json` has no `test` script.
- Blocks: Safe refactoring of `app/generate/page.tsx`, workflow routes, migration-sensitive persistence, and the custom Next runtime patch.

**Workflow integrity is not enforced server-side end to end:**
- Problem: The browser can still persist full draft workflow snapshots through `app/api/drafts/route.ts`.
- Blocks: Trustworthy version history, reliable state transitions, and safe future automation around drafts.

## Test Coverage Gaps

**Collaborative workflow routes are untested:**
- What's not tested: Intake, planning, outline generation, draft generation, revise, review, version restore, and export flows.
- Files: `app/api/ai/intake/route.ts`, `app/api/ai/outline-plan/route.ts`, `app/api/ai/outline/route.ts`, `app/api/ai/outline/confirm/route.ts`, `app/api/ai/draft/route.ts`, `app/api/ai/revise/route.ts`, `app/api/ai/review/route.ts`, `app/api/ai/versions/restore/route.ts`, `app/api/generate/route.ts`
- Risk: Regressions in state transitions, quota behavior, and persisted draft/version content will go unnoticed until users hit them manually.
- Priority: High

**Workflow engine and persistence helpers are untested:**
- What's not tested: Structured AI parsing fallbacks, outline/planning normalization, draft quality gates, version counting, and JSON shape normalization.
- Files: `lib/official-document-workflow.ts`, `lib/official-document-ai.ts`, `lib/collaborative-store.ts`, `lib/validation.ts`
- Risk: This is the core business logic path, and failures here can silently corrupt stored drafts or return misleading AI results.
- Priority: High

**Local runtime patching has no regression coverage:**
- What's not tested: Whether `.next/server/webpack-runtime.js` still contains the expected snippet and whether stale-cache isolation behaves correctly across repeated starts.
- Files: `scripts/run-next-dev.mjs`
- Risk: Local development can break after dependency changes with no automated warning.
- Priority: Medium

---

*Concerns audit: 2026-03-26*
