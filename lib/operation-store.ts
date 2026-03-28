import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/api';
import {
  draftOperationInsertSchema,
  draftOperationReadModelSchema,
  draftOperationRecordSchema,
  type DraftOperationInsert,
  type DraftOperationReadModel,
  type DraftOperationRecord,
  type DraftOperationStatus,
} from '@/lib/validation';

const draftOperationSelect =
  'id, user_id, draft_id, operation_type, status, idempotency_key, payload, result, error_code, error_message, attempt_count, max_attempts, lease_token, lease_expires_at, last_heartbeat_at, started_at, completed_at, created_at, updated_at';

export const OPERATION_RUNNER_PATH = '/api/operations/run';
export const OPERATION_RUNNER_SELF_KICK_HEADER = 'x-operation-runner-self-kick';

const allowedStatusTransitions: Record<DraftOperationStatus, DraftOperationStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: ['queued', 'cancelled'],
  cancelled: ['queued'],
};

export type OperationLeaseStore = {
  listOperations: () => Promise<DraftOperationReadModel[]>;
  getOperation: (operationId: string) => Promise<DraftOperationReadModel | null>;
  compareAndSetOperation: (input: {
    operationId: string;
    expectedStatus?: DraftOperationStatus;
    expectedUpdatedAt?: string;
    expectedLeaseToken?: string | null;
    patch: Partial<DraftOperationReadModel>;
  }) => Promise<DraftOperationReadModel | null>;
};

type OperationNowInput = Date | string;

function toIsoString(value: OperationNowInput) {
  return value instanceof Date ? value.toISOString() : value;
}

function addLeaseWindow(now: OperationNowInput, leaseMs: number) {
  const base = new Date(toIsoString(now));
  return new Date(base.getTime() + leaseMs).toISOString();
}

function isLeaseExpired(operation: DraftOperationReadModel, now: OperationNowInput) {
  if (!operation.leaseExpiresAt) {
    return true;
  }

  return new Date(operation.leaseExpiresAt).getTime() <= new Date(toIsoString(now)).getTime();
}

function buildLeaseToken(runnerId: string) {
  return `${runnerId}:${crypto.randomUUID()}`;
}

function createStaleLeaseError() {
  return new AppError(409, '操作租约已过期或已被其他执行器接管', 'STALE_OPERATION_LEASE');
}

function sortClaimableOperations(operations: DraftOperationReadModel[]) {
  return [...operations].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return leftTime - rightTime;
  });
}

function mapReadModelPatchToRowPatch(patch: Partial<DraftOperationReadModel>) {
  const rowPatch: Record<string, unknown> = {};

  if ('status' in patch) rowPatch.status = patch.status;
  if ('result' in patch) rowPatch.result = patch.result;
  if ('errorCode' in patch) rowPatch.error_code = patch.errorCode;
  if ('errorMessage' in patch) rowPatch.error_message = patch.errorMessage;
  if ('attemptCount' in patch) rowPatch.attempt_count = patch.attemptCount;
  if ('maxAttempts' in patch) rowPatch.max_attempts = patch.maxAttempts;
  if ('leaseToken' in patch) rowPatch.lease_token = patch.leaseToken;
  if ('leaseExpiresAt' in patch) rowPatch.lease_expires_at = patch.leaseExpiresAt;
  if ('lastHeartbeatAt' in patch) rowPatch.last_heartbeat_at = patch.lastHeartbeatAt;
  if ('startedAt' in patch) rowPatch.started_at = patch.startedAt;
  if ('completedAt' in patch) rowPatch.completed_at = patch.completedAt;
  if ('updatedAt' in patch) rowPatch.updated_at = patch.updatedAt;

  return rowPatch;
}

function toNullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toNullableUuid(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function assertOperationStatusTransition(currentStatus: DraftOperationStatus, nextStatus: DraftOperationStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedStatusTransitions[currentStatus].includes(nextStatus)) {
    throw new AppError(409, `非法操作状态流转: ${currentStatus} -> ${nextStatus}`, 'INVALID_OPERATION_STATUS');
  }
}

