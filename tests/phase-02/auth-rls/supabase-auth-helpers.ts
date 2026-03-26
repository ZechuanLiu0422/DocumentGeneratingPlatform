import { createClient } from '@supabase/supabase-js';
import { PHASE_02_FIXTURES, getLocalSupabaseEnv } from '../../../scripts/seed-phase-2.mjs';

export function getPhase02SupabaseEnv() {
  const { url, anonKey } = getLocalSupabaseEnv();
  return { url, anonKey };
}

export function createAnonClient() {
  const { url, anonKey } = getPhase02SupabaseEnv();

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function signInSeededUser(userKey: keyof typeof PHASE_02_FIXTURES.users) {
  const anonClient = createAnonClient();
  const fixture = PHASE_02_FIXTURES.users[userKey];
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: fixture.email,
    password: fixture.password,
  });

  if (error) {
    throw new Error(`本地 Supabase 用户 ${fixture.email} 登录失败: ${error.message}`);
  }

  if (!data.session || !data.user) {
    throw new Error(`本地 Supabase 用户 ${fixture.email} 未返回有效 session。`);
  }

  return {
    fixture,
    session: data.session,
    user: data.user,
  };
}

export async function createSeededUserClient(userKey: keyof typeof PHASE_02_FIXTURES.users) {
  const { url, anonKey } = getPhase02SupabaseEnv();
  const signedIn = await signInSeededUser(userKey);
  const client = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${signedIn.session.access_token}`,
      },
    },
  });

  return {
    ...signedIn,
    client,
  };
}
