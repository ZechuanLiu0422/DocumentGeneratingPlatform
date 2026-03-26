# Architecture Patterns

**Domain:** AI-assisted official-document drafting platform
**Project:** DocumentGeneratingPlatform
**Researched:** 2026-03-26

## Recommended Architecture

For the next milestone, keep the app as a **Next.js App Router monolith with Supabase as the data/auth boundary**, but change its internal shape to a **workflow-centered architecture**:

```text
Generate Route Shell (server-first where possible)
  -> Generate Workspace (thin client orchestrator)
    -> Stage Modules
       - Intake
       - Planning
       - Outline
       - Draft
       - Review
       - Export / Versions

Client reads
  -> read models / bootstrap endpoints

Client mutations
  -> workflow route handlers only
     -> workflow application services
        -> store helpers / Supabase
           -> drafts + versions + supporting tables
```

This milestone should **not** split the app into microservices, background workers, or a new frontend architecture. The current failure mode is not scale-by-topology. It is **unclear write ownership**, **weak test seams**, and **one oversized client surface**. Fix those first.

### Architecture Shape

1. **Server-owned workflow core**
   - All stage transitions, generated artifacts, and version mutations stay behind Route Handlers plus shared workflow services.
   - Rationale: Next.js Route Handlers are the natural server mutation boundary in App Router, and they fit the current fetch-based UI without forcing a server-action rewrite. Next.js explicitly positions Route Handlers as the App Router equivalent of API routes. Source: <https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers>

2. **Client becomes stage UI, not workflow authority**
   - The browser should own transient UX state only: form inputs in progress, selected tab, modal visibility, text selections, in-flight mutation state.
   - The browser should not own authoritative `workflow_stage`, `planning`, `outline`, `sections`, `generated_*`, or `version_count`.

3. **Separate editable draft inputs from protected workflow state**
   - Keep one `drafts` aggregate table this milestone to avoid migration churn.
   - But split code contracts into:
     - `DraftEditableFields`
     - `DraftWorkflowState`
     - `DraftReadModel`
   - This is the minimum brownfield move that restores integrity without redesigning storage.

