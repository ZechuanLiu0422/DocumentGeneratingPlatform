'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Profile = {
  email: string;
  displayName: string;
};

type Phrase = {
  id: string;
  type: 'recipient' | 'issuer';
  phrase: string;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type ProviderInfo = {
  id: string;
  label: string;
};

type PhraseDraft = {
  type: 'recipient' | 'issuer';
  phrase: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>({ email: '', displayName: '' });
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [message, setMessage] = useState('');
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [newPhrase, setNewPhrase] = useState<PhraseDraft>({ type: 'recipient', phrase: '' });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState({ name: '', phone: '' });

  useEffect(() => {
    Promise.all([fetchSettings(), fetchPhrases(), fetchContacts()]).finally(() => setLoading(false));
  }, []);

  const fetchSettings = async () => {
    const response = await fetch('/api/settings');
    const data = await response.json();
    if (response.ok) {
      setProfile({
        email: data.profile?.email || '',
        displayName: data.profile?.displayName || '',
      });
      setProviders(data.supportedProviders || []);
    }
  };

  const fetchPhrases = async () => {
    const response = await fetch('/api/common-phrases');
    const data = await response.json();
    if (response.ok) {
      setPhrases(data.phrases || []);
    }
  };

  const fetchContacts = async () => {
    const response = await fetch('/api/contacts');
    const data = await response.json();
    if (response.ok) {
      setContacts(data.contacts || []);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setMessage('');

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: profile.displayName }),
      });
      const data = await response.json();
      setMessage(response.ok ? '资料保存成功' : data.error || '资料保存失败');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddPhrase = async () => {
    if (!newPhrase.phrase.trim()) return;
    const response = await fetch('/api/common-phrases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPhrase),
    });
    if (response.ok) {
      setNewPhrase({ type: 'recipient', phrase: '' });
      fetchPhrases();
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newContact),
    });
    if (response.ok) {
      setNewContact({ name: '', phone: '' });
      fetchContacts();
    }
  };

  const handleDeletePhrase = async (id: string) => {
    const response = await fetch(`/api/common-phrases?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      fetchPhrases();
    }
  };

  const handleDeleteContact = async (id: string) => {
    const response = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    if (response.ok) {
      fetchContacts();
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">设置</h1>
          <div className="flex gap-4">
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              退出登录
            </button>
            <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
              返回首页
            </button>
          </div>
        </div>

        {message && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">{message}</div>}

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-4">个人资料</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">登录邮箱</label>
                <input value={profile.email} disabled className="w-full px-3 py-2 border rounded-md bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">显示名称</label>
                <div className="flex gap-2">
                  <input
                    value={profile.displayName}
                    onChange={(event) => setProfile((prev) => ({ ...prev, displayName: event.target.value }))}
                    className="flex-1 px-3 py-2 border rounded-md"
                    placeholder="例如：办公室管理员"
                  />
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    保存
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">账号安全</label>
                <div className="flex items-center justify-between rounded-md border px-3 py-3">
                  <div className="text-sm text-gray-600">如需更新登录密码，可前往专用页面修改。</div>
                  <button
                    onClick={() => router.push('/change-password')}
                    className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-black"
                  >
                    修改密码
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-bold mb-4">平台已启用的 AI 提供商</h2>
            <div className="flex flex-wrap gap-2">
              {providers.length === 0 ? (
                <div className="text-sm text-gray-500">当前还没有配置任何平台 AI 提供商</div>
              ) : (
                providers.map((provider) => (
                  <span key={provider.id} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {provider.label}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-4 mt-6">
          <h2 className="text-lg font-bold">常用信息管理</h2>

          <div className="flex gap-2">
            <select
              value={newPhrase.type}
              onChange={(event) => setNewPhrase({ ...newPhrase, type: event.target.value as 'recipient' | 'issuer' })}
              className="px-3 py-2 border rounded-md"
            >
              <option value="recipient">主送机关</option>
              <option value="issuer">发文机关</option>
            </select>
            <input
              type="text"
              value={newPhrase.phrase}
              onChange={(event) => setNewPhrase({ ...newPhrase, phrase: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && handleAddPhrase()}
              className="flex-1 px-3 py-2 border rounded-md"
              placeholder="输入常用信息"
            />
            <button onClick={handleAddPhrase} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              添加
            </button>
          </div>

          <div className="space-y-2">
            {['recipient', 'issuer'].map((type) => (
              <div key={type}>
                <h3 className="text-sm font-medium mb-2">{type === 'recipient' ? '主送机关' : '发文机关'}</h3>
                <div className="flex flex-wrap gap-2">
                  {phrases
                    .filter((phrase) => phrase.type === type)
                    .map((phrase) => (
                      <div key={phrase.id} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                        <span>{phrase.phrase}</span>
                        <button onClick={() => handleDeletePhrase(phrase.id)} className="text-red-600 hover:text-red-800">
                          ×
                        </button>
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
                onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}
                className="px-3 py-2 border rounded-md"
                placeholder="姓名"
              />
              <input
                type="text"
                value={newContact.phone}
                onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}
                onKeyDown={(event) => event.key === 'Enter' && handleAddContact()}
                className="flex-1 px-3 py-2 border rounded-md"
                placeholder="电话"
              />
              <button onClick={handleAddContact} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                添加
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm">
                  <span>
                    {contact.name} ({contact.phone})
                  </span>
                  <button onClick={() => handleDeleteContact(contact.id)} className="text-red-600 hover:text-red-800">
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="font-medium mb-2">说明</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 平台统一保管 AI 密钥，前端不再展示或保存任何密钥</li>
            <li>• 至少启用一个平台 AI 提供商后，才能正常使用生成与润色功能</li>
            <li>• 当前版本面向受控用户开通，不提供公开注册入口</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
