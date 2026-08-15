-- Training Mode cloud progress sync.
-- One row per user holding a JSON snapshot of their local progress keys.
-- The app stays local-first: this is a backup/restore + cross-device layer.

create table if not exists public.progress_snapshots (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  data              jsonb       not null default '{}'::jsonb,
  -- the device's own "progress last changed" clock, used for last-write-wins
  client_changed_at timestamptz not null default now(),
  device_id         text,
  device_label      text,
  -- server-authoritative write time (trigger-maintained, clients cannot forge)
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

comment on table public.progress_snapshots is
  'Per-user snapshot of Training Mode local progress (XP, stats, campaign/camp progress, routines). Local-first backup + cross-device restore.';

-- Server sets updated_at on every write.
create or replace function public.tm_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists progress_snapshots_touch on public.progress_snapshots;
create trigger progress_snapshots_touch
  before insert or update on public.progress_snapshots
  for each row execute function public.tm_touch_updated_at();

-- RLS: a user can only ever see and write their own row.
alter table public.progress_snapshots enable row level security;

drop policy if exists "progress_snapshots_select_own" on public.progress_snapshots;
create policy "progress_snapshots_select_own"
  on public.progress_snapshots for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "progress_snapshots_insert_own" on public.progress_snapshots;
create policy "progress_snapshots_insert_own"
  on public.progress_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress_snapshots_update_own" on public.progress_snapshots;
create policy "progress_snapshots_update_own"
  on public.progress_snapshots for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "progress_snapshots_delete_own" on public.progress_snapshots;
create policy "progress_snapshots_delete_own"
  on public.progress_snapshots for delete
  to authenticated
  using ((select auth.uid()) = user_id);
