import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  importOperationProjectModule,
  resolveOperationProjectPath,
} from '../contracts/route-contract-helpers.ts';

const BASE_NOW = new Date('2026-03-28T12:00:00.000Z');

class InMemoryDistributedRateLimitStore {
  private windows = new Map<string, { count: number; resetAt: string }>();

  async incrementWindow(payload: {
    userId: string;
    action: string;
    windowStart: string;
    windowMs: number;
  }) {
    const key = `${payload.userId}:${payload.action}:${payload.windowStart}`;
    const current = this.windows.get(key);
    const resetAt = new Date(new Date(payload.windowStart).getTime() + payload.windowMs).toISOString();

    if (!current) {
      const next = { count: 1, resetAt };
      this.windows.set(key, next);
      return next;
    }

    const next = { count: current.count + 1, resetAt: current.resetAt };
    this.windows.set(key, next);
    return next;
  }
}

test('distributed limiter enforces a shared window across instances', async (t) => {
  const distributedRateLimit = (await importOperationProjectModule(
    t,
    '../../../lib/distributed-ratelimit.ts'
  )) as Record<string, any>;

  assert.equal(typeof distributedRateLimit.enforceDistributedRateLimit, 'function');

  const sharedStore = new InMemoryDistributedRateLimitStore();
  const firstCall = distributedRateLimit.enforceDistributedRateLimit({
    store: sharedStore,
    userId: '11111111-1111-4111-8111-111111111111',
    action: 'draft',
    limit: 1,
    windowMs: 60_000,
    message: '正文生成过于频繁，请稍后再试',
    now: BASE_NOW,
  });

  assert.equal(typeof firstCall?.then, 'function', 'distributed limiter must be explicitly async');
  await firstCall;

  await assert.rejects(
    () =>
      distributedRateLimit.enforceDistributedRateLimit({
        store: sharedStore,
        userId: '11111111-1111-4111-8111-111111111111',
        action: 'draft',
        limit: 1,
        windowMs: 60_000,
        message: '正文生成过于频繁，请稍后再试',
        now: new Date(BASE_NOW.getTime() + 5_000),
      }),
    (error: unknown) =>
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      'message' in error &&
      (error as { code: string }).code === 'RATE_LIMITED' &&
      (error as { message: string }).message === '正文生成过于频繁，请稍后再试'
  );
});

test('distributed limiter resets cleanly after the window expires', async (t) => {
  const distributedRateLimit = (await importOperationProjectModule(
    t,
    '../../../lib/distributed-ratelimit.ts'
  )) as Record<string, any>;

  const sharedStore = new InMemoryDistributedRateLimitStore();

  await distributedRateLimit.enforceDistributedRateLimit({
    store: sharedStore,
    userId: '11111111-1111-4111-8111-111111111111',
    action: 'generate',
    limit: 1,
    windowMs: 60_000,
    message: '导出过于频繁，请稍后再试',
    now: BASE_NOW,
  });

  await assert.doesNotReject(async () => {
    await distributedRateLimit.enforceDistributedRateLimit({
      store: sharedStore,
      userId: '11111111-1111-4111-8111-111111111111',
      action: 'generate',
      limit: 1,
      windowMs: 60_000,
      message: '导出过于频繁，请稍后再试',
      now: new Date(BASE_NOW.getTime() + 61_000),
    });
  });
});

test('legacy rate-limit wrapper makes the async migration boundary explicit', async (t) => {
  const rateLimit = (await importOperationProjectModule(t, '../../../lib/ratelimit.ts')) as Record<string, any>;

  assert.equal(typeof rateLimit.enforceRateLimit, 'function');
  assert.equal(rateLimit.LEGACY_RATE_LIMIT_MODE, 'process-local');
  assert.match(rateLimit.LEGACY_RATE_LIMIT_MIGRATION_GUIDANCE, /await enforceDistributedRateLimit/);

  const legacySource = readFileSync(resolveOperationProjectPath('lib', 'ratelimit.ts'), 'utf8');
  assert.match(legacySource, /await enforceDistributedRateLimit/);
});

test('distributed limiter migration exists with a persistent window contract', async () => {
  const migrationPath = resolveOperationProjectPath(
    'supabase',
    'migrations',
    '20260328111500_phase_04_rate_limit_windows.sql'
  );

  assert.equal(existsSync(migrationPath), true, 'rate-limit window migration should exist');

  if (existsSync(migrationPath)) {
    const migration = readFileSync(migrationPath, 'utf8');
    assert.match(migration, /create table if not exists public\.rate_limit_windows/i);
    assert.match(migration, /user_id/i);
    assert.match(migration, /action/i);
    assert.match(migration, /window_start/i);
    assert.match(migration, /unique\s*\(\s*user_id\s*,\s*action\s*,\s*window_start\s*\)/i);
  }
});
