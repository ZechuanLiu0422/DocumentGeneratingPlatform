import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/api';

export const DAILY_QUOTAS = {
  upload_reference: 20,
  analyze_reference: 20,
  polish: 50,
  refine: 80,
  generate: 30,
} as const;

export type UsageAction = keyof typeof DAILY_QUOTAS;

function startOfDayIso() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

export async function enforceDailyQuota(
  supabase: SupabaseClient,
  userId: string,
  action: UsageAction
) {
  const { count, error } = await supabase
    .from('usage_events')
    .select('*', { head: true, count: 'exact' })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', startOfDayIso());

  if (error) {
    throw new AppError(500, '配额检查失败，请稍后重试', 'QUOTA_CHECK_FAILED');
  }

  if ((count || 0) >= DAILY_QUOTAS[action]) {
    throw new AppError(429, '今日操作额度已达到上限，请明天再试', 'DAILY_QUOTA_EXCEEDED');
  }
}

export async function recordUsageEvent(
  supabase: SupabaseClient,
  payload: {
    userId: string;
    action: UsageAction;
    provider?: string;
    status: 'success' | 'failed';
  }
) {
  await supabase.from('usage_events').insert({
    user_id: payload.userId,
    action: payload.action,
    provider: payload.provider || null,
    status: payload.status,
  });
}
