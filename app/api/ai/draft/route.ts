import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { generateDraftWorkflow, regenerateSectionWorkflow } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { draftRequestSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/draft');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = draftRequestSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`draft:${user.id}`, 10, 60 * 1000, '正文生成过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'draft');

    const draft = await getDraftById(supabase, user.id, body.draftId);
    const outlineSections = draft.outline?.sections || [];
    const { rules, references } = await loadRuleAndReferenceContext({
      supabase,
      userId: user.id,
      provider: body.provider,
      docType: draft.doc_type,
      activeRuleIds: draft.active_rule_ids,
      activeReferenceIds: draft.active_reference_ids,
      sessionReferences: body.sessionReferences,
    });

    const result =
      body.mode === 'section' && body.sectionId
        ? await regenerateSectionWorkflow({
            docType: draft.doc_type,
            provider: body.provider,
            facts: draft.collected_facts,
            title: draft.generated_title || draft.title || '',
            outlineSections,
            currentSections: draft.sections,
            targetSectionId: body.sectionId,
            rules,
            references,
            attachments: draft.attachments,
          })
        : await generateDraftWorkflow({
            docType: draft.doc_type,
            provider: body.provider,
            facts: draft.collected_facts,
            title: draft.generated_title || draft.title || '',
            outlineSections,
            rules,
            references,
          attachments: draft.attachments,
        });
    const workflowStage = getAuthoritativeWorkflowStage('draft_generated');

    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: result.title || draft.title || '',
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
        sections: result.sections,
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: result.title,
        generated_content: result.content,
        version_count: draft.version_count,
      },
    });

    await createVersionSnapshot(supabase, {
      userId: user.id,
      draftId: draft.id,
      stage: 'draft_generated',
      title: result.title,
      content: result.content,
      sections: result.sections,
      changeSummary: body.mode === 'section' ? '已重写指定段落' : '已生成正文',
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'draft',
      provider: body.provider,
      status: 'success',
    });

    return ok(context, {
      title: result.title,
      content: result.content,
      sections: result.sections,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'draft',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
