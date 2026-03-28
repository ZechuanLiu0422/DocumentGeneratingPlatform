import { z } from 'zod';

export const docTypeSchema = z.enum(['notice', 'letter', 'request', 'report']);
export const providerSchema = z.enum(['claude', 'openai', 'doubao', 'glm']);
export const phraseTypeSchema = z.enum(['recipient', 'issuer']);
export const workflowStageSchema = z.enum(['intake', 'planning', 'outline', 'draft', 'review', 'done']);
export const writingRuleTypeSchema = z.enum([
  'required_phrase',
  'forbidden_phrase',
  'tone_rule',
  'structure_rule',
  'ending_rule',
  'organization_fact',
]);

const limitedString = (label: string, max: number) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, `${label}不能超过 ${max} 个字符`);

const optionalLimitedString = (max: number) => z.string().trim().max(max).optional().default('');

const looseStringValueSchema = z.union([z.string().trim().max(4000), z.array(z.string().trim().max(200)), z.null()]);
const uuidListSchema = z.array(z.string().uuid()).max(50).default([]);

export const referenceAnalysisSchema = z.object({
  tone: z.string().trim().max(400),
  structure: z.string().trim().max(400),
  vocabulary: z.string().trim().max(400),
  sentenceStyle: z.string().trim().max(400),
  logicFlow: z.string().trim().max(400),
});

export const outlineSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  heading: z.string().trim().min(1).max(120),
  purpose: z.string().trim().min(1).max(300),
  keyPoints: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  notes: z.string().trim().max(300).optional().default(''),
});

export const planningSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  headingDraft: z.string().trim().min(1).max(160),
  purpose: z.string().trim().min(1).max(300),
  topicSummary: z.string().trim().min(1).max(300),
  orderReason: z.string().trim().min(1).max(300),
});

export const draftPlanningSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  headingDraft: z.string().trim().max(160).optional().default(''),
  purpose: z.string().trim().max(300).optional().default(''),
  topicSummary: z.string().trim().max(300).optional().default(''),
  orderReason: z.string().trim().max(300).optional().default(''),
});

export const planningOptionSchema = z.object({
  planId: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  strategy: z.string().trim().min(1).max(240),
  whyThisWorks: z.string().trim().min(1).max(400),
  sections: z.array(planningSectionSchema).min(1).max(8),
});

export const draftSectionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(4000),
});

export const sectionSourceRefSchema = z.object({
  sourceType: z.enum(['reference_asset', 'session_reference', 'writing_rule']),
  sourceId: z.string().trim().max(120).optional().default(''),
  label: z.string().trim().min(1).max(120),
  excerpt: z.string().trim().min(1).max(800),
  reason: z.string().trim().max(240).optional().default(''),
});

export const sectionProvenanceSchema = z.object({
  summary: z.string().trim().max(240).optional().default(''),
  sources: z.array(sectionSourceRefSchema).min(1).max(4),
});

export const trustedDraftSectionSchema = draftSectionSchema.extend({
  provenance: sectionProvenanceSchema.nullable().optional().default(null),
});

export const reviewCheckSchema = z.object({
  code: z.string().trim().min(1).max(80),
  status: z.enum(['pass', 'warning', 'fail']),
  message: z.string().trim().min(1).max(400),
  fixPrompt: z.string().trim().max(500).optional().default(''),
});

export const reviewStateSchema = z.object({
  content_hash: z.string().trim().min(1).max(160),
  doc_type: docTypeSchema,
  status: z.enum(['pass', 'warning', 'fail']),
  ran_at: z.string().datetime({ offset: true }),
  checks: z.array(reviewCheckSchema).max(20).default([]),
});

export const changeCandidateTargetTypeSchema = z.enum(['selection', 'section', 'full']);
export const changeCandidateActionSchema = z.enum(['regenerate', 'revise', 'restore']);

