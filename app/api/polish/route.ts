import { NextRequest } from 'next/server';
import { generateDocument } from '@/lib/official-document-ai';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { polishSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/polish');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = polishSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`polish:${user.id}`, 10, 60 * 1000, '生成过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'polish');

    const result = await generateDocument({
      docType: body.docType,
      recipient: body.recipient,
      content: body.content,
      provider: body.provider,
      title: body.title,
      attachments: body.attachments,
      referenceAnalysis: body.referenceAnalysis || undefined,
      imitationStrength: body.imitationStrength,
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'polish',
      provider: body.provider,
      status: 'success',
    });

    return ok(context, {
      success: true,
      generated_title: result.title,
      generated_content: result.content,
    });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      const provider = context.provider as string | undefined;
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'polish',
        provider,
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
