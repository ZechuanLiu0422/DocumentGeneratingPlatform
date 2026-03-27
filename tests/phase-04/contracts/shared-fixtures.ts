type DraftOperationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
type DraftOperationType = 'draft_generate' | 'draft_regenerate' | 'draft_revise' | 'review' | 'export';

type DraftOperationOverrides = Partial<{
  id: string;
  user_id: string;
  draft_id: string | null;
  operation_type: DraftOperationType;
  status: DraftOperationStatus;
  idempotency_key: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  max_attempts: number;
  lease_token: string | null;
  lease_expires_at: string | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}>;

const baseTimestamp = '2026-03-28T11:00:00.000Z';

export function buildExportOperationPayload(overrides: Record<string, unknown> = {}) {
  return {
    docType: 'notice',
    draftTitle: '关于开展专项检查的通知',
    reviewHash: 'sha256:phase-04-review-hash',
    requestedBy: '11111111-1111-4111-8111-111111111111',
    format: 'docx',
    ...overrides,
  };
}

export function buildDraftOperationFixture(overrides: DraftOperationOverrides = {}) {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    user_id: '11111111-1111-4111-8111-111111111111',
    draft_id: '22222222-2222-4222-8222-222222222222',
    operation_type: 'export' as DraftOperationType,
    status: 'queued' as DraftOperationStatus,
    idempotency_key: 'op-export-22222222-v1',
    payload: buildExportOperationPayload(),
    result: null,
    error_code: null,
    error_message: null,
    attempt_count: 0,
    max_attempts: 3,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    started_at: null,
    completed_at: null,
    created_at: baseTimestamp,
    updated_at: baseTimestamp,
    ...overrides,
  };
}

export function buildQueuedOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildDraftOperationFixture({
    status: 'queued',
    ...overrides,
  });
}

export function buildRunningOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildDraftOperationFixture({
    status: 'running',
    attempt_count: 1,
    lease_token: 'lease-running-01',
    lease_expires_at: '2026-03-28T11:05:00.000Z',
    last_heartbeat_at: '2026-03-28T11:01:30.000Z',
    started_at: '2026-03-28T11:01:00.000Z',
    updated_at: '2026-03-28T11:01:30.000Z',
    ...overrides,
  });
}

export function buildSucceededOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildDraftOperationFixture({
    status: 'succeeded',
    operation_type: 'export',
    attempt_count: 1,
    lease_token: 'lease-success-01',
    lease_expires_at: '2026-03-28T11:05:00.000Z',
    last_heartbeat_at: '2026-03-28T11:02:30.000Z',
    started_at: '2026-03-28T11:01:00.000Z',
    completed_at: '2026-03-28T11:03:00.000Z',
    updated_at: '2026-03-28T11:03:00.000Z',
    result: {
      artifactId: '88888888-8888-4888-8888-888888888888',
      storagePath: 'exports/22222222-2222-4222-8222-222222222222/export.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    ...overrides,
  });
}

export function buildFailedOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildDraftOperationFixture({
    status: 'failed',
    operation_type: 'draft_revise',
    attempt_count: 2,
    started_at: '2026-03-28T11:01:00.000Z',
    completed_at: '2026-03-28T11:02:00.000Z',
    updated_at: '2026-03-28T11:02:00.000Z',
    error_code: 'AI_TIMEOUT',
    error_message: 'The provider did not return within the lease window.',
    payload: {
      draftId: '22222222-2222-4222-8222-222222222222',
      sectionIds: ['draft-sec-2'],
      revisionPrompt: '请将时间要求改为本周五下班前。',
    },
    ...overrides,
  });
}

export function buildCancelledOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildDraftOperationFixture({
    status: 'cancelled',
    completed_at: '2026-03-28T11:04:00.000Z',
    updated_at: '2026-03-28T11:04:00.000Z',
    error_code: null,
    error_message: null,
    ...overrides,
  });
}

export function buildStaleLeaseOperationFixture(overrides: DraftOperationOverrides = {}) {
  return buildRunningOperationFixture({
    lease_token: 'lease-stale-01',
    lease_expires_at: '2026-03-28T10:55:00.000Z',
    last_heartbeat_at: '2026-03-28T10:54:30.000Z',
    updated_at: '2026-03-28T10:54:30.000Z',
    ...overrides,
  });
}

export function buildIdempotentExportRequest(overrides: Record<string, unknown> = {}) {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    operationType: 'export',
    idempotencyKey: 'op-export-22222222-v1',
    payload: buildExportOperationPayload(overrides),
  };
}