export const changeCandidateSnapshotSchema = z.object({
  title: z.string().trim().max(200).nullable().optional().default(null),
  content: z.string().trim().max(20000).nullable().optional().default(null),
  sections: z.array(trustedDraftSectionSchema).max(12).default([]),
  reviewState: reviewStateSchema.nullable().optional().default(null),
});

const changeCandidateSectionIdsSchema = z.array(z.string().trim().min(1).max(80)).max(12).default([]);

export const changeCandidatePreviewSchema = z.object({
  candidateId: z.string().uuid(),
  action: changeCandidateActionSchema,
  targetType: changeCandidateTargetTypeSchema,
  targetSectionIds: changeCandidateSectionIdsSchema,
  changedSectionIds: changeCandidateSectionIdsSchema,
  unchangedSectionIds: changeCandidateSectionIdsSchema,
  before: changeCandidateSnapshotSchema,
  after: changeCandidateSnapshotSchema,
  diffSummary: z.string().trim().max(500).optional().default(''),
});

export const pendingChangeStateSchema = changeCandidatePreviewSchema.extend({
  userId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  baseUpdatedAt: z.string().datetime({ offset: true }),
});

export const candidateDecisionSchema = z.enum(['preview', 'accept', 'reject']);

export const draftOperationTypeSchema = z.enum([
  'draft_generate',
  'draft_regenerate',
  'draft_revise',
  'review',
  'export',
]);

export const draftOperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

export const draftOperationIdempotencyKeySchema = z
  .string()
  .trim()
  .min(1, '幂等键不能为空')
  .max(160, '幂等键不能超过 160 个字符')
  .regex(/^[A-Za-z0-9:_-]+$/, '幂等键格式不正确');

export const draftOperationPayloadSchema = z.record(z.string(), z.unknown());
export const draftOperationResultSchema = z.record(z.string(), z.unknown());

export const draftOperationInsertSchema = z.object({
  user_id: z.string().uuid(),
  draft_id: z.string().uuid().nullable().optional().default(null),
  operation_type: draftOperationTypeSchema,
  status: draftOperationStatusSchema.default('queued'),
  idempotency_key: draftOperationIdempotencyKeySchema,
  payload: draftOperationPayloadSchema,
  result: draftOperationResultSchema.nullable().optional().default(null),
  error_code: z.string().trim().max(120).nullable().optional().default(null),
  error_message: z.string().trim().max(1000).nullable().optional().default(null),
  attempt_count: z.number().int().min(0).optional().default(0),
  max_attempts: z.number().int().min(1).max(20).optional().default(3),
  lease_token: z.string().trim().max(160).nullable().optional().default(null),
  lease_expires_at: z.string().datetime({ offset: true }).nullable().optional().default(null),
  last_heartbeat_at: z.string().datetime({ offset: true }).nullable().optional().default(null),
  started_at: z.string().datetime({ offset: true }).nullable().optional().default(null),
  completed_at: z.string().datetime({ offset: true }).nullable().optional().default(null),
});

export const draftOperationRecordSchema = draftOperationInsertSchema.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export const draftOperationReadModelSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  draftId: z.string().uuid().nullable(),
  operationType: draftOperationTypeSchema,
  status: draftOperationStatusSchema,
  idempotencyKey: draftOperationIdempotencyKeySchema,
  payload: draftOperationPayloadSchema,
  result: draftOperationResultSchema.nullable(),
  errorCode: z.string().trim().max(120).nullable(),
  errorMessage: z.string().trim().max(1000).nullable(),
  attemptCount: z.number().int().min(0),
  maxAttempts: z.number().int().min(1).max(20),
  leaseToken: z.string().trim().max(160).nullable(),
  leaseExpiresAt: z.string().datetime({ offset: true }).nullable(),
  lastHeartbeatAt: z.string().datetime({ offset: true }).nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const changeCandidateAcceptRequestSchema = z
  .object({
    draftId: z.string().uuid(),
    candidateId: z.string().uuid(),
    action: changeCandidateActionSchema,
    targetType: changeCandidateTargetTypeSchema,
    targetSectionIds: changeCandidateSectionIdsSchema,
  })
  .superRefine((value, ctx) => {
    if (value.targetType === 'section' && value.targetSectionIds.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetSectionIds'],
        message: '段落级候选变更必须且只能指定一个段落',
      });
    }

    if (value.targetType === 'selection' && value.targetSectionIds.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetSectionIds'],
        message: '片段级候选变更必须绑定至少一个段落',
      });
    }

    if (value.targetType === 'full' && value.targetSectionIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetSectionIds'],
        message: '整稿候选变更不能声明段落范围',
      });
    }
  });

