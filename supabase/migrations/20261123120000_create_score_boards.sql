-- The game-over world score board (docs/retention/SCOREBOARD-DESIGN.md, the
-- server design the owner approved on 2026-11-23). Built like ghost sharing
-- (…_create_ghost_sharing.sql): row-level security on every table with NO
-- client policies, table privileges revoked, and every read and write through
-- the security-definer functions below, which act only on auth.uid(). No
-- function takes an argument that names another user, so a user can only ever
-- write their own rows; CPU house scores are not rows at all (board_rules.house,
-- written only by migrations, merged in when get_board runs).
--
-- Tables
--   board_players         one row per athlete who joined (display name, country if
--                         shown, level, moderation flags)
--   board_scores          one best per athlete per board and period ('all' for now)
--   board_rules           one row per board the server accepts: generated from the
--                         app's data (scripts/score-board-rules.mjs)
--   board_house           the house names (gym gear) and levels, by kind and rung
--   board_runs            start tickets: one per session, used once, 24 hours
--   board_name_blocklist  reserved names and words no name may contain (service role)
--   board_flags           accepted scores a person should look at (service role)
--   board_holds           what LEAVE BOARDS cannot wash away: a hidden or blocked
--                         player's moderation and a rename's week (service role)
--
-- Functions (who may call them)
--   get_board(board)                     anon, authenticated: the ten rows, never an id
--   get_my_place(board)                  authenticated: my best, place, rank, players, next
--   get_board_profile()                  authenticated: my own name and country
--   join_boards(name, country)           authenticated
--   set_board_profile(name, country)     authenticated: a new name once a week
--   leave_boards()                       authenticated: deletes my player row and every score
--   start_board_run(board)               authenticated: a ticket at START
--   submit_score(ticket, value, session_id, level)  authenticated: at FINISH
--
-- Every function that counts a limit and then writes (join, leave, a ticket, a
-- score) first takes a lock on the athlete (board_lock), so one athlete's calls
-- queue behind each other and parallel calls cannot all pass the same count.
--
-- Roll back: docs/retention/SCOREBOARD-DESIGN.md, "Applying and rolling
-- back", has the exact script (unschedule the purge, drop the functions, drop
-- the tables). Nothing outside these tables and functions is touched.

create extension if not exists pg_cron;

-- ── Players ─────────────────────────────────────────────────────────────────
create table if not exists public.board_players (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  -- 3 to 12 letters, numbers, spaces, dots, dashes or underscores; trimmed, no
  -- double space, at least one letter or number. Unique ignoring case (index).
  display_name    text not null check (
    display_name ~ '^[A-Za-z0-9 ._-]{3,12}$' and display_name = btrim(display_name)
    and display_name !~ '  ' and display_name ~ '[A-Za-z0-9]'),
  -- Two capital letters, only once the athlete turns it on.
  country         text check (country is null or country ~ '^[A-Z]{2}$'),
  level           int  not null default 1 check (level between 1 and 999),
  hidden          boolean not null default false,
  blocked_until   timestamptz,
  name_changed_at timestamptz,
  joined_at       timestamptz not null default now()
);
comment on table public.board_players is
  'World score board players (opt-in). Read and written only through the board functions; hidden/blocked_until are moderation (service role).';
create unique index if not exists board_players_name_ci on public.board_players (lower(display_name));

-- ── Rules (one row per board, written only by migrations) ───────────────────
create table if not exists public.board_rules (
  board       text primary key check (board ~ '^[a-z0-9_]+(:[a-z0-9_]+){1,4}$' and length(board) <= 80),
  direction   text not null check (direction in ('more', 'less')),
  unit        text not null check (unit in ('strikes', 'seconds', 'rounds_reps', 'held', 'reps')),
  -- The best score a human can make: for 'less' the fastest time, else the most.
  cap         int  not null check (cap > 0),
  -- The shortest a real session at this setting can take (ticket to submit).
  min_seconds int  not null check (min_seconds >= 0),
  -- The house ladder, twelve scores, best first; and which names it uses.
  house       int[] not null check (cardinality(house) = 12 and array_position(house, null) is null),
  house_kind  text not null check (house_kind in ('fight', 'fit', 'run'))
);
comment on table public.board_rules is
  'One row per score board: direction, unit, cap, min_seconds and the twelve CPU house scores. Generated from the app (scripts/score-board-rules.mjs).';

create table if not exists public.board_house (
  kind  text not null check (kind in ('fight', 'fit', 'run')),
  rung  int  not null check (rung between 1 and 12),
  name  text not null check (length(name) between 1 and 12),
  level int  not null check (level between 1 and 999),
  primary key (kind, rung)
);
comment on table public.board_house is 'CPU house row names (gym and track gear, never people) and their fixed levels, by rung.';

-- ── Scores ──────────────────────────────────────────────────────────────────
create table if not exists public.board_scores (
  id         bigint generated always as identity primary key,
  board      text not null references public.board_rules (board) on delete cascade,
  period     text not null default 'all' check (period in ('all')),
  user_id    uuid not null references public.board_players (user_id) on delete cascade,
  -- The count; seconds for a time; rounds x 1000 + reps for rounds + reps.
  value      int  not null check (value >= 0),
  -- value for a 'less' board, -value otherwise: every board sorts ascending.
  rank_value int  not null,
  level      int  not null check (level between 1 and 999),
  session_id text not null check (length(session_id) between 1 and 80),
  set_at     timestamptz not null default now(),
  unique (board, period, user_id),
  unique (user_id, session_id)
);
comment on table public.board_scores is 'One best score per player per board and period. Places are worked out on read, never stored.';
-- The top ten and anyone's rank are one index range each.
create index if not exists board_scores_rank on public.board_scores (board, period, rank_value, set_at);

-- ── Start tickets ───────────────────────────────────────────────────────────
create table if not exists public.board_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  board      text not null references public.board_rules (board) on delete cascade,
  started_at timestamptz not null default now(),
  used_at    timestamptz,
  session_id text check (session_id is null or length(session_id) between 1 and 80),
  result     text,
  -- One session posts once.
  unique (user_id, session_id)
);
comment on table public.board_runs is 'Start tickets (one per board-eligible session) and the rate limits'' log. Purged after 2 days.';
create index if not exists board_runs_user_started on public.board_runs (user_id, started_at desc);
create index if not exists board_runs_user_used on public.board_runs (user_id, used_at desc) where used_at is not null;

-- ── Moderation (service role only) ──────────────────────────────────────────
create table if not exists public.board_name_blocklist (
  -- The name filter's key (lower case, look-alikes mapped, a to z only).
  word  text primary key check (word ~ '^[a-z]{2,30}$'),
  -- true: a reserved whole name (CPU, YOU, every house name); false: no name may contain it.
  exact boolean not null default false
);
comment on table public.board_name_blocklist is 'Display-name filter: reserved names (exact) and words no name may contain. Service role only.';

create table if not exists public.board_flags (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  board      text not null,
  value      int  not null,
  was        int,
  reason     text not null check (reason in ('near_cap', 'big_jump')),
  created_at timestamptz not null default now()
);
comment on table public.board_flags is 'Accepted scores for a person to look at (near the cap, a big jump on a player''s own best). Service role only.';
create index if not exists board_flags_created on public.board_flags (created_at desc);

