// ── Cloud sync merge ─────────────────────────────────────────────────────────
// Pure functions only: no storage, no network, no clock. cloudSync.js reads the
// device and the cloud row, hands both here, and writes back what comes out.
//
// Why a merge and not "newest snapshot wins": two phones (or Safari and the
// home-screen app, which keep separate storage) can both train offline. The
// whole-snapshot rule kept one and dropped the other's sessions. Here every
// key is merged by what it is, so nothing either device recorded is lost.
//
// Each merge is built so the order of syncs does not matter: merging A into B
// gives the same as B into A, merging twice changes nothing, and any order of
// merges ends on the same value. That is what lets devices that sync in any
// order end up holding the same data.

// The sidecar the merge keeps inside the cloud row: each key's own change time
// (and the time a key was removed). Older app versions only read the keys they
// know, so they ignore it, and a row without it was written by one of them.
export const TIMES_KEY = 'tm_sync_times';

// Every key cloudSync carries, and how it merges. One table so a new key has
// to be placed on purpose.
//   stats       tm_user_stats: sessions are a log (union by id); XP is the
//               sessions' XP plus the bonus ledger kept in `bonus` (see
//               mergeStats). Bonus XP has no session row, so it is counted
//               by counters that only grow.
//   fightStats  lifetime totals and best streak with no log behind them: the
//               larger of each.
//   earliest    map of id -> first time earned (achievements): union, keep
//               the earliest time.
//   arcade      tm_arcade_progress: per series and stage, furthest wins
//               (cleared, stars, paths, best time), attempts are a log.
//   maxMap      map of id -> highest stage cleared: the larger per id.
//   trueMap     map of id -> true (seen once): true if either side is.
//   trueTree    camp level -> slot -> true: true if either side is.
//   maxNumber   one number as text (camp level reached): the larger.
//   flag        set once, never cleared in the app: present wins.
//   set         list of ids done (lessons): union.
//   setMap      map of name -> list of tokens learned: union per name.
//   log         list of rows with an id and a time (cardio sessions): union
//               by id, oldest first, keeps the newest `cap`.
//   logMap      map of name -> rows with no id (weights, benchmarks): union by
//               the whole row, oldest first, keeps the newest `cap` per name.
//   lww         settings and state that can be edited or deleted (profile,
//               saved routines, custom combos, plans, reminders, the paused
//               arcade challenge, ghost shelves): the side changed last wins,
//               by that key's own change time. `max` names fields inside that
//               only ever grow (best combo, ghosts beaten): the larger is kept
//               whichever side wins. `rank` orders states that only move
//               forward (combo days processed) before the clock is looked at.
export const KEY_KINDS = {
  tm_user_stats: { kind: 'stats' },
  tm_user_profile: { kind: 'lww' },
  tm_achievements: { kind: 'earliest' },
  tm_fight_stats: { kind: 'fightStats' },
  tm_arcade_progress: { kind: 'arcade' },
  tm_arcade_v2: { kind: 'maxMap' },
  tm_active_arcade_challenge: { kind: 'lww' },
  tm_arcade_intro_seen: { kind: 'trueMap' },
  tm_camp_progress: { kind: 'maxNumber' },
  tm_camp_sessions: { kind: 'trueTree' },
  tm_camp_complete: { kind: 'flag' },
  tm_camp_archetype: { kind: 'lww' },
  tm_camp_parq: { kind: 'lww' },
  tm_benchmarks: { kind: 'logMap', time: 'date' },
  tm_saved_routines: { kind: 'lww' },
  tm_custom_combos: { kind: 'lww' },
  tm_arsenal: { kind: 'setMap' },
  tm_practice_library_drilled: { kind: 'setMap' },
  tm_practice_invite_v1: { kind: 'lww' },
  tm_ghost_challenge_v1: { kind: 'lww', max: [['beaten']], shape: (v) => !!v && typeof v === 'object' && !Array.isArray(v) },
  tm_comeback_v1: { kind: 'lww' },
  tm_fit_builder_history: { kind: 'lww' },
  tm_cardio_sessions: { kind: 'log', id: 'id', time: 'completedAt', cap: 200 },
  tm_weight_log: { kind: 'logMap', time: 'timestamp', cap: 60 },
  tm_prog_bro: { kind: 'lww' },
  tm_prog_ppl: { kind: 'lww' },
  tm_prog_ul: { kind: 'lww' },
  tm_game_plan_v1: { kind: 'lww' },
  tm_equipment: { kind: 'lww' },
  // Only a real day counts as progress: a missing, empty or odd lastProcessed
  // ranks lowest, and text that is not an object never beats one that is.
  tm_combo_v1: { kind: 'lww', rank: (v) => (typeof v?.lastProcessed === 'string' ? v.lastProcessed : ''), max: [['state', 'longestCombo']], shape: (v) => !!v && typeof v === 'object' && !Array.isArray(v) },
  tm_ghosts_v1: { kind: 'lww' },
  tm_audio_settings: { kind: 'lww' },
  tm_reminder_settings: { kind: 'lww' },
  tm_notification_prefs: { kind: 'lww' },
  tm_starthere_completed: { kind: 'set' },
  trainingModeOnboardingComplete: { kind: 'flag' },
  trainingModeTourComplete: { kind: 'flag' },
  trainingModeStartHereFirstLessonComplete: { kind: 'flag' },
};

