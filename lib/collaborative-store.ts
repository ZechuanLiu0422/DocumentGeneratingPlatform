import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/api';
import type { AnalyzeResult } from '@/lib/official-document-ai';
import { buildRestoreResponse, buildRestoredSnapshot, mergeRestoredDraft } from '@/lib/version-restore';
import type { ReviewState, SectionProvenance, TrustedDraftSection } from '@/lib/validation';

export type WritingRuleRecord = {
  id: string;
  user_id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  name: string;
  rule_type: 'required_phrase' | 'forbidden_phrase' | 'tone_rule' | 'structure_rule' | 'ending_rule' | 'organization_fact';
  content: string;
  priority: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ReferenceAssetRecord = {
  id: string;
  user_id: string;
  name: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  file_name: string;
  file_type: string;
  content: string;
  analysis: AnalyzeResult | null;
  is_favorite: boolean;
  created_at?: string;
  updated_at?: string;
};

export type OutlineSectionRecord = {
  id: string;
  heading: string;
  purpose: string;
  keyPoints: string[];
  notes?: string;
};

export type PlanningSectionRecord = {
  id: string;
  headingDraft: string;
  purpose: string;
  topicSummary: string;
  orderReason: string;
};

export type PlanningOptionRecord = {
  planId: string;
  label: string;
  strategy: string;
  whyThisWorks: string;
  sections: PlanningSectionRecord[];
};

export type DraftSectionRecord = TrustedDraftSection;

export type DraftRecord = {
  id: string;
  user_id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  title: string | null;
  recipient: string | null;
  content: string | null;
  issuer: string | null;
  date: string | null;
  provider: 'claude' | 'openai' | 'doubao' | 'glm';
  contact_name: string | null;
  contact_phone: string | null;
  attachments: string[];
  workflow_stage: 'intake' | 'planning' | 'outline' | 'draft' | 'review' | 'done';
  collected_facts: Record<string, unknown>;
  missing_fields: string[];
  planning: {
    options: PlanningOptionRecord[];
    selectedPlanId?: string;
    sections: PlanningSectionRecord[];
    planVersion?: string;
    confirmed?: boolean;
  } | null;
  outline: {
    titleOptions: string[];
    sections: OutlineSectionRecord[];
    risks: string[];
    outlineVersion?: string;
    confirmed?: boolean;
  } | null;
  sections: DraftSectionRecord[];
  active_rule_ids: string[];
  active_reference_ids: string[];
  version_count: number;
  generated_title: string | null;
  generated_content: string | null;
  review_state?: ReviewState | null;
  updated_at?: string;
};

export type VersionRecord = {
  id: string;
  draft_id: string;
  user_id: string;
  stage: 'outline_confirmed' | 'draft_generated' | 'revision_applied' | 'review_applied' | 'exported' | 'restored';
  title: string | null;
  content: string | null;
  sections: DraftSectionRecord[];
  review_state?: ReviewState | null;
  change_summary: string | null;
  created_at: string;
};

export function compileSectionsToContent(sections: DraftSectionRecord[]) {
  return sections
    .map((section) => {
      const heading = section.heading.trim();
      const body = section.body.trim();
      return heading ? `${heading}\n${body}`.trim() : body;
    })
    .filter(Boolean)
    .join('\n\n');
}

function normalizeSectionProvenance(value: any): SectionProvenance | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawSources = Array.isArray(value.sources) ? value.sources : [];
  const sources = rawSources
    .filter((source) => source && typeof source === 'object')
    .map((source) => ({
      sourceType:
        source.sourceType === 'reference_asset' ||
        source.sourceType === 'session_reference' ||
        source.sourceType === 'writing_rule'
          ? source.sourceType
          : 'reference_asset',
      sourceId: typeof source.sourceId === 'string' ? source.sourceId : '',
      label: typeof source.label === 'string' ? source.label : '',
      excerpt: typeof source.excerpt === 'string' ? source.excerpt : '',
      reason: typeof source.reason === 'string' ? source.reason : '',
    }))
    .filter((source) => source.label && source.excerpt);

  if (!sources.length) {
    return null;
  }

  return {
    summary: typeof value.summary === 'string' ? value.summary : '',
    sources,
  };
}

export function normalizeDraftSectionRecord(row: any): DraftSectionRecord {
  return {
    id: typeof row?.id === 'string' ? row.id : '',
    heading: typeof row?.heading === 'string' ? row.heading : '',
    body: typeof row?.body === 'string' ? row.body : '',
    provenance: normalizeSectionProvenance(row?.provenance),
  };
}