export const changeCandidateRejectRequestSchema = z.object({
  draftId: z.string().uuid(),
  candidateId: z.string().uuid(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('请输入有效邮箱'),
  password: z.string().min(8, '密码至少需要 8 位'),
});

export const profileSchema = z.object({
  displayName: z.string().trim().max(80, '显示名称不能超过 80 个字符'),
});

export const changePasswordSchema = z
  .object({
    password: z.string().min(12, '新密码至少需要 12 位'),
    confirmPassword: z.string().min(12, '确认密码至少需要 12 位'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export const contactSchema = z.object({
  name: limitedString('联系人', 80),
  phone: limitedString('电话', 40),
});

export const phraseSchema = z.object({
  type: phraseTypeSchema,
  phrase: limitedString('常用信息', 120),
});

export const draftSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  docType: docTypeSchema,
  title: optionalLimitedString(200),
  recipient: optionalLimitedString(200),
  content: optionalLimitedString(12000),
  issuer: optionalLimitedString(200),
  date: optionalLimitedString(20),
  provider: providerSchema,
  contactName: optionalLimitedString(80),
  contactPhone: optionalLimitedString(40),
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  workflowStage: workflowStageSchema.optional().default('intake'),
  collectedFacts: z.record(z.string(), looseStringValueSchema).optional().default({}),
  missingFields: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  outline: z
    .object({
      titleOptions: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
      sections: z.array(outlineSectionSchema).max(12).default([]),
      risks: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
      outlineVersion: z.string().trim().max(80).optional().default(''),
      confirmed: z.boolean().optional().default(false),
    })
    .nullable()
    .optional()
    .default(null),
  planning: z
    .object({
      options: z.array(planningOptionSchema).max(5).default([]),
      selectedPlanId: z.string().trim().max(80).optional().default(''),
      sections: z.array(draftPlanningSectionSchema).max(8).default([]),
      planVersion: z.string().trim().max(80).optional().default(''),
      confirmed: z.boolean().optional().default(false),
    })
    .nullable()
    .optional()
    .default(null),
  sections: z.array(draftSectionSchema).max(12).default([]),
  activeRuleIds: uuidListSchema,
  activeReferenceIds: uuidListSchema,
  versionCount: z.number().int().min(0).optional().default(0),
  generatedTitle: optionalLimitedString(200),
  generatedContent: optionalLimitedString(20000),
});

export const draftSaveSchema = draftSchema
  .pick({
    id: true,
    docType: true,
    title: true,
    recipient: true,
    content: true,
    issuer: true,
    date: true,
    provider: true,
    contactName: true,
    contactPhone: true,
    attachments: true,
  })
  .strict();

export const polishSchema = z.object({
  docType: docTypeSchema,
  title: z.string().trim().max(200).optional().default(''),
  recipient: limitedString('主送机关', 200),
  content: limitedString('内容', 12000),
  provider: providerSchema,
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  referenceAnalysis: referenceAnalysisSchema.optional().nullable(),
  imitationStrength: z.enum(['strict', 'moderate', 'loose']).optional().default('moderate'),
});

export const refineSchema = z.object({
  docType: docTypeSchema,
  recipient: limitedString('主送机关', 200),
  originalContent: limitedString('原始内容', 12000),
  userFeedback: limitedString('修改意见', 2000),
  provider: providerSchema,
});

export const analyzeReferenceSchema = z.object({
  docType: docTypeSchema,
  fileContent: limitedString('参考内容', 30000),
  provider: providerSchema,
});

export const generateSchema = z.object({
  draftId: z.string().uuid().optional().nullable(),
  docType: docTypeSchema,
  title: limitedString('标题', 200),
  recipient: limitedString('主送机关', 200),
  content: limitedString('原始内容', 12000),
  issuer: limitedString('发文机关', 200),
  date: limitedString('成文日期', 20),
  generatedContent: limitedString('生成内容', 20000),
  provider: providerSchema,
  attachments: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
  contactName: z.string().trim().max(80).optional().default(''),
  contactPhone: z.string().trim().max(40).optional().default(''),
  sections: z.array(draftSectionSchema).max(12).optional().default([]),
});

export const deleteIdSchema = z.object({
  id: z.string().uuid('参数 id 不正确'),
});

export const historyQuerySchema = z.object({
  id: z.string().uuid().optional(),
});

export const uploadDocTypeSchema = z.object({
  docType: docTypeSchema,
});

export const writingRuleSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: limitedString('规则名称', 120),
  docType: docTypeSchema.nullable().optional().default(null),
  ruleType: writingRuleTypeSchema,
  content: limitedString('规则内容', 1000),
  priority: z.number().int().min(0).max(100).optional().default(50),
  enabled: z.boolean().optional().default(true),
});

