import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQueuedOperationFixture,
  buildStaleLeaseOperationFixture,
} from '../contracts/shared-fixtures.ts';
import {
  importOperationProjectModule,
} from '../contracts/route-contract-helpers.ts';

const BASE_NOW = new Date('2026-03-28T12:00:00.000Z');

class InMemoryLeaseStore {
  operations = new Map<string, any>();

  constructor(rows: Array<Record<string, unknown>>) {
    for (const row of rows) {
      const normalized = this.normalizeRow(row);
      this.operations.set(normalized.id, normalized);
    }
  }

  normalizeRow(row: Record<string, unknown>) {
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

test('queued operations can be claimed once and heartbeated while work continues', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.claimNextOperation, 'function');
  assert.equal(typeof operationStore.heartbeatOperation, 'function');

  const store = new InMemoryLeaseStore([buildQueuedOperationFixture()]);
  const claimed = await operationStore.claimNextOperation({
    store,
    runnerId: 'runner-a',
    now: BASE_NOW,
    leaseMs: 60_000,
  });

  assert.ok(claimed, 'a queued operation should be claimable');
  assert.equal(claimed.status, 'running');
  assert.equal(claimed.attemptCount, 1);
  assert.equal(typeof claimed.leaseToken, 'string');
  assert.equal(claimed.startedAt, BASE_NOW.toISOString());

  const heartbeated = await operationStore.heartbeatOperation({
    store,
    operationId: claimed.id,
    leaseToken: claimed.leaseToken,
    now: new Date(BASE_NOW.getTime() + 30_000),
    leaseMs: 60_000,
  });

  assert.equal(heartbeated.status, 'running');
  assert.equal(heartbeated.lastHeartbeatAt, '2026-03-28T12:00:30.000Z');
  assert.equal(heartbeated.leaseExpiresAt, '2026-03-28T12:01:30.000Z');

  const secondClaim = await operationStore.claimNextOperation({
    store,
    runnerId: 'runner-b',
    now: new Date(BASE_NOW.getTime() + 31_000),
    leaseMs: 60_000,
  });

  assert.equal(secondClaim, null, 'active lease should prevent a second claim');
});

test('expired leases can be reclaimed without allowing the stale runner to finalize the operation', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  const stale = buildStaleLeaseOperationFixture();
  const store = new InMemoryLeaseStore([stale]);
  const reclaimed = await operationStore.claimNextOperation({
    store,
    runnerId: 'runner-b',
    now: BASE_NOW,
    leaseMs: 60_000,
  });

  assert.ok(reclaimed, 'stale lease should be reclaimable');
  assert.notEqual(reclaimed.leaseToken, stale.lease_token);
  assert.equal(reclaimed.attemptCount, stale.attempt_count + 1);

  await assert.rejects(
    () =>
      operationStore.markOperationSucceeded({
        store,
        operationId: reclaimed.id,
        leaseToken: stale.lease_token,
        result: { ok: false },
        now: new Date(BASE_NOW.getTime() + 5_000),
      }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'STALE_OPERATION_LEASE'
  );

  const succeeded = await operationStore.markOperationSucceeded({
    store,
    operationId: reclaimed.id,
    leaseToken: reclaimed.leaseToken,
    result: { ok: true },
    now: new Date(BASE_NOW.getTime() + 5_000),
  });

  assert.equal(succeeded.status, 'succeeded');
  assert.deepEqual(succeeded.result, { ok: true });
});
