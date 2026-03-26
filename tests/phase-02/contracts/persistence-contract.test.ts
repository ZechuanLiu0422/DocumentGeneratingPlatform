import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileSectionsToContent,
  listVersionsForDraft,
  saveDraftState,
} from '../../../lib/collaborative-store.ts';
import {
  buildDraftFixture,
  buildSparseDraftFixture,
  buildSparseVersionFixture,
} from './shared-fixtures.ts';

function createDraftInsertClient(row: Record<string, unknown>) {
  let insertedPayload: Record<string, unknown> | null = null;

  return {
    client: {
      from(table: string) {
        assert.equal(table, 'drafts');

        return {
          insert(payload: Record<string, unknown>) {
            insertedPayload = payload;

            return {
              select() {
                return {
                  async single() {
                    return {
                      data: row,
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
    getInsertedPayload() {
      return insertedPayload;
    },
  };
}

function createVersionListClient(rows: Array<Record<string, unknown>>) {
  return {
    from(table: string) {
      assert.equal(table, 'document_versions');

      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return Promise.resolve({
            data: rows,
            error: null,
          });
        },
      };
    },
  };
}

test('compileSectionsToContent joins normalized section text without empty fragments', () => {
  const content = compileSectionsToContent([
    {
      id: 'sec-1',
      heading: '一、工作目标',
      body: '请按要求准备材料。',
    },
    {
      id: 'sec-2',
      heading: '',
      body: '第二段正文',
    },
  ]);

  assert.equal(content, '一、工作目标\n请按要求准备材料。\n\n第二段正文');
});

test('saveDraftState shapes insert payloads and normalizes sparse stored draft rows', async () => {
  const sparseDraft = buildSparseDraftFixture();
  const insertHarness = createDraftInsertClient(sparseDraft);

  const saved = await saveDraftState(insertHarness.client as never, {
    userId: '11111111-1111-4111-8111-111111111111',
    draftId: null,
    docType: 'notice',
    provider: 'claude',
    baseFields: {
      title: '关于开展专项检查的通知',
      recipient: '各相关单位',
      content: '请按要求准备材料。',
      issuer: '办公室',
      date: '2026-03-26',
      contact_name: '张三',
      contact_phone: '12345678',
      attachments: ['附件1'],
    },
    workflow: {
      workflow_stage: 'intake',
      collected_facts: { topic: '专项检查' },
      missing_fields: [],
      planning: null,
      outline: null,
      sections: [],
      active_rule_ids: [],
      active_reference_ids: [],
      version_count: 0,
      generated_title: null,
      generated_content: null,
    },
  });

  assert.deepEqual(insertHarness.getInsertedPayload(), {
    user_id: '11111111-1111-4111-8111-111111111111',
    doc_type: 'notice',
    provider: 'claude',
    title: '关于开展专项检查的通知',
    recipient: '各相关单位',
    content: '请按要求准备材料。',
    issuer: '办公室',
    date: '2026-03-26',
    contact_name: '张三',
    contact_phone: '12345678',
    attachments: ['附件1'],
    workflow_stage: 'intake',
    collected_facts: { topic: '专项检查' },
    missing_fields: [],
    planning: null,
    outline: null,
    sections: [],
    active_rule_ids: [],
    active_reference_ids: [],
    version_count: 0,
    generated_title: null,
    generated_content: null,
    updated_at: sparseDraft.updated_at,
  });

  assert.deepEqual(saved.attachments, []);
  assert.deepEqual(saved.collected_facts, {});
  assert.deepEqual(saved.sections, []);
  assert.deepEqual(saved.active_rule_ids, []);
  assert.deepEqual(saved.active_reference_ids, []);
  assert.equal(saved.generated_title, null);
  assert.equal(saved.generated_content, null);
});

test('listVersionsForDraft normalizes sparse version rows into stable arrays', async () => {
  const versions = await listVersionsForDraft(
    createVersionListClient([buildSparseVersionFixture(), buildDraftFixture()]) as never,
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222'
  );

  assert.equal(versions.length, 2);
  assert.deepEqual(versions[0].sections, []);
  assert.deepEqual(versions[1].sections, buildDraftFixture().sections);
});
