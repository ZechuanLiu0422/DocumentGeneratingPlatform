create table if not exists public.export_artifacts (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null unique references public.draft_operations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.drafts(id) on delete set null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists export_artifacts_user_id_idx on public.export_artifacts(user_id, created_at desc);
create index if not exists export_artifacts_draft_id_idx on public.export_artifacts(draft_id, created_at desc);

alter table public.export_artifacts enable row level security;

drop policy if exists "Users can read own export artifacts" on public.export_artifacts;
create policy "Users can read own export artifacts"
  on public.export_artifacts
  for select
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;