export const referenceAssetSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  name: limitedString('参考名称', 120),
  docType: docTypeSchema.nullable().optional().default(null),
  fileName: limitedString('文件名', 240),
  fileType: limitedString('文件类型', 40),
  content: limitedString('参考内容', 30000),
  analysis: referenceAnalysisSchema.nullable().optional().default(null),
  isFavorite: z.boolean().optional().default(false),
});

export const sessionReferenceSchema = z.object({
  name: limitedString('参考名称', 120),
  docType: docTypeSchema.nullable().optional().default(null),
  fileName: limitedString('文件名', 240),
  fileType: limitedString('文件类型', 40),
  content: limitedString('参考内容', 30000),
  analysis: referenceAnalysisSchema.nullable().optional().default(null),
});

export const intakeSchema = z.object({
  draftId: z.string().uuid().optional().nullable(),
  docType: docTypeSchema,
  provider: providerSchema,
  answers: z.record(z.string(), looseStringValueSchema).optional().default({}),
  message: z.string().trim().max(4000).optional().default(''),
  activeRuleIds: uuidListSchema,
  activeReferenceIds: uuidListSchema,
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
});

export const outlineRequestSchema = z.object({
  draftId: z.string().uuid(),
  provider: providerSchema,
  confirmedPlan: z
    .object({
      selectedPlanId: z.string().trim().max(80).optional().default(''),
      sections: z.array(draftPlanningSectionSchema).min(1).max(8),
    })
    .optional()
    .nullable(),
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
});

export const outlinePlanRequestSchema = z.object({
  draftId: z.string().uuid(),
  provider: providerSchema,
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
});

export const outlineConfirmSchema = z.object({
  draftId: z.string().uuid(),
  outlineVersion: z.string().trim().max(80).optional().default(''),
  acceptedOutline: z.object({
    title: z.string().trim().max(200).optional().default(''),
    titleOptions: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
    sections: z.array(outlineSectionSchema).min(1).max(12),
    risks: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
  }),
});

export const draftRequestSchema = z.object({
  draftId: z.string().uuid(),
  provider: providerSchema,
  mode: z.enum(['full', 'section']).default('full'),
  sectionId: z.string().trim().max(80).optional().default(''),
  decision: candidateDecisionSchema.optional().default('preview'),
  candidateId: z.string().uuid().optional().nullable(),
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
}).superRefine((value, ctx) => {
  if (value.mode === 'section' && value.decision === 'preview' && !value.sectionId.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sectionId'],
      message: '段落重生成必须指定目标段落',
    });
  }

  if (value.mode === 'full' && value.decision !== 'preview') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision'],
      message: '整稿生成不支持候选接受或拒绝',
    });
  }

  if (value.decision !== 'preview' && !value.candidateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidateId'],
      message: '接受或拒绝候选变更时必须提供 candidateId',
    });
  }
});