-- LEAVE BOARDS deletes the player row and every score, but it must not wash
-- away moderation: a hidden or blocked player's state, and the week a rename
-- waits, are held here while they are off the boards and put back if they join
-- again (join_boards). Nothing else of theirs is kept, and a row goes once
-- nothing in it is in force (the hourly purge). The day's tickets (the limits)
-- and the flags stay in their own tables, which LEAVE does not touch.
create table if not exists public.board_holds (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  hidden          boolean not null default false,
  blocked_until   timestamptz,
  name_changed_at timestamptz,
  left_at         timestamptz not null default now()
);
comment on table public.board_holds is
  'Moderation and the rename week of players who left (LEAVE BOARDS), put back if they join again. Service role only; purged once nothing is in force.';

-- ── Lock every table: RLS on, no client policies, no client privileges ──────
alter table public.board_players        enable row level security;
alter table public.board_rules          enable row level security;
alter table public.board_house          enable row level security;
alter table public.board_scores         enable row level security;
alter table public.board_runs           enable row level security;
alter table public.board_name_blocklist enable row level security;
alter table public.board_flags          enable row level security;
alter table public.board_holds          enable row level security;
revoke all on table public.board_players, public.board_rules, public.board_house, public.board_scores,
  public.board_runs, public.board_name_blocklist, public.board_flags, public.board_holds from public, anon, authenticated;
-- The identity columns' sequences: Supabase's default privileges grant every
-- new sequence to the client roles, and the table revoke does not reach them.
revoke all on sequence public.board_scores_id_seq, public.board_flags_id_seq from public, anon, authenticated;

-- ── Internal helpers (no client role may call them) ─────────────────────────
-- The name filter's key: lower case, look-alikes mapped (0 o, 1 i, 3 e, 4 a,
-- 5 s, 7 t, @ a, $ s), every other character dropped.
create or replace function public.board_name_key(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.regexp_replace(pg_catalog.translate(pg_catalog.lower(coalesce(p, '')), '013457@$', 'oieastas'), '[^a-z]', '', 'g');
$$;

-- One athlete's calls queue behind each other: a transaction-scoped lock on the
-- athlete (released at commit), taken before any limit is counted.
create or replace function public.board_lock(p_uid uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('board_user:' || p_uid::text, 0));
$$;

-- Why a display name cannot be used, or null: 'name_invalid' (the shape),
-- 'name_refused' (reserved, or contains a blocked word), 'name_taken'.
create or replace function public.board_name_problem(p_name text, p_uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k text := public.board_name_key(p_name);
begin
  if p_name is null or p_name !~ '^[A-Za-z0-9 ._-]{3,12}$' or p_name <> btrim(p_name) or p_name ~ '  ' or p_name !~ '[A-Za-z0-9]' then
    return 'name_invalid';
  end if;
  if exists (select 1 from public.board_name_blocklist b
             where (b.exact and k = b.word) or (not b.exact and strpos(k, b.word) > 0)) then
    return 'name_refused';
  end if;
  if exists (select 1 from public.board_players p where lower(p.display_name) = lower(p_name) and p.user_id <> p_uid) then
    return 'name_taken';
  end if;
  return null;
end;
$$;

-- A player's place on a board, as get_board lays it out for them: their best,
-- their rank among the visible players, their place on the list (house rows
-- above them counted while the board has fewer than 5 players; from 5 on, house
-- rows sit only below the lowest real score), the player count, and the value
-- of the row just above them (what the next place needs). null: no score there.
-- A hidden player is counted in their own answer, as get_board shows them their
-- own row: nothing here tells them they are hidden.
create or replace function public.board_place_of(p_board text, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r          public.board_rules%rowtype;
  my_value   int;
  my_rank    int;
  my_set     timestamptz;
  my_level   int;
  n_players  int;
  n_above    int;
  cpu_above  int := 0;
  p_rank     int;
  p_value    int;
  h_rank     int;
  next_value int;
begin
  select s.value, s.rank_value, s.set_at, p.level
    into my_value, my_rank, my_set, my_level
    from public.board_scores s join public.board_players p on p.user_id = s.user_id
   where s.board = p_board and s.period = 'all' and s.user_id = p_uid;
  if not found then
    return null;
  end if;
  select * into r from public.board_rules where board = p_board;
  select count(*) into n_players
    from public.board_scores s join public.board_players p on p.user_id = s.user_id
   where s.board = p_board and s.period = 'all' and (not p.hidden or s.user_id = p_uid);
  -- Players above me: a better score, or the same score set first.
  select count(*) into n_above
    from public.board_scores s join public.board_players p on p.user_id = s.user_id
   where s.board = p_board and s.period = 'all' and not p.hidden and s.user_id <> p_uid
     and (s.rank_value < my_rank or (s.rank_value = my_rank and s.set_at < my_set));
  select s.rank_value, s.value into p_rank, p_value
    from public.board_scores s join public.board_players p on p.user_id = s.user_id
   where s.board = p_board and s.period = 'all' and not p.hidden and s.user_id <> p_uid
     and (s.rank_value < my_rank or (s.rank_value = my_rank and s.set_at < my_set))
   order by s.rank_value desc, s.set_at desc
   limit 1;
  -- House scores above me (strictly better: a CPU row ranks under a player on
  -- the same score), only while the board has fewer than 5 players.
  if n_players < 5 then
    select count(*), max(x.rv) into cpu_above, h_rank
      from (select case when r.direction = 'less' then h.v else -h.v end as rv from unnest(r.house) as h(v)) x
     where x.rv < my_rank;
  end if;
  -- The row just above: the closer of the two; on the same score the house
  -- row sits under the player, so it is the one just above me.
  if h_rank is not null and (p_rank is null or h_rank >= p_rank) then
    next_value := case when r.direction = 'less' then h_rank else -h_rank end;
  else
    next_value := p_value;
  end if;
  return jsonb_build_object(
    'value', my_value, 'level', my_level, 'set_at', my_set,
    'rank', n_above + 1, 'place', n_above + cpu_above + 1, 'players', n_players, 'next_value', next_value);
end;
$$;

-- ── Reading a board ─────────────────────────────────────────────────────────
-- The ten rows of a board: display name, country (only if shown), level,
-- score, CPU or not, my own row marked `you`. Never a user id or email. Fewer
-- than 5 players: all twelve house scores are merged in and the best ten rows
-- show; 5 or more: only house scores worse than the lowest real score. Ties:
-- whoever set it first; a house row under a player on the same score. A hidden
-- player is off everyone's board but their own (they are not told).
create or replace function public.get_board(p_board text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r         public.board_rules%rowtype;
  uid       uuid := auth.uid();
  n_players int;
  lowest    int;
  v_rows    jsonb;
begin
  select * into r from public.board_rules where board = p_board;
  if not found then
    return null;
  end if;
  select count(*), max(s.rank_value) into n_players, lowest
    from public.board_scores s join public.board_players p on p.user_id = s.user_id
   where s.board = p_board and s.period = 'all' and (not p.hidden or s.user_id = uid);
  with real_rows as (
    select p.display_name as name, p.country, p.level, s.value, s.rank_value, s.set_at, false as cpu,
           coalesce(s.user_id = uid, false) as you, 0::bigint as rung,
           row_number() over (order by s.rank_value, s.set_at) as rank
      from public.board_scores s join public.board_players p on p.user_id = s.user_id
     where s.board = p_board and s.period = 'all' and (not p.hidden or s.user_id = uid)
     order by s.rank_value, s.set_at
     limit 10
  ), house_rows as (
    select h.name, null::text as country, h.level, x.v as value,
           case when r.direction = 'less' then x.v else -x.v end as rank_value,
           null::timestamptz as set_at, true as cpu, false as you, x.rung, null::bigint as rank
      from unnest(r.house) with ordinality as x(v, rung)
      join public.board_house h on h.kind = r.house_kind and h.rung = x.rung
  ), merged as (
    select * from real_rows
    union all
    select * from house_rows where n_players < 5 or rank_value > lowest
  ), top as (
    select m.*, row_number() over (order by m.rank_value, m.cpu, m.set_at nulls last, m.rung) as place
      from merged m
     order by m.rank_value, m.cpu, m.set_at nulls last, m.rung
     limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'place', t.place, 'rank', t.rank, 'name', t.name, 'country', t.country, 'level', t.level,
           'value', t.value, 'cpu', t.cpu, 'you', t.you) order by t.place), '[]'::jsonb)
    into v_rows from top t;
  return jsonb_build_object('board', r.board, 'direction', r.direction, 'unit', r.unit, 'players', n_players, 'rows', v_rows);
end;
$$;

-- My best on a board, my place and rank, the player count and what the next
-- place needs; {"players": n} alone when I have no score there.
create or replace function public.get_my_place(p_board text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.board_rules where board = p_board) then
    return null;
  end if;
  res := public.board_place_of(p_board, uid);
  if res is null then
    return jsonb_build_object('players', (select count(*) from public.board_scores s join public.board_players p on p.user_id = s.user_id
                                          where s.board = p_board and s.period = 'all' and not p.hidden));
  end if;
  -- Only these: never the time it was set, never any moderation state.
  return jsonb_build_object('value', res -> 'value', 'level', res -> 'level', 'rank', res -> 'rank', 'place', res -> 'place',
                            'players', res -> 'players', 'next_value', res -> 'next_value');
end;
$$;

-- ── Joining, the profile, leaving ───────────────────────────────────────────
create or replace function public.get_board_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('name', p.display_name, 'country', p.country, 'level', p.level, 'joined_at', p.joined_at,
                            'rename_at', case when p.name_changed_at is null then null else p.name_changed_at + interval '7 days' end)
    from public.board_players p
   where p.user_id = auth.uid();
$$;

-- Join with a display name (the filter: shape, reserved names, blocked words,
-- taken) and, only if the athlete turned it on, a two-letter country.
-- → {"ok": true, "name", "country"} or {"ok": false, "reason"}. Joining twice
-- is not an error: it answers with the name already there. Joining again after
-- LEAVE BOARDS puts back what board_holds kept (hidden, blocked, silently), and
-- a new name inside the week of a rename is refused like a rename
-- ({"reason": "too_soon", "rename_at"}).
create or replace function public.join_boards(p_name text, p_country text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  v_name  text := coalesce(p_name, '');
  v_cc    text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  v_old   public.board_players%rowtype;
  v_hold  public.board_holds%rowtype;
  problem text;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  perform public.board_lock(uid);
  select * into v_old from public.board_players where user_id = uid;
  if found then
    return jsonb_build_object('ok', true, 'name', v_old.display_name, 'country', v_old.country, 'already', true);
  end if;
  select * into v_hold from public.board_holds where user_id = uid;
  if v_hold.name_changed_at > now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'reason', 'too_soon', 'rename_at', v_hold.name_changed_at + interval '7 days');
  end if;
  if v_cc is not null and v_cc !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'country_invalid');
  end if;
  problem := public.board_name_problem(v_name, uid);
  if problem is not null then
    return jsonb_build_object('ok', false, 'reason', problem);
  end if;
  insert into public.board_players (user_id, display_name, country, hidden, blocked_until, name_changed_at)
  values (uid, v_name, v_cc, coalesce(v_hold.hidden, false), v_hold.blocked_until, v_hold.name_changed_at);
  delete from public.board_holds where user_id = uid;
  return jsonb_build_object('ok', true, 'name', v_name, 'country', v_cc);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'name_taken');