export function normalizeDraftOperationRecord(row: unknown): DraftOperationReadModel {
  const parsedRow = draftOperationRecordSchema.parse(row);
  const normalized = {
    id: parsedRow.id,
    userId: parsedRow.user_id,
    draftId: parsedRow.draft_id,
    operationType: parsedRow.operation_type,
    status: parsedRow.status,
    idempotencyKey: parsedRow.idempotency_key,
    payload: parsedRow.payload,
    result: parsedRow.result,
    errorCode: parsedRow.error_code,
    errorMessage: parsedRow.error_message,
    attemptCount: parsedRow.attempt_count,
    maxAttempts: parsedRow.max_attempts,
    leaseToken: parsedRow.lease_token,
    leaseExpiresAt: parsedRow.lease_expires_at,
    lastHeartbeatAt: parsedRow.last_heartbeat_at,
    startedAt: parsedRow.started_at,
    completedAt: parsedRow.completed_at,
    createdAt: parsedRow.created_at,
    updatedAt: parsedRow.updated_at,
  };

  return draftOperationReadModelSchema.parse(normalized);
}

export function createSupabaseOperationLeaseStore(supabase: SupabaseClient): OperationLeaseStore {
  return {
    async listOperations() {
      const { data, error } = await supabase.from('draft_operations').select(draftOperationSelect).order('created_at');

      if (error) {
        throw error;
      }

      return (data || []).map((row) => normalizeDraftOperationRecord(row));
    },
    async getOperation(operationId: string) {
      const { data, error } = await supabase
        .from('draft_operations')
        .select(draftOperationSelect)
        .eq('id', operationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeDraftOperationRecord(data) : null;
    },
    async compareAndSetOperation(input) {
      let query = supabase.from('draft_operations').update(mapReadModelPatchToRowPatch(input.patch)).eq('id', input.operationId);

      if (input.expectedStatus) {
        query = query.eq('status', input.expectedStatus);
      }

      if (input.expectedUpdatedAt) {
        query = query.eq('updated_at', input.expectedUpdatedAt);
      }

      if (input.expectedLeaseToken !== undefined) {
        query =
          input.expectedLeaseToken === null
            ? query.is('lease_token', null)
            : query.eq('lease_token', input.expectedLeaseToken);
      }

      const { data, error } = await query.select(draftOperationSelect).maybeSingle();

      if (error) {
        throw error;
      }

      return data ? normalizeDraftOperationRecord(data) : null;
    },
  };
}

function buildDraftOperationInsert(payload: DraftOperationInsert) {
  return draftOperationInsertSchema.parse({
    status: 'queued',
    attempt_count: 0,
    max_attempts: 3,
    result: null,
    error_code: null,
    error_message: null,
    lease_token: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    started_at: null,
    completed_at: null,
    ...payload,
  });
}

function mapReadModelToRow(operation: DraftOperationReadModel): DraftOperationRecord {
  return draftOperationRecordSchema.parse({
    id: operation.id,
    user_id: operation.userId,
    draft_id: operation.draftId,
    operation_type: operation.operationType,
    status: operation.status,
    idempotency_key: operation.idempotencyKey,
    payload: operation.payload,
    result: operation.result,
    error_code: operation.errorCode,
    error_message: operation.errorMessage,
    attempt_count: operation.attemptCount,
    max_attempts: operation.maxAttempts,
    lease_token: operation.leaseToken,
    lease_expires_at: operation.leaseExpiresAt,
    last_heartbeat_at: operation.lastHeartbeatAt,
    started_at: operation.startedAt,
    completed_at: operation.completedAt,
    created_at: operation.createdAt,
    updated_at: operation.updatedAt,
  });
}

export async function createDraftOperation(supabase: SupabaseClient, payload: DraftOperationInsert) {
  const insertPayload = buildDraftOperationInsert(payload);
  const { data, error } = await supabase
    .from('draft_operations')
    .insert(insertPayload)
    .select(draftOperationSelect)
    .single();

  if (error || !data) {
    throw error || new AppError(500, '创建操作记录失败', 'OPERATION_CREATE_FAILED');
  }

  return normalizeDraftOperationRecord(data);
}

export async function getDraftOperationById(supabase: SupabaseClient, userId: string, operationId: string) {
  const { data, error } = await supabase
    .from('draft_operations')
    .select(draftOperationSelect)
    .eq('id', operationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new AppError(404, '操作记录不存在或无权访问', 'OPERATION_NOT_FOUND');
  }

  return normalizeDraftOperationRecord(data);
}

export async function listDraftOperationsForDraft(supabase: SupabaseClient, userId: string, draftId: string) {
  const { data, error } = await supabase
    .from('draft_operations')
    .select(draftOperationSelect)
    .eq('user_id', userId)
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => normalizeDraftOperationRecord(row));
}

