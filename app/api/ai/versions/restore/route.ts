import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { restoreVersionSnapshot } from '@/lib/collaborative-store';
import { versionRestoreSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/versions/restore');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = versionRestoreSchema.parse(await request.json());
    const result = await restoreVersionSnapshot(supabase, user.id, body.draftId, body.versionId);

    return ok(context, {
      success: true,
      ...result,
    });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