end;
$$;

-- Change my name (once a week) or my country (any time; null takes it off).
create or replace function public.set_board_profile(p_name text, p_country text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid     uuid := auth.uid();
  v_name  text := coalesce(p_name, '');
  v_cc    text := nullif(upper(btrim(coalesce(p_country, ''))), '');
  v_old   public.board_players%rowtype;
  problem text;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  select * into v_old from public.board_players where user_id = uid;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_joined');
  end if;
  if v_cc is not null and v_cc !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'reason', 'country_invalid');
  end if;
  if v_name <> v_old.display_name then
    if v_old.name_changed_at is not null and v_old.name_changed_at > now() - interval '7 days' then
      return jsonb_build_object('ok', false, 'reason', 'too_soon', 'rename_at', v_old.name_changed_at + interval '7 days');
    end if;
    problem := public.board_name_problem(v_name, uid);
    if problem is not null then
      return jsonb_build_object('ok', false, 'reason', problem);
    end if;
    update public.board_players set display_name = v_name, name_changed_at = now(), country = v_cc where user_id = uid;
  else
    update public.board_players set country = v_cc where user_id = uid;
  end if;
  return jsonb_build_object('ok', true, 'name', v_name, 'country', v_cc);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'reason', 'name_taken');
end;
$$;

-- LEAVE BOARDS: my player row and every score of mine, at once. Whoever was
-- under me moves up on the next read. What must outlast it stays: a hidden or
-- blocked state and the week a rename waits go to board_holds (only while in
-- force), and the day's tickets (the limits) and the flags (for a person to
-- look at) are not touched; the hourly purge takes tickets after 2 days and
-- holds once nothing in them is in force. Deleting the account takes them all.
create or replace function public.leave_boards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  v_old public.board_players%rowtype;
  n     int;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  perform public.board_lock(uid);
  select * into v_old from public.board_players where user_id = uid;
  if not found then
    return jsonb_build_object('ok', true, 'scores', 0);
  end if;
  select count(*) into n from public.board_scores where user_id = uid;
  if v_old.hidden or v_old.blocked_until > now() or v_old.name_changed_at > now() - interval '7 days' then
    insert into public.board_holds as h (user_id, hidden, blocked_until, name_changed_at)
    values (uid, v_old.hidden, v_old.blocked_until, v_old.name_changed_at)
    on conflict (user_id) do update set
      hidden = h.hidden or excluded.hidden,
      blocked_until = greatest(h.blocked_until, excluded.blocked_until),
      name_changed_at = greatest(h.name_changed_at, excluded.name_changed_at),
      left_at = now();
  end if;
  delete from public.board_players where user_id = uid;  -- board_scores go with it (on delete cascade)
  return jsonb_build_object('ok', true, 'scores', n);
end;
$$;