export async function updateDraftOperationStatus(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    operationId: string;
    status: DraftOperationStatus;
    result?: Record<string, unknown> | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    attemptCount?: number;
    maxAttempts?: number;
    leaseToken?: string | null;
    leaseExpiresAt?: string | null;
    lastHeartbeatAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }
) {
  const current = await getDraftOperationById(supabase, payload.userId, payload.operationId);
  assertOperationStatusTransition(current.status, payload.status);

  const updateRow = draftOperationRecordSchema.partial().parse({
    ...mapReadModelToRow(current),
    status: payload.status,
    result: payload.result === undefined ? current.result : payload.result,
    error_code: payload.errorCode === undefined ? current.errorCode : toNullableString(payload.errorCode),
    error_message: payload.errorMessage === undefined ? current.errorMessage : toNullableString(payload.errorMessage),
    attempt_count: payload.attemptCount ?? current.attemptCount,
    max_attempts: payload.maxAttempts ?? current.maxAttempts,
    lease_token: payload.leaseToken === undefined ? current.leaseToken : toNullableString(payload.leaseToken),
    lease_expires_at: payload.leaseExpiresAt === undefined ? current.leaseExpiresAt : toNullableString(payload.leaseExpiresAt),
    last_heartbeat_at:
      payload.lastHeartbeatAt === undefined ? current.lastHeartbeatAt : toNullableString(payload.lastHeartbeatAt),
    started_at: payload.startedAt === undefined ? current.startedAt : toNullableString(payload.startedAt),
    completed_at: payload.completedAt === undefined ? current.completedAt : toNullableString(payload.completedAt),
    draft_id: toNullableUuid(current.draftId),
  });

  const { data, error } = await supabase
    .from('draft_operations')
    .update({
      status: updateRow.status,
      result: updateRow.result,
      error_code: updateRow.error_code,
      error_message: updateRow.error_message,
      attempt_count: updateRow.attempt_count,
      max_attempts: updateRow.max_attempts,
      lease_token: updateRow.lease_token,
      lease_expires_at: updateRow.lease_expires_at,
      last_heartbeat_at: updateRow.last_heartbeat_at,
      started_at: updateRow.started_at,
      completed_at: updateRow.completed_at,
    })
    .eq('id', payload.operationId)
    .eq('user_id', payload.userId)
    .select(draftOperationSelect)
    .single();

  if (error || !data) {
    throw error || new AppError(500, '更新操作状态失败', 'OPERATION_UPDATE_FAILED');
  }

  return normalizeDraftOperationRecord(data);
}

export async function claimNextOperation(input: {
  store: OperationLeaseStore;
  runnerId: string;
  now: OperationNowInput;
  leaseMs: number;
}) {
  const nowIso = toIsoString(input.now);
  const candidates = sortClaimableOperations(await input.store.listOperations()).filter(
    (operation) => operation.status === 'queued' || (operation.status === 'running' && isLeaseExpired(operation, nowIso))
  );

  for (const candidate of candidates) {
    const leaseToken = buildLeaseToken(input.runnerId);
    const claimed = await input.store.compareAndSetOperation({
      operationId: candidate.id,
      expectedStatus: candidate.status,
      expectedUpdatedAt: candidate.updatedAt,
      expectedLeaseToken: candidate.status === 'running' ? candidate.leaseToken : undefined,
      patch: {
        status: 'running',
        attemptCount: candidate.attemptCount + 1,
        leaseToken,
        leaseExpiresAt: addLeaseWindow(nowIso, input.leaseMs),
        lastHeartbeatAt: nowIso,
        startedAt: candidate.startedAt ?? nowIso,
        completedAt: null,
        updatedAt: nowIso,
      },
    });

    if (claimed) {
      return claimed;
    }
  }

  return null;
}

export async function heartbeatOperation(input: {
  store: OperationLeaseStore;
  operationId: string;
  leaseToken: string;
  now: OperationNowInput;
  leaseMs: number;
}) {
  const current = await input.store.getOperation(input.operationId);

  if (!current || current.status !== 'running' || current.leaseToken !== input.leaseToken) {
    throw createStaleLeaseError();
  }

  const nowIso = toIsoString(input.now);
  const updated = await input.store.compareAndSetOperation({
    operationId: input.operationId,
    expectedStatus: 'running',
    expectedUpdatedAt: current.updatedAt,
    expectedLeaseToken: input.leaseToken,
    patch: {
      lastHeartbeatAt: nowIso,
      leaseExpiresAt: addLeaseWindow(nowIso, input.leaseMs),
      updatedAt: nowIso,
    },
  });

  if (!updated) {
    throw createStaleLeaseError();
  }

  return updated;
}

