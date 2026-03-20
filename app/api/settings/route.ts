import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { getPublicProviderInfo } from '@/lib/providers';
import { profileSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/settings');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return ok(context, {
      profile: {
        id: user.id,
        email: data?.email || user.email,
        displayName: data?.display_name || user.user_metadata?.display_name || '',
        createdAt: data?.created_at || null,
      },
      supportedProviders: getPublicProviderInfo(),
    });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function PATCH(request: NextRequest) {
  const context = createRequestContext(request, '/api/settings');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = profileSchema.parse(await request.json());

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      display_name: body.displayName || null,
    });

    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
