import test from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { draftSaveSchema } from '../../lib/validation.ts';

function createEditableDraftPayload() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    docType: 'notice',
    provider: 'claude',
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    contactName: '张三',
    contactPhone: '12345678',
    attachments: ['附件1'],
  };
}

test('draftSaveSchema accepts editable draft fields', () => {
  const parsed = draftSaveSchema.parse(createEditableDraftPayload());

  assert.deepEqual(parsed, createEditableDraftPayload());
});

test('draftSaveSchema rejects protected workflow fields', () => {
  const payload = {
    ...createEditableDraftPayload(),
    workflowStage: 'draft',
    planning: {
      selectedPlanId: 'plan-1',
      sections: [],
    },
  };

  assert.throws(() => draftSaveSchema.parse(payload), (error: unknown) => {
    assert.ok(error instanceof ZodError);
    return true;
  });
});
