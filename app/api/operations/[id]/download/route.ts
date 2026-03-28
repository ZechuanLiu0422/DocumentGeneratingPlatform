import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppError, createRequestContext, handleRouteError, logRequestResult } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { downloadExportArtifactBytes, getExportArtifactByOperationId } from '@/lib/export-artifact-store';
import { getEnv } from '@/lib/env';
import { getDraftOperationById } from '@/lib/operation-store';
import { getSupabaseAdminKey } from '@/lib/server-supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

function createExportStorageClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  const key = getSupabaseAdminKey(url) ?? 'phase-04-runner-placeholder-key';

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
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
  const context = createRequestContext(request, `/api/operations/${params.id}/download`, {
    workflow_action: 'export_download',
  });

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const operation = await getDraftOperationById(supabase, user.id, params.id);
    context.draft_id = operation.draftId;
    context.operation_id = operation.id;
    context.operation_status = operation.status;
    context.attempt_count = operation.attemptCount;

    if (operation.operationType !== 'export') {
      throw new AppError(404, '导出任务不存在', 'EXPORT_OPERATION_NOT_FOUND');
    }

    if (operation.status !== 'succeeded') {
      throw new AppError(409, '导出文件尚未准备完成', 'EXPORT_NOT_READY');
    }

    const artifact = await getExportArtifactByOperationId(supabase, {
      userId: user.id,
      operationId: operation.id,
    });
    const bytes = await downloadExportArtifactBytes(createExportStorageClient(), artifact.storagePath);

    logRequestResult(context, 200, {
      operation_id: operation.id,
      operation_status: 'downloaded',
      attempt_count: operation.attemptCount,
      export_size_bytes: bytes.byteLength,
      artifact_id: artifact.id,
    });

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': artifact.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(artifact.fileName)}`,
      },
    });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
