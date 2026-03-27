alter table public.drafts
  add column if not exists review_state jsonb;

alter table public.document_versions
  add column if not exists review_state jsonb;
