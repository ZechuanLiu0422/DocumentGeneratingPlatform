import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ZodError } from 'zod';
import {
  buildFailedOperationFixture,
  buildQueuedOperationFixture,
  buildRunningOperationFixture,
  buildSucceededOperationFixture,
} from './shared-fixtures.ts';
import {
  importOperationProjectModule,
  resolveOperationProjectPath,
} from './route-contract-helpers.ts';

test('durable-operation schemas accept legal queue rows', async () => {
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;

  assert.ok(validation.draftOperationRecordSchema, 'draftOperationRecordSchema should be exported');
  assert.ok(validation.draftOperationReadModelSchema, 'draftOperationReadModelSchema should be exported');

  for (const row of [
    buildQueuedOperationFixture(),
    buildRunningOperationFixture(),
    buildSucceededOperationFixture(),
    buildFailedOperationFixture(),
  ]) {
    const parsed = validation.draftOperationRecordSchema.parse(row);
    assert.equal(parsed.idempotency_key.length > 0, true);
    assert.equal(typeof parsed.payload, 'object');
  }
});

test('durable-operation schemas reject missing idempotency, invalid status, and malformed results', async () => {
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;
  const schema = validation.draftOperationRecordSchema;

  assert.ok(schema, 'draftOperationRecordSchema should be exported');

  assert.throws(
    () =>
      schema.parse({
        ...buildQueuedOperationFixture(),
        idempotency_key: '',
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      schema.parse({
        ...buildQueuedOperationFixture(),
        status: 'pending',
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      schema.parse({
        ...buildSucceededOperationFixture(),
        result: 'bad-result',
      }),
    (error: unknown) => error instanceof ZodError
  );
});

test('operation-store normalizes snake_case rows into a stable application shape', async (t) => {
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.normalizeDraftOperationRecord, 'function');

  const normalized = operationStore.normalizeDraftOperationRecord(
    buildSucceededOperationFixture({
      started_at: '2026-03-28T11:01:00.000Z',
      completed_at: '2026-03-28T11:03:00.000Z',
    })
  );

  assert.deepEqual(
    Object.keys(normalized).sort(),
    [
      'attemptCount',
      'completedAt',
      'createdAt',
      'draftId',
      'errorCode',
      'errorMessage',
      'id',
      'idempotencyKey',
      'lastHeartbeatAt',
      'leaseExpiresAt',
      'leaseToken',
      'maxAttempts',
      'operationType',
      'payload',
      'result',
      'startedAt',
      'status',
      'updatedAt',
      'userId',
    ].sort()
  );
  assert.equal(normalized.operationType, 'export');
  assert.equal(normalized.status, 'succeeded');
  assert.equal(normalized.idempotencyKey, 'op-export-22222222-v1');
  assert.equal(normalized.result.storagePath, 'exports/22222222-2222-4222-8222-222222222222/export.docx');

  const parsed = validation.draftOperationReadModelSchema.parse(normalized);
  assert.equal(parsed.attemptCount, 1);
});

test('operation-store exposes legal status transitions and migration contract', async (t) => {
  const operationStore = (await importOperationProjectModule(
    t,
    '../../../lib/operation-store.ts'
  )) as Record<string, any>;

  assert.equal(typeof operationStore.assertOperationStatusTransition, 'function');
  assert.doesNotThrow(() => operationStore.assertOperationStatusTransition('queued', 'running'));
  assert.doesNotThrow(() => operationStore.assertOperationStatusTransition('running', 'succeeded'));
  assert.doesNotThrow(() => operationStore.assertOperationStatusTransition('running', 'failed'));
  assert.doesNotThrow(() => operationStore.assertOperationStatusTransition('running', 'cancelled'));
  assert.throws(() => operationStore.assertOperationStatusTransition('queued', 'succeeded'));

  const migrationPath = resolveOperationProjectPath(
    'supabase',
    'migrations',
    '20260328110000_phase_04_draft_operations.sql'
  );
  assert.equal(existsSync(migrationPath), true, 'Phase 4 draft operations migration should exist');

  if (existsSync(migrationPath)) {
    const migration = readFileSync(migrationPath, 'utf8');
    assert.match(migration, /create table if not exists public\.draft_operations/i);
    assert.match(migration, /idempotency_key/i);
    assert.match(migration, /attempt_count/i);
    assert.match(migration, /lease_expires_at/i);
    assert.match(migration, /result jsonb/i);
  }
});
