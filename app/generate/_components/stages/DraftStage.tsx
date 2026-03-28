'use client';

import type { ReactNode } from 'react';
import type { DraftSection } from '@/lib/generate-workspace';

type DraftStageProps = {
  sections: DraftSection[];
  selectedText: string;
  selectionInstruction: string;
  fullInstruction: string;
  sectionInstructions: Record<string, string>;
  busy: boolean;
  busyAction: string;
  onSelectionInstructionChange: (value: string) => void;
  onFullInstructionChange: (value: string) => void;
  onSectionInstructionChange: (sectionId: string, value: string) => void;
  onSectionHeadingChange: (sectionId: string, value: string) => void;
  onSectionBodyChange: (sectionId: string, value: string) => void;
  onReviseSelection: () => void;
  onReviseFull: () => void;
  onRegenerateDraft: () => void;
  onRunReview: () => void;
  onGenerateSection: (sectionId: string) => void;
  onReviseSection: (sectionId: string) => void;
  renderSectionProvenance: (section: DraftSection, emptyMessage?: string) => ReactNode;
};

export function DraftStage({
  sections,
  selectedText,
  selectionInstruction,
  fullInstruction,
  sectionInstructions,
  busy,
  busyAction,
  onSelectionInstructionChange,
  onFullInstructionChange,
  onSectionInstructionChange,
  onSectionHeadingChange,
  onSectionBodyChange,
  onReviseSelection,
  onReviseFull,
  onRegenerateDraft,
  onRunReview,
  onGenerateSection,
  onReviseSection,
  renderSectionProvenance,
}: DraftStageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">分段成文</h2>
        <p className="mt-1 text-sm text-gray-500">正文按段生成，后续优先做段落级改写，全文改写作为兜底。</p>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">提纲已经准备好，现在可以生成正文。</p>
          <button
            onClick={onRegenerateDraft}
            disabled={busy}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {busyAction === 'draft' ? '生成中...' : '按提纲生成正文'}
          </button>
        </div>
      ) : (
        <>
          {selectedText && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-medium text-blue-900">已选中文本</div>
              <div className="mt-2 text-sm text-blue-800">{selectedText}</div>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={selectionInstruction}
                  onChange={(event) => onSelectionInstructionChange(event.target.value)}
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  placeholder="例如：把这句话改得更凝练、更像请示语气"
                />
                <button
                  onClick={onReviseSelection}
                  disabled={busy || !selectionInstruction.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  改写选中内容
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm font-medium">整稿协作</div>
            <div className="mt-3 flex flex-col gap-3 xl:flex-row">
              <input
                type="text"
                value={fullInstruction}
                onChange={(event) => onFullInstructionChange(event.target.value)}
                className="flex-1 rounded-lg border px-3 py-2"
                placeholder="例如：整体语气再严肃一些，第二部分再补充执行要求"
              />
              <button
                onClick={onReviseFull}
                disabled={busy || !fullInstruction.trim()}
                className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:text-gray-400"
              >
                AI 修改整稿
              </button>
              <button
                onClick={onRegenerateDraft}
                disabled={busy}
                className="rounded-lg border border-amber-200 px-4 py-2 text-amber-700 hover:bg-amber-50 disabled:text-gray-400"
              >
                {busyAction === 'draft' ? '重新生成中...' : '重新生成正文'}
              </button>
              <button
                onClick={onRunReview}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                去做定稿检查
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <input
                    type="text"
                    value={section.heading}
                    onChange={(event) => onSectionHeadingChange(section.id, event.target.value)}
                    className="rounded-lg border px-3 py-2 xl:w-64"
                  />
                  <button
                    onClick={() => onGenerateSection(section.id)}
                    disabled={busy}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    AI 重写本段
                  </button>
                </div>
                <textarea
                  value={section.body}
                  onChange={(event) => onSectionBodyChange(section.id, event.target.value)}
                  className="mt-3 min-h-[180px] w-full rounded-lg border px-3 py-2"
                />
                <div className="mt-3 flex flex-col gap-3 xl:flex-row">
                  <input
                    type="text"
                    value={sectionInstructions[section.id] || ''}
                    onChange={(event) => onSectionInstructionChange(section.id, event.target.value)}
                    className="flex-1 rounded-lg border px-3 py-2"
                    placeholder="例如：这一段再扩写实施步骤，或改得更像通知口径"
                  />
                  <button
                    onClick={() => onReviseSection(section.id)}
                    disabled={busy || !(sectionInstructions[section.id] || '').trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    AI 修改本段
                  </button>
                </div>
                {renderSectionProvenance(section)}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
