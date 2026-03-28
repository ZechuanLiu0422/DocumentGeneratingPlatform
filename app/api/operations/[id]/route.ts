import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { getDraftById } from '@/lib/collaborative-store';
import { toDraftResponse } from '@/lib/draft-save';
import { getDraftOperationById } from '@/lib/operation-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

function buildOperationPayload(operation: Awaited<ReturnType<typeof getDraftOperationById>>) {
  return {
    id: operation.id,
    draftId: operation.draftId,
    type: operation.operationType,
    status: operation.status,
    attemptCount: operation.attemptCount,
    maxAttempts: operation.maxAttempts,
    errorCode: operation.errorCode,
    errorMessage: operation.errorMessage,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    startedAt: operation.startedAt,
    completedAt: operation.completedAt,
    pollUrl: `/api/operations/${operation.id}`,
  };
}

function shouldHydrateDraft(operation: Awaited<ReturnType<typeof getDraftOperationById>>) {
  return operation.status === 'succeeded' && Boolean(operation.draftId) && operation.operationType.startsWith('draft_');
}

export async function GET(
  request: NextRequest,
  contextInput: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const params = await contextInput.params;
  const context = createRequestContext(request, `/api/operations/${params.id}`, {
    workflow_action: 'operation_status',
  });

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const operation = await getDraftOperationById(supabase, user.id, params.id);
    context.draft_id = operation.draftId;
    context.operation_id = operation.id;
    context.operation_status = operation.status;
    context.attempt_count = operation.attemptCount;

    const draft =
      shouldHydrateDraft(operation) && operation.draftId
        ? toDraftResponse(await getDraftById(supabase, user.id, operation.draftId))
        : null;

    return ok(
      context,
      {
        operation: buildOperationPayload(operation),
        result: operation.status === 'succeeded' ? operation.result : null,
        draft,
      },
      200,
      {
        operation_id: operation.id,
        operation_status: operation.status,
        attempt_count: operation.attemptCount,
      }
    );
  } catch (error) {
    return handleRouteError(error, context);
  }
}
