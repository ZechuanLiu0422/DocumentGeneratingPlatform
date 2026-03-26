import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { reviewWorkflow } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { reviewRequestSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/review');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = reviewRequestSchema.parse(await request.json());
    context.provider = body.provider;
    context.draft_id = body.draftId;
    context.workflow_action = 'review';

    enforceRateLimit(`review:${user.id}`, 8, 60 * 1000, '审校过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'review');

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

    const checks = await reviewWorkflow({
      docType: draft.doc_type,
      provider: body.provider,
      title: draft.generated_title || draft.title || '',
      recipient: draft.recipient || '',
      facts: draft.collected_facts,
      content: draft.generated_content || '',
      sections: draft.sections,
      rules,
      references,
      attachments: draft.attachments,
    });
    const workflowStage = getAuthoritativeWorkflowStage('review_applied');

    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: draft.generated_title || draft.title || '',
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
        planning: draft.planning,
        outline: draft.outline,
        sections: draft.sections,
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: draft.generated_title || draft.title || '',
        generated_content: draft.generated_content || '',
        version_count: draft.version_count,
      },
    });

    await createVersionSnapshot(supabase, {
      userId: user.id,
      draftId: draft.id,
      stage: 'review_applied',
      title: draft.generated_title || draft.title || '',
      content: draft.generated_content || '',
      sections: draft.sections,
      changeSummary: '已运行定稿检查',
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'review',
      provider: body.provider,
      status: 'success',
    });

    context.workflow_stage = workflowStage;
    return ok(context, { checks });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'review',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
