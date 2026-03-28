'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';

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

type ProviderId = 'claude' | 'openai' | 'doubao' | 'glm';

type ProviderInfo = {
  id: ProviderId;
  label: string;
};

type DocType = 'notice' | 'letter' | 'request' | 'report';

type DocTypeOption = {
  id: DocType;
  name: string;
  desc: string;
};

type FormData = {
  title: string;
  recipient: string;
  content: string;
  issuer: string;
  date: string;
  contactName: string;
  contactPhone: string;
};

type WritingRule = {
  id: string;
  doc_type: DocType | null;
  name: string;
  rule_type:
    | 'required_phrase'
    | 'forbidden_phrase'
    | 'tone_rule'
    | 'structure_rule'
    | 'ending_rule'
    | 'organization_fact';
  content: string;
  priority: number;
  enabled: boolean;
};

type ReferenceAnalysis = {
  tone: string;
  structure: string;
  vocabulary: string;
  sentenceStyle?: string;
  logicFlow?: string;
};

type ReferenceAsset = {
  id: string;
  name: string;
  doc_type: DocType | null;
  file_name: string;
  file_type: string;
  content: string;
  analysis: ReferenceAnalysis | null;
  is_favorite: boolean;
};

type SessionReference = {
  name: string;
  docType: DocType | null;
  fileName: string;
  fileType: string;
  content: string;
  analysis: ReferenceAnalysis | null;
};

type RuleForm = {
  name: string;
  ruleType: WritingRule['rule_type'];
  docType: string;
  content: string;
};

type KnowledgeSidebarProps = {
  docTypes: readonly DocTypeOption[];
  docType: DocType | '';
  formData: FormData;
  phrases: Phrase[];
  contacts: Contact[];
  newAttachment: string;
  attachments: string[];
  savingPhraseType: Phrase['type'] | '';
  provider: ProviderId;
  providers: ProviderInfo[];
  visibleRules: WritingRule[];
  activeRuleIds: string[];
  ruleForm: RuleForm;
  referenceUploadMode: 'session' | 'library';
  sessionReferences: SessionReference[];
  visibleAssets: ReferenceAsset[];
  activeReferenceIds: string[];
  uploadingReference: boolean;
  referenceAnalysisPreview: ReferenceAnalysis | null;
  onDocTypeChange: (value: DocType | '') => void;
  onFormDataChange: (field: keyof FormData, value: string) => void;
  onSavePhrase: (type: Phrase['type']) => void;
  onSelectContact: (name: string) => void;
  onSaveContact: () => void;
  onNewAttachmentChange: (value: string) => void;
  onAddAttachment: () => void;
  onRemoveAttachment: (index: number) => void;
  onProviderChange: (provider: ProviderId) => void;
  onToggleRule: (ruleId: string, checked: boolean) => void;
  onRuleFormChange: (field: keyof RuleForm, value: string) => void;
  onCreateRule: () => void;
  onReferenceUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onReferenceUploadModeChange: (mode: 'session' | 'library') => void;
  onRemoveSessionReference: (index: number) => void;
  onToggleReference: (assetId: string, checked: boolean) => void;
};