// ── small helpers ────────────────────────────────────────────────────────────
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const parse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
// Rows sort by their time, then by their text, so both devices land on the
// same order whatever order the rows arrived in.
function timeOf(row, field) {
  const v = row?.[field];
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : -1;
}
function sortedKeys(...objs) {
  return [...new Set(objs.flatMap((o) => (isObj(o) ? Object.keys(o) : [])))].sort();
}
// The side whose text is larger: a tie-break that does not depend on which
// side is "local", so both devices pick the same.
const larger = (a, b) => (cmpStr(JSON.stringify(a), JSON.stringify(b)) >= 0 ? a : b);
// An object without the fields a merge works out on its own. Picking "the
// rest" from one side compares only these, so the pick never depends on
// fields an earlier merge already changed.
const without = (o, fields) => Object.fromEntries(Object.entries(o).filter(([k]) => !fields.has(k)));

function unionSorted(a, b) {
  const all = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  return [...new Set(all.map((x) => JSON.stringify(x)))].sort().map((s) => JSON.parse(s));
}

// Union of rows by a key, oldest first, newest `cap` kept.
function unionRows(a, b, keyOf, timeField, cap) {
  const byKey = new Map();
  for (const row of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    const k = keyOf(row);
    const prev = byKey.get(k);
    byKey.set(k, prev === undefined ? row : larger(prev, row));
  }
  const rows = [...byKey.values()].sort((x, y) => (timeOf(x, timeField) - timeOf(y, timeField))
    || cmpStr(String(keyOf(x)), String(keyOf(y))));
  return cap && rows.length > cap ? rows.slice(rows.length - cap) : rows;
}

// ── per-kind merges of parsed values ─────────────────────────────────────────
const sessionXp = (sessions) => (Array.isArray(sessions) ? sessions : [])
  .reduce((sum, s) => sum + Math.max(0, num(s?.xpEarned)), 0);

// The bonus ledger inside tm_user_stats:
//   bonus: { legacy: number | null, by: { [counterId]: { p, n } } }
// Bonus XP and penalties have no session row, so the sessions cannot recount
// them. Each device adds what it earned to its own p and what it lost to its
// own n; both only ever grow, so the merge takes the larger of each per
// device and nothing either device did is dropped or counted twice.
// `legacy` is one shared bucket for the bonus that was there before the
// ledger (and anything an older app version adds, since it does not know
// the counters): every device that starts the ledger puts the same
// pre-ledger amount there, so it merges by the larger and counts once. null
// means "no claim" (a device that started from empty stats).
//   xp = max(0, sessionXp + legacy + sum(p - n))
// cleanBy keeps only well-formed counters, in a fixed order.
function cleanBy(by) {
  const out = {};
  if (!isObj(by)) return out;
  for (const id of Object.keys(by).sort()) {
    const c = by[id];
    if (isObj(c)) out[id] = { p: Math.max(0, num(c.p)), n: Math.max(0, num(c.n)) };
  }
  return out;
}
const sumBy = (by) => Object.keys(by).sort().reduce((s, id) => s + (by[id].p - by[id].n), 0);
const rawXp = (sXp, legacy, by) => sXp + (legacy ?? 0) + sumBy(by);
const xpOfRaw = (raw) => Math.max(0, raw);
const hasLegacy = (b) => isObj(b) && (b.legacy === null || Number.isFinite(b.legacy));
// XP is whole numbers in the app; the slack only absorbs rounding in the sums.
const sameXp = (a, b) => Math.abs(a - b) < 1e-6;

