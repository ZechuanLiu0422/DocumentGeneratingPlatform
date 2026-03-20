#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const [, , email, displayNameArg, passwordArg] = process.argv;

if (!email) {
  console.error('用法: npm run invite:user -- user@example.com [display_name] [temporary_password]');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const displayName = displayNameArg || email.split('@')[0];
const password = passwordArg || `Temp#${Math.random().toString(36).slice(2, 10)}A1`;

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      must_change_password: true,
    },
  });

  if (error) {
    console.error(`创建用户失败: ${error.message}`);
    process.exit(1);
  }

  console.log('用户创建成功');
  console.log(`- id: ${data.user.id}`);
  console.log(`- email: ${data.user.email}`);
  console.log(`- display_name: ${displayName}`);
  console.log(`- temporary_password: ${password}`);
  console.log('- must_change_password: true');
  console.log('该账号首次登录后会被强制跳转到修改密码页面。');
}

main().catch((error) => {
  console.error(`执行失败: ${error.message}`);
  process.exit(1);
});