export async function markOperationSucceeded(input: {
  store: OperationLeaseStore;
  operationId: string;
  leaseToken: string;
  result: Record<string, unknown>;
  now: OperationNowInput;
  onComplete?: () => Promise<void> | void;
}) {
  const current = await input.store.getOperation(input.operationId);

  if (!current) {
    throw new AppError(404, '操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (current.status === 'succeeded') {
    return current;
  }

  if (current.status !== 'running' || current.leaseToken !== input.leaseToken) {
    throw createStaleLeaseError();
  }

  await input.onComplete?.();

  const nowIso = toIsoString(input.now);
  const updated = await input.store.compareAndSetOperation({
    operationId: input.operationId,
    expectedStatus: 'running',
    expectedUpdatedAt: current.updatedAt,
    expectedLeaseToken: input.leaseToken,
    patch: {
      status: 'succeeded',
      result: input.result,
      errorCode: null,
      errorMessage: null,
      leaseToken: null,
      leaseExpiresAt: null,
      lastHeartbeatAt: nowIso,
      completedAt: nowIso,
      updatedAt: nowIso,
    },
  });

  if (!updated) {
    const latest = await input.store.getOperation(input.operationId);
    if (latest?.status === 'succeeded') {
      return latest;
    }
    throw createStaleLeaseError();
  }

  return updated;
}

export async function markOperationFailed(input: {
  store: OperationLeaseStore;
  operationId: string;
  leaseToken: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  now: OperationNowInput;
}) {
  const current = await input.store.getOperation(input.operationId);

  if (!current) {
    throw new AppError(404, '操作记录不存在', 'OPERATION_NOT_FOUND');
  }

  if (current.status !== 'running' || current.leaseToken !== input.leaseToken) {
    throw createStaleLeaseError();
  }

  const nowIso = toIsoString(input.now);
  const shouldRetry = input.retryable && current.attemptCount < current.maxAttempts;
  const updated = await input.store.compareAndSetOperation({
    operationId: input.operationId,
    expectedStatus: 'running',
    expectedUpdatedAt: current.updatedAt,
    expectedLeaseToken: input.leaseToken,
    patch: {
      status: shouldRetry ? 'queued' : 'failed',
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      leaseToken: null,
      leaseExpiresAt: null,
      lastHeartbeatAt: nowIso,
      completedAt: shouldRetry ? null : nowIso,
      updatedAt: nowIso,
    },
  });

  if (!updated) {
    throw createStaleLeaseError();
  }

  return updated;
}

export async function drainOperationQueue(input: {
  store: OperationLeaseStore;
  runnerId: string;
  now: OperationNowInput;
  leaseMs: number;
  maxOperations: number;
  execute: (operation: DraftOperationReadModel) => Promise<Record<string, unknown>>;
}) {
  let claimed = 0;
  let completed = 0;
  let failed = 0;
  let requeued = 0;
  const baseNow = new Date(toIsoString(input.now)).getTime();

  for (let index = 0; index < input.maxOperations; index += 1) {
    const cycleNow = new Date(baseNow + index * 1000);
    const operation = await claimNextOperation({
      store: input.store,
      runnerId: input.runnerId,
      now: cycleNow,
      leaseMs: input.leaseMs,
    });

    if (!operation) {
      break;
    }

    claimed += 1;

    try {
      const result = await input.execute(operation);
      await markOperationSucceeded({
        store: input.store,
        operationId: operation.id,
        leaseToken: operation.leaseToken || '',
        result,
        now: new Date(cycleNow.getTime() + 100),
      });
      completed += 1;
    } catch (error) {
      const normalizedError =
        error instanceof AppError
          ? error
          : new AppError(500, error instanceof Error ? error.message : '操作执行失败', 'OPERATION_RUN_FAILED');
      const failedOperation = await markOperationFailed({
        store: input.store,
        operationId: operation.id,
        leaseToken: operation.leaseToken || '',
        errorCode: normalizedError.code,
        errorMessage: normalizedError.message,
        retryable: true,
        now: new Date(cycleNow.getTime() + 100),
      });

      if (failedOperation.status === 'queued') {
        requeued += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { claimed, completed, failed, requeued };
}

export async function triggerOperationRunnerKick(input: {
  origin: string;
  secret?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!input.origin) {
    return false;
  }

  const secret = input.secret;
  if (!secret) {
    return false;
  }

  try {
    const response = await (input.fetchImpl ?? fetch)(new URL(OPERATION_RUNNER_PATH, input.origin), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        [OPERATION_RUNNER_SELF_KICK_HEADER]: secret,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}
