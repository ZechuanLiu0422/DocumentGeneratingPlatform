import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext, resolveBaseDraftFields } from '@/lib/collaborative-route-helpers';
import { getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { runIntakeWorkflow } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { intakeSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage, getIntakeWorkflowAction } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/intake');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = intakeSchema.parse(await request.json());
    context.provider = body.provider;
    context.doc_type = body.docType;
    context.workflow_action = 'intake';
    if (body.draftId) {
      context.draft_id = body.draftId;
    }

    enforceRateLimit(`intake:${user.id}`, 15, 60 * 1000, '追问过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'intake');

    const existingDraft = body.draftId ? await getDraftById(supabase, user.id, body.draftId) : null;
    if (existingDraft?.workflow_stage) {
      context.workflow_stage = existingDraft.workflow_stage;
    }
    const { rules, references } = await loadRuleAndReferenceContext({
      supabase,
      userId: user.id,
      provider: body.provider,
      docType: body.docType,
      activeRuleIds: body.activeRuleIds,
      activeReferenceIds: body.activeReferenceIds,
      sessionReferences: body.sessionReferences,
    });

    const result = await runIntakeWorkflow({
      docType: body.docType,
      provider: body.provider,
      existingFacts: existingDraft?.collected_facts || {},
      answers: body.answers,
      message: body.message,
      rules,
      references,
    });

    const baseFields = resolveBaseDraftFields(existingDraft, body.answers, result.suggestedTitle);
    const workflowStage = getAuthoritativeWorkflowStage(getIntakeWorkflowAction(result.readiness));
    const draft = await saveDraftState(supabase, {
      userId: user.id,
      draftId: body.draftId,
      docType: body.docType,
      provider: body.provider,
      baseFields,
      workflow: {
        workflow_stage: workflowStage,
        collected_facts: result.collectedFacts,
        missing_fields: result.missingFields,
        planning: existingDraft?.planning || null,
        outline: null,
        sections: [],
        active_rule_ids: body.activeRuleIds,
        active_reference_ids: body.activeReferenceIds,
        generated_title: result.suggestedTitle,
        generated_content: '',
        version_count: existingDraft?.version_count || 0,
      },
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'intake',
      provider: body.provider,
      status: 'success',
    });

    context.draft_id = draft.id;
    context.workflow_stage = draft.workflow_stage;

    return ok(context, {
      draftId: draft.id,
      readiness: result.readiness,
      collectedFacts: result.collectedFacts,
      missingFields: result.missingFields,
      nextQuestions: result.nextQuestions,
      suggestedTitle: result.suggestedTitle,
      workflowStage: draft.workflow_stage,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'intake',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
