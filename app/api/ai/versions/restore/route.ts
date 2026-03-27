import { NextRequest } from 'next/server';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, getVersionById, saveDraftState } from '@/lib/collaborative-store';
import { versionRestoreSchema } from '@/lib/validation';
import {
  buildPendingChangeState,
  buildRestoreCandidatePreview,
  doesDraftMatchPendingChangeBase,
  isPendingChangeExpired,
} from '@/lib/version-restore';

function requireMatchingPendingChange(draft: Awaited<ReturnType<typeof getDraftById>>, userId: string, candidateId: string) {
  const pendingChange = draft.pending_change;

  if (!pendingChange || pendingChange.candidateId !== candidateId || pendingChange.action !== 'restore') {
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
  const context = createRequestContext(request, '/api/ai/versions/restore');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = versionRestoreSchema.parse(await request.json());
    const draft = await getDraftById(supabase, user.id, body.draftId);

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

      const updatedDraft = await saveDraftState(supabase, {
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
          workflow_stage: 'draft',
          collected_facts: draft.collected_facts,
          missing_fields: draft.missing_fields,
          planning: draft.planning,
          outline: draft.outline,
          sections: pendingChange.after.sections,
          active_rule_ids: draft.active_rule_ids,
          active_reference_ids: draft.active_reference_ids,
          generated_title: pendingChange.after.title || '',
          generated_content: pendingChange.after.content || '',
          review_state: pendingChange.after.reviewState || null,
          pending_change: null,
          version_count: draft.version_count,
        },
      });

      await createVersionSnapshot(supabase, {
        userId: user.id,
        draftId: draft.id,
        stage: 'restored',
        title: pendingChange.after.title || '',
        content: pendingChange.after.content || '',
        sections: pendingChange.after.sections,
        reviewState: pendingChange.after.reviewState || null,
        changeSummary: pendingChange.diffSummary || '已接受版本恢复候选',
      });

      return ok(context, {
        mode: 'accept',
        success: true,
        title: updatedDraft.generated_title || updatedDraft.title || '',
        content: updatedDraft.generated_content || '',
        sections: updatedDraft.sections,
        reviewState: updatedDraft.review_state || null,
        workflowStage: updatedDraft.workflow_stage,
        candidateCleared: true,
      });
    }

    const version = await getVersionById(supabase, user.id, body.draftId, body.versionId!);
    const candidate = buildRestoreCandidatePreview(draft, version);
    const previewTimestamp = new Date().toISOString();

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
        pending_change: buildPendingChangeState({
          candidate,
          userId: user.id,
          createdAt: previewTimestamp,
          baseUpdatedAt: previewTimestamp,
        }),
        version_count: draft.version_count,
      },
      updatedAt: previewTimestamp,
    });

    return ok(context, {
      mode: 'preview',
      candidate,
    });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
