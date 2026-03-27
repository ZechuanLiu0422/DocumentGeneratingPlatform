import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTrustedDraftFixture, buildTrustedVersionFixture } from './shared-fixtures.ts';
import { importTrustProjectModule, withTrustRouteModuleMocks } from './trust-contract-helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

function createAuthSuccess() {
  return {
    '@/lib/auth': {
      requireRouteUser: async () => ({
        supabase: { kind: 'stub' },
        user: { id: '11111111-1111-4111-8111-111111111111' },
      }),
    },
  };
}

test('versions route exposes accepted provenance data for review surfaces', async (t) => {
  const api = await importTrustProjectModule(t, '../../../lib/api.ts');
  const versionFixture = buildTrustedVersionFixture();

  const versionsModule = await withTrustRouteModuleMocks(t, '../../../app/api/ai/versions/route.ts', {
    '@/lib/api': api,
    ...createAuthSuccess(),
    '@/lib/collaborative-store': {
      getDraftById: async () => buildTrustedDraftFixture(),
      listVersionsForDraft: async () => [versionFixture],
    },
  });

  const response = await versionsModule.GET(
    new Request('http://localhost/api/ai/versions?draftId=22222222-2222-4222-8222-222222222222')
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.versions.length, 1);
  assert.equal(payload.versions[0].sections[0].provenance.sources[0].label, '专项检查工作指引');
  assert.equal(payload.versions[0].review_state.status, 'pass');
});

test('generate workspace source renders provenance from the accepted section shape', () => {
  const pageSource = readFileSync(path.join(projectRoot, 'app', 'generate', 'page.tsx'), 'utf8');

  assert.match(pageSource, /provenance/i);
  assert.match(pageSource, /采纳依据|参考依据|来源依据/);
});
