import { NextRequest } from 'next/server';
import { createRequestContext, handleRouteError, ok } from '@/lib/api';
import { requireRouteUser } from '@/lib/auth';
import { deleteIdSchema, draftSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  const context = createRequestContext(request, '/api/drafts');

  try {
    const { supabase, user } = await requireRouteUser();
    context.userId = user.id;

    const { data, error } = await supabase
      .from('drafts')
      .select(
        'id, doc_type, title, recipient, content, issuer, date, provider, contact_name, contact_phone, attachments, workflow_stage, collected_facts, missing_fields, planning, outline, sections, active_rule_ids, active_reference_ids, version_count, generated_title, generated_content, updated_at'
      )
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    const drafts = (data || []).map((draft) => ({
      ...draft,
      contactName: draft.contact_name,
      contactPhone: draft.contact_phone,
      workflowStage: draft.workflow_stage,
      collectedFacts: draft.collected_facts || {},
      missingFields: draft.missing_fields || [],
      activeRuleIds: draft.active_rule_ids || [],
      activeReferenceIds: draft.active_reference_ids || [],
      versionCount: draft.version_count || 0,
      generatedTitle: draft.generated_title || '',
      generatedContent: draft.generated_content || '',
    }));

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
    const body = draftSchema.parse(await request.json());
    const payload = {
      user_id: user.id,
      doc_type: body.docType,
      title: body.title || null,
      recipient: body.recipient || null,
      content: body.content || null,
      issuer: body.issuer || null,
      date: body.date || null,
      provider: body.provider,
      contact_name: body.contactName || null,
      contact_phone: body.contactPhone || null,
      attachments: body.attachments,
      workflow_stage: body.workflowStage,
      collected_facts: body.collectedFacts,
      missing_fields: body.missingFields,
      planning: body.planning,
      outline: body.outline,
      sections: body.sections,
      active_rule_ids: body.activeRuleIds,
      active_reference_ids: body.activeReferenceIds,
      version_count: body.versionCount,
      generated_title: body.generatedTitle || null,
      generated_content: body.generatedContent || null,
      updated_at: new Date().toISOString(),
    };

    if (body.id) {
      const { error } = await supabase.from('drafts').update(payload).eq('id', body.id).eq('user_id', user.id);
      if (error) {
        throw error;
      }
      return ok(context, { success: true, draftId: body.id });
    }

    const { data, error } = await supabase.from('drafts').insert(payload).select('id').single();

    if (error) {
      throw error;
    }

    return ok(context, { success: true, draftId: data.id }, 201);
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
