import test from 'node:test';
import assert from 'node:assert/strict';
import type { DraftRecord, VersionRecord } from '../../lib/collaborative-store.ts';
import { buildRestoreResponse, mergeRestoredDraft } from '../../lib/version-restore.ts';

function createDraft(): DraftRecord {
  return {
    id: 'draft-1',
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
    workflow_stage: 'review',
    collected_facts: {
      background: '前期排查结果',
    },
    missing_fields: [],
    planning: {
      options: [
        {
          planId: 'plan-1',
          label: '方案一',
          strategy: '先部署后检查',
          whyThisWorks: '符合当前执行节奏',
          sections: [
            {
              id: 'p-1',
              headingDraft: '工作安排',
              purpose: '明确执行步骤',
              topicSummary: '部署检查任务',
              orderReason: '先总后分',
            },
          ],
        },
      ],
      selectedPlanId: 'plan-1',
      sections: [
        {
          id: 'p-1',
          headingDraft: '工作安排',
          purpose: '明确执行步骤',
          topicSummary: '部署检查任务',
          orderReason: '先总后分',
        },
      ],
      planVersion: 'plan-v1',
      confirmed: true,
    },
    outline: {
      titleOptions: ['关于开展专项检查的通知'],
      sections: [
        {
          id: 'o-1',
          heading: '一、总体要求',
          purpose: '说明背景',
          keyPoints: ['提高认识'],
        },
      ],
      risks: ['时间安排偏紧'],
      outlineVersion: 'outline-v1',
      confirmed: true,
    },
    sections: [
      {
        id: 's-current',
        heading: '当前正文',
        body: '当前草稿内容',
      },
    ],
    active_rule_ids: ['rule-1'],
    active_reference_ids: ['ref-1'],
    version_count: 4,
    generated_title: '当前标题',
    generated_content: '当前草稿内容',
    updated_at: '2026-03-26T10:00:00.000Z',
  };
}

function createVersion(): VersionRecord {
  return {
    id: 'version-1',
    draft_id: 'draft-1',
    user_id: 'user-1',
    stage: 'review_applied',
    title: '历史版本标题',
    content: '历史版本正文',
    sections: [
      {
        id: 's-restored',
        heading: '恢复后的正文',
        body: '恢复后的内容',
      },
    ],
    change_summary: '应用审校意见',
    created_at: '2026-03-25T10:00:00.000Z',
  };
}

test('mergeRestoredDraft replaces generated content while preserving workflow metadata and base draft fields', () => {
  const merged = mergeRestoredDraft(createDraft(), createVersion(), '2026-03-26T12:00:00.000Z');

  assert.equal(merged.generated_title, '历史版本标题');
  assert.equal(merged.generated_content, '历史版本正文');
  assert.deepEqual(merged.sections, [
    {
      id: 's-restored',
      heading: '恢复后的正文',
      body: '恢复后的内容',
    },
  ]);
  assert.equal(merged.workflow_stage, 'draft');
  assert.deepEqual(merged.planning, createDraft().planning);
  assert.deepEqual(merged.outline, createDraft().outline);
  assert.deepEqual(merged.active_rule_ids, ['rule-1']);
  assert.deepEqual(merged.active_reference_ids, ['ref-1']);
  assert.equal(merged.title, '关于开展专项检查的通知');
  assert.equal(merged.recipient, '各相关单位');
  assert.equal(merged.version_count, 4);
  assert.equal(merged.updated_at, '2026-03-26T12:00:00.000Z');
});

test('buildRestoreResponse returns DraftRecord-shaped authoritative draft payload instead of raw version data', () => {
  const draft = mergeRestoredDraft(createDraft(), createVersion(), '2026-03-26T12:00:00.000Z');
  const response = buildRestoreResponse(draft, createVersion());

  assert.equal(response.draft.id, 'draft-1');
  assert.equal(response.draft.generated_title, '历史版本标题');
  assert.equal(response.draft.generated_content, '历史版本正文');
  assert.equal(response.draft.workflow_stage, 'draft');
  assert.equal(response.restoredVersion.id, 'version-1');
  assert.equal(response.restoredVersion.stage, 'review_applied');
  assert.ok(!('draft_id' in response.draft));
});

test('buildRestoreResponse keeps restore history append-only and version counts server-derived', () => {
  const draft = mergeRestoredDraft(createDraft(), createVersion(), '2026-03-26T12:00:00.000Z');
  const response = buildRestoreResponse(draft, createVersion(), 5);

  assert.equal(response.draft.version_count, 5);
  assert.equal(response.restoredSnapshot.stage, 'restored');
  assert.equal(response.restoredSnapshot.title, '历史版本标题');
  assert.equal(response.restoredSnapshot.content, '历史版本正文');
  assert.match(response.restoredSnapshot.change_summary ?? '', /从历史版本恢复/);
});
