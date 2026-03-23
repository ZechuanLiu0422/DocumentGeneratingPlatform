import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { generateDraftWorkflow, generateOutlineWorkflow, runIntakeWorkflow } from '@/lib/official-document-workflow';
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

    const pseudoReferences =
      body.referenceAnalysis && body.referenceAnalysis.tone
        ? [
            {
              id: 'ad-hoc-reference',
              user_id: user.id,
              name: '临时参考风格',
              doc_type: body.docType,
              file_name: 'uploaded-reference',
              file_type: 'analysis',
              content: '',
              analysis: body.referenceAnalysis,
              is_favorite: false,
            },
          ]
        : [];

    const intake = await runIntakeWorkflow({
      docType: body.docType,
      provider: body.provider,
      answers: {
        title: body.title,
        recipient: body.recipient,
        content: body.content,
      },
      message: body.content,
      references: pseudoReferences,
    });

    const outline = await generateOutlineWorkflow({
      docType: body.docType,
      provider: body.provider,
      facts: intake.collectedFacts,
      references: pseudoReferences,
    });

    const result = await generateDraftWorkflow({
      docType: body.docType,
      provider: body.provider,
      facts: intake.collectedFacts,
      title: body.title || outline.titleOptions[0] || intake.suggestedTitle,
      outlineSections: outline.outlineSections,
      references: pseudoReferences,
      attachments: body.attachments,
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
