import { NextRequest } from 'next/server';
import { generateDocumentBuffer } from '@/lib/document-generator';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { computeReviewContentHash } from '@/lib/official-document-workflow';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { generateSchema } from '@/lib/validation';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sanitizeTitle(title: string) {
  return title.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'document';
}

function buildAuthoritativeExportPayload(body: Awaited<ReturnType<typeof generateSchema.parse>>, draft: Awaited<ReturnType<typeof getDraftById>> | null) {
  if (!draft) {
    return {
      title: body.title,
      recipient: body.recipient,
      content: body.generatedContent,
      issuer: body.issuer,
      date: body.date,
      attachments: body.attachments,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      sections: body.sections,
    };
  }

  return {
    title: draft.generated_title || draft.title || body.title,
    recipient: draft.recipient || body.recipient,
    content: draft.generated_content || body.generatedContent,
    issuer: draft.issuer || body.issuer,
    date: draft.date || body.date,
    attachments: draft.attachments || body.attachments,
    contactName: draft.contact_name || body.contactName,
    contactPhone: draft.contact_phone || body.contactPhone,
    sections: draft.sections.length > 0 ? draft.sections : body.sections,
  };
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/generate');
  let reviewTelemetry: Record<string, unknown> = {};

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = generateSchema.parse(await request.json());
    context.provider = body.provider;
    context.doc_type = body.docType;
    context.workflow_action = 'export';
    if (body.draftId) {
      context.draft_id = body.draftId;
    }

    enforceRateLimit(`generate:${user.id}`, 8, 60 * 1000, '导出过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'generate');

    const draft = body.draftId ? await getDraftById(supabase, user.id, body.draftId) : null;
    if (draft?.workflow_stage) {
      context.workflow_stage = draft.workflow_stage;
    }
    const exportPayload = buildAuthoritativeExportPayload(body, draft);

    if (draft) {
      if (!draft.review_state) {
        throw new AppError(409, '请先运行定稿检查后再导出', 'REVIEW_REQUIRED');
      }

      const currentReviewHash = computeReviewContentHash({
        title: draft.generated_title || draft.title || '',
        content: draft.generated_content || '',
        sections: draft.sections,
      });

      reviewTelemetry = {
        review_hash: draft.review_state.content_hash,
        review_status: draft.review_state.status,
      };

      if (draft.review_state.content_hash !== currentReviewHash) {
        throw new AppError(409, '当前正文已变化，请重新运行定稿检查后再导出', 'REVIEW_STALE');
      }
    }

    const fileBuffer = await generateDocumentBuffer(body.docType, {
      title: exportPayload.title,
      recipient: exportPayload.recipient,
      content: exportPayload.content,
      issuer: exportPayload.issuer,
      date: exportPayload.date,
      attachments: exportPayload.attachments,
      contactName: exportPayload.contactName,
      contactPhone: exportPayload.contactPhone,
    });

    const { error } = await supabase.from('documents').insert({
      user_id: user.id,
      doc_type: body.docType,
      title: exportPayload.title,
      recipient: exportPayload.recipient,
      user_input: body.content,
      generated_content: exportPayload.content,
      ai_provider: body.provider,
      issuer: exportPayload.issuer,
      doc_date: exportPayload.date,
      attachments: exportPayload.attachments,
      contact_name: exportPayload.contactName || null,
      contact_phone: exportPayload.contactPhone || null,
    });

    if (error) {
      throw error;
    }

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'generate',
      provider: body.provider,
      status: 'success',
    });

    if (draft) {
      context.workflow_stage = draft.workflow_stage;
      const workflowStage = getAuthoritativeWorkflowStage('export_completed');
      await saveDraftState(supabase, {
        userId: user.id,
        draftId: draft.id,
        docType: draft.doc_type,
        provider: draft.provider,
        baseFields: {
          title: exportPayload.title,
          recipient: exportPayload.recipient,
          content: body.content,
          issuer: exportPayload.issuer,
          date: exportPayload.date,
          contact_name: exportPayload.contactName,
          contact_phone: exportPayload.contactPhone,
          attachments: exportPayload.attachments,
        },
        workflow: {
          workflow_stage: workflowStage,
          collected_facts: draft.collected_facts,
          missing_fields: draft.missing_fields,
          planning: draft.planning,
          outline: draft.outline,
          sections: exportPayload.sections.length > 0 ? exportPayload.sections : draft.sections,
          active_rule_ids: draft.active_rule_ids,
          active_reference_ids: draft.active_reference_ids,
          generated_title: exportPayload.title,
          generated_content: exportPayload.content,
          review_state: draft.review_state || null,
          version_count: draft.version_count,
        },
      });

      await createVersionSnapshot(supabase, {
        userId: user.id,
        draftId: draft.id,
        stage: 'exported',
        title: exportPayload.title,
        content: exportPayload.content,
        sections: exportPayload.sections.length > 0 ? exportPayload.sections : draft.sections,
        reviewState: draft.review_state || null,
        changeSummary: '已导出 Word 定稿',
      });

      context.workflow_stage = workflowStage;
    }

    return ok(context, {
      success: true,
      file_data: fileBuffer.toString('base64'),
      file_name: `${sanitizeTitle(exportPayload.title)}.docx`,
    }, 200, {
      export_size_bytes: fileBuffer.byteLength,
      ...reviewTelemetry,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      const provider = context.provider as string | undefined;
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'generate',
        provider,
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context, reviewTelemetry);
  }
}
