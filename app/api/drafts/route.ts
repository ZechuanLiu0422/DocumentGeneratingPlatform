import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { DRAFT_RECORD_SELECT, buildDraftWritePayload, mergeProtectedDraftFields, toDraftResponse } from '@/lib/draft-save';
import { getDraftById } from '@/lib/collaborative-store';
import { deleteIdSchema, draftSaveSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/drafts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('drafts')
      .select(DRAFT_RECORD_SELECT)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    const drafts = (data || []).map((draft) => toDraftResponse(draft));

    return ok(context, { drafts });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/drafts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = draftSaveSchema.parse(await request.json());
    const basePayload = {
      ...buildDraftWritePayload({
        userId: user.id,
        draft: body,
      }),
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const existingDraft = await getDraftById(supabase, user.id, body.id);
      const payload = mergeProtectedDraftFields({
        existingDraft,
        editablePayload: basePayload,
      });
      const { data, error } = await supabase
        .from('drafts')
        .update(payload)
        .eq('id', body.id)
        .eq('user_id', user.id)
        .select(DRAFT_RECORD_SELECT)
        .single();

      if (error || !data) {
        throw error;
      }

      return ok(context, { success: true, draftId: body.id, draft: toDraftResponse(data) });
    }

    const { data, error } = await supabase.from('drafts').insert(basePayload).select(DRAFT_RECORD_SELECT).single();

    if (error || !data) {
      throw error;
    }

    return ok(context, { success: true, draftId: data.id, draft: toDraftResponse(data) }, 201);
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestContext(request, '/api/drafts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = deleteIdSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { error } = await supabase.from('drafts').delete().eq('id', params.id).eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
