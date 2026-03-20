create extension if not exists pgcrypto;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('notice', 'letter', 'request', 'report')),
  title text not null,
  recipient text not null,
  user_input text not null,
  generated_content text not null,
  ai_provider text not null,
  issuer text not null,
  doc_date date not null,
  attachments jsonb not null default '[]'::jsonb,
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null check (doc_type in ('notice', 'letter', 'request', 'report')),
  title text,
  recipient text,
  content text,
  issuer text,
  date text,
  provider text not null check (provider in ('claude', 'openai', 'doubao', 'glm')),
  contact_name text,
  contact_phone text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.common_phrases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('recipient', 'issuer')),
  phrase text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('upload_reference', 'analyze_reference', 'polish', 'refine', 'generate')),
  provider text,
  status text not null check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_documents_user_id_created_at on public.documents (user_id, created_at desc);
create index if not exists idx_drafts_user_id_updated_at on public.drafts (user_id, updated_at desc);
create index if not exists idx_contacts_user_id_created_at on public.contacts (user_id, created_at desc);
create index if not exists idx_common_phrases_user_id_type on public.common_phrases (user_id, type, created_at desc);
create index if not exists idx_usage_events_user_id_action_created_at on public.usage_events (user_id, action, created_at desc);

drop trigger if exists handle_profiles_updated_at on public.profiles;
create trigger handle_profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_drafts_updated_at on public.drafts;
create trigger handle_drafts_updated_at
before update on public.drafts
for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_contacts_updated_at on public.contacts;
create trigger handle_contacts_updated_at
before update on public.contacts
for each row execute procedure public.handle_updated_at();

drop trigger if exists handle_common_phrases_updated_at on public.common_phrases;
create trigger handle_common_phrases_updated_at
before update on public.common_phrases
for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.drafts enable row level security;
alter table public.contacts enable row level security;
alter table public.common_phrases enable row level security;
alter table public.usage_events enable row level security;

create policy "profiles_select_own" on public.profiles
for select to authenticated
using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "documents_own_all" on public.documents
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "drafts_own_all" on public.drafts
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "contacts_own_all" on public.contacts
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "common_phrases_own_all" on public.common_phrases
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "usage_events_own_all" on public.usage_events
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
