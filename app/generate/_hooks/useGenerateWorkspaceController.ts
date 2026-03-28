'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { DraftSection, DraftSnapshot, OutlineSection, PlanningOption, PlanningSection, WorkflowStage } from '@/lib/generate-workspace';

type OperationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | null;

type FilterableByDocType = {
  doc_type: DraftSnapshot['doc_type'] | null;
};

type UseGenerateWorkspaceControllerOptions<TRule extends FilterableByDocType, TAsset extends FilterableByDocType> = {
  readiness: 'needs_more' | 'ready';
  planningOptions: PlanningOption[];
  workflowStage: WorkflowStage;
  outlineSections: OutlineSection[];
  sections: DraftSection[];
  currentDraftId: string | null;
  busyAction: string;
  activeOperationStatus: OperationStatus;
  docType: DraftSnapshot['doc_type'] | '';
  rules: TRule[];
  referenceAssets: TAsset[];
  onResetWorkflow: () => void;
  setDocType: Dispatch<SetStateAction<DraftSnapshot['doc_type'] | ''>>;
  setSelectedPlanId: Dispatch<SetStateAction<string>>;
  setPlanningSections: Dispatch<SetStateAction<PlanningSection[]>>;
  setPlanningConfirmed: Dispatch<SetStateAction<boolean>>;
  setOutlineSections: Dispatch<SetStateAction<OutlineSection[]>>;
};

export function useGenerateWorkspaceController<TRule extends FilterableByDocType, TAsset extends FilterableByDocType>({
  readiness,
  planningOptions,
  workflowStage,
  outlineSections,
  sections,
  currentDraftId,
  busyAction,
  activeOperationStatus,
  docType,
  rules,
  referenceAssets,
  onResetWorkflow,
  setDocType,
  setSelectedPlanId,
  setPlanningSections,
  setPlanningConfirmed,
  setOutlineSections,
}: UseGenerateWorkspaceControllerOptions<TRule, TAsset>) {
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
  };
}
