import { loadRuleAndReferenceContext } from '@/lib/collaborative-route-helpers';
import {
  compileSectionsToContent,
  type DraftRecord,
  persistExportOperationResult,
  type ReferenceAssetRecord,
  persistFullDraftOperationResult,
  persistPendingChangeOperationResult,
  getDraftById,
} from '@/lib/collaborative-store';
import { DOCX_MIME_TYPE, uploadExportArtifact } from '@/lib/export-artifact-store';
import { generateDocumentBuffer } from '@/lib/document-generator';
import {
  computeReviewContentHash,
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
  analysis?: ReferenceAssetRecord['analysis'];
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

type ExportPayload = {
  draftId: string;
  docType: DraftRecord['doc_type'];
  provider: DraftRecord['provider'];
  reviewHash: string;
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

function sanitizeTitle(title: string) {
  return title.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'document';
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
    case 'export': {
      const payload = operation.payload as ExportPayload;

      if (!draft.review_state) {
        throw new AppError(409, '请先运行定稿检查后再导出', 'REVIEW_REQUIRED');
      }

      const currentReviewHash = computeReviewContentHash({
        title: draft.generated_title || draft.title || '',
        content: draft.generated_content || compileSectionsToContent(draft.sections),
        sections: draft.sections,
      });

      if (draft.review_state.content_hash !== payload.reviewHash || payload.reviewHash !== currentReviewHash) {
        throw new AppError(409, '当前正文已变化，请重新运行定稿检查后再导出', 'REVIEW_STALE');
      }

      const title = draft.generated_title || draft.title || 'document';
      const content = draft.generated_content || compileSectionsToContent(draft.sections);
      const fileName = `${sanitizeTitle(title)}.docx`;
      const bytes = await generateDocumentBuffer(payload.docType, {
        title,
        recipient: draft.recipient || '',
        content,
        issuer: draft.issuer || '',
        date: draft.date || new Date().toISOString().slice(0, 10),
        attachments: draft.attachments,
        contactName: draft.contact_name || undefined,
        contactPhone: draft.contact_phone || undefined,
      });
      const artifact = await uploadExportArtifact(input.supabase, {
        operationId: operation.id,
        userId: operation.userId,
        draftId: draft.id,
        fileName,
        mimeType: DOCX_MIME_TYPE,
        bytes,
      });
      const workflowStage = getAuthoritativeWorkflowStage('export_completed');

      return {
        result: {
          artifactId: artifact.id,
          downloadUrl: `/api/operations/${operation.id}/download`,
          fileName: artifact.fileName,
          workflowStage,
        },
        onComplete: async () => {
          await persistExportOperationResult(input.supabase, {
            operationId: operation.id,
            userId: operation.userId,
            draft,
            workflowStage,
            artifact,
            result: {
              title,
              content,
              sections: draft.sections,
            },
            changeSummary: '已导出 Word 定稿',
          });
        },
      };
    }
    default:
      throw new AppError(400, '当前操作类型尚未接入执行器', 'OPERATION_TYPE_UNSUPPORTED');
  }
}
