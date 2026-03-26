# Feature Landscape

**Domain:** AI-assisted official-document generation platform
**Project:** DocumentGeneratingPlatform
**Researched:** 2026-03-26
**Overall confidence:** MEDIUM-HIGH

## Framing

This project is not a greenfield "AI writing app." It is already strong on staged drafting, per-user drafts, organizational assets, version restore, and `.docx` export. The next milestone should therefore focus on what enterprise users now reasonably expect in 2026 for official-document workflows: grounded generation, reviewability, governance, and reliable formatting.

The strongest market signal from Microsoft 365 Copilot, Google Docs with Gemini, Adobe Acrobat AI Assistant, and PandaDoc is consistent: AI drafting alone is no longer differentiating. Baseline expectations now include source-grounded generation, iterative rewrite/summarize flows, reusable content libraries, secure enterprise data handling, and auditable review history. A brownfield milestone should close those gaps before chasing broader collaboration or speculative agent behavior.

## Table Stakes

Features users now expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Grounded drafting from approved internal sources | Microsoft Copilot and Gemini both support drafting from existing files; users expect outputs to reflect internal terminology and prior materials instead of generic LLM prose. | Med | `writing_rules`, `reference_assets`, server-side retrieval/context assembly, protected workflow writes | Partially present. The next milestone should make grounding more explicit and reliable, not just optional context stuffing. |
| Inline rewrite, summarize, shorten, formalize, and section regeneration | Gemini and Copilot normalize in-place iteration, not one-shot generation. Users expect to refine tone and length without restarting the document. | Low-Med | Existing revise/review flows, finer-grained section actions in UI | Mostly present conceptually; needs cleaner UX and more predictable section-level controls. |
| Citations / traceability for AI-generated claims | Copilot and Acrobat expose references/citations. In official documents, unverifiable statements are a trust killer. | Med-High | Source chunking, citation metadata, UI rendering, export representation | Highest-value feature gap for trust. Citations can begin as section-level source references rather than token-level provenance. |
| Human review with keep/discard/regenerate and version restore | Major tools treat AI output as a draft to review, not an authoritative final artifact. | Low | Existing version snapshots, staged workflow, restore APIs | Already present in part; keep it table stakes, not a differentiator. The gap is reliability and clarity. |
| Official-format export fidelity | For formal documents, users expect output they can circulate immediately in Word/PDF with minimal cleanup. | Med | `lib/document-generator.ts`, templates, binary streaming export | Existing strength, but next milestone should improve formatting fidelity and remove base64 export overhead. |
| Reusable content library for approved phrases, blocks, and templates | PandaDoc content libraries and variables make reuse baseline. Official-document users expect standard clauses, boilerplate, and reusable structures. | Low-Med | Existing common phrases, writing rules, template layer, better insertion UX | Largely present in data model; needs better workflow integration so these assets feel first-class. |
| Approval / audit trail for document lifecycle events | Enterprise document tools now expose approval and audit history. Official documents often need reviewer accountability. | Med | Version events, review events, actor metadata, immutable log design | Start with internal review/audit trail before full signoff routing. |
| Security, tenant isolation, and "no training on customer content" posture | Enterprise buyers expect server-held secrets, access control, auditability, and clear data handling. | Med | Supabase auth/RLS, provider policy disclosure, protected routes, audit logs | Already part of the architecture, but workflow-integrity holes currently weaken the trust story. |
| Predictable workflow state and resumability | For multi-step drafting, users expect drafts to reopen cleanly at the right stage without AI artifacts being overwritten accidentally. | Med | Lock down `app/api/drafts/route.ts`, authoritative server-side state machine, tests | This is table stakes for this product category, not just internal tech debt. |

## Differentiators

