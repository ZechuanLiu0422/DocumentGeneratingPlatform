'use client';

import { useEffect } from 'react';

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({ error, reset }: GlobalErrorPageProps) {
  useEffect(() => {
    console.error('Global app error:', error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body>
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-xl bg-white shadow p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900">应用启动异常</h1>
            <p className="mt-3 text-sm text-gray-600">
              应用在初始化时遇到错误。你可以先尝试重新加载，如果持续出现，请检查本地环境变量和终端日志。
            </p>
            {error.message ? (
              <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-left text-sm text-red-700 break-words">
                {error.message}
              </div>
            ) : null}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => reset()}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                重新加载
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
