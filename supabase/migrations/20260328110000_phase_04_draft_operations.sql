create table if not exists public.draft_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid references public.drafts(id) on delete set null,
  operation_type text not null check (operation_type in ('draft_generate', 'draft_regenerate', 'draft_revise', 'review', 'export')),
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_code text,
  error_message text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts >= 1),
  lease_token text,
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_draft_operations_user_idempotency
  on public.draft_operations (user_id, idempotency_key);

create index if not exists idx_draft_operations_user_status_created
  on public.draft_operations (user_id, status, created_at desc);

create index if not exists idx_draft_operations_draft_created
  on public.draft_operations (draft_id, created_at desc);

create index if not exists idx_draft_operations_lease_expiry
  on public.draft_operations (status, lease_expires_at)
  where status in ('queued', 'running', 'failed', 'cancelled');

drop trigger if exists handle_draft_operations_updated_at on public.draft_operations;
create trigger handle_draft_operations_updated_at
before update on public.draft_operations
for each row execute procedure public.handle_updated_at();

alter table public.draft_operations enable row level security;

create policy "draft_operations_own_all" on public.draft_operations
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
