import { createHash } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '@/lib/api';
import { type DraftSectionRecord, type OutlineSectionRecord, type PlanningOptionRecord, type PlanningSectionRecord, type ReferenceAssetRecord, type WritingRuleRecord, compileSectionsToContent } from '@/lib/collaborative-store';
import { DOC_TYPE_NAMES, callModel, sanitizeModelOutput, type AnalyzeResult } from '@/lib/official-document-ai';
import type { Provider } from '@/lib/providers';
import { draftSectionSchema, outlineSectionSchema, planningOptionSchema, planningSectionSchema, reviewCheckSchema, type SectionSourceRef } from '@/lib/validation';

type DocType = keyof typeof DOC_TYPE_NAMES;

type FieldSpec = {
  id: string;
  label: string;
  description: string;
};

type WorkflowQuestion = {
  id: string;
  label: string;
  question: string;
  placeholder: string;
};

type IntakeResult = {
  readiness: 'needs_more' | 'ready';
  collectedFacts: Record<string, string | string[]>;
  missingFields: string[];
  nextQuestions: WorkflowQuestion[];
  suggestedTitle: string;
};

type OutlineResult = {
  outlineVersion: string;
  titleOptions: string[];
  outlineSections: OutlineSectionRecord[];
  risks: string[];
};

type PlanningResult = {
  planVersion: string;
  options: PlanningOptionRecord[];
};

export type DraftResult = {
  title: string;
  sections: DraftSectionRecord[];
  content: string;
};

export type ReviseResult = {
  title?: string;
  updatedContent: string;
  updatedSections: DraftSectionRecord[];
  changeSummary: string;
};

type ReviewCheck = z.infer<typeof reviewCheckSchema>;
type ReviewState = {
  content_hash: string;
  doc_type: DocType;
  status: 'pass' | 'warning' | 'fail';
  ran_at: string;
  checks: ReviewCheck[];
};
type StructuredCallMode = 'fallback' | 'throw';
type DraftSectionBrief = {
  id: string;
  heading: string;
  mustCover: string[];
  writingTask: string;
};

const MODEL_TOKEN_BUDGETS = {
  intake: 1800,
  outline: 2400,
  planning: 2600,
  draft: 4000,
  sectionDraft: 2600,
  revise: 2200,
  review: 1800,
} as const;

const MIN_DRAFT_BODY_LENGTH = 50;
const MIN_SECTION_REWRITE_LENGTH = 40;

const intakeResponseSchema = z.object({
  collectedFacts: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  missingFields: z.array(z.string()).default([]),
  nextQuestions: z
    .array(
      z.object({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(80),
        question: z.string().min(1).max(200),
        placeholder: z.string().min(1).max(200),
      })
    )
    .max(3)
    .default([]),
  readiness: z.enum(['needs_more', 'ready']).default('needs_more'),
  suggestedTitle: z.string().max(200).default(''),
});

const outlineResponseSchema = z.object({
  titleOptions: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  outlineSections: z.array(outlineSectionSchema).min(1).max(12),
  risks: z.array(z.string().trim().min(1).max(240)).max(8).default([]),
});

const planningResponseSchema = z.object({
  options: z.array(planningOptionSchema).length(3),
});

const draftResponseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sections: z.array(draftSectionSchema).min(1).max(12),
  content: z.string().trim().max(20000).optional().default(''),
});

const sectionDraftResponseSchema = z.object({
  section: draftSectionSchema,
  changeSummary: z.string().trim().max(240).optional().default('已重写目标段落'),
});

const reviseSelectionSchema = z.object({
  updatedText: z.string().trim().min(1).max(4000),
  changeSummary: z.string().trim().min(1).max(240),
});

const reviseSectionSchema = z.object({
  updatedSection: draftSectionSchema,
  changeSummary: z.string().trim().min(1).max(240),
});

const reviseFullSchema = z.object({
  title: z.string().trim().max(200).optional().default(''),
  sections: z.array(draftSectionSchema).min(1).max(12),
  changeSummary: z.string().trim().min(1).max(240),
});

const reviewResponseSchema = z.object({
  checks: z.array(reviewCheckSchema).max(10).default([]),
});

const DOC_TYPE_CONFIG: Record<
  DocType,
  {
    purpose: string;
    requiredFields: FieldSpec[];
    defaultOutline: string[];
    requiredEnding: string;
  }
> = {
  notice: {
    purpose: '用于发布重要事项、安排工作和提出执行要求。',
    requiredFields: [
      { id: 'subject', label: '通知事项', description: '本次通知的核心事项或主题。' },
      { id: 'background', label: '背景依据', description: '为什么发文，依据什么精神或背景。' },
      { id: 'action_items', label: '具体要求', description: '希望收文单位落实的动作和要求。' },
      { id: 'deadline', label: '时间要求', description: '完成时间、会议时间或执行时限。' },
      { id: 'responsibility', label: '责任分工', description: '谁牵头、谁配合、谁负责。' },
    ],
    defaultOutline: ['一、总体要求', '二、重点任务', '三、工作要求'],
    requiredEnding: '特此通知',
  },
  letter: {
    purpose: '用于不相隶属机关之间商洽工作、请求协作或答复事项。',
    requiredFields: [
      { id: 'subject', label: '函件主题', description: '本函要沟通的事项。' },
      { id: 'background', label: '来往背景', description: '形成此函的背景、前情或工作缘由。' },
      { id: 'request_items', label: '请求或告知事项', description: '希望对方配合、支持或知悉的内容。' },
      { id: 'boundary', label: '协作边界', description: '职责分工、需要对方完成的部分。' },
      { id: 'response_expectation', label: '回复期待', description: '希望何时何种方式反馈。' },
    ],
    defaultOutline: ['一、来函背景', '二、商洽事项', '三、希望支持事项'],
    requiredEnding: '请予支持为盼',
  },
  request: {
    purpose: '用于下级机关向上级机关请求指示、批准。',
    requiredFields: [
      { id: 'subject', label: '请示事项', description: '需要上级审批或指示的具体事项。' },
      { id: 'background', label: '背景依据', description: '政策依据、现实背景和问题来源。' },
      { id: 'reason', label: '必要性理由', description: '为什么必须请示，理由依据是什么。' },
      { id: 'current_work', label: '前期工作', description: '本单位已经开展的工作。' },
      { id: 'request_decision', label: '拟请批示内容', description: '希望上级批复的明确结论。' },
    ],
    defaultOutline: ['一、基本情况', '二、请示理由', '三、拟请示事项'],
    requiredEnding: '妥否，请批示',
  },
  report: {
    purpose: '用于向上级机关汇报工作、反映情况、提出建议。',
    requiredFields: [
      { id: 'subject', label: '报告主题', description: '本次报告围绕的工作或事项。' },
      { id: 'background', label: '背景依据', description: '报告形成背景及工作依据。' },
      { id: 'progress', label: '工作进展', description: '已做工作、取得成效。' },
      { id: 'issues', label: '问题困难', description: '目前存在的问题、风险或瓶颈。' },
      { id: 'next_steps', label: '下一步安排', description: '后续工作计划和建议。' },
    ],
    defaultOutline: ['一、总体情况', '二、主要进展', '三、存在问题', '四、下一步打算'],
    requiredEnding: '特此报告',
  },
};

function normalizeValue(value: unknown): string | string[] | null {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    return normalized.length > 0 ? normalized : null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  return null;
}

