import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraftSaveRequest, deriveHydratedDraftView } from '../../lib/generate-workspace.ts';

function createDraftSnapshot() {
  return {
    id: 'draft-1',
    doc_type: 'notice' as const,
    title: '服务器标题',
    recipient: '各相关单位',
    content: '基础材料',
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude' as const,
    contactName: '张三',
    contactPhone: '12345678',
    attachments: ['附件1'],
    workflowStage: 'review' as const,
    collectedFacts: { topic: '专项检查' },
    missingFields: [],
    planning: {
      options: [
        {
          planId: 'plan-1',
          label: '方案一',
          strategy: '先总后分',
          whyThisWorks: '符合阅读顺序',
          sections: [
            {
              id: 'p-1',
              headingDraft: '工作安排',
              purpose: '明确安排',
              topicSummary: '部署任务',
              orderReason: '先部署',
            },
          ],
        },
      ],
      selectedPlanId: 'plan-1',
      sections: [
        {
          id: 'p-1',
          headingDraft: '工作安排',
          purpose: '明确安排',
          topicSummary: '部署任务',
          orderReason: '先部署',
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
      risks: ['时间紧'],
      outlineVersion: 'outline-v1',
      confirmed: true,
    },
    sections: [
      {
        id: 's-1',
        heading: '一、总体要求',
        body: '这里是正文',
      },
    ],
    activeRuleIds: ['rule-1'],
    activeReferenceIds: ['ref-1'],
    versionCount: 5,
    generatedTitle: 'AI 标题',
    generatedContent: 'AI 正文',
  };
}

test('buildDraftSaveRequest sends only editable draft fields', () => {
  const payload = buildDraftSaveRequest({
    currentDraftId: 'draft-1',
    docType: 'notice',
    formData: {
      title: '浏览器标题',
      recipient: '各相关单位',
      content: '基础材料',
      issuer: '办公室',
      date: '2026-03-26',
      contactName: '张三',
      contactPhone: '12345678',
    },
    provider: 'claude',
    attachments: ['附件1'],
  });

  assert.deepEqual(payload, {
    id: 'draft-1',
    docType: 'notice',
    title: '浏览器标题',
    recipient: '各相关单位',
    content: '基础材料',
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude',
    contactName: '张三',
    contactPhone: '12345678',
    attachments: ['附件1'],
  });
  assert.ok(!('workflowStage' in payload));
  assert.ok(!('planning' in payload));
  assert.ok(!('outline' in payload));
  assert.ok(!('sections' in payload));
  assert.ok(!('generatedContent' in payload));
});

test('deriveHydratedDraftView uses the authoritative draft snapshot to rebuild workspace state', () => {
  const hydrated = deriveHydratedDraftView(createDraftSnapshot());

  assert.equal(hydrated.currentDraftId, 'draft-1');
  assert.equal(hydrated.workflowStage, 'review');
  assert.equal(hydrated.currentStep, 'review');
  assert.equal(hydrated.formData.title, 'AI 标题');
  assert.equal(hydrated.formData.recipient, '各相关单位');
  assert.deepEqual(hydrated.planningSections, createDraftSnapshot().planning?.sections);
  assert.deepEqual(hydrated.outlineSections, createDraftSnapshot().outline?.sections);
  assert.deepEqual(hydrated.sections, createDraftSnapshot().sections);
  assert.deepEqual(hydrated.activeRuleIds, ['rule-1']);
  assert.deepEqual(hydrated.activeReferenceIds, ['ref-1']);
  assert.equal(hydrated.readiness, 'ready');
});
