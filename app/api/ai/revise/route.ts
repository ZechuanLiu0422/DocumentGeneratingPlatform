import { NextRequest } from 'next/server';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { enforceDistributedRateLimit } from '@/lib/distributed-ratelimit';
import { OPERATION_RUNNER_PATH, createDraftOperation, triggerOperationRunnerKick } from '@/lib/operation-store';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { reviseRequestSchema } from '@/lib/validation';
import {
  buildChangeCandidatePreview,
  buildPendingChangeState,
  doesDraftMatchPendingChangeBase,
  isPendingChangeExpired,
} from '@/lib/version-restore';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function normalizeTextForSectionMatch(text: string) {
  return text.replace(/\s+/g, '').trim();
}

function resolveTargetSectionIds(
  draft: Awaited<ReturnType<typeof getDraftById>>,
  body: Awaited<ReturnType<typeof reviseRequestSchema.parse>>
) {
  if (body.targetType === 'section') {
    return body.targetId ? [body.targetId] : [];
  }

  if (body.targetType === 'selection') {
    if (body.targetId) {
      return [body.targetId];
    }

    const normalizedSelectedText = normalizeTextForSectionMatch(body.selectedText || '');
    const matched = draft.sections
      .filter((section) => normalizeTextForSectionMatch(section.body).includes(normalizedSelectedText))
      .map((section) => section.id);

    if (matched.length > 0) {
      return matched;
    }

    throw new AppError(400, '未找到所选片段对应的段落，请重新选择。', 'TARGET_SECTION_REQUIRED');
  }

  return [];
}

function requireMatchingPendingChange(draft: Awaited<ReturnType<typeof getDraftById>>, userId: string, candidateId: string) {
  const pendingChange = draft.pending_change;

  if (!pendingChange || pendingChange.candidateId !== candidateId || pendingChange.action !== 'revise') {
    throw new AppError(404, '候选变更不存在，请重新生成预览。', 'CANDIDATE_NOT_FOUND');
  }

  if (
    pendingChange.userId !== userId ||
    isPendingChangeExpired(pendingChange) ||
    !doesDraftMatchPendingChangeBase(draft, pendingChange)
  ) {
    throw new AppError(409, '候选变更已过期或草稿已变化，请重新生成预览。', 'STALE_CANDIDATE');
  }

  return pendingChange;
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/revise');
  let shouldRecordFailureUsage = false;

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = reviseRequestSchema.parse(await request.json());
    context.provider = body.provider;
    context.draft_id = body.draftId;
    context.workflow_action = 'revise';

    const draft = await getDraftById(supabase, user.id, body.draftId);
    context.doc_type = draft.doc_type;
    context.workflow_stage = draft.workflow_stage;

    if (body.decision !== 'preview') {
      const pendingChange = requireMatchingPendingChange(draft, user.id, body.candidateId!);

      if (body.decision === 'reject') {
        await saveDraftState(supabase, {
          userId: user.id,
          draftId: draft.id,
          docType: draft.doc_type,
          provider: draft.provider,
          baseFields: {
            title: draft.title || '',
            recipient: draft.recipient || '',
            content: draft.content || '',
            issuer: draft.issuer || '',
            date: draft.date || '',
            contact_name: draft.contact_name || '',
            contact_phone: draft.contact_phone || '',
            attachments: draft.attachments,
          },
          workflow: {
            workflow_stage: draft.workflow_stage,
            collected_facts: draft.collected_facts,
            missing_fields: draft.missing_fields,
            planning: draft.planning,
            outline: draft.outline,
            sections: draft.sections,
            active_rule_ids: draft.active_rule_ids,
            active_reference_ids: draft.active_reference_ids,
            generated_title: draft.generated_title || draft.title || '',
            generated_content: draft.generated_content || '',
            review_state: draft.review_state || null,
            pending_change: null,
            version_count: draft.version_count,
          },
        });

        return ok(context, {
          mode: 'reject',
          candidateId: pendingChange.candidateId,
          candidateCleared: true,
        });
      }

      const nextTitle = pendingChange.after.title || draft.generated_title || draft.title || '';
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
          sections: pendingChange.after.sections,
          active_rule_ids: draft.active_rule_ids,
          active_reference_ids: draft.active_reference_ids,
          generated_title: nextTitle,
          generated_content: pendingChange.after.content || '',
          review_state: pendingChange.after.reviewState || null,
          pending_change: null,
          version_count: draft.version_count,
        },
      });

      await createVersionSnapshot(supabase, {
        userId: user.id,
        draftId: draft.id,
        stage: 'revision_applied',
        title: nextTitle,
        content: pendingChange.after.content || '',
        sections: pendingChange.after.sections,
        reviewState: pendingChange.after.reviewState || null,
        changeSummary: pendingChange.diffSummary || '已接受改写候选',
      });

      context.workflow_stage = workflowStage;
      return ok(context, {
        mode: 'accept',
        updatedContent: pendingChange.after.content || '',
        updatedSections: pendingChange.after.sections,
        changeSummary: pendingChange.diffSummary || '已接受改写候选',
        title: nextTitle,
        reviewState: pendingChange.after.reviewState || null,
        workflowStage,
        candidateCleared: true,
      });
    }

    await enforceDistributedRateLimit({
      supabase,
      userId: user.id,
      action: 'revise',
      limit: 12,
      windowMs: 60 * 1000,
      message: '改写过于频繁，请稍后再试',
    });
    await enforceDailyQuota(supabase, user.id, 'refine');
    shouldRecordFailureUsage = true;
    const operation = await createDraftOperation(supabase, {
      user_id: user.id,
      draft_id: draft.id,
      operation_type: 'draft_revise',
      idempotency_key: `draft-revise:${draft.id}:${crypto.randomUUID()}`,
      payload: {
        draftId: draft.id,
        provider: body.provider,
        targetType: body.targetType,
        targetId: body.targetId,
        selectedText: body.selectedText,
        instruction: body.instruction,
        sessionReferences: body.sessionReferences,
      },
    });

    context.operation_id = operation.id;
    context.operation_status = operation.status;
    context.attempt_count = operation.attemptCount;

    await triggerOperationRunnerKick({
      origin: request.nextUrl.origin,
      secret: process.env.OPERATION_RUNNER_SECRET,
    });

    return ok(
      context,
      {
        mode: 'queued',
        operationId: operation.id,
        status: operation.status,
        pollUrl: `/api/operations/${operation.id}`,
      },
      202,
      {
        operation_id: operation.id,
        operation_status: operation.status,
        runner_path: OPERATION_RUNNER_PATH,
      }
    );
  } catch (error) {
    try {
      if (shouldRecordFailureUsage) {
        const { supabase, user } = await requireRouteUser();
        await recordUsageEvent(supabase, {
          userId: user.id,
          action: 'refine',
          provider: String(context.provider || ''),
          status: 'failed',
        });
      }
    } catch {}

    return handleRouteError(error, context);
  }
}
