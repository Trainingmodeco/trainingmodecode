import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken, getCurrentUser } from './authClient';
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
//           Offline at the finish, or no answer from the server: the score
//           waits on the phone (a ticket is good for 24 hours) and goes up the
//           next time the app opens or comes back online.
//
// The phone's copies (the opt-in, the name, the boards, the waiting scores)
// belong to one account: they carry its user id, the first call made under
// another account starts them afresh, SIGN OUT clears them (clearBoardCopies),
// and a waiting score goes up only under the account that started it.
//
// Nothing here throws, and nothing here blocks or slows an end screen.

const STATE_KEY = 'tm_score_board_v1';        // { uid, optIn: 'joined'|'later'|null, name, country }
const CACHE_KEY = 'tm_score_boards_cache_v1'; // { [board]: { reply, mine, at } }: the last copy of each board (the state's account)
const QUEUE_KEY = 'tm_score_board_queue_v1';  // [{ ticket, board, value, sessionId, level, at, uid }]
const TICKET_LIFE_MS = 24 * 3600 * 1000;
const TIMEOUT_MS = 8000;

// Where the signed-in athlete's token and user id come from (the tests put stand-ins here).
export const boardIo = { getAccessToken, getUserId: async () => (await getCurrentUser())?.id || null };

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

const BLANK = { optIn: null, name: '', country: null };
export const loadBoardState = () => ({ ...BLANK, ...read(STATE_KEY, {}) });
export function saveBoardState(patch) { const next = { ...loadBoardState(), ...patch }; write(STATE_KEY, next); return next; }

async function userId() { try { return (await boardIo.getUserId()) || null; } catch { return null; } }
// The copies belong to `uid` from now on: another account's are dropped (and
// any from before they carried one). The waiting scores keep their own uid.
function claimFor(uid) {
  if (!uid || read(STATE_KEY, {}).uid === uid) return;
  write(STATE_KEY, { ...BLANK, uid });
  write(CACHE_KEY, {});
}
// SIGN OUT: the name, the opt-in and the boards' copies go. A waiting score
// stays: it goes up only under its own account, inside its 24 hours.
export function clearBoardCopies() {
  try { localStorage.removeItem(STATE_KEY); localStorage.removeItem(CACHE_KEY); } catch { /* storage blocked */ }
}
// The phone's state for the account signed in now (no network call): blank
// when signed out, and another account's copy is dropped first.
export async function boardStateNow() {
  const uid = await userId();
  if (!uid) return { ...BLANK };
  claimFor(uid);
  return loadBoardState();
}

