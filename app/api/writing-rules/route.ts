import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { deleteIdSchema, writingRuleSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/writing-rules');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('writing_rules')
      .select('id, doc_type, name, rule_type, content, priority, enabled, created_at, updated_at')
      .eq('user_id', user.id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ok(context, { rules: data || [] });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/writing-rules');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = writingRuleSchema.parse(await request.json());
    const payload = {
      user_id: user.id,
      doc_type: body.docType,
      name: body.name,
      rule_type: body.ruleType,
      content: body.content,
      priority: body.priority,
      enabled: body.enabled,
    };

    if (body.id) {
      const { error } = await supabase.from('writing_rules').update(payload).eq('id', body.id).eq('user_id', user.id);
      if (error) {
        throw error;
      }
      return ok(context, { success: true, ruleId: body.id });
    }

    const { data, error } = await supabase.from('writing_rules').insert(payload).select('id').single();
    if (error) {
      throw error;
    }

    return ok(context, { success: true, ruleId: data.id }, 201);
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestContext(request, '/api/writing-rules');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = deleteIdSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { error } = await supabase.from('writing_rules').delete().eq('id', params.id).eq('user_id', user.id);
    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
