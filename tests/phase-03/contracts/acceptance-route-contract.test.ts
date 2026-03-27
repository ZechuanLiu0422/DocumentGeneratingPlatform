import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftRequestBody, buildSessionReference } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildTrustedDraftFixture, buildTrustedVersionFixture } from './shared-fixtures.ts';
import { createTrustJsonRequest, importTrustProjectModule, withTrustRouteModuleMocks } from './trust-contract-helpers.ts';

function compileSections(sections: Array<{ heading: string; body: string }>) {
  return sections.map((section) => `${section.heading}\n${section.body}`.trim()).join('\n\n');
}

function buildChangedSections() {
  const draft = buildTrustedDraftFixture();

  return draft.sections.map((section) =>
    section.id === 'draft-sec-2'
      ? {
          ...section,
          body: '请于本周五前提交整改清单。',
        }
      : section
  );
}

async function loadCandidateHelpers(t: Parameters<typeof test>[1] extends never ? never : any) {
  return (await importTrustProjectModule(t, '../../../lib/version-restore.ts')) as Record<string, any>;
}

test('section regenerate preview persists pending candidate without writing a version snapshot', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const changedSections = buildChangedSections();
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];
  const usageEvents: Array<Record<string, any>> = [];

  const draftModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({
        rules: [],
        references: [buildSessionReference()],
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return draftFixture;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/official-document-workflow': {
      regenerateSectionWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: compileSections(changedSections),
        sections: changedSections,
      }),
      generateDraftWorkflow: async () => {
        throw new Error('full draft workflow should not run in section preview test');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async (_supabase: unknown, payload: Record<string, any>) => {
        usageEvents.push(payload);
      },
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await draftModule.POST(
    createTrustJsonRequest('/api/ai/draft', {
      ...buildDraftRequestBody(),
      mode: 'section',
      sectionId: 'draft-sec-2',
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'preview');
  assert.equal(payload.candidate.action, 'regenerate');
  assert.deepEqual(payload.candidate.targetSectionIds, ['draft-sec-2']);
  assert.deepEqual(payload.candidate.changedSectionIds, ['draft-sec-2']);
  assert.deepEqual(savedStates[0]?.workflow.sections, draftFixture.sections);
  assert.equal(savedStates[0]?.workflow.pending_change.action, 'regenerate');
  assert.equal(savedStates[0]?.workflow.pending_change.baseUpdatedAt, savedStates[0]?.updatedAt);
  assert.equal(savedSnapshots.length, 0);
  assert.equal(usageEvents.length, 1);
  assert.equal(usageEvents[0]?.status, 'success');
});

test('section regenerate accept applies the pending candidate and writes exactly one snapshot', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const changedSections = buildChangedSections();
  const currentDraft = {
    ...draftFixture,
    updated_at: '2026-03-27T18:20:00.000Z',
    pending_change: candidateHelpers.buildPendingChangeState({
      candidate: candidateHelpers.buildChangeCandidatePreview({
        action: 'regenerate',
        targetType: 'section',
        targetSectionIds: ['draft-sec-2'],
        beforeDraft: draftFixture,
        after: {
          title: draftFixture.generated_title,
          content: compileSections(changedSections),
          sections: changedSections,
          reviewState: null,
        },
      }),
      userId: draftFixture.user_id,
      createdAt: '2026-03-27T18:20:00.000Z',
      baseUpdatedAt: '2026-03-27T18:20:00.000Z',
    }),
  };
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];

  const draftModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => currentDraft,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return currentDraft;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/official-document-workflow': {
      regenerateSectionWorkflow: async () => {
        throw new Error('regenerate workflow should not run during accept');
      },
      generateDraftWorkflow: async () => {
        throw new Error('full draft workflow should not run during accept');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await draftModule.POST(
    createTrustJsonRequest('/api/ai/draft', {
      draftId: draftFixture.id,
      provider: 'claude',
      mode: 'section',
      sectionId: 'draft-sec-2',
      decision: 'accept',
      candidateId: currentDraft.pending_change.candidateId,
      sessionReferences: [],
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'accept');
  assert.equal(payload.workflowStage, 'review');
  assert.deepEqual(payload.sections, changedSections);
  assert.equal(savedStates.length, 1);
  assert.deepEqual(savedStates[0]?.workflow.sections, changedSections);
  assert.equal(savedStates[0]?.workflow.pending_change, null);
  assert.equal(savedSnapshots.length, 1);
  assert.equal(savedSnapshots[0]?.stage, 'draft_generated');
  assert.deepEqual(savedSnapshots[0]?.sections, changedSections);
});

test('revise reject clears pending candidate without writing a version snapshot', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const changedSections = buildChangedSections();
  const currentDraft = {
    ...draftFixture,
    updated_at: '2026-03-27T18:30:00.000Z',
    pending_change: candidateHelpers.buildPendingChangeState({
      candidate: candidateHelpers.buildChangeCandidatePreview({
        action: 'revise',
        targetType: 'section',
        targetSectionIds: ['draft-sec-2'],
        beforeDraft: draftFixture,
        after: {
          title: draftFixture.generated_title,
          content: compileSections(changedSections),
          sections: changedSections,
          reviewState: null,
        },
      }),
      userId: draftFixture.user_id,
      createdAt: '2026-03-27T18:30:00.000Z',
      baseUpdatedAt: '2026-03-27T18:30:00.000Z',
    }),
  };
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];

  const reviseModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/revise/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => currentDraft,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return currentDraft;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/official-document-workflow': {
      reviseWorkflow: async () => {
        throw new Error('revise workflow should not run during reject');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await reviseModule.POST(
    createTrustJsonRequest('/api/ai/revise', {
      draftId: draftFixture.id,
      provider: 'claude',
      targetType: 'section',
      targetId: 'draft-sec-2',
      instruction: '',
      decision: 'reject',
      candidateId: currentDraft.pending_change.candidateId,
      sessionReferences: [],
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'reject');
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0]?.workflow.pending_change, null);
  assert.equal(savedSnapshots.length, 0);
});

test('restore preview diffs against the live accepted draft and creates no snapshot', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const versionFixture = buildTrustedVersionFixture();
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];

  const restoreModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/versions/restore/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      getVersionById: async () => versionFixture,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return draftFixture;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await restoreModule.POST(
    createTrustJsonRequest('/api/ai/versions/restore', {
      draftId: draftFixture.id,
      versionId: versionFixture.id,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'preview');
  assert.deepEqual(payload.candidate.before.sections, draftFixture.sections);
  assert.deepEqual(payload.candidate.after.sections, versionFixture.sections);
  assert.deepEqual(savedStates[0]?.workflow.sections, draftFixture.sections);
  assert.equal(savedStates[0]?.workflow.pending_change.action, 'restore');
  assert.equal(savedSnapshots.length, 0);
});

test('accept rejects stale candidates when the draft base changed after preview', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const driftedSections = draftFixture.sections.map((section) =>
    section.id === 'draft-sec-1'
      ? {
          ...section,
          body: `${section.body}（已被其他操作更新）`,
        }
      : section
  );
  const currentDraft = {
    ...draftFixture,
    sections: driftedSections,
    generated_content: compileSections(driftedSections),
    updated_at: '2026-03-27T18:40:00.000Z',
    pending_change: candidateHelpers.buildPendingChangeState({
      candidate: candidateHelpers.buildChangeCandidatePreview({
        action: 'revise',
        targetType: 'section',
        targetSectionIds: ['draft-sec-2'],
        beforeDraft: draftFixture,
        after: {
          title: draftFixture.generated_title,
          content: compileSections(buildChangedSections()),
          sections: buildChangedSections(),
          reviewState: null,
        },
      }),
      userId: draftFixture.user_id,
      createdAt: '2026-03-27T18:35:00.000Z',
      baseUpdatedAt: '2026-03-27T18:35:00.000Z',
    }),
  };
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];

  const reviseModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/revise/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => currentDraft,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return currentDraft;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/official-document-workflow': {
      reviseWorkflow: async () => {
        throw new Error('revise workflow should not run during stale accept');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await reviseModule.POST(
    createTrustJsonRequest('/api/ai/revise', {
      draftId: draftFixture.id,
      provider: 'claude',
      targetType: 'section',
      targetId: 'draft-sec-2',
      instruction: '',
      decision: 'accept',
      candidateId: currentDraft.pending_change.candidateId,
      sessionReferences: [],
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'STALE_CANDIDATE');
  assert.equal(savedStates.length, 0);
  assert.equal(savedSnapshots.length, 0);
});

test('restore accept still succeeds when only updated_at drifted but accepted content still matches preview base', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const versionFixture = buildTrustedVersionFixture();
  const currentDraft = {
    ...draftFixture,
    updated_at: '2026-03-27T18:46:00.000Z',
    pending_change: candidateHelpers.buildPendingChangeState({
      candidate: candidateHelpers.buildRestoreCandidatePreview(
        draftFixture,
        versionFixture,
        '33333333-3333-4333-8333-333333333333'
      ),
      userId: draftFixture.user_id,
      createdAt: '2026-03-27T18:45:00.000Z',
      baseUpdatedAt: '2026-03-27T18:45:00.000Z',
    }),
  };
  const savedStates: Array<Record<string, any>> = [];
  const savedSnapshots: Array<Record<string, any>> = [];

  const restoreModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/versions/restore/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => currentDraft,
      getVersionById: async () => versionFixture,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return currentDraft;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await restoreModule.POST(
    createTrustJsonRequest('/api/ai/versions/restore', {
      draftId: draftFixture.id,
      decision: 'accept',
      candidateId: currentDraft.pending_change.candidateId,
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.mode, 'accept');
  assert.equal(savedStates.length, 1);
  assert.equal(savedStates[0]?.workflow.pending_change, null);
  assert.equal(savedSnapshots.length, 1);
  assert.equal(savedSnapshots[0]?.stage, 'restored');
});

test('section-scoped revise accept keeps untouched sections byte-for-byte unchanged', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const candidateHelpers = await loadCandidateHelpers(t);
  const draftFixture = buildTrustedDraftFixture();
  const changedSections = buildChangedSections();
  const currentDraft = {
    ...draftFixture,
    updated_at: '2026-03-27T18:50:00.000Z',
    pending_change: candidateHelpers.buildPendingChangeState({
      candidate: candidateHelpers.buildChangeCandidatePreview({
        action: 'revise',
        targetType: 'section',
        targetSectionIds: ['draft-sec-2'],
        beforeDraft: draftFixture,
        after: {
          title: draftFixture.generated_title,
          content: compileSections(changedSections),
          sections: changedSections,
          reviewState: null,
        },
      }),
      userId: draftFixture.user_id,
      createdAt: '2026-03-27T18:50:00.000Z',
      baseUpdatedAt: '2026-03-27T18:50:00.000Z',
    }),
  };
  const savedSnapshots: Array<Record<string, any>> = [];

  const reviseModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/revise/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: draftFixture.user_id },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => currentDraft,
      saveDraftState: async () => currentDraft,
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedSnapshots.push(payload);
      },
    },
    '@/lib/official-document-workflow': {
      reviseWorkflow: async () => {
        throw new Error('revise workflow should not run during accept');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
    '@/lib/version-restore': candidateHelpers,
  });

  const response = await reviseModule.POST(
    createTrustJsonRequest('/api/ai/revise', {
      draftId: draftFixture.id,
      provider: 'claude',
      targetType: 'section',
      targetId: 'draft-sec-2',
      instruction: '',
      decision: 'accept',
      candidateId: currentDraft.pending_change.candidateId,
      sessionReferences: [],
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload.updatedSections[0], draftFixture.sections[0]);
  assert.notDeepEqual(payload.updatedSections[1], draftFixture.sections[1]);
  assert.equal(savedSnapshots.length, 1);
  assert.deepEqual(savedSnapshots[0]?.sections[0], draftFixture.sections[0]);
  assert.equal(savedSnapshots[0]?.sections[1]?.body, '请于本周五前提交整改清单。');
});