// One call: { ok, data } | { ok: false, signedOut } | { ok: false, offline } | { ok: false, status },
// each with the signed-in account's `uid` (null when signed out).
async function call(name, args, { auth = true } = {}) {
  let token = null;
  try { token = await boardIo.getAccessToken(); } catch { token = null; }
  const uid = token ? await userId() : null;
  claimFor(uid);
  if (auth && !token) return { ok: false, signedOut: true, uid };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, offline: true, uid };
  const headers = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args || {}), signal: ctrl?.signal });
    if (!res.ok) return { ok: false, status: res.status, uid };
    const text = await res.text();
    return { ok: true, data: text ? JSON.parse(text) : null, uid };
  } catch {
    return { ok: false, offline: true, uid };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
// Whether a call that failed may pass on a later try: no answer (offline,
// signed out, timed out) or a passing server state (401 an expired token, 404
// a schema not reloaded yet, 408, 429, 5xx). Any answer, a refusal too, is final.
const mayRetry = (r) => !r.ok && (!!r.offline || !!r.signedOut || !r.status || [401, 404, 408, 429].includes(r.status) || r.status >= 500);

const newSessionId = () => `sb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// ── START ────────────────────────────────────────────────────────────────────
// A handle the session carries to its FINISH: { board, sessionId, startedAt,
// ticket: Promise<{ status: 'ok', ticket } | { status: 'signedOut'|'offline'|'later'|'error' }> }.
// `uid`: the account the ticket was asked under (its score goes up only there).
export function startBoardRun(board) {
  const handle = { board, sessionId: newSessionId(), startedAt: Date.now(), ticket: null, uid: null };
  handle.ticket = (async () => {
    if ((await boardStateNow()).optIn === 'later') return { status: 'later' };
    const r = await call('start_board_run', { p_board: board });
    handle.uid = r.uid || null;
    if (r.signedOut) return { status: 'signedOut' };
    if (r.offline) return { status: 'offline' };
    if (!r.ok || typeof r.data !== 'string' || !r.data) return { status: 'error' };
    return { status: 'ok', ticket: r.data };
  })().catch(() => ({ status: 'error' }));
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
export const dayOf = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// → { ok: true, name, country } | { ok: false, line }. Joining again inside the
// week of a rename (after LEAVE BOARDS) waits like a rename: the line says the day.
export async function joinBoards(name, country) {
  const r = await call('join_boards', { p_name: name, p_country: country || null });
  if (!r.ok || !r.data) return { ok: false, line: failLine(r) };
  if (!r.data.ok) {
    const when = r.data.reason === 'too_soon' && r.data.rename_at ? dayOf(r.data.rename_at) : null;
    const line = when ? `A name changes once a week. You can join again on ${when}.` : NAME_LINES[r.data.reason] || NAME_LINES.name_refused;
    return { ok: false, line, reason: r.data.reason, renameAt: r.data.rename_at || null };
  }
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
// LEAVE BOARDS: every score of mine comes off on the server; the phone forgets
// its copies and this account's waiting scores, and asks no tickets until a new JOIN.
export async function leaveBoards() {
  const r = await call('leave_boards', {});
  if (!r.ok || !r.data?.ok) return { ok: false, line: failLine(r) };
  write(CACHE_KEY, {});
  write(QUEUE_KEY, liveQueue().filter((x) => x.uid && x.uid !== r.uid));
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

// The waiting scores still inside their ticket's 24 hours.
const liveQueue = () => read(QUEUE_KEY, []).filter((x) => x && Date.now() - (x.at || 0) < TICKET_LIFE_MS);
function enqueue(item) {
  const q = liveQueue().filter((x) => x.sessionId !== item.sessionId);
  q.push(item);
  write(QUEUE_KEY, q.slice(-20));
}

// The waiting scores go up now (the app calls this when it opens and when the
// phone comes back online), each only under its own account. One that gets an
// answer (taken or refused) or a final no drops; one that may pass on a later
// try (signed out, offline, an expired token, a busy or failing server) stays
// for its 24 hours. The queue is read again before it is written, so a score
// that finished while this ran is kept.
let flushing = null;
export function flushBoardQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    const uid = await userId();
    if (!uid) return; // signed out: they wait, and nothing is called
    const done = new Set();
    for (const x of liveQueue()) {
      if (x.uid && x.uid !== uid) continue; // another account's: it waits for that account
      const r = await call('submit_score', { p_ticket: x.ticket, p_value: x.value, p_session_id: x.sessionId, p_level: x.level });
      if (!mayRetry(r)) done.add(x.sessionId);
      else if (r.offline || r.signedOut) break; // the rest would meet the same
    }
    write(QUEUE_KEY, liveQueue().filter((x) => !done.has(x.sessionId)));
  })().catch(() => {}).finally(() => { flushing = null; });
  return flushing;
}

// What the end screen shows for one finished session, worked out once (a
// second mount of the same screen reuses it):
//   { kind: 'line', line }      a plain one-line reason
//   { kind: 'optin', ticket }   the first ask, before posting: JOIN posts this
//                               very session (postAfterJoin), NOT NOW goes on (skipAfterAsk)
//   { kind: 'card', board, news, line? }  the HIGH SCORES card, and the full
//                               board too when it is news
//   { kind: 'none' }            nothing (a server error hides it; a score the
//                               server never answered waits on the phone, `queued`)
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
// After JOIN on the first ask: this session goes up now, and the athlete always
// hears back: the board, or a line that says they are on it and what became of
// this score (it went up, it waits for another try, or the board did not take it).
export function postAfterJoin(finish, ticket) {
  return remember(finish, submitAndRead({ ...finish, ticket }).catch(() => ({ kind: 'none' })).then(afterJoin));
}
function afterJoin(r) {
  if (r.kind === 'card' || (r.kind === 'line' && r.line === BOARD_LINES.queued)) return r;
  if (r.posted) return { kind: 'line', line: BOARD_LINES.joinedPosted };
  if (r.queued) return { kind: 'line', line: BOARD_LINES.joinedRetry };
  return { kind: 'line', line: BOARD_LINES.joinedNotPosted };
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
  const queued = mayRetry(r);
  if (queued) enqueue({ ticket, board, value, sessionId: handle.sessionId, level, at: handle.startedAt, uid: r.uid || handle.uid || null });
  if (r.offline) {
    const cached = read(CACHE_KEY, {})[board];
    const view = cached ? localView({ board, cached, value, level }) : null;
    return view ? { kind: 'card', board: view, news: false, line: BOARD_LINES.queued } : { kind: 'line', line: BOARD_LINES.queued };
  }
  if (!r.ok || !r.data) return { kind: 'none', queued };
  const s = r.data;
  if (s.status === 'refused') {
    if (s.reason === 'not_joined') { saveBoardState({ optIn: null }); return { kind: 'line', line: BOARD_LINES.later }; }
    return { kind: 'line', line: BOARD_LINES.refused };
  }
  const read2 = await readBoard(board);
  if (!read2) return { kind: 'none', posted: true };
  const view = boardView({ board, reply: read2.reply, mine: read2.mine, submit: s, value });
  return view ? { kind: 'card', board: view, news: isNews(s) } : { kind: 'none' };
}
