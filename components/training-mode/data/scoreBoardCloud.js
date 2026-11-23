import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken } from './authClient';
import { boardRules, boardView, localView, isNews, BOARD_LINES } from './scoreBoardRules';

// The world score board's client (switch `scores`, data/retentionFlags): the
// server's functions (supabase/migrations/…_create_score_boards.sql) called
// the way ghost sharing calls its own (data/ghostCloud.js): PostgREST's RPC
// endpoint, the public key, and the signed-in athlete's token.
//
//   START   startBoardRun(board) asks for a ticket in the background; the
//           session never waits for it. Signed out, offline, or after NOT NOW:
//           no ticket, and the end screen says so in one line.
//   FINISH  finishBoardRun(finish) (once per session): join first if the
//           athlete just said JOIN, submit, then read the board and my place.
//           Offline at the finish: the score waits on the phone (a ticket is
//           good for 24 hours) and goes up the next time the app is online.
//
// Nothing here throws, and nothing here blocks or slows an end screen.

const STATE_KEY = 'tm_score_board_v1';        // { optIn: 'joined'|'later'|null, name, country }
const CACHE_KEY = 'tm_score_boards_cache_v1'; // { [board]: { reply, mine, at } }: the last copy of each board
const QUEUE_KEY = 'tm_score_board_queue_v1';  // [{ ticket, board, value, sessionId, level, at }]
const TICKET_LIFE_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 8000;

// Where the signed-in athlete's token comes from (the tests put a stand-in here).
export const boardIo = { getAccessToken };

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export const loadBoardState = () => ({ optIn: null, name: '', country: null, ...read(STATE_KEY, {}) });
export function saveBoardState(patch) { const next = { ...loadBoardState(), ...patch }; write(STATE_KEY, next); return next; }

