import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerateRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildTrustedDraftFixture, buildReviewState } from './shared-fixtures.ts';
import { createTrustJsonRequest, importTrustProjectModule, withTrustRouteModuleMocks } from './trust-contract-helpers.ts';

test('export route blocks when no persisted review_state is present', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const draftFixture = {
    ...buildTrustedDraftFixture(),
    review_state: null,
  };
  let generated = false;

  const generateModule = await withTrustRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => {
        generated = true;
        return Buffer.from('docx-binary');
      },
    },
    '@/lib/official-document-workflow': {
      computeReviewContentHash: () => 'sha256:fresh-review-hash',
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'done',
    },
  });

  const response = await generateModule.POST(createTrustJsonRequest('/api/generate', buildGenerateRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'REVIEW_REQUIRED');
  assert.equal(generated, false);
});

test('export route blocks when persisted review_state hash no longer matches accepted content', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const draftFixture = {
    ...buildTrustedDraftFixture(),
    generated_content: '当前正文已经变化，旧审校结果不再适用。特此通知',
    review_state: buildReviewState({
      content_hash: 'sha256:stale-review-hash',
    }),
  };
  let generated = false;

  const generateModule = await withTrustRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': api,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => {
        generated = true;
        return Buffer.from('docx-binary');
      },
    },
    '@/lib/official-document-workflow': {
      computeReviewContentHash: () => 'sha256:fresh-review-hash',
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'done',
    },
  });

  const response = await generateModule.POST(createTrustJsonRequest('/api/generate', buildGenerateRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'REVIEW_STALE');
  assert.equal(generated, false);
});
