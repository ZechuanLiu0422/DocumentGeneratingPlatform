import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/api';

export type DistributedRateLimitWindow = {
  count: number;
  resetAt: string;
};

export type DistributedRateLimitIncrementPayload = {
  userId: string;
  action: string;
  windowStart: string;
  windowMs: number;
  now?: Date;
};

export type DistributedRateLimitStore = {
  incrementWindow(payload: DistributedRateLimitIncrementPayload): Promise<DistributedRateLimitWindow>;
};

export function getRateLimitWindowStart(now: Date, windowMs: number) {
  const epoch = now.getTime();
  const windowStart = epoch - (epoch % windowMs);
  return new Date(windowStart).toISOString();
}

export function createSupabaseRateLimitStore(supabase: SupabaseClient): DistributedRateLimitStore {
  return {
    async incrementWindow(payload) {
      const { data, error } = await supabase.rpc('consume_rate_limit_window', {
        p_user_id: payload.userId,
        p_action: payload.action,
        p_window_start: payload.windowStart,
        p_window_ms: payload.windowMs,
      });

      if (error) {
        throw new AppError(500, '频率限制检查失败，请稍后重试', 'RATE_LIMIT_CHECK_FAILED');
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || typeof row.request_count !== 'number' || typeof row.window_end !== 'string') {
        throw new AppError(500, '频率限制检查失败，请稍后重试', 'RATE_LIMIT_CHECK_FAILED');
      }

      return {
        count: row.request_count,
        resetAt: row.window_end,
      };
    },
  };
}

export async function enforceDistributedRateLimit(payload: {
  store?: DistributedRateLimitStore;
  supabase?: SupabaseClient;
  userId: string;
  action: string;
  limit: number;
  windowMs: number;
  message: string;
  now?: Date;
}) {
  const now = payload.now ?? new Date();
  const store =
    payload.store ??
    (payload.supabase ? createSupabaseRateLimitStore(payload.supabase) : null);

  if (!store) {
    throw new AppError(500, '缺少分布式频率限制存储实现', 'RATE_LIMIT_STORE_REQUIRED');
  }

  const windowStart = getRateLimitWindowStart(now, payload.windowMs);
  const currentWindow = await store.incrementWindow({
    userId: payload.userId,
    action: payload.action,
    windowStart,
    windowMs: payload.windowMs,
    now,
  });

  if (currentWindow.count > payload.limit) {
    throw new AppError(429, payload.message, 'RATE_LIMITED');
  }

  return currentWindow;
}