// One call: { ok, data } | { ok: false, signedOut } | { ok: false, offline } | { ok: false, status }.
async function call(name, args, { auth = true } = {}) {
  let token = null;
  try { token = await boardIo.getAccessToken(); } catch { token = null; }
  if (auth && !token) return { ok: false, signedOut: true };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, offline: true };
  const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args || {}), signal: ctrl?.signal });
    if (!res.ok) return { ok: false, status: res.status };
    const text = await res.text();
    return { ok: true, data: text ? JSON.parse(text) : null };
  } catch {
    return { ok: false, offline: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const newSessionId = () => `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ── START ────────────────────────────────────────────────────────────────────
// A handle the session carries to its FINISH: { board, sessionId, startedAt,
// ticket: Promise<{ status: 'ok', ticket } | { status: 'signedOut'|'offline'|'later'|'error' }> }.
export function startBoardRun(board) {
  const handle = { board, sessionId: newSessionId(), startedAt: Date.now(), ticket: null };
  if (loadBoardState().optIn === 'later') { handle.ticket = Promise.resolve({ status: 'later' }); return handle; }
  handle.ticket = call('start_board_run', { p_board: board }).then((r) => {
    if (r.signedOut) return { status: 'signedOut' };
    if (r.offline) return { status: 'offline' };
    if (!r.ok || typeof r.data !== 'string' || !r.data) return { status: 'error' };
    return { status: 'ok', ticket: r.data };
  }, () => ({ status: 'error' }));
  return handle;
}

// ── the profile ──────────────────────────────────────────────────────────────
// { status: 'joined', profile } | 'none' | 'signedOut' | 'offline' | 'error'.
export async function fetchBoardProfile() {
  const r = await call('get_board_profile', {});
  if (r.signedOut) return { status: 'signedOut' };
  if (r.offline) return { status: 'offline' };
  if (!r.ok) return { status: 'error' };
  if (!r.data) {
    if (loadBoardState().optIn === 'joined') saveBoardState({ optIn: null });
    return { status: 'none' };
  }
  saveBoardState({ optIn: 'joined', name: r.data.name, country: r.data.country || null });
  return { status: 'joined', profile: r.data };
}

// The plain line for a refused name or country.
export const NAME_LINES = {
  name_invalid: 'Use 3 to 12 letters, numbers, spaces, dots, dashes or underscores.',
  name_refused: 'Pick another name.',
  name_taken: 'That name is taken. Pick another name.',
  country_invalid: 'That country code is not right.',
  too_soon: 'You can change your name once a week.',
  not_joined: 'Join the world board first.',
  offline: "You're offline. Try again in a moment.",
  signedOut: 'Sign in on Profile first.',
  error: 'The board is not answering. Try again later.',
};
const failLine = (r) => (r.signedOut ? NAME_LINES.signedOut : r.offline ? NAME_LINES.offline : NAME_LINES.error);

// → { ok: true, name, country } | { ok: false, line }.
export async function joinBoards(name, country) {
  const r = await call('join_boards', { p_name: name, p_country: country || null });
  if (!r.ok || !r.data) return { ok: false, line: failLine(r) };
  if (!r.data.ok) return { ok: false, line: NAME_LINES[r.data.reason] || NAME_LINES.name_refused, reason: r.data.reason };
  saveBoardState({ optIn: 'joined', name: r.data.name, country: r.data.country || null });
  return { ok: true, name: r.data.name, country: r.data.country || null };
}
export async function setBoardProfile(name, country) {
  const r = await call('set_board_profile', { p_name: name, p_country: country || null });
  if (!r.ok || !r.data) return { ok: false, line: failLine(r) };
  if (!r.data.ok) return { ok: false, line: NAME_LINES[r.data.reason] || NAME_LINES.name_refused, reason: r.data.reason, renameAt: r.data.rename_at || null };
  saveBoardState({ optIn: 'joined', name: r.data.name, country: r.data.country || null });
  return { ok: true, name: r.data.name, country: r.data.country || null };
}
// LEAVE BOARDS: everything of mine comes off on the server; the phone forgets
// its copies and its waiting scores, and asks no tickets until a new JOIN.
export async function leaveBoards() {
  const r = await call('leave_boards', {});
  if (!r.ok || !r.data?.ok) return { ok: false, line: failLine(r) };
  write(CACHE_KEY, {});
  write(QUEUE_KEY, []);
  saveBoardState({ optIn: 'later', name: '', country: null });
  return { ok: true, scores: r.data.scores || 0 };
}
// NOT NOW on the first ask: no tickets until the athlete joins from Profile.
export const declineBoards = () => saveBoardState({ optIn: 'later' });

// ── FINISH ───────────────────────────────────────────────────────────────────
async function readBoard(board, { mine = true } = {}) {
  const [b, m] = await Promise.all([call('get_board', { p_board: board }, { auth: false }), mine ? call('get_my_place', { p_board: board }) : Promise.resolve({ ok: true, data: null })]);
  if (!b.ok || !b.data) return null;
  const cache = read(CACHE_KEY, {});
  const entry = { reply: b.data, mine: m.ok ? m.data : null, at: Date.now() };
  cache[board] = entry;
  write(CACHE_KEY, cache);
  return entry;
}

function enqueue(item) {
  const q = read(QUEUE_KEY, []).filter((x) => x && Date.now() - (x.at || 0) < TICKET_LIFE_MS && x.sessionId !== item.sessionId);
  q.push(item);
  write(QUEUE_KEY, q.slice(-20));
}

// The scores that finished offline go up now (the app calls this when it
// opens and when the phone comes back online). Spent or refused ones drop.
let flushing = null;
export function flushBoardQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    const q = read(QUEUE_KEY, []).filter((x) => x && Date.now() - (x.at || 0) < TICKET_LIFE_MS);
    const keep = [];
    for (const x of q) {
      const r = await call('submit_score', { p_ticket: x.ticket, p_value: x.value, p_session_id: x.sessionId, p_level: x.level });
      if (r.offline) keep.push(x);
    }
    write(QUEUE_KEY, keep);
  })().finally(() => { flushing = null; });
  return flushing;
}

// What the end screen shows for one finished session, worked out once (a
// second mount of the same screen reuses it):
//   { kind: 'line', line }      a plain one-line reason
//   { kind: 'optin', ticket }   the first ask, before posting: JOIN posts this
//                               very session (postAfterJoin), NOT NOW goes on (skipAfterAsk)
//   { kind: 'card', board, news, line? }  the HIGH SCORES card, and the full
//                               board too when it is news
//   { kind: 'none' }            nothing (a server error hides it)
// `finish`: { board, value, level, handle } or { reason } (App, from data/scoreBoardRules).
const RUNS = new Map();
const runId = (finish) => finish?.handle?.sessionId || null;
const remember = (finish, p) => {
  const id = runId(finish);
  if (id) { RUNS.set(id, p); if (RUNS.size > 20) RUNS.delete(RUNS.keys().next().value); }
  return p;
};
export function finishBoardRun(finish) {
  const id = runId(finish);
  if (id && RUNS.has(id)) return RUNS.get(id);
  return remember(finish, runFinish(finish).catch(() => ({ kind: 'none' })));
}
// After JOIN on the first ask: this session goes up now.
export function postAfterJoin(finish, ticket) {
  return remember(finish, submitAndRead({ ...finish, ticket }).catch(() => ({ kind: 'none' })));
}
// After NOT NOW: no tickets until the athlete joins from Profile.
export function skipAfterAsk(finish) {
  declineBoards();
  const res = { kind: 'line', line: BOARD_LINES.later };
  remember(finish, Promise.resolve(res));
  return res;
}

async function runFinish(finish) {
  if (!finish) return { kind: 'none' };
  if (!finish.handle) return finish.reason ? { kind: 'line', line: finish.reason } : { kind: 'none' };
  const { board } = finish;
  if (!boardRules(board)) return { kind: 'none' };
  const t = await finish.handle.ticket;
  if (t.status === 'later') return { kind: 'line', line: BOARD_LINES.later };
  if (t.status === 'signedOut') return { kind: 'line', line: BOARD_LINES.signedOut };
  if (t.status === 'offline') return { kind: 'line', line: BOARD_LINES.offline };
  if (t.status !== 'ok') return { kind: 'none' };
  if (loadBoardState().optIn !== 'joined') {
    const prof = await fetchBoardProfile();
    if (prof.status === 'offline') return { kind: 'line', line: BOARD_LINES.offlineNow };
    if (prof.status === 'none') return { kind: 'optin', ticket: t.ticket };
    if (prof.status !== 'joined') return { kind: 'none' };
  }
  return submitAndRead({ ...finish, ticket: t.ticket });
}

async function submitAndRead({ board, value, level, handle, ticket }) {
  const r = await call('submit_score', { p_ticket: ticket, p_value: value, p_session_id: handle.sessionId, p_level: level });
  if (r.offline) {
    enqueue({ ticket, board, value, sessionId: handle.sessionId, level, at: handle.startedAt });
    const cached = read(CACHE_KEY, {})[board];
    const view = cached ? localView({ board, cached, value, level }) : null;
    return view ? { kind: 'card', board: view, news: false, line: BOARD_LINES.queued } : { kind: 'line', line: BOARD_LINES.queued };
  }
  if (!r.ok || !r.data) return { kind: 'none' };
  const s = r.data;
  if (s.status === 'refused') {
    if (s.reason === 'not_joined') { saveBoardState({ optIn: null }); return { kind: 'line', line: BOARD_LINES.later }; }
    return { kind: 'line', line: BOARD_LINES.refused };
  }
  const read2 = await readBoard(board);
  if (!read2) return { kind: 'none' };
  const view = boardView({ board, reply: read2.reply, mine: read2.mine, submit: s, value });
  return view ? { kind: 'card', board: view, news: isNews(s) } : { kind: 'none' };
}
