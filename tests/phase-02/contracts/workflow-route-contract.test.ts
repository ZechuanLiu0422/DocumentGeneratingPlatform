import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDraftFixture,
  buildDraftRequestBody,
  buildGenerateRequestBody,
  buildIntakeRequestBody,
  buildOutlinePlanRequestBody,
  buildOutlineRequestBody,
  buildReviewRequestBody,
  buildVersionFixture,
} from './shared-fixtures.ts';
import { createJsonRequest, importProjectModule, withRouteModuleMocks } from './route-contract-helpers.ts';

function createAuthSuccess() {
  return {
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: {
          from() {
            return {
              async insert() {
                return { error: null };
              },
            };
          },
        },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
  };
}

function createCommonBoundaryStubs() {
  return {
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
      resolveBaseDraftFields: () => ({ title: '关于开展专项检查的通知' }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => buildDraftFixture(),
      saveDraftState: async () => buildDraftFixture(),
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => Buffer.from('docx-binary'),
    },
    '@/lib/official-document-workflow': {
      runIntakeWorkflow: async () => ({
        readiness: 'ready',
        collectedFacts: {},
        missingFields: [],
        nextQuestions: [],
        suggestedTitle: '关于开展专项检查的通知',
      }),
      generateOutlinePlanWorkflow: async () => ({
        options: buildDraftFixture().planning?.options || [],
        planVersion: 'plan-v1',
      }),
      hydratePlanningSectionsForOutline: (sections: unknown) => sections,
      generateOutlineWorkflow: async () => ({
        titleOptions: buildDraftFixture().outline?.titleOptions || [],
        outlineSections: buildDraftFixture().outline?.sections || [],
        risks: buildDraftFixture().outline?.risks || [],
        outlineVersion: 'outline-v1',
      }),
      generateDraftWorkflow: async () => ({
        title: buildDraftFixture().generated_title,
        content: buildDraftFixture().generated_content,
        sections: buildDraftFixture().sections,
      }),
      regenerateSectionWorkflow: async () => ({
        title: buildDraftFixture().generated_title,
        content: buildDraftFixture().generated_content,
        sections: buildDraftFixture().sections,
      }),
      reviewWorkflow: async () => [],
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
      getIntakeWorkflowAction: () => 'intake_completed',
    },
  };
}

test('workflow routes fail fast with normalized unauthorized responses', async (t) => {
  const api = await importProjectModule(t, '../../../lib/api.ts');
  const { AppError } = api;
  const authFailure = {
    '@/lib/auth': {
      requireRouteUser: async () => {
        throw new AppError(401, '请先登录', 'UNAUTHORIZED');
      },
    },
  };

  const cases = [
    ['../../../app/api/ai/intake/route.ts', createJsonRequest('/api/ai/intake', buildIntakeRequestBody())],
    ['../../../app/api/ai/outline-plan/route.ts', createJsonRequest('/api/ai/outline-plan', buildOutlinePlanRequestBody())],
    ['../../../app/api/ai/outline/route.ts', createJsonRequest('/api/ai/outline', buildOutlineRequestBody())],
    ['../../../app/api/ai/draft/route.ts', createJsonRequest('/api/ai/draft', buildDraftRequestBody())],
    ['../../../app/api/ai/review/route.ts', createJsonRequest('/api/ai/review', buildReviewRequestBody())],
    ['../../../app/api/generate/route.ts', createJsonRequest('/api/generate', buildGenerateRequestBody())],
  ] as const;

  for (const [routePath, request] of cases) {
    const module = await withRouteModuleMocks(t, routePath, {
      '@/lib/api': api,
      ...authFailure,
      ...createCommonBoundaryStubs(),
    });

    const response = await module.POST(request);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.equal(payload.code, 'UNAUTHORIZED');
    assert.equal(typeof payload.requestId, 'string');
  }
});

test('workflow routes normalize validation failures through shared route helpers', async (t) => {
  const api = await importProjectModule(t, '../../../lib/api.ts');
  const intakeModule = await withRouteModuleMocks(t, '../../../app/api/ai/intake/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
      resolveBaseDraftFields: () => ({ title: '关于开展专项检查的通知' }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => null,
      saveDraftState: async () => buildDraftFixture(),
    },
    '@/lib/official-document-workflow': {
      runIntakeWorkflow: async () => ({
        readiness: 'ready',
        collectedFacts: {},
        missingFields: [],
        nextQuestions: [],
        suggestedTitle: '关于开展专项检查的通知',
      }),
    },
  });

  const intakeResponse = await intakeModule.POST(
    createJsonRequest('/api/ai/intake', {
      ...buildIntakeRequestBody(),
      docType: 'memo',
    })
  );

  const intakePayload = await intakeResponse.json();
  assert.equal(intakeResponse.status, 400);
  assert.equal(intakePayload.code, 'VALIDATION_ERROR');
  assert.equal(typeof intakePayload.requestId, 'string');
});

