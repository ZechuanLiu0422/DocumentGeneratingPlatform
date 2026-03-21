'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
  id: 'claude' | 'openai' | 'doubao' | 'glm';
  label: string;
};

type Draft = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report';
  title: string | null;
  recipient: string | null;
  content: string | null;
  issuer: string | null;
  date: string | null;
  provider: ProviderInfo['id'];
  contactName: string | null;
  contactPhone: string | null;
  attachments: string[];
};

type ReferenceAnalysis = {
  tone: string;
  structure: string;
  vocabulary: string;
  sentenceStyle: string;
  logicFlow: string;
};

const docTypes = [
  { id: 'notice', name: '通知', desc: '用于发布重要事项、安排工作等' },
  { id: 'letter', name: '函', desc: '用于不相隶属机关之间商洽工作' },
  { id: 'request', name: '请示', desc: '用于向上级机关请求指示、批准' },
  { id: 'report', name: '报告', desc: '用于向上级机关汇报工作、反映情况' },
] as const;

function GeneratePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editableRef = useRef<HTMLDivElement>(null);

  const [bootstrapping, setBootstrapping] = useState(true);
  const [pageError, setPageError] = useState('');
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [docType, setDocType] = useState('');
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    recipient: '',
    content: '',
    issuer: '',
    date: new Date().toISOString().split('T')[0],
    contactName: '',
    contactPhone: '',
  });
  const [provider, setProvider] = useState<ProviderInfo['id']>('claude');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceAnalysis, setReferenceAnalysis] = useState<ReferenceAnalysis | null>(null);
  const [imitationStrength, setImitationStrength] = useState<'strict' | 'moderate' | 'loose'>('moderate');
  const [analyzingReference, setAnalyzingReference] = useState(false);
  const [contentHistory, setContentHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [latestVersion, setLatestVersion] = useState('');
  const [savingPhraseType, setSavingPhraseType] = useState<Phrase['type'] | null>(null);

  const fetchPhrases = async () => {
    const response = await fetch('/api/common-phrases');
    const data = await response.json();

    if (response.ok) {
      setPhrases(data.phrases || []);
    }
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      setBootstrapping(true);
      setPageError('');

      try {
        const [settingsRes, phrasesRes, contactsRes, draftsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/common-phrases'),
          fetch('/api/contacts'),
          fetch('/api/drafts'),
        ]);

        const [settingsData, phrasesData, contactsData, draftsData] = await Promise.all([
          settingsRes.json(),
          phrasesRes.json(),
          contactsRes.json(),
          draftsRes.json(),
        ]);

        if (!mounted) {
          return;
        }

        if (!settingsRes.ok) {
          setPageError(settingsData.error || '初始化失败');
          return;
        }

        const supportedProviders = settingsData.supportedProviders || [];
        setProviders(supportedProviders);
        setPhrases(phrasesData.phrases || []);
        setContacts(contactsData.contacts || []);

        const savedProvider = localStorage.getItem('lastUsedProvider');
        const resolvedProvider =
          supportedProviders.find((item: ProviderInfo) => item.id === savedProvider)?.id ||
          supportedProviders[0]?.id ||
          'claude';

        setProvider(resolvedProvider);

        const draftId = searchParams.get('draft');
        if (draftId) {
          const draft = (draftsData.drafts || []).find((item: Draft) => item.id === draftId);
          if (draft) {
            setCurrentDraftId(draft.id);
            setDocType(draft.doc_type);
            setFormData({
              title: draft.title || '',
              recipient: draft.recipient || '',
              content: draft.content || '',
              issuer: draft.issuer || '',
              date: draft.date || new Date().toISOString().split('T')[0],
              contactName: draft.contactName || '',
              contactPhone: draft.contactPhone || '',
            });
            setProvider(draft.provider || resolvedProvider);
            setAttachments(draft.attachments || []);
          }
        }
      } catch {
        if (mounted) {
          setPageError('初始化失败，请刷新后重试');
        }
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const handleSaveDraft = async () => {
    if (!docType) {
      alert('请先选择文档类型');
      return;
    }

    const response = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentDraftId,
        docType,
        ...formData,
        provider,
        attachments,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.draftId) {
        setCurrentDraftId(data.draftId);
      }
      alert('草稿已保存');
    } else {
      alert(data.error || '草稿保存失败');
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachment.trim()) {
      return;
    }
    setAttachments((prev) => [...prev, newAttachment.trim()]);
    setNewAttachment('');
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, current) => current !== index));
  };

  const handleSaveContact = async () => {
    if (!formData.contactName || !formData.contactPhone) {
      alert('请填写联系人和电话');
      return;
    }

    const response = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formData.contactName,
        phone: formData.contactPhone,
      }),
    });

    if (response.ok) {
      const contactsRes = await fetch('/api/contacts');
      const contactsData = await contactsRes.json();
      setContacts(contactsData.contacts || []);
      alert('联系人已保存');
    }
  };

  const handleSavePhrase = async (type: Phrase['type']) => {
    const value = (type === 'recipient' ? formData.recipient : formData.issuer).trim();

    if (!value) {
      alert(type === 'recipient' ? '请先填写主送机关' : '请先填写发文机关');
      return;
    }

    const alreadyExists = phrases.some((phrase) => phrase.type === type && phrase.phrase === value);
    if (alreadyExists) {
      alert('这条常用信息已存在');
      return;
    }

    setSavingPhraseType(type);

    try {
      const response = await fetch('/api/common-phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          phrase: value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '保存失败');
      }

      await fetchPhrases();
      alert(type === 'recipient' ? '主送机关已保存到常用信息' : '发文机关已保存到常用信息');
    } catch (error: any) {
      alert(error.message || '保存失败');
    } finally {
      setSavingPhraseType(null);
    }
  };

  const handleSelectContact = (name: string) => {
    const contact = contacts.find((item) => item.name === name);
    if (contact) {
      setFormData((prev) => ({
        ...prev,
        contactName: contact.name,
        contactPhone: contact.phone,
      }));
    }
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!docType) {
      alert('请先选择文档类型');
      return;
    }

    setReferenceFile(file);
    setAnalyzingReference(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('docType', docType);

      const uploadRes = await fetch('/api/upload-reference', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        throw new Error(uploadData.error || '文件上传失败');
      }

      const analyzeRes = await fetch('/api/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          fileContent: uploadData.content,
          provider,
        }),
      });
      const analyzeData = await analyzeRes.json();

      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error || '风格分析失败');
      }

      setReferenceAnalysis(analyzeData.analysis);
    } catch (error: any) {
      setReferenceFile(null);
      setReferenceAnalysis(null);
      alert(error.message || '处理失败，请重试');
    } finally {
      setAnalyzingReference(false);
    }
  };

  const handleRemoveReference = () => {
    setReferenceFile(null);
    setReferenceAnalysis(null);
  };

  const handlePolish = async () => {
    if (!formData.recipient || !formData.content) {
      alert('请填写主送机关和主要内容');
      return;
    }

    if (!providers.length) {
      alert('当前还没有启用任何平台 AI 提供商');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          title: formData.title,
          recipient: formData.recipient,
          content: formData.content,
          provider,
          attachments,
          referenceAnalysis,
          imitationStrength,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      if (data.generated_content) {
        setGeneratedContent(data.generated_content);
      }

      if (data.generated_title) {
        setFormData((prev) => ({
          ...prev,
          title: data.generated_title,
        }));
      }
    } catch (error: any) {
      alert(error.message || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelect = () => {
    const text = window.getSelection()?.toString().trim();
    if (text) {
      setSelectedText(text);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const feedback = selectedText ? `针对这部分内容："${selectedText}"，${userInput}` : userInput;
    setChatMessages((prev) => [...prev, { role: 'user', content: userInput }]);
    setUserInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          recipient: formData.recipient,
          originalContent: generatedContent,
          userFeedback: feedback,
          provider,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.refined_content) {
        throw new Error(data.error || '修改失败');
      }

      setContentHistory((prev) => {
        const nextHistory = historyIndex === -1 ? [generatedContent, ...prev] : [generatedContent, ...prev.slice(historyIndex)];
        return nextHistory.slice(0, 10);
      });
      setHistoryIndex(-1);
      setGeneratedContent(data.refined_content);
      setChatMessages((prev) => [...prev, { role: 'assistant', content: '已根据您的意见修改完成' }]);
    } catch (error: any) {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: error.message || '修改失败，请重试' }]);
    } finally {
      setLoading(false);
      setSelectedText('');
    }
  };

  const handleUndo = () => {
    if (contentHistory.length === 0) return;
    if (historyIndex === -1) {
      setLatestVersion(generatedContent);
    }
    const nextIndex = historyIndex + 1;
    if (nextIndex >= contentHistory.length) return;
    setGeneratedContent(contentHistory[nextIndex]);
    setHistoryIndex(nextIndex);
    setChatMessages((prev) => [...prev, { role: 'assistant', content: '已撤销到上一个版本' }]);
  };

  const handleRedo = () => {
    if (historyIndex < 0) return;
    const nextIndex = historyIndex - 1;
    setGeneratedContent(nextIndex === -1 ? latestVersion : contentHistory[nextIndex]);
    setHistoryIndex(nextIndex);
    setChatMessages((prev) => [...prev, { role: 'assistant', content: '已恢复到下一个版本' }]);
  };

  const handleDownload = async () => {
    if (!generatedContent) {
      alert('请先生成公文内容');
      return;
    }

    let contentToUse = generatedContent;
    if (isEditing && editableRef.current) {
      const paragraphs = Array.from(editableRef.current.querySelectorAll('p'));
      contentToUse = paragraphs.map((paragraph) => paragraph.textContent || '').join('\n');
      setGeneratedContent(contentToUse);
    }

    setLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          ...formData,
          generatedContent: contentToUse,
          provider,
          attachments,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.file_data) {
        throw new Error(data.error || '导出失败');
      }

      const byteCharacters = atob(data.file_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = data.file_name || 'document.docx';
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error: any) {
      alert(error.message || '导出失败');
    } finally {
      setLoading(false);
    }
  };

  if (bootstrapping) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">生成公文</h1>
          <div className="flex gap-4">
            <button onClick={handleSaveDraft} className="text-blue-600 hover:underline">
              保存草稿
            </button>
            <button onClick={() => router.push('/settings')} className="text-blue-600 hover:underline">
              设置
            </button>
            <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">
              返回首页
            </button>
            <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
              退出登录
            </button>
          </div>
        </div>

        {pageError && <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700">{pageError}</div>}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-lg shadow flex-1">
              <div className="p-6 max-h-[calc(100vh-20rem)] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">文档信息</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">文档类型</label>
                    <select value={docType} onChange={(event) => setDocType(event.target.value)} className="w-full px-3 py-2 border rounded-md">
                      <option value="">请选择文档类型</option>
                      {docTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">标题（可选）</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="留空则由 AI 自动生成标题"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">主送机关</label>
                    <input
                      type="text"
                      value={formData.recipient}
                      onChange={(event) => setFormData((prev) => ({ ...prev, recipient: event.target.value }))}
                      list="recipient-list"
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="例如：各部门、各单位"
                    />
                    <button
                      onClick={() => handleSavePhrase('recipient')}
                      disabled={savingPhraseType === 'recipient'}
                      className="mt-2 text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      保存到常用信息
                    </button>
                    <datalist id="recipient-list">
                      {phrases
                        .filter((phrase) => phrase.type === 'recipient')
                        .map((phrase) => (
                          <option key={phrase.id} value={phrase.phrase} />
                        ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">主要内容</label>
                    <textarea
                      value={formData.content}
                      onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                      className="w-full px-3 py-2 border rounded-md"
                      rows={10}
                      placeholder="请用自然语言描述完整内容，AI 会自动转换为规范格式"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">发文机关</label>
                    <input
                      type="text"
                      value={formData.issuer}
                      onChange={(event) => setFormData((prev) => ({ ...prev, issuer: event.target.value }))}
                      list="issuer-list"
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="例如：XX单位办公室"
                    />
                    <button
                      onClick={() => handleSavePhrase('issuer')}
                      disabled={savingPhraseType === 'issuer'}
                      className="mt-2 text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      保存到常用信息
                    </button>
                    <datalist id="issuer-list">
                      {phrases
                        .filter((phrase) => phrase.type === 'issuer')
                        .map((phrase) => (
                          <option key={phrase.id} value={phrase.phrase} />
                        ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">成文日期</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">联系人</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(event) => {
                        const name = event.target.value;
                        setFormData((prev) => ({ ...prev, contactName: name }));
                        handleSelectContact(name);
                      }}
                      list="contact-list"
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="例如：张三"
                    />
                    <datalist id="contact-list">
                      {contacts.map((contact) => (
                        <option key={contact.id} value={contact.name} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">联系电话</label>
                    <input
                      type="text"
                      value={formData.contactPhone}
                      onChange={(event) => setFormData((prev) => ({ ...prev, contactPhone: event.target.value }))}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="例如：010-12345678"
                    />
                    <button onClick={handleSaveContact} className="mt-2 text-sm text-blue-600 hover:underline">
                      保存为常用联系人
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">附件（可选）</label>
                    <div className="text-xs text-gray-500 mb-2">添加附件名称，正文中会自动引用</div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newAttachment}
                        onChange={(event) => setNewAttachment(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && handleAddAttachment()}
                        className="flex-1 px-3 py-2 border rounded-md"
                        placeholder="输入附件名称"
                      />
                      <button onClick={handleAddAttachment} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        添加
                      </button>
                    </div>
                    {attachments.length > 0 && (
                      <div className="space-y-1">
                        {attachments.map((attachment, index) => (
                          <div key={attachment + index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                            <span className="text-sm">
                              {index + 1}. {attachment}
                            </span>
                            <button onClick={() => handleRemoveAttachment(index)} className="text-red-600 hover:text-red-800 text-sm">
                              删除
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <h2 className="text-lg font-bold mb-4">AI 生成设置</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">AI 提供商</label>
                    <select
                      value={provider}
                      onChange={(event) => {
                        const nextProvider = event.target.value as ProviderInfo['id'];
                        setProvider(nextProvider);
                        localStorage.setItem('lastUsedProvider', nextProvider);
                      }}
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!providers.length}
                    >
                      {providers.length === 0 ? (
                        <option value="">当前未启用任何平台 AI</option>
                      ) : (
                        providers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">仿写模式（可选）</label>
                    <div className="text-xs text-gray-500 mb-2">上传参考公文，AI 将学习其写作风格</div>
                    {!referenceFile ? (
                      <input
                        type="file"
                        accept=".docx,.pdf,.txt"
                        onChange={handleReferenceUpload}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      />
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span className="text-sm">{referenceFile.name}</span>
                          <button onClick={handleRemoveReference} className="text-red-600 text-sm">
                            删除
                          </button>
                        </div>
                        {analyzingReference && <p className="text-sm text-blue-600">分析中...</p>}
                        {referenceAnalysis && (
                          <div className="bg-blue-50 p-3 rounded text-sm space-y-1">
                            <p>
                              <strong>语气：</strong>
                              {referenceAnalysis.tone}
                            </p>
                            <p>
                              <strong>结构：</strong>
                              {referenceAnalysis.structure}
                            </p>
                            <p>
                              <strong>用词：</strong>
                              {referenceAnalysis.vocabulary}
                            </p>
                          </div>
                        )}
                        {referenceAnalysis && (
                          <div>
                            <label className="block text-sm font-medium mb-2">仿写强度</label>
                            <div className="flex gap-2">
                              {[
                                { value: 'strict', label: '严格' },
                                { value: 'moderate', label: '适中' },
                                { value: 'loose', label: '宽松' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => setImitationStrength(option.value as 'strict' | 'moderate' | 'loose')}
                                  className={`flex-1 py-2 rounded-md text-sm ${
                                    imitationStrength === option.value ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handlePolish}
                    disabled={loading || !providers.length}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors"
                  >
                    {loading ? '生成中...' : '生成文档'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 h-full">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold">预览</h2>
                  {generatedContent && (
                    <button
                      onClick={() => {
                        if (isEditing && editableRef.current) {
                          const paragraphs = Array.from(editableRef.current.querySelectorAll('p'));
                          setGeneratedContent(paragraphs.map((paragraph) => paragraph.textContent || '').join('\n'));
                        }
                        setIsEditing((prev) => !prev);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      {isEditing ? '预览' : '编辑'}
                    </button>
                  )}
                </div>
                <div className="h-[600px] overflow-y-auto border rounded">
                  {generatedContent ? (
                    isEditing ? (
                      <div
                        ref={editableRef}
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{
                          __html: generatedContent
                            .split('\n')
                            .filter((line) => line.trim())
                            .map((line) => `<p class="indent-8" style="text-indent: 2em;">${line}</p>`)
                            .join(''),
                        }}
                        className="text-sm p-8 bg-white outline-none"
                        style={{ lineHeight: '1.75' }}
                      />
                    ) : (
                      <div className="text-sm p-8 select-text bg-white" onMouseUp={handleTextSelect} style={{ lineHeight: '1.75' }}>
                        <div className="text-center font-bold text-xl mb-4">{formData.title || '未命名文档'}</div>
                        <div className="h-7" />
                        <div className="leading-7">{formData.recipient}：</div>
                        <div className="leading-7">
                          {generatedContent
                            .split('\n')
                            .filter((line) => line.trim())
                            .map((line, index) => (
                              <p key={index} className="indent-8">
                                {line}
                              </p>
                            ))}
                        </div>
                        {attachments.length > 0 && (
                          <>
                            <div className="h-7" />
                            <div className="leading-7">
                              <span className="inline-block indent-8">附件：</span>
                              <span className="inline">1. {attachments[0]}</span>
                            </div>
                            {attachments.slice(1).map((attachment, index) => (
                              <div key={attachment + index} className="leading-7 pl-20">
                                {index + 2}. {attachment}
                              </div>
                            ))}
                            <div className="h-7" />
                            <div className="h-7" />
                          </>
                        )}
                        <div className="text-right leading-7 pr-8">{formData.issuer}</div>
                        <div className="text-right leading-7 pr-8">{formData.date}</div>
                        {formData.contactName && formData.contactPhone && (
                          <>
                            <div className="h-7" />
                            <div className="text-center leading-7">
                              （联系人：{formData.contactName}，电话：{formData.contactPhone}）
                            </div>
                          </>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">点击“生成文档”后，内容将显示在这里</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {generatedContent && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4">AI 修改</h2>
                {selectedText && (
                  <div className="text-xs text-blue-600 mb-2 p-2 bg-blue-50 rounded">
                    已选择：{selectedText.substring(0, 50)}
                    {selectedText.length > 50 ? '...' : ''}
                  </div>
                )}
                <div className="space-y-3">
                  <div className="max-h-32 overflow-y-auto space-y-2 mb-2">
                    {chatMessages.map((message, index) => (
                      <div key={index} className={`text-xs p-2 rounded ${message.role === 'user' ? 'bg-blue-50 text-right' : 'bg-gray-50'}`}>
                        {message.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={handleUndo}
                      disabled={contentHistory.length === 0 || historyIndex >= contentHistory.length - 1}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded"
                    >
                      撤销 {contentHistory.length > 0 ? `(${contentHistory.length})` : ''}
                    </button>
                    <button
                      onClick={handleRedo}
                      disabled={historyIndex < 0}
                      className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 rounded"
                    >
                      恢复
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(event) => setUserInput(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleSendMessage()}
                      placeholder={selectedText ? '对选中内容提出修改意见...' : '提出修改意见...'}
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                      disabled={loading}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={loading || !userInput.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                    >
                      发送
                    </button>
                  </div>
                  <button
                    onClick={handleDownload}
                    disabled={loading}
                    className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {loading ? '导出中...' : '下载 Word 文档'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">加载中...</div>}>
      <GeneratePageContent />
    </Suspense>
  );
}
