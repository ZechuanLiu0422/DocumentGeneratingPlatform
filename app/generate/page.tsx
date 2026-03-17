'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function GeneratePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docType, setDocType] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    recipient: '',
    content: '',
    issuer: '',
    date: new Date().toISOString().split('T')[0],
    contactName: '',
    contactPhone: ''
  });
  const [provider, setProvider] = useState('claude');
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [userInput, setUserInput] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [phrases, setPhrases] = useState<any[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const editableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchPhrases();
      const savedProvider = localStorage.getItem('lastUsedProvider');
      if (savedProvider) {
        setProvider(savedProvider);
      }
      const draftId = searchParams.get('draft');
      if (draftId) {
        loadDraft(parseInt(draftId));
      }
    }
  }, [status, router, searchParams]);

  const fetchPhrases = async () => {
    const res = await fetch('/api/common-phrases');
    const data = await res.json();
    if (data.phrases) {
      setPhrases(data.phrases);
    }
  };

  const loadDraft = async (id: number) => {
    const res = await fetch(`/api/drafts`);
    const data = await res.json();
    const draft = data.drafts?.find((d: any) => d.id === id);
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
        contactPhone: draft.contactPhone || ''
      });
      setProvider(draft.provider || 'claude');
      setAttachments(draft.attachments || []);
    }
  };

  const handleSaveDraft = async () => {
    if (!docType) {
      alert('请先选择文档类型');
      return;
    }
    const res = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: currentDraftId,
        docType,
        ...formData,
        provider,
        attachments
      })
    });
    const data = await res.json();
    if (data.draftId && !currentDraftId) {
      setCurrentDraftId(data.draftId);
    }
    if (data.success) {
      alert('草稿已保存');
    }
  };

  const handleAddAttachment = () => {
    if (newAttachment.trim()) {
      setAttachments([...attachments, newAttachment.trim()]);
      setNewAttachment('');
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const docTypes = [
    { id: 'notice', name: '通知', desc: '用于发布重要事项、安排工作等' },
    { id: 'letter', name: '函', desc: '用于不相隶属机关之间商洽工作' },
    { id: 'request', name: '请示', desc: '用于向上级机关请求指示、批准' },
    { id: 'report', name: '报告', desc: '用于向上级机关汇报工作、反映情况' }
  ];

  const handlePolish = async () => {
    if (!formData.recipient || !formData.content) {
      alert('请填写主送机关和主要内容');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          title: formData.title,
          recipient: formData.recipient,
          content: formData.content,
          provider,
          attachments
        })
      });

      const data = await res.json();
      if (data.generated_content) {
        setGeneratedContent(data.generated_content);
        if (data.generated_title && !formData.title) {
          setFormData({...formData, title: data.generated_title});
        }
      } else {
        alert(data.error || '生成失败');
      }
    } catch (error) {
      alert('生成失败，请检查 API 配置');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSelect = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text) {
      setSelectedText(text);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    const feedback = selectedText
      ? `针对这部分内容："${selectedText}"，${userInput}`
      : userInput;

    setChatMessages(prev => [...prev, { role: 'user', content: userInput }]);
    setUserInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          recipient: formData.recipient,
          originalContent: generatedContent,
          userFeedback: feedback,
          provider
        })
      });

      const data = await res.json();
      if (data.refined_content) {
        setGeneratedContent(data.refined_content);
        setChatMessages(prev => [...prev, { role: 'assistant', content: '已根据您的意见修改完成' }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.error || '修改失败' }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '修改失败，请重试' }]);
    } finally {
      setLoading(false);
      setSelectedText('');
    }
  };

  const handleDownload = async () => {
    if (!generatedContent) {
      alert('请先生成公文内容');
      return;
    }

    // 如果正在编辑模式，先读取内容
    let contentToUse = generatedContent;
    if (isEditing && editableRef.current) {
      const paragraphs = Array.from(editableRef.current.querySelectorAll('p'));
      contentToUse = paragraphs.map(p => p.textContent || '').join('\n');
      setGeneratedContent(contentToUse);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType,
          ...formData,
          generatedContent: contentToUse,
          provider,
          attachments
        })
      });

      const data = await res.json();
      if (data.success && data.file_data) {
        const byteCharacters = atob(data.file_data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.file_name || 'document.docx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('文档下载成功！');
      } else {
        alert(data.error || '生成失败');
      }
    } catch (error) {
      alert('生成失败');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!docType) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">选择公文类型</h1>
            <button onClick={() => router.push('/')} className="text-blue-600 hover:underline">返回首页</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {docTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setDocType(type.id)}
                className="p-6 bg-white rounded-lg shadow hover:shadow-lg transition"
              >
                <h2 className="text-xl font-bold mb-2">{type.name}</h2>
                <p className="text-gray-600">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">生成{docTypes.find(t => t.id === docType)?.name}</h1>
          <div className="flex gap-4">
            <button onClick={() => router.push('/settings')} className="text-blue-600">设置</button>
            <button onClick={() => setDocType('')} className="text-blue-600">返回</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4">输入内容</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">标题（可选）</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="留空则由 AI 自动生成标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">主送机关</label>
                <input
                  type="text"
                  value={formData.recipient}
                  onChange={(e) => setFormData({...formData, recipient: e.target.value})}
                  list="recipient-list"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="例如：各部门、各单位"
                />
                <datalist id="recipient-list">
                  {phrases.filter(p => p.type === 'recipient').map(p => (
                    <option key={p.id} value={p.phrase} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">主要内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  rows={10}
                  placeholder="请用自然语言描述完整内容，AI 会自动转换为规范格式"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">发文机关</label>
                <input
                  type="text"
                  value={formData.issuer}
                  onChange={(e) => setFormData({...formData, issuer: e.target.value})}
                  list="issuer-list"
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="例如：XX单位办公室"
                />
                <datalist id="issuer-list">
                  {phrases.filter(p => p.type === 'issuer').map(p => (
                    <option key={p.id} value={p.phrase} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">成文日期</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">联系人</label>
                <input
                  type="text"
                  value={formData.contactName}
                  onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="例如：张三"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">联系电话</label>
                <input
                  type="text"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="例如：010-12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">附件（可选）</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAttachment}
                    onChange={(e) => setNewAttachment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAttachment()}
                    className="flex-1 px-3 py-2 border rounded-md"
                    placeholder="输入附件名称"
                  />
                  <button
                    onClick={handleAddAttachment}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    添加
                  </button>
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                        <span className="text-sm">{i + 1}. {att}</span>
                        <button
                          onClick={() => handleRemoveAttachment(i)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">AI 提供商</label>
                <select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value);
                    localStorage.setItem('lastUsedProvider', e.target.value);
                  }}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="claude">Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="doubao">豆包</option>
                  <option value="glm">智谱 GLM</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePolish}
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? '生成中...' : '生成公文'}
                </button>
                <button
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  保存草稿
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 flex flex-col h-[calc(100vh-12rem)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">预览与修改</h2>
              {generatedContent && (
                <button
                  onClick={() => {
                    if (isEditing && editableRef.current) {
                      const paragraphs = Array.from(editableRef.current.querySelectorAll('p'));
                      const content = paragraphs.map(p => p.textContent || '').join('\n');
                      setGeneratedContent(content);
                    }
                    setIsEditing(!isEditing);
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {isEditing ? '预览' : '编辑'}
                </button>
              )}
            </div>
            {generatedContent ? (
              <>
                {isEditing ? (
                  <div
                    ref={editableRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{
                      __html: generatedContent.split('\n').filter(line => line.trim())
                        .map(line => `<p class="indent-8" style="text-indent: 2em;">${line}</p>`)
                        .join('')
                    }}
                    className="text-sm mb-4 border p-8 rounded flex-1 overflow-y-auto bg-white outline-none"
                    style={{ lineHeight: '1.75' }}
                  />
                ) : (
                  <div
                    className="text-sm mb-4 border p-8 rounded flex-1 overflow-y-auto select-text bg-white"
                    onMouseUp={handleTextSelect}
                    style={{ lineHeight: '1.75' }}
                  >
                    <div className="text-center font-bold text-xl mb-4">{formData.title || '未命名文档'}</div>
                    <div className="h-7"></div>
                    <div className="leading-7">{formData.recipient}：</div>
                    <div className="leading-7">
                      {generatedContent.split('\n').filter(line => line.trim()).map((line, i) => (
                        <p key={i} className="indent-8">{line}</p>
                      ))}
                    </div>
                    {attachments.length > 0 && (
                      <>
                        <div className="h-7"></div>
                        <div className="leading-7">
                          <span className="inline-block indent-8">附件：</span>
                          <span className="inline">1. {attachments[0]}</span>
                        </div>
                        {attachments.slice(1).map((att, i) => (
                          <div key={i} className="leading-7 pl-20">{i + 2}. {att}</div>
                        ))}
                        <div className="h-7"></div>
                        <div className="h-7"></div>
                      </>
                    )}
                    <div className="text-right leading-7 pr-8">{formData.issuer}</div>
                    <div className="text-right leading-7 pr-8">{formData.date}</div>
                    {formData.contactName && formData.contactPhone && (
                      <>
                        <div className="h-7"></div>
                        <div className="text-center leading-7">
                          （联系人：{formData.contactName}，电话：{formData.contactPhone}）
                        </div>
                      </>
                    )}
                  </div>
                )}
                {selectedText && (
                  <div className="text-xs text-blue-600 mb-2 p-2 bg-blue-50 rounded">
                    已选择：{selectedText.substring(0, 50)}{selectedText.length > 50 ? '...' : ''}
                  </div>
                )}
                <div className="border-t pt-4 space-y-3">
                  <div className="max-h-32 overflow-y-auto space-y-2 mb-2">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`text-xs p-2 rounded ${msg.role === 'user' ? 'bg-blue-50 text-right' : 'bg-gray-50'}`}>
                        {msg.content}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder={selectedText ? "对选中内容提出修改意见..." : "提出修改意见..."}
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
                    {loading ? '生成中...' : '下载 Word 文档'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-gray-400">点击"生成公文"后，内容将显示在这里</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
