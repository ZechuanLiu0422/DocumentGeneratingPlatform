'use client';

import type { OutlineSection, PlanningSection } from '@/lib/generate-workspace';

type OutlineStageProps = {
  outlineSections: OutlineSection[];
  outlineRisks: string[];
  titleOptions: string[];
  selectedTitle: string;
  planningSections: PlanningSection[];
  busy: boolean;
  busyAction: string;
  onGenerateOutline: (mode: 'direct' | 'fromPlan') => void;
  onConfirmOutline: () => void;
  onSetTitle: (title: string) => void;
  onSetOutlineSections: (updater: (current: OutlineSection[]) => OutlineSection[]) => void;
  onUpdateOutlineKeyPoints: (sectionIndex: number, updater: (current: string[]) => string[]) => void;
};

export function OutlineStage({
  outlineSections,
  outlineRisks,
  titleOptions,
  selectedTitle,
  planningSections,
  busy,
  busyAction,
  onGenerateOutline,
  onConfirmOutline,
  onSetTitle,
  onSetOutlineSections,
  onUpdateOutlineKeyPoints,
}: OutlineStageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">提纲确认</h2>
        <p className="mt-1 text-sm text-gray-500">先确认标题和提纲结构，再进入正文生成，能显著降低返工。</p>
      </div>

      {outlineSections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <p className="text-sm text-gray-500">还没有正式提纲，先完成结构共创，或者直接生成一版正式提纲。</p>
          <button
            onClick={() => onGenerateOutline(planningSections.length > 0 ? 'fromPlan' : 'direct')}
            disabled={busy}
            className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
          >
            {busyAction === 'outline' ? '生成中...' : '生成提纲'}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm font-medium">标题建议</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {titleOptions.map((title) => (
                <button
                  key={title}
                  onClick={() => onSetTitle(title)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    selectedTitle === title ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          </div>

          {outlineRisks.length > 0 && (
            <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
              <div className="font-medium">AI 风险提醒</div>
              <div className="mt-2 space-y-2">
                {outlineRisks.map((risk) => (
                  <div key={risk}>{risk}</div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {outlineSections.map((section, index) => (
              <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.2fr),1.8fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium">小标题</label>
                    <textarea
                      value={section.heading}
                      onChange={(event) =>
                        onSetOutlineSections((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, heading: event.target.value } : item
                          )
                        )
                      }
                      className="min-h-[104px] w-full resize-y rounded-lg border px-3 py-2 text-base leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">本段目的</label>
                    <textarea
                      value={section.purpose}
                      onChange={(event) =>
                        onSetOutlineSections((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index ? { ...item, purpose: event.target.value } : item
                          )
                        )
                      }
                      className="min-h-[104px] w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium">关键要点</label>
                    <button
                      type="button"
                      onClick={() => onUpdateOutlineKeyPoints(index, (current) => [...current, ''])}
                      className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      新增一条
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(section.keyPoints.length > 0 ? section.keyPoints : ['']).map((point, pointIndex) => (
                      <div key={`${section.id}-${pointIndex}`} className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                          {pointIndex + 1}
                        </div>
                        <input
                          type="text"
                          value={point}
                          onChange={(event) =>
                            onUpdateOutlineKeyPoints(index, (current) => {
                              const next = current.length > 0 ? [...current] : [''];
                              next[pointIndex] = event.target.value;
                              return next;
                            })
                          }
                          className="flex-1 rounded-lg border px-3 py-2"
                          placeholder={`请输入第 ${pointIndex + 1} 条关键要点`}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateOutlineKeyPoints(index, (current) =>
                              current.filter((_, currentIndex) => currentIndex !== pointIndex)
                            )
                          }
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onGenerateOutline(planningSections.length > 0 ? 'fromPlan' : 'direct')}
              disabled={busy}
              className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:text-gray-400"
            >
              让 AI 重排提纲
            </button>
            <button onClick={onConfirmOutline} className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700">
              确认提纲并进入正文
            </button>
          </div>
        </>
      )}
    </div>
  );
}
