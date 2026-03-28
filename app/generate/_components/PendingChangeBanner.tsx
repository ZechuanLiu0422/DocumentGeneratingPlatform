'use client';

import type { DraftSection, PendingChange } from '@/lib/generate-workspace';

type PendingChangeBannerProps = {
  pendingChange: PendingChange;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
};

function getPendingActionLabel(action: PendingChange['action']) {
  if (action === 'regenerate') return '段落重生成';
  if (action === 'revise') return '改写';
  return '版本恢复';
}

function getPendingTargetLabel(targetType: PendingChange['targetType']) {
  if (targetType === 'selection') return '选中文本';
  if (targetType === 'section') return '指定段落';
  return '整稿';
}

function findSectionById(sections: DraftSection[], sectionId: string) {
  return sections.find((section) => section.id === sectionId) || null;
}

export function PendingChangeBanner({
  pendingChange,
  busy,
  onAccept,
  onReject,
}: PendingChangeBannerProps) {
  return (
    <section
      aria-label="候选变更对比"
      data-testid="pending-change-panel"
      className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-lg font-bold text-blue-950">待确认候选变更</div>
          <div className="mt-2 text-sm text-blue-900">
            {getPendingActionLabel(pendingChange.action)} / {getPendingTargetLabel(pendingChange.targetType)}
          </div>
          <div className="mt-2 text-sm text-blue-800">
            {pendingChange.diffSummary || '请先核对前后差异，再决定是否接受。'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-white px-3 py-1 text-blue-800">
              变化段落 {pendingChange.changedSectionIds.length}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-blue-800">
              未变化段落 {pendingChange.unchangedSectionIds.length}
            </span>
            {pendingChange.targetSectionIds.length > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-blue-800">
                目标 {pendingChange.targetSectionIds.join('、')}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onReject}
            disabled={busy}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
          >
            拒绝候选变更
          </button>
          <button
            onClick={onAccept}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            接受候选变更
          </button>
        </div>
      </div>

      {(pendingChange.before.title || pendingChange.after.title) &&
        pendingChange.before.title !== pendingChange.after.title && (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-white/80 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">当前标题</div>
              <div className="mt-2 text-sm text-gray-800">{pendingChange.before.title || '未命名文稿'}</div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">候选标题</div>
              <div className="mt-2 text-sm text-gray-900">{pendingChange.after.title || '未命名文稿'}</div>
            </div>
          </div>
        )}

      <div className="mt-5 space-y-4">
        {(pendingChange.changedSectionIds.length > 0 ? pendingChange.changedSectionIds : ['__full__']).map((sectionId) => {
          const beforeSection =
            sectionId === '__full__' ? null : findSectionById(pendingChange.before.sections, sectionId);
          const afterSection =
            sectionId === '__full__' ? null : findSectionById(pendingChange.after.sections, sectionId);

          return (
            <div key={sectionId} className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-white/80 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">当前内容</div>
                {beforeSection && <div className="mt-2 text-sm font-medium text-gray-900">{beforeSection.heading}</div>}
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                  {beforeSection?.body || pendingChange.before.content || '当前内容为空'}
                </div>
              </div>
              <div className="rounded-xl border border-blue-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">候选内容</div>
                {afterSection && <div className="mt-2 text-sm font-medium text-gray-900">{afterSection.heading}</div>}
                <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-900">
                  {afterSection?.body || pendingChange.after.content || '候选内容为空'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
