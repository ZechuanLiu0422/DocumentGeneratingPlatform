alter table public.drafts
  drop constraint if exists drafts_workflow_stage_check;

alter table public.drafts
  add column if not exists planning jsonb,
  add constraint drafts_workflow_stage_check
  check (workflow_stage in ('intake', 'planning', 'outline', 'draft', 'review', 'done'));

alter table public.usage_events
  drop constraint if exists usage_events_action_check;

alter table public.usage_events
  add constraint usage_events_action_check
  check (action in ('upload_reference', 'analyze_reference', 'polish', 'refine', 'generate', 'intake', 'planning', 'outline', 'draft', 'review'));
