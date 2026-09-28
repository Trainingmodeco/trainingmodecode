-- Auto-purge expired haunt codes.
--
-- A haunt code stops opening after 7 days (get_haunt checks expires_at); this
-- makes sure the stored ghost behind it is actually deleted too, within the
-- hour. The privacy policy states this, so the job must stay scheduled.

create extension if not exists pg_cron;

create or replace function public.purge_expired_haunts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.ghost_haunts where expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Server-side only: no client role may call it.
revoke all on function public.purge_expired_haunts() from public, anon, authenticated;

-- Hourly, at :17 (off the top of the hour). Scheduling by name replaces any
-- earlier job of the same name, so re-running this is safe.
select cron.schedule('purge-expired-haunts', '17 * * * *', $$select public.purge_expired_haunts()$$);
