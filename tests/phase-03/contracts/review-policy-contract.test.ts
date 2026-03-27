import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildReviewRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildTrustedDraftFixture } from './shared-fixtures.ts';
import { createTrustJsonRequest, importTrustProjectModule, withTrustRouteModuleMocks } from './trust-contract-helpers.ts';

function buildDocContent(docType: 'notice' | 'letter' | 'request' | 'report') {
  if (docType === 'notice') {
    return '请各单位认真落实专项检查任务，并于下周前完成自查整改。特此通知';
  }

  if (docType === 'letter') {
    return '现就联合检查安排致函贵单位，请予支持并配合有关工作。请予支持为盼';
  }

  if (docType === 'request') {
    return '现将有关情况请示如下，请批准专项检查经费安排。妥否，请批示';
  }

  return '现将近期工作进展报告如下：一是工作进展总体平稳；二是当前仍有问题；三是下一步将持续整改。特此报告';
}

function computeStubReviewHash(payload: {
  title?: string;
  content?: string;
  sections?: Array<{ id: string; heading: string; body: string }>;
}) {
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

test('review workflow exports deterministic document-type policy packs before AI augmentation', async (t) => {
  const workflow = (await importTrustProjectModule(t, '../../../lib/official-document-workflow.ts')) as Record<string, any>;

  assert.equal(typeof workflow.buildDeterministicReviewChecks, 'function');
  assert.equal(typeof workflow.computeReviewContentHash, 'function');
  assert.equal(typeof workflow.buildPersistedReviewState, 'function');

  const cases = [
    ['notice', 'notice_action_required'],
    ['letter', 'letter_cooperation_framing'],
    ['request', 'request_approval_focus'],
    ['report', 'report_progress_coverage'],
  ] as const;

  for (const [docType, expectedCode] of cases) {
    const checks = workflow.buildDeterministicReviewChecks({
      docType,
      recipient: '各相关单位',
      content: buildDocContent(docType),
      sections: buildTrustedDraftFixture().sections,
      attachments: [],
    });

    assert.ok(checks.some((check: { code: string }) => check.code === expectedCode), `${docType} should emit ${expectedCode}`);
  }
});

test('review route persists content-hash review_state and refreshes it when content changes', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  let currentDraft = {
    ...buildTrustedDraftFixture(),
    doc_type: 'notice' as const,
    generated_title: '关于开展专项检查的通知',
    generated_content: buildDocContent('notice'),
  };

  const savedStates: Array<Record<string, any>> = [];
  const savedVersions: Array<Record<string, any>> = [];

  const reviewModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/review/route.ts', {
    '@/lib/api': api,
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
      getDraftById: async () => currentDraft,
      saveDraftState: async (_supabase: unknown, payload: Record<string, any>) => {
        savedStates.push(payload);
        return currentDraft;
      },
      createVersionSnapshot: async (_supabase: unknown, payload: Record<string, any>) => {
        savedVersions.push(payload);
        return undefined;
      },
    },
    '@/lib/official-document-workflow': {
      buildPersistedReviewState: ({ docType, title, content, sections, checks }: Record<string, any>) => ({
        content_hash: computeStubReviewHash({
          title,
          content,
          sections: sections || [],
        }),
        doc_type: docType,
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

  const firstResponse = await reviewModule.POST(createTrustJsonRequest('/api/ai/review', buildReviewRequestBody()));
  const firstPayload = await firstResponse.json();

  assert.equal(firstResponse.status, 200);
  assert.equal(firstPayload.reviewState.status, 'pass');
  assert.equal(savedStates[0]?.workflow.review_state.content_hash, savedVersions[0]?.reviewState.content_hash);

  currentDraft = {
    ...currentDraft,
    generated_content: `${buildDocContent('notice')}\n请同步报送联系人名单。`,
  };

  const secondResponse = await reviewModule.POST(createTrustJsonRequest('/api/ai/review', buildReviewRequestBody()));
  const secondPayload = await secondResponse.json();

  assert.equal(secondResponse.status, 200);
  assert.notEqual(firstPayload.reviewState.content_hash, secondPayload.reviewState.content_hash);
});