export function KnowledgeSidebar({
  docTypes,
  docType,
  formData,
  phrases,
  contacts,
  newAttachment,
  attachments,
  savingPhraseType,
  provider,
  providers,
  visibleRules,
  activeRuleIds,
  ruleForm,
  referenceUploadMode,
  sessionReferences,
  visibleAssets,
  activeReferenceIds,
  uploadingReference,
  referenceAnalysisPreview,
  onDocTypeChange,
  onFormDataChange,
  onSavePhrase,
  onSelectContact,
  onSaveContact,
  onNewAttachmentChange,
  onAddAttachment,
  onRemoveAttachment,
  onProviderChange,
  onToggleRule,
  onRuleFormChange,
  onCreateRule,
  onReferenceUpload,
  onReferenceUploadModeChange,
  onRemoveSessionReference,
  onToggleReference,
}: KnowledgeSidebarProps) {
  const handleAttachmentKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    onAddAttachment();
  };

  return (
    <>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">基础信息</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">文种</label>
            <select
              value={docType}
              onChange={(event) => onDocTypeChange(event.target.value as DocType | '')}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">请选择文种</option>
              {docTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}：{type.desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">标题</label>
            <input
              type="text"
              value={formData.title}
              onChange={(event) => onFormDataChange('title', event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="AI 会结合提纲为你建议标题"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">主送机关</label>
            <input
              type="text"
              value={formData.recipient}
              onChange={(event) => onFormDataChange('recipient', event.target.value)}
              list="recipient-list"
              className="w-full rounded-lg border px-3 py-2"
              placeholder="例如：各部门、各单位"
            />
            <button
              onClick={() => onSavePhrase('recipient')}
              disabled={savingPhraseType === 'recipient'}
              className="mt-2 text-sm text-blue-600 hover:underline disabled:text-gray-400"
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
            <label className="mb-2 block text-sm font-medium">需求描述</label>
            <textarea
              value={formData.content}
              onChange={(event) => onFormDataChange('content', event.target.value)}
              className="min-h-[180px] w-full rounded-lg border px-3 py-2"
              placeholder="先用自然语言写下你现在掌握的背景、目标、要点和要求，AI 会继续追问缺口。"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">发文机关</label>
            <input
              type="text"
              value={formData.issuer}
              onChange={(event) => onFormDataChange('issuer', event.target.value)}
              list="issuer-list"
              className="w-full rounded-lg border px-3 py-2"
              placeholder="例如：XX单位办公室"
            />
            <button
              onClick={() => onSavePhrase('issuer')}
              disabled={savingPhraseType === 'issuer'}
              className="mt-2 text-sm text-blue-600 hover:underline disabled:text-gray-400"
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
            <label className="mb-2 block text-sm font-medium">成文日期</label>
            <input
              type="date"
              value={formData.date}
              onChange={(event) => onFormDataChange('date', event.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium">联系人</label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(event) => {
                  const name = event.target.value;
                  onFormDataChange('contactName', name);
                  onSelectContact(name);
                }}
                list="contact-list"
                className="w-full rounded-lg border px-3 py-2"
              />
              <datalist id="contact-list">
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">联系电话</label>
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(event) => onFormDataChange('contactPhone', event.target.value)}
                className="w-full rounded-lg border px-3 py-2"
              />
            </div>
          </div>
          <button onClick={onSaveContact} className="text-sm text-blue-600 hover:underline">
            保存为常用联系人
          </button>

          <div>
            <label className="mb-2 block text-sm font-medium">附件</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAttachment}
                onChange={(event) => onNewAttachmentChange(event.target.value)}
                onKeyDown={handleAttachmentKeyDown}
                className="flex-1 rounded-lg border px-3 py-2"
                placeholder="输入附件名称"
              />
              <button onClick={onAddAttachment} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
                添加
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={attachment + index} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span>
                      {index + 1}. {attachment}
                    </span>
                    <button onClick={() => onRemoveAttachment(index)} className="text-red-600 hover:underline">
                      删除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">AI 约束与参考</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">AI 提供商</label>
            <select
              value={provider}
              onChange={(event) => onProviderChange(event.target.value as ProviderId)}
              className="w-full rounded-lg border px-3 py-2"
              disabled={!providers.length}
            >
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">个人规则库</h3>
              <span className="text-xs text-gray-500">可多选</span>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto">
              {visibleRules.map((rule) => (
                <label key={rule.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activeRuleIds.includes(rule.id)}
                    onChange={(event) => onToggleRule(rule.id, event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <strong>{rule.name}</strong>
                    <span className="ml-2 text-xs text-gray-500">{rule.rule_type}</span>
                    <span className="mt-1 block text-gray-600">{rule.content}</span>
                  </span>
                </label>
              ))}
              {visibleRules.length === 0 && <div className="text-sm text-gray-400">还没有规则，下面可以立即新增。</div>}
            </div>
            <div className="mt-4 space-y-2 rounded-lg bg-blue-50 p-3">
              <input
                type="text"
                value={ruleForm.name}
                onChange={(event) => onRuleFormChange('name', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="规则名称，例如：请示结尾必须规范"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={ruleForm.ruleType}
                  onChange={(event) => onRuleFormChange('ruleType', event.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="tone_rule">语气规则</option>
                  <option value="structure_rule">结构规则</option>
                  <option value="required_phrase">必备短语</option>
                  <option value="forbidden_phrase">禁用短语</option>
                  <option value="ending_rule">结尾规则</option>
                  <option value="organization_fact">单位事实</option>
                </select>
                <select
                  value={ruleForm.docType}
                  onChange={(event) => onRuleFormChange('docType', event.target.value)}
                  className="rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">适用于所有文种</option>
                  {docTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={ruleForm.content}
                onChange={(event) => onRuleFormChange('content', event.target.value)}
                className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="例如：请示正文结尾必须使用“妥否，请批示”或同等规范表达。"
              />
              <button onClick={onCreateRule} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                添加规则
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">参考材料</h3>
              <select
                value={referenceUploadMode}
                onChange={(event) => onReferenceUploadModeChange(event.target.value as 'session' | 'library')}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="session">仅当前写作使用</option>
                <option value="library">保存到个人参考库</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-gray-500">上传后会先做风格分析，再用于提纲和正文生成。</p>
            <input
              type="file"
              accept=".docx,.pdf,.txt"
              onChange={onReferenceUpload}
              className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
              disabled={uploadingReference}
            />
            {uploadingReference && <div className="mt-2 text-sm text-blue-600">参考材料处理中...</div>}
            {referenceAnalysisPreview && (
              <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
                <div>语气：{referenceAnalysisPreview.tone}</div>
                <div>结构：{referenceAnalysisPreview.structure}</div>
                <div>用词：{referenceAnalysisPreview.vocabulary}</div>
              </div>
            )}

            {sessionReferences.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium">当前会话参考</div>
                <div className="mt-2 space-y-2">
                  {sessionReferences.map((item, index) => (
                    <div key={item.fileName + index} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span>{item.name}</span>
                      <button
                        onClick={() => onRemoveSessionReference(index)}
                        className="text-red-600 hover:underline"
                      >
                        移除
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
              {visibleAssets.map((asset) => (
                <label key={asset.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activeReferenceIds.includes(asset.id)}
                    onChange={(event) => onToggleReference(asset.id, event.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    <strong>{asset.name}</strong>
                    {asset.is_favorite && (
                      <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">收藏</span>
                    )}
                    <span className="mt-1 block text-gray-600">{asset.file_name}</span>
                  </span>
                </label>
              ))}
              {visibleAssets.length === 0 && <div className="text-sm text-gray-400">还没有保存的参考材料。</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