4. **Stage-based frontend composition**
   - Break the generate flow into stage modules with local responsibilities and a shared mutation layer.
   - Next.js recommends moving Client Components down the tree to reduce client bundle size. Source: <https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns>

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/generate/page.tsx` | Route shell only; parse params, load minimal bootstrap data, render workspace | server bootstrap loader, `GenerateWorkspace` |
| `GenerateWorkspace` client container | Own selected draft/session state, route-level error state, mutation dispatch, step navigation | stage components, query/mutation hooks |
| `IntakeStage` | Intake questions, editable document metadata, rule/reference selection UI | `useDraftEditableFields`, `useWorkflowActions.intake` |
| `PlanningStage` | Planning options and confirmation UI | `useWorkflowActions.generatePlan`, `useWorkflowActions.confirmPlan` |
| `OutlineStage` | Outline generation, selection, confirmation | `useWorkflowActions.generateOutline`, `useWorkflowActions.confirmOutline` |
| `DraftStage` | Section rendering, revise/regenerate actions | `useWorkflowActions.generateDraft`, `useWorkflowActions.revise` |
| `ReviewStage` | Review checks, final fixes, export trigger | `useWorkflowActions.review`, `useWorkflowActions.export` |
| `VersionsPanel` | Version listing and restore UX | `useVersions`, restore endpoint |
| `workflow route handlers` | Auth, validation, quotas, idempotent stage transition entrypoint | application services, store helpers |
| `workflow application services` | Deterministic command layer for stage transitions | provider/workflow libs, persistence layer |
| `draft editable service` | Save only user-editable draft fields | Supabase draft store |
| `draft read service` | Hydrate complete read model for UI | Supabase draft store |

## Data Flow

### Read Flow

1. Generate route shell loads only what is needed for first paint:
   - current draft summary if `draft` query param exists
   - provider list
   - minimal user/profile context
2. Workspace lazy-loads secondary data on demand:
   - versions when version panel opens
   - rules/reference assets when picker opens
   - contacts/phrases when the relevant UI becomes visible
3. Stage components receive normalized read models, not raw API shapes.

### Mutation Flow

1. User edits base inputs.
2. Client calls `saveDraftEditableFields`.
3. Route validates only editable fields and persists only editable columns.
4. Stage action is triggered.
5. Workflow route:
   - authenticates user
   - validates stage preconditions
   - loads current draft read model
   - executes workflow command
   - persists protected workflow state
   - snapshots version if required
   - returns the updated read model
6. Client rehydrates from the server response instead of reconstructing state locally.

### Ownership Rule

**Only workflow routes may write workflow state.**

Protected fields for this milestone:

- `workflow_stage`
- `collected_facts`
- `missing_fields`
- `planning`
- `outline`
- `sections`
- `generated_title`
- `generated_content`
- `version_count`

Editable-by-user fields:

- `doc_type`
- `title`
- `recipient`
- `content`
- `issuer`
- `date`
- `provider`
- `contact_name`
- `contact_phone`
- `attachments`
- `active_rule_ids`
- `active_reference_ids`

This aligns with the current concern that `app/api/drafts/route.ts` can overwrite server-owned workflow fields and desynchronize the draft record.

## Refactoring the Oversized Generate Page

The current `app/generate/page.tsx` is too large because it combines:

- initial data bootstrap
- draft persistence
- stage orchestration
- reference upload
- contact/phrase CRUD refreshes
- version restore
- export
- rendering for every stage

That shape should be replaced in this order:

### Step 1: Extract a route shell and workspace container

- `app/generate/page.tsx`: server shell, minimal loader, no stage logic
- `app/generate/_components/GenerateWorkspace.tsx`: owns shared client session state only

### Step 2: Extract mutation hooks

- `useDraftEditableFields`
- `useWorkflowActions`
- `useReferenceAssets`
- `useVersions`

These hooks should centralize fetch, error mapping, busy states, and response normalization. The page should stop containing dozens of inline `fetch()` handlers.

### Step 3: Extract stage modules

- `IntakeStage.tsx`
- `PlanningStage.tsx`
- `OutlineStage.tsx`
- `DraftStage.tsx`
- `ReviewStage.tsx`

Each stage should receive:

- read model slice
- stage-local callbacks
- stage-local loading/error props

Each stage should not know how other stages persist their data.

### Step 4: Split always-on bootstrap from on-demand panels

The current eager `Promise.all()` bootstrap fetches settings, phrases, contacts, drafts, rules, and reference assets immediately. Replace that with:

- first-paint: current draft + providers + minimal sidebar summary
- deferred: rules/assets/versions/history panels
- event-driven: contacts/phrases if the user opens their controls

This lowers startup cost without changing the product model.

## Protecting Server-Owned Workflow State

This is the highest-priority architecture rule for the milestone.

### Required Changes

1. **Narrow `POST /api/drafts` to editable fields only**
   - Remove workflow-owned properties from the request schema.
   - Return a normalized read model from the server.

2. **Introduce explicit persistence functions**
   - `saveDraftEditableFields(...)`
   - `saveWorkflowTransition(...)`
   - `appendVersionSnapshot(...)`
   - Do not reuse one broad `saveDraftState(...)` contract for both user edits and workflow mutations.

3. **Validate stage transitions in the application layer**
   - Example:
     - planning cannot run before intake has produced a ready draft context
     - outline confirmation cannot move the draft to `draft` unless outline exists
     - export cannot mark `done` unless review/export preconditions pass

4. **Keep RLS as guardrail, not as the only integrity mechanism**
   - Supabase RLS is essential and should remain enabled, but it protects row access, not business invariants.
   - Supabase docs are explicit that RLS is for granular authorization and must be enabled on exposed tables. Source: <https://supabase.com/docs/guides/database/postgres/row-level-security>

### Strong Recommendation

Do **not** try to solve this by trusting the client less informally. Make the contract impossible:

- editable route cannot accept workflow fields
- workflow routes always re-load current server state before mutating
- returned server payload becomes the source of truth

That is the cleanest integrity fix available in a brownfield Next.js + Supabase app.

## Integration Strategy for the Current Stack

### Keep

- Next.js App Router
- Route Handlers for mutations
- Supabase SSR auth and middleware
- existing AI provider abstraction
- existing `drafts` + `document_versions` model for this milestone

Supabase’s Next.js SSR guidance explicitly distinguishes browser clients from server clients for Server Components, Server Actions, and Route Handlers. Source: <https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs>

### Change

- thin route handlers, thick application services
- explicit write ownership
- server-first route shell for `/generate`
- stage-level client modules
- lazy loading for secondary data

### Defer

- queue/worker extraction
- event sourcing rewrite
- multi-table workflow-state redesign
- real-time synchronization

Those may become valid later, but they are not the best next move for this milestone.

## Recommended Build Order

This order best supports integrity, testing, performance, and maintainability.

### 1. Lock the contracts first

Build:
- editable draft schema
- workflow state schema
- read model normalization helpers

Why first:
- every later refactor depends on stable write ownership
- prevents new regressions while the page is being decomposed

### 2. Add automated tests around current workflow behavior

Build:
- Vitest for store helpers, validation, and route-handler logic
- Playwright for end-to-end generate flow coverage

Recommended minimum test matrix:
- editable draft save does not mutate protected fields
- intake -> planning -> outline -> confirm -> draft -> review -> export happy path
- invalid stage transition rejects cleanly
- version restore round trip
- export response correctness

Next.js currently recommends E2E coverage for async App Router behavior because Vitest does not support async Server Components well enough yet. Sources:
- <https://nextjs.org/docs/app/guides/testing/vitest>
- <https://nextjs.org/docs/app/guides/testing/playwright>

### 3. Refactor the write path

Build:
- `saveDraftEditableFields`
- `saveWorkflowTransition`
- stage-precondition checks
- route updates to use the new command layer

Why here:
- once tests exist, the integrity refactor becomes safe
- it removes the most dangerous current architecture flaw before UI decomposition

### 4. Extract workflow application services from routes

Build:
- one command per stage
- shared transition/result model
- route handlers become auth + validation + response wrappers

Why here:
- creates stable mutation APIs for the UI refactor
- sharply improves maintainability and unit-test reach

### 5. Decompose `app/generate/page.tsx`

Build:
- route shell
- workspace container
- stage modules
- mutation/query hooks

Why after server refactor:
- otherwise the page split just redistributes existing coupling
- with clear command boundaries, each stage becomes a real component boundary

### 6. Apply targeted performance fixes

Build:
- lazy-load noncritical bootstrap data
- stream `.docx` downloads instead of base64 JSON
- replace snapshot recount with increment or database-maintained count

Why last:
- these changes are valuable, but they are safer after write ownership and test coverage are in place

## Patterns to Follow

### Pattern 1: Command-oriented workflow services

**What:** One application command per stage transition.

**When:** Any workflow mutation that changes draft stage or generated artifacts.

**Example:**

```typescript
type WorkflowCommandResult = {
  draft: DraftReadModel;
  versionCreated?: boolean;
};