// What one side's stats say about the bonus part. A side whose XP matches
// its own ledger is taken as it is. One that does not was changed by code
// that does not keep the ledger (an older app version, or stats from before
// it): the part its sessions and counters do not explain is its claim on
// the shared bucket.
function bonusOf(st) {
  const b = isObj(st.bonus) ? st.bonus : null;
  const by = cleanBy(b?.by);
  const xp = Math.max(0, num(st.xp));
  const sXp = sessionXp(st.sessions);
  if (hasLegacy(b) && sameXp(xp, xpOfRaw(rawXp(sXp, b.legacy, by)))) return { has: true, legacy: b.legacy, by };
  return { has: !!b, legacy: xp - sXp - sumBy(by), by };
}

// `own`: the cloud side (b) is this device's own last upload from before the
// ledger, so its bonus part is an older copy of this device's own, not
// news; the device's present amount stands (an offline penalty taken before
// the update stays taken). Sessions still merge as always.
function mergeStats(a, b, _spec, own = false) {
  const sessions = unionRows(a.sessions, b.sessions, (s) => (s && s.id != null ? `id:${s.id}` : `row:${JSON.stringify(s)}`), 'completedAt');
  const ka = bonusOf(a);
  const kb = bonusOf(b);
  const claims = [ka.legacy, own && !kb.has ? null : kb.legacy].filter(Number.isFinite);
  const legacy = claims.length ? Math.max(...claims) : null;
  const by = {};
  for (const id of sortedKeys(ka.by, kb.by)) {
    const x = ka.by[id] || { p: 0, n: 0 }; const y = kb.by[id] || { p: 0, n: 0 };
    by[id] = { p: Math.max(x.p, y.p), n: Math.max(x.n, y.n) };
  }
  const { xp: _xa, sessions: _sa, bonus: _ba, ...restA } = a;
  const { xp: _xb, sessions: _sb, bonus: _bb, ...restB } = b;
  const out = { ...larger(restA, restB), xp: xpOfRaw(rawXp(sessionXp(sessions), legacy, by)), sessions };
  // Stats that never had a ledger (older versions only) stay as they were.
  if (ka.has || kb.has) out.bonus = { legacy, by };
  return out;
}

// A device's own stats, brought in line with its ledger before it syncs.
// XP that its sessions and counters do not explain was earned or lost on
// this device since it last looked (bonus XP, penalties, or any code that
// changes xp directly), so it goes on this device's own counter.
//   first:   the first look on this device in this version. Everything so
//            far predates the ledger: it goes to the shared bucket.
//   id:      this device's counter.
//   freshId: used when stats have no ledger although this device keeps one
//            (stats started again from empty); a new counter, so nothing
//            the old counter already holds can be counted again.
// Returns { text, id }: the stats text to keep (the same text when nothing
// changed) and the counter id to use from now on.
export function ledgerStats(text, { id, first = false, freshId = id } = {}) {
  const st = parse(text);
  if (!isObj(st) || !Array.isArray(st.sessions)) return { text, id };
  const b = isObj(st.bonus) ? st.bonus : null;
  const xp = Math.max(0, num(st.xp));
  const sXp = sessionXp(st.sessions);
  let by = cleanBy(b?.by);
  let legacy;
  let useId = id;
  if (first) legacy = xp - sXp - sumBy(by);
  else if (!b) { legacy = null; by = {}; useId = freshId; }
  else legacy = hasLegacy(b) ? b.legacy : xp - sXp - sumBy(by);
  const raw = rawXp(sXp, legacy, by);
  if (!first && !sameXp(xp, xpOfRaw(raw))) {
    const delta = xp > 0 ? xp - raw : -raw;
    const c = by[useId] || { p: 0, n: 0 };
    by = cleanBy({ ...by, [useId]: { p: c.p + Math.max(0, delta), n: c.n + Math.max(0, -delta) } });
  }
  const bonus = { legacy, by };
  if (b && st.xp === xp && JSON.stringify(b) === JSON.stringify(bonus)) return { text, id: useId };
  return { text: JSON.stringify({ ...st, xp, bonus }), id: useId };
}

// Merged stats that have no ledger yet (both sides came from older
// versions) get one before they land on a device that keeps it, with
// everything so far in the shared bucket. XP does not change.
export function withLedger(text) {
  const st = parse(text);
  if (!isObj(st) || !Array.isArray(st.sessions) || isObj(st.bonus)) return text;
  return ledgerStats(text, { first: true }).text;
}

