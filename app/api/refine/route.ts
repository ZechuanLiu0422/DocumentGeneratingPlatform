import { NextRequest } from 'next/server';
import { refineGeneratedContent } from '@/lib/official-document-ai';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { refineSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/refine');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = refineSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`refine:${user.id}`, 12, 60 * 1000, '修改过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'refine');

    const refinedContent = await refineGeneratedContent({
      docType: body.docType,
      recipient: body.recipient,
      originalContent: body.originalContent,
      userFeedback: body.userFeedback,
      provider: body.provider,
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'refine',
      provider: body.provider,
      status: 'success',
    });

    return ok(context, {
      success: true,
      refined_content: refinedContent,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      const provider = context.provider as string | undefined;
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'refine',
        provider,
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
