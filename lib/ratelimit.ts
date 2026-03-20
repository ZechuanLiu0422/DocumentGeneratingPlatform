import { AppError } from '@/lib/api';

type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __documentRateLimitStore: Map<string, Bucket> | undefined;
}

const rateLimitStore = globalThis.__documentRateLimitStore ?? new Map<string, Bucket>();

if (!globalThis.__documentRateLimitStore) {
  globalThis.__documentRateLimitStore = rateLimitStore;
}

export function enforceRateLimit(key: string, limit: number, windowMs: number, message: string) {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new AppError(429, message, 'RATE_LIMITED');
  }

  current.count += 1;
  rateLimitStore.set(key, current);
}