export function normalizeReviewState(row: any): ReviewState | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const checks = Array.isArray(row.checks)
    ? row.checks
        .filter((check) => check && typeof check === 'object')
        .map((check) => ({
          code: typeof check.code === 'string' ? check.code : '',
          status: check.status === 'pass' || check.status === 'warning' || check.status === 'fail' ? check.status : 'warning',
          message: typeof check.message === 'string' ? check.message : '',
          fixPrompt: typeof check.fixPrompt === 'string' ? check.fixPrompt : '',
        }))
        .filter((check) => check.code && check.message)
    : [];

  if (
    typeof row.content_hash !== 'string' ||
    typeof row.ran_at !== 'string' ||
    (row.doc_type !== 'notice' && row.doc_type !== 'letter' && row.doc_type !== 'request' && row.doc_type !== 'report') ||
    (row.status !== 'pass' && row.status !== 'warning' && row.status !== 'fail')
  ) {
    return null;
  }

  return {
    content_hash: row.content_hash,
    doc_type: row.doc_type,
    status: row.status,
    ran_at: row.ran_at,
    checks,
  };
}

export function normalizeDraftRecord(row: any): DraftRecord {
  return {
    ...row,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    collected_facts: row.collected_facts && typeof row.collected_facts === 'object' ? row.collected_facts : {},
    missing_fields: Array.isArray(row.missing_fields) ? row.missing_fields : [],
    planning: row.planning && typeof row.planning === 'object' ? row.planning : null,
    outline: row.outline && typeof row.outline === 'object' ? row.outline : null,
    sections: Array.isArray(row.sections) ? row.sections.map(normalizeDraftSectionRecord) : [],
    active_rule_ids: Array.isArray(row.active_rule_ids) ? row.active_rule_ids : [],
    active_reference_ids: Array.isArray(row.active_reference_ids) ? row.active_reference_ids : [],
    version_count: typeof row.version_count === 'number' ? row.version_count : 0,
    generated_title: row.generated_title || null,
    generated_content: row.generated_content || null,
    review_state: normalizeReviewState(row.review_state),
  };
}

export function normalizeVersionRecord(row: any): VersionRecord {
  return {
    ...row,
    sections: Array.isArray(row.sections) ? row.sections.map(normalizeDraftSectionRecord) : [],
    review_state: normalizeReviewState(row.review_state),
  } as VersionRecord;
}

export async function getDraftById(supabase: SupabaseClient, userId: string, draftId: string) {
  const { data, error } = await supabase
    .from('drafts')
    .select(
      'id, user_id, doc_type, title, recipient, content, issuer, date, provider, contact_name, contact_phone, attachments, workflow_stage, collected_facts, missing_fields, planning, outline, sections, active_rule_ids, active_reference_ids, version_count, generated_title, generated_content, review_state, updated_at'
    )
    .eq('id', draftId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new AppError(404, '草稿不存在或无权访问', 'DRAFT_NOT_FOUND');
  }

  return normalizeDraftRecord(data);
}

export async function listVersionsForDraft(supabase: SupabaseClient, userId: string, draftId: string) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('id, draft_id, user_id, stage, title, content, sections, review_state, change_summary, created_at')
    .eq('user_id', userId)
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => normalizeVersionRecord(row));
}

export async function createVersionSnapshot(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    draftId: string;
    stage: VersionRecord['stage'];
    title?: string | null;
    content?: string | null;
    sections?: DraftSectionRecord[];
    reviewState?: ReviewState | null;
    changeSummary?: string | null;
  }
) {
  const { error } = await supabase.from('document_versions').insert({
    user_id: payload.userId,
    draft_id: payload.draftId,
    stage: payload.stage,
    title: payload.title || null,
    content: payload.content || null,
    sections: payload.sections || [],
    review_state: payload.reviewState || null,
    change_summary: payload.changeSummary || null,
  });

  if (error) {
    throw error;
  }

  const { error: updateError } = await supabase
    .from('drafts')
    .update({ version_count: (await countVersions(supabase, payload.userId, payload.draftId)) })
    .eq('id', payload.draftId)
    .eq('user_id', payload.userId);

  if (updateError) {
    throw updateError;
  }
}