test('workflow route contracts expose the expected minimum success payloads', async (t) => {
  const api = await importProjectModule(t, '../../../lib/api.ts');
  const draftFixture = buildDraftFixture();
  const versionFixture = buildVersionFixture();

  const intakeModule = await withRouteModuleMocks(t, '../../../app/api/ai/intake/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
      resolveBaseDraftFields: () => ({ title: draftFixture.title }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => null,
      saveDraftState: async () => ({ id: draftFixture.id, workflow_stage: 'planning' }),
    },
    '@/lib/official-document-workflow': {
      runIntakeWorkflow: async () => ({
        readiness: 'ready',
        collectedFacts: draftFixture.collected_facts,
        missingFields: [],
        nextQuestions: [],
        suggestedTitle: draftFixture.title,
      }),
    },
  });

  const intakePayload = await (await intakeModule.POST(createJsonRequest('/api/ai/intake', buildIntakeRequestBody()))).json();
  assert.equal(intakePayload.draftId, draftFixture.id);
  assert.equal(intakePayload.workflowStage, 'planning');

  const outlinePlanModule = await withRouteModuleMocks(t, '../../../app/api/ai/outline-plan/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
    },
    '@/lib/official-document-workflow': {
      generateOutlinePlanWorkflow: async () => ({
        options: draftFixture.planning?.options || [],
        planVersion: 'plan-v2',
      }),
    },
  });

  const outlinePlanPayload = await (await outlinePlanModule.POST(
    createJsonRequest('/api/ai/outline-plan', buildOutlinePlanRequestBody())
  )).json();
  assert.equal(outlinePlanPayload.planVersion, 'plan-v2');
  assert.equal(outlinePlanPayload.options.length, 1);

  const outlineModule = await withRouteModuleMocks(t, '../../../app/api/ai/outline/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
    },
    '@/lib/official-document-workflow': {
      hydratePlanningSectionsForOutline: (sections: unknown) => sections,
      generateOutlineWorkflow: async () => ({
        titleOptions: draftFixture.outline?.titleOptions || [],
        outlineSections: draftFixture.outline?.sections || [],
        risks: draftFixture.outline?.risks || [],
        outlineVersion: 'outline-v2',
      }),
    },
  });

  const outlinePayload = await (await outlineModule.POST(createJsonRequest('/api/ai/outline', buildOutlineRequestBody()))).json();
  assert.equal(outlinePayload.outlineVersion, 'outline-v2');
  assert.equal(outlinePayload.titleOptions[0], draftFixture.title);

  const draftModule = await withRouteModuleMocks(t, '../../../app/api/ai/draft/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
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
        sections: draftFixture.sections,
      }),
      regenerateSectionWorkflow: async () => ({
        title: draftFixture.generated_title,
        content: draftFixture.generated_content,
        sections: draftFixture.sections,
      }),
    },
  });

  const draftPayload = await (await draftModule.POST(createJsonRequest('/api/ai/draft', buildDraftRequestBody()))).json();
  assert.equal(draftPayload.title, draftFixture.generated_title);
  assert.equal(draftPayload.sections.length, 1);

  const reviewModule = await withRouteModuleMocks(t, '../../../app/api/ai/review/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/official-document-workflow': {
      reviewWorkflow: async () => [
        {
          code: 'STRUCTURE',
          status: 'pass',
          message: '结构完整',
          fixPrompt: '',
        },
      ],
    },
  });

  const reviewPayload = await (await reviewModule.POST(createJsonRequest('/api/ai/review', buildReviewRequestBody()))).json();
  assert.equal(reviewPayload.checks.length, 1);
  assert.equal(reviewPayload.checks[0].code, 'STRUCTURE');

  const generateModule = await withRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(),
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => Buffer.from('docx-binary'),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async () => draftFixture,
      createVersionSnapshot: async () => versionFixture,
    },
  });

  const generatePayload = await (await generateModule.POST(
    createJsonRequest('/api/generate', buildGenerateRequestBody())
  )).json();

  assert.equal(generatePayload.success, true);
  assert.equal(generatePayload.file_name, '关于开展专项检查的通知.docx');
  assert.equal(generatePayload.file_data, Buffer.from('docx-binary').toString('base64'));
});
