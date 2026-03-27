import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDraftRequestBody } from '../../phase-02/contracts/shared-fixtures.ts';
import { buildSectionSourceRef, buildTrustedDraftFixture, buildTrustedSection } from './shared-fixtures.ts';
import { createTrustJsonRequest, importTrustProjectModule, withTrustRouteModuleMocks } from './trust-contract-helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

function createAuthSuccess() {
  return {
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
  };
}

function buildGroundedDraftSections() {
  return [
    buildTrustedSection(),
    buildTrustedSection({
      id: 'draft-sec-2',
      heading: '二、工作安排',
      body: '请于本周五前提交整改清单。',
      provenance: {
        summary: '第二段依据专项检查时间安排整理。',
        sources: [
          buildSectionSourceRef({
            label: '专项检查时间安排',
            excerpt: '请于本周五前提交整改清单，并同步反馈整改计划。',
            reason: '支持第二段的时限要求。',
          }),
        ],
      },
    }),
  ];
}

test('draft route returns provenance-bearing sections and persists them for full and section generation', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const draftFixture = buildTrustedDraftFixture();
  const persistedPayloads: Array<Record<string, unknown>> = [];

  const draftModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({
        rules: [],
        references: [
          {
            id: '44444444-4444-4444-8444-444444444444',
            user_id: draftFixture.user_id,
            name: '专项检查工作指引',
            doc_type: 'notice',
            file_name: 'notice-guide.docx',
            file_type: 'application/docx',
            content: '发文应先说明背景，再明确任务与时间要求。',
            analysis: null,
            is_favorite: false,
          },
        ],
      }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async (_supabase: unknown, payload: Record<string, unknown>) => {
        persistedPayloads.push(payload);
        return draftFixture;
      },
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: draftFixture.generated_content,
        sections: buildGroundedDraftSections(),
      }),
      regenerateSectionWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: draftFixture.generated_content,
        sections: buildGroundedDraftSections(),
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
      getAuthoritativeWorkflowStage: () => 'review',
    },
  });

  const fullResponse = await draftModule.POST(createTrustJsonRequest('/api/ai/draft', buildDraftRequestBody()));
  const fullPayload = await fullResponse.json();

  assert.equal(fullResponse.status, 200);
  assert.equal(fullPayload.sections[0].provenance.sources.length, 1);
  assert.equal(
    (persistedPayloads[0]?.workflow as Record<string, any>).sections[1].provenance.sources[0].label,
    '专项检查时间安排'
  );

  const sectionResponse = await draftModule.POST(
    createTrustJsonRequest('/api/ai/draft', {
      ...buildDraftRequestBody(),
      mode: 'section',
      sectionId: 'draft-sec-2',
    })
  );
  const sectionPayload = await sectionResponse.json();

  assert.equal(sectionResponse.status, 200);
  assert.equal(sectionPayload.sections[1].provenance.sources[0].label, '专项检查时间安排');
  assert.equal(sectionPayload.sections[0].id, 'draft-sec-1');
});

test('draft route rejects grounded claims when no approved evidence context is active', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const draftFixture = buildTrustedDraftFixture();

  const draftModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/official-document-workflow': {
      generateDraftWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: draftFixture.generated_content,
        sections: buildGroundedDraftSections(),
      }),
      regenerateSectionWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: draftFixture.generated_content,
        sections: buildGroundedDraftSections(),
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
      getAuthoritativeWorkflowStage: () => 'review',
    },
  });

  const response = await draftModule.POST(createTrustJsonRequest('/api/ai/draft', buildDraftRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, 'GROUNDING_CONTEXT_REQUIRED');
});

test('workflow source no longer treats all references as a generic undifferentiated dump', () => {
  const workflowSource = readFileSync(path.join(projectRoot, 'lib', 'official-document-workflow.ts'), 'utf8');

  assert.match(workflowSource, /provenance/i);
  assert.match(workflowSource, /selected evidence|grounded/i);
});
