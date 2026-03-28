import { NextRequest } from 'next/server';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { getDraftById } from '@/lib/collaborative-store';
import { enforceDistributedRateLimit } from '@/lib/distributed-ratelimit';
import { computeReviewContentHash } from '@/lib/official-document-workflow';
import { OPERATION_RUNNER_PATH, createDraftOperation, triggerOperationRunnerKick } from '@/lib/operation-store';
import { enforceDailyQuota, recordUsageEvent } from '@/lib/quota';
import { generateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/generate');
  let reviewTelemetry: Record<string, unknown> = {};
  let shouldRecordFailureUsage = false;

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

    if (!body.draftId) {
      throw new AppError(400, '请先保存草稿后再导出', 'EXPORT_DRAFT_REQUIRED');
    }

    const draft = await getDraftById(supabase, user.id, body.draftId);
    context.workflow_stage = draft.workflow_stage;

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

    await enforceDistributedRateLimit({
      supabase,
      userId: user.id,
      action: 'generate',
      limit: 8,
      windowMs: 60 * 1000,
      message: '导出过于频繁，请稍后再试',
    });
    await enforceDailyQuota(supabase, user.id, 'generate');
    shouldRecordFailureUsage = true;

    const operation = await createDraftOperation(supabase, {
      user_id: user.id,
      draft_id: draft.id,
      operation_type: 'export',
      idempotency_key: `export:${draft.id}:${draft.review_state.content_hash}`,
      payload: {
        draftId: draft.id,
        docType: draft.doc_type,
        provider: body.provider,
        reviewHash: draft.review_state.content_hash,
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
        ...reviewTelemetry,
      }
    );
  } catch (error) {
    try {
      if (shouldRecordFailureUsage) {
        const { supabase, user } = await requireRouteUser();
        const provider = context.provider as string | undefined;
        await recordUsageEvent(supabase, {
          userId: user.id,
          action: 'generate',
          provider,
          status: 'failed',
        });
      }
    } catch {}

    return handleRouteError(error, context, reviewTelemetry);
  }
}
