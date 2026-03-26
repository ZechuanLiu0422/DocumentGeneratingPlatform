export function buildSessionReference() {
  return {
    name: '办公室发文规范',
    docType: 'notice' as const,
    fileName: 'notice-guide.docx',
    fileType: 'application/docx',
    content: '发文应先说明背景，再明确任务与时间要求。',
    analysis: {
      tone: '正式、克制',
      structure: '背景、要求、落实',
      vocabulary: '规范简洁',
      sentenceStyle: '短句为主',
      logicFlow: '先总后分',
    },
  };
}

export function buildIntakeRequestBody() {
  return {
    draftId: null,
    docType: 'notice' as const,
    provider: 'claude' as const,
    answers: {
      topic: '专项检查',
      objective: '统一工作要求',
    },
    message: '需要形成正式通知',
    activeRuleIds: ['33333333-3333-4333-8333-333333333333'],
    activeReferenceIds: ['44444444-4444-4444-8444-444444444444'],
    sessionReferences: [buildSessionReference()],
  };
}

export function buildOutlinePlanRequestBody() {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    provider: 'claude' as const,
    sessionReferences: [buildSessionReference()],
  };
}

export function buildOutlineRequestBody() {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    provider: 'claude' as const,
    confirmedPlan: {
      selectedPlanId: 'plan-1',
      sections: [
        {
          id: 'plan-sec-1',
          headingDraft: '一、工作目标',
          purpose: '明确目标',
          topicSummary: '统一推进专项检查',
          orderReason: '先说明总体要求',
        },
      ],
    },
    sessionReferences: [buildSessionReference()],
  };
}

export function buildDraftRequestBody() {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    provider: 'claude' as const,
    mode: 'full' as const,
    sectionId: '',
    sessionReferences: [buildSessionReference()],
  };
}

export function buildReviewRequestBody() {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    provider: 'claude' as const,
    sessionReferences: [buildSessionReference()],
  };
}

export function buildGenerateRequestBody() {
  return {
    draftId: '22222222-2222-4222-8222-222222222222',
    docType: 'notice' as const,
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    generatedContent: '一、工作目标\n请按要求准备材料。',
    provider: 'claude' as const,
    attachments: ['附件1'],
    contactName: '张三',
    contactPhone: '12345678',
    sections: [
      {
        id: 'draft-sec-1',
        heading: '一、工作目标',
        body: '请按要求准备材料。',
      },
    ],
  };
}

export function buildDraftFixture() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice' as const,
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude' as const,
    contact_name: '张三',
    contact_phone: '12345678',
    attachments: ['附件1'],
    workflow_stage: 'review' as const,
    collected_facts: {
      topic: '专项检查',
      objective: '统一工作要求',
    },
    missing_fields: [],
    planning: {
      options: [
        {
          planId: 'plan-1',
          label: '标准通知结构',
          strategy: '背景-要求-落实',
          whyThisWorks: '符合现有发文习惯',
          sections: [
            {
              id: 'plan-sec-1',
              headingDraft: '一、工作目标',
              purpose: '明确目标',
              topicSummary: '统一推进专项检查',
              orderReason: '先说明总体要求',
            },
          ],
        },
      ],
      selectedPlanId: 'plan-1',
      sections: [
        {
          id: 'plan-sec-1',
          headingDraft: '一、工作目标',
          purpose: '明确目标',
          topicSummary: '统一推进专项检查',
          orderReason: '先说明总体要求',
        },
      ],
      planVersion: 'plan-v1',
      confirmed: true,
    },
    outline: {
      titleOptions: ['关于开展专项检查的通知'],
      sections: [
        {
          id: 'outline-sec-1',
          heading: '一、工作目标',
          purpose: '明确专项检查要求',
          keyPoints: ['统一标准', '按时落实'],
          notes: '',
        },
      ],
      risks: ['措辞应保持正式'],
      outlineVersion: 'outline-v1',
      confirmed: true,
    },
    sections: [
      {
        id: 'draft-sec-1',
        heading: '一、工作目标',
        body: '请按要求准备材料。',
      },
    ],
    active_rule_ids: ['33333333-3333-4333-8333-333333333333'],
    active_reference_ids: ['44444444-4444-4444-8444-444444444444'],
    version_count: 3,
    generated_title: '关于开展专项检查的通知',
    generated_content: '一、工作目标\n请按要求准备材料。',
    updated_at: '2026-03-26T00:00:00.000Z',
  };
}

export function buildVersionFixture() {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    draft_id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    stage: 'draft_generated' as const,
    title: '关于开展专项检查的通知',
    content: '一、工作目标\n请按要求准备材料。',
    sections: [
      {
        id: 'draft-sec-1',
        heading: '一、工作目标',
        body: '请按要求准备材料。',
      },
    ],
    change_summary: '已生成正文',
    created_at: '2026-03-26T00:00:00.000Z',
  };
}

export function buildSparseDraftFixture() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice' as const,
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude' as const,
    contact_name: '张三',
    contact_phone: '12345678',
    attachments: null,
    workflow_stage: 'intake' as const,
    collected_facts: null,
    missing_fields: null,
    planning: null,
    outline: null,
    sections: null,
    active_rule_ids: null,
    active_reference_ids: null,
    version_count: null,
    generated_title: '',
    generated_content: '',
    updated_at: '2026-03-26T00:00:00.000Z',
  };
}

export function buildSparseVersionFixture() {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    draft_id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    stage: 'draft_generated' as const,
    title: '关于开展专项检查的通知',
    content: '一、工作目标\n请按要求准备材料。',
    sections: null,
    change_summary: '已生成正文',
    created_at: '2026-03-26T00:00:00.000Z',
  };
}
