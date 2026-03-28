import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
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

test('draft route enqueues full-draft generation and returns an operation handle', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const queued = toOperationReadModel(
    buildQueuedOperationFixture({
      operation_type: 'draft_generate',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        provider: 'claude',
        mode: 'full',
        sessionReferences: [],
      },
    })
  );
  const createdOperations: Array<Record<string, unknown>> = [];
  const limiterCalls: Array<Record<string, unknown>> = [];
  const kickCalls: Array<Record<string, unknown>> = [];

  const draftModule = await withOperationRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => ({
        id: '22222222-2222-4222-8222-222222222222',
        user_id: '11111111-1111-4111-8111-111111111111',
        doc_type: 'notice',
        provider: 'claude',
        workflow_stage: 'draft',
        collected_facts: {},
        active_rule_ids: [],
        active_reference_ids: [],
      }),
      fetchReferenceAssets: async () => [],
      fetchWritingRules: async () => [],
      saveDraftState: async () => {
        throw new Error('draft route should not persist final content inline once queued');
      },
      createVersionSnapshot: async () => {
        throw new Error('draft route should not snapshot inline once queued');
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
      triggerOperationRunnerKick: async (payload: Record<string, unknown>) => {
        kickCalls.push(payload);
        return true;
      },
      OPERATION_RUNNER_PATH: '/api/operations/run',
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => {
        throw new Error('draft generation should run in the durable operation runner');
      },
      regenerateSectionWorkflow: async () => {
        throw new Error('section regeneration should run in the durable operation runner');
      },
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/version-restore': await importOperationProjectModule(t, '../../../lib/version-restore.ts'),
  });

  const response = await draftModule.POST(createOperationJsonRequest('/api/ai/draft', buildDraftRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.deepEqual(payload, {
    mode: 'queued',
    operationId: queued.id,
    status: 'queued',
    pollUrl: `/api/operations/${queued.id}`,
  });
  assert.equal(createdOperations[0]?.operation_type, 'draft_generate');
  assert.equal(createdOperations[0]?.draft_id, '22222222-2222-4222-8222-222222222222');
  assert.equal(createdOperations[0]?.payload?.mode, 'full');
  assert.equal(limiterCalls[0]?.action, 'draft');
  assert.equal(typeof kickCalls[0]?.origin, 'string');
});

test('operation runner reuses workflow logic and authoritative persistence for draft and regenerate operations', async (t) => {
  const queued = toOperationReadModel(
    buildQueuedOperationFixture({
      operation_type: 'draft_generate',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        provider: 'claude',
        mode: 'full',
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
        generated_content: '',
        recipient: '各相关单位',
        content: '',
        issuer: '办公室',
        date: '2026-03-28',
        provider: 'claude',
        contact_name: '张三',
        contact_phone: '12345678',
        attachments: [],
        workflow_stage: 'draft',
        collected_facts: {},
        missing_fields: [],
        planning: null,
        outline: { sections: [] },
        sections: [],
        active_rule_ids: [],
        active_reference_ids: [],
        version_count: 1,
        review_state: null,
        pending_change: null,
        updated_at: '2026-03-28T05:00:00.000Z',
      }),
      fetchReferenceAssets: async () => [],
      fetchWritingRules: async () => [],
      persistFullDraftOperationResult: async (_supabase: unknown, payload: Record<string, unknown>) => {
        persistedPayloads.push(payload);
        return {
          title: '关于开展专项检查的通知',
          content: '一、工作目标\n请按要求完成自查。',
          sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' }],
          workflowStage: 'review',
        };
      },
      persistPendingChangeOperationResult: async (_supabase: unknown, payload: Record<string, unknown>) => {
        persistedPayloads.push(payload);
        return {
          mode: 'preview',
          candidate: {
            candidateId: 'candidate-01',
            action: 'regenerate',
          },
        };
      },
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => {
        workflowCalls.push('generateDraftWorkflow');
        return {
          title: '关于开展专项检查的通知',
          content: '一、工作目标\n请按要求完成自查。',
          sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' }],
        };
      },
      regenerateSectionWorkflow: async () => {
        workflowCalls.push('regenerateSectionWorkflow');
        return {
          title: '关于开展专项检查的通知',
          content: '一、工作目标\n请按要求完成自查。',
          sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' }],
        };
      },
      reviseWorkflow: async () => {
        throw new Error('revise workflow should not run in draft-operation tests');
      },
    },
  });

  const draftExecution = await runner.prepareOperationExecution({
    supabase: { kind: 'stub' },
    operation: queued,
  });
  assert.equal(draftExecution.result.workflowStage, 'review');
  await draftExecution.onComplete();
  assert.equal(workflowCalls[0], 'generateDraftWorkflow');
  assert.equal(persistedPayloads[0]?.operationType, 'draft_generate');

  const regenerateExecution = await runner.prepareOperationExecution({
    supabase: { kind: 'stub' },
    operation: {
      ...queued,
      operationType: 'draft_regenerate',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        provider: 'claude',
        mode: 'section',
        sectionId: 'draft-sec-1',
        sessionReferences: [],
      },
    },
  });
  assert.equal(regenerateExecution.result.mode, 'preview');
  await regenerateExecution.onComplete();
  assert.equal(workflowCalls[1], 'regenerateSectionWorkflow');
  assert.equal(persistedPayloads[1]?.operationType, 'draft_regenerate');
});
