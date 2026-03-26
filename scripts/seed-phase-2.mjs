#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const PHASE_02_FIXTURES = {
  users: {
    alice: {
      key: 'alice',
      id: '7e7246cb-31ff-4e80-9204-d6f98b2d4c11',
      email: 'phase2.alice@example.com',
      password: 'Phase2!Alice123',
      displayName: 'Phase 2 Alice',
    },
    bob: {
      key: 'bob',
      id: 'b3b52acf-1166-4f91-8669-2cbf37c26120',
      email: 'phase2.bob@example.com',
      password: 'Phase2!Bob123',
      displayName: 'Phase 2 Bob',
    },
  },
  drafts: {
    alice: '8e274be8-48e6-4065-9b9b-6f8435b6878b',
    bob: '960538b0-f70b-4c5b-9a77-4b27d8e7e02f',
  },
  documents: {
    alice: 'dc6645c8-3a6b-4ba9-9a80-ece9efe94ae7',
    bob: '9d8c63e3-07fc-4523-8dd1-7e31a4a775d0',
  },
  documentVersions: {
    alice: 'e58e3c57-dcac-4d93-8e83-f7187fd77f61',
    bob: '5c45f91a-ecde-428a-8b70-1fd2972a7f4c',
  },
  writingRules: {
    alice: 'e52731f0-32ea-4d4c-a6b5-8cf2d4e0c8aa',
    bob: 'd5d98f03-42fc-455a-8b0f-f9940dbd762b',
  },
  referenceAssets: {
    alice: 'f7d6f3a2-8106-4cc0-ad45-ce5e0fc50f64',
    bob: 'd020a2f8-6c05-4572-a297-086da5f4684f',
  },
  contacts: {
    alice: 'eb2f00c0-5fca-4e4a-9751-c5997c3d4b17',
    bob: '467244f3-eb1d-4881-88e1-901e1823b3ef',
  },
  commonPhrases: {
    alice: 'b67a3575-3444-4f22-a85a-e88fd36af631',
    bob: 'b9d2f1f3-05b8-4329-b0d7-d8ab5df0a6fe',
  },
  usageEvents: {
    alice: '31ff6d7f-e434-4992-b749-08a857f3726f',
    bob: '54cd543b-5d56-4ae4-9368-0d099be48c66',
  },
};

let cachedLocalSupabaseEnv = null;

function parseEnvOutput(output) {
  return Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1) {
          return [line, ''];
        }

        const value = line.slice(separatorIndex + 1);
        const normalizedValue =
          value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;

        return [line.slice(0, separatorIndex), normalizedValue];
      })
  );
}

