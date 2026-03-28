import test from 'node:test';
import assert from 'node:assert/strict';
import { importOperationProjectModule } from '../contracts/route-contract-helpers.ts';
import { buildSucceededOperationFixture } from '../contracts/shared-fixtures.ts';

function toOperationReadModel(row: ReturnType<typeof buildSucceededOperationFixture>) {
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

function createSupabaseStub() {
  const uploads: Array<Record<string, unknown>> = [];
  const upserts: Array<Record<string, unknown>> = [];
  const storageDownloads: string[] = [];

  const supabase = {
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Buffer, options: Record<string, unknown>) => {
          uploads.push({ path, size: bytes.byteLength, options });
          return { data: null, error: null };
        },
        download: async (path: string) => {
          storageDownloads.push(path);
          return {
            data: new Blob([Buffer.from('artifact-bytes')], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            }),
            error: null,
          };
        },
      }),
    },
    from: (table: string) => {
      if (table !== 'export_artifacts') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        upsert(payload: Record<string, unknown>) {
          upserts.push(payload);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: {
                      id: '99999999-9999-4999-8999-999999999999',
                      operation_id: payload.operation_id,
                      user_id: payload.user_id,
                      draft_id: payload.draft_id,
                      file_name: payload.file_name,
                      mime_type: payload.mime_type,
                      byte_size: payload.byte_size,
                      storage_path: payload.storage_path,
                      created_at: '2026-03-28T11:03:00.000Z',
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { supabase, uploads, upserts, storageDownloads };
}

test('export artifact store normalizes storage paths, persists metadata, and downloads bytes from durable storage', async (t) => {
  const module = await importOperationProjectModule(t, '../../../lib/export-artifact-store.ts');
  const { supabase, uploads, upserts, storageDownloads } = createSupabaseStub();

  const artifact = await module.uploadExportArtifact(supabase as any, {
    operationId: '77777777-7777-4777-8777-777777777777',
    userId: '11111111-1111-4111-8111-111111111111',
    draftId: '22222222-2222-4222-8222-222222222222',
    fileName: '关于开展专项检查的通知.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: Buffer.from('docx-binary'),
  });

  assert.equal(
    module.normalizeExportArtifactStoragePath('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777'),
    'exports/11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx'
  );
  assert.equal(uploads[0]?.path, '11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx');
  assert.equal(upserts[0]?.storage_path, artifact.storagePath);

  const bytes = await module.downloadExportArtifactBytes(supabase as any, artifact.storagePath);
  assert.equal(bytes.toString(), 'artifact-bytes');
  assert.equal(storageDownloads[0], '11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx');
});

test('operation runner reuses document generation and durable export persistence for queued export work', async (t) => {
  const generatedBuffers: Buffer[] = [];
  const uploadedArtifacts: Array<Record<string, unknown>> = [];
  const persistedExports: Array<Record<string, unknown>> = [];
  const operation = toOperationReadModel(
    buildSucceededOperationFixture({
      operation_type: 'export',
      status: 'running',
      result: null,
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        docType: 'notice',
        provider: 'claude',
        reviewHash: 'sha256:review-ready-hash',
      },
    })
  );

  const runner = await importOperationProjectModule(t, '../../../lib/operation-runner.ts', {
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      compileSectionsToContent: () => '一、工作目标\n请按要求完成自查。',
      getDraftById: async () => ({
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
      }),
      persistFullDraftOperationResult: async () => {
        throw new Error('draft persistence should not run for export operations');
      },
      persistPendingChangeOperationResult: async () => {
        throw new Error('pending-change persistence should not run for export operations');
      },
      persistExportOperationResult: async (_supabase: unknown, payload: Record<string, unknown>) => {
        persistedExports.push(payload);
        return {
          artifactId: '99999999-9999-4999-8999-999999999999',
          downloadUrl: '/api/operations/77777777-7777-4777-8777-777777777777/download',
          fileName: '关于开展专项检查的通知.docx',
          workflowStage: 'done',
        };
      },
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => {
        const buffer = Buffer.from('docx-binary');
        generatedBuffers.push(buffer);
        return buffer;
      },
    },
    '@/lib/export-artifact-store': {
      DOCX_MIME_TYPE: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      uploadExportArtifact: async (_supabase: unknown, payload: Record<string, unknown>) => {
        uploadedArtifacts.push(payload);
        return {
          id: '99999999-9999-4999-8999-999999999999',
          operationId: '77777777-7777-4777-8777-777777777777',
          userId: '11111111-1111-4111-8111-111111111111',
          draftId: '22222222-2222-4222-8222-222222222222',
          fileName: '关于开展专项检查的通知.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          byteSize: 11,
          storagePath: 'exports/11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx',
          createdAt: '2026-03-28T11:03:00.000Z',
        };
      },
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => {
        throw new Error('draft workflow should not run in export-operation tests');
      },
      regenerateSectionWorkflow: async () => {
        throw new Error('regenerate workflow should not run in export-operation tests');
      },
      reviseWorkflow: async () => {
        throw new Error('revise workflow should not run in export-operation tests');
      },
      computeReviewContentHash: () => 'sha256:review-ready-hash',
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'done',
    },
  });

  const execution = await runner.prepareOperationExecution({
    supabase: { kind: 'service-role-stub' } as any,
    operation,
  });

  assert.equal(execution.result.downloadUrl, '/api/operations/77777777-7777-4777-8777-777777777777/download');
  assert.equal(generatedBuffers.length, 1);
  await execution.onComplete();

  assert.equal(uploadedArtifacts[0]?.operationId, operation.id);
  assert.equal(persistedExports[0]?.operationId, operation.id);
  assert.equal(persistedExports[0]?.artifact.storagePath, 'exports/11111111-1111-4111-8111-111111111111/77777777-7777-4777-8777-777777777777.docx');
});
