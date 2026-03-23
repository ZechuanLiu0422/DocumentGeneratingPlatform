import { type DraftRecord, type ReferenceAssetRecord, fetchReferenceAssets, fetchWritingRules } from '@/lib/collaborative-store';
import type { Provider } from '@/lib/providers';
import type { SupabaseClient } from '@supabase/supabase-js';

export function resolveBaseDraftFields(
  existingDraft: DraftRecord | null,
  answers: Record<string, unknown> = {},
  fallbackTitle = ''
) {
  const attachments = Array.isArray(answers.attachments)
    ? answers.attachments.map((item) => String(item || '').trim()).filter(Boolean)
    : existingDraft?.attachments || [];

  return {
    title: typeof answers.title === 'string' ? answers.title.trim() : existingDraft?.title || fallbackTitle || '',
    recipient: typeof answers.recipient === 'string' ? answers.recipient.trim() : existingDraft?.recipient || '',
    content: typeof answers.content === 'string' ? answers.content.trim() : existingDraft?.content || '',
    issuer: typeof answers.issuer === 'string' ? answers.issuer.trim() : existingDraft?.issuer || '',
    date: typeof answers.date === 'string' ? answers.date.trim() : existingDraft?.date || '',
    contact_name: typeof answers.contactName === 'string' ? answers.contactName.trim() : existingDraft?.contact_name || '',
    contact_phone: typeof answers.contactPhone === 'string' ? answers.contactPhone.trim() : existingDraft?.contact_phone || '',
    attachments,
  };
}

export async function loadRuleAndReferenceContext(params: {
  supabase: SupabaseClient;
  userId: string;
  provider: Provider;
  docType: DraftRecord['doc_type'];
  activeRuleIds?: string[];
  activeReferenceIds?: string[];
  sessionReferences?: Array<{
    name: string;
    docType?: DraftRecord['doc_type'] | null;
    fileName: string;
    fileType: string;
    content: string;
    analysis?: ReferenceAssetRecord['analysis'];
  }>;
}) {
  const rules = await fetchWritingRules(params.supabase, params.userId, params.activeRuleIds || [], params.docType);
  const persistedReferences = await fetchReferenceAssets(params.supabase, params.userId, params.activeReferenceIds || [], params.docType);
  const sessionReferences: ReferenceAssetRecord[] = (params.sessionReferences || []).map((reference, index) => ({
    id: `session-${index + 1}`,
    user_id: params.userId,
    name: reference.name,
    doc_type: reference.docType || params.docType,
    file_name: reference.fileName,
    file_type: reference.fileType,
    content: reference.content,
    analysis: reference.analysis || null,
    is_favorite: false,
  }));

  return {
    rules,
    references: [...persistedReferences, ...sessionReferences],
  };
}
