import { NextRequest } from 'next/server';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { enforceDistributedRateLimit } from '@/lib/distributed-ratelimit';
import { OPERATION_RUNNER_PATH, createDraftOperation, triggerOperationRunnerKick } from '@/lib/operation-store';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { draftRequestSchema } from '@/lib/validation';
import {
  buildChangeCandidatePreview,
  buildPendingChangeState,
  doesDraftMatchPendingChangeBase,
  isPendingChangeExpired,
} from '@/lib/version-restore';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function requireMatchingPendingChange(draft: Awaited<ReturnType<typeof getDraftById>>, userId: string, candidateId: string) {
  const pendingChange = draft.pending_change;

  if (!pendingChange || pendingChange.candidateId !== candidateId || pendingChange.action !== 'regenerate') {
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
  const context = createRequestContext(request, '/api/ai/draft');
  let shouldRecordFailureUsage = false;

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = draftRequestSchema.parse(await request.json());
    context.provider = body.provider;
    context.draft_id = body.draftId;
    context.workflow_action = 'draft';

    const draft = await getDraftById(supabase, user.id, body.draftId);
    context.doc_type = draft.doc_type;
    context.workflow_stage = draft.workflow_stage;

    if (body.mode === 'section' && body.decision !== 'preview') {
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

      const workflowStage = getAuthoritativeWorkflowStage('draft_generated');
      await saveDraftState(supabase, {
        userId: user.id,
        draftId: draft.id,
        docType: draft.doc_type,
        provider: draft.provider,
        baseFields: {
          title: pendingChange.after.title || draft.title || '',
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
          generated_title: pendingChange.after.title || draft.generated_title || draft.title || '',
          generated_content: pendingChange.after.content || '',
          review_state: pendingChange.after.reviewState || null,
          pending_change: null,
          version_count: draft.version_count,
        },
      });

      await createVersionSnapshot(supabase, {
        userId: user.id,
        draftId: draft.id,
        stage: 'draft_generated',
        title: pendingChange.after.title || draft.generated_title || draft.title || '',
        content: pendingChange.after.content || '',
        sections: pendingChange.after.sections,
        reviewState: pendingChange.after.reviewState || null,
        changeSummary: pendingChange.diffSummary || '已接受段落重生成候选',
      });

      context.workflow_stage = workflowStage;
      return ok(context, {
        mode: 'accept',
        title: pendingChange.after.title || draft.generated_title || draft.title || '',
        content: pendingChange.after.content || '',
        sections: pendingChange.after.sections,
        reviewState: pendingChange.after.reviewState || null,
        workflowStage,
        candidateCleared: true,
      });
    }

    await enforceDistributedRateLimit({
      supabase,
      userId: user.id,
      action: 'draft',
      limit: 10,
      windowMs: 60 * 1000,
      message: '正文生成过于频繁，请稍后再试',
    });
    await enforceDailyQuota(supabase, user.id, 'draft');
    shouldRecordFailureUsage = true;
    const operation = await createDraftOperation(supabase, {
      user_id: user.id,
      draft_id: draft.id,
      operation_type: body.mode === 'section' ? 'draft_regenerate' : 'draft_generate',
      idempotency_key: `${body.mode === 'section' ? 'draft-regenerate' : 'draft-generate'}:${draft.id}:${crypto.randomUUID()}`,
      payload: {
        draftId: draft.id,
        provider: body.provider,
        mode: body.mode,
        sectionId: body.sectionId,
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
          action: 'draft',
          provider: String(context.provider || ''),
          status: 'failed',
        });
      }
    } catch {}

    return handleRouteError(error, context);
  }
}
