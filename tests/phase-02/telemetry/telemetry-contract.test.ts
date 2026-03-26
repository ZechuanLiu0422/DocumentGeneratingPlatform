import test from 'node:test';
import assert from 'node:assert/strict';
import { importProjectModule } from '../contracts/route-contract-helpers.ts';

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req-telemetry-1',
    route: '/api/generate',
    startedAt: performance.now() - 25,
    ip: '127.0.0.1',
    userId: '11111111-1111-4111-8111-111111111111',
    provider: 'claude',
    draft_id: '22222222-2222-4222-8222-222222222222',
    doc_type: 'notice',
    workflow_action: 'export',
    workflow_stage: 'done',
    ...overrides,
  };
}

test('SAFE-04 builds structured workflow/export telemetry payloads from shared context', async (t) => {
  const { buildLogPayload } = await importProjectModule(t, '../../../lib/api.ts');
  const payload = buildLogPayload(createContext(), 200, {
    export_size_bytes: 2048,
  });

  assert.equal(payload.level, 'info');
  assert.equal(payload.request_id, 'req-telemetry-1');
  assert.equal(payload.route, '/api/generate');
  assert.equal(payload.user_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(payload.provider, 'claude');
  assert.equal(payload.draft_id, '22222222-2222-4222-8222-222222222222');
  assert.equal(payload.doc_type, 'notice');
  assert.equal(payload.workflow_action, 'export');
  assert.equal(payload.workflow_stage, 'done');
  assert.equal(payload.export_size_bytes, 2048);
  assert.equal(typeof payload.duration_ms, 'number');
});

test('SAFE-04 classifies provider failures from existing AI error codes in structured logs', async (t) => {
  const { logRequestResult } = await importProjectModule(t, '../../../lib/api.ts');
  const originalConsoleLog = console.log;
  const entries: string[] = [];
  console.log = (entry: string) => {
    entries.push(entry);
  };

  t.after(() => {
    console.log = originalConsoleLog;
  });

  logRequestResult(
    createContext({
      route: '/api/ai/draft',
      workflow_action: 'draft',
      workflow_stage: 'review',
    }),
    502,
    {
      error_code: 'AI_AUTH_FAILED',
      message: 'provider auth failed',
    }
  );

  assert.equal(entries.length, 1);
  const payload = JSON.parse(entries[0]);
  assert.equal(payload.level, 'error');
  assert.equal(payload.route, '/api/ai/draft');
  assert.equal(payload.workflow_action, 'draft');
  assert.equal(payload.workflow_stage, 'review');
  assert.equal(payload.error_code, 'AI_AUTH_FAILED');
  assert.equal(payload.provider_failure_kind, 'auth');
});
