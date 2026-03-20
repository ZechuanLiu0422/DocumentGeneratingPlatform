import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { deleteIdSchema, phraseSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/common-phrases');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('common_phrases')
      .select('id, type, phrase, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ok(context, { phrases: data || [] });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/common-phrases');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = phraseSchema.parse(await request.json());

    const { error } = await supabase.from('common_phrases').insert({
      user_id: user.id,
      type: body.type,
      phrase: body.phrase,
    });

    if (error) {
      throw error;
    }

    return ok(context, { success: true }, 201);
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestContext(request, '/api/common-phrases');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = deleteIdSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { error } = await supabase
      .from('common_phrases')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
