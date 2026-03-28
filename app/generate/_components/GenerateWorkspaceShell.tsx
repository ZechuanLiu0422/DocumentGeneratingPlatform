'use client';

import type { ReactNode } from 'react';

type GenerateWorkspaceShellProps = {
  bootstrapping: boolean;
  pageError: string;
  onSaveDraft: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function GenerateWorkspaceShell({
  bootstrapping,
  pageError,
  onSaveDraft,
  onOpenSettings,
  onGoHome,
  onLogout,
  children,
}: GenerateWorkspaceShellProps) {
  if (bootstrapping) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI 协作式公文工作台</h1>
            <p className="mt-1 text-sm text-gray-500">先补齐事实，再确认提纲，再逐段成文，最后做定稿检查。</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button onClick={onSaveDraft} className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50">
              保存草稿
            </button>
            <button onClick={onOpenSettings} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              设置
            </button>
            <button onClick={onGoHome} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              返回首页
            </button>
            <button onClick={onLogout} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              退出登录
            </button>
          </div>
        </div>

        {pageError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}

        {children}
      </div>
    </div>
  );
}