export const reviseRequestSchema = z.object({
  draftId: z.string().uuid(),
  provider: providerSchema,
  targetType: z.enum(['selection', 'section', 'full']),
  targetId: z.string().trim().max(80).optional().default(''),
  selectedText: z.string().trim().max(2000).optional().default(''),
  instruction: z.string().trim().max(1000).optional().default(''),
  decision: candidateDecisionSchema.optional().default('preview'),
  candidateId: z.string().uuid().optional().nullable(),
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
}).superRefine((value, ctx) => {
  if (value.decision === 'preview' && !value.instruction.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['instruction'],
      message: '修改指令不能为空',
    });
  }

  if (value.targetType === 'section' && value.decision === 'preview' && !value.targetId.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetId'],
      message: '段落级改写必须指定目标段落',
    });
  }

  if (value.targetType === 'selection' && value.decision === 'preview' && !value.selectedText.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selectedText'],
      message: '片段级改写必须提供选中文本',
    });
  }

  if (value.decision !== 'preview' && !value.candidateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidateId'],
      message: '接受或拒绝候选变更时必须提供 candidateId',
    });
  }
});

export const reviewRequestSchema = z.object({
  draftId: z.string().uuid(),
  provider: providerSchema,
  sessionReferences: z.array(sessionReferenceSchema).max(5).default([]),
});

export const versionQuerySchema = z.object({
  draftId: z.string().uuid(),
});

export const versionRestoreSchema = z.object({
  draftId: z.string().uuid(),
  versionId: z.string().uuid().optional().nullable(),
  decision: candidateDecisionSchema.optional().default('preview'),
  candidateId: z.string().uuid().optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.decision === 'preview' && !value.versionId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['versionId'],
      message: '恢复预览必须指定版本 id',
    });
  }

  if (value.decision !== 'preview' && !value.candidateId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidateId'],
      message: '接受或拒绝候选变更时必须提供 candidateId',
    });
  }
});

export type SectionSourceRef = z.infer<typeof sectionSourceRefSchema>;
export type SectionProvenance = z.infer<typeof sectionProvenanceSchema>;
export type TrustedDraftSection = z.infer<typeof draftSectionSchema> & {
  provenance?: SectionProvenance | null;
};
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type ChangeCandidateTargetType = z.infer<typeof changeCandidateTargetTypeSchema>;
export type ChangeCandidateAction = z.infer<typeof changeCandidateActionSchema>;
export type ChangeCandidateSnapshot = {
  title?: string | null;
  content?: string | null;
  sections: TrustedDraftSection[];
  reviewState?: ReviewState | null;
};
export type ChangeCandidatePreview = {
  candidateId: string;
  action: ChangeCandidateAction;
  targetType: ChangeCandidateTargetType;
  targetSectionIds: string[];
  changedSectionIds: string[];
  unchangedSectionIds: string[];
  before: ChangeCandidateSnapshot;
  after: ChangeCandidateSnapshot;
  diffSummary?: string;
};
export type PendingChangeState = z.infer<typeof pendingChangeStateSchema>;
export type DraftOperationType = z.infer<typeof draftOperationTypeSchema>;
export type DraftOperationStatus = z.infer<typeof draftOperationStatusSchema>;
export type DraftOperationInsertInput = z.input<typeof draftOperationInsertSchema>;
export type DraftOperationInsert = z.infer<typeof draftOperationInsertSchema>;
export type DraftOperationRecord = z.infer<typeof draftOperationRecordSchema>;
export type DraftOperationReadModel = z.infer<typeof draftOperationReadModelSchema>;
