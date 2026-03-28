'use client';

type WorkflowQuestion = {
  id: string;
  label: string;
  question: string;
  placeholder: string;
};

type IntakeStageProps = {
  collectedFacts: Record<string, string | string[]>;
  missingFields: string[];
  nextQuestions: WorkflowQuestion[];
  readiness: 'needs_more' | 'ready';
  intakeMessage: string;
  busy: boolean;
  providersAvailable: boolean;
  busyAction: string;
  canVisitPlanning: boolean;
  formatFactValue: (value: string | string[]) => string;
  onIntakeMessageChange: (value: string) => void;
  onHandleIntake: () => void;
  onGeneratePlanning: () => void;
  onGenerateOutline: () => void;
};

export function IntakeStage({
  collectedFacts,
  missingFields,
  nextQuestions,
  readiness,
  intakeMessage,
  busy,
  providersAvailable,
  busyAction,
  canVisitPlanning,
  formatFactValue,
  onIntakeMessageChange,
  onHandleIntake,
  onGeneratePlanning,
  onGenerateOutline,
}: IntakeStageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">信息采集</h2>
        <p className="mt-1 text-sm text-gray-500">AI 会根据当前信息识别缺口，并用 1-3 个高价值问题继续追问。</p>
      </div>

      {Object.keys(collectedFacts).length > 0 && (
        <div className="rounded-xl bg-gray-50 p-4">
          <div className="text-sm font-medium">已采集事实</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(collectedFacts).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-white px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-wide text-gray-400">{key}</div>
                <div className="mt-1 text-gray-700">{formatFactValue(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-medium">当前状态</div>
          <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${readiness === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {readiness === 'ready' ? '信息已基本齐备，可生成提纲' : '信息仍需补充'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingFields.length > 0 ? (
              missingFields.map((field) => (
                <span key={field} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                  {field}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-500">当前没有阻塞提纲生成的关键缺口。</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-medium">AI 下一轮建议追问</div>
          <div className="mt-3 space-y-3">
            {nextQuestions.length > 0 ? (
              nextQuestions.map((question) => (
                <div key={question.id} className="rounded-lg bg-gray-50 px-3 py-3 text-sm">
                  <div className="font-medium">{question.label}</div>
                  <div className="mt-1 text-gray-600">{question.question}</div>
                  <div className="mt-2 text-xs text-gray-400">{question.placeholder}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">先点击下方按钮，让 AI 根据你的输入整理并追问。</div>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium">继续补充给 AI 的说明</label>
        <textarea
          value={intakeMessage}
          onChange={(event) => onIntakeMessageChange(event.target.value)}
          className="min-h-[140px] w-full rounded-lg border px-3 py-2"
          placeholder="例如：请示事项主要是申请专项资金，前期我们已完成方案论证，但仍缺正式批复。"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onHandleIntake}
          disabled={busy || !providersAvailable}
          className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
        >
          {busyAction === 'intake' ? '整理中...' : '让 AI 继续追问并整理事实'}
        </button>
        <button
          onClick={onGeneratePlanning}
          disabled={busy || !canVisitPlanning}
          className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-400"
        >
          {busyAction === 'planning' ? '生成中...' : '进入结构共创'}
        </button>
        <button
          onClick={onGenerateOutline}
          disabled={busy || !canVisitPlanning}
          className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-400"
        >
          直接生成提纲
        </button>
      </div>
    </div>
  );
}
