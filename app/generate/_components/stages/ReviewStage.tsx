'use client';

import type { ReactNode } from 'react';
import type { DraftSection, ReviewState } from '@/lib/generate-workspace';

type ReviewCheck = {
  code: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  fixPrompt: string;
};

type ReviewStageProps = {
  sections: DraftSection[];
  reviewGateMessage: string;
  reviewState: ReviewState | null;
  reviewChecks: ReviewCheck[];
  busy: boolean;
  busyAction: string;
  onRunReview: () => void;
  onRegenerateDraft: () => void;
  onDownload: () => void;
  onFixCheck: (fixPrompt: string) => void;
  renderSectionProvenance: (section: DraftSection, emptyMessage?: string) => ReactNode;
};

function statusClass(status: ReviewCheck['status']) {
  if (status === 'pass') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'warning') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

export function ReviewStage({
  sections,
  reviewGateMessage,
  reviewState,
  reviewChecks,
  busy,
  busyAction,
  onRunReview,
  onRegenerateDraft,
  onDownload,
  onFixCheck,
  renderSectionProvenance,
}: ReviewStageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">定稿检查</h2>
        <p className="mt-1 text-sm text-gray-500">先检查规范性，再决定是否一键修复或直接导出。</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onRunReview}
          disabled={busy || sections.length === 0}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {busyAction === 'review' ? '检查中...' : '重新运行定稿检查'}
        </button>
        <button
          onClick={onRegenerateDraft}
          disabled={busy || sections.length === 0}
          className="rounded-lg border border-amber-200 px-5 py-3 text-amber-700 hover:bg-amber-50 disabled:text-gray-400"
        >
          {busyAction === 'draft' ? '重新生成中...' : '重新生成正文'}
        </button>
        <button
          onClick={onDownload}
          disabled={busy || sections.length === 0}
          className="rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700 disabled:bg-gray-400"
        >
          {busyAction === 'download' ? '导出中...' : '下载 Word 定稿'}
        </button>
      </div>

      {(reviewGateMessage || reviewState) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            reviewState?.status === 'pass'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {reviewGateMessage ||
            `最近一次定稿检查结果：${
              reviewState?.status === 'pass' ? '通过' : reviewState?.status === 'warning' ? '有提醒' : '未通过'
            }。`}
        </div>
      )}

      <div className="space-y-3">
        {reviewChecks.length > 0 ? (
          reviewChecks.map((check) => (
            <div key={check.code} className={`rounded-xl border p-4 ${statusClass(check.status)}`}>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide opacity-70">{check.code}</div>
                  <div className="mt-1 font-medium">{check.message}</div>
                </div>
                {check.fixPrompt && (
                  <button
                    onClick={() => onFixCheck(check.fixPrompt)}
                    disabled={busy}
                    className="rounded-lg border border-current px-4 py-2 text-sm"
                  >
                    一键修复
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            先运行一次定稿检查，AI 会列出风险项和一键修复建议。
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-medium">已采纳依据</div>
        <div className="mt-3 space-y-4">
          {sections.map((section) => (
            <div key={`review-provenance-${section.id}`}>
              <div className="text-sm font-medium text-gray-900">{section.heading}</div>
              {renderSectionProvenance(section, '本段当前没有可展示的采纳依据。')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
