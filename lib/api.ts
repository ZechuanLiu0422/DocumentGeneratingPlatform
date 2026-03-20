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

function normalizeError(error: unknown) {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(400, error.issues[0]?.message || '请求参数不正确', 'VALIDATION_ERROR');
  }

  return new AppError(500, '系统繁忙，请稍后重试', 'INTERNAL_ERROR');
}

export function logRequestResult(
  context: RequestContext,
  status: number,
  extra: Record<string, unknown> = {}
) {
  const durationMs = Math.round(performance.now() - Number(context.startedAt || 0));

  console.log(
    JSON.stringify({
      level: status >= 500 ? 'error' : 'info',
      request_id: context.requestId,
      route: context.route,
      user_id: context.userId,
      provider: context.provider,
      ip: context.ip,
      status,
      duration_ms: durationMs,
      ...extra,
    })
  );
}

export function handleRouteError(error: unknown, context: RequestContext) {
  const normalized = normalizeError(error);
  logRequestResult(context, normalized.status, { code: normalized.code, message: normalized.message });

  return NextResponse.json(
    {
      error: normalized.message,
      code: normalized.code,
      requestId: context.requestId,
    },
    { status: normalized.status }
  );
}

export function ok<T>(context: RequestContext, payload: T, status = 200) {
  logRequestResult(context, status);
  return NextResponse.json(payload, { status });
}
