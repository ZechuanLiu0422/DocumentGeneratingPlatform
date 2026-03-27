alter table public.drafts
add column if not exists pending_change jsonb;
