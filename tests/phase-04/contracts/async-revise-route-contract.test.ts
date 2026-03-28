import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueuedOperationFixture } from './shared-fixtures.ts';
import { createOperationJsonRequest, importOperationProjectModule, withOperationRouteModuleMocks } from './route-contract-helpers.ts';

function toOperationReadModel(row: ReturnType<typeof buildQueuedOperationFixture>) {
  return {
    id: row.id,
    userId: row.user_id,
    draftId: row.draft_id,
    operationType: row.operation_type,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    payload: row.payload,
    result: row.result,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

test('revise route enqueues preview work and preserves compare-before-accept semantics', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const queued = toOperationReadModel(
    buildQueuedOperationFixture({
      operation_type: 'draft_revise',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        provider: 'claude',
        targetType: 'section',
        targetId: 'draft-sec-2',
        instruction: '请改得更简洁。',
        sessionReferences: [],
      },
    })
  );
  const createdOperations: Array<Record<string, unknown>> = [];
  const limiterCalls: Array<Record<string, unknown>> = [];

  const reviseModule = await withOperationRouteModuleMocks(t, '../../../app/api/ai/revise/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => ({
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '11111111-1111-4111-8111-111111111111',
        doc_type: 'notice',
        provider: 'claude',
        workflow_stage: 'review',
        sections: [
          { id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' },
          { id: 'draft-sec-2', heading: '二、工作安排', body: '请于下周三前完成材料报送。' },
        ],
        collected_facts: {},
        active_rule_ids: [],
        active_reference_ids: [],
      }),
      fetchReferenceAssets: async () => [],
      fetchWritingRules: async () => [],
      saveDraftState: async () => {
        throw new Error('revise route should not persist preview changes inline once queued');
      },
      createVersionSnapshot: async () => {
        throw new Error('revise route should not snapshot inline once queued');
      },
    },
    '@/lib/distributed-ratelimit': {
      enforceDistributedRateLimit: async (payload: Record<string, unknown>) => {
        limiterCalls.push(payload);
      },
    },
    '@/lib/operation-store': {
      createDraftOperation: async (_supabase: unknown, payload: Record<string, unknown>) => {
        createdOperations.push(payload);
        return queued;
      },
      triggerOperationRunnerKick: async () => true,
      OPERATION_RUNNER_PATH: '/api/operations/run',
    },
    '@/lib/official-document-workflow': {
      reviseWorkflow: async () => {
        throw new Error('revise workflow should run in the durable operation runner');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/version-restore': await importOperationProjectModule(t, '../../../lib/version-restore.ts'),
  });

  const response = await reviseModule.POST(
    createOperationJsonRequest('/api/ai/revise', {
      draftId: '22222222-2222-4222-8222-222222222222',
      provider: 'claude',
      targetType: 'section',
      targetId: 'draft-sec-2',
      selectedText: '',
      instruction: '请改得更简洁。',
      sessionReferences: [],
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.deepEqual(payload, {
    mode: 'queued',
    operationId: queued.id,
    status: 'queued',
    pollUrl: `/api/operations/${queued.id}`,
  });
  assert.equal(createdOperations[0]?.operation_type, 'draft_revise');
  assert.equal(createdOperations[0]?.payload?.targetType, 'section');
  assert.equal(createdOperations[0]?.payload?.instruction, '请改得更简洁。');
  assert.equal(limiterCalls[0]?.action, 'revise');
});

test('operation runner reuses reviseWorkflow and authoritative preview persistence for queued revise work', async (t) => {
  const queued = toOperationReadModel(
    buildQueuedOperationFixture({
      operation_type: 'draft_revise',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        provider: 'claude',
        targetType: 'section',
        targetId: 'draft-sec-2',
        selectedText: '',
        instruction: '请改得更简洁。',
        sessionReferences: [],
      },
    })
  );
  const workflowCalls: string[] = [];
  const persistedPayloads: Array<Record<string, unknown>> = [];

  const runner = await importOperationProjectModule(t, '../../../lib/operation-runner.ts', {
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => ({
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '11111111-1111-4111-8111-111111111111',
        doc_type: 'notice',
        title: '关于开展专项检查的通知',
        generated_title: '关于开展专项检查的通知',
        generated_content: '一、工作目标\n请按要求完成自查。',
        recipient: '各相关单位',
        content: '一、工作目标\n请按要求完成自查。',
        issuer: '办公室',
        date: '2026-03-28',
        provider: 'claude',
        contact_name: '张三',
        contact_phone: '12345678',
        attachments: [],
        workflow_stage: 'review',
        collected_facts: {},
        missing_fields: [],
        planning: null,
        outline: null,
        sections: [
          { id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' },
          { id: 'draft-sec-2', heading: '二、工作安排', body: '请于下周三前完成材料报送。' },
        ],
        active_rule_ids: [],
        active_reference_ids: [],
        version_count: 2,
        review_state: null,
        pending_change: null,
        updated_at: '2026-03-28T05:10:00.000Z',
      }),
      fetchReferenceAssets: async () => [],
      fetchWritingRules: async () => [],
      persistFullDraftOperationResult: async () => {
        throw new Error('full draft persistence should not run in revise-operation tests');
      },
      persistPendingChangeOperationResult: async (_supabase: unknown, payload: Record<string, unknown>) => {
        persistedPayloads.push(payload);
        return {
          mode: 'preview',
          candidate: {
            candidateId: 'candidate-revise-01',
            action: 'revise',
            targetType: 'section',
          },
        };
      },
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => {
        throw new Error('draft workflow should not run in revise-operation tests');
      },
      regenerateSectionWorkflow: async () => {
        throw new Error('regenerate workflow should not run in revise-operation tests');
      },
      reviseWorkflow: async () => {
        workflowCalls.push('reviseWorkflow');
        return {
          title: '关于开展专项检查的通知',
          updatedContent: '一、工作目标\n请按要求完成自查。\n\n二、工作安排\n请于本周五前完成材料报送。',
          updatedSections: [
            { id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' },
            { id: 'draft-sec-2', heading: '二、工作安排', body: '请于本周五前完成材料报送。' },
          ],
          changeSummary: '已生成改写候选',
        };
      },
    },
  });

  const execution = await runner.prepareOperationExecution({
    supabase: { kind: 'stub' },
    operation: queued,
  });
  assert.equal(execution.result.mode, 'preview');
  await execution.onComplete();

  assert.equal(workflowCalls[0], 'reviseWorkflow');
  assert.equal(persistedPayloads[0]?.operationType, 'draft_revise');
  assert.equal(persistedPayloads[0]?.targetType, 'section');
});