function normalizeFacts(raw: Record<string, unknown>) {
  const facts: Record<string, string | string[]> = {};

  Object.entries(raw).forEach(([key, value]) => {
    const normalized = normalizeValue(value);
    if (normalized) {
      facts[key] = normalized;
    }
  });

  return facts;
}

function mergeFacts(...sources: Array<Record<string, unknown>>) {
  const merged: Record<string, string | string[]> = {};

  sources.forEach((source) => {
    Object.entries(normalizeFacts(source)).forEach(([key, value]) => {
      merged[key] = value;
    });
  });

  return merged;
}

function formatFieldList(fields: FieldSpec[]) {
  return fields.map((field) => `- ${field.id}（${field.label}）：${field.description}`).join('\n');
}

function formatRules(rules: WritingRuleRecord[]) {
  if (rules.length === 0) {
    return '无';
  }

  return rules
    .map((rule) => `- [${rule.rule_type}] ${rule.name}：${rule.content}`)
    .join('\n');
}

function formatReferences(references: ReferenceAssetRecord[]) {
  if (references.length === 0) {
    return '无';
  }

  return references
    .map((asset) => {
      const analysis = asset.analysis
        ? `语气：${asset.analysis.tone}；结构：${asset.analysis.structure}；用词：${asset.analysis.vocabulary}`
        : '未分析风格';

      return `- ${asset.name}（${asset.file_name}）：${analysis}`;
    })
    .join('\n');
}

function buildGroundingTerms(items: string[]) {
  return Array.from(
    new Set(
      items
        .flatMap((item) => item.split(/[\s，。；、：,\-]/))
        .map((item) => item.trim())
        .filter((item) => item.length >= 2)
    )
  ).slice(0, 8);
}

function scoreGroundingCandidate(text: string, terms: string[]) {
  const haystack = normalizeCompareText(text);

  return terms.reduce((score, term) => {
    return score + (haystack.includes(normalizeCompareText(term)) ? 2 : 0);
  }, 0);
}

function buildGroundedExcerpt(text: string, terms: string[]) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const matchedTerm = terms.find((term) => normalized.includes(term));
  if (!matchedTerm) {
    return normalized.slice(0, 140);
  }

  const start = Math.max(0, normalized.indexOf(matchedTerm) - 20);
  return normalized.slice(start, start + 140).trim();
}

function selectGroundedEvidenceSources(params: {
  sectionHeading: string;
  brief: DraftSectionBrief;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}): SectionSourceRef[] {
  type RankedGroundedSource = {
    score: number;
    source: SectionSourceRef;
  };

  const terms = buildGroundingTerms([params.sectionHeading, params.brief.writingTask, ...params.brief.mustCover]);
  const referenceSources: RankedGroundedSource[] = (params.references || [])
    .map((asset) => {
      const searchableText = [asset.name, asset.content, asset.analysis?.tone || '', asset.analysis?.structure || ''].join(' ');
      const excerpt = buildGroundedExcerpt(asset.content, terms);

      return {
        score: scoreGroundingCandidate(searchableText, terms) + (asset.is_favorite ? 1 : 0),
        source: {
          sourceType: asset.id.startsWith('session-') ? ('session_reference' as const) : ('reference_asset' as const),
          sourceId: asset.id,
          label: asset.name,
          excerpt,
          reason: `支撑“${params.sectionHeading}”段落成文`,
        },
      };
    })
    .filter((candidate) => candidate.source.excerpt);

  const ruleSources: RankedGroundedSource[] = (params.rules || [])
    .map((rule) => ({
      score: scoreGroundingCandidate([rule.name, rule.content].join(' '), terms),
      source: {
        sourceType: 'writing_rule' as const,
        sourceId: rule.id,
        label: rule.name,
        excerpt: buildGroundedExcerpt(rule.content, terms),
        reason: `约束“${params.sectionHeading}”段落口径`,
      },
    }))
    .filter((candidate) => candidate.source.excerpt);

  const selected: RankedGroundedSource[] = [...referenceSources.sort((left, right) => right.score - left.score).slice(0, 3)];

  if (ruleSources.length > 0) {
    selected.push(...ruleSources.sort((left, right) => right.score - left.score).slice(0, 1));
  }

  return selected.map((candidate) => candidate.source).slice(0, 4);
}

function attachSectionProvenance(params: {
  section: DraftSectionRecord;
  brief: DraftSectionBrief;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}) {
  const sources = selectGroundedEvidenceSources({
    sectionHeading: params.section.heading,
    brief: params.brief,
    rules: params.rules,
    references: params.references,
  });

  return {
    ...params.section,
    provenance:
      sources.length > 0
        ? {
            summary: `已采纳 ${sources.length} 条依据片段支撑本段。`,
            sources,
          }
        : null,
  } satisfies DraftSectionRecord;
}

function extractJsonCandidate(text: string) {
  const cleaned = sanitizeModelOutput(text);
  const objectStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  const starts = [objectStart, arrayStart].filter((value) => value >= 0);

  if (starts.length === 0) {
    return cleaned;
  }

  const start = Math.min(...starts);
  const char = cleaned[start];
  const end = char === '{' ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');

  if (end <= start) {
    return cleaned.slice(start);
  }

  return cleaned.slice(start, end + 1);
}

async function callStructuredModel<T>(
  provider: Provider,
  prompt: string,
  schema: z.ZodSchema<T>,
  options: {
    fallback?: T;
    mode?: StructuredCallMode;
    maxTokens?: number;
    errorMessage?: string;
    errorCode?: string;
  } = {}
) {
  const mode = options.mode || 'fallback';

  try {
    const response = await callModel(provider, prompt, { maxTokens: options.maxTokens });
    const candidate = extractJsonCandidate(response);
    return schema.parse(JSON.parse(candidate));
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (mode === 'throw') {
      throw new AppError(
        502,
        options.errorMessage || 'AI 返回结果格式不符合要求，请稍后重试',
        options.errorCode || 'STRUCTURED_OUTPUT_INVALID'
      );
    }

    return options.fallback as T;
  }
}

function getFactText(facts: Record<string, string | string[]>, key: string) {
  const value = facts[key];
  if (Array.isArray(value)) {
    return value.join('；');
  }
  return value || '';
}

function getMissingFields(docType: DocType, facts: Record<string, string | string[]>) {
  const baseFields = ['recipient', 'issuer', 'date'];
  const typeFields = DOC_TYPE_CONFIG[docType].requiredFields.map((field) => field.id);

  return [...baseFields, ...typeFields].filter((field) => {
    const value = facts[field];
    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return !value || !String(value).trim();
  });
}

function buildDefaultQuestions(docType: DocType, missingFields: string[]) {
  const specById = new Map(
    DOC_TYPE_CONFIG[docType].requiredFields.map((field) => [
      field.id,
      field,
    ])
  );

  return missingFields.slice(0, 3).map((fieldId) => {
    const spec = specById.get(fieldId);
    const label = spec?.label || fieldId;
    return {
      id: fieldId,
      label,
      question: `请补充${label}，这样我才能更准确地起草${DOC_TYPE_NAMES[docType]}。`,
      placeholder: spec?.description || `请补充${label}`,
    };
  });
}

function slugSectionId(index: number, heading: string) {
  const normalized = heading.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? `${index + 1}-${normalized}` : `section-${index + 1}`;
}

