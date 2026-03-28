import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AppError, createRequestContext, handleRouteError, ok } from '@/lib/api';
import { getEnv } from '@/lib/env';
import {
  createSupabaseOperationLeaseStore,
  OPERATION_RUNNER_FALLBACK_SECRET,
  drainOperationQueue,
  OPERATION_RUNNER_PATH,
  OPERATION_RUNNER_SELF_KICK_HEADER,
} from '@/lib/operation-store';
import { prepareOperationExecution } from '@/lib/operation-runner';
import { getSupabaseAdminKey } from '@/lib/server-supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

function getRunnerSecret() {
  return getEnv('OPERATION_RUNNER_SECRET') || OPERATION_RUNNER_FALLBACK_SECRET;
}

function isAuthorized(request: NextRequest, secret: string) {
  const authorization = request.headers.get('authorization');
  const selfKick = request.headers.get(OPERATION_RUNNER_SELF_KICK_HEADER);

  return authorization === `Bearer ${secret}` || selfKick === secret;
}

function createRunnerSupabaseClient() {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL') ?? 'http://127.0.0.1:54321';
  const key = getSupabaseAdminKey(url) ?? 'phase-04-runner-placeholder-key';

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
      execute: async (operation) => {
        return prepareOperationExecution({
          supabase,
          operation,
        });
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
