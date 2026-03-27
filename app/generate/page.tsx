'use client';

import { useEffect, useState } from 'react';
import {
  buildDraftSaveRequest,
  deriveHydratedDraftView,
  type PendingChange as PersistedPendingChange,
  type ReviewState as PersistedReviewState,
} from '@/lib/generate-workspace';

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

type WorkflowStage = 'intake' | 'planning' | 'outline' | 'draft' | 'review' | 'done';

type WorkflowQuestion = {
  id: string;
  label: string;
  question: string;
  placeholder: string;
};

type OutlineSection = {
  id: string;
  heading: string;
  purpose: string;
  keyPoints: string[];
  notes?: string;
};

type PlanningSection = {
  id: string;
  headingDraft: string;
  purpose: string;
  topicSummary: string;
  orderReason: string;
};

type PlanningOption = {
  planId: string;
  label: string;
  strategy: string;
  whyThisWorks: string;
  sections: PlanningSection[];
};

type DraftSection = {
  id: string;
  heading: string;
  body: string;
  provenance?: {
    summary?: string;
    sources: Array<{
      sourceType: 'reference_asset' | 'session_reference' | 'writing_rule';
      sourceId?: string;
      label: string;
      excerpt: string;
      reason?: string;
    }>;
  } | null;
};

type ReviewCheck = {
  code: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  fixPrompt: string;
};

type ReviewState = PersistedReviewState;
type PendingChange = PersistedPendingChange;

type VersionItem = {
  id: string;
  stage: string;
  title: string | null;
  content: string | null;
  sections: DraftSection[];
  change_summary: string | null;
  created_at: string;
};

type WritingRule = {
  id: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  name: string;
  rule_type: 'required_phrase' | 'forbidden_phrase' | 'tone_rule' | 'structure_rule' | 'ending_rule' | 'organization_fact';
  content: string;
  priority: number;
  enabled: boolean;
};

type ReferenceAnalysis = {
  tone: string;
  structure: string;
  vocabulary: string;
  sentenceStyle: string;
  logicFlow: string;
};

type ReferenceAsset = {
  id: string;
  name: string;
  doc_type: 'notice' | 'letter' | 'request' | 'report' | null;
  file_name: string;
  file_type: string;
  content: string;
  analysis: ReferenceAnalysis | null;
  is_favorite: boolean;
};

type SessionReference = {
  name: string;
  docType: 'notice' | 'letter' | 'request' | 'report' | null;
  fileName: string;
  fileType: string;
  content: string;
  analysis: ReferenceAnalysis | null;
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
  workflowStage: WorkflowStage;
  collectedFacts: Record<string, string | string[]>;
  missingFields: string[];
  planning: {
    options: PlanningOption[];
    selectedPlanId?: string;
    sections: PlanningSection[];
    planVersion?: string;
    confirmed?: boolean;
  } | null;
  outline: {
    titleOptions: string[];
    sections: OutlineSection[];
    risks: string[];
    outlineVersion?: string;
    confirmed?: boolean;
  } | null;
  sections: DraftSection[];
  activeRuleIds: string[];
  activeReferenceIds: string[];
  versionCount: number;
  generatedTitle: string;
  generatedContent: string;
  reviewState?: ReviewState | null;
  pendingChange?: PendingChange | null;
};

const MAX_PLANNING_SECTIONS = 8;
const editablePlanningFieldLabels = {
  headingDraft: '段落标题',
  topicSummary: '本段内容',
} as const;

const docTypes = [
  { id: 'notice', name: '通知', desc: '用于发布重要事项、安排工作等' },
  { id: 'letter', name: '函', desc: '用于不相隶属机关之间商洽工作' },
  { id: 'request', name: '请示', desc: '用于向上级机关请求指示、批准' },
  { id: 'report', name: '报告', desc: '用于向上级机关汇报工作、反映情况' },
] as const;

function compileSections(sections: DraftSection[]) {
  return sections
    .map((section) => `${section.heading}\n${section.body}`.trim())
    .filter(Boolean)
    .join('\n\n');
}

function formatFactValue(value: string | string[]) {
  return Array.isArray(value) ? value.join('；') : value;
}

function statusClass(status: ReviewCheck['status']) {
  if (status === 'pass') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'warning') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function mapWorkflowStageToStep(stage: WorkflowStage) {
  if (stage === 'review' || stage === 'done') return 'review';
  return stage;
}

function getPendingActionLabel(action: PendingChange['action']) {
  if (action === 'regenerate') return '段落重生成';
  if (action === 'revise') return '改写';
  return '版本恢复';
}

function getPendingTargetLabel(targetType: PendingChange['targetType']) {
  if (targetType === 'selection') return '选中文本';
  if (targetType === 'section') return '指定段落';
  return '整稿';
}

function findSectionById(sections: DraftSection[], sectionId: string) {
  return sections.find((section) => section.id === sectionId) || null;
}

function renderSectionProvenance(section: DraftSection, emptyMessage = '当前段落还没有可展示的采纳依据。') {
  if (!section.provenance?.sources?.length) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">采纳依据</div>
      {section.provenance.summary && <div className="mt-2 text-sm text-emerald-800">{section.provenance.summary}</div>}
      <div className="mt-3 space-y-2">
        {section.provenance.sources.map((source, index) => (
          <div key={`${section.id}-${source.sourceId || source.label}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
            <div className="font-medium text-gray-900">{source.label}</div>
            <div className="mt-1 text-gray-600">{source.excerpt}</div>
            {source.reason && <div className="mt-1 text-xs text-emerald-700">{source.reason}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function getIncompletePlanningSections(sections: PlanningSection[]) {
  return sections
    .map((section, index) => {
      const missing = Object.entries(editablePlanningFieldLabels)
        .filter(([field]) => !section[field as keyof PlanningSection].trim())
        .map(([, label]) => label);

      if (missing.length === 0) {
        return '';
      }

      return `第 ${index + 1} 段缺少：${missing.join('、')}`;
    })
    .filter(Boolean);
}

function StageTabs(props: {
  currentStep: WorkflowStage;
  onChange: (step: WorkflowStage) => void;
  canVisitPlanning: boolean;
  canVisitOutline: boolean;
  canVisitDraft: boolean;
  canVisitReview: boolean;
}) {
  const steps = [
    { id: 'intake', label: '1. 信息采集', enabled: true },
    { id: 'planning', label: '2. 结构共创', enabled: props.canVisitPlanning },
    { id: 'outline', label: '3. 提纲确认', enabled: props.canVisitOutline },
    { id: 'draft', label: '4. 分段成文', enabled: props.canVisitDraft },
    { id: 'review', label: '5. 定稿检查', enabled: props.canVisitReview },
  ] as const;

  return (
    <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          disabled={!step.enabled}
          onClick={() => step.enabled && props.onChange(step.id)}
          className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
            props.currentStep === step.id
              ? 'border-blue-600 bg-blue-600 text-white'
              : step.enabled
                ? 'border-gray-200 bg-white hover:border-blue-300 hover:text-blue-700'
                : 'border-gray-100 bg-gray-50 text-gray-400'
          }`}
        >
          {step.label}
        </button>
      ))}
    </div>
  );
}