-- ── Posting a score ─────────────────────────────────────────────────────────
-- A ticket for a session about to start, or null (no such board, blocked,
-- or 40 tickets in the last 24 hours). Signed in; joining is not needed yet,
-- so the very first session can post once the athlete joins at its end
-- (submit_score is what needs a player row). A block held after LEAVE counts.
create or replace function public.start_board_run(p_board text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if not exists (select 1 from public.board_rules where board = p_board) then
    return null;
  end if;
  perform public.board_lock(uid);
  if exists (select 1 from public.board_players where user_id = uid and blocked_until > now())
     or exists (select 1 from public.board_holds where user_id = uid and blocked_until > now()) then
    return null;
  end if;
  if (select count(*) from public.board_runs where user_id = uid and started_at > now() - interval '1 day') >= 40 then
    return null;
  end if;
  insert into public.board_runs (user_id, board) values (uid, p_board) returning id into v_id;
  return v_id;
end;
$$;

-- One finished session. Refused (status 'refused', with a reason) unless the
-- ticket is mine, unused and under 24 hours old (it names the board); I have
-- joined and am not blocked; I am under the limits (30 scores a day, 6 a board
-- a day); this session id has not posted; at least min_seconds have passed
-- since the ticket; the score is inside the board's cap; a time is no longer
-- than the time since the ticket. Only a better score replaces my best. A new
-- best within 5% of the cap, or more than 30% better than my old best, is
-- accepted and written to board_flags too. The answer says what happened and
-- my place before and after (the app shows the full board when it is news).
create or replace function public.submit_score(p_ticket uuid, p_value int, p_session_id text, p_level int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid      uuid := auth.uid();
  t        public.board_runs%rowtype;
  r        public.board_rules%rowtype;
  v_player public.board_players%rowtype;
  v_old    public.board_scores%rowtype;
  v_rank   int;
  v_level  int;
  v_age    numeric;
  v_before jsonb;
  v_after  jsonb;
  refuse   text;
  status   text;
begin
  if uid is null then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  perform public.board_lock(uid);
  select * into v_player from public.board_players where user_id = uid;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'not_joined');
  end if;
  if (v_player.blocked_until is not null and v_player.blocked_until > now())
     or exists (select 1 from public.board_holds where user_id = uid and blocked_until > now()) then
    return jsonb_build_object('status', 'refused', 'reason', 'blocked');
  end if;
  select * into t from public.board_runs where id = p_ticket and user_id = uid for update;
  if not found then
    return jsonb_build_object('status', 'refused', 'reason', 'bad_ticket');
  end if;
  if t.used_at is not null then
    return jsonb_build_object('status', 'refused', 'reason', 'ticket_used');
  end if;
  if t.started_at < now() - interval '24 hours' then
    return jsonb_build_object('status', 'refused', 'reason', 'ticket_expired');
  end if;
  if p_session_id is null or length(p_session_id) not between 1 and 80 or p_value is null then
    return jsonb_build_object('status', 'refused', 'reason', 'bad_session');
  end if;
  -- Scores taken in the last day (a refusal is no score: tickets cap those, 40 a day).
  if (select count(*) from public.board_runs where user_id = uid and result = 'scored' and used_at > now() - interval '1 day') >= 30
     or (select count(*) from public.board_runs where user_id = uid and board = t.board and result = 'scored' and used_at > now() - interval '1 day') >= 6 then
    return jsonb_build_object('status', 'refused', 'reason', 'rate_limited');
  end if;
  if exists (select 1 from public.board_runs where user_id = uid and session_id = p_session_id)
     or exists (select 1 from public.board_scores where user_id = uid and session_id = p_session_id) then
    update public.board_runs set used_at = now(), result = 'refused:session_used' where id = t.id;
    return jsonb_build_object('status', 'refused', 'reason', 'session_used');
  end if;

  select * into r from public.board_rules where board = t.board;
  v_age := extract(epoch from (now() - t.started_at));
  if v_age < r.min_seconds then
    refuse := 'too_early';
  elsif (r.direction = 'more' and (p_value < 0 or p_value > r.cap))
     or (r.direction = 'less' and (p_value <= 0 or p_value < r.cap)) then
    refuse := 'over_cap';
  elsif r.direction = 'less' and r.unit = 'seconds' and p_value > v_age + 5 then
    refuse := 'too_long';
  end if;
  -- The ticket is spent either way: one ticket, one answer.
  update public.board_runs set used_at = now(), session_id = p_session_id,
         result = coalesce('refused:' || refuse, 'scored') where id = t.id;
  if refuse is not null then
    return jsonb_build_object('status', 'refused', 'reason', refuse);
  end if;

  v_level := greatest(1, least(999, coalesce(p_level, v_player.level)));
  update public.board_players set level = v_level where user_id = uid;
  v_rank := case when r.direction = 'less' then p_value else -p_value end;
  v_before := public.board_place_of(t.board, uid);
  select * into v_old from public.board_scores where board = t.board and period = 'all' and user_id = uid for update;
  if not found then
    insert into public.board_scores (board, period, user_id, value, rank_value, level, session_id)
    values (t.board, 'all', uid, p_value, v_rank, v_level, p_session_id);
    status := 'new_best';
  elsif v_rank < v_old.rank_value then
    update public.board_scores set value = p_value, rank_value = v_rank, level = v_level, session_id = p_session_id, set_at = now()
     where id = v_old.id;
    status := 'new_best';
  else
    status := 'not_best';
  end if;
  if status = 'new_best' then
    if (r.direction = 'more' and p_value >= ceil(0.95 * r.cap)) or (r.direction = 'less' and p_value <= floor(r.cap / 0.95)) then
      insert into public.board_flags (user_id, board, value, was, reason) values (uid, t.board, p_value, v_old.value, 'near_cap');
    end if;
    if v_old.value is not null and v_old.value > 0
       and ((r.direction = 'more' and p_value > 1.3 * v_old.value) or (r.direction = 'less' and p_value < 0.7 * v_old.value)) then
      insert into public.board_flags (user_id, board, value, was, reason) values (uid, t.board, p_value, v_old.value, 'big_jump');
    end if;
  end if;
  v_after := public.board_place_of(t.board, uid);
  return jsonb_build_object(
    'status', status, 'board', t.board, 'value', p_value,
    'best', (v_after ->> 'value')::int, 'was', v_old.value, 'first', v_old.id is null,
    'place', (v_after ->> 'place')::int, 'rank', (v_after ->> 'rank')::int, 'players', (v_after ->> 'players')::int,
    'place_before', (v_before ->> 'place')::int);
end;
$$;

-- Old tickets go: the rate limits look back one day, a ticket lives 24 hours.
-- A hold goes once nothing in it is in force (not hidden, no block running, no
-- rename inside the week). → the rows removed.
create or replace function public.purge_board_runs()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  m int;
begin
  delete from public.board_runs where started_at < now() - interval '2 days';
  get diagnostics n = row_count;
  delete from public.board_holds
   where not hidden
     and (blocked_until is null or blocked_until <= now())
     and (name_changed_at is null or name_changed_at <= now() - interval '7 days');
  get diagnostics m = row_count;
  return n + m;
end;
$$;

-- ── Who may call what. Functions are executable by PUBLIC by default. ────────
revoke all on function public.board_name_key(text) from public, anon, authenticated;
revoke all on function public.board_lock(uuid) from public, anon, authenticated;
revoke all on function public.board_name_problem(text, uuid) from public, anon, authenticated;
revoke all on function public.board_place_of(text, uuid) from public, anon, authenticated;
revoke all on function public.purge_board_runs() from public, anon, authenticated;
revoke all on function public.get_board(text) from public, anon, authenticated;
revoke all on function public.get_my_place(text) from public, anon, authenticated;
revoke all on function public.get_board_profile() from public, anon, authenticated;
revoke all on function public.join_boards(text, text) from public, anon, authenticated;
revoke all on function public.set_board_profile(text, text) from public, anon, authenticated;
revoke all on function public.leave_boards() from public, anon, authenticated;
revoke all on function public.start_board_run(text) from public, anon, authenticated;
revoke all on function public.submit_score(uuid, int, text, int) from public, anon, authenticated;

grant execute on function public.get_board(text) to anon, authenticated;
grant execute on function public.get_my_place(text) to authenticated;
grant execute on function public.get_board_profile() to authenticated;
grant execute on function public.join_boards(text, text) to authenticated;
grant execute on function public.set_board_profile(text, text) to authenticated;
grant execute on function public.leave_boards() to authenticated;
grant execute on function public.start_board_run(text) to authenticated;
grant execute on function public.submit_score(uuid, int, text, int) to authenticated;

-- Hourly, at :41 (off the top of the hour). Scheduling by name replaces any
-- earlier job of the same name, so re-running this is safe.
select cron.schedule('purge-board-runs', '41 * * * *', $$select public.purge_board_runs()$$);

-- ── The boards, the house names and the name filter's words ─────────────────
-- BEGIN GENERATED (scripts/score-board-rules.mjs: do not edit by hand)
-- 203 boards, generated from the app's data.
insert into public.board_house (kind, rung, name, level) values
  ('fight', 1, 'HEAVY BAG', 26),
  ('fight', 2, 'SPEED BAG', 23),
  ('fight', 3, 'DOUBLE END', 20),
  ('fight', 4, 'FOCUS MITT', 17),
  ('fight', 5, 'THAI PADS', 14),
  ('fight', 6, 'WATER BAG', 12),
  ('fight', 7, 'SLIP ROPE', 10),
  ('fight', 8, 'BODY PAD', 8),
  ('fight', 9, 'WALL PAD', 6),
  ('fight', 10, 'JUMP ROPE', 4),
  ('fight', 11, 'HAND WRAP', 3),
  ('fight', 12, 'MOUTHGUARD', 2),
  ('fit', 1, 'KETTLEBELL', 26),
  ('fit', 2, 'SANDBAG', 23),
  ('fit', 3, 'BARBELL', 20),
  ('fit', 4, 'MED BALL', 17),
  ('fit', 5, 'DUMBBELL', 14),
  ('fit', 6, 'TRAP BAR', 12),
  ('fit', 7, 'PLYO BOX', 10),
  ('fit', 8, 'CHIN BAR', 8),
  ('fit', 9, 'SLED', 6),
  ('fit', 10, 'AB WHEEL', 4),
  ('fit', 11, 'YOGA MAT', 3),
  ('fit', 12, 'IRON PLATE', 2),
  ('run', 1, 'TREADMILL', 26),
  ('run', 2, 'STOPWATCH', 23),
  ('run', 3, 'PACE CLOCK', 20),
  ('run', 4, 'START GUN', 17),
  ('run', 5, 'LAP TIMER', 14),
  ('run', 6, 'MILE POST', 12),
  ('run', 7, 'HURDLE', 10),
  ('run', 8, 'STEP BOX', 8),
  ('run', 9, 'WATER CUP', 6),
  ('run', 10, 'WHISTLE', 4),
  ('run', 11, 'LANE LINE', 3),
  ('run', 12, 'CONE', 2)
on conflict (kind, rung) do update set name = excluded.name, level = excluded.level;
insert into public.board_rules (board, direction, unit, cap, min_seconds, house, house_kind) values
  ('ff:boxing:3x3r60:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('ff:boxing:3x3r60:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('ff:boxing:3x3r60:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('ff:boxing:5x3r60:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('ff:boxing:5x3r60:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('ff:boxing:5x3r60:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('jt:boxing:bag6x3', 'more', 'strikes', 3600, 972, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('jt:boxing:pads8x2', 'more', 'strikes', 3200, 864, '{1792,1664,1536,1408,1280,1152,1024,896,768,640,528,432}', 'fight'),
  ('jt:boxing:spar5x3', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('jt:boxing:tabata8x20', 'more', 'strikes', 533, 144, '{299,277,256,235,213,192,171,149,128,107,88,72}', 'fight'),
  ('cc:boxing:3x3r60:technical:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:boxing:3x3r60:technical:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:boxing:3x3r60:technical:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:boxing:3x3r60:technical:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:boxing:3x3r60:combo:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:boxing:3x3r60:combo:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:boxing:3x3r60:combo:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:boxing:3x3r60:combo:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:boxing:5x3r60:technical:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:boxing:5x3r60:technical:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:boxing:5x3r60:technical:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:boxing:5x3r60:technical:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('cc:boxing:5x3r60:combo:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:boxing:5x3r60:combo:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:boxing:5x3r60:combo:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:boxing:5x3r60:combo:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('ff:kickboxing:3x3r60:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('ff:kickboxing:3x3r60:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('ff:kickboxing:3x3r60:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('ff:kickboxing:5x3r60:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('ff:kickboxing:5x3r60:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('ff:kickboxing:5x3r60:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('jt:kickboxing:bag6x3', 'more', 'strikes', 3600, 972, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('jt:kickboxing:pads8x2', 'more', 'strikes', 3200, 864, '{1792,1664,1536,1408,1280,1152,1024,896,768,640,528,432}', 'fight'),
  ('jt:kickboxing:spar5x3', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('jt:kickboxing:tabata8x20', 'more', 'strikes', 533, 144, '{299,277,256,235,213,192,171,149,128,107,88,72}', 'fight'),
  ('cc:kickboxing:3x3r60:technical:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:kickboxing:3x3r60:technical:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:kickboxing:3x3r60:technical:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:kickboxing:3x3r60:technical:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:kickboxing:3x3r60:combo:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:kickboxing:3x3r60:combo:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:kickboxing:3x3r60:combo:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:kickboxing:3x3r60:combo:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:kickboxing:5x3r60:technical:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:kickboxing:5x3r60:technical:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:kickboxing:5x3r60:technical:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:kickboxing:5x3r60:technical:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('cc:kickboxing:5x3r60:combo:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:kickboxing:5x3r60:combo:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:kickboxing:5x3r60:combo:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:kickboxing:5x3r60:combo:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('ff:muay_thai:3x3r60:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('ff:muay_thai:3x3r60:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('ff:muay_thai:3x3r60:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('ff:muay_thai:5x3r60:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('ff:muay_thai:5x3r60:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('ff:muay_thai:5x3r60:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('jt:muay_thai:bag6x3', 'more', 'strikes', 3600, 972, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('jt:muay_thai:pads8x2', 'more', 'strikes', 3200, 864, '{1792,1664,1536,1408,1280,1152,1024,896,768,640,528,432}', 'fight'),
  ('jt:muay_thai:spar5x3', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('jt:muay_thai:tabata8x20', 'more', 'strikes', 533, 144, '{299,277,256,235,213,192,171,149,128,107,88,72}', 'fight'),
  ('cc:muay_thai:3x3r60:technical:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:muay_thai:3x3r60:technical:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:muay_thai:3x3r60:technical:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:muay_thai:3x3r60:technical:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:muay_thai:3x3r60:combo:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:muay_thai:3x3r60:combo:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:muay_thai:3x3r60:combo:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:muay_thai:3x3r60:combo:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:muay_thai:5x3r60:technical:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:muay_thai:5x3r60:technical:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:muay_thai:5x3r60:technical:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:muay_thai:5x3r60:technical:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('cc:muay_thai:5x3r60:combo:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:muay_thai:5x3r60:combo:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:muay_thai:5x3r60:combo:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:muay_thai:5x3r60:combo:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('ff:mma:3x3r60:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('ff:mma:3x3r60:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('ff:mma:3x3r60:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('ff:mma:5x3r60:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('ff:mma:5x3r60:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('ff:mma:5x3r60:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('jt:mma:bag6x3', 'more', 'strikes', 3600, 972, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('jt:mma:pads8x2', 'more', 'strikes', 3200, 864, '{1792,1664,1536,1408,1280,1152,1024,896,768,640,528,432}', 'fight'),
  ('jt:mma:spar5x3', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('jt:mma:tabata8x20', 'more', 'strikes', 533, 144, '{299,277,256,235,213,192,171,149,128,107,88,72}', 'fight'),
  ('cc:mma:3x3r60:technical:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:mma:3x3r60:technical:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:mma:3x3r60:technical:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:mma:3x3r60:technical:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:mma:3x3r60:combo:easy', 'more', 'strikes', 1800, 486, '{857,796,734,673,612,551,490,428,367,306,252,207}', 'fight'),
  ('cc:mma:3x3r60:combo:normal', 'more', 'strikes', 1800, 486, '{1008,936,864,792,720,648,576,504,432,360,297,243}', 'fight'),
  ('cc:mma:3x3r60:combo:hard', 'more', 'strikes', 1800, 486, '{1109,1030,950,871,792,713,634,554,475,396,327,267}', 'fight'),
  ('cc:mma:3x3r60:combo:advanced', 'more', 'strikes', 1800, 486, '{1210,1123,1037,950,864,778,691,605,518,432,356,292}', 'fight'),
  ('cc:mma:5x3r60:technical:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:mma:5x3r60:technical:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:mma:5x3r60:technical:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:mma:5x3r60:technical:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('cc:mma:5x3r60:combo:easy', 'more', 'strikes', 3000, 810, '{1428,1326,1224,1122,1020,918,816,714,612,510,421,344}', 'fight'),
  ('cc:mma:5x3r60:combo:normal', 'more', 'strikes', 3000, 810, '{1680,1560,1440,1320,1200,1080,960,840,720,600,495,405}', 'fight'),
  ('cc:mma:5x3r60:combo:hard', 'more', 'strikes', 3000, 810, '{1848,1716,1584,1452,1320,1188,1056,924,792,660,545,446}', 'fight'),
  ('cc:mma:5x3r60:combo:advanced', 'more', 'strikes', 3000, 810, '{2016,1872,1728,1584,1440,1296,1152,1008,864,720,594,486}', 'fight'),
  ('qm:iron_clock_16:beginner', 'more', 'held', 12, 684, '{12,12,12,12,12,12,11,11,10,9,7,6}', 'fit'),
  ('qm:iron_clock_16:standard', 'more', 'held', 16, 912, '{16,16,16,16,16,16,15,15,14,12,10,8}', 'fit'),
  ('qm:iron_clock_16:elite', 'more', 'held', 16, 912, '{16,16,16,16,16,16,15,15,14,12,10,8}', 'fit'),
  ('qm:one_bell_300:beginner', 'less', 'seconds', 240, 240, '{480,525,570,615,660,720,780,840,900,975,1050,1125}', 'fit'),
  ('qm:one_bell_300:standard', 'less', 'seconds', 450, 450, '{900,975,1050,1125,1200,1275,1350,1425,1500,1600,1700,1800}', 'fit'),
  ('qm:one_bell_300:elite', 'less', 'seconds', 495, 495, '{990,1075,1155,1240,1320,1405,1485,1570,1650,1700,1750,1800}', 'fit'),
  ('qm:five_round_bout:beginner', 'more', 'rounds_reps', 31017, 627, '{21000,19009,18000,16009,15000,13014,12009,11005,10000,8012,7006,6000}', 'fit'),
  ('qm:five_round_bout:standard', 'more', 'rounds_reps', 57017, 1083, '{27000,25005,23009,21014,20000,18009,17000,15009,14000,12002,10005,8007}', 'fit'),
  ('qm:five_round_bout:elite', 'more', 'rounds_reps', 57017, 1083, '{25000,23005,21009,19014,18000,16009,15000,13009,12000,10007,8014,7004}', 'fit'),
  ('qm:best_of_3:beginner', 'more', 'rounds_reps', 22022, 456, '{15000,14000,13000,12000,11000,10006,9012,8017,8000,6021,5020,4018}', 'fit'),
  ('qm:best_of_3:standard', 'more', 'rounds_reps', 30024, 627, '{21000,20000,19000,18000,17000,15019,14013,13006,12000,10010,8020,7005}', 'fit'),
  ('qm:best_of_3:elite', 'more', 'rounds_reps', 29024, 627, '{18000,17000,16000,15000,14000,13000,12000,11000,10000,8017,7008,6000}', 'fit'),
  ('qm:steel_plating:beginner', 'more', 'held', 10, 570, '{10,10,10,10,10,10,10,9,9,8,7,5}', 'fit'),
  ('qm:steel_plating:standard', 'more', 'held', 20, 1140, '{20,20,20,20,20,20,19,19,18,16,13,11}', 'fit'),
  ('qm:steel_plating:elite', 'more', 'held', 20, 1140, '{20,20,20,20,20,20,19,19,18,16,13,11}', 'fit'),
  ('qm:checkpoint_20:beginner', 'more', 'held', 12, 684, '{12,12,12,12,12,12,11,11,10,9,7,6}', 'fit'),
  ('qm:checkpoint_20:standard', 'more', 'held', 20, 1140, '{20,20,20,20,20,19,19,18,17,15,12,10}', 'fit'),
  ('qm:checkpoint_20:elite', 'more', 'held', 24, 1368, '{24,24,24,24,24,23,23,22,21,18,15,13}', 'fit'),
  ('qm:room_12:beginner', 'more', 'rounds_reps', 28033, 570, '{14000,13009,12017,11026,11000,10009,9017,8026,8000,6032,5029,4027}', 'fit'),
  ('qm:room_12:standard', 'more', 'rounds_reps', 24043, 684, '{12000,11022,11000,10022,10000,9011,8022,7033,7000,6003,5006,4009}', 'fit'),
  ('qm:room_12:elite', 'more', 'rounds_reps', 21043, 684, '{10000,9022,9000,8022,8000,7022,7000,6022,6000,5009,4018,3026}', 'fit'),
  ('qm:hit_combo_21:beginner', 'more', 'rounds_reps', 21023, 570, '{9000,8012,8000,7012,7000,6012,6000,5012,5000,4008,3016,3000}', 'fit'),
  ('qm:hit_combo_21:standard', 'more', 'rounds_reps', 36020, 855, '{12000,11011,11000,10011,10000,9011,9000,8011,8000,6020,5018,4017}', 'fit'),
  ('qm:hit_combo_21:elite', 'more', 'rounds_reps', 36020, 855, '{11000,10011,10000,9011,9000,8011,8000,7011,7000,6001,5003,4004}', 'fit'),
  ('qm:tutorial_stage:beginner', 'more', 'reps', 279, 428, '{55,53,50,48,45,44,43,41,40,35,29,24}', 'fit'),
  ('qm:tutorial_stage:standard', 'more', 'reps', 441, 456, '{80,76,73,69,65,61,58,54,50,43,37,30}', 'fit'),
  ('qm:tutorial_stage:elite', 'more', 'reps', 837, 627, '{80,76,73,69,65,61,58,54,50,43,37,30}', 'fit'),
  ('qm:turbo_button:beginner', 'more', 'reps', 188, 485, '{16,16,15,15,14,14,13,13,12,10,9,7}', 'fit'),
  ('qm:turbo_button:standard', 'more', 'reps', 280, 494, '{25,24,23,21,20,19,18,16,15,13,11,9}', 'fit'),
  ('qm:turbo_button:elite', 'more', 'reps', 280, 494, '{25,24,23,21,20,19,18,16,15,13,11,9}', 'fit'),
  ('qm:quota_300:beginner', 'more', 'held', 15, 855, '{15,15,15,15,15,15,15,15,15,13,11,9}', 'fit'),
  ('qm:quota_300:standard', 'more', 'held', 15, 855, '{15,15,15,15,15,14,14,13,12,10,9,7}', 'fit'),
  ('qm:quota_300:elite', 'more', 'held', 30, 1710, '{30,26,23,19,15,14,13,11,10,9,7,6}', 'fit'),
  ('qm:honor_rounds:beginner', 'less', 'seconds', 90, 90, '{180,225,270,315,360,420,480,540,600,650,700,750}', 'fit'),
  ('qm:honor_rounds:standard', 'less', 'seconds', 105, 105, '{210,270,330,390,450,520,585,655,720,780,840,900}', 'fit'),
  ('qm:honor_rounds:elite', 'less', 'seconds', 150, 150, '{300,360,420,480,540,615,690,765,840,910,980,1050}', 'fit'),
  ('qm:ko_sprint_30:beginner', 'less', 'seconds', 45, 45, '{90,135,180,225,270,310,345,385,420,455,490,525}', 'fit'),
  ('qm:ko_sprint_30:standard', 'less', 'seconds', 53, 53, '{105,155,205,250,300,345,390,435,480,520,560,600}', 'fit'),
  ('qm:ko_sprint_30:elite', 'less', 'seconds', 60, 60, '{120,175,225,280,330,385,435,490,540,560,580,600}', 'fit'),
  ('qm:overhead_rush:beginner', 'less', 'seconds', 150, 150, '{300,345,390,435,480,525,570,615,660,715,770,825}', 'fit'),
  ('qm:overhead_rush:standard', 'less', 'seconds', 225, 225, '{450,520,585,655,720,750,780,810,840,860,880,900}', 'fit'),
  ('qm:overhead_rush:elite', 'less', 'seconds', 240, 240, '{480,555,630,705,780,805,825,850,870,880,890,900}', 'fit'),
  ('qm:burnout_21:beginner', 'less', 'seconds', 120, 120, '{240,330,420,510,600,690,780,870,960,1040,1120,1200}', 'fit'),
  ('qm:burnout_21:standard', 'less', 'seconds', 210, 210, '{420,555,690,825,960,1095,1230,1365,1500,1600,1700,1800}', 'fit'),
  ('qm:burnout_21:elite', 'less', 'seconds', 233, 233, '{465,620,775,925,1080,1215,1350,1485,1620,1680,1740,1800}', 'fit'),
  ('qm:stance_breaker_9:beginner', 'more', 'rounds_reps', 11035, 342, '{5000,4027,4018,4009,4000,3027,3018,3009,3000,2022,2007,1029}', 'fit'),
  ('qm:stance_breaker_9:standard', 'more', 'rounds_reps', 16035, 513, '{7000,6027,6018,6009,6000,5018,5000,4018,4000,3017,2034,2014}', 'fit'),
  ('qm:stance_breaker_9:elite', 'more', 'rounds_reps', 16035, 513, '{6000,5027,5018,5009,5000,4027,4018,4009,4000,3017,2034,2014}', 'fit'),
  ('qm:rookie_round_8:beginner', 'more', 'rounds_reps', 14023, 285, '{6000,5018,5012,5006,5000,4012,4000,3012,3000,2014,2005,1019}', 'fit'),
  ('qm:rookie_round_8:standard', 'more', 'rounds_reps', 22023, 456, '{9000,8012,8000,7012,7000,6012,6000,5012,5000,4008,3016,3000}', 'fit'),
  ('qm:rookie_round_8:elite', 'more', 'rounds_reps', 22023, 456, '{8000,7012,7000,6012,6000,5012,5000,4012,4000,3011,2022,2010}', 'fit'),
  ('qm:first_bell:beginner', 'more', 'held', 20, 1197, '{20,20,20,20,20,20,19,19,18,16,13,11}', 'fit'),
  ('qm:first_bell:standard', 'more', 'held', 20, 912, '{20,20,20,20,20,19,19,18,17,15,12,10}', 'fit'),
  ('qm:first_bell:elite', 'more', 'held', 20, 912, '{20,20,20,20,20,19,18,17,16,14,12,10}', 'fit'),
  ('qm:continue_bell:beginner', 'less', 'seconds', 120, 120, '{240,270,300,330,360,405,450,495,540,560,580,600}', 'fit'),
  ('qm:continue_bell:standard', 'less', 'seconds', 270, 270, '{540,600,660,720,780,855,930,1005,1080,1120,1160,1200}', 'fit'),
  ('qm:continue_bell:elite', 'less', 'seconds', 300, 300, '{600,660,720,780,840,915,990,1065,1140,1160,1180,1200}', 'fit'),
  ('qm:carry_on_15:beginner', 'more', 'rounds_reps', 28023, 570, '{10000,9012,9000,8012,8000,7012,7000,6012,6000,5005,4010,3014}', 'fit'),
  ('qm:carry_on_15:standard', 'more', 'rounds_reps', 24039, 855, '{8000,7020,7000,6020,6000,5020,5000,4020,4000,3019,2037,2016}', 'fit'),
  ('qm:carry_on_15:elite', 'more', 'rounds_reps', 24039, 855, '{7000,6030,6020,6010,6000,5020,5000,4020,4000,3019,2037,2016}', 'fit'),
  ('qm:surge_20_10:beginner', 'more', 'reps', 462, 499, '{36,34,32,29,27,26,25,23,22,19,16,13}', 'fit'),
  ('qm:surge_20_10:standard', 'more', 'reps', 808, 675, '{46,44,42,39,37,35,33,31,29,25,21,17}', 'fit'),
  ('qm:surge_20_10:elite', 'more', 'reps', 808, 675, '{44,42,40,37,35,33,31,29,27,23,20,16}', 'fit'),
  ('qm:midline_lock:beginner', 'more', 'rounds_reps', 8039, 342, '{4000,3030,3020,3010,3000,2030,2020,2010,2000,1029,1019,1008}', 'fit'),
  ('qm:midline_lock:standard', 'more', 'rounds_reps', 13039, 570, '{6000,5030,5020,5010,5000,4030,4020,4010,4000,3019,2037,2016}', 'fit'),
  ('qm:midline_lock:elite', 'more', 'rounds_reps', 13039, 570, '{5000,4030,4020,4010,4000,3030,3020,3010,3000,2024,2008,1032}', 'fit'),
  ('qm:leg_sweep:beginner', 'more', 'rounds_reps', 14033, 456, '{5000,4026,4017,4009,4000,3026,3017,3009,3000,2020,2007,1027}', 'fit'),
  ('qm:leg_sweep:standard', 'more', 'rounds_reps', 18033, 684, '{7000,6017,6000,5017,5000,4026,4017,4009,4000,3016,2032,2014}', 'fit'),
  ('qm:leg_sweep:elite', 'more', 'rounds_reps', 18033, 684, '{6000,5017,5000,4017,4000,3026,3017,3009,3000,2020,2007,1027}', 'fit'),
  ('qm:charge_up_12:beginner', 'more', 'reps', 320, 456, '{112,99,86,73,60,55,50,45,40,35,29,24}', 'fit'),
  ('qm:charge_up_12:standard', 'more', 'reps', 480, 684, '{180,163,146,129,112,99,86,73,60,52,44,36}', 'fit'),
  ('qm:charge_up_12:elite', 'more', 'reps', 480, 684, '{180,163,146,129,112,94,76,58,40,35,29,24}', 'fit'),
  ('qm:oxygen_debt:beginner', 'less', 'seconds', 75, 75, '{150,190,225,265,300,345,390,435,480,520,560,600}', 'fit'),
  ('qm:oxygen_debt:standard', 'less', 'seconds', 75, 75, '{150,195,240,285,330,375,420,465,510,540,570,600}', 'fit'),
  ('qm:oxygen_debt:elite', 'less', 'seconds', 90, 90, '{180,225,270,315,360,405,450,495,540,560,580,600}', 'fit'),
  ('qm:hot_laps:beginner', 'less', 'seconds', 165, 165, '{330,370,405,445,480,540,600,660,720,780,840,900}', 'fit'),
  ('qm:hot_laps:standard', 'less', 'seconds', 225, 225, '{450,505,555,610,660,735,810,885,960,1040,1120,1200}', 'fit'),
  ('qm:hot_laps:elite', 'less', 'seconds', 240, 240, '{480,540,600,660,720,795,870,945,1020,1080,1140,1200}', 'fit'),
  ('qm:bar_fight:beginner', 'more', 'reps', 372, 485, '{35,34,32,31,29,28,27,25,24,21,18,14}', 'fit'),
  ('qm:bar_fight:standard', 'more', 'reps', 544, 713, '{46,44,42,39,37,35,34,32,30,26,22,18}', 'fit'),
  ('qm:bar_fight:elite', 'more', 'reps', 740, 969, '{44,42,40,37,35,33,32,30,28,24,21,17}', 'fit'),
  ('qm:overtime_20:beginner', 'more', 'rounds_reps', 50017, 684, '{18000,16009,15000,13009,12000,11000,10000,9000,8000,6017,5016,4014}', 'fit'),
  ('qm:overtime_20:standard', 'more', 'rounds_reps', 50029, 1140, '{24000,21008,18015,15023,13000,11023,10015,9008,8000,6028,5026,4024}', 'fit'),
  ('qm:overtime_20:elite', 'more', 'rounds_reps', 50029, 1140, '{20000,18000,16000,14000,12000,10023,9015,8008,7000,6002,5004,4006}', 'fit'),
  ('max:boss_rush:beginner', 'more', 'reps', 1200, 153, '{115,108,100,93,85,79,73,66,60,52,44,36}', 'fit'),
  ('max:boss_rush:standard', 'more', 'reps', 1600, 222, '{250,236,223,209,195,180,165,150,135,117,99,81}', 'fit'),
  ('max:boss_rush:elite', 'more', 'reps', 2800, 340, '{530,500,470,440,410,379,348,316,285,247,209,171}', 'fit'),
  ('max:health_bar:beginner', 'more', 'reps', 1220, 153, '{120,114,108,101,95,88,80,73,65,56,48,39}', 'fit'),
  ('max:health_bar:standard', 'more', 'reps', 1836, 222, '{275,259,243,226,210,195,180,165,150,130,110,90}', 'fit'),
  ('max:health_bar:elite', 'more', 'reps', 2448, 266, '{540,509,478,446,415,384,353,321,290,251,213,174}', 'fit'),
  ('max:combo_meter:beginner', 'more', 'reps', 244, 199, '{125,118,110,103,95,88,80,73,65,56,48,39}', 'fit'),
  ('max:combo_meter:standard', 'more', 'reps', 375, 284, '{230,218,205,193,180,166,153,139,125,108,92,75}', 'fit'),
  ('max:combo_meter:elite', 'more', 'reps', 500, 338, '{345,325,305,285,265,245,225,205,185,160,136,111}', 'fit'),
  ('max:tank_mode:beginner', 'more', 'reps', 700, 163, '{85,80,75,70,65,60,55,50,45,39,33,27}', 'fit'),
  ('max:tank_mode:standard', 'more', 'reps', 1050, 237, '{165,156,148,139,130,120,110,100,90,78,66,54}', 'fit'),
  ('max:tank_mode:elite', 'more', 'reps', 1400, 286, '{310,293,275,258,240,221,203,184,165,143,121,99}', 'fit'),
  ('max:dual_wield:beginner', 'more', 'reps', 280, 199, '{105,99,93,86,80,74,68,61,55,48,40,33}', 'fit'),
  ('max:dual_wield:standard', 'more', 'reps', 420, 284, '{230,218,205,193,180,166,153,139,125,108,92,75}', 'fit'),
  ('max:dual_wield:elite', 'more', 'reps', 560, 338, '{380,359,338,316,295,273,250,228,205,178,150,123}', 'fit')
on conflict (board) do update set direction = excluded.direction, unit = excluded.unit, cap = excluded.cap,
  min_seconds = excluded.min_seconds, house = excluded.house, house_kind = excluded.house_kind;
insert into public.board_name_blocklist (word, exact) values
  ('cpu', true),
  ('you', true),
  ('coach', true),
  ('heavybag', true),
  ('speedbag', true),
  ('doubleend', true),
  ('focusmitt', true),
  ('thaipads', true),
  ('waterbag', true),
  ('sliprope', true),
  ('bodypad', true),
  ('wallpad', true),
  ('jumprope', true),
  ('handwrap', true),
  ('mouthguard', true),
  ('kettlebell', true),
  ('sandbag', true),
  ('barbell', true),
  ('medball', true),
  ('dumbbell', true),
  ('trapbar', true),
  ('plyobox', true),
  ('chinbar', true),
  ('sled', true),
  ('abwheel', true),
  ('yogamat', true),
  ('ironplate', true),
  ('treadmill', true),
  ('stopwatch', true),
  ('paceclock', true),
  ('startgun', true),
  ('laptimer', true),
  ('milepost', true),
  ('hurdle', true),
  ('stepbox', true),
  ('watercup', true),
  ('whistle', true),
  ('laneline', true),
  ('cone', true),
  ('trainingmode', false),
  ('admin', false),
  ('official', false),
  ('support', false),
  ('moderator', false),
  ('staff', false),
  ('fuck', false),
  ('shit', false),
  ('cunt', false),
  ('bitch', false),
  ('whore', false),
  ('slut', false),
  ('pussy', false),
  ('penis', false),
  ('vagina', false),
  ('porn', false),
  ('rapist', false),
  ('nazi', false),
  ('hitler', false),
  ('kkk', false),
  ('nigg', false),
  ('fagg', false),
  ('retard', false),
  ('tranny', false),
  ('chink', false),
  ('kike', false),
  ('wetback', false),
  ('dyke', false),
  ('twat', false),
  ('wank', false),
  ('bastard', false),
  ('asshole', false),
  ('molest', false),
  ('pedo', false),
  ('killyou', false),
  ('suicide', false)
on conflict (word) do nothing;
-- END GENERATED
