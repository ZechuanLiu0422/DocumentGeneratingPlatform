import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { validatePublicEnv } from '@/lib/env';
import { getPublicProviderInfo } from '@/lib/providers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/health');

  try {
    const missingPublicEnv = validatePublicEnv();
    const enabledProviders = getPublicProviderInfo();

    const status = missingPublicEnv.length === 0 && enabledProviders.length > 0 ? 'ok' : 'degraded';

    return ok(context, {
      status,
      checks: {
        publicEnv: missingPublicEnv.length === 0,
        aiProviderConfigured: enabledProviders.length > 0,
      },
    });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
