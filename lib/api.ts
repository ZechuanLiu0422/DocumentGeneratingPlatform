import { performance } from 'perf_hooks';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

export type RequestContext = {
  requestId: string;
  route: string;
  startedAt: number;
  ip: string;
  [key: string]: unknown;
};

type RequestLogExtra = Record<string, unknown>;

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = 'APP_ERROR') {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

export function assertOrThrow(condition: unknown, status: number, message: string, code?: string): asserts condition {
  if (!condition) {
    throw new AppError(status, message, code);
  }
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function createRequestContext(request: NextRequest, route: string, meta: Record<string, unknown> = {}): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    route,
    startedAt: performance.now(),
    ip: getClientIp(request),
    ...meta,
  };
}

function isSchemaMismatchError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };

  const rawText = [candidate.message, candidate.details, candidate.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const knownSchemaMarkers = [
    'workflow_stage',
    'collected_facts',
    'missing_fields',
    'active_rule_ids',
    'active_reference_ids',
    'generated_title',
    'generated_content',
    'review_state',
    'pending_change',
    'planning',
    'drafts_workflow_stage_check',
    'document_versions',
    'writing_rules',
    'reference_assets',
    'usage_events_action_check',
    'draft_generated',
    'outline_confirmed',
    'review_applied',
  ];

  return (
    ['42703', '42P01', '42883'].includes(candidate.code || '') ||
    knownSchemaMarkers.some((marker) => rawText.includes(marker))
  );
}

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, error.issues[0]?.message || '请求参数不正确', 'VALIDATION_ERROR');
  }

  if (isSchemaMismatchError(error)) {
    return new AppError(
      500,
      '数据库结构未完成升级，请执行最新 Supabase migrations（至少包含 20260321110000_collaborative_writing_upgrade.sql、20260323150000_outline_planning_upgrade.sql、20260327173000_phase_03_review_state_jsonb.sql 和 20260327180000_phase_03_pending_change_jsonb.sql）后重试',
      'SCHEMA_OUTDATED'
    );
  }

  return new AppError(500, '系统繁忙，请稍后重试', 'INTERNAL_ERROR');
}

function pickContextValue(context: RequestContext, camelKey: string, snakeKey = camelKey) {
  return context[camelKey] ?? context[snakeKey];
}

function normalizeLogExtra(extra: RequestLogExtra) {
  const normalized = { ...extra };

  if (typeof normalized.code === 'string' && typeof normalized.error_code !== 'string') {
    normalized.error_code = normalized.code;
  }

  delete normalized.code;
  return normalized;
}

export function classifyProviderFailure(errorCode: unknown) {
  switch (errorCode) {
    case 'AI_AUTH_FAILED':
      return 'auth';
    case 'AI_RATE_LIMITED':
      return 'rate_limit';
    case 'AI_TIMEOUT':
      return 'timeout';
    case 'AI_REQUEST_FAILED':
      return 'request_failed';
    default:
      return undefined;
  }
}

export function buildLogPayload(
  context: RequestContext,
  status: number,
  extra: RequestLogExtra = {}
) {
  const durationMs = Math.round(performance.now() - Number(context.startedAt || 0));
  const normalizedExtra = normalizeLogExtra(extra);
  const errorCode = normalizedExtra.error_code;
  const providerFailureKind = classifyProviderFailure(errorCode);

  return {
    level: status >= 500 ? 'error' : 'info',
    request_id: context.requestId,
    route: context.route,
    user_id: pickContextValue(context, 'userId', 'user_id'),
    provider: pickContextValue(context, 'provider'),
    ip: context.ip,
    status,
    duration_ms: durationMs,
    draft_id: pickContextValue(context, 'draftId', 'draft_id'),
    doc_type: pickContextValue(context, 'docType', 'doc_type'),
    workflow_action: pickContextValue(context, 'workflowAction', 'workflow_action'),
    workflow_stage: pickContextValue(context, 'workflowStage', 'workflow_stage'),
    operation_id: pickContextValue(context, 'operationId', 'operation_id'),
    operation_status: pickContextValue(context, 'operationStatus', 'operation_status'),
    attempt_count: pickContextValue(context, 'attemptCount', 'attempt_count'),
    lease_token: pickContextValue(context, 'leaseToken', 'lease_token'),
    ...normalizedExtra,
    provider_failure_kind: normalizedExtra.provider_failure_kind ?? providerFailureKind,
  };
}

export function logRequestResult(
  context: RequestContext,
  status: number,
  extra: RequestLogExtra = {}
) {
  console.log(JSON.stringify(buildLogPayload(context, status, extra)));
}

export function handleRouteError(error: unknown, context: RequestContext, extra: RequestLogExtra = {}) {
  const normalized = normalizeError(error);
  logRequestResult(context, normalized.status, {
    ...extra,
    error_code: normalized.code,
    message: normalized.message,
  });

  return NextResponse.json(
    {
      error: normalized.message,
      code: normalized.code,
      requestId: context.requestId,
    },
    { status: normalized.status }
  );
}

export function ok<T>(context: RequestContext, payload: T, status = 200, extra: RequestLogExtra = {}) {
  logRequestResult(context, status, extra);
  return NextResponse.json(payload, { status });
}
