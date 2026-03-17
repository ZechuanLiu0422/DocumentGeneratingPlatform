'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchDrafts();
    }
  }, [status, router]);

  const fetchDrafts = async () => {
    const res = await fetch('/api/drafts');
    const data = await res.json();
    if (data.drafts) {
      setDrafts(data.drafts);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    await fetch(`/api/drafts?id=${id}`, { method: 'DELETE' });
    fetchDrafts();
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">公文生成平台</h1>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => router.push('/generate')}
            className="p-6 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700"
          >
            <h2 className="text-xl font-bold">新建公文</h2>
          </button>
          <button
            onClick={() => router.push('/history')}
            className="p-6 bg-white rounded-lg shadow hover:shadow-lg"
          >
            <h2 className="text-xl font-bold">历史记录</h2>
          </button>
          <button
            onClick={() => router.push('/settings')}
            className="p-6 bg-white rounded-lg shadow hover:shadow-lg"
          >
            <h2 className="text-xl font-bold">设置</h2>
          </button>
        </div>

        {drafts.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">草稿箱</h2>
            <div className="space-y-2">
              {drafts.map(draft => (
                <div key={draft.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium">{draft.title || '未命名草稿'}</div>
                    <div className="text-sm text-gray-600">
                      {draft.recipient} · {new Date(draft.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/generate?draft=${draft.id}`)}
                      className="px-3 py-1 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      继续编辑
                    </button>
                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