function GeneratePageContent() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pageError, setPageError] = useState('');
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [rules, setRules] = useState<WritingRule[]>([]);
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [docType, setDocType] = useState<Draft['doc_type'] | ''>('');
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('intake');
  const [currentStep, setCurrentStep] = useState<WorkflowStage>('intake');
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
  const [attachments, setAttachments] = useState<string[]>([]);
  const [newAttachment, setNewAttachment] = useState('');
  const [savingPhraseType, setSavingPhraseType] = useState<Phrase['type'] | null>(null);
  const [activeRuleIds, setActiveRuleIds] = useState<string[]>([]);
  const [activeReferenceIds, setActiveReferenceIds] = useState<string[]>([]);
  const [sessionReferences, setSessionReferences] = useState<SessionReference[]>([]);
  const [referenceUploadMode, setReferenceUploadMode] = useState<'session' | 'library'>('session');
  const [referenceAnalysisPreview, setReferenceAnalysisPreview] = useState<ReferenceAnalysis | null>(null);
  const [uploadingReference, setUploadingReference] = useState(false);
  const [collectedFacts, setCollectedFacts] = useState<Record<string, string | string[]>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [nextQuestions, setNextQuestions] = useState<WorkflowQuestion[]>([]);
  const [readiness, setReadiness] = useState<'needs_more' | 'ready'>('needs_more');
  const [intakeMessage, setIntakeMessage] = useState('');
  const [planningVersion, setPlanningVersion] = useState('');
  const [planningOptions, setPlanningOptions] = useState<PlanningOption[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [planningSections, setPlanningSections] = useState<PlanningSection[]>([]);
  const [planningConfirmed, setPlanningConfirmed] = useState(false);
  const [outlineVersion, setOutlineVersion] = useState('');
  const [titleOptions, setTitleOptions] = useState<string[]>([]);
  const [outlineSections, setOutlineSections] = useState<OutlineSection[]>([]);
  const [outlineRisks, setOutlineRisks] = useState<string[]>([]);
  const [sections, setSections] = useState<DraftSection[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectionInstruction, setSelectionInstruction] = useState('');
  const [fullInstruction, setFullInstruction] = useState('');
  const [sectionInstructions, setSectionInstructions] = useState<Record<string, string>>({});
  const [reviewChecks, setReviewChecks] = useState<ReviewCheck[]>([]);
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [reviewGateMessage, setReviewGateMessage] = useState('');
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [busyAction, setBusyAction] = useState('');
  const [ruleForm, setRuleForm] = useState({
    name: '',
    ruleType: 'tone_rule' as WritingRule['rule_type'],
    content: '',
    docType: '',
  });

  const previewContent = compileSections(sections);
  const canVisitPlanning = readiness === 'ready' || planningOptions.length > 0 || ['planning', 'outline', 'draft', 'review', 'done'].includes(workflowStage);
  const canVisitOutline = outlineSections.length > 0 || ['outline', 'draft', 'review', 'done'].includes(workflowStage);
  const canVisitDraft = outlineSections.length > 0 && currentDraftId !== null;
  const canVisitReview = sections.length > 0;
  const busy = Boolean(busyAction);

  const hydrateDraft = (draft: Draft) => {
    const hydratedView = deriveHydratedDraftView(draft);

    setCurrentDraftId(hydratedView.currentDraftId);
    setDocType(hydratedView.docType);
    setProvider(hydratedView.provider);
    setWorkflowStage(hydratedView.workflowStage);
    setCurrentStep(hydratedView.currentStep);
    setFormData(hydratedView.formData);
    setAttachments(hydratedView.attachments);
    setCollectedFacts(hydratedView.collectedFacts);
    setMissingFields(hydratedView.missingFields);
    setReadiness(hydratedView.readiness);
    setActiveRuleIds(hydratedView.activeRuleIds);
    setActiveReferenceIds(hydratedView.activeReferenceIds);
    setPlanningVersion(hydratedView.planningVersion);
    setPlanningOptions(hydratedView.planningOptions);
    setSelectedPlanId(hydratedView.selectedPlanId);
    setPlanningSections(hydratedView.planningSections);
    setPlanningConfirmed(hydratedView.planningConfirmed);
    setOutlineVersion(hydratedView.outlineVersion);
    setTitleOptions(hydratedView.titleOptions);
    setOutlineSections(hydratedView.outlineSections);
    setOutlineRisks(hydratedView.outlineRisks);
    setSections(hydratedView.sections);
    setReviewState(hydratedView.reviewState);
    setPendingChange(hydratedView.pendingChange);
  };

  const fetchVersions = async (draftId: string) => {
    const response = await fetch(`/api/ai/versions?draftId=${draftId}`);
    const data = await response.json();
    if (response.ok) {
      setVersions(data.versions || []);
    }
  };

  const fetchRules = async () => {
    const response = await fetch('/api/writing-rules');
    const data = await response.json();
    if (response.ok) {
      setRules(data.rules || []);
    }
  };

  const fetchReferenceAssets = async () => {
    const response = await fetch('/api/reference-assets');
    const data = await response.json();
    if (response.ok) {
      setReferenceAssets(data.assets || []);
    }
  };

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
        const [settingsRes, phrasesRes, contactsRes, draftsRes, rulesRes, assetsRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/common-phrases'),
          fetch('/api/contacts'),
          fetch('/api/drafts'),
          fetch('/api/writing-rules'),
          fetch('/api/reference-assets'),
        ]);

        const [settingsData, phrasesData, contactsData, draftsData, rulesData, assetsData] = await Promise.all([
          settingsRes.json(),
          phrasesRes.json(),
          contactsRes.json(),
          draftsRes.json(),
          rulesRes.json(),
          assetsRes.json(),
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
        setRules(rulesData.rules || []);
        setReferenceAssets(assetsData.assets || []);

        const savedProvider = localStorage.getItem('lastUsedProvider');
        const resolvedProvider =
          supportedProviders.find((item: ProviderInfo) => item.id === savedProvider)?.id ||
          supportedProviders[0]?.id ||
          'claude';

        setProvider(resolvedProvider);

        const draftId = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('draft') : null;
        if (draftId) {
          const draft = (draftsData.drafts || []).find((item: Draft) => item.id === draftId);
          if (draft) {
            hydrateDraft(draft);
            fetchVersions(draft.id);
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
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.replace('/login');
  };

  const resetWorkflow = () => {
    setCurrentDraftId(null);
    setWorkflowStage('intake');
    setCurrentStep('intake');
    setCollectedFacts({});
    setMissingFields([]);
    setNextQuestions([]);
    setReadiness('needs_more');
    setPlanningVersion('');
    setPlanningOptions([]);
    setSelectedPlanId('');
    setPlanningSections([]);
    setPlanningConfirmed(false);
    setOutlineVersion('');
    setTitleOptions([]);
    setOutlineSections([]);
    setOutlineRisks([]);
    setSections([]);
    setSelectedText('');
    setSelectionInstruction('');
    setFullInstruction('');
    setSectionInstructions({});
    setReviewChecks([]);
    setReviewState(null);
    setPendingChange(null);
    setReviewGateMessage('');
    setVersions([]);
    setSessionReferences([]);
    setActiveReferenceIds([]);
  };

  const handleDocTypeChange = (value: Draft['doc_type'] | '') => {
    setDocType(value);
    resetWorkflow();
  };

  const updateOutlineKeyPoints = (sectionIndex: number, updater: (current: string[]) => string[]) => {
    setOutlineSections((prev) =>
      prev.map((item, current) =>
        current === sectionIndex
          ? {
              ...item,
              keyPoints: updater(item.keyPoints || []),
            }
          : item
      )
    );
  };

  const selectPlanningOption = (option: PlanningOption) => {
    setSelectedPlanId(option.planId);
    setPlanningSections(option.sections);
    setPlanningConfirmed(false);
  };

  const updatePlanningSections = (updater: (current: PlanningSection[]) => PlanningSection[]) => {
    setPlanningSections((prev) => updater(prev));
    setPlanningConfirmed(false);
  };

  const handleSaveDraft = async () => {
    if (!docType) {
      alert('请先选择文档类型');
      return;
    }

    if (planningSections.length > MAX_PLANNING_SECTIONS) {
      alert(`结构共创最多支持 ${MAX_PLANNING_SECTIONS} 段，请先删减后再保存`);
      return;
    }

    const response = await fetch('/api/drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildDraftSaveRequest({
          currentDraftId,
          docType,
          formData,
          provider,
          attachments,
        })
      ),
    });

    const data = await response.json();
    if (response.ok) {
      if (data.draft) {
        hydrateDraft(data.draft);
        fetchVersions(data.draft.id);
      }
      alert('草稿已保存');
    } else {
      alert(data.error || '草稿保存失败');
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachment.trim()) return;
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

  const handleCreateRule = async () => {
    if (!ruleForm.name.trim() || !ruleForm.content.trim()) {
      alert('请填写规则名称和规则内容');
      return;
    }

    const response = await fetch('/api/writing-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ruleForm.name,
        docType: ruleForm.docType || null,
        ruleType: ruleForm.ruleType,
        content: ruleForm.content,
        priority: 60,
        enabled: true,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      alert(data.error || '规则保存失败');
      return;
    }

    await fetchRules();
    if (data.ruleId) {
      setActiveRuleIds((prev) => Array.from(new Set([...prev, data.ruleId])));
    }
    setRuleForm({
      name: '',
      ruleType: 'tone_rule',
      content: '',
      docType: docType || '',
    });
  };

  const handleReferenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!docType) {
      alert('请先选择文种');
      return;
    }

    setUploadingReference(true);
    setReferenceAnalysisPreview(null);

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
        throw new Error(uploadData.error || '参考材料上传失败');
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

      const sessionReference: SessionReference = {
        name: file.name.replace(/\.[^.]+$/, ''),
        docType: docType as Draft['doc_type'],
        fileName: file.name,
        fileType: file.name.split('.').pop()?.toLowerCase() || 'txt',
        content: uploadData.content,
        analysis: analyzeData.analysis,
      };

      setReferenceAnalysisPreview(analyzeData.analysis);
      if (referenceUploadMode === 'library') {
        const saveRes = await fetch('/api/reference-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sessionReference.name,
            docType,
            fileName: sessionReference.fileName,
            fileType: sessionReference.fileType,
            content: sessionReference.content,
            analysis: sessionReference.analysis,
            isFavorite: true,
          }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) {
          throw new Error(saveData.error || '参考材料保存失败');
        }
        await fetchReferenceAssets();
        if (saveData.assetId) {
          setActiveReferenceIds((prev) => Array.from(new Set([...prev, saveData.assetId])));
        }
      } else {
        setSessionReferences((prev) => [sessionReference, ...prev].slice(0, 3));
      }
    } catch (error: any) {
      alert(error.message || '参考材料处理失败');
    } finally {
      setUploadingReference(false);
      event.target.value = '';
    }
  };

  const handleIntake = async () => {
    if (!docType) {
      alert('请先选择文种');
      return;
    }

    setBusyAction('intake');

    try {
      const response = await fetch('/api/ai/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          docType,
          provider,
          answers: {
            title: formData.title,
            recipient: formData.recipient,
            content: formData.content,
            issuer: formData.issuer,
            date: formData.date,
            contactName: formData.contactName,
            contactPhone: formData.contactPhone,
            attachments,
          },
          message: intakeMessage,
          activeRuleIds,
          activeReferenceIds,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '信息采集失败');
      }

      setCurrentDraftId(data.draftId);
      setCollectedFacts(data.collectedFacts || {});
      setMissingFields(data.missingFields || []);
      setNextQuestions(data.nextQuestions || []);
      setReadiness(data.readiness || 'needs_more');
      setWorkflowStage(data.workflowStage || (data.readiness === 'ready' ? 'planning' : 'intake'));
      if (!formData.title && data.suggestedTitle) {
        setFormData((prev) => ({ ...prev, title: data.suggestedTitle }));
      }
      if (data.readiness === 'ready') {
        setCurrentStep('planning');
      }
      setIntakeMessage('');
      fetchVersions(data.draftId);
    } catch (error: any) {
      alert(error.message || '信息采集失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleGeneratePlanning = async () => {
    if (!currentDraftId) {
      alert('请先完成一次 AI 信息采集');
      return;
    }

    setBusyAction('planning');

    try {
      const response = await fetch('/api/ai/outline-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '结构建议生成失败');
      }

      setPlanningVersion(data.planVersion || '');
      setPlanningOptions(data.options || []);
      if (data.options?.[0]) {
        selectPlanningOption(data.options[0]);
      }
      setWorkflowStage('planning');
      setCurrentStep('planning');
    } catch (error: any) {
      alert(error.message || '结构建议生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleGenerateOutline = async (mode: 'direct' | 'fromPlan' = 'direct') => {
    if (!currentDraftId) {
      alert('请先完成一次 AI 信息采集');
      return;
    }

    if (mode === 'fromPlan' && planningSections.length === 0) {
      alert('请先确认结构方案');
      return;
    }

    if (mode === 'fromPlan') {
      if (planningSections.length > MAX_PLANNING_SECTIONS) {
        alert(`结构共创最多支持 ${MAX_PLANNING_SECTIONS} 段，请先删减后再生成正式提纲`);
        return;
      }

      const incompleteSections = getIncompletePlanningSections(planningSections);
      if (incompleteSections.length > 0) {
        alert(`请先补全结构共创中的段落信息：\n${incompleteSections.join('\n')}`);
        return;
      }
    }

    setBusyAction('outline');

    try {
      const response = await fetch('/api/ai/outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          confirmedPlan:
            mode === 'fromPlan'
              ? {
                  selectedPlanId,
                  sections: planningSections,
                }
              : null,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '提纲生成失败');
      }

      setOutlineVersion(data.outlineVersion || '');
      setTitleOptions(data.titleOptions || []);
      setOutlineSections(data.outlineSections || []);
      setOutlineRisks(data.risks || []);
      if (!formData.title && data.titleOptions?.[0]) {
        setFormData((prev) => ({ ...prev, title: data.titleOptions[0] }));
      }
      setWorkflowStage('outline');
      setCurrentStep('outline');
      if (mode === 'fromPlan') {
        setPlanningConfirmed(true);
      }
    } catch (error: any) {
      alert(error.message || '提纲生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleConfirmOutline = async () => {
    if (!currentDraftId || outlineSections.length === 0) {
      alert('请先生成提纲');
      return;
    }

    const response = await fetch('/api/ai/outline/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: currentDraftId,
        outlineVersion,
        acceptedOutline: {
          title: formData.title,
          titleOptions,
          sections: outlineSections,
          risks: outlineRisks,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      alert(data.error || '提纲确认失败');
      return;
    }

    setWorkflowStage('draft');
    setCurrentStep('draft');
    fetchVersions(currentDraftId);
  };

  const handleGenerateDraft = async (mode: 'full' | 'section' = 'full', sectionId = '') => {
    if (!currentDraftId) {
      alert('请先完成提纲确认');
      return;
    }

    setBusyAction(mode === 'section' ? `section-${sectionId}` : 'draft');

    try {
      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          mode,
          sectionId,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '正文生成失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的候选变更，请先比较后再决定是否覆盖当前已接受正文。');
        return;
      }

      setSections(data.sections || []);
      setReviewState(null);
      setPendingChange(null);
      setReviewGateMessage('正文已更新，请重新运行定稿检查后再导出。');
      if (data.title) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      setWorkflowStage('review');
      setCurrentStep('draft');
      fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '正文生成失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRegenerateDraft = async () => {
    if (!currentDraftId) {
      alert('请先完成提纲确认');
      return;
    }

    if (sections.length > 0) {
      const confirmed = window.confirm('重新生成正文会用当前已确认提纲覆盖现有正文内容，是否继续？');
      if (!confirmed) {
        return;
      }
    }

    setReviewChecks([]);
    setReviewState(null);
    setReviewGateMessage('');
    await handleGenerateDraft('full');
  };

  const handleRevise = async (targetType: 'selection' | 'section' | 'full', targetId = '', instruction = '') => {
    if (!currentDraftId || !instruction.trim()) {
      alert('请先填写修改指令');
      return;
    }

    setBusyAction(`revise-${targetType}`);

    try {
      const response = await fetch('/api/ai/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          targetType,
          targetId,
          selectedText,
          instruction,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '改写失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的改写候选，请先比较后再决定是否接受。');
        return;
      }

      setSections(data.updatedSections || []);
      setReviewState(data.reviewState || null);
      setPendingChange(null);
      setReviewGateMessage(data.reviewState ? '' : '正文已修改，请重新运行定稿检查后再导出。');
      if (data.title) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      if (targetType === 'selection') {
        setSelectionInstruction('');
        setSelectedText('');
      } else if (targetType === 'full') {
        setFullInstruction('');
      } else if (targetId) {
        setSectionInstructions((prev) => ({ ...prev, [targetId]: '' }));
      }
      fetchVersions(currentDraftId);
      alert(data.changeSummary || '修改完成');
    } catch (error: any) {
      alert(error.message || '改写失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRunReview = async () => {
    if (!currentDraftId || sections.length === 0) {
      alert('请先生成正文');
      return;
    }

    setBusyAction('review');

    try {
      const response = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          provider,
          sessionReferences,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '定稿检查失败');
      }

      setReviewChecks(data.checks || []);
      setReviewState(data.reviewState || null);
      setReviewGateMessage('');
      setWorkflowStage('review');
      setCurrentStep('review');
      fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '定稿检查失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!currentDraftId) return;

    setBusyAction(`restore-${versionId}`);

    const response = await fetch('/api/ai/versions/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: currentDraftId,
        versionId,
      }),
    });
    const data = await response.json();
    try {
      if (!response.ok) {
        throw new Error(data.error || '版本恢复失败');
      }

      if (data.mode === 'preview' && data.candidate) {
        setPendingChange(data.candidate);
        setReviewGateMessage('存在待确认的版本恢复候选，请先比较后再决定是否恢复。');
      }
    } catch (error: any) {
      alert(error.message || '版本恢复失败');
    } finally {
      setBusyAction('');
    }
  };

  const handlePendingChangeDecision = async (decision: 'accept' | 'reject') => {
    if (!currentDraftId || !pendingChange) {
      return;
    }

    setBusyAction(`candidate-${decision}`);

    try {
      let response: Response;

      if (pendingChange.action === 'restore') {
        response = await fetch('/api/ai/versions/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            decision,
            candidateId: pendingChange.candidateId,
          }),
        });
      } else if (pendingChange.action === 'regenerate') {
        response = await fetch('/api/ai/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            provider,
            mode: 'section',
            sectionId: pendingChange.targetSectionIds[0] || '',
            decision,
            candidateId: pendingChange.candidateId,
            sessionReferences,
          }),
        });
      } else {
        response = await fetch('/api/ai/revise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftId: currentDraftId,
            provider,
            targetType: pendingChange.targetType,
            targetId: pendingChange.targetSectionIds[0] || '',
            selectedText,
            instruction: '',
            decision,
            candidateId: pendingChange.candidateId,
            sessionReferences,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '候选变更处理失败');
      }

      if (decision === 'reject') {
        setPendingChange(null);
        setReviewGateMessage('');
        return;
      }

      const nextSections = data.sections || data.updatedSections || pendingChange.after.sections;
      const nextTitle =
        typeof data.title === 'string' ? data.title : pendingChange.after.title || formData.title;
      const nextReviewState =
        data.reviewState !== undefined
          ? (data.reviewState as ReviewState | null)
          : pendingChange.action === 'restore'
            ? pendingChange.after.reviewState || null
            : null;
      const nextWorkflowStage = (data.workflowStage || (pendingChange.action === 'restore' ? 'draft' : 'review')) as WorkflowStage;

      setSections(nextSections);
      setFormData((prev) => ({ ...prev, title: nextTitle }));
      setReviewChecks([]);
      setReviewState(nextReviewState);
      setPendingChange(null);
      setWorkflowStage(nextWorkflowStage);
      setCurrentStep(mapWorkflowStageToStep(nextWorkflowStage));
      setReviewGateMessage(nextReviewState ? '' : '正文已更新，请重新运行定稿检查后再导出。');
      setSelectedText('');

      if (pendingChange.targetType === 'selection') {
        setSelectionInstruction('');
      } else if (pendingChange.targetType === 'full') {
        setFullInstruction('');
      } else if (pendingChange.targetSectionIds[0]) {
        setSectionInstructions((prev) => ({ ...prev, [pendingChange.targetSectionIds[0]]: '' }));
      }

      await fetchVersions(currentDraftId);
    } catch (error: any) {
      alert(error.message || '候选变更处理失败');
    } finally {
      setBusyAction('');
    }
  };

  const handleDownload = async () => {
    if (!docType || !previewContent) {
      alert('请先完成正文生成');
      return;
    }

    if (!formData.title || !formData.recipient || !formData.issuer || !formData.date) {
      alert('导出前请补齐标题、主送机关、发文机关和日期');
      return;
    }

    setBusyAction('download');

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          docType,
          ...formData,
          generatedContent: previewContent,
          provider,
          attachments,
          sections,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.code === 'REVIEW_REQUIRED' || data.code === 'REVIEW_STALE') {
          setReviewGateMessage(data.error || '请重新运行定稿检查后再导出');
          setCurrentStep('review');
          return;
        }

        throw new Error(data.error || '导出失败');
      }

      if (!data.file_data) {
        throw new Error('导出失败');
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
      if (currentDraftId) {
        fetchVersions(currentDraftId);
      }
    } catch (error: any) {
      alert(error.message || '导出失败');
    } finally {
      setBusyAction('');
    }
  };

  const visibleRules = rules.filter((rule) => !docType || !rule.doc_type || rule.doc_type === docType);
  const visibleAssets = referenceAssets.filter((asset) => !docType || !asset.doc_type || asset.doc_type === docType);

  if (bootstrapping) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 xl:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-bold">AI 协作式公文工作台</h1>
            <p className="mt-1 text-sm text-gray-500">先补齐事实，再确认提纲，再逐段成文，最后做定稿检查。</p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <button onClick={handleSaveDraft} className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50">
              保存草稿
            </button>
            <button onClick={() => window.location.assign('/settings')} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              设置
            </button>
            <button onClick={() => window.location.assign('/')} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              返回首页
            </button>
            <button onClick={handleLogout} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50">
              退出登录
            </button>
          </div>
        </div>

        {pageError && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px,1fr]">
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold">基础信息</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium">文种</label>
                  <select
                    value={docType}
                    onChange={(event) => handleDocTypeChange(event.target.value as Draft['doc_type'] | '')}
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
                    onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="AI 会结合提纲为你建议标题"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">主送机关</label>
                  <input
                    type="text"
                    value={formData.recipient}
                    onChange={(event) => setFormData((prev) => ({ ...prev, recipient: event.target.value }))}
                    list="recipient-list"
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="例如：各部门、各单位"
                  />
                  <button
                    onClick={() => handleSavePhrase('recipient')}
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
                    onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
                    className="min-h-[180px] w-full rounded-lg border px-3 py-2"
                    placeholder="先用自然语言写下你现在掌握的背景、目标、要点和要求，AI 会继续追问缺口。"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">发文机关</label>
                  <input
                    type="text"
                    value={formData.issuer}
                    onChange={(event) => setFormData((prev) => ({ ...prev, issuer: event.target.value }))}
                    list="issuer-list"
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="例如：XX单位办公室"
                  />
                  <button
                    onClick={() => handleSavePhrase('issuer')}
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
                    onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
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
                        setFormData((prev) => ({ ...prev, contactName: name }));
                        handleSelectContact(name);
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
                      onChange={(event) => setFormData((prev) => ({ ...prev, contactPhone: event.target.value }))}
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>
                <button onClick={handleSaveContact} className="text-sm text-blue-600 hover:underline">
                  保存为常用联系人
                </button>

                <div>
                  <label className="mb-2 block text-sm font-medium">附件</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newAttachment}
                      onChange={(event) => setNewAttachment(event.target.value)}
                      onKeyDown={(event) => event.key === 'Enter' && handleAddAttachment()}
                      className="flex-1 rounded-lg border px-3 py-2"
                      placeholder="输入附件名称"
                    />
                    <button onClick={handleAddAttachment} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
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
                          <button onClick={() => handleRemoveAttachment(index)} className="text-red-600 hover:underline">
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
                    onChange={(event) => {
                      const nextProvider = event.target.value as ProviderInfo['id'];
                      setProvider(nextProvider);
                      localStorage.setItem('lastUsedProvider', nextProvider);
                    }}
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
                          onChange={(event) =>
                            setActiveRuleIds((prev) =>
                              event.target.checked ? Array.from(new Set([...prev, rule.id])) : prev.filter((item) => item !== rule.id)
                            )
                          }
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
                      onChange={(event) => setRuleForm((prev) => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="规则名称，例如：请示结尾必须规范"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={ruleForm.ruleType}
                        onChange={(event) => setRuleForm((prev) => ({ ...prev, ruleType: event.target.value as WritingRule['rule_type'] }))}
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
                        onChange={(event) => setRuleForm((prev) => ({ ...prev, docType: event.target.value }))}
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
                      onChange={(event) => setRuleForm((prev) => ({ ...prev, content: event.target.value }))}
                      className="min-h-[90px] w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder="例如：请示正文结尾必须使用“妥否，请批示”或同等规范表达。"
                    />
                    <button onClick={handleCreateRule} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                      添加规则
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">参考材料</h3>
                    <select
                      value={referenceUploadMode}
                      onChange={(event) => setReferenceUploadMode(event.target.value as 'session' | 'library')}
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
                    onChange={handleReferenceUpload}
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
                              onClick={() => setSessionReferences((prev) => prev.filter((_, current) => current !== index))}
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
                          onChange={(event) =>
                            setActiveReferenceIds((prev) =>
                              event.target.checked ? Array.from(new Set([...prev, asset.id])) : prev.filter((item) => item !== asset.id)
                            )
                          }
                          className="mt-1"
                        />
                        <span>
                          <strong>{asset.name}</strong>
                          {asset.is_favorite && <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">收藏</span>}
                          <span className="mt-1 block text-gray-600">{asset.file_name}</span>
                        </span>
                      </label>
                    ))}
                    {visibleAssets.length === 0 && <div className="text-sm text-gray-400">还没有保存的参考材料。</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">版本历史</h2>
                {currentDraftId && <span className="text-xs text-gray-500">{versions.length} 个快照</span>}
              </div>
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto">
                {versions.map((version) => (
                  <div key={version.id} className="rounded-xl border border-gray-200 p-3 text-sm">
                    <div className="font-medium">{version.change_summary || version.stage}</div>
                    <div className="mt-1 text-xs text-gray-500">{new Date(version.created_at).toLocaleString('zh-CN')}</div>
                    <button onClick={() => handleRestoreVersion(version.id)} className="mt-3 text-blue-600 hover:underline">
                      恢复到此版本
                    </button>
                  </div>
                ))}
                {currentDraftId && versions.length === 0 && <div className="text-sm text-gray-400">关键节点快照会显示在这里。</div>}
                {!currentDraftId && <div className="text-sm text-gray-400">生成或保存草稿后会出现版本历史。</div>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <StageTabs
              currentStep={currentStep}
              onChange={setCurrentStep}
              canVisitPlanning={canVisitPlanning}
              canVisitOutline={canVisitOutline}
              canVisitDraft={canVisitDraft}
              canVisitReview={canVisitReview}
            />

            {pendingChange && (
              <section
                aria-label="候选变更对比"
                data-testid="pending-change-panel"
                className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-lg font-bold text-blue-950">待确认候选变更</div>
                    <div className="mt-2 text-sm text-blue-900">
                      {getPendingActionLabel(pendingChange.action)} / {getPendingTargetLabel(pendingChange.targetType)}
                    </div>
                    <div className="mt-2 text-sm text-blue-800">
                      {pendingChange.diffSummary || '请先核对前后差异，再决定是否接受。'}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 text-blue-800">
                        变化段落 {pendingChange.changedSectionIds.length}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-blue-800">
                        未变化段落 {pendingChange.unchangedSectionIds.length}
                      </span>
                      {pendingChange.targetSectionIds.length > 0 && (
                        <span className="rounded-full bg-white px-3 py-1 text-blue-800">
                          目标 {pendingChange.targetSectionIds.join('、')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handlePendingChangeDecision('reject')}
                      disabled={busy}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:text-gray-400"
                    >
                      拒绝候选变更
                    </button>
                    <button
                      onClick={() => handlePendingChangeDecision('accept')}
                      disabled={busy}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      接受候选变更
                    </button>
                  </div>
                </div>

                {(pendingChange.before.title || pendingChange.after.title) &&
                  pendingChange.before.title !== pendingChange.after.title && (
                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-white/80 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">当前标题</div>
                        <div className="mt-2 text-sm text-gray-800">{pendingChange.before.title || '未命名文稿'}</div>
                      </div>
                      <div className="rounded-xl border border-blue-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">候选标题</div>
                        <div className="mt-2 text-sm text-gray-900">{pendingChange.after.title || '未命名文稿'}</div>
                      </div>
                    </div>
                  )}

                <div className="mt-5 space-y-4">
                  {(pendingChange.changedSectionIds.length > 0
                    ? pendingChange.changedSectionIds
                    : ['__full__']
                  ).map((sectionId) => {
                    const beforeSection =
                      sectionId === '__full__' ? null : findSectionById(pendingChange.before.sections, sectionId);
                    const afterSection =
                      sectionId === '__full__' ? null : findSectionById(pendingChange.after.sections, sectionId);

                    return (
                      <div key={sectionId} className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-xl border border-white/80 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">当前内容</div>
                          {beforeSection && (
                            <div className="mt-2 text-sm font-medium text-gray-900">
                              {beforeSection.heading}
                            </div>
                          )}
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                            {beforeSection?.body || pendingChange.before.content || '当前内容为空'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-white p-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">候选内容</div>
                          {afterSection && (
                            <div className="mt-2 text-sm font-medium text-gray-900">
                              {afterSection.heading}
                            </div>
                          )}
                          <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-900">
                            {afterSection?.body || pendingChange.after.content || '候选内容为空'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              {currentStep === 'intake' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">信息采集</h2>
                    <p className="mt-1 text-sm text-gray-500">AI 会根据当前信息识别缺口，并用 1-3 个高价值问题继续追问。</p>
                  </div>

                  {Object.keys(collectedFacts).length > 0 && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="text-sm font-medium">已采集事实</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {Object.entries(collectedFacts).map(([key, value]) => (
                          <div key={key} className="rounded-lg bg-white px-3 py-2 text-sm">
                            <div className="text-xs uppercase tracking-wide text-gray-400">{key}</div>
                            <div className="mt-1 text-gray-700">{formatFactValue(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-sm font-medium">当前状态</div>
                      <div className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${readiness === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {readiness === 'ready' ? '信息已基本齐备，可生成提纲' : '信息仍需补充'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missingFields.length > 0 ? (
                          missingFields.map((field) => (
                            <span key={field} className="rounded-full bg-red-50 px-3 py-1 text-xs text-red-700">
                              {field}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">当前没有阻塞提纲生成的关键缺口。</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4">
                      <div className="text-sm font-medium">AI 下一轮建议追问</div>
                      <div className="mt-3 space-y-3">
                        {nextQuestions.length > 0 ? (
                          nextQuestions.map((question) => (
                            <div key={question.id} className="rounded-lg bg-gray-50 px-3 py-3 text-sm">
                              <div className="font-medium">{question.label}</div>
                              <div className="mt-1 text-gray-600">{question.question}</div>
                              <div className="mt-2 text-xs text-gray-400">{question.placeholder}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-gray-500">先点击下方按钮，让 AI 根据你的输入整理并追问。</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">继续补充给 AI 的说明</label>
                    <textarea
                      value={intakeMessage}
                      onChange={(event) => setIntakeMessage(event.target.value)}
                      className="min-h-[140px] w-full rounded-lg border px-3 py-2"
                      placeholder="例如：请示事项主要是申请专项资金，前期我们已完成方案论证，但仍缺正式批复。"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleIntake}
                      disabled={busy || !providers.length}
                      className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {busyAction === 'intake' ? '整理中...' : '让 AI 继续追问并整理事实'}
                    </button>
                    <button
                      onClick={handleGeneratePlanning}
                      disabled={busy || !canVisitPlanning}
                      className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      {busyAction === 'planning' ? '生成中...' : '进入结构共创'}
                    </button>
                    <button
                      onClick={() => handleGenerateOutline('direct')}
                      disabled={busy || !canVisitPlanning}
                      className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:text-gray-400"
                    >
                      直接生成提纲
                    </button>
                  </div>
                </div>
              )}

              {currentStep === 'planning' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">结构共创</h2>
                    <p className="mt-1 text-sm text-gray-500">AI 会先给你 3 种结构方案。先选方向，再微调段数、顺序和每段主题，最后再生成正式提纲。</p>
                  </div>

                  {planningOptions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                      <p className="text-sm text-gray-500">还没有结构方案，先让 AI 给出几种明显不同的组织思路。</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button onClick={handleGeneratePlanning} disabled={busy} className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
                          {busyAction === 'planning' ? '生成中...' : 'AI 生成结构建议'}
                        </button>
                        <button onClick={() => handleGenerateOutline('direct')} disabled={busy} className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:text-gray-400">
                          直接生成提纲
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 xl:grid-cols-3">
                        {planningOptions.map((option) => (
                          <button
                            key={option.planId}
                            type="button"
                            onClick={() => selectPlanningOption(option)}
                            className={`rounded-2xl border p-5 text-left transition-colors ${
                              selectedPlanId === option.planId
                                ? 'border-blue-500 bg-blue-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-base font-semibold">{option.label}</div>
                              <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">{option.sections.length} 段</span>
                            </div>
                            <div className="mt-2 text-sm text-blue-700">{option.strategy}</div>
                            <div className="mt-3 text-sm leading-6 text-gray-600">{option.whyThisWorks}</div>
                            <div className="mt-4 space-y-2">
                              {option.sections.map((section, index) => (
                                <div key={section.id} className="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-700">
                                  <div className="font-medium">{index + 1}. {section.headingDraft}</div>
                                  <div className="mt-1 text-xs text-gray-500">{section.topicSummary}</div>
                                </div>
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-gray-200 p-5">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                          <div>
                            <div className="text-base font-semibold">当前选中的结构方案</div>
                            <div className="mt-1 text-sm text-gray-500">继续调整段落标题、本段内容和顺序即可。AI 的结构说明默认折叠，不会干扰主编辑流程。</div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button onClick={handleGeneratePlanning} disabled={busy} className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:text-gray-400">
                              {busyAction === 'planning' ? '生成中...' : '换一批结构方案'}
                            </button>
                            <button onClick={() => handleGenerateOutline('direct')} disabled={busy} className="rounded-lg border border-gray-200 px-4 py-2 hover:bg-gray-50 disabled:text-gray-400">
                              直接生成提纲
                            </button>
                            <button onClick={() => handleGenerateOutline('fromPlan')} disabled={busy || planningSections.length === 0} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">
                              基于该结构生成正式提纲
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 space-y-4">
                          {planningSections.map((section, index) => (
                            <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">第 {index + 1} 段</div>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePlanningSections((current) => {
                                        if (index === 0) return current;
                                        const next = [...current];
                                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                        return next;
                                      })
                                    }
                                    disabled={index === 0}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:text-gray-300"
                                  >
                                    上移
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePlanningSections((current) => {
                                        if (index === current.length - 1) return current;
                                        const next = [...current];
                                        [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                        return next;
                                      })
                                    }
                                    disabled={index === planningSections.length - 1}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:text-gray-300"
                                  >
                                    下移
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updatePlanningSections((current) => current.filter((_, currentIndex) => currentIndex !== index))
                                    }
                                    className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                                  >
                                    删除
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 space-y-4">
                                <div>
                                  <label className="mb-2 block text-sm font-medium">段落标题</label>
                                  <textarea
                                    value={section.headingDraft}
                                    onChange={(event) =>
                                      updatePlanningSections((current) =>
                                        current.map((item, currentIndex) =>
                                          currentIndex === index ? { ...item, headingDraft: event.target.value } : item
                                        )
                                      )
                                    }
                                    className="min-h-[92px] w-full rounded-lg border px-3 py-2"
                                  />
                                </div>
                                <div>
                                  <label className="mb-2 block text-sm font-medium">本段内容</label>
                                  <textarea
                                    value={section.topicSummary}
                                    onChange={(event) =>
                                      updatePlanningSections((current) =>
                                        current.map((item, currentIndex) =>
                                          currentIndex === index ? { ...item, topicSummary: event.target.value } : item
                                        )
                                      )
                                    }
                                    className="min-h-[92px] w-full rounded-lg border px-3 py-2"
                                  />
                                </div>

                                <details className="rounded-xl border border-gray-200 bg-gray-50">
                                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
                                    AI 结构说明
                                  </summary>
                                  <div className="space-y-3 border-t border-gray-200 px-4 py-4 text-sm text-gray-700">
                                    <div>
                                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">这一段的作用</div>
                                      <p className="mt-1 leading-6">{section.purpose || '生成正式提纲时将自动补全。'}</p>
                                    </div>
                                    <div>
                                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">为什么排在这里</div>
                                      <p className="mt-1 leading-6">{section.orderReason || '生成正式提纲时将自动补全。'}</p>
                                    </div>
                                    <p className="text-xs leading-5 text-gray-500">
                                      你修改段落标题、本段内容或顺序后，这里的说明会在生成正式提纲时自动同步更新。
                                    </p>
                                  </div>
                                </details>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updatePlanningSections((current) => [
                              ...current,
                              {
                                id: `planning-${Date.now()}`,
                                headingDraft: '',
                                purpose: '',
                                topicSummary: '',
                                orderReason: '',
                              },
                            ])
                          }
                          disabled={planningSections.length >= MAX_PLANNING_SECTIONS}
                          className="mt-4 rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
                        >
                          {planningSections.length >= MAX_PLANNING_SECTIONS ? `最多 ${MAX_PLANNING_SECTIONS} 段` : '新增一段'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentStep === 'outline' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">提纲确认</h2>
                    <p className="mt-1 text-sm text-gray-500">先确认标题和提纲结构，再进入正文生成，能显著降低返工。</p>
                  </div>

                  {outlineSections.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                      <p className="text-sm text-gray-500">还没有正式提纲，先完成结构共创，或者直接生成一版正式提纲。</p>
                      <button onClick={() => handleGenerateOutline(planningSections.length > 0 ? 'fromPlan' : 'direct')} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
                        {busyAction === 'outline' ? '生成中...' : '生成提纲'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl bg-gray-50 p-4">
                        <div className="text-sm font-medium">标题建议</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {titleOptions.map((title) => (
                            <button
                              key={title}
                              onClick={() => setFormData((prev) => ({ ...prev, title }))}
                              className={`rounded-full px-4 py-2 text-sm ${
                                formData.title === title ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-blue-50'
                              }`}
                            >
                              {title}
                            </button>
                          ))}
                        </div>
                      </div>

                      {outlineRisks.length > 0 && (
                        <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-800">
                          <div className="font-medium">AI 风险提醒</div>
                          <div className="mt-2 space-y-2">
                            {outlineRisks.map((risk) => (
                              <div key={risk}>{risk}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        {outlineSections.map((section, index) => (
                          <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="grid gap-3 xl:grid-cols-[minmax(320px,1.2fr),1.8fr]">
                              <div>
                                <label className="mb-2 block text-sm font-medium">小标题</label>
                                <textarea
                                value={section.heading}
                                onChange={(event) =>
                                  setOutlineSections((prev) =>
                                    prev.map((item, current) => (current === index ? { ...item, heading: event.target.value } : item))
                                  )
                                }
                                className="min-h-[104px] w-full resize-y rounded-lg border px-3 py-2 text-base leading-relaxed"
                              />
                              </div>
                              <div>
                                <label className="mb-2 block text-sm font-medium">本段目的</label>
                                <textarea
                                value={section.purpose}
                                onChange={(event) =>
                                  setOutlineSections((prev) =>
                                    prev.map((item, current) => (current === index ? { ...item, purpose: event.target.value } : item))
                                  )
                                }
                                className="min-h-[104px] w-full rounded-lg border px-3 py-2"
                              />
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <label className="block text-sm font-medium">关键要点</label>
                                <button
                                  type="button"
                                  onClick={() => updateOutlineKeyPoints(index, (current) => [...current, ''])}
                                  className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50"
                                >
                                  新增一条
                                </button>
                              </div>
                              <div className="space-y-3">
                                {(section.keyPoints.length > 0 ? section.keyPoints : ['']).map((point, pointIndex) => (
                                  <div key={`${section.id}-${pointIndex}`} className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                                      {pointIndex + 1}
                                    </div>
                                    <input
                                      type="text"
                                      value={point}
                                      onChange={(event) =>
                                        updateOutlineKeyPoints(index, (current) => {
                                          const next = current.length > 0 ? [...current] : [''];
                                          next[pointIndex] = event.target.value;
                                          return next;
                                        })
                                      }
                                      className="flex-1 rounded-lg border px-3 py-2"
                                      placeholder={`请输入第 ${pointIndex + 1} 条关键要点`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateOutlineKeyPoints(index, (current) =>
                                          current.filter((_, currentIndex) => currentIndex !== pointIndex)
                                        )
                                      }
                                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                                    >
                                      删除
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button onClick={() => handleGenerateOutline(planningSections.length > 0 ? 'fromPlan' : 'direct')} disabled={busy} className="rounded-lg border border-blue-200 px-5 py-3 text-blue-700 hover:bg-blue-50 disabled:text-gray-400">
                          让 AI 重排提纲
                        </button>
                        <button onClick={handleConfirmOutline} className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700">
                          确认提纲并进入正文
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentStep === 'draft' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">分段成文</h2>
                    <p className="mt-1 text-sm text-gray-500">正文按段生成，后续优先做段落级改写，全文改写作为兜底。</p>
                  </div>

                  {sections.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
                      <p className="text-sm text-gray-500">提纲已经准备好，现在可以生成正文。</p>
                      <button onClick={handleRegenerateDraft} disabled={busy} className="mt-4 rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
                        {busyAction === 'draft' ? '生成中...' : '按提纲生成正文'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {selectedText && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                          <div className="text-sm font-medium text-blue-900">已选中文本</div>
                          <div className="mt-2 text-sm text-blue-800">{selectedText}</div>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={selectionInstruction}
                              onChange={(event) => setSelectionInstruction(event.target.value)}
                              className="flex-1 rounded-lg border px-3 py-2 text-sm"
                              placeholder="例如：把这句话改得更凝练、更像请示语气"
                            />
                            <button
                              onClick={() => handleRevise('selection', '', selectionInstruction)}
                              disabled={busy || !selectionInstruction.trim()}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
                            >
                              改写选中内容
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl bg-gray-50 p-4">
                        <div className="text-sm font-medium">整稿协作</div>
                        <div className="mt-3 flex flex-col gap-3 xl:flex-row">
                          <input
                            type="text"
                            value={fullInstruction}
                            onChange={(event) => setFullInstruction(event.target.value)}
                            className="flex-1 rounded-lg border px-3 py-2"
                            placeholder="例如：整体语气再严肃一些，第二部分再补充执行要求"
                          />
                          <button
                            onClick={() => handleRevise('full', '', fullInstruction)}
                            disabled={busy || !fullInstruction.trim()}
                            className="rounded-lg border border-blue-200 px-4 py-2 text-blue-700 hover:bg-blue-50 disabled:text-gray-400"
                          >
                            AI 修改整稿
                          </button>
                          <button
                            onClick={handleRegenerateDraft}
                            disabled={busy}
                            className="rounded-lg border border-amber-200 px-4 py-2 text-amber-700 hover:bg-amber-50 disabled:text-gray-400"
                          >
                            {busyAction === 'draft' ? '重新生成中...' : '重新生成正文'}
                          </button>
                          <button onClick={handleRunReview} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">
                            去做定稿检查
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        {sections.map((section) => (
                          <div key={section.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                              <input
                                type="text"
                                value={section.heading}
                                onChange={(event) =>
                                  setSections((prev) =>
                                    prev.map((item) => (item.id === section.id ? { ...item, heading: event.target.value } : item))
                                  )
                                }
                                className="rounded-lg border px-3 py-2 xl:w-64"
                              />
                              <button
                                onClick={() => handleGenerateDraft('section', section.id)}
                                disabled={busy}
                                className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                AI 重写本段
                              </button>
                            </div>
                            <textarea
                              value={section.body}
                              onChange={(event) =>
                                setSections((prev) =>
                                  prev.map((item) => (item.id === section.id ? { ...item, body: event.target.value } : item))
                                )
                              }
                              className="mt-3 min-h-[180px] w-full rounded-lg border px-3 py-2"
                            />
                            <div className="mt-3 flex flex-col gap-3 xl:flex-row">
                              <input
                                type="text"
                                value={sectionInstructions[section.id] || ''}
                                onChange={(event) => setSectionInstructions((prev) => ({ ...prev, [section.id]: event.target.value }))}
                                className="flex-1 rounded-lg border px-3 py-2"
                                placeholder="例如：这一段再扩写实施步骤，或改得更像通知口径"
                              />
                              <button
                                onClick={() => handleRevise('section', section.id, sectionInstructions[section.id] || '')}
                                disabled={busy || !(sectionInstructions[section.id] || '').trim()}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                              >
                                AI 修改本段
                              </button>
                            </div>
                            {renderSectionProvenance(section)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentStep === 'review' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold">定稿检查</h2>
                    <p className="mt-1 text-sm text-gray-500">先检查规范性，再决定是否一键修复或直接导出。</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button onClick={handleRunReview} disabled={busy || sections.length === 0} className="rounded-lg bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 disabled:bg-gray-400">
                      {busyAction === 'review' ? '检查中...' : '重新运行定稿检查'}
                    </button>
                    <button onClick={handleRegenerateDraft} disabled={busy || sections.length === 0} className="rounded-lg border border-amber-200 px-5 py-3 text-amber-700 hover:bg-amber-50 disabled:text-gray-400">
                      {busyAction === 'draft' ? '重新生成中...' : '重新生成正文'}
                    </button>
                    <button onClick={handleDownload} disabled={busy || sections.length === 0} className="rounded-lg bg-green-600 px-5 py-3 text-white hover:bg-green-700 disabled:bg-gray-400">
                      {busyAction === 'download' ? '导出中...' : '下载 Word 定稿'}
                    </button>
                  </div>

                  {(reviewGateMessage || reviewState) && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        reviewState?.status === 'pass'
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-amber-200 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {reviewGateMessage || `最近一次定稿检查结果：${reviewState?.status === 'pass' ? '通过' : reviewState?.status === 'warning' ? '有提醒' : '未通过'}。`}
                    </div>
                  )}

                  <div className="space-y-3">
                    {reviewChecks.length > 0 ? (
                      reviewChecks.map((check) => (
                        <div key={check.code} className={`rounded-xl border p-4 ${statusClass(check.status)}`}>
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                              <div className="text-xs uppercase tracking-wide opacity-70">{check.code}</div>
                              <div className="mt-1 font-medium">{check.message}</div>
                            </div>
                            {check.fixPrompt && (
                              <button
                                onClick={() => handleRevise('full', '', check.fixPrompt)}
                                disabled={busy}
                                className="rounded-lg border border-current px-4 py-2 text-sm"
                              >
                                一键修复
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                        先运行一次定稿检查，AI 会列出风险项和一键修复建议。
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="text-sm font-medium">已采纳依据</div>
                    <div className="mt-3 space-y-4">
                      {sections.map((section) => (
                        <div key={`review-provenance-${section.id}`}>
                          <div className="text-sm font-medium text-gray-900">{section.heading}</div>
                          {renderSectionProvenance(section, '本段当前没有可展示的采纳依据。')}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">实时预览</h2>
                <span className="text-xs text-gray-500">可在预览区选中文本，再回到“分段成文”做选区改写</span>
              </div>
              <div
                className="mt-4 min-h-[720px] rounded-xl border bg-white p-10 text-sm leading-8"
                onMouseUp={() => setSelectedText(window.getSelection()?.toString().trim() || '')}
              >
                {previewContent ? (
                  <>
                    <div className="text-center text-xl font-bold">{formData.title || '未命名文稿'}</div>
                    <div className="h-8" />
                    <div>{formData.recipient}：</div>
                    <div className="mt-2 space-y-4">
                      {sections.map((section) => (
                        <div key={section.id}>
                          <p className="font-medium">{section.heading}</p>
                          {section.body
                            .split('\n')
                            .filter((line) => line.trim())
                            .map((line, index) => (
                              <p key={index} className="indent-8">
                                {line}
                              </p>
                            ))}
                          {section.provenance?.sources?.length ? (
                            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-6 text-gray-600">
                              <div className="font-medium text-gray-700">来源依据</div>
                              <div className="mt-2 space-y-2">
                                {section.provenance.sources.map((source, index) => (
                                  <div key={`${section.id}-preview-${source.sourceId || source.label}-${index}`}>
                                    <span className="font-medium text-gray-800">{source.label}</span>
                                    <span className="ml-2">{source.excerpt}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {attachments.length > 0 && (
                      <>
                        <div className="h-8" />
                        <div>附件：1. {attachments[0]}</div>
                        {attachments.slice(1).map((attachment, index) => (
                          <div key={attachment + index} className="pl-16">
                            {index + 2}. {attachment}
                          </div>
                        ))}
                        <div className="h-8" />
                        <div className="h-8" />
                      </>
                    )}
                    <div className="pr-8 text-right">{formData.issuer}</div>
                    <div className="pr-8 text-right">{formData.date}</div>
                    {formData.contactName && formData.contactPhone && (
                      <>
                        <div className="h-8" />
                        <div className="text-center">
                          （联系人：{formData.contactName}，电话：{formData.contactPhone}）
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex min-h-[620px] items-center justify-center text-gray-400">提纲确认后，正文预览会显示在这里。</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return <GeneratePageContent />;
}
