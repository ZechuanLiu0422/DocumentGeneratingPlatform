import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { createVersionSnapshot, getDraftById, saveDraftState } from '@/lib/collaborative-store';
import { outlineConfirmSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const context = createRequestContext(request, '/api/ai/outline/confirm');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;
    const body = outlineConfirmSchema.parse(await request.json());
    const draft = await getDraftById(supabase, user.id, body.draftId);

    await saveDraftState(supabase, {
      userId: user.id,
      draftId: draft.id,
      docType: draft.doc_type,
      provider: draft.provider,
      baseFields: {
        title: body.acceptedOutline.title || draft.title || '',
        recipient: draft.recipient || '',
        content: draft.content || '',
        issuer: draft.issuer || '',
        date: draft.date || '',
        contact_name: draft.contact_name || '',
        contact_phone: draft.contact_phone || '',
        attachments: draft.attachments,
      },
      workflow: {
        workflow_stage: 'draft',
        collected_facts: draft.collected_facts,
        missing_fields: draft.missing_fields,
        planning: draft.planning,
        outline: {
          titleOptions: body.acceptedOutline.titleOptions,
          sections: body.acceptedOutline.sections,
          risks: body.acceptedOutline.risks,
          outlineVersion: body.outlineVersion,
          confirmed: true,
        },
        sections: [],
        active_rule_ids: draft.active_rule_ids,
        active_reference_ids: draft.active_reference_ids,
        generated_title: body.acceptedOutline.title || draft.generated_title || '',
        generated_content: '',
        version_count: draft.version_count,
      },
    });

    await createVersionSnapshot(supabase, {
      userId: user.id,
      draftId: draft.id,
      stage: 'outline_confirmed',
      title: body.acceptedOutline.title || draft.title,
      content: null,
      sections: [],
      changeSummary: '已确认提纲',
    });

    return ok(context, { success: true });
  } catch (error) {
    return handleRouteError(error, context);
  }
}
