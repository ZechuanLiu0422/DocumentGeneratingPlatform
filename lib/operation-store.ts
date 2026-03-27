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

const allowedStatusTransitions: Record<DraftOperationStatus, DraftOperationStatus[]> = {
  queued: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: ['queued', 'cancelled'],
  cancelled: ['queued'],
};

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
