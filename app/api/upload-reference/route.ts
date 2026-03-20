import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { parseReferenceFile } from '@/lib/file-parser';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { uploadDocTypeSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/upload-reference');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    enforceRateLimit(`upload-reference:${user.id}`, 10, 60 * 1000, '上传过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'upload_reference');

    const formData = await request.formData();
    const file = formData.get('file');
    const docType = uploadDocTypeSchema.parse({ docType: formData.get('docType') }).docType;

    if (!(file instanceof File)) {
      throw new Error('未提供文件');
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await parseReferenceFile(file.name, Buffer.from(arrayBuffer));

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'upload_reference',
      status: 'success',
    });

    return ok(context, {
      success: true,
      fileId: crypto.randomUUID(),
      fileName: file.name,
      docType,
      content: result.content,
      wordCount: result.wordCount,
      pageCount: result.pageCount || null,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'upload_reference',
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
