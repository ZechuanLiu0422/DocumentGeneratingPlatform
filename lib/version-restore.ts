import { randomUUID } from 'node:crypto';
import type { DraftRecord, VersionRecord } from './collaborative-store.ts';
import type {
  ChangeCandidateAction,
  ChangeCandidatePreview,
  ChangeCandidateSnapshot,
  ChangeCandidateTargetType,
  PendingChangeState,
} from './validation.ts';
import { pendingChangeStateSchema } from './validation.ts';

export const PENDING_CHANGE_TTL_MS = 30 * 60 * 1000;

type RestoredSnapshot = {
  stage: 'restored';
  title: string | null;
  content: string | null;
  sections: DraftRecord['sections'];
  review_state?: DraftRecord['review_state'];
  change_summary: string;
};

function buildCandidateSnapshotFromDraft(
  draft: Pick<DraftRecord, 'title' | 'generated_title' | 'generated_content' | 'sections' | 'review_state'>
): ChangeCandidateSnapshot {
  return {
    title: draft.generated_title || draft.title || null,
    content: draft.generated_content || null,
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    reviewState: draft.review_state || null,
  };
}

function buildCandidateSnapshotFromVersionLike(
  version: Pick<VersionRecord, 'title' | 'content' | 'sections' | 'review_state'>
): ChangeCandidateSnapshot {
  return {
    title: version.title || null,
    content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    reviewState: version.review_state || null,
  };
}

function stableSectionFingerprint(section: DraftRecord['sections'][number]) {
  return JSON.stringify({
    heading: section.heading,
    body: section.body,
    provenance: section.provenance || null,
  });
}

function collectChangedSectionIds(beforeSections: DraftRecord['sections'], afterSections: DraftRecord['sections']) {
  const beforeById = new Map(beforeSections.map((section) => [section.id, stableSectionFingerprint(section)]));
  const afterIds = new Set(afterSections.map((section) => section.id));
  const changed = new Set<string>();

  for (const section of afterSections) {
    if (beforeById.get(section.id) !== stableSectionFingerprint(section)) {
      changed.add(section.id);
    }
  }

  for (const section of beforeSections) {
    if (!afterIds.has(section.id)) {
      changed.add(section.id);
    }
  }

  return Array.from(changed);
}

function buildDefaultDiffSummary(changedSectionIds: string[], targetType: ChangeCandidateTargetType) {
  if (targetType === 'section' && changedSectionIds.length === 1) {
    return `仅 ${changedSectionIds[0]} 发生变化`;
  }

  return `共 ${changedSectionIds.length} 个段落发生变化`;
}

export function buildChangeCandidatePreview(params: {
  action: ChangeCandidateAction;
  targetType: ChangeCandidateTargetType;
  targetSectionIds: string[];
  beforeDraft: Pick<DraftRecord, 'title' | 'generated_title' | 'generated_content' | 'sections' | 'review_state'>;
  after: {
    title?: string | null;
    content?: string | null;
    sections: DraftRecord['sections'];
    reviewState?: DraftRecord['review_state'];
  };
  candidateId?: string;
  diffSummary?: string;
}): ChangeCandidatePreview {
  const before = buildCandidateSnapshotFromDraft(params.beforeDraft);
  const after: ChangeCandidateSnapshot = {
    title: params.after.title || null,
    content: params.after.content || null,
    sections: Array.isArray(params.after.sections) ? params.after.sections : [],
    reviewState: params.after.reviewState || null,
  };
  const changedSectionIds = collectChangedSectionIds(before.sections, after.sections);
  const unchangedSectionIds = before.sections
    .map((section) => section.id)
    .filter((sectionId) => !changedSectionIds.includes(sectionId));

  return {
    candidateId: params.candidateId || randomUUID(),
    action: params.action,
    targetType: params.targetType,
    targetSectionIds: params.targetSectionIds,
    changedSectionIds,
    unchangedSectionIds,
    before,
    after,
    diffSummary: params.diffSummary || buildDefaultDiffSummary(changedSectionIds, params.targetType),
  };
}

export function buildPendingChangeState(params: {
  candidate: ChangeCandidatePreview;
  userId: string;
  baseUpdatedAt: string;
  createdAt?: string;
  expiresAt?: string;
}): PendingChangeState {
  const createdAt = params.createdAt || new Date().toISOString();
  const expiresAt =
    params.expiresAt || new Date(new Date(createdAt).getTime() + PENDING_CHANGE_TTL_MS).toISOString();

  return pendingChangeStateSchema.parse({
    ...params.candidate,
    userId: params.userId,
    createdAt,
    expiresAt,
    baseUpdatedAt: params.baseUpdatedAt,
  });
}

export function isPendingChangeExpired(pendingChange: Pick<PendingChangeState, 'expiresAt'>, now = new Date()) {
  return new Date(pendingChange.expiresAt).getTime() <= now.getTime();
}

export function doesDraftMatchPendingChangeBase(
  draft: Pick<DraftRecord, 'title' | 'generated_title' | 'generated_content' | 'sections' | 'review_state' | 'updated_at'>,
  pendingChange: Pick<PendingChangeState, 'baseUpdatedAt' | 'before'>
) {
  if (pendingChange.baseUpdatedAt === draft.updated_at) {
    return true;
  }

  const currentSnapshot = buildCandidateSnapshotFromDraft(draft);
  return JSON.stringify(currentSnapshot) === JSON.stringify(pendingChange.before);
}

export function mergeRestoredDraft(draft: DraftRecord, version: VersionRecord, updatedAt: string): DraftRecord {
  return {
    ...draft,
    workflow_stage: 'draft',
    generated_title: version.title || null,
    generated_content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    review_state: version.review_state ?? draft.review_state ?? null,
    pending_change: null,
    updated_at: updatedAt,
  };
}

export function buildRestoredSnapshot(version: VersionRecord): RestoredSnapshot {
  return {
    stage: 'restored',
    title: version.title || null,
    content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    review_state: version.review_state || null,
    change_summary: `从历史版本恢复：${version.change_summary || version.stage}`,
  };
}

export function buildRestoreCandidatePreview(
  draft: Pick<DraftRecord, 'title' | 'generated_title' | 'generated_content' | 'sections' | 'review_state'>,
  version: Pick<VersionRecord, 'title' | 'content' | 'sections' | 'review_state'>,
  candidateId = randomUUID()
): ChangeCandidatePreview {
  const candidate = buildChangeCandidatePreview({
    action: 'restore',
    targetType: 'full',
    targetSectionIds: [],
    beforeDraft: draft,
    after: {
      title: version.title || null,
      content: version.content || null,
      sections: Array.isArray(version.sections) ? version.sections : [],
      reviewState: version.review_state || null,
    },
    candidateId,
  });

  return {
    ...candidate,
    targetType: candidate.changedSectionIds.length === 1 ? 'section' : 'full',
    targetSectionIds: candidate.changedSectionIds.length === 1 ? [...candidate.changedSectionIds] : [],
  };
}

export function buildRestoreResponse(draft: DraftRecord, version: VersionRecord, versionCount = draft.version_count) {
  return {
    draft: {
      ...draft,
      version_count: versionCount,
    },
    restoredVersion: version,
    restoredSnapshot: buildRestoredSnapshot(version),
  };
}
