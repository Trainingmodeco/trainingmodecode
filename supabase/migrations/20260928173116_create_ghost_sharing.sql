-- Ghost sharing (Simplify revamp, phase 6 follow-up).
--
-- Two tables, both reachable ONLY through the functions below: RLS is on
-- with no policies and table privileges are revoked, so no client can list,
-- browse, or edit rows directly.
--
-- ghost_haunts — short haunt codes. A signed-in player turns a verified
--   ghost into a 6-character code (HX7K2Q) that opens that exact session
--   for whoever has it. Codes expire after 7 days.
-- ghost_pool   — strangers' ghosts. Signed-in players' verified Fight Focus
--   ghosts, anonymised (no name, no ids), capped at 2 per player per week,
--   that other players can be challenged by ("A Warrior, LV 22"). Players
--   are in unless they switch it off in Profile, which also deletes theirs.

-- ── Haunt codes ─────────────────────────────────────────────────────────────
create table if not exists public.ghost_haunts (
  -- No I, O, 0 or 1: a code is read aloud and typed by hand.
  code       text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  ghost      jsonb not null check (jsonb_typeof(ghost) = 'object' and pg_column_size(ghost) < 32768),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
comment on table public.ghost_haunts is
  'Short haunt codes: a verified ghost a player sent to friends. Read by code only (get_haunt); 7-day expiry.';
create index if not exists ghost_haunts_owner_created on public.ghost_haunts (owner_id, created_at desc);

alter table public.ghost_haunts enable row level security;
revoke all on table public.ghost_haunts from anon, authenticated;

-- Make a code. Signed-in only (the rate limit needs a player to count), at
-- most 20 a day. Codes come from pgcrypto's secure random bytes; 32 symbols
-- divide 256 evenly, so every symbol is equally likely.
create or replace function public.create_haunt(p_ghost jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea;
  v_code   text;
  tries    int := 0;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_ghost) <> 'object' or coalesce((p_ghost ->> 'verified')::boolean, false) is not true
     or jsonb_typeof(p_ghost -> 'buckets') <> 'array' then
    raise exception 'not a verified ghost' using errcode = '22023';
  end if;
  if (select count(*) from public.ghost_haunts
      where owner_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many haunts today' using errcode = '54000';
  end if;
  loop
    bytes := extensions.gen_random_bytes(6);
    v_code := '';
    for i in 0..5 loop
      v_code := v_code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    begin
      insert into public.ghost_haunts (code, owner_id, ghost) values (v_code, uid, p_ghost);
      return v_code;
    exception when unique_violation then
      tries := tries + 1;
      if tries >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

-- Open a code. Anyone with the code, signed in or not; one row, never a list.
create or replace function public.get_haunt(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select ghost from public.ghost_haunts
  where code = upper(replace(p_code, '-', '')) and expires_at > now();
$$;

-- ── Strangers' ghosts ───────────────────────────────────────────────────────
create table if not exists public.ghost_pool (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  mode        text not null check (mode in ('fight_focus')),
  discipline  text not null check (discipline in ('Boxing', 'Kickboxing', 'Muay Thai', 'MMA')),
  owner_level int  not null check (owner_level between 1 and 999),
  ghost       jsonb not null check (jsonb_typeof(ghost) = 'object' and pg_column_size(ghost) < 32768),
  created_at  timestamptz not null default now()
);
comment on table public.ghost_pool is
  'Anonymised verified Fight Focus ghosts other players can be challenged by. Max 2 per player per week; removed when a player opts out.';
create index if not exists ghost_pool_pick on public.ghost_pool (mode, discipline, created_at desc);
create index if not exists ghost_pool_owner on public.ghost_pool (owner_id, created_at desc);

alter table public.ghost_pool enable row level security;
revoke all on table public.ghost_pool from anon, authenticated;

-- Add one of my ghosts. Returns false (not an error) once I've added 2 this
-- week, so the app can simply try after every verified session. The name and
-- ids are stripped here, server-side, whatever the client sent.
create or replace function public.add_pool_ghost(p_ghost jsonb, p_discipline text, p_level int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if jsonb_typeof(p_ghost) <> 'object' or coalesce((p_ghost ->> 'verified')::boolean, false) is not true
     or jsonb_typeof(p_ghost -> 'buckets') <> 'array' then
    raise exception 'not a verified ghost' using errcode = '22023';
  end if;
  if (select count(*) from public.ghost_pool
      where owner_id = uid and created_at > now() - interval '7 days') >= 2 then
    return false;
  end if;
  insert into public.ghost_pool (owner_id, mode, discipline, owner_level, ghost)
  values (uid, 'fight_focus', p_discipline, greatest(1, least(999, coalesce(p_level, 1))),
          p_ghost - 'ownerName' - 'ownerId' - 'ghostId' - 'streak');
  return true;
end;
$$;

-- One random recent stranger ghost for a discipline — never my own.
create or replace function public.random_pool_ghost(p_discipline text)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', id, 'level', owner_level, 'discipline', discipline, 'ghost', ghost)
  from public.ghost_pool
  where mode = 'fight_focus'
    and discipline = p_discipline
    and owner_id is distinct from auth.uid()
    and created_at > now() - interval '60 days'
  order by random()
  limit 1;
$$;

-- Opting out takes everything of mine back out of the pool.
create or replace function public.remove_my_pool_ghosts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if auth.uid() is null then
    return 0;
  end if;
  delete from public.ghost_pool where owner_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Who may call what. Functions are executable by PUBLIC by default.
revoke all on function public.create_haunt(jsonb) from public, anon;
revoke all on function public.get_haunt(text) from public;
revoke all on function public.add_pool_ghost(jsonb, text, int) from public, anon;
revoke all on function public.random_pool_ghost(text) from public;
revoke all on function public.remove_my_pool_ghosts() from public, anon;

grant execute on function public.create_haunt(jsonb) to authenticated;
grant execute on function public.get_haunt(text) to anon, authenticated;
grant execute on function public.add_pool_ghost(jsonb, text, int) to authenticated;
grant execute on function public.random_pool_ghost(text) to anon, authenticated;
grant execute on function public.remove_my_pool_ghosts() to authenticated;
