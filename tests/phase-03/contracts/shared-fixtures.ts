import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

type SourceRefOverrides = Partial<ReturnType<typeof buildSectionSourceRef>>;
type ReviewStateOverrides = Partial<ReturnType<typeof buildReviewState>>;
type TrustedSectionOverrides = Partial<ReturnType<typeof buildTrustedSection>>;

export function buildSectionSourceRef(overrides: SourceRefOverrides = {}) {
  return {
    sourceType: 'reference_asset' as const,
    sourceId: '44444444-4444-4444-8444-444444444444',
    label: '专项检查工作指引',
    excerpt: '发文应先说明背景，再明确任务与时间要求。',
    reason: '为正文第一段提供依据',
    ...overrides,
  };
}

export function buildSectionProvenance() {
  return {
    summary: '内容依据已批准参考材料整理。',
    sources: [buildSectionSourceRef()],
  };
}

export function buildReviewState(overrides: ReviewStateOverrides = {}) {
  return {
    content_hash: 'sha256:phase-03-review-hash',
    doc_type: 'notice' as const,
    status: 'pass' as const,
    ran_at: '2026-03-27T17:30:00.000Z',
    checks: [
      {
        code: 'notice-action-required',
        status: 'pass' as const,
        message: '正文包含明确的执行要求。',
        fixPrompt: '',
      },
    ],
    ...overrides,
  };
}

export function buildTrustedSection(overrides: TrustedSectionOverrides = {}) {
  return {
    id: 'draft-sec-1',
    heading: '一、工作目标',
    body: '请各单位围绕专项检查要求完成自查。',
    provenance: buildSectionProvenance(),
    ...overrides,
  };
}

export function buildTrustedDraftFixture() {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice' as const,
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求完成自查。',
    issuer: '办公室',
    date: '2026-03-27',
    provider: 'claude' as const,
    contact_name: '张三',
    contact_phone: '12345678',
    attachments: ['附件1'],
    workflow_stage: 'review' as const,
    collected_facts: {
      topic: '专项检查',
      objective: '统一工作要求',
    },
    missing_fields: [],
    planning: null,
    outline: null,
    sections: [
      buildTrustedSection(),
      buildTrustedSection({
        id: 'draft-sec-2',
        heading: '二、工作安排',
        body: '请于下周三前完成材料报送。',
      }),
    ],
    review_state: buildReviewState(),
    active_rule_ids: ['33333333-3333-4333-8333-333333333333'],
    active_reference_ids: ['44444444-4444-4444-8444-444444444444'],
    version_count: 2,
    generated_title: '关于开展专项检查的通知',
    generated_content: '一、工作目标\n请各单位围绕专项检查要求完成自查。',
    updated_at: '2026-03-27T17:30:00.000Z',
  };
}

export function buildTrustedVersionFixture() {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    draft_id: '22222222-2222-4222-8222-222222222222',
    user_id: '11111111-1111-4111-8111-111111111111',
    stage: 'review_applied' as const,
    title: '关于开展专项检查的通知',
    content: '一、工作目标\n请各单位围绕专项检查要求完成自查。\n\n二、工作安排\n请于本周五前提交整改清单。',
    sections: [
      buildTrustedSection(),
      buildTrustedSection({
        id: 'draft-sec-2',
        heading: '二、工作安排',
        body: '请于本周五前提交整改清单。',
      }),
    ],
    review_state: buildReviewState({
      content_hash: 'sha256:phase-03-version-hash',
    }),
    change_summary: '结合审校意见更新时间要求',
    created_at: '2026-03-27T17:31:00.000Z',
  };
}

export function buildChangeCandidatePayload() {
  return {
    candidateId: '66666666-6666-4666-8666-666666666666',
    action: 'restore' as const,
    targetType: 'section' as const,
    targetSectionIds: ['draft-sec-2'],
    changedSectionIds: ['draft-sec-2'],
    unchangedSectionIds: ['draft-sec-1'],
    before: {
      title: buildTrustedDraftFixture().title,
      content: buildTrustedDraftFixture().generated_content,
      sections: buildTrustedDraftFixture().sections,
      reviewState: buildTrustedDraftFixture().review_state,
    },
    after: {
      title: buildTrustedVersionFixture().title,
      content: buildTrustedVersionFixture().content,
      sections: buildTrustedVersionFixture().sections,
      reviewState: buildTrustedVersionFixture().review_state,
    },
    diffSummary: '仅第二段时间要求发生变化。',
  };
}

test('Phase 3 harness exposes scripts, trust fixtures, and helper wrappers', async () => {
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

  assert.equal(
    typeof packageJson.scripts['test:phase-03:contracts:harness'],
    'string',
    'package.json should expose a Phase 3 harness smoke command'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-03:contracts:foundation'],
    'string',
    'package.json should expose a Phase 3 foundation contract command'
  );
  assert.match(packageJson.scripts['test:phase-03:contracts:harness'] ?? '', /experimental-strip-types/);

  const fixture = buildTrustedDraftFixture();
  assert.equal(fixture.sections.length, 2);
  assert.equal(fixture.sections[0]?.provenance?.sources.length, 1);
  assert.equal(fixture.review_state.status, 'pass');
  assert.equal(buildChangeCandidatePayload().changedSectionIds[0], 'draft-sec-2');

  const helperPath = path.join(__dirname, 'trust-contract-helpers.ts');
  assert.equal(existsSync(helperPath), true, 'Phase 3 helper wrapper should exist');

  if (existsSync(helperPath)) {
    const helpers = (await import(`${pathToFileURL(helperPath).href}?phase03=${Date.now()}`)) as Record<string, unknown>;
    assert.equal(typeof helpers.createTrustJsonRequest, 'function');
    assert.equal(typeof helpers.withTrustRouteModuleMocks, 'function');
    assert.equal(typeof helpers.importTrustProjectModule, 'function');
  }
});
