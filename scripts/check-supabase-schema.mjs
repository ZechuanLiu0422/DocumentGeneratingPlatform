import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY。');
  process.exit(1);
}

const client = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const checks = [
  {
    label: 'drafts collaborative columns',
    migration: '20260321110000_collaborative_writing_upgrade.sql',
    run: () =>
      client
        .from('drafts')
        .select(
          'id,workflow_stage,collected_facts,missing_fields,outline,sections,active_rule_ids,active_reference_ids,version_count,generated_title,generated_content'
        )
        .limit(1),
  },
  {
    label: 'drafts planning column',
    migration: '20260323150000_outline_planning_upgrade.sql',
    run: () => client.from('drafts').select('id,planning').limit(1),
  },
  {
    label: 'writing_rules table',
    migration: '20260321110000_collaborative_writing_upgrade.sql',
    run: () => client.from('writing_rules').select('id').limit(1),
  },
  {
    label: 'reference_assets table',
    migration: '20260321110000_collaborative_writing_upgrade.sql',
    run: () => client.from('reference_assets').select('id').limit(1),
  },
  {
    label: 'document_versions table',
    migration: '20260321110000_collaborative_writing_upgrade.sql',
    run: () => client.from('document_versions').select('id').limit(1),
  },
];

let failed = false;

console.log(`检查 Supabase schema: ${url}`);

for (const check of checks) {
  const { error } = await check.run();

  if (error) {
    failed = true;
    console.log(`✗ ${check.label}`);
    console.log(`  可能缺少: ${check.migration}`);
    console.log(`  错误: ${error.message}`);
  } else {
    console.log(`✓ ${check.label}`);
  }
}

if (failed) {
  console.log('\nSchema 检查未通过。请先在当前 Supabase 项目执行全部 migrations，再重试。');
  process.exit(1);
}

console.log('\nSchema 检查通过，当前 Supabase 结构已满足协作写作与结构共创流程。');
