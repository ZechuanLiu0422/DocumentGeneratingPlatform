'use client';

import type { WorkflowStage } from '@/lib/generate-workspace';

type StageNavigationProps = {
  currentStep: WorkflowStage;
  onChange: (step: WorkflowStage) => void;
  canVisitPlanning: boolean;
  canVisitOutline: boolean;
  canVisitDraft: boolean;
  canVisitReview: boolean;
};

export function StageNavigation({
  currentStep,
  onChange,
  canVisitPlanning,
  canVisitOutline,
  canVisitDraft,
  canVisitReview,
}: StageNavigationProps) {
  const steps = [
    { id: 'intake', label: '1. 信息采集', enabled: true },
    { id: 'planning', label: '2. 结构共创', enabled: canVisitPlanning },
    { id: 'outline', label: '3. 提纲确认', enabled: canVisitOutline },
    { id: 'draft', label: '4. 分段成文', enabled: canVisitDraft },
    { id: 'review', label: '5. 定稿检查', enabled: canVisitReview },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          disabled={!step.enabled}
          onClick={() => step.enabled && onChange(step.id)}
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            currentStep === step.id
              ? 'border-blue-600 bg-blue-600 text-white'
              : step.enabled
                ? 'border-gray-200 bg-white hover:border-blue-300 hover:text-blue-700'
                : 'border-gray-100 bg-gray-50 text-gray-400'
          }`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}
