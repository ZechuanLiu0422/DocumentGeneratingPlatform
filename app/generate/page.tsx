'use client';

import { useEffect, useState } from 'react';
import { GenerateWorkspaceShell } from '@/app/generate/_components/GenerateWorkspaceShell';
import { OperationStatusBanner } from '@/app/generate/_components/OperationStatusBanner';
import { KnowledgeSidebar } from '@/app/generate/_components/panels/KnowledgeSidebar';
import { PendingChangeBanner } from '@/app/generate/_components/PendingChangeBanner';
import { StageNavigation } from '@/app/generate/_components/StageNavigation';
import { DraftStage } from '@/app/generate/_components/stages/DraftStage';
import { IntakeStage } from '@/app/generate/_components/stages/IntakeStage';
import { OutlineStage } from '@/app/generate/_components/stages/OutlineStage';
import { PlanningStage } from '@/app/generate/_components/stages/PlanningStage';
import { ReviewStage } from '@/app/generate/_components/stages/ReviewStage';
import { VersionHistoryPanel } from '@/app/generate/_components/panels/VersionHistoryPanel';
import { useGenerateWorkspaceBootstrap } from '@/app/generate/_hooks/useGenerateWorkspaceBootstrap';
import { useGenerateWorkspaceController } from '@/app/generate/_hooks/useGenerateWorkspaceController';
import {
  buildDraftSaveRequest,
  deriveHydratedDraftView,
  type DraftSnapshot as PersistedDraftSnapshot,
  type PendingChange as PersistedPendingChange,
  type ReviewState as PersistedReviewState,
} from '@/lib/generate-workspace';

type Phrase = {
  id: string;
  type: 'recipient' | 'issuer';
  phrase: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type ProviderInfo = {
  id: 'claude' | 'openai' | 'doubao' | 'glm';
  label: string;
};

type WorkflowStage = 'intake' | 'planning' | 'outline' | 'draft' | 'review' | 'done';

type WorkflowQuestion = {
  id: string;
  label: string;
  question: string;
  placeholder: string;
};

type OutlineSection = {
  id: string;
  heading: string;
  purpose: string;
  keyPoints: string[];
  notes?: string;
};

type PlanningSection = {
  id: string;
  headingDraft: string;
  purpose: string;
  topicSummary: string;
  orderReason: string;
};

type PlanningOption = {
  planId: string;
  label: string;
  strategy: string;
  whyThisWorks: string;
  sections: PlanningSection[];
};

type DraftSection = {
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

type ReviewCheck = {
  code: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  fixPrompt: string;
};

type ReviewState = PersistedReviewState;
type PendingChange = PersistedPendingChange;

type VersionItem = {
  id: string;
  stage: string;
  title: string | null;
  content: string | null;
  sections: DraftSection[];
  change_summary: string | null;
  created_at: string;
};

type WritingRule = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  name: string;
  rule_type: 'required_phrase' | 'forbidden_phrase' | 'tone_rule' | 'structure_rule' | 'ending_rule' | 'organization_fact';
  content: string;
  priority: number;
  enabled: boolean;
};

type ReferenceAnalysis = {
  tone: string;
  structure: string;
  vocabulary: string;
  sentenceStyle: string;
  logicFlow: string;
};

type ReferenceAsset = {
  id: string;
  name: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  file_name: string;
  file_type: string;
  content: string;
  analysis: ReferenceAnalysis | null;
  is_favorite: boolean;
};

type SessionReference = {
  name: string;
  docType: 'notice' | 'letter' | 'request' | 'report' | null;
  fileName: string;
  fileType: string;
  content: string;
  analysis: ReferenceAnalysis | null;
};

type Draft = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  title: string | null;
  recipient: string | null;
  content: string | null;
  issuer: string | null;
  date: string | null;
  provider: ProviderInfo['id'];
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
  pendingChange?: PendingChange | null;
};

type OperationTracker = {
  operationId: string;
  draftId: string;
  operationType: 'draft_generate' | 'draft_regenerate' | 'draft_revise' | 'export';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
};

type OperationStatusPayload = {
  operation: {
    id: string;
    draftId: string | null;
    type: OperationTracker['operationType'] | 'review' | 'export';
    status: OperationTracker['status'];
    attemptCount: number;
    maxAttempts: number;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    startedAt: string | null;
    completedAt: string | null;
    pollUrl: string;
  };
  result: Record<string, unknown> | null;
  draft: Record<string, unknown> | null;
};

const MAX_PLANNING_SECTIONS = 8;
const OPERATION_STORAGE_PREFIX = 'draft-operation:';

const docTypes = [
  { id: 'notice', name: '通知', desc: '用于发布重要事项、安排工作等' },
  { id: 'letter', name: '函', desc: '用于不相隶属机关之间商洽工作' },
  { id: 'request', name: '请示', desc: '用于向上级机关请求指示、批准' },
  { id: 'report', name: '报告', desc: '用于向上级机关汇报工作、反映情况' },
] as const;

function compileSections(sections: DraftSection[]) {
  return sections
    .map((section) => `${section.heading}\n${section.body}`.trim())
    .filter(Boolean)
    .join('\n\n');
}

function formatFactValue(value: string | string[]) {
  return Array.isArray(value) ? value.join('；') : value;
}

function mapWorkflowStageToStep(stage: WorkflowStage) {
  if (stage === 'review' || stage === 'done') return 'review';
  return stage;
}

function getOperationStorageKey(draftId: string) {
  return `${OPERATION_STORAGE_PREFIX}${draftId}`;
}

