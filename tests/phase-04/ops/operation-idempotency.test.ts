import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQueuedOperationFixture, buildRunningOperationFixture } from '../contracts/shared-fixtures.ts';
import { importOperationProjectModule } from '../contracts/route-contract-helpers.ts';

const BASE_NOW = new Date('2026-03-28T12:10:00.000Z');

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

test('operation completion is idempotent and only invokes the authoritative side effect once', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.markOperationSucceeded, 'function');

  const running = buildRunningOperationFixture({
    result: null,
    error_code: null,
    error_message: null,
    lease_token: 'lease-idempotent-01',
    updated_at: BASE_NOW.toISOString(),
    started_at: BASE_NOW.toISOString(),
  });
  const store = new InMemoryLeaseStore([running]);
  let completionSideEffects = 0;

  const firstCompletion = await operationStore.markOperationSucceeded({
    store,
    operationId: running.id,
    leaseToken: 'lease-idempotent-01',
    result: { artifactId: 'artifact-01' },
    now: new Date(BASE_NOW.getTime() + 5_000),
    onComplete: async () => {
      completionSideEffects += 1;
    },
  });

  assert.equal(firstCompletion.status, 'succeeded');
  assert.equal(completionSideEffects, 1);

  const secondCompletion = await operationStore.markOperationSucceeded({
    store,
    operationId: running.id,
    leaseToken: 'lease-idempotent-01',
    result: { artifactId: 'artifact-02' },
    now: new Date(BASE_NOW.getTime() + 10_000),
    onComplete: async () => {
      completionSideEffects += 1;
    },
  });

  assert.equal(secondCompletion.status, 'succeeded');
  assert.deepEqual(secondCompletion.result, { artifactId: 'artifact-01' });
  assert.equal(completionSideEffects, 1);
});

test('duplicate idempotency inserts reuse the existing durable operation instead of failing', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.createDraftOperation, 'function');

  const existing = buildQueuedOperationFixture();
  const duplicateError = new Error('duplicate key value violates unique constraint "idx_draft_operations_user_idempotency"') as Error & {
    code?: string;
  };
  duplicateError.code = '23505';

  const supabase = {
    from(table: string) {
      assert.equal(table, 'draft_operations');

      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return {
                    data: null,
                    error: duplicateError,
                  };
                },
              };
            },
          };
        },
        select() {
          return {
            eq(_column: string, _value: string) {
              return this;
            },
            async single() {
              return {
                data: existing,
                error: null,
              };
            },
          };
        },
      };
    },
  };

  const created = await operationStore.createDraftOperation(supabase as any, {
    user_id: existing.user_id,
    draft_id: existing.draft_id,
    operation_type: existing.operation_type,
    idempotency_key: existing.idempotency_key,
    payload: existing.payload,
  });

  assert.equal(created.id, existing.id);
  assert.equal(created.status, 'queued');
  assert.equal(created.idempotencyKey, existing.idempotency_key);
});

test('retryable failures requeue work until max attempts are exhausted', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.markOperationFailed, 'function');

  const store = new InMemoryLeaseStore([
    buildRunningOperationFixture({
      lease_token: 'lease-retry-01',
      attempt_count: 1,
      max_attempts: 3,
      updated_at: BASE_NOW.toISOString(),
    }),
  ]);

  const requeued = await operationStore.markOperationFailed({
    store,
    operationId: '77777777-7777-4777-8777-777777777777',
    leaseToken: 'lease-retry-01',
    errorCode: 'AI_TIMEOUT',
    errorMessage: 'temporary provider timeout',
    retryable: true,
    now: new Date(BASE_NOW.getTime() + 5_000),
  });

  assert.equal(requeued.status, 'queued');
  assert.equal(requeued.leaseToken, null);
  assert.equal(requeued.completedAt, null);

  const exhaustedStore = new InMemoryLeaseStore([
    buildRunningOperationFixture({
      lease_token: 'lease-retry-02',
      attempt_count: 3,
      max_attempts: 3,
      updated_at: BASE_NOW.toISOString(),
    }),
  ]);

  const failed = await operationStore.markOperationFailed({
    store: exhaustedStore,
    operationId: '77777777-7777-4777-8777-777777777777',
    leaseToken: 'lease-retry-02',
    errorCode: 'AI_TIMEOUT',
    errorMessage: 'temporary provider timeout',
    retryable: true,
    now: new Date(BASE_NOW.getTime() + 5_000),
  });

  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'AI_TIMEOUT');
});
