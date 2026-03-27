import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewState, buildTrustedDraftFixture, buildTrustedVersionFixture } from './shared-fixtures.ts';
import { importTrustProjectModule } from './trust-contract-helpers.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

test('trust schemas accept representative provenance and review-state payloads', async () => {
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;

  assert.ok(validation.sectionSourceRefSchema, 'sectionSourceRefSchema should be exported');
  assert.ok(validation.sectionProvenanceSchema, 'sectionProvenanceSchema should be exported');
  assert.ok(validation.reviewStateSchema, 'reviewStateSchema should be exported');
  assert.ok(validation.trustedDraftSectionSchema, 'trustedDraftSectionSchema should be exported');

  const section = buildTrustedDraftFixture().sections[0];
  assert.deepEqual(validation.trustedDraftSectionSchema.parse(section), section);
  assert.deepEqual(validation.reviewStateSchema.parse(buildReviewState()), buildReviewState());
});

test('draft and version normalization preserve additive trust metadata', async (t) => {
  const store = (await importTrustProjectModule(t, '../../../lib/collaborative-store.ts')) as Record<string, any>;

  assert.equal(typeof store.normalizeDraftRecord, 'function', 'normalizeDraftRecord should be exported');
  assert.equal(typeof store.normalizeVersionRecord, 'function', 'normalizeVersionRecord should be exported');

  const normalizedDraft = store.normalizeDraftRecord(buildTrustedDraftFixture());
  const normalizedVersion = store.normalizeVersionRecord(buildTrustedVersionFixture());

  assert.equal(normalizedDraft.sections[0]?.provenance?.sources[0]?.sourceType, 'reference_asset');
  assert.equal(normalizedDraft.review_state?.content_hash, buildReviewState().content_hash);
  assert.equal(normalizedVersion.sections[1]?.provenance?.sources[0]?.label, '专项检查工作指引');
  assert.equal(normalizedVersion.review_state?.status, 'pass');
});

test('Phase 3 migration adds explicit review_state jsonb storage to drafts and versions', () => {
  const migrationPath = path.join(projectRoot, 'supabase', 'migrations', '20260327173000_phase_03_review_state_jsonb.sql');
  assert.equal(path.basename(migrationPath), '20260327173000_phase_03_review_state_jsonb.sql');
  assert.equal(existsSync(migrationPath), true, 'review_state migration should exist');
  assert.equal(
    readFileSync(migrationPath, 'utf8').includes('review_state'),
    true,
    'migration should define the review_state jsonb contract'
  );
});