function readStoredOperation(draftId: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getOperationStorageKey(draftId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as OperationTracker;
  } catch {
    return null;
  }
}

function persistStoredOperation(operation: OperationTracker) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getOperationStorageKey(operation.draftId), JSON.stringify(operation));
}

function clearStoredOperation(draftId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getOperationStorageKey(draftId));
}

function normalizeDraftSnapshot(rawDraft: Record<string, any>): PersistedDraftSnapshot {
  return {
    id: rawDraft.id,
    doc_type: rawDraft.doc_type ?? rawDraft.docType ?? 'notice',
    title: rawDraft.title ?? null,
    recipient: rawDraft.recipient ?? null,
    content: rawDraft.content ?? null,
    issuer: rawDraft.issuer ?? null,
    date: rawDraft.date ?? null,
    provider: rawDraft.provider ?? 'claude',
    contactName: rawDraft.contactName ?? rawDraft.contact_name ?? null,
    contactPhone: rawDraft.contactPhone ?? rawDraft.contact_phone ?? null,
    attachments: Array.isArray(rawDraft.attachments) ? rawDraft.attachments : [],
    workflowStage: rawDraft.workflowStage ?? rawDraft.workflow_stage ?? 'intake',
    collectedFacts: rawDraft.collectedFacts ?? rawDraft.collected_facts ?? {},
    missingFields: rawDraft.missingFields ?? rawDraft.missing_fields ?? [],
    planning: rawDraft.planning ?? null,
    outline: rawDraft.outline ?? null,
    sections: Array.isArray(rawDraft.sections) ? rawDraft.sections : [],
    activeRuleIds: rawDraft.activeRuleIds ?? rawDraft.active_rule_ids ?? [],
    activeReferenceIds: rawDraft.activeReferenceIds ?? rawDraft.active_reference_ids ?? [],
    versionCount: rawDraft.versionCount ?? rawDraft.version_count ?? 0,
    generatedTitle: rawDraft.generatedTitle ?? rawDraft.generated_title ?? rawDraft.title ?? '',
    generatedContent: rawDraft.generatedContent ?? rawDraft.generated_content ?? rawDraft.content ?? '',
    reviewState: rawDraft.reviewState ?? rawDraft.review_state ?? null,
    pendingChange: rawDraft.pendingChange ?? rawDraft.pending_change ?? null,
  };
}

function formatOperationStatus(status: OperationTracker['status']) {
  if (status === 'queued') return '排队中';
  if (status === 'running') return '处理中';
  if (status === 'succeeded') return '已完成';
  if (status === 'failed') return '失败';
  return '已取消';
}

function getOperationNotice(operationType: OperationTracker['operationType'], status: OperationTracker['status']) {
  const actionLabel =
    operationType === 'draft_revise'
      ? '改写任务'
      : operationType === 'draft_regenerate'
        ? '段落重写任务'
        : operationType === 'export'
          ? '导出任务'
          : '正文生成任务';

  if (status === 'queued') {
    return `${actionLabel}已加入队列，页面会自动同步结果。`;
  }

  if (status === 'running') {
    return `${actionLabel}正在后台执行，请稍候。`;
  }

  if (status === 'succeeded') {
    return `${actionLabel}已完成，最新结果已同步。`;
  }

  if (status === 'cancelled') {
    return `${actionLabel}已取消。`;
  }

  return `${actionLabel}执行失败，请重试。`;
}

function getCompletionGateMessage(operationType: OperationTracker['operationType'], draft: Record<string, any> | null) {
  if (!draft) {
    return '';
  }

  const pendingChange = draft.pendingChange ?? draft.pending_change;
  if (pendingChange) {
    return operationType === 'draft_revise'
      ? '存在待确认的改写候选，请先比较后再决定是否接受。'
      : '存在待确认的候选变更，请先比较后再决定是否覆盖当前已接受正文。';
  }

  const reviewState = draft.reviewState ?? draft.review_state;
  if (reviewState) {
    return '';
  }

  return operationType === 'draft_revise'
    ? '正文已修改，请重新运行定稿检查后再导出。'
    : '正文已更新，请重新运行定稿检查后再导出。';
}

