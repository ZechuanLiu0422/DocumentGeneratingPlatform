import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { buildDraftFixture, buildIntakeRequestBody } from './shared-fixtures.ts';
import { createJsonRequest, withRouteModuleMocks } from './route-contract-helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

function readProjectFile(...segments: string[]) {
  return readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('SAFE-01 harness smoke covers scripts, CI wiring, fixtures, and route helpers', async (t) => {
  const packageJson = JSON.parse(readProjectFile('package.json'));

  assert.equal(
    typeof packageJson.scripts['test:phase-02:contracts'],
    'string',
    'package.json should expose a repo-local SAFE-01 contract command'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-02:contracts:harness'],
    'string',
    'package.json should expose a focused harness smoke command'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-02:contracts:ci'],
    'string',
    'package.json should expose a CI-safe SAFE-01 command'
  );
  assert.match(packageJson.scripts['test:phase-02:contracts'], /experimental-strip-types/);
  assert.match(packageJson.scripts['test:phase-02:contracts'], /experimental-test-module-mocks/);

  const workflow = readProjectFile('.github', 'workflows', 'phase-02-safety.yml');
  assert.match(workflow, /test:phase-02:contracts:ci/);
  assert.match(workflow, /\bon:\b/);
  assert.match(workflow, /\bpull_request:\b/);
  assert.match(workflow, /\bpush:\b/);

  const intakeBody = buildIntakeRequestBody();
  assert.equal(intakeBody.docType, 'notice');
  assert.equal(intakeBody.provider, 'claude');

  const draftFixture = buildDraftFixture();
  assert.equal(draftFixture.workflow_stage, 'review');
  assert.ok(Array.isArray(draftFixture.sections));

  const request = createJsonRequest('/api/ai/intake', intakeBody);
  assert.ok(request instanceof NextRequest);
  assert.equal(await request.json(), intakeBody);

  const mocked = await withRouteModuleMocks(t, '../../../app/api/ai/intake/route.ts', {
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: 'user-harness' },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => null,
      saveDraftState: async () => ({ id: 'draft-harness', workflow_stage: 'planning' }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
      resolveBaseDraftFields: () => ({ title: '关于开展专项检查的通知' }),
    },
    '@/lib/official-document-workflow': {
      runIntakeWorkflow: async () => ({
        readiness: 'ready',
        collectedFacts: { topic: '专项检查' },
        missingFields: [],
        nextQuestions: [],
        suggestedTitle: '关于开展专项检查的通知',
      }),
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'planning',
      getIntakeWorkflowAction: () => 'intake_completed',
    },
  });

  assert.equal(typeof mocked.POST, 'function');
});
