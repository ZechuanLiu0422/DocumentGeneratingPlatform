import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { contactSchema, deleteIdSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/contacts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, phone, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ok(context, { contacts: data || [] });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/contacts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = contactSchema.parse(await request.json());

    const { error } = await supabase.from('contacts').insert({
      user_id: user.id,
      name: body.name,
      phone: body.phone,
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
  const context = createRequestContext(request, '/api/contacts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = deleteIdSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { error } = await supabase.from('contacts').delete().eq('id', params.id).eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
