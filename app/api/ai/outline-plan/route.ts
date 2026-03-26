import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import { getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { generateOutlinePlanWorkflow } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { outlinePlanRequestSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/outline-plan');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = outlinePlanRequestSchema.parse(await request.json());
    context.provider = body.provider;
    context.draft_id = body.draftId;
    context.workflow_action = 'planning';

    enforceRateLimit(`planning:${user.id}`, 10, 60 * 1000, '结构共创过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'planning');

    const draft = await getDraftById(supabase, user.id, body.draftId);
    context.doc_type = draft.doc_type;
    context.workflow_stage = draft.workflow_stage;
    const { rules, references } = await loadRuleAndReferenceContext({
      supabase,
      userId: user.id,
      provider: body.provider,
      docType: draft.doc_type,
      activeRuleIds: draft.active_rule_ids,
      activeReferenceIds: draft.active_reference_ids,
      sessionReferences: body.sessionReferences,
    });

    const result = await generateOutlinePlanWorkflow({
      docType: draft.doc_type,
      provider: body.provider,
      facts: draft.collected_facts,
      rules,
      references,
    });

    const selectedPlan = result.options[0];
    const workflowStage = getAuthoritativeWorkflowStage('planning_generated');

    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: draft.title || draft.generated_title || '',
        recipient: draft.recipient || '',
        content: draft.content || '',
        issuer: draft.issuer || '',
        date: draft.date || '',
        contact_name: draft.contact_name || '',
        contact_phone: draft.contact_phone || '',
        attachments: draft.attachments,
      },
      workflow: {
        workflow_stage: workflowStage,
        collected_facts: draft.collected_facts,
        missing_fields: draft.missing_fields,
        planning: {
          options: result.options,
          selectedPlanId: selectedPlan?.planId || '',
          sections: selectedPlan?.sections || [],
          planVersion: result.planVersion,
          confirmed: false,
        },
        outline: draft.outline,
        sections: draft.sections,
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: draft.generated_title || '',
        generated_content: draft.generated_content || '',
        version_count: draft.version_count,
      },
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'planning',
      provider: body.provider,
      status: 'success',
    });

    context.workflow_stage = workflowStage;
    return ok(context, result);
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'planning',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
