import { NextRequest } from 'next/server';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import { type PlanningSectionRecord, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { generateOutlineWorkflow, hydratePlanningSectionsForOutline } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { draftPlanningSectionSchema, outlineRequestSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/outline');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = outlineRequestSchema.parse(await request.json());
    context.provider = body.provider;
    context.draft_id = body.draftId;
    context.workflow_action = 'outline';

    enforceRateLimit(`outline:${user.id}`, 10, 60 * 1000, '提纲生成过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'outline');

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

    const confirmedPlanSections = body.confirmedPlan?.sections?.length
      ? body.confirmedPlan.sections
      : draft.planning?.sections?.length
        ? (() => {
            const parsed = draftPlanningSectionSchema.array().min(1).max(8).safeParse(draft.planning.sections);
            if (!parsed.success) {
              throw new AppError(
                400,
                '当前结构方案还有未填写完整的段落，请先补全每段的段落标题和本段内容后再生成正式提纲',
                'PLANNING_INCOMPLETE'
              );
            }

            return parsed.data;
          })()
        : [];

    const normalizedPlanSections = confirmedPlanSections.length
      ? (() => {
          const incompleteSections = confirmedPlanSections.filter(
            (section) => !section.headingDraft?.trim() || !section.topicSummary?.trim()
          );

          if (incompleteSections.length > 0) {
            throw new AppError(
              400,
              '当前结构方案还有未填写完整的段落，请先补全每段的段落标题和本段内容后再生成正式提纲',
              'PLANNING_INCOMPLETE'
            );
          }

          return hydratePlanningSectionsForOutline(confirmedPlanSections);
        })()
      : [];

    const result = await generateOutlineWorkflow({
      docType: draft.doc_type,
      provider: body.provider,
      facts: draft.collected_facts,
      confirmedPlan: normalizedPlanSections.length
        ? {
            selectedPlanId: body.confirmedPlan?.selectedPlanId || draft.planning?.selectedPlanId || '',
            sections: normalizedPlanSections as PlanningSectionRecord[],
          }
        : null,
      rules,
      references,
    });
    const workflowStage = getAuthoritativeWorkflowStage('outline_generated');

    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: draft.title || result.titleOptions[0] || draft.generated_title || '',
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
        planning: draft.planning
          ? {
              ...draft.planning,
              selectedPlanId: body.confirmedPlan?.selectedPlanId || draft.planning.selectedPlanId || '',
              sections: normalizedPlanSections.length ? normalizedPlanSections : draft.planning.sections,
              confirmed: normalizedPlanSections.length > 0 ? true : draft.planning.confirmed || false,
            }
          : normalizedPlanSections.length
            ? {
                options: [],
                selectedPlanId: body.confirmedPlan?.selectedPlanId || '',
                sections: normalizedPlanSections,
                planVersion: '',
                confirmed: true,
              }
            : null,
        outline: {
          titleOptions: result.titleOptions,
          sections: result.outlineSections,
          risks: result.risks,
          outlineVersion: result.outlineVersion,
          confirmed: false,
        },
        sections: draft.sections,
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: result.titleOptions[0] || draft.generated_title || '',
        generated_content: draft.generated_content || '',
        version_count: draft.version_count,
      },
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'outline',
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
        action: 'outline',
        provider: String(context.provider || ''),
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
