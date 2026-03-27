import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import { buildGenerateRequestBody, buildReviewRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildReviewState, buildTrustedDraftFixture } from '../contracts/shared-fixtures.ts';
import { createTrustJsonRequest, importTrustProjectModule, withTrustRouteModuleMocks } from '../contracts/trust-contract-helpers.ts';

type TelemetryCall = {
  kind: 'ok' | 'error';
  context: Record<string, unknown>;
  extra: Record<string, unknown>;
  status: number;
  errorCode?: string;
};

async function createApiSpy(t: any) {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
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

test('review route emits review_hash and review_status through shared telemetry success logging', async (t) => {
  const apiSpy = await createApiSpy(t);
  const draftFixture = buildTrustedDraftFixture();

  const reviewModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/review/route.ts', {
    '@/lib/api': apiSpy.module,
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/official-document-workflow': {
      buildPersistedReviewState: ({ checks }: Record<string, any>) => ({
        content_hash: 'sha256:review-route-hash',
        doc_type: 'notice',
        status: checks.some((check: { status: string }) => check.status === 'fail')
          ? 'fail'
          : checks.some((check: { status: string }) => check.status === 'warning')
            ? 'warning'
            : 'pass',
        ran_at: '2026-03-27T18:00:00.000Z',
        checks,
      }),
      reviewWorkflow: async () => [
        {
          code: 'notice_action_required',
          status: 'pass',
          message: '正文包含明确工作要求。',
          fixPrompt: '',
        },
      ],
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
    '@/lib/workflow-stage': {
      getAuthoritativeWorkflowStage: () => 'review',
    },
  });

  const response = await reviewModule.POST(createTrustJsonRequest('/api/ai/review', buildReviewRequestBody()));
  assert.equal(response.status, 200);

  const call = apiSpy.calls.find((entry) => entry.kind === 'ok');
  assert.ok(call);
  assert.equal(call?.context.workflow_action, 'review');
  assert.equal(typeof call?.extra.review_hash, 'string');
  assert.equal(call?.extra.review_status, 'pass');
});

test('export route emits stale review metadata through shared telemetry error logging', async (t) => {
  const apiSpy = await createApiSpy(t);
  const draftFixture = {
    ...buildTrustedDraftFixture(),
    review_state: buildReviewState({
      content_hash: 'sha256:stale-review-hash',
      status: 'warning',
    }),
  };

  const generateModule = await withTrustRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': apiSpy.module,
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
      generateDocumentBuffer: async () => Buffer.from('docx-binary'),
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
  assert.equal(response.status, 409);

  const call = apiSpy.calls.find((entry) => entry.kind === 'error');
  assert.ok(call);
  assert.equal(call?.context.workflow_action, 'export');
  assert.equal(call?.errorCode, 'REVIEW_STALE');
  assert.equal(call?.extra.review_hash, 'sha256:stale-review-hash');
  assert.equal(call?.extra.review_status, 'warning');
});
