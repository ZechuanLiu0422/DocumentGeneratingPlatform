import { NextResponse } from 'next/server';
import { AppError } from '@/lib/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function requireRouteUser(response = NextResponse.next()) {
  const supabase = createServerSupabaseClient(response);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AppError(401, '登录状态已失效，请重新登录', 'UNAUTHORIZED');
  }

  return { supabase, user, response };
}
