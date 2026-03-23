alter table public.drafts
  add column if not exists workflow_stage text not null default 'intake' check (workflow_stage in ('intake', 'outline', 'draft', 'review', 'done')),
  add column if not exists collected_facts jsonb not null default '{}'::jsonb,
  add column if not exists missing_fields jsonb not null default '[]'::jsonb,
  add column if not exists outline jsonb,
  add column if not exists sections jsonb not null default '[]'::jsonb,
  add column if not exists active_rule_ids jsonb not null default '[]'::jsonb,
  add column if not exists active_reference_ids jsonb not null default '[]'::jsonb,
  add column if not exists version_count integer not null default 0,
  add column if not exists generated_title text,
  add column if not exists generated_content text;

create table if not exists public.writing_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text check (doc_type in ('notice', 'letter', 'request', 'report')),
  name text not null,
  rule_type text not null check (rule_type in ('required_phrase', 'forbidden_phrase', 'tone_rule', 'structure_rule', 'ending_rule', 'organization_fact')),
  content text not null,
  priority integer not null default 50,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  doc_type text check (doc_type in ('notice', 'letter', 'request', 'report')),
  file_name text not null,
  file_type text not null,
  content text not null,
  analysis jsonb,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('outline_confirmed', 'draft_generated', 'revision_applied', 'review_applied', 'exported', 'restored')),
  title text,
  content text,
  sections jsonb not null default '[]'::jsonb,
  change_summary text,
  created_at timestamptz not null default now()
);

alter table public.usage_events
  drop constraint if exists usage_events_action_check;

alter table public.usage_events
  add constraint usage_events_action_check
  check (action in ('upload_reference', 'analyze_reference', 'polish', 'refine', 'generate', 'intake', 'outline', 'draft', 'review'));

create index if not exists idx_writing_rules_user_id_doc_type on public.writing_rules (user_id, doc_type, created_at desc);
create index if not exists idx_reference_assets_user_id_doc_type on public.reference_assets (user_id, doc_type, created_at desc);
create index if not exists idx_document_versions_draft_id_created_at on public.document_versions (draft_id, created_at desc);

drop trigger if exists handle_writing_rules_updated_at on public.writing_rules;
create trigger handle_writing_rules_updated_at
before update on public.writing_rules
for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_reference_assets_updated_at on public.reference_assets;
create trigger handle_reference_assets_updated_at
before update on public.reference_assets
for each row execute procedure public.handle_updated_at();

alter table public.writing_rules enable row level security;
alter table public.reference_assets enable row level security;
alter table public.document_versions enable row level security;

create policy "writing_rules_own_all" on public.writing_rules
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reference_assets_own_all" on public.reference_assets
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "document_versions_own_all" on public.document_versions
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
