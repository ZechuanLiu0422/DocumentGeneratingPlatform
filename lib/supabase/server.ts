import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig } from '@/lib/env';

export function createServerSupabaseClient(response?: NextResponse) {
  const cookieStore = cookies();
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response?.cookies.set(name, value, options);
          });
        } catch {
          cookiesToSet.forEach(({ name, value, options }) => {
            response?.cookies.set(name, value, options);
          });
        }
      },
    },
  });
}
