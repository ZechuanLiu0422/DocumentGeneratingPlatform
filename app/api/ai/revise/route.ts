import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { reviseWorkflow } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { reviseRequestSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/revise');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = reviseRequestSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`revise:${user.id}`, 12, 60 * 1000, '改写过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'refine');

    const draft = await getDraftById(supabase, user.id, body.draftId);
    const { rules, references } = await loadRuleAndReferenceContext({
      supabase,
      userId: user.id,
      provider: body.provider,
      docType: draft.doc_type,
      activeRuleIds: draft.active_rule_ids,
      activeReferenceIds: draft.active_reference_ids,
      sessionReferences: body.sessionReferences,
    });

    const result = await reviseWorkflow({
      docType: draft.doc_type,
      provider: body.provider,
      facts: draft.collected_facts,
      title: draft.generated_title || draft.title || '',
      sections: draft.sections,
      instruction: body.instruction,
      targetType: body.targetType,
      targetId: body.targetId || undefined,
      selectedText: body.selectedText || undefined,
      rules,
      references,
    });

    const nextTitle = result.title || draft.generated_title || draft.title || '';
    const workflowStage = getAuthoritativeWorkflowStage('revision_applied');
    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: nextTitle,
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
        sections: result.updatedSections,
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: nextTitle,
        generated_content: result.updatedContent,
        version_count: draft.version_count,
      },
    });

    await createVersionSnapshot(supabase, {
      userId: user.id,
      draftId: draft.id,
      stage: 'revision_applied',
      title: nextTitle,
      content: result.updatedContent,
      sections: result.updatedSections,
      changeSummary: result.changeSummary,
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'refine',
      provider: body.provider,
      status: 'success',
    });

    return ok(context, {
      updatedContent: result.updatedContent,
      updatedSections: result.updatedSections,
      changeSummary: result.changeSummary,
      title: nextTitle,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'refine',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
