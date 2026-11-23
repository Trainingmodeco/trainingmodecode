// The score board's migration, applied for real to a local Postgres (PGlite,
// Postgres 17 in WebAssembly, in memory) and checked as each client role
// would meet it. Never the live database.
//
//   PGLITE_DIR=<dir with node_modules/@electric-sql/pglite> npm run -s test:scoreboard-sql
//
// PGlite is not a dependency of the app (27 MB). Install it anywhere once:
//   mkdir -p /tmp/pgtest && cd /tmp/pgtest && npm init -y && npm i @electric-sql/pglite@0.3.8
// and point PGLITE_DIR at that folder (it is also found if a later change adds
// it to the app's devDependencies).
//
// The stand-ins for Supabase: the roles anon, authenticated and service_role;
// an auth schema with auth.users and auth.uid() reading the request's JWT
// subject (request.jwt.claim.sub, as Supabase's does); Supabase's default
// privileges (every new table and function in public granted to anon and
// authenticated, so the migration's revokes are what keeps them out); and a
// cron.schedule() that only records the job (pg_cron is not in PGlite).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
async function loadPGlite() {
  // A plain string, so a missing package is a caught error here, not a lint or build error.
  const pkg = ['@electric-sql', 'pglite'].join('/');
  try { return (await import(pkg)).PGlite; } catch { /* not a dependency */ }
  const dir = process.env.PGLITE_DIR;
  const entry = dir && path.join(dir, 'node_modules/@electric-sql/pglite/dist/index.js');
  if (entry && fs.existsSync(entry)) return (await import(pathToFileURL(entry).href)).PGlite;
  console.error('PGlite not found: set PGLITE_DIR (see the header of scripts/test-scoreboard-sql.mjs).');
  process.exit(2);
}
const PGlite = await loadPGlite();
// PGlite starts first: a global `window` would make it think it runs in a page.
const db = new PGlite();
await db.waitReady;
globalThis.localStorage = globalThis.localStorage || { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis.window || { localStorage: globalThis.localStorage, addEventListener() {}, removeEventListener() {} };
const { composeBoard } = await import(path.join(root, 'components/training-mode/retention/scoreBoards.js'));
const { HOUSE_NAMES, HOUSE_LEVELS } = await import(path.join(root, 'components/training-mode/retention/scoreBoards.js'));
const { boardRules } = await import(path.join(root, 'components/training-mode/data/scoreBoardRules.js'));

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema cron;
  create table cron.job (jobname text primary key, schedule text, command text);
  create function cron.schedule(n text, s text, c text) returns bigint language sql as
    $$ insert into cron.job values (n, s, c) on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command; select 1::bigint $$;
`);

const file = fs.readdirSync(path.join(root, 'supabase/migrations')).find((n) => /_create_score_boards\.sql$/.test(n));
const sql = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');
// pg_cron is the one piece PGlite cannot load; its schedule() is stubbed above.
await db.exec(sql.replace(/^create extension if not exists pg_cron;$/m, '-- (pg_cron stubbed)'));
check(`${file} applies`, true);
// Applying it twice is safe (create … if not exists, create or replace, upserts).
await db.exec(sql.replace(/^create extension if not exists pg_cron;$/m, '-- (pg_cron stubbed)'));
check('the migration applies twice without error', true);

// ── helpers ──────────────────────────────────────────────────────────────────
const U = Object.fromEntries('ABCDEFGHIJKLMN'.split('').map((c, i) => [c, `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`]));
for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, `${k.toLowerCase()}@example.com`]);
let who = null;
async function as(user) {
  who = user;
  await db.exec('reset role');
  if (user === 'admin') return;
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user === 'anon' ? '' : U[user]]);
  await db.exec(`set role ${user === 'anon' ? 'anon' : 'authenticated'}`);
}
async function q(text, params = []) { return (await db.query(text, params)).rows; }
async function one(text, params = []) { const r = await q(text, params); return r[0] ? Object.values(r[0])[0] : undefined; }
async function denied(text, params = []) {
  try { await db.query(text, params); return false; } catch (e) { return /permission denied/i.test(e.message); }
}
async function admin(fn) { const prev = who; await as('admin'); const out = await fn(); if (prev && prev !== 'admin') await as(prev); return out; }
const rpc = (fnCall, params) => one(`select ${fnCall} as r`, params);
// A ticket started `ago` seconds back (the server's clock is real, so the test
// moves the ticket instead of waiting).
async function ticket(user, board, ago = 7200) {
  await as(user);
  const id = await rpc('public.start_board_run($1)', [board]);
  if (id && ago) await admin(() => q("update public.board_runs set started_at = now() - make_interval(secs => $2) where id = $1", [id, ago]));
  await as(user);
  return id;
}
let sess = 0;
const submit = (user, t, value, level = 10, session = `s${++sess}`) => as(user).then(() => rpc('public.submit_score($1, $2, $3, $4)', [t, value, session, level]));
const post = async (user, board, value, opts = {}) => submit(user, await ticket(user, board, opts.ago), value, opts.level ?? 10, opts.session);
const join = (user, name, cc = null) => as(user).then(() => rpc('public.join_boards($1, $2)', [name, cc]));

const FF = 'ff:boxing:3x3r60:normal';
const QM = 'qm:honor_rounds:standard'; // a 'less' (time) board
const ffRules = boardRules(FF);
const qmRules = boardRules(QM);

// ── 1. nobody reads or writes a table directly ───────────────────────────────
const TABLES = ['board_players', 'board_rules', 'board_house', 'board_scores', 'board_runs', 'board_name_blocklist', 'board_flags'];
for (const role of ['anon', 'A']) {
  await as(role);
  for (const t of TABLES) check(`${role === 'A' ? 'a signed-in user' : 'anon'} cannot read ${t}`, await denied(`select * from public.${t}`));
}
await as('A');
check('a user cannot insert a score row', await denied("insert into public.board_scores (board, user_id, value, rank_value, level, session_id) values ($1, $2, 999, -999, 5, 'x')", [FF, U.A]));
check('a user cannot insert a CPU / rules row', await denied("insert into public.board_rules (board, direction, unit, cap, min_seconds, house, house_kind) values ('ff:x:y:z', 'more', 'strikes', 1, 0, '{1,1,1,1,1,1,1,1,1,1,1,1}', 'fight')"));
check('a user cannot rename a house row', await denied("update public.board_house set name = 'ME'"));
check('a user cannot update a player row', await denied("update public.board_players set level = 999"));
check('a user cannot delete scores', await denied('delete from public.board_scores'));
check('a user cannot edit the blocklist', await denied("insert into public.board_name_blocklist values ('zz', false)"));

// ── 2. who may call what ─────────────────────────────────────────────────────
const fnPriv = async (role, sig) => admin(() => one('select has_function_privilege($1, $2, \'execute\')', [role, sig]));
const PUBLIC_FNS = { 'public.get_board(text)': ['anon', 'authenticated'] };
const AUTH_FNS = ['public.get_my_place(text)', 'public.get_board_profile()', 'public.join_boards(text, text)', 'public.set_board_profile(text, text)', 'public.leave_boards()', 'public.start_board_run(text)', 'public.submit_score(uuid, int, text, int)'];
const INTERNAL = ['public.board_name_key(text)', 'public.board_name_problem(text, uuid)', 'public.board_place_of(text, uuid)', 'public.purge_board_runs()'];
for (const [sig, roles] of Object.entries(PUBLIC_FNS)) for (const r of ['anon', 'authenticated']) check(`${r} ${roles.includes(r) ? 'may' : 'may not'} call ${sig}`, (await fnPriv(r, sig)) === roles.includes(r));
for (const sig of AUTH_FNS) {
  check(`authenticated may call ${sig}`, (await fnPriv('authenticated', sig)) === true);
  check(`anon may not call ${sig}`, (await fnPriv('anon', sig)) === false);
}
for (const sig of INTERNAL) for (const r of ['anon', 'authenticated']) check(`${r} may not call ${sig}`, (await fnPriv(r, sig)) === false);
const defs = await admin(() => q("select p.proname, p.prosecdef, p.proconfig, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and (p.proname like '%board%' or p.proname in ('get_my_place', 'submit_score'))"));
check('every board function has a fixed search_path', defs.length >= 12 && defs.every((d) => (d.proconfig || []).some((c) => /^search_path=/.test(c))), JSON.stringify(defs.map((d) => d.proname)));
check('every function a client calls is security definer', defs.filter((d) => !['board_name_key'].includes(d.proname)).every((d) => d.prosecdef));
check('no client function takes a user id (only the internal helpers do)', defs.filter((d) => /uuid/.test(d.args) && !/p_ticket/.test(d.args)).every((d) => ['board_name_problem', 'board_place_of'].includes(d.proname)), JSON.stringify(defs.map((d) => `${d.proname}(${d.args})`)));
await as('anon');
check('anon cannot ask for a ticket', await denied('select public.start_board_run($1)', [FF]));
check('anon cannot post a score', await denied("select public.submit_score(gen_random_uuid(), 10, 'x', 1)"));
check('anon cannot ask for a place', await denied('select public.get_my_place($1)', [FF]));
await as('A');
check('a user cannot run the purge', await denied('select public.purge_board_runs()'));
check('the purge is scheduled hourly', (await admin(() => one("select schedule from cron.job where jobname = 'purge-board-runs'"))) === '41 * * * *');

// ── 3. the rules rows are the app's ──────────────────────────────────────────
const nRules = await admin(() => one('select count(*)::int from public.board_rules'));
check('board_rules holds every board the app knows (203)', nRules === 203, String(nRules));
const ffRow = await admin(() => q('select direction, unit, cap, min_seconds, house, house_kind from public.board_rules where board = $1', [FF]));
check('a fight board row matches the app\'s rules', eq(ffRow[0], { direction: 'more', unit: 'strikes', cap: ffRules.cap, min_seconds: ffRules.minSeconds, house: ffRules.house, house_kind: 'fight' }), JSON.stringify(ffRow[0]));
const houseRows = await admin(() => q("select name, level from public.board_house where kind = 'fit' order by rung"));
check('the house names and levels are the app\'s (gym gear)', eq(houseRows.map((h) => h.name), HOUSE_NAMES.fit) && eq(houseRows.map((h) => h.level), HOUSE_LEVELS));

// ── 4. a new board: anyone reads it, CPU rows only, no ids ───────────────────
await as('anon');
let b = await rpc('public.get_board($1)', [FF]);
check('anon reads a board', b && b.players === 0 && b.rows.length === 10);
check('a new board is ten CPU rows, best first, from the ladder', b.rows.every((r) => r.cpu) && eq(b.rows.map((r) => r.value), ffRules.house.slice(0, 10)) && b.rows[0].name === 'HEAVY BAG' && b.rows[0].level === 26);
check('an unknown board reads as null', (await rpc('public.get_board($1)', ['ff:nope:x:y'])) === null);
const noIds = (board) => !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(JSON.stringify(board)) && !/@example|email|user_id/.test(JSON.stringify(board));
check('get_board carries no user id or email', noIds(b));
check('a CPU row is not stored anywhere: no score rows yet', (await admin(() => one('select count(*)::int from public.board_scores'))) === 0);

// ── 5. tickets and joining ───────────────────────────────────────────────────
await as('A');
const tA = await rpc('public.start_board_run($1)', [FF]);
check('a signed-in user gets a ticket (before joining)', /^[0-9a-f-]{36}$/.test(tA || ''));
check('no ticket for a board that does not exist', (await rpc('public.start_board_run($1)', ['ff:moon:1x1:easy'])) === null);
let res = await submit('A', tA, 500);
check('no post before joining (the ticket is kept)', res.status === 'refused' && res.reason === 'not_joined');
check('…and that ticket is still unused', (await admin(() => one('select used_at from public.board_runs where id = $1', [tA])) ) === null);
const nameTests = [
  ['ab', 'name_invalid'], ['ThirteenChars', 'name_invalid'], ['bad!name', 'name_invalid'], [' Lead', 'name_invalid'], ['two  space', 'name_invalid'], ['...', 'name_invalid'],
  ['CPU', 'name_refused'], ['cpu', 'name_refused'], ['Heavy Bag', 'name_refused'], ['H3AVY_BAG', 'name_refused'], ['You', 'name_refused'],
  ['TheAdmin', 'name_refused'], ['Official1', 'name_refused'], ['Sh1tkicker', 'name_refused'], ['f.u.c.k', 'name_refused'], ['TrainingMode', 'name_refused'],
];
for (const [n, why] of nameTests) {
  res = await join('A', n);
  check(`the name "${n}" is refused (${why})`, res.ok === false && res.reason === why, JSON.stringify(res));
}
check('Grape and Hancock are fine names (no word inside them is blocked)', !(await admin(() => one("select public.board_name_problem('Grape', $1)", [U.A]))) && !(await admin(() => one("select public.board_name_problem('Hancock', $1)", [U.A]))));
res = await join('A', 'Rafa_K', 'us');
check('a good name joins; the country is two capitals', res.ok === true && res.name === 'Rafa_K' && res.country === 'US', JSON.stringify(res));
res = await join('A', 'Another');
check('joining twice answers with the name already there', res.ok === true && res.already === true && res.name === 'Rafa_K');
res = await join('B', 'rafa_k');
check('a name is unique ignoring case', res.ok === false && res.reason === 'name_taken');
res = await join('B', 'Mina', 'USA');
check('a bad country is refused', res.ok === false && res.reason === 'country_invalid');
res = await join('B', 'Mina');
check('a second player joins with no country', res.ok === true && res.country === null);
await as('A');
check('get_board_profile reads my own row only', eq(Object.keys(await rpc('public.get_board_profile()')).sort(), ['country', 'joined_at', 'level', 'name', 'rename_at']) && (await rpc('public.get_board_profile()')).name === 'Rafa_K');
await as('C');
check('…and is null for someone who has not joined', (await rpc('public.get_board_profile()')) === null);

// ── 6. the submit's locks ────────────────────────────────────────────────────
res = await submit('A', tA, 500);
check('too early: a 3 × 3 cannot finish seconds after its ticket', res.status === 'refused' && res.reason === 'too_early', JSON.stringify(res));
res = await submit('A', tA, 500);
check('a ticket answers once (even a refusal spends it)', res.status === 'refused' && res.reason === 'ticket_used');
res = await post('A', FF, ffRules.cap + 1);
check('over the cap (no 1,801 strikes in 9 minutes)', res.status === 'refused' && res.reason === 'over_cap');
res = await post('A', FF, -5);
check('a negative score is refused', res.status === 'refused' && res.reason === 'over_cap');
const tB = await ticket('B', FF);
res = await submit('A', tB, 400);
check("someone else's ticket is no ticket", res.status === 'refused' && res.reason === 'bad_ticket');
res = await submit('A', '00000000-0000-4000-8000-00000000dead', 400);
check('a made-up ticket is refused', res.status === 'refused' && res.reason === 'bad_ticket');
const tOld = await ticket('A', FF, 25 * 3600);
res = await submit('A', tOld, 400);
check('a ticket over 24 hours old has expired', res.status === 'refused' && res.reason === 'ticket_expired');
res = await post('A', FF, 812, { session: 'ses-1' });
check('a good session posts: a new best, first on the board', res.status === 'new_best' && res.first === true && res.best === 812 && res.was === null, JSON.stringify(res));
check('…its answer has my place (4th, under three CPU rows) and the place before (none)', res.place === 4 && res.rank === 1 && res.players === 1 && res.place_before === null, JSON.stringify(res));
res = await post('A', FF, 900, { session: 'ses-1' });
check('one session posts once (the same session id again)', res.status === 'refused' && res.reason === 'session_used');
res = await post('A', FF, 700);
check('a worse score is not a new best, and changes nothing', res.status === 'not_best' && res.best === 812);
res = await post('A', FF, 951);
check('a better score replaces the best (was 812)', res.status === 'new_best' && res.best === 951 && res.was === 812 && res.first === false && res.place_before === 4 && res.place === 2, JSON.stringify(res));
const rowsA = await admin(() => q('select count(*)::int as n, max(value) as v from public.board_scores where user_id = $1', [U.A]));
check('one best per player per board', rowsA[0].n === 1 && rowsA[0].v === 951);
res = await post('B', FF, 868);
check("a player's submit writes only their own row", res.status === 'new_best' && (await admin(() => one('select value from public.board_scores where user_id = $1', [U.A]))) === 951);

// A time board ('less'): a time cannot be longer than the ticket's age, nor under the floor.
await join('C', 'Dre', 'GB');
res = await post('C', QM, qmRules.cap - 1);
check('a time under the board\'s floor is refused', res.status === 'refused' && res.reason === 'over_cap');
res = await post('C', QM, 600, { ago: 400 });
check('a time longer than the time since the ticket is refused', res.status === 'refused' && res.reason === 'too_long');
res = await post('C', QM, 420, { ago: 900 });
check('a good time posts', res.status === 'new_best' && res.best === 420);
res = await post('C', QM, 300, { ago: 900 });
check('a faster time replaces it (less is better)', res.status === 'new_best' && res.was === 420 && res.best === 300);
res = await post('C', QM, 360, { ago: 900 });
check('a slower time does not', res.status === 'not_best' && res.best === 300);

// Flags: near the cap, or a big jump on one's own best. Accepted, and only the service role sees them.
const flags0 = await admin(() => one('select count(*)::int from public.board_flags'));
res = await post('B', FF, Math.ceil(0.96 * ffRules.cap));
check('a score near the cap is accepted', res.status === 'new_best');
const flagRows = await admin(() => q('select reason, value, was from public.board_flags where user_id = $1 order by id', [U.B]));
check('…and flagged near_cap and big_jump (868 → 1,728)', (await admin(() => one('select count(*)::int from public.board_flags'))) === flags0 + 2 && eq(flagRows.map((f) => f.reason).sort(), ['big_jump', 'near_cap']), JSON.stringify(flagRows));
await as('B');
check('a player cannot read the flags', await denied('select * from public.board_flags'));
await admin(() => q('delete from public.board_scores where user_id = $1', [U.B]));
res = await post('B', FF, 868);

// Moderation: a blocked player gets no ticket and posts nothing; a hidden one is off every board.
await admin(() => q("update public.board_players set blocked_until = now() + interval '1 day' where user_id = $1", [U.C]));
await as('C');
check('a blocked player gets no ticket', (await rpc('public.start_board_run($1)', [FF])) === null);
const tC = await admin(async () => one('insert into public.board_runs (user_id, board, started_at) values ($1, $2, now() - interval \'1 hour\') returning id', [U.C, FF]));
res = await submit('C', tC, 500);
check('…and cannot post', res.status === 'refused' && res.reason === 'blocked');
await admin(() => q('update public.board_players set blocked_until = null where user_id = $1', [U.C]));

// The rate limits: 40 tickets a day, 30 scores a day, 6 a board a day.
await join('D', 'Tess');
await admin(() => q("insert into public.board_runs (user_id, board, started_at, used_at, result) select $1, $2, now() - interval '2 hours', now() - interval '1 hour', 'scored' from generate_series(1, 6)", [U.D, FF]));
res = await post('D', FF, 500);
check('6 scores on one board in a day: the 7th is refused (refusals do not count, tickets do)', res.status === 'refused' && res.reason === 'rate_limited');
res = await post('D', 'ff:boxing:3x3r60:hard', 500);
check('…another board still takes one', res.status === 'new_best');
await admin(() => q("insert into public.board_runs (user_id, board, started_at, used_at, result) select $1, 'jt:boxing:bag6x3', now() - interval '2 hours', now() - interval '1 hour', 'scored' from generate_series(1, 23)", [U.D]));
res = await post('D', 'ff:boxing:5x3r60:easy', 500);
check('30 scores in a day: the 31st is refused', res.status === 'refused' && res.reason === 'rate_limited', JSON.stringify(res));
await as('D');
const started = await admin(() => one('select count(*)::int from public.board_runs where user_id = $1 and started_at > now() - interval \'1 day\'', [U.D]));
await admin(() => q("insert into public.board_runs (user_id, board, started_at) select $1, $2, now() - interval '3 hours' from generate_series(1, $3::int)", [U.D, FF, 40 - started]));
await as('D');
check('40 tickets in a day: no 41st', (await rpc('public.start_board_run($1)', [FF])) === null);
await admin(() => q("update public.board_runs set started_at = now() - interval '3 days' where user_id = $1", [U.D]));
const purged = await admin(() => one('select public.purge_board_runs()'));
check('the purge drops tickets older than 2 days', purged >= 40 && (await admin(() => one('select count(*)::int from public.board_runs where user_id = $1', [U.D]))) === 0);

// ── 7. the fade rule, against the app's own composeBoard ─────────────────────
const F2 = 'ff:kickboxing:3x3r60:normal';
const R2 = boardRules(F2);
const house2 = R2.house.map((value, i) => ({ name: HOUSE_NAMES.fight[i], level: HOUSE_LEVELS[i], value }));
const players = [];
async function addPlayer(key, name, value, level, cc = null) {
  await join(key, name, cc);
  const r = await post(key, F2, value, { level });
  players.push({ key, name, level, value, cc });
  return r;
}
const shape = (rows) => rows.map((r) => `${r.place}:${r.cpu ? 'CPU ' : ''}${r.name}:${r.value}`).join(' | ');
async function compare(label, viewer) {
  await as(viewer || 'anon');
  const got = await rpc('public.get_board($1)', [F2]);
  const want = composeBoard({ real: players.map((p, i) => ({ name: p.name, level: p.level, value: p.value, at: i })), house: house2, players: players.length });
  check(`${label}: get_board equals composeBoard`, shape(got.rows) === shape(want), `\n      got  ${shape(got.rows)}\n      want ${shape(want)}`);
  check(`${label}: ${players.length} players counted (never a CPU)`, got.players === players.length);
  check(`${label}: no ids, no emails`, noIds(got));
  return got;
}
await addPlayer('E', 'Kenji.T', 951, 31, 'JP');
await addPlayer('F', 'Noor', 868, 26);
await addPlayer('G', 'Ola', 812, 24, 'NG');
let got = await compare('3 players (fewer than 5: every house score merged)');
check('…places count the CPU rows above (Ola is 6th on the list, 3rd player)', got.rows.find((r) => r.name === 'Ola').place === 6 && got.rows.find((r) => r.name === 'Ola').rank === 3);
await as('G');
let place = await rpc('public.get_my_place($1)', [F2]);
check('get_my_place: place counts the CPU above, rank counts players only', place.place === 6 && place.rank === 3 && place.players === 3 && place.value === 812, JSON.stringify(place));
check('…and the next place needs the row just above (a CPU at 864)', place.next_value === 864);
check('…with no ids in it', noIds(place) && !('set_at' in place));
got = await compare('3 players, seen by one of them', 'G');
check('…the viewer\'s own row is marked you, no one else\'s', got.rows.filter((r) => r.you).length === 1 && got.rows.find((r) => r.you).name === 'Ola');
await addPlayer('H', 'Sam W', 640, 19, 'GB');
await addPlayer('I', 'Tess.R', 500, 21);
got = await compare('5 players (house scores only below the lowest real one)');
check('…every CPU row now sits under the last player', got.rows.filter((r) => r.cpu).every((r) => r.value < 500) && got.rows.slice(0, 5).every((r) => !r.cpu));
await as('H');
place = await rpc('public.get_my_place($1)', [F2]);
check('from 5 players on, place and rank are the same', place.place === place.rank && place.rank === 4 && place.next_value === 812, JSON.stringify(place));
// A tie: whoever set it first is above; the next place needs one more.
await join('J', 'Big Lu');
await post('J', F2, 640, { level: 16 });
players.push({ key: 'J', name: 'Big Lu', level: 16, value: 640 });
await compare('a tie (640, set later, ranks under)');
await as('J');
place = await rpc('public.get_my_place($1)', [F2]);
check('on a tie the earlier score is above', place.rank === 5 && place.next_value === 640);
for (const [k, n, v] of [['K', 'Iker', 455], ['L', 'Mina2', 430], ['M', 'Dre2', 420], ['N', 'Ada', 410]]) { await join(k, n); await post(k, F2, v, { level: 9 }); players.push({ key: k, name: n, level: 9, value: v }); }
got = await compare('10 players (all ten rows real)');
check('…no CPU row left in the ten', got.rows.every((r) => !r.cpu));
// A hidden player is off every board at once; the ones under move up.
await admin(() => q('update public.board_players set hidden = true where user_id = $1', [U.E]));
players.splice(players.findIndex((p) => p.key === 'E'), 1);
got = await compare('a hidden player is off the board');
await as('F');
place = await rpc('public.get_my_place($1)', [F2]);
check('…and the one under them moves up to 1st', place.place === 1 && place.rank === 1 && place.next_value === null);
await admin(() => q('update public.board_players set hidden = false where user_id = $1', [U.E]));
players.unshift({ key: 'E', name: 'Kenji.T', level: 31, value: 951, cc: 'JP' });

// ── 8. the profile ───────────────────────────────────────────────────────────
await as('F');
res = await rpc('public.set_board_profile($1, $2)', ['Noor', 'AE']);
check('the country can change any time', res.ok === true && res.country === 'AE');
res = await rpc('public.set_board_profile($1, $2)', ['Noor.A', 'AE']);
check('a first rename is allowed', res.ok === true && res.name === 'Noor.A');
res = await rpc('public.set_board_profile($1, $2)', ['NoorB', 'AE']);
check('a second rename within a week is refused, with the day it opens', res.ok === false && res.reason === 'too_soon' && !!res.rename_at);
res = await rpc('public.set_board_profile($1, $2)', ['Noor.A', null]);
check('turning the country off takes it off the board', res.ok === true && res.country === null);
await admin(() => q("update public.board_players set name_changed_at = now() - interval '8 days' where user_id = $1", [U.F]));
await as('F');
res = await rpc('public.set_board_profile($1, $2)', ['Kenji.T', null]);
check('a rename to a taken name is refused', res.ok === false && res.reason === 'name_taken');
res = await rpc('public.set_board_profile($1, $2)', ['Dumbbell', null]);
check('a rename to a house name is refused', res.ok === false && res.reason === 'name_refused');
res = await rpc('public.set_board_profile($1, $2)', ['Noor', null]);
check('a rename after a week is allowed', res.ok === true && res.name === 'Noor');
await as('C');
await admin(() => q('delete from public.board_players where user_id = $1', [U.C]));
await as('C');
res = await rpc('public.set_board_profile($1, $2)', ['Dre', null]);
check('set_board_profile needs a player row', res.ok === false && res.reason === 'not_joined');

// ── 9. leaving takes everything ──────────────────────────────────────────────
await as('G');
await rpc('public.start_board_run($1)', [F2]);
const before = await admin(() => q('select (select count(*)::int from public.board_scores where user_id = $1) as s, (select count(*)::int from public.board_runs where user_id = $1) as r', [U.G]));
res = await rpc('public.leave_boards()');
const after = await admin(() => q('select (select count(*)::int from public.board_players where user_id = $1) as p, (select count(*)::int from public.board_scores where user_id = $1) as s, (select count(*)::int from public.board_runs where user_id = $1) as r, (select count(*)::int from public.board_flags where user_id = $1) as f', [U.G]));
check('leave_boards answers with the scores taken off', res.ok === true && res.scores === before[0].s && before[0].s > 0 && before[0].r > 0);
check('…and deletes the player row, every score, ticket and flag', eq(after[0], { p: 0, s: 0, r: 0, f: 0 }), JSON.stringify(after[0]));
players.splice(players.findIndex((p) => p.key === 'G'), 1);
await compare('after a player leaves, the board closes up');
await as('B');
res = await rpc('public.leave_boards()');
check('leaving also takes the flags of mine', (await admin(() => one('select count(*)::int from public.board_flags where user_id = $1', [U.B]))) === 0);
await as('B');
res = await rpc('public.get_my_place($1)', [FF]);
check('after leaving, get_my_place has no score of mine', res && res.value === undefined && typeof res.players === 'number');
// Deleting the account does the same (the rows reference auth.users).
await admin(() => q('delete from auth.users where id = $1', [U.H]));
check('deleting an account deletes its board rows', (await admin(() => one('select count(*)::int from public.board_players where user_id = $1', [U.H]))) === 0);

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
process.exit(fail ? 1 : 0);
