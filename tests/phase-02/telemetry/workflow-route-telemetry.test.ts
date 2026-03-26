import test from 'node:test';
import assert from 'node:assert/strict';
import { NextResponse } from 'next/server.js';
import {
  buildDraftFixture,
  buildDraftRequestBody,
  buildGenerateRequestBody,
  buildIntakeRequestBody,
  buildOutlinePlanRequestBody,
  buildOutlineRequestBody,
  buildReviewRequestBody,
} from '../contracts/shared-fixtures.ts';
import { createJsonRequest, importProjectModule, withRouteModuleMocks } from '../contracts/route-contract-helpers.ts';

type TelemetryCall = {
  kind: 'ok' | 'error';
  context: Record<string, unknown>;
  extra: Record<string, unknown>;
  status: number;
  errorCode?: string;
};

async function createApiSpy(t: any) {
  const api = await importProjectModule(t, '../../../lib/api.ts');
  const calls: TelemetryCall[] = [];

  return {
    calls,
    module: {
      ...api,
      ok(context: Record<string, unknown>, payload: unknown, status = 200, extra: Record<string, unknown> = {}) {
        calls.push({
          kind: 'ok',
          context: { ...context },
          extra: { ...extra },
          status,
        });
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

function createCommonBoundaryStubs(draftFixture = buildDraftFixture()) {
  return {
    '@/lib/collaborative-route-helpers': {
      loadRuleAndReferenceContext: async () => ({ rules: [], references: [] }),
      resolveBaseDraftFields: () => ({ title: draftFixture.title }),
    },
    '@/lib/collaborative-store': {
      getDraftById: async () => draftFixture,
      saveDraftState: async (_supabase: unknown, payload: any) => ({
        ...draftFixture,
        id: payload.draftId || draftFixture.id,
        workflow_stage: payload.workflow.workflow_stage,
      }),
      createVersionSnapshot: async () => undefined,
    },
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => Buffer.from('docx-binary'),
    },
    '@/lib/official-document-workflow': {
      runIntakeWorkflow: async () => ({
        readiness: 'ready',
        collectedFacts: draftFixture.collected_facts,
        missingFields: [],
        nextQuestions: [],
        suggestedTitle: draftFixture.title,
      }),
      generateOutlinePlanWorkflow: async () => ({
        options: draftFixture.planning?.options || [],
        planVersion: 'plan-v2',
      }),
      hydratePlanningSectionsForOutline: (sections: unknown) => sections,
      generateOutlineWorkflow: async () => ({
        titleOptions: draftFixture.outline?.titleOptions || [],
        outlineSections: draftFixture.outline?.sections || [],
        risks: draftFixture.outline?.risks || [],
        outlineVersion: 'outline-v2',
      }),
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
      reviewWorkflow: async () => [],
      reviseWorkflow: async () => ({
        updatedContent: draftFixture.generated_content,
        updatedSections: draftFixture.sections,
        changeSummary: '已改写',
        title: draftFixture.generated_title,
      }),
    },
    '@/lib/quota': {
      enforceDailyQuota: async () => undefined,
      recordUsageEvent: async () => undefined,
    },
    '@/lib/ratelimit': {
      enforceRateLimit: () => undefined,
    },
  };
}

test('SAFE-04 workflow and export routes attach required telemetry metadata to shared API helpers', async (t) => {
  const draftFixture = buildDraftFixture();
  const cases = [
    {
      routePath: '../../../app/api/ai/intake/route.ts',
      route: '/api/ai/intake',
      body: buildIntakeRequestBody(),
      expectedAction: 'intake',
      expectedStage: 'planning',
      expectedDraftId: draftFixture.id,
      expectedDocType: 'notice',
      overrides: {},
    },
    {
      routePath: '../../../app/api/ai/outline-plan/route.ts',
      route: '/api/ai/outline-plan',
      body: buildOutlinePlanRequestBody(),
      expectedAction: 'planning',
      expectedStage: 'planning',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      overrides: {},
    },
    {
      routePath: '../../../app/api/ai/outline/route.ts',
      route: '/api/ai/outline',
      body: buildOutlineRequestBody(),
      expectedAction: 'outline',
      expectedStage: 'outline',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      overrides: {},
    },
    {
      routePath: '../../../app/api/ai/draft/route.ts',
      route: '/api/ai/draft',
      body: buildDraftRequestBody(),
      expectedAction: 'draft',
      expectedStage: 'review',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      overrides: {},
    },
    {
      routePath: '../../../app/api/ai/review/route.ts',
      route: '/api/ai/review',
      body: buildReviewRequestBody(),
      expectedAction: 'review',
      expectedStage: 'review',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      overrides: {},
    },
    {
      routePath: '../../../app/api/ai/revise/route.ts',
      route: '/api/ai/revise',
      body: {
        ...buildReviewRequestBody(),
        instruction: '请简化第三段措辞',
        targetType: 'full',
        targetId: '',
        selectedText: '',
      },
      expectedAction: 'revise',
      expectedStage: 'review',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      overrides: {},
    },
    {
      routePath: '../../../app/api/generate/route.ts',
      route: '/api/generate',
      body: buildGenerateRequestBody(),
      expectedAction: 'export',
      expectedStage: 'done',
      expectedDraftId: draftFixture.id,
      expectedDocType: draftFixture.doc_type,
      expectedExtra: { export_size_bytes: Buffer.byteLength('docx-binary') },
      overrides: {},
    },
  ] as const;

  for (const testCase of cases) {
    const apiSpy = await createApiSpy(t);
    const module = await withRouteModuleMocks(t, testCase.routePath, {
      '@/lib/api': apiSpy.module,
      ...createAuthSuccess(),
      ...createCommonBoundaryStubs(draftFixture),
      ...testCase.overrides,
    });

    const response = await module.POST(createJsonRequest(testCase.route, testCase.body));

    assert.equal(response.status, 200);
    const call = apiSpy.calls.find((entry) => entry.kind === 'ok');
    assert.ok(call, `${testCase.routePath} should call ok(...)`);
    assert.equal(call?.context.workflow_action, testCase.expectedAction);
    assert.equal(call?.context.workflow_stage, testCase.expectedStage);
    assert.equal(call?.context.draft_id, testCase.expectedDraftId);
    assert.equal(call?.context.doc_type, testCase.expectedDocType);

    if (testCase.expectedExtra) {
      assert.equal(call?.extra.export_size_bytes, testCase.expectedExtra.export_size_bytes);
    }
  }
});

test('SAFE-04 export failures preserve telemetry context for shared error logging', async (t) => {
  const draftFixture = buildDraftFixture();
  const apiSpy = await createApiSpy(t);
  const module = await withRouteModuleMocks(t, '../../../app/api/generate/route.ts', {
    '@/lib/api': apiSpy.module,
    ...createAuthSuccess(),
    ...createCommonBoundaryStubs(draftFixture),
    '@/lib/document-generator': {
      generateDocumentBuffer: async () => {
        throw new apiSpy.module.AppError(504, '提供商超时', 'AI_TIMEOUT');
      },
    },
  });

  const response = await module.POST(createJsonRequest('/api/generate', buildGenerateRequestBody()));
  const payload = await response.json();

  assert.equal(response.status, 504);
  assert.equal(payload.code, 'AI_TIMEOUT');

  const errorCall = apiSpy.calls.find((entry) => entry.kind === 'error');
  assert.ok(errorCall, 'generate route should delegate failures to handleRouteError(...)');
  assert.equal(errorCall?.context.workflow_action, 'export');
  assert.equal(errorCall?.context.workflow_stage, draftFixture.workflow_stage);
  assert.equal(errorCall?.context.draft_id, draftFixture.id);
  assert.equal(errorCall?.context.doc_type, draftFixture.doc_type);

  const shapedPayload = apiSpy.module.buildLogPayload(errorCall!.context as any, errorCall!.status, {
    error_code: errorCall!.errorCode,
  });
  assert.equal(shapedPayload.provider_failure_kind, 'timeout');
});
