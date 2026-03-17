'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [configs, setConfigs] = useState({
    claude: '',
    openai: '',
    doubao: '',
    glm: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [phrases, setPhrases] = useState<any[]>([]);
  const [newPhrase, setNewPhrase] = useState({ type: 'recipient', phrase: '' });
  const [contacts, setContacts] = useState<any[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchConfigs();
      fetchPhrases();
      fetchContacts();
    }
  }, [status, router]);

  const fetchConfigs = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.configs) {
      setConfigs({ ...configs, ...data.configs });
    }
  };

  const fetchPhrases = async () => {
    const res = await fetch('/api/common-phrases');
    const data = await res.json();
    if (data.phrases) {
      setPhrases(data.phrases);
    }
  };

  const fetchContacts = async () => {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    if (data.contacts) {
      setContacts(data.contacts);
    }
  };

  const handleAddPhrase = async () => {
    if (!newPhrase.phrase.trim()) return;
    await fetch('/api/common-phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPhrase)
    });
    setNewPhrase({ type: 'recipient', phrase: '' });
    fetchPhrases();
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContact)
    });
    setNewContact({ name: '', phone: '' });
    fetchContacts();
  };

  const handleDeletePhrase = async (id: number) => {
    await fetch(`/api/common-phrases?id=${id}`, { method: 'DELETE' });
    fetchPhrases();
  };

  const handleDeleteContact = async (id: number) => {
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    fetchContacts();
  };

  const handleSave = async (provider: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          apiKey: configs[provider as keyof typeof configs]
        })
      });

      if (res.ok) {
        setMessage(`${provider.toUpperCase()} API Key 保存成功`);
      } else {
        setMessage('保存失败');
      }
    } catch (error) {
      setMessage('保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">API 配置</h1>
          <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">返回首页</button>
        </div>

        {message && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Claude API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={configs.claude}
                onChange={(e) => setConfigs({ ...configs, claude: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="sk-ant-..."
              />
              <button
                onClick={() => handleSave('claude')}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                保存
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">OpenAI API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={configs.openai}
                onChange={(e) => setConfigs({ ...configs, openai: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="sk-..."
              />
              <button
                onClick={() => handleSave('openai')}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                保存
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">豆包 API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={configs.doubao}
                onChange={(e) => setConfigs({ ...configs, doubao: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="豆包 API Key"
              />
              <button
                onClick={() => handleSave('doubao')}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                保存
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">智谱 GLM API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={configs.glm}
                onChange={(e) => setConfigs({ ...configs, glm: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="智谱 API Key"
              />
              <button
                onClick={() => handleSave('glm')}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                保存
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4 mt-6">
          <h2 className="text-lg font-bold">常用信息管理</h2>

          <div className="flex gap-2">
            <select
              value={newPhrase.type}
              onChange={(e) => setNewPhrase({ ...newPhrase, type: e.target.value })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="recipient">主送机关</option>
              <option value="issuer">发文机关</option>
            </select>
            <input
              type="text"
              value={newPhrase.phrase}
              onChange={(e) => setNewPhrase({ ...newPhrase, phrase: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPhrase()}
              className="flex-1 px-3 py-2 border rounded-md"
              placeholder="输入常用信息"
            />
            <button
              onClick={handleAddPhrase}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              添加
            </button>
          </div>

          <div className="space-y-2">
            {['recipient', 'issuer'].map(type => (
              <div key={type}>
                <h3 className="text-sm font-medium mb-2">{type === 'recipient' ? '主送机关' : '发文机关'}</h3>
                <div className="flex flex-wrap gap-2">
                  {phrases.filter(p => p.type === type).map(p => (
                    <div key={p.id} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                      <span>{p.phrase}</span>
                      <button onClick={() => handleDeletePhrase(p.id)} className="text-red-600 hover:text-red-800">×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-2">常用联系人</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                className="px-3 py-2 border rounded-md"
                placeholder="姓名"
              />
              <input
                type="text"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                onKeyPress={(e) => e.key === 'Enter' && handleAddContact()}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="电话"
              />
              <button
                onClick={handleAddContact}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {contacts.map(c => (
                <div key={c.id} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  <span>{c.name} ({c.phone})</span>
                  <button onClick={() => handleDeleteContact(c.id)} className="text-red-600 hover:text-red-800">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="font-medium mb-2">说明</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 配置后的 API Key 仅对您的账户有效</li>
            <li>• API Key 会加密存储在数据库中</li>
            <li>• 至少配置一个 AI 提供商才能使用公文生成功能</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
