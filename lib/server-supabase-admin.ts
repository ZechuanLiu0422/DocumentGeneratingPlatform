import { execFileSync } from 'node:child_process';
import { getEnv } from '@/lib/env';

let cachedLocalSupabaseStatusEnv: Record<string, string> | null | undefined;

function parseEnvOutput(output: string) {
  return Object.fromEntries(
    output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        const value = line.slice(separatorIndex + 1).trim();
        const normalizedValue = value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value;
        return [line.slice(0, separatorIndex), normalizedValue];
      })
  );
}

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(url?: string) {
  if (!url) {
    return false;
  }

  return /https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(url);
}

function isLocalSupabaseAdminKey(key?: string) {
  if (!key) {
    return false;
  }

  if (key.startsWith('sb_secret_')) {
    return true;
  }

  const payload = decodeJwtPayload(key);
  return payload?.iss === 'supabase-demo' && payload?.role === 'service_role';
}

function getLocalSupabaseStatusEnv() {
  if (cachedLocalSupabaseStatusEnv !== undefined) {
    return cachedLocalSupabaseStatusEnv;
  }

  try {
    const output = execFileSync(
      'npx',
      ['supabase', 'status', '-o', 'env', '--override-name', 'api.url=NEXT_PUBLIC_SUPABASE_URL'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }
    );

    cachedLocalSupabaseStatusEnv = parseEnvOutput(output);
  } catch {
    cachedLocalSupabaseStatusEnv = null;
  }

  return cachedLocalSupabaseStatusEnv;
}

export function getSupabaseAdminKey(url = getEnv('NEXT_PUBLIC_SUPABASE_URL')) {
  const envAdminKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('SUPABASE_SECRET_KEY');

  if (!isLocalSupabaseUrl(url)) {
    return envAdminKey;
  }

  if (isLocalSupabaseAdminKey(envAdminKey)) {
    return envAdminKey;
  }

  const localStatusEnv = getLocalSupabaseStatusEnv();
  return (
    localStatusEnv?.SERVICE_ROLE_KEY ||
    localStatusEnv?.SECRET_KEY ||
    envAdminKey ||
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}
