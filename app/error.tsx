'use client';

import { useEffect } from 'react';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('App route error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl bg-white shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">页面暂时出错了</h1>
        <p className="mt-3 text-sm text-gray-600">
          系统遇到了一个临时问题，你可以先重试一次。如果问题持续出现，请刷新页面或重新登录后再试。
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
            刷新页面
          </button>
        </div>
      </div>
    </div>
  );
}
