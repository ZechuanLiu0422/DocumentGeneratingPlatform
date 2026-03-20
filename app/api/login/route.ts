import { NextRequest, NextResponse } from 'next/server';
import { AppError, createRequestContext, handleRouteError } from '@/lib/api';
import { enforceRateLimit } from '@/lib/ratelimit';
import { loginSchema } from '@/lib/validation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/login');

  try {
    const body = loginSchema.parse(await request.json());
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const response = NextResponse.json({ success: true, redirectTo: '/' });

    enforceRateLimit(`login:${ip}:${body.email.toLowerCase()}`, 5, 5 * 60 * 1000, '登录失败次数过多，请稍后再试');

    const supabase = createServerSupabaseClient(response);
    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      throw new AppError(401, '邮箱或密码错误', 'INVALID_CREDENTIALS');
    }

    return response;
  } catch (error) {
    return handleRouteError(error, context);
  }
}
