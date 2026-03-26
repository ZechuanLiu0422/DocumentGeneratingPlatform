import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { withRouteModuleMocks } from '../contracts/route-contract-helpers.ts';

test('SAFE-04 health route exposes only reduced operator-safe status details', async (t) => {
  const module = await withRouteModuleMocks(t, '../../../app/api/health/route.ts', {
    '@/lib/env': {
      validatePublicEnv: () => ['NEXT_PUBLIC_SUPABASE_URL'],
    },
    '@/lib/providers': {
      getPublicProviderInfo: () => [{ id: 'claude', label: 'Claude' }],
    },
  });

  const response = await module.GET(new NextRequest('http://localhost/api/health'));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(payload, {
    status: 'degraded',
    checks: {
      publicEnv: false,
      aiProviderConfigured: true,
    },
  });
  assert.equal('enabledProviders' in payload, false);
  assert.equal('missingPublicEnv' in payload, false);
});
