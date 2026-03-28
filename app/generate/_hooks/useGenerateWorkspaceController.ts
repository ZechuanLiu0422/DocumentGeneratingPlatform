'use client';

import type { Dispatch, SetStateAction } from 'react';
import type {
  DraftSection,
  DraftSnapshot,
  OutlineSection,
  PlanningOption,
  PlanningSection,
  WorkflowStage,
} from '@/lib/generate-workspace';

type OperationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | null;

type WorkflowQuestion = {
  id: string;
  label: string;
  question: string;
  placeholder: string;
};

type WorkspaceFormData = {
  title: string;
  recipient: string;
  content: string;
  issuer: string;
  date: string;
  contactName: string;
  contactPhone: string;
};

type FilterableByDocType = {
  doc_type: DraftSnapshot['doc_type'] | null;
};

type UseGenerateWorkspaceControllerOptions<
  TRule extends FilterableByDocType,
  TAsset extends FilterableByDocType,
  TSessionReference,
> = {
  readiness: 'needs_more' | 'ready';
  planningOptions: PlanningOption[];
  planningSections: PlanningSection[];
  selectedPlanId: string;
  workflowStage: WorkflowStage;
  outlineSections: OutlineSection[];
  outlineVersion: string;
  outlineRisks: string[];
  titleOptions: string[];
  sections: DraftSection[];
  currentDraftId: string | null;
  busyAction: string;
  activeOperationStatus: OperationStatus;
  docType: DraftSnapshot['doc_type'] | '';
  provider: DraftSnapshot['provider'];
  formData: WorkspaceFormData;
  attachments: string[];
  intakeMessage: string;
  activeRuleIds: string[];
  activeReferenceIds: string[];
  sessionReferences: TSessionReference[];
  rules: TRule[];
  referenceAssets: TAsset[];
  onResetWorkflow: () => void;
  onFetchVersions: (draftId: string) => Promise<void> | void;
  setDocType: Dispatch<SetStateAction<DraftSnapshot['doc_type'] | ''>>;
  setCurrentDraftId: Dispatch<SetStateAction<string | null>>;
  setWorkflowStage: Dispatch<SetStateAction<WorkflowStage>>;
  setCurrentStep: Dispatch<SetStateAction<WorkflowStage>>;
  setCollectedFacts: Dispatch<SetStateAction<Record<string, string | string[]>>>;
  setMissingFields: Dispatch<SetStateAction<string[]>>;
  setNextQuestions: Dispatch<SetStateAction<WorkflowQuestion[]>>;
  setReadiness: Dispatch<SetStateAction<'needs_more' | 'ready'>>;
  setIntakeMessage: Dispatch<SetStateAction<string>>;
  setBusyAction: Dispatch<SetStateAction<string>>;
  setFormData: Dispatch<SetStateAction<WorkspaceFormData>>;
  setPlanningVersion: Dispatch<SetStateAction<string>>;
  setPlanningOptions: Dispatch<SetStateAction<PlanningOption[]>>;
  setSelectedPlanId: Dispatch<SetStateAction<string>>;
  setPlanningSections: Dispatch<SetStateAction<PlanningSection[]>>;
  setPlanningConfirmed: Dispatch<SetStateAction<boolean>>;
  setOutlineVersion: Dispatch<SetStateAction<string>>;
  setTitleOptions: Dispatch<SetStateAction<string[]>>;
  setOutlineSections: Dispatch<SetStateAction<OutlineSection[]>>;
  setOutlineRisks: Dispatch<SetStateAction<string[]>>;
};

const MAX_PLANNING_SECTIONS = 8;
const editablePlanningFieldLabels = {
  headingDraft: '段落标题',
  topicSummary: '本段内容',
} as const;

function getIncompletePlanningSections(sections: PlanningSection[]) {
  return sections
    .map((section, index) => {
      const missing = Object.entries(editablePlanningFieldLabels)
        .filter(([field]) => !section[field as keyof PlanningSection].trim())
        .map(([, label]) => label);

      if (missing.length === 0) {
        return '';
      }

      return `第 ${index + 1} 段缺少：${missing.join('、')}`;
    })
    .filter(Boolean);
}

export function useGenerateWorkspaceController<
  TRule extends FilterableByDocType,
  TAsset extends FilterableByDocType,
  TSessionReference,
