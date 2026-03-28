import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import {
  type DraftRecord,
  persistFullDraftOperationResult,
  persistPendingChangeOperationResult,
  getDraftById,
} from '@/lib/collaborative-store';
import {
  generateDraftWorkflow,
  regenerateSectionWorkflow,
  reviseWorkflow,
  type DraftResult,
  type ReviseResult,
} from '@/lib/official-document-workflow';
import type { DraftOperationReadModel } from '@/lib/validation';
import { AppError } from '@/lib/api';
import { getAuthoritativeWorkflowStage } from '@/lib/workflow-stage';
import type { SupabaseClient } from '@supabase/supabase-js';

type OperationExecutionEnvelope = {
  result: Record<string, unknown>;
  onComplete: () => Promise<void>;
};

type SessionReferencePayload = Array<{
  name: string;
  docType?: DraftRecord['doc_type'] | null;
  fileName: string;
  fileType: string;
  content: string;
  analysis?: Record<string, unknown> | null;
}>;

type DraftGeneratePayload = {
  draftId: string;
  provider: DraftRecord['provider'];
  mode: 'full';
  sessionReferences?: SessionReferencePayload;
};

type DraftRegeneratePayload = {
  draftId: string;
  provider: DraftRecord['provider'];
  mode: 'section';
  sectionId: string;
  sessionReferences?: SessionReferencePayload;
};

type DraftRevisePayload = {
  draftId: string;
  provider: DraftRecord['provider'];
  targetType: 'selection' | 'section' | 'full';
  targetId?: string;
  selectedText?: string;
  instruction: string;
  sessionReferences?: SessionReferencePayload;
};

function normalizeTextForSectionMatch(text: string) {
  return text.replace(/\s+/g, '').trim();
}

function resolveTargetSectionIds(draft: DraftRecord, payload: DraftRevisePayload) {
  if (payload.targetType === 'section') {
    return payload.targetId ? [payload.targetId] : [];
  }

  if (payload.targetType === 'selection') {
    if (payload.targetId) {
      return [payload.targetId];
    }

    const normalizedSelectedText = normalizeTextForSectionMatch(payload.selectedText || '');
    const matched = draft.sections
      .filter((section) => normalizeTextForSectionMatch(section.body).includes(normalizedSelectedText))
      .map((section) => section.id);

    if (matched.length > 0) {
      return matched;
    }

    throw new AppError(400, '未找到所选片段对应的段落，请重新选择。', 'TARGET_SECTION_REQUIRED');
  }

  return [];
}

function ensureGroundingConsistency(params: {
  rules: unknown[];
  references: unknown[];
  result: DraftResult;
}) {
  const hasGroundingContext = params.rules.length > 0 || params.references.length > 0;
  const claimsGrounding = params.result.sections.some((section) => (section.provenance?.sources || []).length > 0);

  if (!hasGroundingContext && claimsGrounding) {
    throw new AppError(400, '当前没有已批准的依据材料，不能返回采纳依据。', 'GROUNDING_CONTEXT_REQUIRED');
  }
}

export async function prepareOperationExecution(input: {
  supabase: SupabaseClient;
  operation: DraftOperationReadModel;
}): Promise<OperationExecutionEnvelope> {
  const operation = input.operation;
  const draft = await getDraftById(input.supabase, operation.userId, operation.draftId || '');

  switch (operation.operationType) {
    case 'draft_generate': {
      const payload = operation.payload as DraftGeneratePayload;
      const { rules, references } = await loadRuleAndReferenceContext({
        supabase: input.supabase,
        userId: operation.userId,
        provider: payload.provider,
        docType: draft.doc_type,
        activeRuleIds: draft.active_rule_ids,
        activeReferenceIds: draft.active_reference_ids,
        sessionReferences: payload.sessionReferences || [],
      });
      const result = await generateDraftWorkflow({
        docType: draft.doc_type,
        provider: payload.provider,
        facts: draft.collected_facts,
        title: draft.generated_title || draft.title || '',
        outlineSections: draft.outline?.sections || [],
        rules,
        references,
        attachments: draft.attachments,
      });
      ensureGroundingConsistency({ rules, references, result });
      const workflowStage = getAuthoritativeWorkflowStage('draft_generated');

      return {
        result: {
          title: result.title,
          content: result.content,
          sections: result.sections,
          workflowStage,
        },
        onComplete: async () => {
          await persistFullDraftOperationResult(input.supabase, {
            userId: operation.userId,
            draft,
            operationType: 'draft_generate',
            result,
            workflowStage,
            changeSummary: '已生成正文',
          });
        },
      };
    }
    case 'draft_regenerate': {
      const payload = operation.payload as DraftRegeneratePayload;
      const { rules, references } = await loadRuleAndReferenceContext({
        supabase: input.supabase,
        userId: operation.userId,
        provider: payload.provider,
        docType: draft.doc_type,
        activeRuleIds: draft.active_rule_ids,
        activeReferenceIds: draft.active_reference_ids,
        sessionReferences: payload.sessionReferences || [],
      });
      const result = await regenerateSectionWorkflow({
        docType: draft.doc_type,
        provider: payload.provider,
        facts: draft.collected_facts,
        title: draft.generated_title || draft.title || '',
        outlineSections: draft.outline?.sections || [],
        currentSections: draft.sections,
        targetSectionId: payload.sectionId,
        rules,
        references,
        attachments: draft.attachments,
      });
      ensureGroundingConsistency({ rules, references, result });

      return {
        result: {
          mode: 'preview',
        },
        onComplete: async () => {
          await persistPendingChangeOperationResult(input.supabase, {
            userId: operation.userId,
            draft,
            operationType: 'draft_regenerate',
            targetType: 'section',
            targetSectionIds: [payload.sectionId],
            result: {
              title: result.title,
              content: result.content,
              sections: result.sections,
              changeSummary: '已生成段落重写候选，请确认是否接受',
            },
          });
        },
      };
    }
    case 'draft_revise': {
      const payload = operation.payload as DraftRevisePayload;
      const { rules, references } = await loadRuleAndReferenceContext({
        supabase: input.supabase,
        userId: operation.userId,
        provider: payload.provider,
        docType: draft.doc_type,
        activeRuleIds: draft.active_rule_ids,
        activeReferenceIds: draft.active_reference_ids,
        sessionReferences: payload.sessionReferences || [],
      });
      const result: ReviseResult = await reviseWorkflow({
        docType: draft.doc_type,
        provider: payload.provider,
        facts: draft.collected_facts,
        title: draft.generated_title || draft.title || '',
        sections: draft.sections,
        instruction: payload.instruction,
        targetType: payload.targetType,
        targetId: payload.targetId || undefined,
        selectedText: payload.selectedText || undefined,
        rules,
        references,
      });
      const targetSectionIds = resolveTargetSectionIds(draft, payload);

      return {
        result: {
          mode: 'preview',
        },
        onComplete: async () => {
          await persistPendingChangeOperationResult(input.supabase, {
            userId: operation.userId,
            draft,
            operationType: 'draft_revise',
            targetType: payload.targetType,
            targetSectionIds,
            result: {
              title: result.title || draft.generated_title || draft.title || '',
              content: result.updatedContent,
              sections: result.updatedSections,
              changeSummary: result.changeSummary,
            },
          });
        },
      };
    }
    default:
      throw new AppError(400, '当前操作类型尚未接入执行器', 'OPERATION_TYPE_UNSUPPORTED');
  }
}
