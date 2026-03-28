import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFailedOperationFixture,
  buildQueuedOperationFixture,
  buildRunningOperationFixture,
  buildSucceededOperationFixture,
} from './shared-fixtures.ts';
import { importOperationProjectModule, withOperationRouteModuleMocks } from './route-contract-helpers.ts';

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

function buildDraftRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice',
    title: '关于开展专项检查的通知',
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
    sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' }],
    active_rule_ids: [],
    active_reference_ids: [],
    version_count: 2,
    generated_title: '关于开展专项检查的通知',
    generated_content: '一、工作目标\n请按要求完成自查。',
    review_state: null,
    pending_change: null,
    updated_at: '2026-03-28T11:03:00.000Z',
    ...overrides,
  };
}

function createGetRequest(pathname: string) {
  return new Request(`http://localhost${pathname}`, { method: 'GET' });
}

test('operation status route exposes queued, running, and failed lifecycle read models', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const fixtures = [
    toOperationReadModel(buildQueuedOperationFixture({ operation_type: 'draft_generate' })),
    toOperationReadModel(buildRunningOperationFixture({ operation_type: 'draft_revise' })),
    toOperationReadModel(buildFailedOperationFixture()),
  ];

  for (const operation of fixtures) {
    const routeModule = await withOperationRouteModuleMocks(t, '../../../app/api/operations/[id]/route.ts', {
      '@/lib/api': api,
      '@/lib/auth': {
        requireRouteUser: async () => ({
          supabase: { kind: 'stub' },
          user: { id: '11111111-1111-4111-8111-111111111111' },
        }),
      },
      '@/lib/operation-store': {
        getDraftOperationById: async () => operation,
      },
      '@/lib/collaborative-store': {
        getDraftById: async () => {
          throw new Error('status route should not hydrate draft state before operation success');
        },
      },
      '@/lib/draft-save': await importOperationProjectModule(t, '../../../lib/draft-save.ts'),
    });

    const response = await routeModule.GET(createGetRequest(`/api/operations/${operation.id}`), {
      params: Promise.resolve({ id: operation.id }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.operation.id, operation.id);
    assert.equal(payload.operation.type, operation.operationType);
    assert.equal(payload.operation.status, operation.status);
    assert.equal(payload.operation.attemptCount, operation.attemptCount);
    assert.equal(payload.operation.maxAttempts, operation.maxAttempts);
    assert.equal(payload.operation.errorCode, operation.errorCode);
    assert.equal(payload.operation.errorMessage, operation.errorMessage);
    assert.equal(payload.operation.pollUrl, `/api/operations/${operation.id}`);
    assert.equal(payload.result, null);
    assert.equal(payload.draft, null);
  }
});

test('operation status route hydrates completed draft state for succeeded draft operations', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const operation = toOperationReadModel(
    buildSucceededOperationFixture({
      operation_type: 'draft_revise',
      result: {
        mode: 'preview',
        candidate: {
          candidateId: 'candidate-revise-01',
          action: 'revise',
          targetType: 'section',
        },
      },
    })
  );

  const routeModule = await withOperationRouteModuleMocks(t, '../../../app/api/operations/[id]/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/operation-store': {
      getDraftOperationById: async () => operation,
    },
    '@/lib/collaborative-store': {
      getDraftById: async () =>
        buildDraftRow({
          pending_change: {
            candidateId: 'candidate-revise-01',
            action: 'revise',
            targetType: 'section',
            targetSectionIds: ['draft-sec-1'],
            changedSectionIds: ['draft-sec-1'],
            unchangedSectionIds: [],
            before: {
              title: '关于开展专项检查的通知',
              content: '一、工作目标\n请按要求完成自查。',
              sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请按要求完成自查。' }],
              reviewState: null,
            },
            after: {
              title: '关于开展专项检查的通知',
              content: '一、工作目标\n请于本周五前完成自查。',
              sections: [{ id: 'draft-sec-1', heading: '一、工作目标', body: '请于本周五前完成自查。' }],
              reviewState: null,
            },
            diffSummary: '已生成改写候选',
            userId: '11111111-1111-4111-8111-111111111111',
            createdAt: '2026-03-28T11:02:00.000Z',
            expiresAt: '2026-03-28T13:02:00.000Z',
            baseUpdatedAt: '2026-03-28T11:01:00.000Z',
          },
        }),
    },
    '@/lib/draft-save': await importOperationProjectModule(t, '../../../lib/draft-save.ts'),
  });

  const response = await routeModule.GET(createGetRequest(`/api/operations/${operation.id}`), {
    params: Promise.resolve({ id: operation.id }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.operation.status, 'succeeded');
  assert.deepEqual(payload.result, operation.result);
  assert.equal(payload.draft.id, '22222222-2222-4222-8222-222222222222');
  assert.equal(payload.draft.docType, 'notice');
  assert.equal(payload.draft.pendingChange.candidateId, 'candidate-revise-01');
  assert.equal(payload.draft.pendingChange.action, 'revise');
});
