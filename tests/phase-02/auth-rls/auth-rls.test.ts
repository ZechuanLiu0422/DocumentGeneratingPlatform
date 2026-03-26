import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PHASE_02_FIXTURES } from '../../../scripts/seed-phase-2.mjs';
import { createSeededUserClient } from './supabase-auth-helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

function readProjectJson(...segments: string[]) {
  return JSON.parse(readFileSync(path.join(projectRoot, ...segments), 'utf8'));
}

test('SAFE-02 harness exposes repo-local reset, seed, and auth helper entrypoints', async () => {
  const packageJson = readProjectJson('package.json');

  assert.equal(
    typeof packageJson.scripts['test:phase-02:rls:reset'],
    'string',
    'package.json should expose a repo-local reset command for the local Supabase stack'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-02:rls:seed'],
    'string',
    'package.json should expose a deterministic seed command for SAFE-02 fixtures'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-02:rls'],
    'string',
    'package.json should expose the SAFE-02 regression suite command'
  );

  const seedModule = await import(
    `${pathToFileURL(path.join(projectRoot, 'scripts/seed-phase-2.mjs')).href}?task1=${Date.now()}`
  );
  const helperModule = await import(
    `${pathToFileURL(path.join(projectRoot, 'tests/phase-02/auth-rls/supabase-auth-helpers.ts')).href}?task1=${Date.now()}`
  );

  assert.equal(typeof seedModule.PHASE_02_FIXTURES, 'object');
  assert.equal(typeof seedModule.seedPhase02Fixtures, 'function');
  assert.equal(typeof helperModule.signInSeededUser, 'function');
  assert.equal(typeof helperModule.createSeededUserClient, 'function');
});

test('SAFE-02 blocks cross-user reads across protected drafting tables', async () => {
  const alice = await createSeededUserClient('alice');
  const bobFixtures = {
    drafts: PHASE_02_FIXTURES.drafts.bob,
    document_versions: PHASE_02_FIXTURES.documentVersions.bob,
    documents: PHASE_02_FIXTURES.documents.bob,
    writing_rules: PHASE_02_FIXTURES.writingRules.bob,
    reference_assets: PHASE_02_FIXTURES.referenceAssets.bob,
    contacts: PHASE_02_FIXTURES.contacts.bob,
    common_phrases: PHASE_02_FIXTURES.commonPhrases.bob,
    usage_events: PHASE_02_FIXTURES.usageEvents.bob,
  };

  for (const [table, id] of Object.entries(bobFixtures)) {
    const { data, error } = await alice.client.from(table).select('id').eq('id', id);
    assert.equal(error, null, `cross-user select from ${table} should not raise a query error`);
    assert.deepEqual(data, [], `alice should not be able to read bob's row from ${table}`);
  }
});

test('SAFE-02 allows self-owned reads across protected drafting tables', async () => {
  const alice = await createSeededUserClient('alice');
  const ownFixtures = {
    drafts: PHASE_02_FIXTURES.drafts.alice,
    document_versions: PHASE_02_FIXTURES.documentVersions.alice,
    documents: PHASE_02_FIXTURES.documents.alice,
    writing_rules: PHASE_02_FIXTURES.writingRules.alice,
    reference_assets: PHASE_02_FIXTURES.referenceAssets.alice,
    contacts: PHASE_02_FIXTURES.contacts.alice,
    common_phrases: PHASE_02_FIXTURES.commonPhrases.alice,
    usage_events: PHASE_02_FIXTURES.usageEvents.alice,
  };

  for (const [table, id] of Object.entries(ownFixtures)) {
    const { data, error } = await alice.client.from(table).select('id').eq('id', id);
    assert.equal(error, null, `self-owned select from ${table} should succeed`);
    assert.equal(data?.length, 1, `alice should be able to read her own row from ${table}`);
    assert.equal(data?.[0]?.id, id);
  }
});

test('SAFE-02 blocks cross-user draft mutations while allowing owned draft mutations', async () => {
  const alice = await createSeededUserClient('alice');
  const nextTitle = 'alice owned title updated by SAFE-02';

  const ownUpdate = await alice.client
    .from('drafts')
    .update({
      title: nextTitle,
      generated_content: 'alice owned content updated by SAFE-02',
    })
    .eq('id', PHASE_02_FIXTURES.drafts.alice)
    .select('id,title,generated_content');

  assert.equal(ownUpdate.error, null, 'alice should be able to update her own draft');
  assert.equal(ownUpdate.data?.length, 1);
  assert.equal(ownUpdate.data?.[0]?.id, PHASE_02_FIXTURES.drafts.alice);
  assert.equal(ownUpdate.data?.[0]?.title, nextTitle);

  const blockedUpdate = await alice.client
    .from('drafts')
    .update({
      title: 'bob title should remain unchanged',
    })
    .eq('id', PHASE_02_FIXTURES.drafts.bob)
    .select('id,title');

  assert.equal(blockedUpdate.error, null, 'cross-user draft update should be filtered by RLS');
  assert.deepEqual(blockedUpdate.data, [], 'alice should not update bob draft rows');

  const blockedDelete = await alice.client
    .from('drafts')
    .delete()
    .eq('id', PHASE_02_FIXTURES.drafts.bob)
    .select('id');

  assert.equal(blockedDelete.error, null, 'cross-user draft delete should be filtered by RLS');
  assert.deepEqual(blockedDelete.data, [], 'alice should not delete bob draft rows');

  const ownDraftAfterUpdate = await alice.client
    .from('drafts')
    .select('id,title,generated_content')
    .eq('id', PHASE_02_FIXTURES.drafts.alice);

  assert.equal(ownDraftAfterUpdate.error, null);
  assert.equal(ownDraftAfterUpdate.data?.length, 1);
  assert.equal(ownDraftAfterUpdate.data?.[0]?.title, nextTitle);
  assert.equal(ownDraftAfterUpdate.data?.[0]?.generated_content, 'alice owned content updated by SAFE-02');

  const bobDraftStillPresent = await alice.client
    .from('drafts')
    .select('id')
    .eq('id', PHASE_02_FIXTURES.drafts.bob);

  assert.equal(bobDraftStillPresent.error, null);
  assert.deepEqual(bobDraftStillPresent.data, [], 'alice still cannot observe bob draft after blocked mutation attempts');
});