async function runOutlineGeneration(input: OutlineCommandInput): Promise<WorkflowCommandResult> {
  const draft = await loadDraftForWorkflow(input);
  assertCanGenerateOutline(draft);
  const outline = await workflow.generateOutline(draft, input);
  return await saveWorkflowTransition({
    draftId: draft.id,
    workflowStage: 'outline',
    outline,
    activeRuleIds: input.activeRuleIds,
    activeReferenceIds: input.activeReferenceIds,
  });
}
```

### Pattern 2: Read model normalization at the boundary

**What:** Normalize DB rows once before UI consumption.

**When:** Every route response that returns draft data.

**Why:** Prevent the UI from understanding Supabase column naming and nullability details.

### Pattern 3: Server shell plus thin client islands

**What:** Keep `/generate` as a server route shell and push interactivity into stage clients lower in the tree.

**When:** Any new work on generate-page composition.

**Why:** Better bundle control, smaller first paint, clearer ownership.

## Anti-Patterns to Avoid

### Anti-Pattern 1: One generic draft save function for everything

**What:** Using a single wide contract for editable fields and generated workflow fields.

**Why bad:** It destroys write ownership and makes integrity bugs structural.

**Instead:** Separate editable saves from workflow transitions.

### Anti-Pattern 2: Page-scope fetch handlers for every action

**What:** Keeping dozens of inline action functions in `app/generate/page.tsx`.

**Why bad:** It preserves the current coupling even after superficial file splitting.

**Instead:** Centralize mutation logic in hooks/services and pass narrow callbacks down.

### Anti-Pattern 3: RLS-only integrity thinking

**What:** Assuming row ownership policies are enough to protect workflow correctness.

**Why bad:** A user can still corrupt allowed rows if route contracts are too broad.

**Instead:** enforce business invariants in route/service code and keep RLS as authorization.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| Workflow integrity | route/service boundaries are enough | same approach still valid | may need DB-enforced transition constraints |
| Testing confidence | Vitest + Playwright is sufficient | add CI matrix and fixture DB strategy | add contract and migration smoke suites |
| Generate-page performance | lazy loading and stage split is enough | need better caching and query trimming | likely need separate read models and async jobs |
| AI execution | in-request handling is acceptable | likely need queue for long jobs | queue/worker architecture becomes mandatory |
| Rate limiting | current in-memory approach is weak even now | shared store required | edge/WAF + shared rate-limit backend |

## Sources

- Next.js Route Handlers: <https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers> [HIGH]
- Next.js Composition Patterns: <https://nextjs.org/docs/14/app/building-your-application/rendering/composition-patterns> [HIGH]
- Next.js Vitest guide: <https://nextjs.org/docs/app/guides/testing/vitest> [HIGH]
- Next.js Playwright guide: <https://nextjs.org/docs/app/guides/testing/playwright> [HIGH]
- Supabase RLS guide: <https://supabase.com/docs/guides/database/postgres/row-level-security> [HIGH]
- Supabase Next.js SSR client guidance: <https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs> [HIGH]
- Project brief: `/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/PROJECT.md` [HIGH]
- Existing architecture map: `/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/codebase/ARCHITECTURE.md` [HIGH]
- Existing concerns audit: `/Users/agent/Desktop/ClaudeCodeTesting/DocuGeneratingPlatform/.planning/codebase/CONCERNS.md` [HIGH]
