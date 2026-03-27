export type WorkflowStage = 'intake' | 'planning' | 'outline' | 'draft' | 'review' | 'done';

export type PlanningSection = {
  id: string;
  headingDraft: string;
  purpose: string;
  topicSummary: string;
  orderReason: string;
};

export type PlanningOption = {
  planId: string;
  label: string;
  strategy: string;
  whyThisWorks: string;
  sections: PlanningSection[];
};

export type OutlineSection = {
  id: string;
  heading: string;
  purpose: string;
  keyPoints: string[];
  notes?: string;
};

export type DraftSection = {
  id: string;
  heading: string;
  body: string;
  provenance?: {
    summary?: string;
    sources: Array<{
      sourceType: 'reference_asset' | 'session_reference' | 'writing_rule';
      sourceId?: string;
      label: string;
      excerpt: string;
      reason?: string;
    }>;
  } | null;
};

export type ReviewState = {
  content_hash: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  status: 'pass' | 'warning' | 'fail';
  ran_at: string;
  checks: Array<{
    code: string;
    status: 'pass' | 'warning' | 'fail';
    message: string;
    fixPrompt: string;
  }>;
};

export type DraftSnapshot = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  title: string | null;
  recipient: string | null;
  content: string | null;
  issuer: string | null;
  date: string | null;
  provider: 'claude' | 'openai' | 'doubao' | 'glm';
  contactName: string | null;
  contactPhone: string | null;
  attachments: string[];
  workflowStage: WorkflowStage;
  collectedFacts: Record<string, string | string[]>;
  missingFields: string[];
  planning: {
    options: PlanningOption[];
    selectedPlanId?: string;
    sections: PlanningSection[];
    planVersion?: string;
    confirmed?: boolean;
  } | null;
  outline: {
    titleOptions: string[];
    sections: OutlineSection[];
    risks: string[];
    outlineVersion?: string;
    confirmed?: boolean;
  } | null;
  sections: DraftSection[];
  activeRuleIds: string[];
  activeReferenceIds: string[];
  versionCount: number;
  generatedTitle: string;
  generatedContent: string;
  reviewState?: ReviewState | null;
};

export type DraftSaveRequest = {
  id: string | null;
  docType: DraftSnapshot['doc_type'];
  title: string;
  recipient: string;
  content: string;
  issuer: string;
  date: string;
  provider: DraftSnapshot['provider'];
  contactName: string;
  contactPhone: string;
  attachments: string[];
};

export type HydratedDraftView = {
  currentDraftId: string;
  docType: DraftSnapshot['doc_type'];
  provider: DraftSnapshot['provider'];
  workflowStage: WorkflowStage;
  currentStep: WorkflowStage;
  formData: {
    title: string;
    recipient: string;
    content: string;
    issuer: string;
    date: string;
    contactName: string;
    contactPhone: string;
  };
  attachments: string[];
  collectedFacts: Record<string, string | string[]>;
  missingFields: string[];
  readiness: 'needs_more' | 'ready';
  activeRuleIds: string[];
  activeReferenceIds: string[];
  planningVersion: string;
  planningOptions: PlanningOption[];
  selectedPlanId: string;
  planningSections: PlanningSection[];
  planningConfirmed: boolean;
  outlineVersion: string;
  titleOptions: string[];
  outlineSections: OutlineSection[];
  outlineRisks: string[];
  sections: DraftSection[];
  reviewState: ReviewState | null;
};

function mapStageToStep(stage?: WorkflowStage): WorkflowStage {
  if (!stage || stage === 'intake') return 'intake';
  if (stage === 'planning') return 'planning';
  if (stage === 'outline') return 'outline';
  if (stage === 'draft') return 'draft';
  if (stage === 'review' || stage === 'done') return 'review';
  return 'intake';
}

export function buildDraftSaveRequest(input: {
  currentDraftId: string | null;
  docType: DraftSnapshot['doc_type'];
  formData: {
    title: string;
    recipient: string;
    content: string;
    issuer: string;
    date: string;
    contactName: string;
    contactPhone: string;
  };
  provider: DraftSnapshot['provider'];
  attachments: string[];
}): DraftSaveRequest {
  return {
    id: input.currentDraftId,
    docType: input.docType,
    title: input.formData.title,
    recipient: input.formData.recipient,
    content: input.formData.content,
    issuer: input.formData.issuer,
    date: input.formData.date,
    provider: input.provider,
    contactName: input.formData.contactName,
    contactPhone: input.formData.contactPhone,
    attachments: input.attachments,
  };
}

export function deriveHydratedDraftView(draft: DraftSnapshot): HydratedDraftView {
  const planningOptions = draft.planning?.options || [];

  return {
    currentDraftId: draft.id,
    docType: draft.doc_type,
    provider: draft.provider,
    workflowStage: draft.workflowStage || 'intake',
    currentStep: mapStageToStep(draft.workflowStage || 'intake'),
    formData: {
      title: draft.generatedTitle || draft.title || '',
      recipient: draft.recipient || '',
      content: draft.content || '',
      issuer: draft.issuer || '',
      date: draft.date || new Date().toISOString().split('T')[0],
      contactName: draft.contactName || '',
      contactPhone: draft.contactPhone || '',
    },
    attachments: draft.attachments || [],
    collectedFacts: draft.collectedFacts || {},
    missingFields: draft.missingFields || [],
    readiness: (draft.missingFields || []).length === 0 ? 'ready' : 'needs_more',
    activeRuleIds: draft.activeRuleIds || [],
    activeReferenceIds: draft.activeReferenceIds || [],
    planningVersion: draft.planning?.planVersion || '',
    planningOptions,
    selectedPlanId: draft.planning?.selectedPlanId || planningOptions[0]?.planId || '',
    planningSections: draft.planning?.sections || planningOptions[0]?.sections || [],
    planningConfirmed: Boolean(draft.planning?.confirmed),
    outlineVersion: draft.outline?.outlineVersion || '',
    titleOptions: draft.outline?.titleOptions || [],
    outlineSections: draft.outline?.sections || [],
    outlineRisks: draft.outline?.risks || [],
    sections: draft.sections || [],
    reviewState: draft.reviewState || null,
  };
}