function slugPlanId(index: number, label: string) {
  const normalized = label.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized ? `plan-${index + 1}-${normalized}` : `plan-${index + 1}`;
}

function normalizePlanningSections(sections: PlanningSectionRecord[]) {
  return sections.map((section, index) => ({
    id: section.id || slugSectionId(index, section.headingDraft),
    headingDraft: section.headingDraft.trim(),
    purpose: section.purpose.trim(),
    topicSummary: section.topicSummary.trim(),
    orderReason: section.orderReason.trim(),
  }));
}

function buildPlanningSectionPurpose(section: {
  headingDraft: string;
  topicSummary: string;
}, index: number, total: number) {
  const heading = section.headingDraft.trim() || `第 ${index + 1} 段`;
  const topic = section.topicSummary.trim() || heading;

  if (index === 0) {
    return `作为开篇部分，先围绕${topic}建立读者对“${heading}”的整体理解。`;
  }

  if (index === total - 1) {
    return `作为收束部分，对${topic}形成归纳落点，并承接后续正式提纲。`;
  }

  return `作为中间展开部分，围绕${topic}承接上下文并推进全文主线。`;
}

function buildPlanningSectionOrderReason(section: {
  headingDraft: string;
  topicSummary: string;
}, index: number, total: number) {
  const heading = section.headingDraft.trim() || `第 ${index + 1} 段`;
  const topic = section.topicSummary.trim() || heading;

  if (index === 0) {
    return `先从${topic}切入，便于读者尽快进入“${heading}”这一主线。`;
  }

  if (index === total - 1) {
    return `放在最后，便于全文收束到${topic}并形成完整闭环。`;
  }

  return `放在这一位置，便于前后段围绕${topic}自然衔接，整体顺序更顺。`;
}

export function hydratePlanningSectionsForOutline(
  sections: Array<{
    id: string;
    headingDraft: string;
    topicSummary: string;
    purpose?: string;
    orderReason?: string;
  }>
) {
  const normalizedBase = sections.map((section, index) => ({
    id: section.id || slugSectionId(index, section.headingDraft),
    headingDraft: section.headingDraft.trim(),
    topicSummary: section.topicSummary.trim(),
  }));

  return normalizedBase.map((section, index, current) => ({
    ...section,
    purpose: buildPlanningSectionPurpose(section, index, current.length),
    orderReason: buildPlanningSectionOrderReason(section, index, current.length),
  }));
}

function normalizePlanningOptions(options: PlanningOptionRecord[]) {
  return options.map((option, index) => ({
    planId: option.planId || slugPlanId(index, option.label),
    label: option.label.trim(),
    strategy: option.strategy.trim(),
    whyThisWorks: option.whyThisWorks.trim(),
    sections: normalizePlanningSections(option.sections),
  }));
}

function normalizeOutlineSections(sections: OutlineSectionRecord[]) {
  return sections.map((section, index) => ({
    ...section,
    id: section.id || slugSectionId(index, section.heading),
    notes: section.notes || '',
    keyPoints: Array.isArray(section.keyPoints) ? section.keyPoints.filter(Boolean) : [],
  }));
}

function normalizeDraftSections(sections: DraftSectionRecord[], outlineSections: OutlineSectionRecord[]) {
  return outlineSections.map((outline, index) => ({
    id: outline.id,
    heading: outline.heading,
    body: sections[index]?.body?.trim() || '',
  }));
}

function normalizeCompareText(text: string) {
  return text.replace(/\s+/g, '').replace(/[，。；：、“”‘’（）()《》【】\-]/g, '').trim();
}

function matchesAny(text: string, patterns: string[]) {
  return patterns.some((pattern) => text.includes(pattern));
}

function computeAggregateReviewStatus(checks: ReviewCheck[]): ReviewState['status'] {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail';
  }

  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }

  return 'pass';
}

function buildDraftSectionTask(docType: DocType, section: OutlineSectionRecord, index: number, total: number) {
  const heading = section.heading.trim();

  if (index === total - 1) {
    if (docType === 'request') {
      return '作为收束段，归拢前文论证并自然落到请示事项与规范批示语。';
    }

    return `作为收束段，归拢前文重点并自然落到“${DOC_TYPE_CONFIG[docType].requiredEnding}”的规范收尾。`;
  }

  if (/背景|依据|情况|总体/.test(heading) || index === 0) {
    return '作为前段，先交代背景、依据或总体情况，引出全文主线。';
  }

  if (/问题|困难|风险/.test(heading)) {
    return '聚焦当前问题、困难或风险，写成完整分析段，而不是罗列标签。';
  }

  if (/进展|成效|落实/.test(heading)) {
    return '围绕已开展工作、阶段成效和落实情况展开，写出连续叙述。';
  }

  if (/措施|任务|安排|要求|事项|举措/.test(heading)) {
    return '围绕本段重点任务或具体要求展开，写成完整公文叙述，不要把要点逐条堆砌。';
  }

  if (/请示|请求|建议/.test(heading)) {
    return '围绕拟请示、请求或建议事项形成完整论述，保持语气规范、理由充分。';
  }

  return '作为中间展开段，承接上下文推进主线，形成完整、连贯的公文叙述。';
}