function triggerBinaryDownload(downloadUrl: string, fileName = 'document.docx') {
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function renderSectionProvenance(section: DraftSection, emptyMessage = '当前段落还没有可展示的采纳依据。') {
  if (!section.provenance?.sources?.length) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">采纳依据</div>
      {section.provenance.summary && <div className="mt-2 text-sm text-emerald-800">{section.provenance.summary}</div>}
      <div className="mt-3 space-y-2">
        {section.provenance.sources.map((source, index) => (
          <div key={`${section.id}-${source.sourceId || source.label}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
            <div className="font-medium text-gray-900">{source.label}</div>
            <div className="mt-1 text-gray-600">{source.excerpt}</div>
            {source.reason && <div className="mt-1 text-xs text-emerald-700">{source.reason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GeneratePageContent() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [rules, setRules] = useState<WritingRule[]>([]);
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [docType, setDocType] = useState<Draft['doc_type'] | ''>('');
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('intake');
  const [currentStep, setCurrentStep] = useState<WorkflowStage>('intake');
  const [formData, setFormData] = useState({
    title: '',
    recipient: '',
    content: '',
    issuer: '',
    date: new Date().toISOString().split('T')[0],
    contactName: '',
    contactPhone: '',
  });
  const [provider, setProvider] = useState<ProviderInfo['id']>('claude');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [savingPhraseType, setSavingPhraseType] = useState<Phrase['type'] | null>(null);
  const [activeRuleIds, setActiveRuleIds] = useState<string[]>([]);
  const [activeReferenceIds, setActiveReferenceIds] = useState<string[]>([]);
  const [sessionReferences, setSessionReferences] = useState<SessionReference[]>([]);
  const [referenceUploadMode, setReferenceUploadMode] = useState<'session' | 'library'>('session');
  const [referenceAnalysisPreview, setReferenceAnalysisPreview] = useState<ReferenceAnalysis | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [collectedFacts, setCollectedFacts] = useState<Record<string, string | string[]>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [nextQuestions, setNextQuestions] = useState<WorkflowQuestion[]>([]);
  const [readiness, setReadiness] = useState<'needs_more' | 'ready'>('needs_more');
  const [intakeMessage, setIntakeMessage] = useState('');
  const [planningVersion, setPlanningVersion] = useState('');
  const [planningOptions, setPlanningOptions] = useState<PlanningOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planningSections, setPlanningSections] = useState<PlanningSection[]>([]);
  const [planningConfirmed, setPlanningConfirmed] = useState(false);
  const [outlineVersion, setOutlineVersion] = useState('');
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [outlineSections, setOutlineSections] = useState<OutlineSection[]>([]);
  const [outlineRisks, setOutlineRisks] = useState<string[]>([]);
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionInstruction, setSelectionInstruction] = useState('');
  const [fullInstruction, setFullInstruction] = useState('');
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>({});
  const [reviewChecks, setReviewChecks] = useState<ReviewCheck[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [reviewGateMessage, setReviewGateMessage] = useState('');
  const [activeOperation, setActiveOperation] = useState<OperationTracker | null>(null);
  const [operationNotice, setOperationNotice] = useState('');
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [busyAction, setBusyAction] = useState('');
  const [ruleForm, setRuleForm] = useState({
    name: '',
    ruleType: 'tone_rule' as WritingRule['rule_type'],
    content: '',
    docType: '',
  });

  const previewContent = compileSections(sections);

  const hydrateDraft = (draft: Draft | Record<string, any>) => {
    const hydratedView = deriveHydratedDraftView(normalizeDraftSnapshot(draft as Record<string, any>));

    setCurrentDraftId(hydratedView.currentDraftId);
    setDocType(hydratedView.docType);
    setProvider(hydratedView.provider);
    setWorkflowStage(hydratedView.workflowStage);
    setCurrentStep(hydratedView.currentStep);
    setFormData(hydratedView.formData);
    setAttachments(hydratedView.attachments);
    setCollectedFacts(hydratedView.collectedFacts);
    setMissingFields(hydratedView.missingFields);
    setReadiness(hydratedView.readiness);
    setActiveRuleIds(hydratedView.activeRuleIds);
    setActiveReferenceIds(hydratedView.activeReferenceIds);
    setPlanningVersion(hydratedView.planningVersion);
    setPlanningOptions(hydratedView.planningOptions);
    setSelectedPlanId(hydratedView.selectedPlanId);
    setPlanningSections(hydratedView.planningSections);
    setPlanningConfirmed(hydratedView.planningConfirmed);
    setOutlineVersion(hydratedView.outlineVersion);
    setTitleOptions(hydratedView.titleOptions);
    setOutlineSections(hydratedView.outlineSections);
    setOutlineRisks(hydratedView.outlineRisks);
    setSections(hydratedView.sections);
    setReviewState(hydratedView.reviewState);
    setPendingChange(hydratedView.pendingChange);
  };

  const fetchVersions = async (draftId: string) => {
    const response = await fetch(`/api/ai/versions?draftId=${draftId}`);
    const data = await response.json();
    if (response.ok) {
      setVersions(data.versions || []);
    }
  };

  const fetchRules = async () => {
    const response = await fetch('/api/writing-rules');
    const data = await response.json();
    if (response.ok) {
      setRules(data.rules || []);
    }
  };

  const fetchReferenceAssets = async () => {
    const response = await fetch('/api/reference-assets');
    const data = await response.json();
    if (response.ok) {
      setReferenceAssets(data.assets || []);
    }
  };

  const fetchPhrases = async () => {
    const response = await fetch('/api/common-phrases');
    const data = await response.json();
    if (response.ok) {
      setPhrases(data.phrases || []);
    }
  };

  useEffect(() => {
    if (!currentDraftId) {
      return;
    }

    if (activeOperation?.draftId === currentDraftId) {
      return;
    }

    const stored = readStoredOperation(currentDraftId);
    if (!stored) {
      return;
    }

    setActiveOperation(stored);
    setOperationNotice(getOperationNotice(stored.operationType, stored.status));
  }, [currentDraftId, activeOperation?.draftId]);

  useEffect(() => {
    if (!activeOperation || !currentDraftId || activeOperation.draftId !== currentDraftId) {
      return;
    }

    let cancelled = false;

    const pollOperation = async () => {
      try {
        const response = await fetch(`/api/operations/${activeOperation.operationId}`, { cache: 'no-store' });
        const data = (await response.json()) as OperationStatusPayload & { error?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(data.error || '后台任务状态获取失败');
        }

        const nextStatus = data.operation.status;
        setActiveOperation((prev) =>
          prev && prev.operationId === activeOperation.operationId ? { ...prev, status: nextStatus } : prev
        );
        setOperationNotice(getOperationNotice(activeOperation.operationType, nextStatus));

        if (nextStatus === 'succeeded') {
          if (activeOperation.operationType === 'export') {
            const downloadUrl = typeof data.result?.downloadUrl === 'string' ? data.result.downloadUrl : '';
            const fileName = typeof data.result?.fileName === 'string' ? data.result.fileName : 'document.docx';
            const workflowStage = typeof data.result?.workflowStage === 'string' ? data.result.workflowStage : '';

            if (workflowStage) {
              setWorkflowStage(workflowStage as WorkflowStage);
              setCurrentStep(mapWorkflowStageToStep(workflowStage as WorkflowStage));
            }

            if (downloadUrl) {
              triggerBinaryDownload(downloadUrl, fileName);
            }

            if (activeOperation.draftId) {
              fetchVersions(activeOperation.draftId);
            }

            clearStoredOperation(activeOperation.draftId);
            setActiveOperation(null);
            setOperationNotice(getOperationNotice(activeOperation.operationType, 'succeeded'));
            return;
          }

          if (data.draft) {
            hydrateDraft(data.draft);
            if (typeof data.draft.id === 'string') {
              fetchVersions(data.draft.id);
            }
            setReviewGateMessage(getCompletionGateMessage(activeOperation.operationType, data.draft));
          }

          clearStoredOperation(activeOperation.draftId);
          setActiveOperation(null);
          return;
        }

        if (nextStatus === 'failed' || nextStatus === 'cancelled') {
          clearStoredOperation(activeOperation.draftId);
          setActiveOperation(null);
          setOperationNotice(data.operation.errorMessage || getOperationNotice(activeOperation.operationType, nextStatus));
        }
      } catch (error: any) {
        if (!cancelled) {
          setOperationNotice(error.message || '后台任务状态获取失败');
        }
      }
    };

    pollOperation();
    const timer = window.setInterval(pollOperation, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOperation, currentDraftId]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.replace('/login');
  };

  const resetWorkflow = () => {
    setCurrentDraftId(null);
    setWorkflowStage('intake');
    setCurrentStep('intake');
    setCollectedFacts({});
    setMissingFields([]);
    setNextQuestions([]);
    setReadiness('needs_more');
    setPlanningVersion('');
    setPlanningOptions([]);
    setSelectedPlanId('');
    setPlanningSections([]);
    setPlanningConfirmed(false);
    setOutlineVersion('');
    setTitleOptions([]);
    setOutlineSections([]);
    setOutlineRisks([]);
    setSections([]);
    setSelectedText('');
    setSelectionInstruction('');
    setFullInstruction('');
    setSectionInstructions({});
    setReviewChecks([]);
    setReviewState(null);
    setPendingChange(null);
    setReviewGateMessage('');
    setActiveOperation(null);
    setOperationNotice('');
    setVersions([]);
    setSessionReferences([]);
    setActiveReferenceIds([]);
  };

  const controller = useGenerateWorkspaceController({
    readiness,
    planningOptions,
    planningSections,
    selectedPlanId,
    workflowStage,
    outlineSections,
    outlineVersion,
    outlineRisks,
    titleOptions,
    sections,
    currentDraftId,
    busyAction,
    activeOperationStatus: activeOperation?.status ?? null,
    docType,
    provider,
    formData,
    attachments,
    intakeMessage,
    activeRuleIds,
    activeReferenceIds,
    sessionReferences,
    rules,
    referenceAssets,
    onResetWorkflow: resetWorkflow,
    onFetchVersions: fetchVersions,
    setDocType,
    setCurrentDraftId,
    setWorkflowStage,
    setCurrentStep,
    setCollectedFacts,
    setMissingFields,
    setNextQuestions,
    setReadiness,
    setIntakeMessage,
    setBusyAction,
    setFormData,
    setPlanningVersion,
    setPlanningOptions,
    setSelectedPlanId,
    setPlanningSections,
    setPlanningConfirmed,
    setOutlineVersion,
    setTitleOptions,
    setOutlineSections,
    setOutlineRisks,
  });

  const {
    busy,
    operationPending,
    canVisitPlanning,
    canVisitOutline,
    canVisitDraft,
    canVisitReview,
    visibleRules,
    visibleAssets,
    handleIntake,
    handleGeneratePlanning,
    handleGenerateOutline,
    handleConfirmOutline,
  } = controller;

  const { bootstrapping, pageError } = useGenerateWorkspaceBootstrap({
    onHydrateDraft: hydrateDraft,
    onSetProviders: (nextProviders) => setProviders(nextProviders as ProviderInfo[]),
    onSetProvider: setProvider,
    onSetPhrases: (nextPhrases) => setPhrases(nextPhrases as Phrase[]),
    onSetContacts: (nextContacts) => setContacts(nextContacts as Contact[]),
    onSetRules: (nextRules) => setRules(nextRules as WritingRule[]),
    onSetReferenceAssets: (nextAssets) => setReferenceAssets(nextAssets as ReferenceAsset[]),
    onFetchVersions: fetchVersions,
  });

  const handleSaveDraft = async () => {
    if (!docType) {
      alert('请先选择文档类型');
      return;
    }

    if (planningSections.length > MAX_PLANNING_SECTIONS) {
      alert(`结构共创最多支持 ${MAX_PLANNING_SECTIONS} 段，请先删减后再保存`);
      return;
    }

    const response = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildDraftSaveRequest({
          currentDraftId,
          docType,
          formData,
          provider,
          attachments,
        })
      ),
    });

    const data = await response.json();
    if (response.ok) {
      if (data.draft) {
        hydrateDraft(data.draft);
        fetchVersions(data.draft.id);
      }
      alert('草稿已保存');
    } else {
      alert(data.error || '草稿保存失败');
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachment.trim()) return;
    setAttachments((prev) => [...prev, newAttachment.trim()]);
    setNewAttachment('');
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, current) => current !== index));
  };

  const handleSaveContact = async () => {
    if (!formData.contactName || !formData.contactPhone) {
      alert('请填写联系人和电话');
      return;
    }

    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.contactName,
        phone: formData.contactPhone,
      }),
    });

    if (response.ok) {
      const contactsRes = await fetch('/api/contacts');
      const contactsData = await contactsRes.json();
      setContacts(contactsData.contacts || []);
      alert('联系人已保存');
    }
  };

  const handleSavePhrase = async (type: Phrase['type']) => {
    const value = (type === 'recipient' ? formData.recipient : formData.issuer).trim();
    if (!value) {
      alert(type === 'recipient' ? '请先填写主送机关' : '请先填写发文机关');
      return;
    }

    const alreadyExists = phrases.some((phrase) => phrase.type === type && phrase.phrase === value);
    if (alreadyExists) {
      alert('这条常用信息已存在');
      return;
    }

    setSavingPhraseType(type);

    try {
      const response = await fetch('/api/common-phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          phrase: value,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      await fetchPhrases();
      alert(type === 'recipient' ? '主送机关已保存到常用信息' : '发文机关已保存到常用信息');
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSavingPhraseType(null);
    }
  };

  const handleSelectContact = (name: string) => {
    const contact = contacts.find((item) => item.name === name);
    if (contact) {
      setFormData((prev) => ({
        ...prev,
        contactName: contact.name,
        contactPhone: contact.phone,
      }));
    }
  };

  const handleCreateRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.content.trim()) {
      alert('请填写规则名称和规则内容');
      return;
    }

    const response = await fetch('/api/writing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ruleForm.name,
        docType: ruleForm.docType || null,
        ruleType: ruleForm.ruleType,
        content: ruleForm.content,
        priority: 60,
        enabled: true,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || '规则保存失败');
      return;
    }

    await fetchRules();
    if (data.ruleId) {
      setActiveRuleIds((prev) => Array.from(new Set([...prev, data.ruleId])));
    }
    setRuleForm({
      name: '',
      ruleType: 'tone_rule',
      content: '',
      docType: docType || '',
    });
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!docType) {
      alert('请先选择文种');
      return;
    }

    setUploadingReference(true);
    setReferenceAnalysisPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);

      const uploadRes = await fetch('/api/upload-reference', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || '参考材料上传失败');
      }

      const analyzeRes = await fetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          fileContent: uploadData.content,
          provider,
        }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || '风格分析失败');
      }

      const sessionReference: SessionReference = {
        name: file.name.replace(/\.[^.]+$/, ''),
        docType: docType as Draft['doc_type'],
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'txt',
        content: uploadData.content,
        analysis: analyzeData.analysis,
      };

      setReferenceAnalysisPreview(analyzeData.analysis);
      if (referenceUploadMode === 'library') {
        const saveRes = await fetch('/api/reference-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sessionReference.name,
            docType,
            fileName: sessionReference.fileName,
            fileType: sessionReference.fileType,
            content: sessionReference.content,
            analysis: sessionReference.analysis,
            isFavorite: true,
          }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) {
          throw new Error(saveData.error || '参考材料保存失败');
        }
        await fetchReferenceAssets();
        if (saveData.assetId) {
          setActiveReferenceIds((prev) => Array.from(new Set([...prev, saveData.assetId])));
        }
      } else {
        setSessionReferences((prev) => [sessionReference, ...prev].slice(0, 3));
      }
    } catch (error: any) {
      alert(error.message || '参考材料处理失败');
    } finally {
      setUploadingReference(false);
      event.target.value = '';
    }
  };

  const handleGenerateDraft = async (mode: 'full' | 'section' = 'full', sectionId = '') => {
    if (!currentDraftId) {
      alert('请先完成提纲确认');
      return;
    }

    setBusyAction(mode === 'section' ? `section-${sectionId}` : 'draft');

    try {
      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          mode,
          sectionId,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '正文生成失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的候选变更，请先比较后再决定是否覆盖当前已接受正文。');
        return;
      }

      if (data.mode === 'queued' && data.operationId) {
        const operation: OperationTracker = {
          operationId: data.operationId,
          draftId: currentDraftId,
          operationType: mode === 'section' ? 'draft_regenerate' : 'draft_generate',
          status: data.status || 'queued',
        };
        persistStoredOperation(operation);
        setActiveOperation(operation);
        setOperationNotice(getOperationNotice(operation.operationType, operation.status));
        setPendingChange(null);
        return;
      }

      setSections(data.sections || []);
      setReviewState(null);
      setPendingChange(null);
      setReviewGateMessage('正文已更新，请重新运行定稿检查后再导出。');
      if (data.title) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      setWorkflowStage('review');
      setCurrentStep('draft');
      fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '正文生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRegenerateDraft = async () => {
    if (!currentDraftId) {
      alert('请先完成提纲确认');
      return;
    }

    if (sections.length > 0) {
      const confirmed = window.confirm('重新生成正文会用当前已确认提纲覆盖现有正文内容，是否继续？');
      if (!confirmed) {
        return;
      }
    }

    setReviewChecks([]);
    setReviewState(null);
    setReviewGateMessage('');
    await handleGenerateDraft('full');
  };

  const handleRevise = async (targetType: 'selection' | 'section' | 'full', targetId = '', instruction = '') => {
    if (!currentDraftId || !instruction.trim()) {
      alert('请先填写修改指令');
      return;
    }

    setBusyAction(`revise-${targetType}`);

    try {
      const response = await fetch('/api/ai/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          targetType,
          targetId,
          selectedText,
          instruction,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '改写失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的改写候选，请先比较后再决定是否接受。');
        return;
      }

      if (data.mode === 'queued' && data.operationId) {
        const operation: OperationTracker = {
          operationId: data.operationId,
          draftId: currentDraftId,
          operationType: 'draft_revise',
          status: data.status || 'queued',
        };
        persistStoredOperation(operation);
        setActiveOperation(operation);
        setOperationNotice(getOperationNotice(operation.operationType, operation.status));
        setPendingChange(null);
        return;
      }

      setSections(data.updatedSections || []);
      setReviewState(data.reviewState || null);
      setPendingChange(null);
      setReviewGateMessage(data.reviewState ? '' : '正文已修改，请重新运行定稿检查后再导出。');
      if (data.title) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      if (targetType === 'selection') {
        setSelectionInstruction('');
        setSelectedText('');
      } else if (targetType === 'full') {
        setFullInstruction('');
      } else if (targetId) {
        setSectionInstructions((prev) => ({ ...prev, [targetId]: '' }));
      }
      fetchVersions(currentDraftId);
      alert(data.changeSummary || '修改完成');
    } catch (error: any) {
      alert(error.message || '改写失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRunReview = async () => {
    if (!currentDraftId || sections.length === 0) {
      alert('请先生成正文');
      return;
    }

    setBusyAction('review');

    try {
      const response = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '定稿检查失败');
      }

      setReviewChecks(data.checks || []);
      setReviewState(data.reviewState || null);
      setReviewGateMessage('');
      setWorkflowStage('review');
      setCurrentStep('review');
      fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '定稿检查失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!currentDraftId) return;

    setBusyAction(`restore-${versionId}`);

    const response = await fetch('/api/ai/versions/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: currentDraftId,
        versionId,
      }),
    });
    const data = await response.json();
    try {
      if (!response.ok) {
        throw new Error(data.error || '版本恢复失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的版本恢复候选，请先比较后再决定是否恢复。');
      }
    } catch (error: any) {
      alert(error.message || '版本恢复失败');
    } finally {
      setBusyAction('');
    }
  };

  const handlePendingChangeDecision = async (decision: 'accept' | 'reject') => {
    if (!currentDraftId || !pendingChange) {
      return;
    }

    setBusyAction(`candidate-${decision}`);

    try {
      let response: Response;

      if (pendingChange.action === 'restore') {
        response = await fetch('/api/ai/versions/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            decision,
            candidateId: pendingChange.candidateId,
          }),
        });
      } else if (pendingChange.action === 'regenerate') {
        response = await fetch('/api/ai/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            provider,
            mode: 'section',
            sectionId: pendingChange.targetSectionIds[0] || '',
            decision,
            candidateId: pendingChange.candidateId,
            sessionReferences,
          }),
        });
      } else {
        response = await fetch('/api/ai/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            provider,
            targetType: pendingChange.targetType,
            targetId: pendingChange.targetSectionIds[0] || '',
            selectedText,
            instruction: '',
            decision,
            candidateId: pendingChange.candidateId,
            sessionReferences,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '候选变更处理失败');
      }

      if (decision === 'reject') {
        setPendingChange(null);
        setReviewGateMessage('');
        return;
      }

      const nextSections = data.sections || data.updatedSections || pendingChange.after.sections;
      const nextTitle =
        typeof data.title === 'string' ? data.title : pendingChange.after.title || formData.title;
      const nextReviewState =
        data.reviewState !== undefined
          ? (data.reviewState as ReviewState | null)
          : pendingChange.action === 'restore'
            ? pendingChange.after.reviewState || null
            : null;
      const nextWorkflowStage = (data.workflowStage || (pendingChange.action === 'restore' ? 'draft' : 'review')) as WorkflowStage;

      setSections(nextSections);
      setFormData((prev) => ({ ...prev, title: nextTitle }));
      setReviewChecks([]);
      setReviewState(nextReviewState);
      setPendingChange(null);
      setWorkflowStage(nextWorkflowStage);
      setCurrentStep(mapWorkflowStageToStep(nextWorkflowStage));
      setReviewGateMessage(nextReviewState ? '' : '正文已更新，请重新运行定稿检查后再导出。');
      setSelectedText('');

      if (pendingChange.targetType === 'selection') {
        setSelectionInstruction('');
      } else if (pendingChange.targetType === 'full') {
        setFullInstruction('');
      } else if (pendingChange.targetSectionIds[0]) {
        setSectionInstructions((prev) => ({ ...prev, [pendingChange.targetSectionIds[0]]: '' }));
      }

      await fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '候选变更处理失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleDownload = async () => {
    if (!docType || !previewContent) {
      alert('请先完成正文生成');
      return;
    }

    if (!formData.title || !formData.recipient || !formData.issuer || !formData.date) {
      alert('导出前请补齐标题、主送机关、发文机关和日期');
      return;
    }

    setBusyAction('download');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          docType,
          ...formData,
          generatedContent: previewContent,
          provider,
          attachments,
          sections,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'REVIEW_REQUIRED' || data.code === 'REVIEW_STALE') {
          setReviewGateMessage(data.error || '请重新运行定稿检查后再导出');
          setCurrentStep('review');
          return;
        }

        throw new Error(data.error || '导出失败');
      }

      if (data.mode === 'queued' && data.operationId && currentDraftId) {
        const operation: OperationTracker = {
          operationId: data.operationId,
          draftId: currentDraftId,
          operationType: 'export',
          status: data.status || 'queued',
        };
        persistStoredOperation(operation);
        setActiveOperation(operation);
        setOperationNotice(getOperationNotice(operation.operationType, operation.status));
        return;
      }

      throw new Error('导出失败');
    } catch (error: any) {
      alert(error.message || '导出失败');
  } finally {
      setBusyAction('');
    }
  };

  const primaryStagePanels = {
    intake: (
      <IntakeStage
        collectedFacts={collectedFacts}
        missingFields={missingFields}
        nextQuestions={nextQuestions}
        readiness={readiness}
        intakeMessage={intakeMessage}
        busy={busy}
        providersAvailable={providers.length > 0}
        busyAction={busyAction}
        canVisitPlanning={canVisitPlanning}
        formatFactValue={formatFactValue}
        onIntakeMessageChange={setIntakeMessage}
        onHandleIntake={handleIntake}
        onGeneratePlanning={handleGeneratePlanning}
        onGenerateOutline={() => handleGenerateOutline('direct')}
      />
    ),
    planning: (
      <PlanningStage
        planningOptions={planningOptions}
        selectedPlanId={selectedPlanId}
        planningSections={planningSections}
        busy={busy}
        busyAction={busyAction}
        maxPlanningSections={MAX_PLANNING_SECTIONS}
        onGeneratePlanning={handleGeneratePlanning}
        onGenerateOutlineDirect={() => handleGenerateOutline('direct')}
        onGenerateOutlineFromPlan={() => handleGenerateOutline('fromPlan')}
        onSelectPlanningOption={controller.selectPlanningOption}
        onUpdatePlanningSections={controller.updatePlanningSections}
      />
    ),
    outline: (
      <OutlineStage
        outlineSections={outlineSections}
        outlineRisks={outlineRisks}
        titleOptions={titleOptions}
        selectedTitle={formData.title}
        planningSections={planningSections}
        busy={busy}
        busyAction={busyAction}
        onGenerateOutline={handleGenerateOutline}
        onConfirmOutline={handleConfirmOutline}
        onSetTitle={(title) => setFormData((prev) => ({ ...prev, title }))}
        onSetOutlineSections={setOutlineSections}
        onUpdateOutlineKeyPoints={controller.updateOutlineKeyPoints}
      />
    ),
    draft: (
      <DraftStage
        sections={sections}
        selectedText={selectedText}
        selectionInstruction={selectionInstruction}
        fullInstruction={fullInstruction}
        sectionInstructions={sectionInstructions}
        busy={busy}
        busyAction={busyAction}
        onSelectionInstructionChange={setSelectionInstruction}
        onFullInstructionChange={setFullInstruction}
        onSectionInstructionChange={(sectionId, value) => setSectionInstructions((prev) => ({ ...prev, [sectionId]: value }))}
        onSectionHeadingChange={(sectionId, value) =>
          setSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, heading: value } : section)))
        }
        onSectionBodyChange={(sectionId, value) =>
          setSections((prev) => prev.map((section) => (section.id === sectionId ? { ...section, body: value } : section)))
        }
        onReviseSelection={() => handleRevise('selection', '', selectionInstruction)}
        onReviseFull={() => handleRevise('full', '', fullInstruction)}
        onRegenerateDraft={handleRegenerateDraft}
        onRunReview={handleRunReview}
        onGenerateSection={(sectionId) => handleGenerateDraft('section', sectionId)}
        onReviseSection={(sectionId) => handleRevise('section', sectionId, sectionInstructions[sectionId] || '')}
        renderSectionProvenance={renderSectionProvenance}
      />
    ),
    review: (
      <ReviewStage
        sections={sections}
        reviewGateMessage={reviewGateMessage}
        reviewState={reviewState}
        reviewChecks={reviewChecks}
        busy={busy}
        busyAction={busyAction}
        onRunReview={handleRunReview}
        onRegenerateDraft={handleRegenerateDraft}
        onDownload={handleDownload}
        onFixCheck={(fixPrompt) => handleRevise('full', '', fixPrompt)}
        renderSectionProvenance={renderSectionProvenance}
      />
    ),
    done: (
      <ReviewStage
        sections={sections}
        reviewGateMessage={reviewGateMessage}
        reviewState={reviewState}
        reviewChecks={reviewChecks}
        busy={busy}
        busyAction={busyAction}
        onRunReview={handleRunReview}
        onRegenerateDraft={handleRegenerateDraft}
        onDownload={handleDownload}
        onFixCheck={(fixPrompt) => handleRevise('full', '', fixPrompt)}
        renderSectionProvenance={renderSectionProvenance}
      />
    ),
  } as const;

  const primaryStagePanel = primaryStagePanels[currentStep as keyof typeof primaryStagePanels];

  return (
    <GenerateWorkspaceShell
      bootstrapping={bootstrapping}
      pageError={pageError}
      onSaveDraft={handleSaveDraft}
      onOpenSettings={() => window.location.assign('/settings')}
      onGoHome={() => window.location.assign('/')}
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px,1fr]">
        <div className="space-y-6">
          <KnowledgeSidebar
            docTypes={docTypes}
            docType={docType}
            formData={formData}
            phrases={phrases}
            contacts={contacts}
            newAttachment={newAttachment}
            attachments={attachments}
            savingPhraseType={savingPhraseType}
            provider={provider}
            providers={providers}
            visibleRules={visibleRules}
            activeRuleIds={activeRuleIds}
            ruleForm={ruleForm}
            referenceUploadMode={referenceUploadMode}
            sessionReferences={sessionReferences}
            visibleAssets={visibleAssets}
            activeReferenceIds={activeReferenceIds}
            uploadingReference={uploadingReference}
            referenceAnalysisPreview={referenceAnalysisPreview}
            onDocTypeChange={(value) => controller.handleDocTypeChange(value as Draft['doc_type'] | '')}
            onFormDataChange={(field, value) => setFormData((prev) => ({ ...prev, [field]: value }))}
            onSavePhrase={handleSavePhrase}
            onSelectContact={handleSelectContact}
            onSaveContact={handleSaveContact}
            onNewAttachmentChange={setNewAttachment}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onProviderChange={(nextProvider) => {
              setProvider(nextProvider);
              localStorage.setItem('lastUsedProvider', nextProvider);
            }}
            onToggleRule={(ruleId, checked) =>
              setActiveRuleIds((prev) => (checked ? Array.from(new Set([...prev, ruleId])) : prev.filter((item) => item !== ruleId)))
            }
            onRuleFormChange={(field, value) => setRuleForm((prev) => ({ ...prev, [field]: value }))}
            onCreateRule={handleCreateRule}
            onReferenceUpload={handleReferenceUpload}
            onReferenceUploadModeChange={setReferenceUploadMode}
            onRemoveSessionReference={(index) =>
              setSessionReferences((prev) => prev.filter((_, current) => current !== index))
            }
            onToggleReference={(assetId, checked) =>
              setActiveReferenceIds((prev) =>
                checked ? Array.from(new Set([...prev, assetId])) : prev.filter((item) => item !== assetId)
              )
            }
          />
          <VersionHistoryPanel
            currentDraftId={currentDraftId}
            versions={versions}
            onRestoreVersion={handleRestoreVersion}
          />
        </div>

        <div className="space-y-6">
            <StageNavigation
              currentStep={currentStep}
              onChange={setCurrentStep}
              canVisitPlanning={canVisitPlanning}
              canVisitOutline={canVisitOutline}
              canVisitDraft={canVisitDraft}
              canVisitReview={canVisitReview}
            />

            {(activeOperation || operationNotice) && (
              <OperationStatusBanner
                operationPending={operationPending}
                operationNotice={operationNotice}
                operationId={activeOperation?.operationId}
                statusLabel={activeOperation ? formatOperationStatus(activeOperation.status) : null}
              />
            )}

            {pendingChange && (
              <PendingChangeBanner
                pendingChange={pendingChange}
                busy={busy}
                onReject={() => handlePendingChangeDecision('reject')}
                onAccept={() => handlePendingChangeDecision('accept')}
              />
            )}

            <div className="rounded-2xl bg-white p-6 shadow-sm">{primaryStagePanel}</div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">实时预览</h2>
                <span className="text-xs text-gray-500">可在预览区选中文本，再回到“分段成文”做选区改写</span>
              </div>
              <div
                className="mt-4 min-h-[720px] rounded-xl border bg-white p-10 text-sm leading-8"
                onMouseUp={() => setSelectedText(window.getSelection()?.toString().trim() || '')}
              >
                {previewContent ? (
                  <>
                    <div className="text-center text-xl font-bold">{formData.title || '未命名文稿'}</div>
                    <div className="h-8" />
                    <div>{formData.recipient}：</div>
                    <div className="mt-2 space-y-4">
                      {sections.map((section) => (
                        <div key={section.id}>
                          <p className="font-medium">{section.heading}</p>
                          {section.body
                            .split('\n')
                            .filter((line) => line.trim())
                            .map((line, index) => (
                              <p key={index} className="indent-8">
                                {line}
                              </p>
                            ))}
                          {section.provenance?.sources?.length ? (
                            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                              <div className="font-medium text-gray-700">来源依据</div>
                              <div className="mt-2 space-y-2">
                                {section.provenance.sources.map((source, index) => (
                                  <div key={`${section.id}-preview-${source.sourceId || source.label}-${index}`}>
                                    <span className="font-medium text-gray-800">{source.label}</span>
                                    <span className="ml-2">{source.excerpt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {attachments.length > 0 && (
                      <>
                        <div className="h-8" />
                        <div>附件：1. {attachments[0]}</div>
                        {attachments.slice(1).map((attachment, index) => (
                          <div key={attachment + index} className="pl-16">
                            {index + 2}. {attachment}
                          </div>
                        ))}
                        <div className="h-8" />
                        <div className="h-8" />
                      </>
                    )}
                    <div className="pr-8 text-right">{formData.issuer}</div>
                    <div className="pr-8 text-right">{formData.date}</div>
                    {formData.contactName && formData.contactPhone && (
                      <>
                        <div className="h-8" />
                        <div className="text-center">
                          （联系人：{formData.contactName}，电话：{formData.contactPhone}）
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[620px] items-center justify-center text-gray-400">提纲确认后，正文预览会显示在这里。</div>
                )}
              </div>
            </div>
          </div>
        </div>
    </GenerateWorkspaceShell>
  );
}

export default function GeneratePage() {
  return <GeneratePageContent />;
}
