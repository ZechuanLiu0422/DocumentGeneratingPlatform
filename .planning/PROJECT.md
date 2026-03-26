# DocumentGeneratingPlatform

## What This Is

DocumentGeneratingPlatform is a brownfield AI-assisted official-document drafting platform built with Next.js, Supabase, and server-managed multi-provider AI integrations. It helps authenticated users produce four common Chinese official document types (`通知`, `函`, `请示`, `报告`) through a staged workflow covering intake, planning, outline generation, drafting, review, history, and Word export.

## Core Value

Users can turn incomplete inputs into a reliable, policy-aligned official document draft quickly without losing control of drafts, versions, or organizational writing context.

## Requirements

### Validated

- ✓ Authenticated users can create and manage per-user drafts for the collaborative writing workflow — existing
- ✓ Users can generate and refine `通知`, `函`, `请示`, and `报告` through staged AI flows for intake, planning, outline, drafting, revision, and review — existing
- ✓ Users can manage writing rules, reference assets, contacts, common phrases, and historical documents with Supabase-backed isolation — existing
- ✓ Users can export finalized content to `.docx` and restore prior document versions — existing
- ✓ Platform operators can configure Claude, OpenAI-compatible, Doubao, and GLM providers from server-side environment variables without exposing keys to the client — existing

### Active

- [ ] Lock workflow integrity so protected draft state, version counters, and AI-generated artifacts are only mutated by trusted server-side workflow paths
- [ ] Add an automated test baseline for validation, persistence, AI routes, export, and the custom local runtime patch so refactors are safe
- [ ] Improve production readiness of the collaborative drafting experience by reducing `app/generate/page.tsx` complexity, tightening operational checks, and addressing current performance/security hotspots

### Out of Scope

- Real-time multi-user co-editing in the same draft — the current product is optimized for single-user authoring workflows and versioned iteration
- Native mobile applications — the platform is web-first and already targets authenticated desktop/browser usage
- User-managed personal AI keys — provider secrets are intentionally centralized on the server for governance and operational control

## Context

- The product has already completed a significant brownfield migration away from SQLite, NextAuth, and Python subprocesses toward a Next.js 14 + Supabase + server-side AI architecture, as documented in `README.md`
- The current user experience centers on a large collaborative drafting surface in `app/generate/page.tsx`, backed by internal API routes under `app/api/ai/*` and persistence helpers in `lib/collaborative-store.ts`
- The strongest existing capabilities are staged drafting, per-user data isolation, AI provider abstraction, version restore, and `.docx` export
- The biggest current risks are workflow-integrity gaps in `app/api/drafts/route.ts`, lack of automated tests, single-process rate limiting, and local runtime fragility from `scripts/run-next-dev.mjs`
- The repo already includes a fresh codebase map in `.planning/codebase/`, which should be treated as the architectural reference for planning and execution

## Constraints

- **Tech stack**: Continue building on Next.js 14, Supabase Auth/Postgres/RLS, and the existing server-managed AI provider abstraction — replacing the core stack would create unnecessary churn
- **Security**: AI keys must remain server-only, and user data must continue to be isolated by Supabase auth plus RLS — this is already a stated baseline in `README.md`
- **Operational**: Collaborative writing features depend on executing all SQL migrations in `supabase/migrations/*.sql` in order — partial schema rollout breaks saves, AI stages, and version restore
- **Product scope**: The current value proposition is document-generation reliability, not broad document collaboration or generalized content authoring — roadmap choices should reinforce this
- **Quality**: The repo currently lacks automated tests, so early phases need to create safety rails before major architectural changes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Initialize as a brownfield GSD project around the existing platform | The repo already ships real capabilities and now has a fresh codebase map, so planning should start from current system behavior instead of a greenfield vision | ✓ Good |
| Treat workflow integrity, test coverage, and production hardening as the initial active scope | These are the clearest blockers to safe iteration, reliable releases, and future feature work based on the current concerns audit | — Pending |
| Keep planning docs committed to git | This repo already tracks operational and planning history in-repo, and brownfield refactors need visible decision records | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state (users, feedback, metrics)

---
*Last updated: 2026-03-26 after initialization*