export function getLocalSupabaseEnv() {
  if (cachedLocalSupabaseEnv) {
    return cachedLocalSupabaseEnv;
  }

  try {
    const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = parseEnvOutput(output);
    const url = parsed.API_URL;
    const anonKey = parsed.ANON_KEY;
    const serviceRoleKey = parsed.SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceRoleKey) {
      throw new Error('缺少 API_URL、ANON_KEY 或 SERVICE_ROLE_KEY');
    }

    cachedLocalSupabaseEnv = {
      url,
      anonKey,
      serviceRoleKey,
    };
    return cachedLocalSupabaseEnv;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法读取本地 Supabase 状态。请先启动 Docker Desktop 并运行本地 Supabase。原始错误: ${message}`
    );
  }
}

export function createSeedAdminClient() {
  const { url, serviceRoleKey } = getLocalSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function ensureUser(admin, fixture) {
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) {
    throw new Error(`列出本地 Supabase 用户失败: ${error.message}`);
  }

  const existing = data.users.find((candidate) => candidate.email === fixture.email);

  if (!existing) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      id: fixture.id,
      email: fixture.email,
      password: fixture.password,
      email_confirm: true,
      user_metadata: {
        display_name: fixture.displayName,
        must_change_password: false,
      },
    });

    if (createError) {
      throw new Error(`创建种子用户 ${fixture.email} 失败: ${createError.message}`);
    }

    return created.user;
  }

  const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    email: fixture.email,
    password: fixture.password,
    user_metadata: {
      ...(existing.user_metadata || {}),
      display_name: fixture.displayName,
      must_change_password: false,
    },
    email_confirm: true,
  });

  if (updateError) {
    throw new Error(`更新种子用户 ${fixture.email} 失败: ${updateError.message}`);
  }

  return updated.user;
}

async function upsertSingle(admin, table, row, conflictTarget = 'id') {
  const { error } = await admin.from(table).upsert(row, { onConflict: conflictTarget });
  if (error) {
    throw new Error(`写入 ${table} 种子数据失败: ${error.message}`);
  }
}

function buildDraftRow(userKey, userId) {
  const otherUserKey = userKey === 'alice' ? 'bob' : 'alice';

  return {
    id: PHASE_02_FIXTURES.drafts[userKey],
    user_id: userId,
    doc_type: 'notice',
    title: `${userKey === 'alice' ? 'Alice' : 'Bob'} 的阶段 2 草稿`,
    recipient: '各相关单位',
    content: `${userKey} seeded draft body`,
    issuer: '办公室',
    date: '2026-03-26',
    provider: 'claude',
    contact_name: `${userKey} 联系人`,
    contact_phone: '12345678',
    attachments: [{ name: `${userKey}-attachment.txt` }],
    workflow_stage: 'review',
    collected_facts: {
      owner: userKey,
      scope: 'SAFE-02',
      blocked_user: otherUserKey,
    },
    missing_fields: [],
    planning: {
      selectedPlanId: `plan-${userKey}`,
      confirmed: true,
      sections: [
        {
          id: `plan-${userKey}-1`,
          headingDraft: `一、${userKey} 目标`,
          purpose: '验证多用户草稿隔离',
          topicSummary: `${userKey} 的规划摘要`,
          orderReason: '为 RLS 断言提供稳定数据',
        },
      ],
    },
    outline: {
      titleOptions: [`${userKey} outline title`],
      confirmed: true,
      sections: [
        {
          id: `outline-${userKey}-1`,
          heading: `一、${userKey} 提纲`,
          purpose: '验证读取隔离',
          keyPoints: [`${userKey} key point`],
          notes: '',
        },
      ],
    },
    sections: [
      {
        id: `section-${userKey}-1`,
        heading: `一、${userKey} 正文`,
        body: `${userKey} owned body`,
      },
    ],
    active_rule_ids: [PHASE_02_FIXTURES.writingRules[userKey]],
    active_reference_ids: [PHASE_02_FIXTURES.referenceAssets[userKey]],
    version_count: 1,
    generated_title: `${userKey} generated title`,
    generated_content: `${userKey} generated content`,
  };
}

function buildDocumentRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.documents[userKey],
    user_id: userId,
    doc_type: 'notice',
    title: `${userKey} document`,
    recipient: '各相关单位',
    user_input: `${userKey} source input`,
    generated_content: `${userKey} persisted document`,
    ai_provider: 'claude',
    issuer: '办公室',
    doc_date: '2026-03-26',
    attachments: [],
    contact_name: `${userKey} 联系人`,
    contact_phone: '12345678',
  };
}

function buildDocumentVersionRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.documentVersions[userKey],
    draft_id: PHASE_02_FIXTURES.drafts[userKey],
    user_id: userId,
    stage: 'draft_generated',
    title: `${userKey} version title`,
    content: `${userKey} version content`,
    sections: [
      {
        id: `version-${userKey}-section-1`,
        heading: `${userKey} version heading`,
        body: `${userKey} version body`,
      },
    ],
    change_summary: `${userKey} seeded version`,
  };
}

function buildWritingRuleRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.writingRules[userKey],
    user_id: userId,
    doc_type: 'notice',
    name: `${userKey} rule`,
    rule_type: 'structure_rule',
    content: `${userKey} must keep structure`,
    priority: 50,
    enabled: true,
  };
}

function buildReferenceAssetRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.referenceAssets[userKey],
    user_id: userId,
    name: `${userKey} reference`,
    doc_type: 'notice',
    file_name: `${userKey}.txt`,
    file_type: 'text/plain',
    content: `${userKey} reference content`,
    analysis: {
      summary: `${userKey} summary`,
    },
    is_favorite: userKey === 'alice',
  };
}

function buildContactRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.contacts[userKey],
    user_id: userId,
    name: `${userKey} contact`,
    phone: userKey === 'alice' ? '11111111' : '22222222',
  };
}

function buildCommonPhraseRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.commonPhrases[userKey],
    user_id: userId,
    type: 'issuer',
    phrase: `${userKey} 常用落款`,
  };
}

function buildUsageEventRow(userKey, userId) {
  return {
    id: PHASE_02_FIXTURES.usageEvents[userKey],
    user_id: userId,
    action: 'planning',
    provider: 'claude',
    status: 'success',
  };
}

export async function seedPhase02Fixtures() {
  const admin = createSeedAdminClient();
  const seededUsers = {};

  for (const [userKey, fixture] of Object.entries(PHASE_02_FIXTURES.users)) {
    const user = await ensureUser(admin, fixture);
    seededUsers[userKey] = {
      ...fixture,
      id: user.id,
    };
  }

  for (const [userKey, user] of Object.entries(seededUsers)) {
    await upsertSingle(admin, 'drafts', buildDraftRow(userKey, user.id));
    await upsertSingle(admin, 'documents', buildDocumentRow(userKey, user.id));
    await upsertSingle(admin, 'document_versions', buildDocumentVersionRow(userKey, user.id));
    await upsertSingle(admin, 'writing_rules', buildWritingRuleRow(userKey, user.id));
    await upsertSingle(admin, 'reference_assets', buildReferenceAssetRow(userKey, user.id));
    await upsertSingle(admin, 'contacts', buildContactRow(userKey, user.id));
    await upsertSingle(admin, 'common_phrases', buildCommonPhraseRow(userKey, user.id));
    await upsertSingle(admin, 'usage_events', buildUsageEventRow(userKey, user.id));
  }

  return {
    users: seededUsers,
    fixtures: PHASE_02_FIXTURES,
  };
}

async function main() {
  const seeded = await seedPhase02Fixtures();

  console.log('Phase 02 fixtures seeded successfully.');
  for (const user of Object.values(seeded.users)) {
    console.log(`- ${user.email} (${user.id})`);
  }
  console.log(`- drafts: ${Object.values(PHASE_02_FIXTURES.drafts).join(', ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`Phase 02 seed failed: ${error.message}`);
    process.exit(1);
  });
}