function buildDraftSectionBriefs(docType: DocType, outlineSections: OutlineSectionRecord[]): DraftSectionBrief[] {
  return outlineSections.map((section, index) => ({
    id: section.id,
    heading: section.heading.trim(),
    mustCover: Array.from(
      new Set(
        [...section.keyPoints, section.notes || '']
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ).slice(0, 6),
    writingTask: buildDraftSectionTask(docType, section, index, outlineSections.length),
  }));
}

function countQuotedKeyPoints(body: string, keyPoints: string[]) {
  const normalizedBody = normalizeCompareText(body);

  return keyPoints.filter((point) => {
    const normalizedPoint = normalizeCompareText(point);
    return normalizedPoint.length >= 10 && normalizedBody.includes(normalizedPoint);
  }).length;
}

function looksLikeOutlineStack(body: string) {
  const normalized = body.trim();
  const sentenceCount = (normalized.match(/[。！？]/g) || []).length;
  const semicolonCount = (normalized.match(/[；;]/g) || []).length;
  const listMarkerCount = (normalized.match(/(^|\n)[一二三四五六七八九十1-9][、.]/g) || []).length;

  return sentenceCount === 0 || (sentenceCount <= 1 && (semicolonCount >= 2 || listMarkerCount >= 1));
}

function validateDraftSectionBody(body: string, outline: OutlineSectionRecord, minLength: number) {
  const reasons: string[] = [];
  const trimmed = body.trim();

  if (!trimmed) {
    return ['正文为空'];
  }

  if (trimmed.length < minLength) {
    reasons.push(`正文长度不足 ${minLength} 字`);
  }

  if (looksLikeOutlineStack(trimmed)) {
    reasons.push('正文更像提纲或要点堆砌，缺少完整叙述句群');
  }

  const normalizedPurpose = normalizeCompareText(outline.purpose || '');
  if (normalizedPurpose.length >= 10 && normalizeCompareText(trimmed).includes(normalizedPurpose)) {
    reasons.push('正文直接复述了提纲目的说明');
  }

  const quotedKeyPoints = countQuotedKeyPoints(trimmed, outline.keyPoints || []);
  if (quotedKeyPoints >= 2) {
    reasons.push('正文直接照抄了多个提纲关键要点');
  }

  return reasons;
}

function validateDraftSections(candidateSections: DraftSectionRecord[], outlineSections: OutlineSectionRecord[]) {
  const reasons: string[] = [];

  if (candidateSections.length !== outlineSections.length) {
    reasons.push(`段落数量不一致，应为 ${outlineSections.length} 段，实际为 ${candidateSections.length} 段`);
    return reasons;
  }

  outlineSections.forEach((outline, index) => {
    const candidate = candidateSections[index];
    if (!candidate) {
      reasons.push(`缺少第 ${index + 1} 段`);
      return;
    }

    if (candidate.id.trim() !== outline.id) {
      reasons.push(`第 ${index + 1} 段 id 不匹配，应为 ${outline.id}`);
    }

    if (candidate.heading.trim() !== outline.heading.trim()) {
      reasons.push(`第 ${index + 1} 段标题与已确认提纲不一致，应保持为“${outline.heading}”`);
    }

    const bodyReasons = validateDraftSectionBody(candidate.body, outline, MIN_DRAFT_BODY_LENGTH);
    bodyReasons.forEach((reason) => reasons.push(`第 ${index + 1} 段${reason}`));
  });

  return reasons;
}

function validateRegeneratedSection(section: DraftSectionRecord, outline: OutlineSectionRecord) {
  const reasons: string[] = [];

  if (section.id.trim() !== outline.id) {
    reasons.push(`段落 id 不匹配，应为 ${outline.id}`);
  }

  if (section.heading.trim() !== outline.heading.trim()) {
    reasons.push(`段落标题与已确认提纲不一致，应保持为“${outline.heading}”`);
  }

  const bodyReasons = validateDraftSectionBody(section.body, outline, MIN_SECTION_REWRITE_LENGTH);
  bodyReasons.forEach((reason) => reasons.push(reason));

  return reasons;
}

function buildDraftPrompt(params: {
  docType: DocType;
  facts: Record<string, unknown>;
  title: string;
  sectionBriefs: DraftSectionBrief[];
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
  attachments?: string[];
  repairNotes?: string[];
}) {
  return `你是一位资深公文写作专家，请根据已确认的成文 brief 生成${DOC_TYPE_NAMES[params.docType]}正文。

文种要求：${DOC_TYPE_CONFIG[params.docType].purpose}
固定结尾要求：${DOC_TYPE_CONFIG[params.docType].requiredEnding}

标题：${params.title}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

已确认的成文 brief（只作为写作约束，不能照抄 wording）：
${JSON.stringify(
    params.sectionBriefs.map((section, index) => ({
      order: index + 1,
      id: section.id,
      heading: section.heading,
      writingTask: section.writingTask,
      mustCover: section.mustCover,
    })),
    null,
    2
  )}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

附件：
${(params.attachments || []).length > 0 ? (params.attachments || []).map((item, index) => `${index + 1}. ${item}`).join('\n') : '无'}

${params.repairNotes?.length ? `上一次结果存在以下问题，请逐条修正：\n${params.repairNotes.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n` : ''}
要求：
1. 必须严格按 brief 的顺序逐段生成 sections，段数、id、heading 必须完全一致。
2. "writingTask" 和 "mustCover" 只是写作约束，不能直接照抄原句，不能把提纲说明写进正文。
3. 每个 section 的 body 只写正文内容，不重复输出 heading。
4. 每段必须写成完整公文段落，至少形成 2 句以上连贯叙述，不得只把要点串成列表或分号堆砌。
5. 段与段之间要有自然承接，正文必须服务于整篇成稿，而不是提纲扩写。
6. 语言规范、正式、逻辑清晰，不要凭空添加未提供的事实。
7. 如有附件且正文需要引用，请自然写出“（见附件X）”。
8. 若为请示，结尾必须落在“妥否，请批示”或近似规范表达；若为报告，结尾必须体现“特此报告”；若为通知，结尾体现“特此通知”。

请严格输出 JSON：
{
  "title": "标题",
  "sections": [
    { "id": "section-id", "heading": "一、...", "body": "正文内容" }
  ],
  "content": "可选，完整正文"
}`;
}

function buildSectionRewritePrompt(params: {
  docType: DocType;
  facts: Record<string, unknown>;
  title: string;
  targetOutline: OutlineSectionRecord;
  targetBrief: DraftSectionBrief;
  currentSections: DraftSectionRecord[];
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
  repairNotes?: string[];
}) {
  return `你是一位资深公文写作专家，请只重写指定段落。

文种：${DOC_TYPE_NAMES[params.docType]}
标题：${params.title}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

目标段落的成文 brief（只作为写作约束，不能照抄 wording）：
${JSON.stringify(
    {
      id: params.targetBrief.id,
      heading: params.targetBrief.heading,
      writingTask: params.targetBrief.writingTask,
      mustCover: params.targetBrief.mustCover,
    },
    null,
    2
  )}

当前整篇 sections（用于保持上下文衔接）：
${JSON.stringify(params.currentSections, null, 2)}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

${params.repairNotes?.length ? `上一次结果存在以下问题，请逐条修正：\n${params.repairNotes.map((item, index) => `${index + 1}. ${item}`).join('\n')}\n` : ''}
要求：
1. 只返回目标段落，不要改动其他段落。
2. 返回的 id 和 heading 必须与已确认提纲完全一致。
3. "writingTask" 和 "mustCover" 只是写作约束，不能直接照抄原句，不能把提纲说明写进正文。
4. 该段必须写成完整公文段落，和上下文衔接自然，不得写成要点清单或分号堆砌。
5. 不要凭空添加未提供的事实。

请只输出 JSON：
{
  "section": { "id": "${params.targetOutline.id}", "heading": "${params.targetOutline.heading}", "body": "重写后的正文" },
  "changeSummary": "本次修改摘要"
}`;
}

function buildSuggestedTitle(docType: DocType, facts: Record<string, string | string[]>) {
  const subject = getFactText(facts, 'subject') || getFactText(facts, 'request_decision') || getFactText(facts, 'progress');
  if (subject) {
    return `关于${subject}的${DOC_TYPE_NAMES[docType]}`;
  }
  return `${DOC_TYPE_NAMES[docType]}（待完善）`;
}

function buildOutlineFallback(docType: DocType, facts: Record<string, string | string[]>) {
  const title = buildSuggestedTitle(docType, facts);
  return {
    titleOptions: [title],
    outlineSections: DOC_TYPE_CONFIG[docType].defaultOutline.map((heading, index) => ({
      id: slugSectionId(index, heading),
      heading,
      purpose: `${heading}部分围绕${getFactText(facts, 'subject') || DOC_TYPE_NAMES[docType]}展开`,
      keyPoints: [getFactText(facts, 'background') || '补充背景情况', getFactText(facts, 'subject') || '补充核心事项'].filter(Boolean),
      notes: '',
    })),
    risks: getMissingFields(docType, facts).slice(0, 3).map((field) => `关键信息仍缺失：${field}`),
  };
}

function buildPlanningFallback(docType: DocType, facts: Record<string, string | string[]>): PlanningOptionRecord[] {
  const subject = getFactText(facts, 'subject') || DOC_TYPE_NAMES[docType];
  const background = getFactText(facts, 'background') || '交代事项背景与依据';
  const action = getFactText(facts, 'action_items') || getFactText(facts, 'request_items') || getFactText(facts, 'request_decision') || '明确主要任务或请求事项';
  const ending = getFactText(facts, 'next_steps') || getFactText(facts, 'deadline') || '说明后续安排与工作要求';

  const variants = [
    {
      label: '背景先行',
      strategy: '先交代背景依据，再展开核心事项，最后落到执行要求。',
      whyThisWorks: `适合需要先建立发文依据和必要性的${DOC_TYPE_NAMES[docType]}，让读者先理解为什么要讲${subject}。`,
      sections: [
        {
          id: 'bg-1',
          headingDraft: '一、有关背景和总体考虑',
          purpose: '先把来龙去脉说清楚，为后文铺垫。',
          topicSummary: background,
          orderReason: '先讲背景，便于读者理解后续安排的必要性。',
        },
        {
          id: 'bg-2',
          headingDraft: '二、核心事项和重点内容',
          purpose: '集中展开本次公文要表达的主事项。',
          topicSummary: action,
          orderReason: '在背景基础上承接核心任务，主线最清晰。',
        },
        {
          id: 'bg-3',
          headingDraft: '三、后续安排和工作要求',
          purpose: '把责任、节奏和落地动作交代完整。',
          topicSummary: ending,
          orderReason: '最后收束到落实要求，形成完整闭环。',
        },
      ],
    },
    {
      label: '任务先行',
      strategy: '开头直接抛出核心任务，再补背景依据，最后细化落实安排。',
      whyThisWorks: `适合读者更关心“要做什么”的场景，先把${subject}摆出来，阅读效率更高。`,
      sections: [
        {
          id: 'task-1',
          headingDraft: '一、需要推进的重点事项',
          purpose: '开门见山说明最关键的任务或请示事项。',
          topicSummary: action,
          orderReason: '先抛结论，便于读者快速抓住重点。',
        },
        {
          id: 'task-2',
          headingDraft: '二、相关背景和必要性说明',
          purpose: '补充支撑理由与背景材料，增强说服力。',
          topicSummary: background,
          orderReason: '先知道要做什么，再补充为什么做，逻辑更像工作推进。',
        },
        {
          id: 'task-3',
          headingDraft: '三、推进方式和落实要求',
          purpose: '落实到分工、时限、反馈或下一步。',
          topicSummary: ending,
          orderReason: '最后交代怎么推进，形成执行导向。',
        },
      ],
    },
    {
      label: '目标问题先行',
      strategy: '先指出当前目标或问题，再给出应对安排，最后补充背景和保障。',
      whyThisWorks: `适合需要强调问题导向或目标导向的表达，让${DOC_TYPE_NAMES[docType]}更有推动感。`,
      sections: [
        {
          id: 'goal-1',
          headingDraft: '一、当前目标与需要解决的重点问题',
          purpose: '明确发文要解决什么、推动什么。',
          topicSummary: getFactText(facts, 'issues') || getFactText(facts, 'reason') || action,
          orderReason: '先聚焦目标或问题，能迅速建立文章张力。',
        },
        {
          id: 'goal-2',
          headingDraft: '二、拟采取的主要举措或请示事项',
          purpose: '回应前文问题，给出对应安排或请求。',
          topicSummary: action,
          orderReason: '问题之后紧接举措，前后关系最直接。',
        },
        {
          id: 'goal-3',
          headingDraft: '三、背景依据与后续保障',
          purpose: '补充支撑材料，并交代后续推进要求。',
          topicSummary: `${background}；${ending}`,
          orderReason: '将支撑和保障放在后面，有利于全文收束。',
        },
      ],
    },
  ];

  return normalizePlanningOptions(
    variants.map((variant, index) => ({
      planId: slugPlanId(index, variant.label),
      ...variant,
    }))
  );
}

export async function runIntakeWorkflow(params: {
  docType: DocType;
  provider: Provider;
  existingFacts?: Record<string, unknown>;
  answers?: Record<string, unknown>;
  message?: string;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}) {
  const factsBefore = mergeFacts(params.existingFacts || {}, params.answers || {});
  if (params.message?.trim()) {
    factsBefore.latest_message = params.message.trim();
  }

  const config = DOC_TYPE_CONFIG[params.docType];
  const fallbackMissing = getMissingFields(params.docType, factsBefore);
  const fallback: IntakeResult = {
    readiness: fallbackMissing.length === 0 ? 'ready' : 'needs_more',
    collectedFacts: factsBefore,
    missingFields: fallbackMissing,
    nextQuestions: buildDefaultQuestions(params.docType, fallbackMissing),
    suggestedTitle: buildSuggestedTitle(params.docType, factsBefore),
  };

  const prompt = `你是一位资深公文写作秘书，正在协助用户完成${DOC_TYPE_NAMES[params.docType]}的信息采集。

公文用途：${config.purpose}

必须采集的关键字段：
${formatFieldList(config.requiredFields)}

基础字段也必须关注：recipient（主送机关）、issuer（发文机关）、date（成文日期）

当前已知事实：
${JSON.stringify(factsBefore, null, 2)}

用户本轮补充说明：
${params.message?.trim() || '无'}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

请完成以下任务：
1. 只根据用户明确提供的信息抽取和整理 collectedFacts，严禁编造事实。
2. 判断还有哪些 missingFields 会阻碍后续可靠地生成提纲。
3. 如果还不够，请给出 1-3 个高价值 nextQuestions。
4. 如果信息基本齐备，readiness 设为 ready，否则设为 needs_more。
5. 如果可以拟题，给出 suggestedTitle。

请严格输出 JSON：
{
  "collectedFacts": { "field": "value or string array" },
  "missingFields": ["field_id"],
  "nextQuestions": [
    { "id": "field_id", "label": "字段名", "question": "提问内容", "placeholder": "提示文字" }
  ],
  "readiness": "needs_more | ready",
  "suggestedTitle": "标题建议"
}`;

  const aiResult = await callStructuredModel(params.provider, prompt, intakeResponseSchema, {
    fallback,
    maxTokens: MODEL_TOKEN_BUDGETS.intake,
  });
  const collectedFacts = mergeFacts(factsBefore, aiResult.collectedFacts);
  const missingFields = getMissingFields(params.docType, collectedFacts);

  return {
    readiness: missingFields.length === 0 ? 'ready' : aiResult.readiness,
    collectedFacts,
    missingFields,
    nextQuestions: missingFields.length === 0 ? [] : aiResult.nextQuestions.length > 0 ? aiResult.nextQuestions : buildDefaultQuestions(params.docType, missingFields),
    suggestedTitle: aiResult.suggestedTitle || buildSuggestedTitle(params.docType, collectedFacts),
  } satisfies IntakeResult;
}

export async function generateOutlineWorkflow(params: {
  docType: DocType;
  provider: Provider;
  facts: Record<string, unknown>;
  confirmedPlan?: {
    selectedPlanId?: string;
    sections: PlanningSectionRecord[];
  } | null;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}) {
  const facts = mergeFacts(params.facts || {});
  const fallback = buildOutlineFallback(params.docType, facts);
  const config = DOC_TYPE_CONFIG[params.docType];

  const prompt = `你是一位资深公文写作专家，请基于事实生成一份${DOC_TYPE_NAMES[params.docType]}提纲。

文种用途：${config.purpose}
固定结尾要求：${config.requiredEnding}

结构化事实：
${JSON.stringify(facts, null, 2)}

用户已确认的结构方案：
${params.confirmedPlan?.sections?.length
    ? JSON.stringify(
        params.confirmedPlan.sections.map((section, index) => ({
          order: index + 1,
          headingDraft: section.headingDraft,
          purpose: section.purpose,
          topicSummary: section.topicSummary,
          orderReason: section.orderReason,
        })),
        null,
        2
      )
    : '无，需由你自行推导'}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

要求：
1. 给出 1-3 个标题建议。
2. 如果用户已确认结构方案，必须严格遵守其段数、顺序与每段主题，再细化成正式 outlineSections。
3. 给出 3-6 个 outlineSections，每个 section 包含 heading、purpose、keyPoints。
4. 标题和提纲都必须服务于上述事实，不要虚构新事实。
5. risks 只列可能影响成文质量的风险和缺口。
6. 适配 GB/T 9704-2012 的书面表达习惯。

请严格输出 JSON：
{
  "titleOptions": ["标题1"],
  "outlineSections": [
    {
      "id": "section-id",
      "heading": "一、...",
      "purpose": "这一部分的作用",
      "keyPoints": ["要点1", "要点2"],
      "notes": "可选备注"
    }
  ],
  "risks": ["风险提示"]
}`;

  const aiResult = await callStructuredModel(params.provider, prompt, outlineResponseSchema, {
    fallback,
    maxTokens: MODEL_TOKEN_BUDGETS.outline,
  });

  return {
    outlineVersion: `outline-${Date.now()}`,
    titleOptions: aiResult.titleOptions.length > 0 ? aiResult.titleOptions : fallback.titleOptions,
    outlineSections: normalizeOutlineSections(aiResult.outlineSections.length > 0 ? aiResult.outlineSections : fallback.outlineSections),
    risks: aiResult.risks,
  } satisfies OutlineResult;
}

export async function generateOutlinePlanWorkflow(params: {
  docType: DocType;
  provider: Provider;
  facts: Record<string, unknown>;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}) {
  const facts = mergeFacts(params.facts || {});
  const fallbackOptions = buildPlanningFallback(params.docType, facts);
  const config = DOC_TYPE_CONFIG[params.docType];

  const prompt = `你是一位资深公文写作顾问，请先不要直接生成正式提纲，而是基于事实提供 3 种“结构共创”方案，供用户选择。

文种用途：${config.purpose}
固定结尾要求：${config.requiredEnding}

结构化事实：
${JSON.stringify(facts, null, 2)}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

请生成 3 种差异明显的结构建议，优先体现不同组织逻辑，例如：
- 背景先行
- 任务先行
- 目标/问题先行

每种方案都必须包含：
1. label：方案名
2. strategy：这一套结构的组织策略
3. whyThisWorks：为什么适合当前事实与文种
4. sections：每一段的建议

每个 section 只输出以下内容：
- headingDraft：这一段建议讲什么
- purpose：这一段的作用
- topicSummary：这一段覆盖哪些内容
- orderReason：为什么排在这个位置

要求：
1. 一次输出 3 种方案。
2. 3 种方案必须差异明显，不能只是轻微换顺序。
3. 不要虚构新事实。
4. 这一阶段不要展开正式 keyPoints。

请严格输出 JSON：
{
  "options": [
    {
      "planId": "plan-1",
      "label": "方案名",
      "strategy": "组织策略",
      "whyThisWorks": "适用原因",
      "sections": [
        {
          "id": "section-1",
          "headingDraft": "一、...",
          "purpose": "这一段要完成什么",
          "topicSummary": "这一段主要说什么",
          "orderReason": "为什么排在这里"
        }
      ]
    }
  ]
}`;

  const aiResult = await callStructuredModel(
    params.provider,
    prompt,
    planningResponseSchema,
    {
      fallback: { options: fallbackOptions },
      maxTokens: MODEL_TOKEN_BUDGETS.planning,
    }
  );

  return {
    planVersion: `plan-${Date.now()}`,
    options: normalizePlanningOptions(aiResult.options.length === 3 ? aiResult.options : fallbackOptions),
  } satisfies PlanningResult;
}

export async function generateDraftWorkflow(params: {
  docType: DocType;
  provider: Provider;
  facts: Record<string, unknown>;
  title?: string;
  outlineSections: OutlineSectionRecord[];
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
  attachments?: string[];
}) {
  if (params.outlineSections.length === 0) {
    throw new AppError(400, '请先确认提纲后再生成正文', 'OUTLINE_REQUIRED');
  }

  const facts = mergeFacts(params.facts || {});
  const desiredTitle = params.title?.trim() || buildSuggestedTitle(params.docType, facts);
  const sectionBriefs = buildDraftSectionBriefs(params.docType, params.outlineSections);
  let repairNotes: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildDraftPrompt({
      docType: params.docType,
      facts,
      title: desiredTitle,
      sectionBriefs,
      rules: params.rules,
      references: params.references,
      attachments: params.attachments,
      repairNotes,
    });

    try {
      const aiResult = await callStructuredModel(params.provider, prompt, draftResponseSchema, {
        mode: 'throw',
        maxTokens: MODEL_TOKEN_BUDGETS.draft,
        errorMessage: '正文生成未通过质量校验，请重试或切换模型',
        errorCode: 'DRAFT_GENERATION_INVALID',
      });
      const validationIssues = validateDraftSections(aiResult.sections, params.outlineSections);

      if (validationIssues.length === 0) {
        const sections = normalizeDraftSections(aiResult.sections, params.outlineSections).map((section, index) =>
          attachSectionProvenance({
            section,
            brief: sectionBriefs[index],
            rules: params.rules,
            references: params.references,
          })
        );
        return {
          title: aiResult.title || desiredTitle,
          sections,
          content: aiResult.content || compileSectionsToContent(sections),
        } satisfies DraftResult;
      }

      if (attempt === 0) {
        repairNotes = validationIssues;
        continue;
      }

      throw new AppError(
        502,
        `正文生成未通过质量校验，请重试或切换模型：${validationIssues.join('；')}`,
        'DRAFT_GENERATION_INVALID'
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      if (error.code !== 'DRAFT_GENERATION_INVALID' || attempt === 1) {
        throw error.code === 'DRAFT_GENERATION_INVALID'
          ? new AppError(502, `${error.message}。请重试或切换模型。`, 'DRAFT_GENERATION_INVALID')
          : error;
      }

      repairNotes = [error.message];
    }
  }

  throw new AppError(502, '正文生成未通过质量校验，请重试或切换模型', 'DRAFT_GENERATION_INVALID');
}

export async function regenerateSectionWorkflow(params: {
  docType: DocType;
  provider: Provider;
  facts: Record<string, unknown>;
  title: string;
  outlineSections: OutlineSectionRecord[];
  currentSections: DraftSectionRecord[];
  targetSectionId: string;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
  attachments?: string[];
}) {
  const targetOutline = params.outlineSections.find((section) => section.id === params.targetSectionId);
  if (!targetOutline) {
    throw new AppError(400, '目标段落不存在', 'SECTION_NOT_FOUND');
  }
  const targetBrief = buildDraftSectionBriefs(params.docType, params.outlineSections).find((section) => section.id === params.targetSectionId);
  if (!targetBrief) {
    throw new AppError(400, '目标段落不存在', 'SECTION_NOT_FOUND');
  }

  let repairNotes: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildSectionRewritePrompt({
      docType: params.docType,
      facts: params.facts,
      title: params.title,
      targetOutline,
      targetBrief,
      currentSections: params.currentSections,
      rules: params.rules,
      references: params.references,
      repairNotes,
    });

    try {
      const aiResult = await callStructuredModel(params.provider, prompt, sectionDraftResponseSchema, {
        mode: 'throw',
        maxTokens: MODEL_TOKEN_BUDGETS.sectionDraft,
        errorMessage: '段落重写未通过质量校验，请重试或切换模型',
        errorCode: 'SECTION_GENERATION_INVALID',
      });
      const validationIssues = validateRegeneratedSection(aiResult.section, targetOutline);

      if (validationIssues.length === 0) {
        const normalizedSection = {
          id: targetOutline.id,
          heading: targetOutline.heading,
          body: aiResult.section.body.trim(),
          provenance: attachSectionProvenance({
            section: {
              id: targetOutline.id,
              heading: targetOutline.heading,
              body: aiResult.section.body.trim(),
            },
            brief: targetBrief,
            rules: params.rules,
            references: params.references,
          }).provenance,
        } satisfies DraftSectionRecord;
        const updatedSections = params.currentSections.map((section) =>
          section.id === params.targetSectionId ? normalizedSection : section
        );

        return {
          title: params.title,
          sections: updatedSections,
          content: compileSectionsToContent(updatedSections),
          changeSummary: aiResult.changeSummary,
        };
      }

      if (attempt === 0) {
        repairNotes = validationIssues;
        continue;
      }

      throw new AppError(
        502,
        `段落重写未通过质量校验，请重试或切换模型：${validationIssues.join('；')}`,
        'SECTION_GENERATION_INVALID'
      );
    } catch (error) {
      if (!(error instanceof AppError)) {
        throw error;
      }

      if (error.code !== 'SECTION_GENERATION_INVALID' || attempt === 1) {
        throw error.code === 'SECTION_GENERATION_INVALID'
          ? new AppError(502, `${error.message}。请重试或切换模型。`, 'SECTION_GENERATION_INVALID')
          : error;
      }

      repairNotes = [error.message];
    }
  }

  throw new AppError(502, '段落重写未通过质量校验，请重试或切换模型', 'SECTION_GENERATION_INVALID');
}

function replaceFirst(text: string, searchValue: string, replaceValue: string) {
  const index = text.indexOf(searchValue);
  if (index === -1) {
    return null;
  }

  return `${text.slice(0, index)}${replaceValue}${text.slice(index + searchValue.length)}`;
}

export async function reviseWorkflow(params: {
  docType: DocType;
  provider: Provider;
  facts: Record<string, unknown>;
  title: string;
  sections: DraftSectionRecord[];
  instruction: string;
  targetType: 'selection' | 'section' | 'full';
  targetId?: string;
  selectedText?: string;
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
}) {
  const currentContent = compileSectionsToContent(params.sections);

  if (params.targetType === 'selection') {
    if (!params.selectedText?.trim()) {
      throw new AppError(400, '请先选择要修改的内容', 'SELECTED_TEXT_REQUIRED');
    }

    const prompt = `你是一位资深公文写作专家，请只修改用户选中的片段。

文种：${DOC_TYPE_NAMES[params.docType]}
标题：${params.title}
修改指令：${params.instruction}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

全文内容：
${currentContent}

选中内容：
${params.selectedText}

规则要求：
${formatRules(params.rules || [])}

请严格输出 JSON：
{
  "updatedText": "修改后的片段",
  "changeSummary": "改动摘要"
}`;

    const fallback = {
      updatedText: params.selectedText,
      changeSummary: '已按要求调整选中片段',
    };
    const aiResult = await callStructuredModel(params.provider, prompt, reviseSelectionSchema, {
      fallback,
      maxTokens: MODEL_TOKEN_BUDGETS.revise,
    });
    const nextContent = replaceFirst(currentContent, params.selectedText, aiResult.updatedText);

    if (!nextContent) {
      throw new AppError(400, '未能在正文中定位选中文本，请改用段落改写', 'SELECTED_TEXT_NOT_FOUND');
    }

    const updatedSections = params.sections.map((section) => {
      const headingText = section.heading ? `${section.heading}\n` : '';
      const sectionText = `${headingText}${section.body}`;
      const replaced = replaceFirst(sectionText, params.selectedText!, aiResult.updatedText);

      if (!replaced) {
        return section;
      }

      const normalized = replaced.startsWith(`${section.heading}\n`) ? replaced.slice(section.heading.length + 1) : replaced;
      return {
        ...section,
        body: normalized.trim(),
      };
    });

    return {
      updatedContent: nextContent,
      updatedSections,
      changeSummary: aiResult.changeSummary,
    } satisfies ReviseResult;
  }

  if (params.targetType === 'section') {
    const targetSection = params.sections.find((section) => section.id === params.targetId);
    if (!targetSection) {
      throw new AppError(400, '未找到待修改段落', 'SECTION_NOT_FOUND');
    }

    const prompt = `你是一位资深公文写作专家，请只修改目标段落。

文种：${DOC_TYPE_NAMES[params.docType]}
标题：${params.title}
修改指令：${params.instruction}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

目标段落：
${JSON.stringify(targetSection, null, 2)}

全文 sections：
${JSON.stringify(params.sections, null, 2)}

规则要求：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

请严格输出 JSON：
{
  "updatedSection": { "id": "${targetSection.id}", "heading": "${targetSection.heading}", "body": "修改后的正文" },
  "changeSummary": "改动摘要"
}`;

    const fallback = {
      updatedSection: targetSection,
      changeSummary: `已调整“${targetSection.heading}”段落`,
    };
    const aiResult = await callStructuredModel(params.provider, prompt, reviseSectionSchema, {
      fallback,
      maxTokens: MODEL_TOKEN_BUDGETS.revise,
    });
    const updatedSections = params.sections.map((section) => (section.id === targetSection.id ? aiResult.updatedSection : section));

    return {
      updatedSections,
      updatedContent: compileSectionsToContent(updatedSections),
      changeSummary: aiResult.changeSummary,
    } satisfies ReviseResult;
  }

  const prompt = `你是一位资深公文写作专家，请对整篇${DOC_TYPE_NAMES[params.docType]}进行定向修改。

标题：${params.title}
修改指令：${params.instruction}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

当前 sections：
${JSON.stringify(params.sections, null, 2)}

规则要求：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

请严格输出 JSON：
{
  "title": "可选，更新后的标题",
  "sections": [
    { "id": "section-id", "heading": "一、...", "body": "修改后的正文" }
  ],
  "changeSummary": "本次整稿修改摘要"
}`;

  const fallback = {
    title: params.title,
    sections: params.sections,
    changeSummary: '已按要求调整全文',
  };
  const aiResult = await callStructuredModel(params.provider, prompt, reviseFullSchema, {
    fallback,
    maxTokens: MODEL_TOKEN_BUDGETS.revise,
  });

  return {
    title: aiResult.title || params.title,
    updatedSections: aiResult.sections,
    updatedContent: compileSectionsToContent(aiResult.sections),
    changeSummary: aiResult.changeSummary,
  } satisfies ReviseResult;
}

export function buildDeterministicReviewChecks(params: {
  docType: DocType;
  title?: string;
  content: string;
  sections?: DraftSectionRecord[];
  recipient: string;
  attachments?: string[];
}) {
  const checks: ReviewCheck[] = [];
  const normalizedContent = normalizeCompareText(params.content || compileSectionsToContent(params.sections || []));
  const expectedEnding = DOC_TYPE_CONFIG[params.docType].requiredEnding;

  if (params.docType === 'notice') {
    checks.push(
      matchesAny(normalizedContent, ['请', '落实', '执行', '完成', '报送', '整改', '组织开展', '工作要求'])
        ? {
            code: 'notice_action_required',
            status: 'pass',
            message: '通知正文包含明确执行动作或工作要求。',
            fixPrompt: '',
          }
        : {
            code: 'notice_action_required',
            status: 'fail',
            message: '通知正文缺少明确执行动作或工作要求。',
            fixPrompt: '请补充明确的落实动作、时间要求或报送要求，避免通知只停留在背景说明。',
          }
    );
  }

  if (params.docType === 'letter') {
    checks.push(
      matchesAny(normalizedContent, ['支持', '配合', '协作', '协助', '商洽', '函达'])
        ? {
            code: 'letter_cooperation_framing',
            status: 'pass',
            message: '函件正文保持了商洽或协作语气。',
            fixPrompt: '',
          }
        : {
            code: 'letter_cooperation_framing',
            status: 'warning',
            message: '函件正文缺少明显的商洽或协作表述，语气可能偏硬。',
            fixPrompt: '请补充“请予支持”“请予配合”或其他商洽协作表述，保持函件语气。',
          }
    );
  }

  if (params.docType === 'request') {
    checks.push(
      matchesAny(normalizedContent, ['请批准', '请批示', '请审批', '请审定', '妥否请批示'])
        ? {
            code: 'request_approval_focus',
            status: 'pass',
            message: '请示正文聚焦明确审批或批示请求。',
            fixPrompt: '',
          }
        : {
            code: 'request_approval_focus',
            status: 'fail',
            message: '请示正文没有形成明确审批请求。',
            fixPrompt: '请在结尾明确提出拟请批准、请批示或请审定的具体事项。',
          }
    );
  }

  if (params.docType === 'report') {
    const hasProgress = matchesAny(normalizedContent, ['进展', '成效', '完成', '推进', '落实']);
    const hasIssues = matchesAny(normalizedContent, ['问题', '困难', '风险', '不足']);
    const hasNextSteps = matchesAny(normalizedContent, ['下一步', '后续', '下一阶段', '持续整改', '继续推进']);
    checks.push(
      hasProgress && hasIssues && hasNextSteps
        ? {
            code: 'report_progress_coverage',
            status: 'pass',
            message: '报告正文已覆盖进展、问题和下一步安排。',
            fixPrompt: '',
          }
        : {
            code: 'report_progress_coverage',
            status: 'warning',
            message: '报告正文应同时覆盖进展、问题和下一步安排。',
            fixPrompt: '请补足当前进展、存在问题和下一步安排三部分，避免报告只写单一维度。',
          }
    );
  }

  checks.push(
    params.content.includes(expectedEnding)
      ? {
          code: 'required_ending',
          status: 'pass',
          message: `已包含规范结尾“${expectedEnding}”`,
          fixPrompt: '',
        }
      : {
          code: 'required_ending',
          status: 'fail',
          message: `缺少规范结尾“${expectedEnding}”`,
          fixPrompt: `请补上规范结尾“${expectedEnding}”，并确保收尾自然。`,
        }
  );

  if (params.attachments && params.attachments.length > 0) {
    checks.push(
      /见附件\d/.test(params.content)
        ? {
            code: 'attachment_reference',
            status: 'pass',
            message: '正文已包含附件引用',
            fixPrompt: '',
          }
        : {
            code: 'attachment_reference',
            status: 'warning',
            message: '已添加附件，但正文中尚未体现附件引用',
            fixPrompt: '请在相关段落自然加入“（见附件1）”等附件引用。',
          }
    );
  }

  if (params.recipient && params.content.includes(`${params.recipient}：`)) {
    checks.push({
      code: 'recipient_repetition',
      status: 'warning',
      message: '正文中疑似重复出现主送机关称谓格式，请确认是否需要删除',
      fixPrompt: '请删除正文中重复出现的主送机关称谓格式，保留正文自然行文。',
    });
  }

  return checks;
}

export function computeReviewContentHash(params: {
  title?: string;
  content?: string;
  sections?: DraftSectionRecord[];
}) {
  const payload = {
    title: (params.title || '').trim(),
    content: (params.content || compileSectionsToContent(params.sections || [])).trim(),
    sections: (params.sections || []).map((section) => ({
      id: section.id,
      heading: section.heading.trim(),
      body: section.body.trim(),
    })),
  };

  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

export function buildPersistedReviewState(params: {
  docType: DocType;
  title?: string;
  content?: string;
  sections?: DraftSectionRecord[];
  checks: ReviewCheck[];
  ranAt?: string;
}) {
  return {
    content_hash: computeReviewContentHash({
      title: params.title,
      content: params.content,
      sections: params.sections,
    }),
    doc_type: params.docType,
    status: computeAggregateReviewStatus(params.checks),
    ran_at: params.ranAt || new Date().toISOString(),
    checks: params.checks.slice(0, 20),
  } satisfies ReviewState;
}

export async function reviewWorkflow(params: {
  docType: DocType;
  provider: Provider;
  title: string;
  recipient: string;
  facts: Record<string, unknown>;
  content: string;
  sections: DraftSectionRecord[];
  rules?: WritingRuleRecord[];
  references?: ReferenceAssetRecord[];
  attachments?: string[];
}) {
  const prompt = `你是一位资深公文审校专家，请对以下${DOC_TYPE_NAMES[params.docType]}进行定稿检查。

标题：${params.title}
主送机关：${params.recipient}
固定结尾要求：${DOC_TYPE_CONFIG[params.docType].requiredEnding}

结构化事实：
${JSON.stringify(mergeFacts(params.facts || {}), null, 2)}

正文：
${params.content}

个人规则库：
${formatRules(params.rules || [])}

参考材料：
${formatReferences(params.references || [])}

请重点检查：
1. 是否缺必要背景
2. 是否缺少规范结尾
3. 是否称谓不一致
4. 是否附件引用不一致
5. 是否语气不符合上下级关系

请严格输出 JSON：
{
  "checks": [
    {
      "code": "check_code",
      "status": "pass | warning | fail",
      "message": "检查结果说明",
      "fixPrompt": "可选，一键修复提示词"
    }
  ]
}`;

  const deterministicChecks = buildDeterministicReviewChecks({
    docType: params.docType,
    title: params.title,
    content: params.content,
    sections: params.sections,
    recipient: params.recipient,
    attachments: params.attachments,
  });
  const fallback = { checks: deterministicChecks };
  const aiResult = await callStructuredModel(params.provider, prompt, reviewResponseSchema, {
    fallback,
    maxTokens: MODEL_TOKEN_BUDGETS.review,
  });

  const mergedChecks = [...deterministicChecks];
  aiResult.checks.forEach((check) => {
    if (!mergedChecks.some((item) => item.code === check.code)) {
      mergedChecks.push(check);
    }
  });

  return mergedChecks.slice(0, 10);
}

export function deriveReferenceAnalysisSummary(assets: ReferenceAssetRecord[]) {
  return assets
    .map((asset) => asset.analysis)
    .filter(Boolean) as AnalyzeResult[];
}
