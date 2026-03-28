'use client';

type DraftSection = {
  id: string;
  heading: string;
  body: string;
};

type VersionItem = {
  id: string;
  stage: string;
  title: string | null;
  content: string | null;
  sections: DraftSection[];
  change_summary: string | null;
  created_at: string;
};

type VersionHistoryPanelProps = {
  currentDraftId: string | null;
  versions: VersionItem[];
  onRestoreVersion: (versionId: string) => void;
};

export function VersionHistoryPanel({
  currentDraftId,
  versions,
  onRestoreVersion,
}: VersionHistoryPanelProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">版本历史</h2>
        {currentDraftId && <span className="text-xs text-gray-500">{versions.length} 个快照</span>}
      </div>
      <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto">
        {versions.map((version) => (
          <div key={version.id} className="rounded-xl border border-gray-200 p-3 text-sm">
            <div className="font-medium">{version.change_summary || version.stage}</div>
            <div className="mt-1 text-xs text-gray-500">{new Date(version.created_at).toLocaleString('zh-CN')}</div>
            <button onClick={() => onRestoreVersion(version.id)} className="mt-3 text-blue-600 hover:underline">
              恢复到此版本
            </button>
          </div>
        ))}
        {currentDraftId && versions.length === 0 && <div className="text-sm text-gray-400">关键节点快照会显示在这里。</div>}
        {!currentDraftId && <div className="text-sm text-gray-400">生成或保存草稿后会出现版本历史。</div>}
      </div>
    </div>
  );
}
