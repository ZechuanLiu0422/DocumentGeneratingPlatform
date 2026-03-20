'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Draft = {
  id: string;
  title: string | null;
  recipient: string | null;
  updated_at: string;
};

export default function HomePage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDrafts = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/drafts');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '草稿加载失败');
        return;
      }

      setDrafts(data.drafts || []);
    } catch {
      setError('草稿加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
  }, []);

  const handleDeleteDraft = async (id: string) => {
    const response = await fetch(`/api/drafts?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      fetchDrafts();
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">公文生成平台</h1>
          <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
            退出登录
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

        {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700">{error}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">草稿箱</h2>
          {drafts.length === 0 ? (
            <div className="text-gray-400 text-sm">暂无草稿</div>
          ) : (
            <div className="space-y-2">
              {drafts.map((draft) => (
                <div key={draft.id} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium">{draft.title || '未命名草稿'}</div>
                    <div className="text-sm text-gray-600">
                      {draft.recipient || '未填写主送机关'} · {new Date(draft.updated_at).toLocaleString('zh-CN')}
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
          )}
        </div>
      </div>
    </div>
  );
}
