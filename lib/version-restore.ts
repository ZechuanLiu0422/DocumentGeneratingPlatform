import { randomUUID } from 'node:crypto';
import type { DraftRecord, VersionRecord } from './collaborative-store.ts';
import type { ChangeCandidatePreview, ChangeCandidateSnapshot } from './validation.ts';

type RestoredSnapshot = {
  stage: 'restored';
  title: string | null;
  content: string | null;
  sections: DraftRecord['sections'];
  review_state?: DraftRecord['review_state'];
  change_summary: string;
};

function buildCandidateSnapshotFromDraft(draft: Pick<DraftRecord, 'title' | 'generated_content' | 'sections' | 'review_state'>): ChangeCandidateSnapshot {
  return {
    title: draft.title || null,
    content: draft.generated_content || null,
    sections: Array.isArray(draft.sections) ? draft.sections : [],
    reviewState: draft.review_state || null,
  };
}

function buildCandidateSnapshotFromVersion(
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

export function mergeRestoredDraft(draft: DraftRecord, version: VersionRecord, updatedAt: string): DraftRecord {
  return {
    ...draft,
    workflow_stage: 'draft',
    generated_title: version.title || null,
    generated_content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    review_state: version.review_state ?? draft.review_state ?? null,
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
  draft: Pick<DraftRecord, 'title' | 'generated_content' | 'sections' | 'review_state'>,
  version: Pick<VersionRecord, 'title' | 'content' | 'sections' | 'review_state'>,
  candidateId = randomUUID()
): ChangeCandidatePreview {
  const before = buildCandidateSnapshotFromDraft(draft);
  const after = buildCandidateSnapshotFromVersion(version);
  const changedSectionIds = collectChangedSectionIds(before.sections, after.sections);
  const unchangedSectionIds = before.sections
    .map((section) => section.id)
    .filter((sectionId) => !changedSectionIds.includes(sectionId));

  return {
    candidateId,
    action: 'restore',
    targetType: changedSectionIds.length === 1 ? 'section' : 'full',
    targetSectionIds: changedSectionIds.length === 1 ? [...changedSectionIds] : [],
    changedSectionIds,
    unchangedSectionIds,
    before,
    after,
    diffSummary:
      changedSectionIds.length === 1
        ? `仅 ${changedSectionIds[0]} 发生变化`
        : `共 ${changedSectionIds.length} 个段落发生变化`,
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
