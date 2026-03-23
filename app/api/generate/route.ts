import { NextRequest } from 'next/server';
import { generateDocumentBuffer } from '@/lib/document-generator';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { generateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

function sanitizeTitle(title: string) {
  return title.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'document';
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/generate');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = generateSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`generate:${user.id}`, 8, 60 * 1000, '导出过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'generate');

    const fileBuffer = await generateDocumentBuffer(body.docType, {
      title: body.title,
      recipient: body.recipient,
      content: body.generatedContent,
      issuer: body.issuer,
      date: body.date,
      attachments: body.attachments,
      contactName: body.contactName,
      contactPhone: body.contactPhone,
    });

    const { error } = await supabase.from('documents').insert({
      user_id: user.id,
      doc_type: body.docType,
      title: body.title,
      recipient: body.recipient,
      user_input: body.content,
      generated_content: body.generatedContent,
      ai_provider: body.provider,
      issuer: body.issuer,
      doc_date: body.date,
      attachments: body.attachments,
      contact_name: body.contactName || null,
      contact_phone: body.contactPhone || null,
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

    if (body.draftId) {
      const draft = await getDraftById(supabase, user.id, body.draftId);
      await saveDraftState(supabase, {
        userId: user.id,
        draftId: draft.id,
        docType: draft.doc_type,
        provider: draft.provider,
        baseFields: {
          title: body.title,
          recipient: body.recipient,
          content: body.content,
          issuer: body.issuer,
          date: body.date,
          contact_name: body.contactName,
          contact_phone: body.contactPhone,
          attachments: body.attachments,
        },
        workflow: {
          workflow_stage: 'done',
          collected_facts: draft.collected_facts,
          missing_fields: draft.missing_fields,
          planning: draft.planning,
          outline: draft.outline,
          sections: body.sections.length > 0 ? body.sections : draft.sections,
          active_rule_ids: draft.active_rule_ids,
          active_reference_ids: draft.active_reference_ids,
          generated_title: body.title,
          generated_content: body.generatedContent,
          version_count: draft.version_count,
        },
      });

      await createVersionSnapshot(supabase, {
        userId: user.id,
        draftId: draft.id,
        stage: 'exported',
        title: body.title,
        content: body.generatedContent,
        sections: body.sections.length > 0 ? body.sections : draft.sections,
        changeSummary: '已导出 Word 定稿',
      });
    }

    return ok(context, {
      success: true,
      file_data: fileBuffer.toString('base64'),
      file_name: `${sanitizeTitle(body.title)}.docx`,
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

    return handleRouteError(error, context);
  }
}