function mergeFightStats(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const fields = new Set(['rounds', 'strikes', 'bestStreak', 'sessions']);
  const out = { ...larger(without(a, fields), without(b, fields)) };
  for (const f of fields) {
    if (f in a || f in b) out[f] = Math.max(num(a[f]), num(b[f]));
  }
  return out;
}

function mergeEarliest(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) {
    const x = a[k]; const y = b[k];
    if (x === undefined || y === undefined) out[k] = x === undefined ? y : x;
    else if (typeof x === 'string' && typeof y === 'string') out[k] = cmpStr(x, y) <= 0 ? x : y;
    else out[k] = typeof x === 'string' ? x : typeof y === 'string' ? y : larger(x, y);
  }
  return out;
}

function mergeMaxMap(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) out[k] = k in a && k in b ? Math.max(num(a[k]), num(b[k])) : (k in a ? a[k] : b[k]);
  return out;
}

function mergeTrueMap(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) {
    if (a[k] === true || b[k] === true) out[k] = true;
    else out[k] = k in a && k in b ? larger(a[k], b[k]) : (k in a ? a[k] : b[k]);
  }
  return out;
}

function mergeTrueTree(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) {
    out[k] = isObj(a[k]) && isObj(b[k]) ? mergeTrueMap(a[k], b[k]) : (k in a && k in b ? larger(a[k], b[k]) : (k in a ? a[k] : b[k]));
  }
  return out;
}

function mergeSetMap(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) {
    out[k] = Array.isArray(a[k]) && Array.isArray(b[k]) ? unionSorted(a[k], b[k]) : (k in a && k in b ? larger(a[k], b[k]) : (k in a ? a[k] : b[k]));
  }
  return out;
}

function mergeLogMap(a, b, spec) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) {
    out[k] = Array.isArray(a[k]) && Array.isArray(b[k])
      ? unionRows(a[k], b[k], (r) => JSON.stringify(r), spec.time, spec.cap)
      : (k in a && k in b ? larger(a[k], b[k]) : (k in a ? a[k] : b[k]));
  }
  return out;
}

// One stage of one arcade series: cleared stays cleared, stars and paths only
// grow, the best time is the fastest. The rest comes from the later clear.
const STAGE_MERGED = new Set(['fit', 'fight', 'completed', 'completedAt', 'bestTimeSeconds', 'paths', 'stars']);
function mergeStage(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const ta = num(a.completedAt); const tb = num(b.completedAt);
  const ra = without(a, STAGE_MERGED); const rb = without(b, STAGE_MERGED);
  const out = { ...(ta === tb ? larger(ra, rb) : (ta > tb ? ra : rb)) };
  for (const f of ['fit', 'fight', 'completed']) if (a[f] === true || b[f] === true) out[f] = true;
  if ('completedAt' in a || 'completedAt' in b) out.completedAt = Math.max(ta, tb);
  const bests = [a.bestTimeSeconds, b.bestTimeSeconds].filter(Number.isFinite);
  if (bests.length) out.bestTimeSeconds = Math.min(...bests);
  if (Array.isArray(a.paths) || Array.isArray(b.paths)) out.paths = unionSorted(a.paths, b.paths);
  const stars = Math.max(num(a.stars), num(b.stars), out.paths?.length ? Math.min(3, out.paths.length) : 0);
  if (stars > 0) out.stars = stars;
  return out;
}

const SERIES_MERGED = new Set(['completedStages', 'unlockedStages', 'currentStage', 'xpEarned', 'badges', 'statXp', 'attempts']);
function seriesActivity(s) {
  const times = [
    ...(Array.isArray(s.attempts) ? s.attempts.map((x) => num(x?.at)) : []),
    ...Object.values(isObj(s.completedStages) ? s.completedStages : {}).map((x) => num(x?.completedAt)),
  ];
  return times.length ? Math.max(...times) : 0;
}