>({
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
  activeOperationStatus,
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
  onResetWorkflow,
  onFetchVersions,
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
}: UseGenerateWorkspaceControllerOptions<TRule, TAsset, TSessionReference>) {
  const canVisitPlanning =
    readiness === 'ready' || planningOptions.length > 0 || ['planning', 'outline', 'draft', 'review', 'done'].includes(workflowStage);
  const canVisitOutline = outlineSections.length > 0 || ['outline', 'draft', 'review', 'done'].includes(workflowStage);
  const canVisitDraft = outlineSections.length > 0 && currentDraftId !== null;
  const canVisitReview = sections.length > 0;
  const operationPending = activeOperationStatus === 'queued' || activeOperationStatus === 'running';
  const busy = Boolean(busyAction) || operationPending;
  const visibleRules = rules.filter((rule) => !docType || !rule.doc_type || rule.doc_type === docType);
  const visibleAssets = referenceAssets.filter((asset) => !docType || !asset.doc_type || asset.doc_type === docType);

  const handleDocTypeChange = (value: DraftSnapshot['doc_type'] | '') => {
    setDocType(value);
    onResetWorkflow();
  };

  const selectPlanningOption = (option: PlanningOption) => {
    setSelectedPlanId(option.planId);
    setPlanningSections(option.sections);
    setPlanningConfirmed(false);
  };

  const updatePlanningSections = (updater: (current: PlanningSection[]) => PlanningSection[]) => {
    setPlanningSections((prev) => updater(prev));
    setPlanningConfirmed(false);
  };

  const updateOutlineKeyPoints = (sectionIndex: number, updater: (current: string[]) => string[]) => {
    setOutlineSections((prev) =>
      prev.map((item, current) =>
        current === sectionIndex
          ? {
              ...item,
              keyPoints: updater(item.keyPoints || []),
            }
          : item
      )
    );
  };

  const handleIntake = async () => {
    if (!docType) {
      alert('请先选择文档类型');
      return;
    }

    setBusyAction('intake');

    try {
      const response = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          docType,
          provider,
          answers: {
            title: formData.title,
            recipient: formData.recipient,
            content: formData.content,
            issuer: formData.issuer,
            date: formData.date,
            contactName: formData.contactName,
            contactPhone: formData.contactPhone,
            attachments,
          },
          message: intakeMessage,
          activeRuleIds,
          activeReferenceIds,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '信息采集失败');
      }

      const nextReadiness = (data.readiness || 'needs_more') as 'needs_more' | 'ready';
      const nextStage = (data.workflowStage || (nextReadiness === 'ready' ? 'planning' : 'intake')) as WorkflowStage;

      setCurrentDraftId(data.draftId);
      setCollectedFacts(data.collectedFacts || {});
      setMissingFields(data.missingFields || []);
      setNextQuestions(data.nextQuestions || []);
      setReadiness(nextReadiness);
      setWorkflowStage(nextStage);
      if (!formData.title && data.suggestedTitle) {
        setFormData((prev) => ({ ...prev, title: data.suggestedTitle }));
      }
      if (nextReadiness === 'ready') {
        setCurrentStep('planning');
      }
      setIntakeMessage('');
      await onFetchVersions(data.draftId);
    } catch (error: any) {
      alert(error.message || '信息采集失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleGeneratePlanning = async () => {
    if (!currentDraftId) {
      alert('请先完成一次 AI 信息采集');
      return;
    }

    setBusyAction('planning');

    try {
      const response = await fetch('/api/ai/outline-plan', {
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
        throw new Error(data.error || '结构建议生成失败');
      }

      const nextOptions = data.options || [];
      setPlanningVersion(data.planVersion || '');
      setPlanningOptions(nextOptions);
      if (nextOptions[0]) {
        selectPlanningOption(nextOptions[0]);
      }
      setWorkflowStage('planning');
      setCurrentStep('planning');
    } catch (error: any) {
      alert(error.message || '结构建议生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleGenerateOutline = async (mode: 'direct' | 'fromPlan' = 'direct') => {
    if (!currentDraftId) {
      alert('请先完成一次 AI 信息采集');
      return;
    }

    if (mode === 'fromPlan' && planningSections.length === 0) {
      alert('请先确认结构方案');
      return;
    }

    if (mode === 'fromPlan') {
      if (planningSections.length > MAX_PLANNING_SECTIONS) {
        alert(`结构共创最多支持 ${MAX_PLANNING_SECTIONS} 段，请先删减后再生成正式提纲`);
        return;
      }

      const incompleteSections = getIncompletePlanningSections(planningSections);
      if (incompleteSections.length > 0) {
        alert(`请先补全结构共创中的段落信息：\n${incompleteSections.join('\n')}`);
        return;
      }
    }

    setBusyAction('outline');

    try {
      const response = await fetch('/api/ai/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          confirmedPlan:
            mode === 'fromPlan'
              ? {
                  selectedPlanId,
                  sections: planningSections,
                }
              : null,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '提纲生成失败');
      }

      setOutlineVersion(data.outlineVersion || '');
      setTitleOptions(data.titleOptions || []);
      setOutlineSections(data.outlineSections || []);
      setOutlineRisks(data.risks || []);
      if (!formData.title && data.titleOptions?.[0]) {
        setFormData((prev) => ({ ...prev, title: data.titleOptions[0] }));
      }
      setWorkflowStage('outline');
      setCurrentStep('outline');
      if (mode === 'fromPlan') {
        setPlanningConfirmed(true);
      }
    } catch (error: any) {
      alert(error.message || '提纲生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleConfirmOutline = async () => {
    if (!currentDraftId || outlineSections.length === 0) {
      alert('请先生成提纲');
      return;
    }

    const response = await fetch('/api/ai/outline/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: currentDraftId,
        outlineVersion,
        acceptedOutline: {
          title: formData.title,
          titleOptions,
          sections: outlineSections,
          risks: outlineRisks,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || '提纲确认失败');
      return;
    }

    setWorkflowStage('draft');
    setCurrentStep('draft');
    await onFetchVersions(currentDraftId);
  };

  return {
    busy,
    operationPending,
    canVisitPlanning,
    canVisitOutline,
    canVisitDraft,
    canVisitReview,
    visibleRules,
    visibleAssets,
    handleDocTypeChange,
    selectPlanningOption,
    updatePlanningSections,
    updateOutlineKeyPoints,
    handleIntake,
    handleGeneratePlanning,
    handleGenerateOutline,
    handleConfirmOutline,
  };
}
