'use client';

import type { PlanningOption, PlanningSection } from '@/lib/generate-workspace';

type PlanningStageProps = {
  planningOptions: PlanningOption[];
  selectedPlanId: string;
  planningSections: PlanningSection[];
  busy: boolean;
  busyAction: string;
  maxPlanningSections: number;
  onGeneratePlanning: () => void;
  onGenerateOutlineDirect: () => void;
  onGenerateOutlineFromPlan: () => void;
  onSelectPlanningOption: (option: PlanningOption) => void;
  onUpdatePlanningSections: (updater: (current: PlanningSection[]) => PlanningSection[]) => void;
};

export function PlanningStage({
  planningOptions,
  selectedPlanId,
  planningSections,
  busy,
  busyAction,
  maxPlanningSections,
  onGeneratePlanning,
  onGenerateOutlineDirect,
  onGenerateOutlineFromPlan,
  onSelectPlanningOption,
  onUpdatePlanningSections,
}: PlanningStageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">结构共创</h2>
        <p className="mt-1 text-sm text-gray-500">AI 会先给你 3 种结构方案。先选方向，再微调段数、顺序和每段主题，最后再生成正式提纲。</p>
      </div>

      {planningOptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">还没有结构方案，先让 AI 给出几种明显不同的组织思路。</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={onGeneratePlanning} disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
              {busyAction === 'planning' ? '生成中...' : 'AI 生成结构建议'}
            </button>
            <button onClick={onGenerateOutlineDirect} disabled={busy} className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:text-gray-400">
              直接生成提纲
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            {planningOptions.map((option) => (
              <button
                key={option.planId}
                type="button"
                onClick={() => onSelectPlanningOption(option)}
                className={`rounded-2xl border p-5 text-left transition-colors ${
                  selectedPlanId === option.planId
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold">{option.label}</div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">{option.sections.length} 段</span>
                </div>
                <div className="mt-2 text-sm text-blue-700">{option.strategy}</div>
                <div className="mt-3 text-sm leading-6 text-gray-600">{option.whyThisWorks}</div>
                <div className="mt-4 space-y-2">
                  {option.sections.map((section, index) => (
                    <div key={section.id} className="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-700">
                      <div className="font-medium">{index + 1}. {section.headingDraft}</div>
                      <div className="mt-1 text-xs text-gray-500">{section.topicSummary}</div>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-base font-semibold">当前选中的结构方案</div>
                <div className="mt-1 text-sm text-gray-500">继续调整段落标题、本段内容和顺序即可。AI 的结构说明默认折叠，不会干扰主编辑流程。</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={onGeneratePlanning} disabled={busy} className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:text-gray-400">
                  {busyAction === 'planning' ? '生成中...' : '换一批结构方案'}
                </button>
                <button onClick={onGenerateOutlineDirect} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50 disabled:text-gray-400">
                  直接生成提纲
                </button>
                <button onClick={onGenerateOutlineFromPlan} disabled={busy || planningSections.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">
                  基于该结构生成正式提纲
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {planningSections.map((section, index) => (
                <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">第 {index + 1} 段</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePlanningSections((current) => {
                            if (index === 0) return current;
                            const next = [...current];
                            [next[index - 1], next[index]] = [next[index], next[index - 1]];
                            return next;
                          })
                        }
                        disabled={index === 0}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:text-gray-300"
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdatePlanningSections((current) => {
                            if (index === current.length - 1) return current;
                            const next = [...current];
                            [next[index], next[index + 1]] = [next[index + 1], next[index]];
                            return next;
                          })
                        }
                        disabled={index === planningSections.length - 1}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:text-gray-300"
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePlanningSections((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium">段落标题</label>
                      <textarea
                        value={section.headingDraft}
                        onChange={(event) =>
                          onUpdatePlanningSections((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, headingDraft: event.target.value } : item
                            )
                          )
                        }
                        className="min-h-[92px] w-full rounded-lg border px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium">本段内容</label>
                      <textarea
                        value={section.topicSummary}
                        onChange={(event) =>
                          onUpdatePlanningSections((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, topicSummary: event.target.value } : item
                            )
                          )
                        }
                        className="min-h-[92px] w-full rounded-lg border px-3 py-2"
                      />
                    </div>

                    <details className="rounded-xl border border-gray-200 bg-gray-50">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
                        AI 结构说明
                      </summary>
                      <div className="space-y-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-700">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">这一段的作用</div>
                          <p className="mt-1 leading-6">{section.purpose || '生成正式提纲时将自动补全。'}</p>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">为什么排在这里</div>
                          <p className="mt-1 leading-6">{section.orderReason || '生成正式提纲时将自动补全。'}</p>
                        </div>
                        <p className="text-xs leading-5 text-gray-500">
                          你修改段落标题、本段内容或顺序后，这里的说明会在生成正式提纲时自动同步更新。
                        </p>
                      </div>
                    </details>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                onUpdatePlanningSections((current) => [
                  ...current,
                  {
                    id: `planning-${Date.now()}`,
                    headingDraft: '',
                    purpose: '',
                    topicSummary: '',
                    orderReason: '',
                  },
                ])
              }
              disabled={planningSections.length >= maxPlanningSections}
              className="mt-4 rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
            >
              {planningSections.length >= maxPlanningSections ? `最多 ${maxPlanningSections} 段` : '新增一段'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