Features that can credibly set this product apart in the next milestone. These should reinforce the product's official-document niche instead of broadening it into a generic AI editor.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Official-document policy checker before export | Checks draft structure, tone, missing mandatory sections, and risky wording against organization or government-style requirements. | High | Document-type schemas, rule engine, review UI, test fixtures | Strongest near-term differentiator because it builds directly on the existing staged workflow and rule assets. |
| Citation-backed review mode | Reviewer can inspect each AI-produced section with linked sources, not just accept prose on faith. | High | Source grounding, citation storage, review UI, export annotations or appendix | More differentiated than simple citations because it turns provenance into an approval workflow. |
| Template-constrained generation with strict structure guarantees | Instead of "best effort" drafting, the system guarantees output shape for `通知`, `函`, `请示`, and `报告`. | Med-High | Stronger schemas, server-only transitions, template validation, export mapping | High fit for official documents; much better than expanding to many new doc types too early. |
| Organization memory with ranked reusable exemplars | Suggests relevant past documents, phrases, and structural patterns for the current draft type and topic. | Med-High | Reference indexing/search, metadata tagging, retrieval ranking, citation support | Builds on existing historical docs and reference assets without requiring a full RAG platform rewrite. |
| Draft risk flags for sensitive language, missing approvals, or unsupported claims | Helps users catch governance issues before a document leaves the system. | Med | Rule engine, review stage UX, metadata on approvals and citations | Valuable because it aligns with official-document governance, not just writing assistance. |
| Side-by-side redline / compare between versions | Makes policy, factual, and tone changes reviewable across iterations. | Med | Version snapshots, diff rendering, export integration | Especially useful for collaborative review without needing true real-time co-editing. |
| Role-aware generation presets | Different presets for drafter, reviewer, approver, or office administrator so prompts and checks match job function. | Med | User profile/role metadata, prompt routing, UI presets | Differentiates on workflow fit, not raw model capability. |
| Chinese official-writing quality packs | Purpose-built style rules, section patterns, and phrase banks for the four supported document types. | Med | Expanded rule assets, evaluation set, type-specific UX hints | High-leverage niche advantage. It is more defensible than adding more models. |

## Anti-Features

Features to explicitly NOT build in the next milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time multi-user co-editing | Expensive, broad, and already out of scope. It would compete with workflow-integrity and reviewability work that matters more right now. | Keep async collaboration via versions, comments/review states, and audit trail. |
| Generic chat-first writing workspace | A freeform chat canvas would dilute the product's niche and make output less controllable. | Double down on structured stages, document-type constraints, and guided review. |
| Expanding to many new document types next milestone | More types increase prompt, template, QA, and export surface area before the current four are fully reliable. | Deepen quality and policy coverage for `通知`, `函`, `请示`, and `报告` first. |
| User-managed personal model keys | Conflicts with governance, security, and operational consistency. | Keep centrally managed providers and improve provider routing/fallback behind the server boundary. |
| Autonomous sending/submission without explicit approval | Official documents carry governance risk; users should not lose signoff control. | Keep human approval gates and auditable release actions. |
| "One-click final document" marketing behavior | Overpromises certainty in a category where traceability and review matter. | Position AI as a grounded drafting and review accelerator with explicit verification steps. |
| Heavy multimodal scope expansion (slides, social posts, images, general content studio) | Pulls the system away from official-document reliability and adds unrelated UI/infra complexity. | Stay focused on document drafting, review, provenance, and export fidelity. |

## Feature Dependencies

```text
Protected server-side workflow state
  -> Reliable staged drafting
  -> Trustworthy version history
  -> Approval / audit trail

Reference asset retrieval + metadata
  -> Grounded drafting
  -> Citations / traceability
  -> Organization memory / exemplars
  -> Citation-backed review mode

Document-type schemas + templates
  -> Template-constrained generation
  -> Policy checker
  -> Export fidelity

Version snapshots + diff infrastructure
  -> Human review workflows
  -> Redline / compare
  -> Approval evidence
```

## MVP Recommendation For The Next Milestone

Prioritize:

1. **Protected workflow integrity**
   - Make server routes authoritative for workflow state, version counters, and AI artifacts.
   - Reason: every higher-value feature depends on trusting draft state.

2. **Grounded generation with visible source references**
   - Start with section-level citations from approved reference assets and historical documents.
   - Reason: this is the clearest gap between "AI draft toy" and "official-document tool."