function mergeSeries(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  // Last-played fields (last stage, title, settings) follow the series that
  // was played most recently.
  const ra = without(a, SERIES_MERGED); const rb = without(b, SERIES_MERGED);
  const aa = seriesActivity(a); const ab = seriesActivity(b);
  const out = { ...(aa === ab ? larger(ra, rb) : (aa > ab ? ra : rb)) };

  const stagesA = isObj(a.completedStages) ? a.completedStages : {};
  const stagesB = isObj(b.completedStages) ? b.completedStages : {};
  const completedStages = {};
  for (const k of sortedKeys(stagesA, stagesB)) completedStages[k] = mergeStage(stagesA[k], stagesB[k]);
  out.completedStages = completedStages;
  const cleared = Object.values(completedStages).filter((s) => s?.completed).length;
  if ('currentStage' in a || 'currentStage' in b) out.currentStage = Math.max(num(a.currentStage), num(b.currentStage), cleared + 1);
  if (Array.isArray(a.unlockedStages) || Array.isArray(b.unlockedStages)) {
    const list = (v) => (Array.isArray(v) ? v : []);
    const nums = new Set([...list(a.unlockedStages), ...list(b.unlockedStages)].map(num));
    for (let i = 1; i <= cleared + 1; i++) nums.add(i);
    out.unlockedStages = [...nums].sort((x, y) => x - y);
  }
  if ('xpEarned' in a || 'xpEarned' in b) out.xpEarned = Math.max(num(a.xpEarned), num(b.xpEarned));
  if (Array.isArray(a.badges) || Array.isArray(b.badges)) out.badges = unionSorted(a.badges, b.badges);
  if (isObj(a.statXp) || isObj(b.statXp)) out.statXp = mergeMaxMap(isObj(a.statXp) ? a.statXp : {}, isObj(b.statXp) ? b.statXp : {});
  if (Array.isArray(a.attempts) || Array.isArray(b.attempts)) out.attempts = unionRows(a.attempts, b.attempts, (r) => JSON.stringify(r), 'at', 100);
  return out;
}

function mergeArcade(a, b) {
  if (!isObj(a)) return b;
  if (!isObj(b)) return a;
  const out = {};
  for (const k of sortedKeys(a, b)) out[k] = mergeSeries(a[k], b[k]);
  return out;
}

// The shape each merged kind must parse to. Text that does not (garbage,
// 'null', a list where a map belongs) is no news: the other side is kept.
const SHAPES = {
  stats: (v) => isObj(v) && Array.isArray(v.sessions),
  fightStats: isObj,
  earliest: isObj,
  arcade: isObj,
  maxMap: isObj,
  trueMap: isObj,
  trueTree: isObj,
  set: Array.isArray,
  setMap: isObj,
  log: Array.isArray,
  logMap: isObj,
};

const PARSED_MERGES = {
  stats: mergeStats,
  fightStats: mergeFightStats,
  earliest: mergeEarliest,
  arcade: mergeArcade,
  maxMap: mergeMaxMap,
  trueMap: mergeTrueMap,
  trueTree: mergeTrueTree,
  set: (a, b) => (Array.isArray(a) && Array.isArray(b) ? unionSorted(a, b) : (Array.isArray(a) ? a : b)),
  setMap: mergeSetMap,
  log: (a, b, spec) => (Array.isArray(a) && Array.isArray(b)
    ? unionRows(a, b, (r) => (r && r[spec.id] != null ? `id:${r[spec.id]}` : `row:${JSON.stringify(r)}`), spec.time, spec.cap)
    : (Array.isArray(a) ? a : b)),
  logMap: mergeLogMap,
};

// ── last-writer-wins, by the key's own change time ───────────────────────────
// An entry is { v: text or null (removed / never had it), t: change time or
// -Infinity when there is no time at all }.
function getPath(o, path) { return path.reduce((x, k) => (isObj(x) ? x[k] : undefined), o); }
function setPath(o, path, val) {
  let x = o;
  for (const k of path.slice(0, -1)) { if (!isObj(x[k])) return; x = x[k]; }
  x[path[path.length - 1]] = val;
}
function lwwEntry(x0, y0, spec) {
  // A key with grow-only fields is never removed in the app; treating a
  // removal as "no news" keeps those fields from being lost with it.
  const x = spec.max && x0.v == null ? { v: null, t: -Infinity } : x0;
  const y = spec.max && y0.v == null ? { v: null, t: -Infinity } : y0;
  const px = x.v == null ? undefined : parse(x.v);
  const py = y.v == null ? undefined : parse(y.v);
  const rank = (p) => (spec.rank && p !== undefined ? spec.rank(p) : '');
  // A side that parses to the key's shape beats one that does not, whatever
  // the clocks say (a newer 'null' must not replace real state).
  const fit = (e, p) => (spec.shape && e.v != null && spec.shape(p) ? 1 : 0);
  // Compared without the grow-only fields, so raising those never changes
  // which side wins.
  const tieText = (e, p) => {
    if (e.v == null) return '';
    if (!spec.max || p === undefined) return e.v;
    const c = parse(e.v);
    if (!isObj(c)) return e.v;
    for (const path of spec.max) setPath(c, path, null);
    return JSON.stringify(c);
  };
  let win = (fit(x, px) - fit(y, py)) || cmpStr(rank(px), rank(py)) || (x.t === y.t ? 0 : (x.t > y.t ? 1 : -1)) || cmpStr(tieText(x, px), tieText(y, py));
  if (win === 0) win = 1;
  const w = win > 0 ? x : y;
  if (w.v == null || !spec.max) return w;
  const out = parse(w.v);
  if (!isObj(out)) return w;
  for (const path of spec.max) {
    const vals = [getPath(px, path), getPath(py, path)].filter((n) => Number.isFinite(n));
    if (vals.length) setPath(out, path, Math.max(...vals));
  }
  return { v: JSON.stringify(out), t: w.t };
}

