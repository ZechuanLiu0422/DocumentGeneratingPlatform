import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { historyQuerySchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/history');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = historyQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    if (params.id) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, doc_type, title, recipient, generated_content, ai_provider, issuer, doc_date, created_at')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw error;
      }

      return ok(context, { document: data });
    }

    const { data, error } = await supabase
      .from('documents')
      .select('id, doc_type, title, recipient, issuer, doc_date, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return ok(context, { documents: data || [] });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
