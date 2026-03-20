import { NextRequest } from 'next/server';
import { generateDocumentBuffer } from '@/lib/document-generator';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
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