3. **Review and audit hardening**
   - Add clearer review states, version compare, and auditable actor/event history.
   - Reason: official-document workflows require accountable iteration more than more generation tricks.

Defer:

- **Real-time co-editing**: low strategic fit for the current product scope.
- **New document types**: adds breadth before existing types are fully governed.
- **Custom agent ecosystems / autonomous workflows**: premature until provenance and approval controls are solid.

## Recommended Requirement Shape

Downstream requirements should frame the next milestone around three outcomes:

1. **Trustworthy outputs**
   - AI-generated sections are grounded in approved sources.
   - Reviewers can inspect where claims came from.

2. **Trustworthy workflow state**
   - Only trusted server-side paths can mutate protected draft artifacts.
   - Version history and audit events are reliable enough for formal review.

3. **Trustworthy final deliverables**
   - Exported Word documents preserve official structure and formatting.
   - Users can compare revisions and complete review before release.

## Sources

- Microsoft Support: Draft and add content with Copilot in Word
  - https://support.microsoft.com/en-us/office/draft-and-add-content-with-copilot-in-word-069c91f0-9e42-4c9a-bbce-fddf5d581541
  - Confidence: HIGH
- Microsoft Support: Welcome to Copilot in Word
  - https://support.microsoft.com/en-us/office/welcome-to-copilot-in-word-2135e85f-a467-463b-b2f0-c51a46d625d1
  - Confidence: HIGH
- Microsoft Support: Chat with Copilot about your Word document
  - https://support.microsoft.com/en-us/office/chat-with-copilot-about-your-word-document-4482c688-a495-4571-bfcd-4a9fc6608090
  - Confidence: HIGH
- Google Docs Editors Help: Write with Gemini in Google Docs
  - https://support.google.com/docs/answer/13951448?hl=en
  - Confidence: HIGH
- Google Docs Editors Help: Gemini in Docs, Sheets, Slides, Vids, & Forms
  - https://support.google.com/docs/answer/15123226?hl=en
  - Confidence: HIGH
- Adobe HelpX: AI powered document summaries and insights
  - https://helpx.adobe.com/acrobat/web/use-acrobat-extensions/acrobat-for-sharepoint-and-onedrive/ai-summaries-insights.html
  - Confidence: MEDIUM
- Adobe HelpX: Get AI generated answers
  - https://helpx.adobe.com/acrobat/using/get-ai-generated-answers.html
  - Confidence: HIGH
- Adobe HelpX: View citations in responses
  - https://helpx.adobe.com/acrobat/desktop/explore-pdf-spaces/view-citations.html
  - Confidence: HIGH
- Adobe HelpX: Unlock AI-powered productivity with PDF Spaces
  - https://helpx.adobe.com/in/acrobat/using/custom-ai-insights.html
  - Confidence: MEDIUM
- Microsoft Learn: Microsoft 365 Copilot data and compliance readiness
  - https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-minimum-requirements-data-compliance
  - Confidence: HIGH
- Microsoft Learn: Learn about sensitivity labels
  - https://learn.microsoft.com/en-us/microsoft-365/compliance/sensitivity-labels?view=o365-21vianet
  - Confidence: HIGH
- Microsoft Learn: Configure data security for Microsoft 365 Copilot
  - https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-e3-guide
  - Confidence: HIGH
- PandaDoc Help Center: Content Library
  - https://support.pandadoc.com/en/articles/9714631-content-library
  - Confidence: HIGH
- PandaDoc Help Center: Variables
  - https://support.pandadoc.com/en/articles/9714599-variables
  - Confidence: HIGH
- PandaDoc Help Center: Review Audit trail for sent documents
  - https://support.pandadoc.com/en/articles/9714819-review-audit-trail-for-sent-documents
  - Confidence: HIGH
- PandaDoc Help Center: PandaDoc AI Policy
  - https://support.pandadoc.com/en/articles/13794735-pandadoc-ai-policy
  - Confidence: HIGH

