import test from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { buildChangeCandidatePayload, buildTrustedDraftFixture, buildTrustedVersionFixture } from './shared-fixtures.ts';
import { importTrustProjectModule } from './trust-contract-helpers.ts';

test('restore preview helpers expose explicit changed and unchanged section ids', async (t) => {
  const versionRestore = (await importTrustProjectModule(t, '../../../lib/version-restore.ts')) as Record<string, any>;
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;

  assert.equal(typeof versionRestore.buildRestoreCandidatePreview, 'function');
  assert.ok(validation.changeCandidatePreviewSchema, 'changeCandidatePreviewSchema should be exported');

  const preview = versionRestore.buildRestoreCandidatePreview(buildTrustedDraftFixture(), buildTrustedVersionFixture());
  const parsed = validation.changeCandidatePreviewSchema.parse(preview);

  assert.deepEqual(parsed.changedSectionIds, ['draft-sec-2']);
  assert.deepEqual(parsed.unchangedSectionIds, ['draft-sec-1']);
  assert.equal(parsed.after.sections[1]?.body, '请于本周五前提交整改清单。');
});

test('candidate accept/reject contracts reject missing ids and invalid section scopes', async () => {
  const validation = (await import('../../../lib/validation.ts')) as Record<string, any>;
  const acceptSchema = validation.changeCandidateAcceptRequestSchema;
  const rejectSchema = validation.changeCandidateRejectRequestSchema;

  assert.ok(acceptSchema, 'changeCandidateAcceptRequestSchema should be exported');
  assert.ok(rejectSchema, 'changeCandidateRejectRequestSchema should be exported');

  const candidate = buildChangeCandidatePayload();

  assert.throws(
    () =>
      acceptSchema.parse({
        draftId: '22222222-2222-4222-8222-222222222222',
        candidateId: '',
        action: candidate.action,
        targetType: candidate.targetType,
        targetSectionIds: candidate.targetSectionIds,
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      acceptSchema.parse({
        draftId: '22222222-2222-4222-8222-222222222222',
        candidateId: candidate.candidateId,
        action: candidate.action,
        targetType: 'section',
        targetSectionIds: [],
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      rejectSchema.parse({
        draftId: '22222222-2222-4222-8222-222222222222',
        candidateId: '',
      }),
    (error: unknown) => error instanceof ZodError
  );
});
