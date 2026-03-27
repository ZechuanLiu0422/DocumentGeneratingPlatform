export type EditableDraftSaveInput = {
  id?: string | null;
  docType: 'notice' | 'letter' | 'request' | 'report';
  title?: string;
  recipient?: string;
  content?: string;
  issuer?: string;
  date?: string;
  provider: 'claude' | 'openai' | 'doubao' | 'glm';
  contactName?: string;
  contactPhone?: string;
  attachments: string[];
};

export type DraftRow = {
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
  planning: Record<string, unknown> | null;
  outline: Record<string, unknown> | null;
  sections: Array<Record<string, unknown>>;
  active_rule_ids: string[];
  active_reference_ids: string[];
  version_count: number;
  generated_title: string | null;
  generated_content: string | null;
  review_state?: Record<string, unknown> | null;
  pending_change?: Record<string, unknown> | null;
  updated_at?: string;
};

export type DraftWritePayload = Omit<DraftRow, 'id'> & {
  updated_at?: string;
};

export const DRAFT_RECORD_SELECT =
  'id, user_id, doc_type, title, recipient, content, issuer, date, provider, contact_name, contact_phone, attachments, workflow_stage, collected_facts, missing_fields, planning, outline, sections, active_rule_ids, active_reference_ids, version_count, generated_title, generated_content, review_state, pending_change, updated_at';

function normalizeText(value?: string) {
  return value && value.length > 0 ? value : null;
}

export function buildDraftWritePayload({
  userId,
  draft,
}: {
  userId: string;
  draft: EditableDraftSaveInput;
}): DraftWritePayload {
  return {
    user_id: userId,
    doc_type: draft.docType,
    title: normalizeText(draft.title),
    recipient: normalizeText(draft.recipient),
    content: normalizeText(draft.content),
    issuer: normalizeText(draft.issuer),
    date: normalizeText(draft.date),
    provider: draft.provider,
    contact_name: normalizeText(draft.contactName),
    contact_phone: normalizeText(draft.contactPhone),
    attachments: draft.attachments,
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
    review_state: null,
    pending_change: null,
  };
}

export function mergeProtectedDraftFields({
  existingDraft,
  editablePayload,
}: {
  existingDraft: DraftRow;
  editablePayload: DraftWritePayload;
}): DraftWritePayload {
  return {
    ...editablePayload,
    workflow_stage: existingDraft.workflow_stage,
    collected_facts: existingDraft.collected_facts || {},
    missing_fields: Array.isArray(existingDraft.missing_fields) ? existingDraft.missing_fields : [],
    planning: existingDraft.planning || null,
    outline: existingDraft.outline || null,
    sections: Array.isArray(existingDraft.sections) ? existingDraft.sections : [],
    active_rule_ids: Array.isArray(existingDraft.active_rule_ids) ? existingDraft.active_rule_ids : [],
    active_reference_ids: Array.isArray(existingDraft.active_reference_ids) ? existingDraft.active_reference_ids : [],
    version_count: typeof existingDraft.version_count === 'number' ? existingDraft.version_count : 0,
    generated_title: existingDraft.generated_title || null,
    generated_content: existingDraft.generated_content || null,
    review_state: existingDraft.review_state || null,
    pending_change: existingDraft.pending_change || null,
  };
}

export function toDraftResponse(draft: DraftRow) {
  return {
    id: draft.id,
    docType: draft.doc_type,
    title: draft.title || '',
    recipient: draft.recipient || '',
    content: draft.content || '',
    issuer: draft.issuer || '',
    date: draft.date || '',
    provider: draft.provider,
    contactName: draft.contact_name || '',
    contactPhone: draft.contact_phone || '',
    attachments: Array.isArray(draft.attachments) ? draft.attachments : [],
    workflowStage: draft.workflow_stage,
    collectedFacts: draft.collected_facts && typeof draft.collected_facts === 'object' ? draft.collected_facts : {},
    missingFields: Array.isArray(draft.missing_fields) ? draft.missing_fields : [],
    planning: draft.planning && typeof draft.planning === 'object' ? draft.planning : null,
    outline: draft.outline && typeof draft.outline === 'object' ? draft.outline : null,
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    activeRuleIds: Array.isArray(draft.active_rule_ids) ? draft.active_rule_ids : [],
    activeReferenceIds: Array.isArray(draft.active_reference_ids) ? draft.active_reference_ids : [],
    versionCount: typeof draft.version_count === 'number' ? draft.version_count : 0,
    generatedTitle: draft.generated_title || '',
    generatedContent: draft.generated_content || '',
    reviewState: draft.review_state || null,
    pendingChange: draft.pending_change || null,
    updatedAt: draft.updated_at || null,
  };
}
