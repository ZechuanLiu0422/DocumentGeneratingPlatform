import { NextRequest } from 'next/server';
import { analyzeReferenceStyle } from '@/lib/official-document-ai';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { enforceRateLimit } from '@/lib/ratelimit';
import { analyzeReferenceSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/analyze-reference');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = analyzeReferenceSchema.parse(await request.json());
    context.provider = body.provider;

    enforceRateLimit(`analyze-reference:${user.id}`, 10, 60 * 1000, '分析过于频繁，请稍后再试');
    await enforceDailyQuota(supabase, user.id, 'analyze_reference');

    const analysis = await analyzeReferenceStyle({
      docType: body.docType,
      content: body.fileContent,
      provider: body.provider,
    });

    await recordUsageEvent(supabase, {
      userId: user.id,
      action: 'analyze_reference',
      provider: body.provider,
      status: 'success',
    });

    return ok(context, { success: true, analysis });
  } catch (error) {
    try {
      const { supabase, user } = await requireRouteUser();
      const provider = context.provider as string | undefined;
      await recordUsageEvent(supabase, {
        userId: user.id,
        action: 'analyze_reference',
        provider,
        status: 'failed',
      });
    } catch {}

    return handleRouteError(error, context);
  }
}
