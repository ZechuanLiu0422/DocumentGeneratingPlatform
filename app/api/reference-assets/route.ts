import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { deleteIdSchema, referenceAssetSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/reference-assets');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('reference_assets')
      .select('id, name, doc_type, file_name, file_type, content, analysis, is_favorite, created_at, updated_at')
      .eq('user_id', user.id)
      .order('is_favorite', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ok(context, { assets: data || [] });
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/reference-assets');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = referenceAssetSchema.parse(await request.json());
    const payload = {
      user_id: user.id,
      name: body.name,
      doc_type: body.docType,
      file_name: body.fileName,
      file_type: body.fileType,
      content: body.content,
      analysis: body.analysis,
      is_favorite: body.isFavorite,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { error } = await supabase.from('reference_assets').update(payload).eq('id', body.id).eq('user_id', user.id);
      if (error) {
        throw error;
      }
      return ok(context, { success: true, assetId: body.id });
    }

    const { data, error } = await supabase.from('reference_assets').insert(payload).select('id').single();
    if (error) {
      throw error;
    }

    return ok(context, { success: true, assetId: data.id }, 201);
  } catch (error) {
    return handleRouteError(error, context);
  }
}

export async function DELETE(request: NextRequest) {
  const context = createRequestContext(request, '/api/reference-assets');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = deleteIdSchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    const { error } = await supabase.from('reference_assets').delete().eq('id', params.id).eq('user_id', user.id);
    if (error) {
      throw error;
    }

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
