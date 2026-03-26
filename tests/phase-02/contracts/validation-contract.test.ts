import test from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import {
  draftSaveSchema,
  draftRequestSchema,
  generateSchema,
  intakeSchema,
  outlinePlanRequestSchema,
  outlineRequestSchema,
  reviewRequestSchema,
} from '../../../lib/validation.ts';
import {
  buildDraftRequestBody,
  buildGenerateRequestBody,
  buildIntakeRequestBody,
  buildOutlinePlanRequestBody,
  buildOutlineRequestBody,
  buildReviewRequestBody,
} from './shared-fixtures.ts';

test('validation contracts accept representative workflow payloads', () => {
  const cases = [
    ['intake', intakeSchema, buildIntakeRequestBody()],
    ['outline-plan', outlinePlanRequestSchema, buildOutlinePlanRequestBody()],
    ['outline', outlineRequestSchema, buildOutlineRequestBody()],
    ['draft', draftRequestSchema, buildDraftRequestBody()],
    ['review', reviewRequestSchema, buildReviewRequestBody()],
    ['generate', generateSchema, buildGenerateRequestBody()],
  ] as const;

  for (const [label, schema, payload] of cases) {
    assert.deepEqual(schema.parse(payload), payload, `${label} payload should parse cleanly`);
  }
});

test('draft save contract rejects workflow-owned fields from the client', () => {
  assert.throws(
    () =>
      draftSaveSchema.parse({
        ...buildGenerateRequestBody(),
        workflowStage: 'review',
      }),
    (error: unknown) => error instanceof ZodError
  );
});

test('validation contracts reject malformed identifiers and required fields', () => {
  assert.throws(
    () =>
      intakeSchema.parse({
        ...buildIntakeRequestBody(),
        docType: 'memo',
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      outlinePlanRequestSchema.parse({
        ...buildOutlinePlanRequestBody(),
        draftId: 'bad-id',
      }),
    (error: unknown) => error instanceof ZodError
  );

  assert.throws(
    () =>
      generateSchema.parse({
        ...buildGenerateRequestBody(),
        generatedContent: '',
      }),
    (error: unknown) => error instanceof ZodError
  );
});
