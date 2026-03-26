import test from 'node:test';
import assert from 'node:assert/strict';
import { ZodError } from 'zod';
import { draftSaveSchema } from '../../lib/validation.ts';
import {
  buildDraftWritePayload,
  mergeProtectedDraftFields,
  toDraftResponse,
} from '../../lib/draft-save.ts';

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

function createStoredDraftRecord() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: 'user-1',
    doc_type: 'notice',
    title: '服务器标题',
    recipient: '各相关单位',
    content: '服务器正文',
    issuer: '办公室',
    date: '2026-03-25',
    provider: 'claude',
    contact_name: '李四',
    contact_phone: '87654321',
    attachments: ['旧附件'],
    workflow_stage: 'review',
    collected_facts: { topic: '专项检查' },
    missing_fields: ['issuer'],
    planning: {
      selectedPlanId: 'plan-1',
      sections: [{ id: 'sec-1', headingDraft: '一、总体要求', purpose: '', topicSummary: '', orderReason: '' }],
    },
    outline: {
      titleOptions: ['关于专项检查的通知'],
      sections: [{ id: 'outline-1', heading: '一、总体要求', purpose: '说明要求', keyPoints: ['抓落实'], notes: '' }],
      risks: ['措辞风险'],
      confirmed: true,
    },
    sections: [{ id: 'draft-1', heading: '一、总体要求', body: '现有正文' }],
    active_rule_ids: ['33333333-3333-4333-8333-333333333333'],
    active_reference_ids: ['44444444-4444-4444-8444-444444444444'],
    version_count: 7,
    generated_title: 'AI 标题',
    generated_content: 'AI 正文',
    updated_at: '2026-03-26T00:00:00.000Z',
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

test('buildDraftWritePayload creates a sanitized insert payload with server defaults', () => {
  const payload = buildDraftWritePayload({
    userId: 'user-1',
    draft: createEditableDraftPayload(),
  });

  assert.deepEqual(payload, {
    user_id: 'user-1',
    doc_type: 'notice',
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude',
    contact_name: '张三',
    contact_phone: '12345678',
    attachments: ['附件1'],
    workflow_stage: 'intake',
    collected_facts: {},
    missing_fields: [],
    planning: null,
    outline: null,
    sections: [],
    active_rule_ids: [],
    active_reference_ids: [],
    version_count: 0,
    generated_title: null,
    generated_content: null,
  });
});

test('mergeProtectedDraftFields preserves authoritative workflow fields on update', () => {
  const merged = mergeProtectedDraftFields({
    existingDraft: createStoredDraftRecord(),
    editablePayload: buildDraftWritePayload({
      userId: 'user-1',
      draft: {
        ...createEditableDraftPayload(),
        title: '浏览器修改后的标题',
        attachments: ['新附件'],
      },
    }),
  });

  assert.equal(merged.title, '浏览器修改后的标题');
  assert.deepEqual(merged.attachments, ['新附件']);
  assert.equal(merged.workflow_stage, 'review');
  assert.deepEqual(merged.planning, createStoredDraftRecord().planning);
  assert.deepEqual(merged.outline, createStoredDraftRecord().outline);
  assert.deepEqual(merged.sections, createStoredDraftRecord().sections);
  assert.deepEqual(merged.active_rule_ids, createStoredDraftRecord().active_rule_ids);
  assert.deepEqual(merged.active_reference_ids, createStoredDraftRecord().active_reference_ids);
  assert.equal(merged.version_count, 7);
  assert.equal(merged.generated_title, 'AI 标题');
  assert.equal(merged.generated_content, 'AI 正文');
});

test('toDraftResponse returns the authoritative draft snapshot for UI hydration', () => {
  const response = toDraftResponse(createStoredDraftRecord());

  assert.equal(response.id, '22222222-2222-4222-8222-222222222222');
  assert.equal(response.docType, 'notice');
  assert.equal(response.workflowStage, 'review');
  assert.deepEqual(response.planning, createStoredDraftRecord().planning);
  assert.deepEqual(response.outline, createStoredDraftRecord().outline);
  assert.deepEqual(response.sections, createStoredDraftRecord().sections);
  assert.deepEqual(response.activeRuleIds, createStoredDraftRecord().active_rule_ids);
  assert.deepEqual(response.activeReferenceIds, createStoredDraftRecord().active_reference_ids);
  assert.equal(response.versionCount, 7);
  assert.equal(response.generatedTitle, 'AI 标题');
  assert.equal(response.generatedContent, 'AI 正文');
  assert.equal(response.contactName, '李四');
  assert.equal(response.contactPhone, '87654321');
});
