'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseConfig } from '@/lib/env';

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getSupabaseConfig();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
