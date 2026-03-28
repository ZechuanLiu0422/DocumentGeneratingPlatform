import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import { buildRunningOperationFixture } from '../contracts/shared-fixtures.ts';
import { importOperationProjectModule, withOperationRouteModuleMocks } from '../contracts/route-contract-helpers.ts';

type TelemetryCall = {
  kind: 'ok' | 'error';
  context: Record<string, unknown>;
  extra: Record<string, unknown>;
  status: number;
  errorCode?: string;
};

function toOperationReadModel(row: ReturnType<typeof buildRunningOperationFixture>) {
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

async function createApiSpy(t: any) {
  const api = await importOperationProjectModule(t, '../../../lib/api.ts');
  const calls: TelemetryCall[] = [];

  return {
    calls,
    module: {
      ...api,
      ok(context: Record<string, unknown>, payload: unknown, status = 200, extra: Record<string, unknown> = {}) {
        calls.push({ kind: 'ok', context: { ...context }, extra: { ...extra }, status });
        return NextResponse.json(payload, { status });
      },
      handleRouteError(error: unknown, context: Record<string, unknown>, extra: Record<string, unknown> = {}) {
        const normalized =
          error instanceof api.AppError ? error : new api.AppError(500, '系统繁忙，请稍后重试', 'INTERNAL_ERROR');

        calls.push({
          kind: 'error',
          context: { ...context },
          extra: { ...extra },
          status: normalized.status,
          errorCode: normalized.code,
        });

        return NextResponse.json(
          {
            error: normalized.message,
            code: normalized.code,
            requestId: context.requestId,
          },
          { status: normalized.status }
        );
      },
    },
  };
}

test('operation status route emits operation lifecycle metadata through shared telemetry logging', async (t) => {
  const apiSpy = await createApiSpy(t);
  const operation = toOperationReadModel(
    buildRunningOperationFixture({
      operation_type: 'draft_revise',
      attempt_count: 2,
    })
  );

  const routeModule = await withOperationRouteModuleMocks(t, '../../../app/api/operations/[id]/route.ts', {
    '@/lib/api': apiSpy.module,
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
        throw new Error('running operation should not hydrate draft state');
      },
    },
    '@/lib/draft-save': await importOperationProjectModule(t, '../../../lib/draft-save.ts'),
  });

  const response = await routeModule.GET(new Request(`http://localhost/api/operations/${operation.id}`, { method: 'GET' }), {
    params: Promise.resolve({ id: operation.id }),
  });
  assert.equal(response.status, 200);

  const call = apiSpy.calls.find((entry) => entry.kind === 'ok');
  assert.ok(call);

  const payload = apiSpy.module.buildLogPayload(call!.context as any, call!.status, call!.extra);
  assert.equal(payload.route, `/api/operations/${operation.id}`);
  assert.equal(payload.workflow_action, 'operation_status');
  assert.equal(payload.operation_id, operation.id);
  assert.equal(payload.operation_status, 'running');
  assert.equal(payload.attempt_count, 2);
});
