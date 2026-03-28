import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQueuedOperationFixture } from '../contracts/shared-fixtures.ts';
import {
  createOperationJsonRequest,
  importOperationProjectModule,
  resolveOperationProjectPath,
  withOperationRouteModuleMocks,
} from '../contracts/route-contract-helpers.ts';

const BASE_NOW = new Date('2026-03-28T12:20:00.000Z');

class InMemoryLeaseStore {
  operations = new Map<string, any>();

  constructor(rows: Array<Record<string, unknown>>) {
    for (const row of rows) {
      this.operations.set(row.id, {
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
      });
    }
  }

  async listOperations() {
    return Array.from(this.operations.values()).map((row) => ({ ...row }));
  }

  async getOperation(operationId: string) {
    const current = this.operations.get(operationId);
    return current ? { ...current } : null;
  }

  async compareAndSetOperation(input: {
    operationId: string;
    expectedStatus?: string;
    expectedUpdatedAt?: string;
    expectedLeaseToken?: string | null;
    patch: Record<string, unknown>;
  }) {
    const current = this.operations.get(input.operationId);

    if (!current) {
      return null;
    }

    if (input.expectedStatus && current.status !== input.expectedStatus) {
      return null;
    }

    if (input.expectedUpdatedAt && current.updatedAt !== input.expectedUpdatedAt) {
      return null;
    }

    if (input.expectedLeaseToken !== undefined && current.leaseToken !== input.expectedLeaseToken) {
      return null;
    }

    const next = {
      ...current,
      ...input.patch,
      updatedAt: typeof input.patch.updatedAt === 'string' ? input.patch.updatedAt : current.updatedAt,
    };

    this.operations.set(input.operationId, next);
    return { ...next };
  }
}

test('drainOperationQueue moves queued work to a terminal state without a manual retry', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.drainOperationQueue, 'function');
  assert.equal(typeof operationStore.triggerOperationRunnerKick, 'function');
  assert.equal(operationStore.OPERATION_RUNNER_PATH, '/api/operations/run');

  const store = new InMemoryLeaseStore([
    buildQueuedOperationFixture({
      operation_type: 'export',
      payload: {
        draftId: '22222222-2222-4222-8222-222222222222',
        exportFormat: 'docx',
      },
    }),
  ]);

  const summary = await operationStore.drainOperationQueue({
    store,
    runnerId: 'runner-drain',
    now: BASE_NOW,
    leaseMs: 60_000,
    maxOperations: 5,
    execute: async (operation: { id: string; payload: Record<string, unknown> }) => ({
      artifactId: `${operation.id}-artifact`,
      payloadEcho: operation.payload,
    }),
  });

  assert.deepEqual(summary, {
    claimed: 1,
    completed: 1,
    failed: 0,
    requeued: 0,
  });

  const drained = await store.getOperation('77777777-7777-4777-8777-777777777777');
  assert.equal(drained?.status, 'succeeded');
  assert.deepEqual(drained?.result, {
    artifactId: '77777777-7777-4777-8777-777777777777-artifact',
    payloadEcho: {
      draftId: '22222222-2222-4222-8222-222222222222',
      exportFormat: 'docx',
    },
  });
});

test('runner route is protected and drains queued work through the shared coordinator', async (t) => {
  process.env.OPERATION_RUNNER_SECRET = 'phase-04-secret';

  const routeModule = (await withOperationRouteModuleMocks(t, '../../../app/api/operations/run/route.ts', {
    '@/lib/operation-store': {
      drainOperationQueue: async () => ({
        claimed: 1,
        completed: 1,
        failed: 0,
        requeued: 0,
      }),
      createSupabaseOperationLeaseStore: () => ({ mocked: true }),
      OPERATION_RUNNER_PATH: '/api/operations/run',
      OPERATION_RUNNER_SELF_KICK_HEADER: 'x-operation-runner-self-kick',
    },
    '@supabase/supabase-js': {
      createClient: () => ({ mocked: true }),
    },
  })) as Record<string, any>;

  const unauthorized = await routeModule.POST(
    createOperationJsonRequest('/api/operations/run', {}, {
      headers: {
        authorization: 'Bearer wrong-secret',
      },
    })
  );
  assert.equal(unauthorized.status, 401);

  const authorized = await routeModule.POST(
    createOperationJsonRequest('/api/operations/run', {}, {
      headers: {
        authorization: 'Bearer phase-04-secret',
      },
    })
  );

  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {
    ok: true,
    drain: {
      claimed: 1,
      completed: 1,
      failed: 0,
      requeued: 0,
    },
    runnerPath: '/api/operations/run',
  });
});

test('vercel scheduler and runner source make the recovery and immediate self-kick contract explicit', async () => {
  const vercelConfig = JSON.parse(readFileSync(resolveOperationProjectPath('vercel.json'), 'utf8'));
  assert.ok(Array.isArray(vercelConfig.crons), 'vercel.json should declare cron entries');
  assert.ok(
    vercelConfig.crons.some(
      (entry: { path?: string; schedule?: string }) =>
        entry.path === '/api/operations/run' && typeof entry.schedule === 'string'
    ),
    'runner cron should target /api/operations/run'
  );

  const operationStoreSource = readFileSync(resolveOperationProjectPath('lib', 'operation-store.ts'), 'utf8');
  assert.match(operationStoreSource, /OPERATION_RUNNER_PATH/);
  assert.match(operationStoreSource, /triggerOperationRunnerKick/);

  const runnerRouteSource = readFileSync(resolveOperationProjectPath('app', 'api', 'operations', 'run', 'route.ts'), 'utf8');
  assert.match(runnerRouteSource, /OPERATION_RUNNER_SELF_KICK_HEADER/);
});