async function countVersions(supabase: SupabaseClient, userId: string, draftId: string) {
  const { count, error } = await supabase
    .from('document_versions')
    .select('*', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('draft_id', draftId);

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function restoreVersionSnapshot(supabase: SupabaseClient, userId: string, draftId: string, versionId: string) {
  const { data, error } = await supabase
    .from('document_versions')
    .select('id, draft_id, user_id, stage, title, content, sections, review_state, change_summary, created_at')
    .eq('id', versionId)
    .eq('draft_id', draftId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new AppError(404, '版本不存在或无权访问', 'VERSION_NOT_FOUND');
  }

  const currentDraft = await getDraftById(supabase, userId, draftId);
  const mergedDraft = mergeRestoredDraft(currentDraft, normalizeVersionRecord(data), new Date().toISOString());
  const { error: updateError } = await supabase
    .from('drafts')
    .update({
      title: mergedDraft.title,
      recipient: mergedDraft.recipient,
      content: mergedDraft.content,
      issuer: mergedDraft.issuer,
      date: mergedDraft.date,
      provider: mergedDraft.provider,
      contact_name: mergedDraft.contact_name,
      contact_phone: mergedDraft.contact_phone,
      attachments: mergedDraft.attachments,
      workflow_stage: mergedDraft.workflow_stage,
      collected_facts: mergedDraft.collected_facts,
      missing_fields: mergedDraft.missing_fields,
      planning: mergedDraft.planning,
      outline: mergedDraft.outline,
      sections: mergedDraft.sections,
      active_rule_ids: mergedDraft.active_rule_ids,
      active_reference_ids: mergedDraft.active_reference_ids,
      version_count: mergedDraft.version_count,
      generated_title: mergedDraft.generated_title,
      generated_content: mergedDraft.generated_content,
      review_state: mergedDraft.review_state || null,
      updated_at: mergedDraft.updated_at,
    })
    .eq('id', draftId)
    .eq('user_id', userId);

  if (updateError) {
    throw updateError;
  }

  const normalizedVersion = normalizeVersionRecord(data);
  const restoredSnapshot = buildRestoredSnapshot(normalizedVersion);

  await createVersionSnapshot(supabase, {
    userId,
    draftId,
    stage: restoredSnapshot.stage,
    title: restoredSnapshot.title,
    content: restoredSnapshot.content,
    sections: restoredSnapshot.sections,
    reviewState: restoredSnapshot.review_state || null,
    changeSummary: restoredSnapshot.change_summary,
  });

  const refreshedDraft = await getDraftById(supabase, userId, draftId);

  return buildRestoreResponse(
    refreshedDraft,
    normalizedVersion
  );
}

export async function fetchWritingRules(
  supabase: SupabaseClient,
  userId: string,
  ids: string[] = [],
  docType?: string
) {
  let query = supabase
    .from('writing_rules')
    .select('id, user_id, doc_type, name, rule_type, content, priority, enabled, created_at, updated_at')
    .eq('user_id', userId)
    .eq('enabled', true)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (ids.length > 0) {
    query = query.in('id', ids);
  } else if (docType) {
    query = query.or(`doc_type.eq.${docType},doc_type.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data || []) as WritingRuleRecord[];
}

export async function fetchReferenceAssets(
  supabase: SupabaseClient,
  userId: string,
  ids: string[] = [],
  docType?: string
) {
  let query = supabase
    .from('reference_assets')
    .select('id, user_id, name, doc_type, file_name, file_type, content, analysis, is_favorite, created_at, updated_at')
    .eq('user_id', userId)
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });

  if (ids.length > 0) {
    query = query.in('id', ids);
  } else if (docType) {
    query = query.or(`doc_type.eq.${docType},doc_type.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data || []).map((row) => ({
    ...row,
    analysis: row.analysis && typeof row.analysis === 'object' ? row.analysis : null,
  })) as ReferenceAssetRecord[];
}

export async function saveDraftState(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    draftId?: string | null;
    docType: DraftRecord['doc_type'];
    provider: DraftRecord['provider'];
    baseFields?: Partial<DraftRecord>;
    workflow: Partial<DraftRecord>;
  }
) {
  const draftPayload = {
    user_id: payload.userId,
    doc_type: payload.docType,
    provider: payload.provider,
    title: payload.baseFields?.title || null,
    recipient: payload.baseFields?.recipient || null,
    content: payload.baseFields?.content || null,
    issuer: payload.baseFields?.issuer || null,
    date: payload.baseFields?.date || null,
    contact_name: payload.baseFields?.contact_name || null,
    contact_phone: payload.baseFields?.contact_phone || null,
    attachments: payload.baseFields?.attachments || [],
    workflow_stage: payload.workflow.workflow_stage || 'intake',
    collected_facts: payload.workflow.collected_facts || {},
    missing_fields: payload.workflow.missing_fields || [],
    planning: payload.workflow.planning || null,
    outline: payload.workflow.outline || null,
    sections: payload.workflow.sections || [],
    active_rule_ids: payload.workflow.active_rule_ids || [],
    active_reference_ids: payload.workflow.active_reference_ids || [],
    version_count: payload.workflow.version_count ?? 0,
    generated_title: payload.workflow.generated_title || null,
    generated_content: payload.workflow.generated_content || null,
    updated_at: new Date().toISOString(),
  };

  if (payload.draftId) {
    const { data, error } = await supabase
      .from('drafts')
      .update(draftPayload)
      .eq('id', payload.draftId)
      .eq('user_id', payload.userId)
      .select(
        'id, user_id, doc_type, title, recipient, content, issuer, date, provider, contact_name, contact_phone, attachments, workflow_stage, collected_facts, missing_fields, planning, outline, sections, active_rule_ids, active_reference_ids, version_count, generated_title, generated_content, updated_at'
      )
      .single();

    if (error || !data) {
      throw error || new AppError(404, '草稿不存在或无权访问', 'DRAFT_NOT_FOUND');
    }

    return normalizeDraftRecord(data);
  }

  const { data, error } = await supabase
    .from('drafts')
    .insert(draftPayload)
    .select(
      'id, user_id, doc_type, title, recipient, content, issuer, date, provider, contact_name, contact_phone, attachments, workflow_stage, collected_facts, missing_fields, planning, outline, sections, active_rule_ids, active_reference_ids, version_count, generated_title, generated_content, updated_at'
    )
    .single();

  if (error || !data) {
    throw error || new AppError(500, '草稿创建失败', 'DRAFT_CREATE_FAILED');
  }

  return normalizeDraftRecord(data);
}
