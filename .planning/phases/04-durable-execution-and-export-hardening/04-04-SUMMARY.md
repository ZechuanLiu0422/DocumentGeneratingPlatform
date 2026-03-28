---
phase: 04-durable-execution-and-export-hardening
plan: 04
subsystem: export
tags: [durable-operations, export, storage, download, e2e]
requires:
  - phase: 04-durable-execution-and-export-hardening
    provides: durable operation schema, lease-safe coordination, async route polling
provides:
  - Durable export enqueue path backed by storage artifacts instead of base64 payloads
  - Binary `/api/operations/[id]/download` retrieval for completed export jobs
  - Local-stack-safe runner/download admin key fallback plus export idempotency reuse
affects: [phase-04-complete, generate-workspace, export, storage, operations]
tech-stack:
  added: [Supabase storage artifact metadata, server-side local admin-key resolution]
  patterns: [queued export contracts, storage-backed artifact delivery, seeded browser download proof]
key-files:
  created:
    - app/api/operations/[id]/download/route.ts
    - lib/export-artifact-store.ts
    - lib/server-supabase-admin.ts
    - supabase/migrations/20260328113000_phase_04_export_artifacts.sql
    - tests/phase-04/contracts/export-download-contract.test.ts
    - tests/phase-04/ops/export-artifact-contract.test.ts
  modified:
    - app/api/generate/route.ts
    - app/api/operations/run/route.ts
    - app/generate/page.tsx
    - lib/collaborative-store.ts
    - lib/operation-runner.ts
    - lib/operation-store.ts
    - package.json
    - scripts/seed-phase-2.mjs
    - tests/e2e/generate-smoke.spec.ts
    - tests/phase-04/ops/operation-idempotency.test.ts
key-decisions:
  - "Treat export as a durable operation end to end, including binary retrieval, instead of keeping a special-case base64 response path."
  - "Resolve local Supabase admin credentials from `supabase status -o env` only on server-side local-stack execution, so local/e2e verification does not depend on hosted `.env.local` service-role values."
  - "Reuse existing operations on duplicate `(user_id, idempotency_key)` inserts so repeated export clicks resume the durable job instead of surfacing a generic 500."
patterns-established:
  - "Seeded browser proofs for durable exports must keep review hashes authoritative and can safely rerun because export creation is now idempotent."
  - "Server-only local-stack fallbacks live outside shared env helpers so middleware and edge-safe modules stay buildable."
requirements-completed: [OPS-01, OPS-02, OPS-03, UX-03]
duration: 64 min
completed: 2026-03-28
---

# Phase 04 Plan 04: Durable Export Delivery Summary

**Storage-backed export artifacts, binary download retrieval, local runner hardening, and seeded browser proof for the final export path**

## Performance

- **Duration:** 64 min
- **Started:** 2026-03-28T04:59:28Z
- **Completed:** 2026-03-28T06:03:38Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Moved export off the request-response path so [route.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/generate/route.ts) now enqueues durable export work and returns an operation handle instead of base64 file bytes.
- Added [route.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/api/operations/[id]/download/route.ts) and [export-artifact-store.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/export-artifact-store.ts) for storage-backed DOCX retrieval through authenticated binary responses.
- Extended [page.tsx](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/app/generate/page.tsx) so completed export operations trigger browser downloads after polling rather than decoding large JSON payloads in the client.
- Hardened local execution by resolving local Supabase admin credentials in [server-supabase-admin.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/server-supabase-admin.ts) and by reusing duplicate export operations in [operation-store.ts](/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/lib/operation-store.ts).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add export artifact contracts, seeded harness coverage, and browser proof** - `2f65cce`
2. **Task 2: Implement durable artifact delivery, local runner fallback, and idempotent export reuse** - `e25b7b9`

## Files Created/Modified

- `app/api/generate/route.ts` - enqueues export operations with review-hash idempotency instead of returning base64 file payloads.
- `app/api/operations/[id]/download/route.ts` - returns completed DOCX artifacts as binary downloads with attachment headers.
- `app/api/operations/run/route.ts` - uses the local-stack-aware admin key resolver so the runner can drain exports under local/e2e startup.
- `app/generate/page.tsx` - tracks export operations, polls completion, and triggers binary downloads from completed operation results.
- `lib/export-artifact-store.ts` - owns storage path normalization, artifact metadata persistence, and storage byte retrieval.
- `lib/server-supabase-admin.ts` - resolves a safe admin key for local Supabase-backed runner and download execution.
- `lib/collaborative-store.ts` - persists export completion results into authoritative draft/document/version surfaces.
- `lib/operation-runner.ts` - generates DOCX bytes, uploads artifacts, validates review freshness, and persists export completion state.
- `lib/operation-store.ts` - reuses existing operations on duplicate idempotency inserts instead of surfacing a 500.
- `scripts/seed-phase-2.mjs` - writes authoritative review hashes into the seeded browser scenario so export readiness matches server validation.
- `tests/e2e/generate-smoke.spec.ts` - proves seeded export polling and browser download delivery end to end.
- `tests/phase-04/contracts/export-download-contract.test.ts` - proves queued export responses and binary download retrieval contracts.
- `tests/phase-04/ops/export-artifact-contract.test.ts` - proves storage-backed artifact persistence and runner reuse.
- `tests/phase-04/ops/operation-idempotency.test.ts` - proves duplicate export requests reuse the existing durable operation.

## Decisions Made

- Export durability reuses the same `draft_operations` queue rather than introducing a separate artifact pipeline for the final phase.
- Local Supabase admin fallback is server-only and runtime-detected, keeping shared env helpers compatible with middleware builds.
- Duplicate export clicks now reuse the authoritative durable operation record, which also makes repeated seeded browser runs stable against leftover jobs.

## Deviations from Plan

None at the plan level. The implementation added a local-stack admin-key resolver because the existing `.env.local` hosted service-role key combination broke local durable-runner verification once export moved behind the queue.

## Issues Encountered

- The Phase 02 seed used placeholder review hashes, which caused export to fail as stale despite the UI showing a passed review state.
- Local/e2e startup overrode the Supabase URL to the local stack but still inherited hosted admin credentials, causing the runner and artifact download route to fail until local credential resolution was added.
- Retried exports with the same review hash initially hit the unique idempotency index and surfaced a generic 500 instead of resuming the durable job.

## User Setup Required

None immediately. The export runner and binary download path now work under the existing local Supabase setup and seeded browser harness.

## Next Phase Readiness

- Phase 04 is complete. Phase 05 can now decompose `/generate` on top of durable draft/revise/export contracts instead of rewriting fragile in-flight request logic.
- Future frontend refactors can assume export is storage-backed and resumable, which removes the previous base64 client-decoding constraint from the workspace.

---
*Phase: 04-durable-execution-and-export-hardening*
*Completed: 2026-03-28*

## Self-Check: PASSED

- Found `.planning/phases/04-durable-execution-and-export-hardening/04-04-SUMMARY.md` on disk.
- Verified task commits `2f65cce` and `e25b7b9` in git history.
