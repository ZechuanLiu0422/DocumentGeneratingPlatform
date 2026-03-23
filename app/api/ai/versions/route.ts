import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { getDraftById, listVersionsForDraft } from '@/lib/collaborative-store';
import { versionQuerySchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/versions');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const params = versionQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

    await getDraftById(supabase, user.id, params.draftId);
    const versions = await listVersionsForDraft(supabase, user.id, params.draftId);

    return ok(context, { versions });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
