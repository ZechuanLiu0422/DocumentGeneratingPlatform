import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { getEnv } from '@/lib/env';
import {
  createSupabaseOperationLeaseStore,
  drainOperationQueue,
  OPERATION_RUNNER_PATH,
  OPERATION_RUNNER_SELF_KICK_HEADER,
} from '@/lib/operation-store';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getRunnerSecret() {
  const secret = getEnv('OPERATION_RUNNER_SECRET');
  if (!secret) {
    throw new AppError(500, '缺少操作执行器密钥配置', 'OPERATION_RUNNER_SECRET_MISSING');
  }

  return secret;
}

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get('authorization');
  const selfKick = request.headers.get(OPERATION_RUNNER_SELF_KICK_HEADER);

  return authorization === `Bearer ${secret}` || selfKick === secret;
}

function createRunnerSupabaseClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  const key =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ??
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ??
    'phase-04-runner-placeholder-key';

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, OPERATION_RUNNER_PATH, {
    workflow_action: 'operation_runner',
  });

  try {
    const secret = getRunnerSecret();

    if (!isAuthorized(request, secret)) {
      throw new AppError(401, '操作执行器未授权', 'OPERATION_RUNNER_UNAUTHORIZED');
    }

    const supabase = createRunnerSupabaseClient();
    const drain = await drainOperationQueue({
      store: createSupabaseOperationLeaseStore(supabase),
      runnerId: request.headers.get(OPERATION_RUNNER_SELF_KICK_HEADER) ? 'self-kick' : 'scheduled-runner',
      now: new Date(),
      leaseMs: 60_000,
      maxOperations: 5,
      execute: async () => {
        throw new AppError(501, '操作执行器尚未接入具体任务分发', 'OPERATION_RUNNER_NOT_IMPLEMENTED');
      },
    });

    return ok(
      context,
      {
        ok: true,
        drain,
        runnerPath: OPERATION_RUNNER_PATH,
      },
      200,
      {
        operation_status: 'drained',
      }
    );
  } catch (error) {
    return handleRouteError(error, context, {
      operation_status: 'failed',
    });
  }
}
