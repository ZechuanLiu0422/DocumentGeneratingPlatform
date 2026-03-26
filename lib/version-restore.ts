import type { DraftRecord, VersionRecord } from './collaborative-store.ts';

type RestoredSnapshot = {
  stage: 'restored';
  title: string | null;
  content: string | null;
  sections: DraftRecord['sections'];
  change_summary: string;
};

export function mergeRestoredDraft(draft: DraftRecord, version: VersionRecord, updatedAt: string): DraftRecord {
  return {
    ...draft,
    workflow_stage: 'draft',
    generated_title: version.title || null,
    generated_content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    updated_at: updatedAt,
  };
}

export function buildRestoredSnapshot(version: VersionRecord): RestoredSnapshot {
  return {
    stage: 'restored',
    title: version.title || null,
    content: version.content || null,
    sections: Array.isArray(version.sections) ? version.sections : [],
    change_summary: `从历史版本恢复：${version.change_summary || version.stage}`,
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
