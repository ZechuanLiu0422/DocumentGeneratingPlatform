create table if not exists public.rate_limit_windows (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, action, window_start),
  unique (user_id, action, window_start)
);

create index if not exists idx_rate_limit_windows_window_end
  on public.rate_limit_windows (window_end);

create index if not exists idx_rate_limit_windows_user_action_window_end
  on public.rate_limit_windows (user_id, action, window_end desc);

create or replace function public.consume_rate_limit_window(
  p_user_id uuid,
  p_action text,
  p_window_start timestamptz,
  p_window_ms integer
)
returns table (request_count integer, window_end timestamptz)
language plpgsql
as $$
declare
  computed_window_end timestamptz := p_window_start + make_interval(secs => p_window_ms::numeric / 1000);
begin
  insert into public.rate_limit_windows (
    user_id,
    action,
    window_start,
    window_end,
    request_count
  )
  values (
    p_user_id,
    p_action,
    p_window_start,
    computed_window_end,
    1
  )
  on conflict (user_id, action, window_start)
  do update
    set request_count = public.rate_limit_windows.request_count + 1,
        window_end = excluded.window_end,
        updated_at = now();

  return query
  select rlw.request_count, rlw.window_end
  from public.rate_limit_windows as rlw
  where rlw.user_id = p_user_id
    and rlw.action = p_action
    and rlw.window_start = p_window_start;
end;
$$;
