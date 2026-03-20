'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DocumentItem = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  title: string;
  recipient: string;
  issuer: string;
  doc_date: string;
  created_at: string;
};

type DocumentDetail = DocumentItem & {
  generated_content: string;
  ai_provider: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/history');
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '历史记录加载失败');
        return;
      }

      setDocuments(data.documents || []);
    } catch {
      setError('历史记录加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    const response = await fetch(`/api/history?id=${id}`);
    const data = await response.json();
    if (response.ok && data.document) {
      setSelectedDoc(data.document);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const docTypeNames: Record<DocumentItem['doc_type'], string> = {
    notice: '通知',
    letter: '函',
    request: '请示',
    report: '报告',
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">历史记录</h1>
          <div className="flex gap-4">
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              退出登录
            </button>
            <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
              返回首页
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700">{error}</div>}

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium">类型</th>
                <th className="px-6 py-3 text-left text-sm font-medium">标题</th>
                <th className="px-6 py-3 text-left text-sm font-medium">主送机关</th>
                <th className="px-6 py-3 text-left text-sm font-medium">发文机关</th>
                <th className="px-6 py-3 text-left text-sm font-medium">成文日期</th>
                <th className="px-6 py-3 text-left text-sm font-medium">创建时间</th>
                <th className="px-6 py-3 text-left text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{docTypeNames[doc.doc_type]}</td>
                  <td className="px-6 py-4 text-sm">{doc.title}</td>
                  <td className="px-6 py-4 text-sm">{doc.recipient}</td>
                  <td className="px-6 py-4 text-sm">{doc.issuer}</td>
                  <td className="px-6 py-4 text-sm">{doc.doc_date}</td>
                  <td className="px-6 py-4 text-sm">{new Date(doc.created_at).toLocaleString('zh-CN')}</td>
                  <td className="px-6 py-4 text-sm">
                    <button onClick={() => fetchDetail(doc.id)} className="text-blue-600 hover:underline">
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {documents.length === 0 && <div className="text-center py-12 text-gray-400">暂无历史记录</div>}
        </div>

        {selectedDoc && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDoc(null)}
          >
            <div
              className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">文档详情</h2>
                  <button onClick={() => setSelectedDoc(null)} className="text-gray-600 hover:text-gray-800">
                    关闭
                  </button>
                </div>
                <div className="border p-8 rounded bg-gray-50" style={{ lineHeight: '1.8' }}>
                  <div className="text-center font-bold text-xl mb-6">{selectedDoc.title}</div>
                  <div className="mb-4">{selectedDoc.recipient}：</div>
                  <div className="whitespace-pre-wrap mb-6" style={{ textIndent: '2em' }}>
                    {selectedDoc.generated_content}
                  </div>
                  <div className="text-right mb-2">{selectedDoc.issuer}</div>
                  <div className="text-right">{selectedDoc.doc_date}</div>
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p>AI 提供商：{selectedDoc.ai_provider}</p>
                  <p>创建时间：{new Date(selectedDoc.created_at).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