// ── one key ──────────────────────────────────────────────────────────────────
// x and y are { v, t } for the same key on two sides. Returns { v, t }.
// `opts.own`: see mergeStats (tm_user_stats only).
export function mergeKey(key, x, y, opts = {}) {
  const spec = KEY_KINDS[key] || { kind: 'lww' };
  const t = Math.max(x.t, y.t);
  if (spec.kind === 'lww') return lwwEntry(x, y, spec);
  // A key missing on one side carries no news: keep the other side as it is.
  if (x.v == null) return { v: y.v, t };
  if (y.v == null || x.v === y.v) return { v: x.v, t };
  if (spec.kind === 'flag') return { v: cmpStr(x.v, y.v) >= 0 ? x.v : y.v, t };
  if (spec.kind === 'maxNumber') {
    const a = parseInt(x.v, 10); const b = parseInt(y.v, 10);
    if (Number.isFinite(a) && Number.isFinite(b)) return { v: String(Math.max(a, b)), t };
    if (Number.isFinite(a) !== Number.isFinite(b)) return { v: Number.isFinite(a) ? x.v : y.v, t };
    return lwwEntry(x, y, spec);
  }
  const fn = PARSED_MERGES[spec.kind];
  const shape = SHAPES[spec.kind];
  if (!fn || !shape) return lwwEntry(x, y, spec);
  const a = parse(x.v); const b = parse(y.v);
  const okA = shape(a); const okB = shape(b);
  if (okA && okB) return { v: JSON.stringify(fn(a, b, spec, key === 'tm_user_stats' && !!opts.own)), t };
  // Only one side holds real data: keep it, however new the other text is.
  if (okA !== okB) return { v: okA ? x.v : y.v, t };
  // Neither does: nothing to merge field by field, so the side changed last.
  return lwwEntry(x, y, spec);
}

// The same data in one fixed form (sorted sets, rows in time order, fields in
// merge order). Two texts that normalize alike hold the same data, which is
// how the sync tells "nothing new" from "something to write" without
// rewriting a device's own text just to reorder it.
export function normalize(key, text) {
  if (typeof text !== 'string') return text;
  const spec = KEY_KINDS[key] || { kind: 'lww' };
  if (spec.kind === 'lww' || spec.kind === 'flag') return text;
  if (spec.kind === 'maxNumber') { const n = parseInt(text, 10); return Number.isFinite(n) ? String(n) : text; }
  const a = parse(text);
  const fn = PARSED_MERGES[spec.kind];
  if (!fn || !SHAPES[spec.kind]?.(a)) return text;
  return JSON.stringify(fn(a, a, spec));
}

// Whole snapshots. local / cloud: { key: text }. localTimes / cloudTimes:
// { key: change time }; a time with no value is a removal. Returns the merged
// snapshot, its times, and the keys to remove from the device.
// ownStats: the cloud's stats are this device's own last upload (mergeStats).
export function mergeSnapshots(local, cloud, { keys, localTimes = {}, cloudTimes = {}, ownStats = false } = {}) {
  const merged = {};
  const times = {};
  const removed = [];
  const tOf = (times0, k) => (Number.isFinite(times0[k]) ? times0[k] : -Infinity);
  for (const k of keys || sortedKeys(local, cloud)) {
    const x = { v: typeof local[k] === 'string' ? local[k] : null, t: tOf(localTimes, k) };
    const y = { v: typeof cloud[k] === 'string' ? cloud[k] : null, t: tOf(cloudTimes, k) };
    if (x.v == null && y.v == null && x.t === -Infinity && y.t === -Infinity) continue;
    const r = mergeKey(k, x, y, { own: ownStats });
    if (Number.isFinite(r.t)) times[k] = r.t;
    if (r.v == null) { if (x.v != null) removed.push(k); } else merged[k] = r.v;
  }
  return { merged, times, removed };
}
