import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerateRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildQueuedOperationFixture, buildSucceededOperationFixture } from './shared-fixtures.ts';
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

function buildReadyDraftFixture() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice',
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求完成自查。',
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
    review_state: {
      content_hash: 'sha256:review-ready-hash',
      doc_type: 'notice',
      status: 'pass',
      ran_at: '2026-03-28T11:00:00.000Z',
      checks: [],
    },
    pending_change: null,
    updated_at: '2026-03-28T11:00:00.000Z',
  };
}

function buildExportArtifactFixture() {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    operationId: '77777777-7777-4777-8777-777777777777',
    userId: '11111111-1111-4111-8111-111111111111',
    draftId: '22222222-2222-4222-8222-222222222222',
    fileName: '关于开展专项检查的通知.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    byteSize: 12,
    storagePath: 'exports/11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx',
    createdAt: '2026-03-28T11:03:00.000Z',
  };
}

test('export route enqueues a durable export operation instead of returning base64 bytes', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const queued = toOperationReadModel(
    buildQueuedOperationFixture({
      operation_type: 'export',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        docType: 'notice',
        provider: 'claude',
        reviewHash: 'sha256:review-ready-hash',
      },
    })
  );
  const createdOperations: Array<Record<string, unknown>> = [];
  const limiterCalls: Array<Record<string, unknown>> = [];

  const routeModule = await withOperationRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => buildReadyDraftFixture(),
      saveDraftState: async () => {
        throw new Error('export route should not mutate draft state inline once queued');
      },
      createVersionSnapshot: async () => {
        throw new Error('export route should not snapshot inline once queued');
      },
    },
    '@/lib/distributed-ratelimit': {
      enforceDistributedRateLimit: async (payload: Record<string, unknown>) => {
        limiterCalls.push(payload);
      },
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => {
        throw new Error('export bytes should be produced inside the durable operation runner');
      },
    },
    '@/lib/official-document-workflow': {
      computeReviewContentHash: () => 'sha256:review-ready-hash',
    },
    '@/lib/operation-store': {
      createDraftOperation: async (_supabase: unknown, payload: Record<string, unknown>) => {
        createdOperations.push(payload);
        return queued;
      },
      triggerOperationRunnerKick: async () => true,
      OPERATION_RUNNER_PATH: '/api/operations/run',
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => {
        throw new Error('legacy in-memory limiter should not be used by the durable export route');
      },
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'done',
    },
  });

  const response = await routeModule.POST(createOperationJsonRequest('/api/generate', buildGenerateRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 202);
  assert.deepEqual(payload, {
    mode: 'queued',
    operationId: queued.id,
    status: 'queued',
    pollUrl: `/api/operations/${queued.id}`,
  });
  assert.equal(createdOperations[0]?.operation_type, 'export');
  assert.equal(createdOperations[0]?.payload?.reviewHash, 'sha256:review-ready-hash');
  assert.equal(limiterCalls[0]?.action, 'generate');
  assert.equal('file_data' in payload, false);
});

test('completed export download route returns a binary DOCX attachment without JSON file_data', async (t) => {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const operation = toOperationReadModel(
    buildSucceededOperationFixture({
      operation_type: 'export',
      result: {
        artifactId: '99999999-9999-4999-8999-999999999999',
        downloadUrl: '/api/operations/77777777-7777-4777-8777-777777777777/download',
        fileName: '关于开展专项检查的通知.docx',
      },
    })
  );
  const artifact = buildExportArtifactFixture();

  const routeModule = await withOperationRouteModuleMocks(t, '../../../app/api/operations/[id]/download/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'user-scope-stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/env': {
      getEnv: (name: string) => {
        if (name === 'NEXT_PUBLIC_SUPABASE_URL') return 'http://127.0.0.1:54321';
        if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
        return undefined;
      },
    },
    '@/lib/operation-store': {
      getDraftOperationById: async () => operation,
    },
    '@/lib/export-artifact-store': {
      getExportArtifactByOperationId: async () => artifact,
      downloadExportArtifactBytes: async () => Buffer.from('docx-binary'),
    },
    '@supabase/supabase-js': {
      createClient: () => ({ kind: 'service-role-storage-stub' }),
    },
  });

  const response = await routeModule.GET(new Request(`http://localhost/api/operations/${operation.id}/download`, { method: 'GET' }), {
    params: Promise.resolve({ id: operation.id }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), artifact.mimeType);
  assert.match(response.headers.get('content-disposition') || '', /attachment;/i);
  assert.equal(bytes.toString(), 'docx-binary');
});
