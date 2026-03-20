import { NextRequest, NextResponse } from 'next/server';
import { createRequestContext, handleRouteError } from '@/lib/api';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/logout');

  try {
    const response = NextResponse.json({ success: true });
    const supabase = createServerSupabaseClient(response);
    await supabase.auth.signOut();
    return response;
  } catch (error) {
    return handleRouteError(error, context);
  }
}
