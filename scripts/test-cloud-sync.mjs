// Cloud sync: devices that train offline and sync in any order keep every
// session, never count one twice, never lose a level, and end up holding the
// same data as the cloud. Runs the real data/cloudSync.js against a fake
// cloud and fake devices, with a seeded random sweep of training and sync
// orders. Run with `npm run test:sync`.

// ── fake browser, one storage per device ─────────────────────────────────────
let store = new Map();
let sess = new Map();
// localStorage can be given a quota in bytes (two a character, as browsers
// count), and reads of each key are counted.
let quota = Infinity;
const bytesUsed = (m = store) => { let n = 0; for (const [k, v] of m) n += 2 * (k.length + v.length); return n; };
const reads = new Map();
const mkStorage = (get, limited = false) => ({
  getItem: (k) => { if (limited) reads.set(k, (reads.get(k) || 0) + 1); return get().has(k) ? get().get(k) : null; },
  setItem: (k, v) => {
    v = String(v);
    if (limited && quota !== Infinity) {
      const m = get(); const prev = m.get(k);
      const next = bytesUsed(m) - (prev != null ? 2 * (k.length + prev.length) : 0) + 2 * (k.length + v.length);
      if (next > quota) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
    }
    get().set(k, v);
  },
  removeItem: (k) => { get().delete(k); },
  clear: () => get().clear(),
  key: (i) => [...get().keys()][i] ?? null,
  get length() { return get().size; },
});
globalThis.localStorage = mkStorage(() => store, true);
globalThis.sessionStorage = mkStorage(() => sess);
globalThis.window = globalThis;
window.addEventListener = () => {};
window.removeEventListener = () => {};
window.dispatchEvent = () => true;
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true, userAgent: 'iPhone' }, configurable: true });

let clock = Date.parse('2026-11-12T10:00:00Z');
const iso = () => new Date(clock).toISOString();

// ── fake cloud: one row per account, PostgREST-shaped ────────────────────────
const cloud = new Map();   // userId -> { data, client_changed_at, updated_at }
let cloudWrites = 0;
let failPush = false;   // the upload fails (flaky gym wifi); the pull still works
const fakeFetch = async (url, opts = {}) => {
  const auth = (opts.headers && opts.headers.Authorization) || '';
  const uid = auth.replace('Bearer tok:', '');
  if (!String(url).includes('/rest/v1/progress_snapshots') || !uid) return { ok: false, status: 404, json: async () => ({}) };
  if ((opts.method || 'GET') === 'GET') {
    const row = cloud.get(uid);
    return { ok: true, json: async () => (row ? [JSON.parse(JSON.stringify(row))] : []) };
  }
  if (failPush) return { ok: false, status: 503, json: async () => ({}) };
  const b = JSON.parse(opts.body);
  if (b.user_id !== uid) return { ok: false, status: 403, json: async () => ({}) };
  cloud.set(uid, { data: b.data, client_changed_at: b.client_changed_at, updated_at: iso() });
  cloudWrites++;
  return { ok: true, json: async () => [] };
};

// ── devices ──────────────────────────────────────────────────────────────────
const devices = {};
let current = null;
const mkDevice = (name, user) => (devices[name] = { name, ls: new Map(), ss: new Map(), user, live: false, reloads: 0 });
const onDevice = (d) => { current = devices[d]; store = current.ls; sess = current.ss; };

const cs = await import('../components/training-mode/data/cloudSync.js');
const sm = await import('../components/training-mode/data/syncMerge.js');
cs._setSyncTestDeps({
  getUser: async () => (current.user ? { id: current.user } : null),
  getToken: async () => (current.user ? `tok:${current.user}` : null),
  fetch: fakeFetch,
  now: () => clock,
  reload: () => { current.reloads++; },
  // The 400 ms reload runs at once; the 4 s retry is not needed here.
  later: (fn, ms) => { if (ms <= 400) fn(); },
});
cs.setTrainingLiveCheck(() => current.live);
const sync = async (d, reason = 'manual') => { onDevice(d); await cs.syncNow({ reason }); };

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };

// ── seeded random numbers (mulberry32) ───────────────────────────────────────
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── app-shaped writes (what the real modules store) ──────────────────────────
const J = (k, d) => { const v = store.get(k); return v == null ? d : JSON.parse(v); };
const W = (k, v) => store.set(k, typeof v === 'string' ? v : JSON.stringify(v));
let uid = 0;
const ops = {
  session(r) {
    const s = J('tm_user_stats', { xp: 0, sessions: [] });
    const xp = 20 + Math.floor(r() * 80);
    const id = `s${++uid}`;
    s.sessions.push({ id, type: 'Fight Focus', completedAt: iso(), xpEarned: xp });
    s.xp += xp;
    W('tm_user_stats', s);
    return { id, xp };
  },
  bonus(r) {
    const s = J('tm_user_stats', { xp: 0, sessions: [] });
    const xp = 5 + Math.floor(r() * 40);
    s.xp += xp;
    W('tm_user_stats', s);
    return xp;
  },
  // A penalty (a forfeit, a failed stake): XP only, never below zero, like
  // userStats.addBonusXp. Returns what was really taken.
  penalty(r) {
    const s = J('tm_user_stats', { xp: 0, sessions: [] });
    const before = s.xp;
    s.xp = Math.max(0, s.xp - (5 + Math.floor(r() * 30)));
    W('tm_user_stats', s);
    return before - s.xp;
  },
  arcade(r) {
    const p = J('tm_arcade_v2', {});
    const c = ['grappler-protocol', 'one-punch-protocol'][Math.floor(r() * 2)];
    p[c] = Math.max(p[c] || 0, 1 + Math.floor(r() * 10));
    W('tm_arcade_v2', p);
  },
  camp() {
    const n = parseInt(store.get('tm_camp_progress') || '1', 10);
    if (n < 12) W('tm_camp_progress', String(n + 1));
  },
  achievement(r) {
    const a = J('tm_achievements', {});
    const id = `ach_${Math.floor(r() * 8)}`;
    if (!a[id]) a[id] = iso();
    W('tm_achievements', a);
  },
  setting(r) {
    const v = JSON.stringify({ volume: Math.floor(r() * 100), by: current.name, n: ++uid });
    W('tm_audio_settings', v);
    return v;
  },
  cardio(r) {
    const list = J('tm_cardio_sessions', []);
    list.push({ id: `c${++uid}`, completedAt: iso(), minutes: 10 + Math.floor(r() * 30) });
    W('tm_cardio_sessions', list);
  },
  fightStats(r) {
    const f = J('tm_fight_stats', { rounds: 0, strikes: 0, bestStreak: 0, sessions: 0 });
    f.rounds += 3; f.sessions += 1; f.bestStreak = Math.max(f.bestStreak, Math.floor(r() * 30));
    W('tm_fight_stats', f);
  },
  stage(r) {
    const all = J('tm_arcade_progress', {});
    const sid = 'martial-monster-protocol';
    const s = all[sid] || { completedStages: {}, unlockedStages: [1], currentStage: 1, xpEarned: 0, badges: [], statXp: {}, attempts: [] };
    const st = `ARC_MONSTER_STG0${1 + Math.floor(r() * 5)}`;
    const prev = s.completedStages[st] || {};
    const time = 60 + Math.floor(r() * 200);
    s.completedStages[st] = { fit: true, fight: true, completed: true, completedAt: clock, lastTimeSeconds: time, bestTimeSeconds: Math.min(prev.bestTimeSeconds ?? time, time), stars: Math.max(prev.stars || 0, 1 + Math.floor(r() * 3)) };
    s.xpEarned += 50;
    const cleared = Object.values(s.completedStages).filter((x) => x.completed).length;
    s.currentStage = cleared + 1;
    s.unlockedStages = Array.from({ length: cleared + 1 }, (_, i) => i + 1);
    s.attempts.push({ stageId: st, valid: true, xp: 50, at: clock });
    s.lastCompletedStage = st;
    all[sid] = s;
    W('tm_arcade_progress', all);
    return { st, time };
  },
};

const stats = (d) => { onDevice(d); return J('tm_user_stats', { xp: 0, sessions: [] }); };
const syncedView = (d) => { onDevice(d); const o = {}; for (const k of cs.SYNC_KEYS) if (store.has(k)) o[k] = store.get(k); return o; };
const cloudView = (u) => { const d = cloud.get(u)?.data || {}; const o = {}; for (const k of cs.SYNC_KEYS) if (typeof d[k] === 'string') o[k] = d[k]; return o; };
// Same data: the same keys holding the same data (a device may keep its own
// text for rows the merge would only reorder).
const same = (a, b) => JSON.stringify(Object.keys(a).sort().map((k) => [k, sm.normalize(k, a[k])])) === JSON.stringify(Object.keys(b).sort().map((k) => [k, sm.normalize(k, b[k])]));

// ── 1. the classification table covers exactly the synced keys ──────────────
check('every synced key has a merge kind, and only those', JSON.stringify([...cs.SYNC_KEYS].sort()) === JSON.stringify(Object.keys(sm.KEY_KINDS).sort()));

// ── 2. each merge is order-free: A+B = B+A, (A+B)+C = A+(B+C), A+A = A ─────
{
  const r = rng(7);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const gen = {
    tm_user_stats: () => ({ xp: Math.floor(r() * 500), sessions: Array.from({ length: Math.floor(r() * 4) }, () => ({ id: pick(['a', 'b', 'c', 'd', 'e']), completedAt: pick(['2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z']), xpEarned: pick([10, 20, 30]) })) }),
    tm_fight_stats: () => ({ rounds: Math.floor(r() * 9), strikes: Math.floor(r() * 99), bestStreak: Math.floor(r() * 9), sessions: Math.floor(r() * 9) }),
    tm_achievements: () => Object.fromEntries(Array.from({ length: 3 }, () => [pick(['x', 'y', 'z']), pick(['2026-01-01', '2026-03-01', '2026-02-01'])])),
    tm_arcade_v2: () => ({ [pick(['p', 'q'])]: Math.floor(r() * 10), [pick(['q', 'r'])]: Math.floor(r() * 10) }),
    tm_arcade_intro_seen: () => ({ [pick(['p', 'q'])]: true }),
    tm_camp_sessions: () => ({ [pick(['1', '2'])]: { [pick(['a', 'b'])]: true } }),
    tm_starthere_completed: () => [pick(['l1', 'l2', 'l3']), pick(['l1', 'l4'])],
    tm_arsenal: () => ({ boxing: [pick(['JAB', 'CROSS', 'HOOK'])], [pick(['mma', 'boxing'])]: [pick(['TEEP', 'JAB'])] }),
    tm_cardio_sessions: () => Array.from({ length: Math.floor(r() * 4) }, () => ({ id: pick(['c1', 'c2', 'c3']), completedAt: pick(['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z']), minutes: 20 })),
    tm_weight_log: () => ({ [pick(['squat', 'bench'])]: Array.from({ length: Math.floor(r() * 3) }, () => ({ setIndex: pick([1, 2]), weight: pick([40, 50]), reps: 8, timestamp: pick([100, 200, 300]) })) }),
    tm_camp_progress: () => String(1 + Math.floor(r() * 12)),
    tm_camp_complete: () => '1',
    tm_arcade_progress: () => ({ s1: { completedStages: { [pick(['A', 'B'])]: { completed: r() < 0.5, fit: true, completedAt: pick([1, 2, 3]), bestTimeSeconds: pick([50, 60]), lastTimeSeconds: pick([50, 70]), paths: [pick(['p1', 'p2'])], stars: pick([1, 2]) } }, currentStage: pick([1, 2, 3]), xpEarned: pick([0, 50, 100]), badges: [pick(['b1', 'b2'])], statXp: { str: pick([1, 5]) }, attempts: [{ stageId: 'A', at: pick([1, 2, 3]) }], lastCompletedStage: pick(['A', 'B']), title: pick(['T1', 'T2']) } }),
    tm_audio_settings: () => ({ volume: Math.floor(r() * 3) }),
    tm_combo_v1: () => ({ state: { currentCombo: Math.floor(r() * 5), longestCombo: Math.floor(r() * 9), history: [] }, lastProcessed: pick(['2026-11-01', '2026-11-02']) }),
    tm_ghost_challenge_v1: () => ({ active: pick([null, 'g1']), beaten: Math.floor(r() * 6) }),
  };
  let bad = [];
  for (const [key, g] of Object.entries(gen)) {
    for (let i = 0; i < 150; i++) {
      const e = () => (r() < 0.12 ? { v: null, t: r() < 0.5 ? -Infinity : Math.floor(r() * 3) } : { v: JSON.stringify(g()), t: Math.floor(r() * 3) });
      const a = e(); const b = e(); const c = e();
      const m = (x, y) => sm.mergeKey(key, x, y);
      const ab = m(a, b); const ba = m(b, a);
      if (ab.v !== ba.v) { bad.push(`${key} A+B != B+A`); break; }
      if (m(m(a, b), c).v !== m(a, m(b, c)).v) { bad.push(`${key} not associative`); break; }
      if (m(ab, ab).v !== ab.v) { bad.push(`${key} merging twice changes it`); break; }
      if (ab.v != null && sm.normalize(key, sm.normalize(key, ab.v)) !== sm.normalize(key, ab.v)) { bad.push(`${key} normal form is not stable`); break; }
      if (a.v != null && b.v != null && sm.normalize(key, ab.v) !== sm.normalize(key, m({ v: sm.normalize(key, a.v), t: a.t }, b).v)) { bad.push(`${key} merge depends on text order`); break; }
    }
  }
  check('every merge kind is order-free and settles', bad.length === 0, bad.join('; '));

  const st = (o) => sm.mergeKey('tm_user_stats', { v: JSON.stringify(o.a), t: 0 }, { v: JSON.stringify(o.b), t: 0 }).v;
  const merged = JSON.parse(st({ a: { xp: 130, sessions: [{ id: 'a', xpEarned: 100 }] }, b: { xp: 260, sessions: [{ id: 'a', xpEarned: 100 }, { id: 'b', xpEarned: 150 }] } }));
  check('XP: shared sessions count once, bonus XP is kept (larger side)', merged.xp === 30 + 100 + 150 && merged.sessions.length === 2, JSON.stringify(merged));
  const camp = sm.mergeKey('tm_camp_progress', { v: '6', t: 1 }, { v: '4', t: 9 }).v;
  check('camp level: furthest wins whatever the clocks say', camp === '6');
  const set = sm.mergeKey('tm_audio_settings', { v: '{"volume":1}', t: 5 }, { v: '{"volume":2}', t: 9 }).v;
  check('a setting: the side changed last wins', set === '{"volume":2}');
  const combo = JSON.parse(sm.mergeKey('tm_combo_v1', { v: JSON.stringify({ state: { longestCombo: 9 }, lastProcessed: '2026-11-01' }), t: 9 }, { v: JSON.stringify({ state: { longestCombo: 3 }, lastProcessed: '2026-11-02' }), t: 1 }).v);
  check('combo: the furthest day wins and the best combo never drops', combo.lastProcessed === '2026-11-02' && combo.state.longestCombo === 9);
}

// ── 3. the auditor's case: A and B train offline, sync A, B, A ──────────────
{
  mkDevice('A', 'u1'); mkDevice('B', 'u1');
  onDevice('A'); ops.session(rng(1)); clock += 60e3; await sync('A'); clock += 60e3;
  await sync('B'); clock += 60e3;
  onDevice('A'); const a2 = ops.session(rng(2)); clock += 60e3;
  onDevice('B'); const b2 = ops.session(rng(3)); clock += 60e3;
  await sync('A'); clock += 60e3; await sync('B'); clock += 60e3; await sync('A'); clock += 60e3;
  const ids = (d) => stats(d).sessions.map((s) => s.id).sort().join(',');
  check('two offline sessions both survive on both devices', ids('A').includes(a2.id) && ids('A').includes(b2.id) && ids('A') === ids('B'), `${ids('A')} | ${ids('B')}`);
  check('the cloud holds the same as both devices', same(syncedView('A'), cloudView('u1')) && same(syncedView('B'), cloudView('u1')));
  const sum = stats('A').sessions.reduce((n, s) => n + s.xpEarned, 0);
  check('XP equals every session counted once', stats('A').xp === sum && stats('B').xp === sum, `${stats('A').xp} vs ${sum}`);
  onDevice('A');
  check('a copy was kept before the sync changed the device', cs.listLocalBackups().length >= 1);
}

// ── 4. seeded sweep: 3 devices, random training and random sync orders ──────
const SEEDS = Number(process.env.SYNC_SEEDS) || 40;
// One seeded run; returns what went wrong (empty when all is well).
async function runSweep(seed) {
  const r = rng(seed * 7919);
  cloud.clear();
  const user = `sweep${seed}`;
  const names = ['P', 'Q', 'R'];
  for (const n of names) mkDevice(n, user);
  const allSessions = new Map();
  let allBonus = 0;
  const settingStamps = [];
  const pendingSetting = {};
  const campMax = { v: 1 }; const arcadeMax = {}; const bestStage = {};
  let bestStreak = 0;
  const xpFloor = {};
  let problems = [];

  const doSync = async (d) => {
    onDevice(d);
    const before = J('tm_user_stats', { xp: 0 }).xp;
    if (pendingSetting[d]) { settingStamps.push({ t: clock, v: pendingSetting[d] }); pendingSetting[d] = null; }
    await sync(d);
    onDevice(d);
    const after = J('tm_user_stats', { xp: 0 }).xp;
    if (after < before) problems.push(`xp went down on ${d}: ${before} -> ${after}`);
    xpFloor[d] = after;
  };

  // Each device has synced once before (a device that never synced takes the
  // account's settings on its first sync; that rule has its own check below).
  for (const n of names) { clock += 1000; await sync(n); }

  for (let step = 0; step < 60; step++) {
    clock += 1000 + Math.floor(r() * 5000);
    const d = names[Math.floor(r() * names.length)];
    onDevice(d);
    const x = r();
    if (x < 0.3) { await doSync(d); continue; }
    const op = ['session', 'session', 'bonus', 'arcade', 'camp', 'achievement', 'setting', 'cardio', 'fightStats', 'stage'][Math.floor(r() * 10)];
    const out = ops[op](r);
    if (op === 'session') allSessions.set(out.id, out.xp);
    if (op === 'bonus') allBonus += out;
    if (op === 'setting') pendingSetting[d] = out;
    if (op === 'camp') campMax.v = Math.max(campMax.v, parseInt(store.get('tm_camp_progress'), 10));
    if (op === 'arcade') for (const [k, v] of Object.entries(J('tm_arcade_v2', {}))) arcadeMax[k] = Math.max(arcadeMax[k] || 0, v);
    if (op === 'fightStats') bestStreak = Math.max(bestStreak, J('tm_fight_stats', {}).bestStreak);
    if (op === 'stage') bestStage[out.st] = Math.min(bestStage[out.st] ?? Infinity, out.time);
  }
  // Two rounds: every device syncs once per round, in a random order.
  for (let round = 0; round < 2; round++) {
    const order = [...names].sort(() => r() - 0.5);
    for (const d of order) { clock += 1000; await doSync(d); }
  }

  const view = cloudView(user);
  for (const d of names) if (!same(syncedView(d), view)) problems.push(`device ${d} differs from the cloud` + (process.env.SYNC_DEBUG ? ` ${Object.keys(view).filter((k) => sm.normalize(k, syncedView(d)[k]) !== sm.normalize(k, view[k])).map((k) => `${k}: ${syncedView(d)[k]} vs ${view[k]}`).join(' / ')}` : ''));
  const s = JSON.parse(view.tm_user_stats || '{"xp":0,"sessions":[]}');
  const ids = s.sessions.map((x) => x.id);
  if (ids.length !== new Set(ids).size) problems.push('a session is in twice');
  for (const id of allSessions.keys()) if (!ids.includes(id)) problems.push(`session ${id} lost`);
  const sessionXp = [...allSessions.values()].reduce((a, b) => a + b, 0);
  // Every session once and every bonus once: not the larger device's bonus.
  if (s.xp !== sessionXp + allBonus) problems.push(`xp ${s.xp} is not the sessions' ${sessionXp} plus every bonus ${allBonus}`);
  for (const d of names) if (s.xp < xpFloor[d]) problems.push(`xp below what ${d} once had`);
  if (parseInt(view.tm_camp_progress || '1', 10) !== campMax.v) problems.push(`camp ${view.tm_camp_progress} != ${campMax.v}`);
  const av2 = JSON.parse(view.tm_arcade_v2 || '{}');
  for (const [k, v] of Object.entries(arcadeMax)) if (av2[k] !== v) problems.push(`arcade ${k} ${av2[k]} != ${v}`);
  if (bestStreak && JSON.parse(view.tm_fight_stats).bestStreak !== bestStreak) problems.push('best streak dropped');
  const ap = JSON.parse(view.tm_arcade_progress || '{}')['martial-monster-protocol'];
  for (const [st, t] of Object.entries(bestStage)) if (ap?.completedStages?.[st]?.bestTimeSeconds !== t || !ap.completedStages[st].completed) problems.push(`stage ${st} lost its clear or best time`);
  if (settingStamps.length) {
    const want = settingStamps.reduce((w, x) => (x.t > w.t || (x.t === w.t && x.v > w.v) ? x : w));
    if (view.tm_audio_settings !== want.v) problems.push(`setting ${view.tm_audio_settings} is not the last change ${want.v}`);
  }

  // A third round changes nothing anywhere.
  const writes = cloudWrites;
  const snaps = names.map((d) => JSON.stringify(syncedView(d)));
  const backupsBefore = names.map((d) => { onDevice(d); return cs.listLocalBackups().length; });
  for (const d of names) { clock += 1000; await sync(d); }
  if (cloudWrites !== writes) problems.push('syncing again wrote to the cloud');
  if (names.some((d, i) => JSON.stringify(syncedView(d)) !== snaps[i])) problems.push('syncing again changed a device');
  if (names.some((d, i) => { onDevice(d); return cs.listLocalBackups().length !== backupsBefore[i]; })) problems.push('syncing again took a copy');
  return problems;
}
for (let seed = 1; seed <= SEEDS; seed++) {
  const problems = await runSweep(seed);
  if (problems.length) { check(`sweep seed ${seed}`, false, problems.slice(0, 4).join('; ')); }
  else pass++;
}
console.log(`  ok   ${SEEDS} seeded sweeps (3 devices, 60 random steps, 2 sync rounds, then a quiet third)${fail ? ' — see failures above' : ''}`);

// ── 4b. a brand-new device takes the account's settings, not its defaults ──
{
  cloud.clear();
  mkDevice('F1', 'fay'); mkDevice('F2', 'fay');
  onDevice('F1'); W('tm_audio_settings', { volume: 30 }); ops.session(rng(5)); clock += 1000; await sync('F1');
  clock += 60e3;
  onDevice('F2'); W('tm_audio_settings', { volume: 100 }); clock += 1000; await sync('F2');
  onDevice('F2');
  check('a new device with no training takes the account\'s settings', JSON.parse(store.get('tm_audio_settings')).volume === 30 && stats('F2').sessions.length === 1);
  onDevice('F2'); W('tm_audio_settings', { volume: 70 }); clock += 1000; await sync('F2');
  onDevice('F1'); clock += 1000; await sync('F1');
  check('after that its own changes count like any other device\'s', JSON.parse(store.get('tm_audio_settings')).volume === 70);
}

// ── 5. an older app version overwrites the cloud with its whole snapshot ────
{
  cloud.clear();
  mkDevice('N', 'old1'); mkDevice('O', 'old1');
  onDevice('N'); const s1 = ops.session(rng(11)); clock += 1000; await sync('N');
  // The old version on O never saw s1 and writes a plain snapshot, no times.
  onDevice('O'); const s0 = ops.session(rng(12));
  cloud.set('old1', { data: { tm_user_stats: store.get('tm_user_stats') }, client_changed_at: new Date(clock + 5000).toISOString(), updated_at: iso() });
  clock += 10000;
  await sync('N');
  const ids = stats('N').sessions.map((s) => s.id);
  check('a whole-snapshot row from an older version merges in, nothing lost', ids.includes(s1.id) && ids.includes(s0.id));
  check('the merged row keeps the plain keys older versions read', typeof cloud.get('old1').data.tm_user_stats === 'string' && JSON.parse(cloud.get('old1').data.tm_user_stats).sessions.length === 2);
}

// ── 6. another account on the same phone ────────────────────────────────────
{
  cloud.clear();
  mkDevice('S', 'alice');
  onDevice('S'); const a = ops.session(rng(21)); W('tm_user_profile', { name: 'Alice', weight: 60 }); clock += 1000; await sync('S');
  const aliceRow = JSON.stringify(cloud.get('alice'));
  onDevice('S'); current.user = 'bob'; clock += 1000; await sync('S');
  onDevice('S');
  const bobCloud = cloud.get('bob')?.data || {};
  check('a new account does not get the previous account\'s sessions', !(bobCloud.tm_user_stats || '').includes(a.id));
  check('the previous account\'s profile is not shown to the new one', !store.has('tm_user_profile') && !(bobCloud.tm_user_profile || '').includes('Alice'));
  check('the previous account\'s cloud row is untouched', JSON.stringify(cloud.get('alice')) === aliceRow);
  check('the page reloads so no screen keeps the old account on show', current.reloads >= 1);
  const b = ops.session(rng(22)); clock += 1000; await sync('S');
  onDevice('S'); current.user = 'alice'; clock += 1000; await sync('S');
  const ids = stats('S').sessions.map((s) => s.id);
  check('signing back in brings the first account\'s own data back, unmixed', ids.includes(a.id) && !ids.includes(b.id));
  check('and the second account kept its own', (cloud.get('bob').data.tm_user_stats || '').includes(b.id) && !(cloud.get('bob').data.tm_user_stats || '').includes(a.id));
}

// ── 7. a live workout: no device change and no reload until it ends ─────────
{
  cloud.clear();
  mkDevice('L', 'lee'); mkDevice('M', 'lee');
  onDevice('L'); ops.session(rng(31)); clock += 1000; await sync('L');
  onDevice('M'); clock += 1000; await sync('M');
  onDevice('L'); const fromL = ops.session(rng(32)); clock += 1000; await sync('L');
  onDevice('M'); current.live = true; current.reloads = 0; current.ss.clear();
  const before = JSON.stringify(syncedView('M'));
  clock += 1000; await sync('M', 'online');
  check('while live the device is left as it is', JSON.stringify(syncedView('M')) === before);
  check('while live the page is not reloaded', devices.M.reloads === 0);
  check('the live device still never overwrites the cloud\'s new session', (cloud.get('lee').data.tm_user_stats || '').includes(fromL.id));
  onDevice('M'); current.live = false;
  clock += 1000; await sync('M', 'stats');
  check('after the workout the device takes the new session', stats('M').sessions.some((s) => s.id === fromL.id));
  check('no reload right after the app\'s own save (the summary screen)', devices.M.reloads === 0);
  clock += 1000; await sync('M', 'visible');
  check('the reload waits for the next return to the app', devices.M.reloads === 1);
}

// ── 8. copies: the last five, restorable ─────────────────────────────────────
{
  cloud.clear();
  mkDevice('X', 'xia'); mkDevice('Y', 'xia');
  for (let i = 0; i < 7; i++) {
    onDevice('Y'); W('tm_audio_settings', { volume: i }); clock += 1000; await sync('Y');
    onDevice('X'); clock += 1000; await sync('X', 'stats');
  }
  onDevice('X');
  check('only the last five copies are kept', cs.listLocalBackups().length === 5);
  const now = store.get('tm_audio_settings');
  const ok = cs.restoreLocalBackup();
  check('restore puts back the copy from before the last sync', ok && store.get('tm_audio_settings') === JSON.stringify({ volume: 5 }) && now === JSON.stringify({ volume: 6 }));
  clock += 1000; await sync('X');
  check('the restored setting then wins on the next sync', JSON.parse(cloud.get('xia').data.tm_audio_settings).volume === 5);
  const n = cs.listLocalBackups().length;
  check('restoring takes that copy off the list', n <= 5);
}

// ── 9. the screens are wired ─────────────────────────────────────────────────
{
  const fs = await import('node:fs');
  const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
  check('the account card offers "Restore previous copy"', /restoreLocalBackup\(\)/.test(read('../components/training-mode/AccountCard.jsx')) && /Restore previous copy/.test(read('../components/training-mode/AccountCard.jsx')));
  check('the app tells the sync when a workout is live', /setTrainingLiveCheck\(/.test(read('../components/training-mode/App.jsx')));
}


// ── helpers for the regression checks below ─────────────────────────────────
const sumXp = (st) => (st.sessions || []).reduce((n, x) => n + Math.max(0, Number(x.xpEarned) || 0), 0);
const cloudStats = (u) => JSON.parse(cloud.get(u)?.data?.tm_user_stats || '{"xp":0,"sessions":[]}');
const plainSnap = () => { const o = {}; for (const k of cs.SYNC_KEYS) if (store.has(k)) o[k] = store.get(k); return o; };
// The hash the version before this one kept in tm_sync_meta.
const oldHash = (snap) => {
  const t = Object.keys(snap).sort().map((k) => `${k}\u0000${snap[k]}`).join('\u0001');
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return `${t.length}:${h}`;
};
// The sync of the app version before this one, as it shipped: the whole
// snapshot, newest wins (cloud taken only when more than 2 s newer than the
// device's own last change), no merge, no XP ledger.
// offline: the device notices its change but cannot reach the cloud.
function oldSync(d, { offline = false } = {}) {
  onDevice(d);
  const m = J('tm_sync_meta', {});
  const snap = plainSnap(); const hash = oldHash(snap);
  const localAt = m.changedAt || clock;
  if (hash !== m.lastHash) { m.changedAt = clock; m.lastHash = hash; }
  const row = offline ? undefined : cloud.get(current.user);
  const push = () => { cloud.set(current.user, { data: { ...snap }, client_changed_at: new Date(m.changedAt || clock).toISOString(), updated_at: iso() }); cloudWrites++; m.lastPushedHash = hash; };
  if (offline) { /* nothing reaches the cloud */ }
  else if (!row) push();
  else {
    const cAt = Date.parse(row.client_changed_at || row.updated_at || 0) || 0;
    const data = row.data || {};
    const real = (t) => { try { const x = JSON.parse(t || '{}'); return (x.xp || 0) > 0 || (x.sessions || []).length > 0; } catch { return false; } };
    const fresh = !real(snap.tm_user_stats) && real(data.tm_user_stats);
    if ((fresh || cAt > (m.changedAt || localAt) + 2000) && oldHash(data) !== hash) {
      for (const k of cs.SYNC_KEYS) if (typeof data[k] === 'string') store.set(k, data[k]);
      m.changedAt = cAt || clock; m.lastHash = oldHash(plainSnap());
    } else if (hash !== m.lastPushedHash) push();
  }
  W('tm_sync_meta', m);
}
// Stats as the older version writes them: no ledger, bonus folded into xp.
const oldStats = (n, bonus, base = 0) => {
  const sessions = Array.from({ length: n }, (_, i) => ({ id: `o${base + i}`, type: 'Fight Focus', completedAt: new Date(clock - (n - i) * 864e5).toISOString(), xpEarned: 100 }));
  return { xp: 100 * n + bonus, sessions };
};
const addRawSession = (xp) => { const st = J('tm_user_stats', { xp: 0, sessions: [] }); const id = `r${++uid}`; st.sessions.push({ id, type: 'Fight Focus', completedAt: iso(), xpEarned: xp }); st.xp += xp; W('tm_user_stats', st); return id; };
const addRawXp = (delta) => { const st = J('tm_user_stats', { xp: 0, sessions: [] }); const before = st.xp; st.xp = Math.max(0, st.xp + delta); W('tm_user_stats', st); return st.xp - before; };
// A long history, so storage limits bite.
const bigStats = (n) => { const st = { xp: 0, sessions: [] }; for (let i = 0; i < n; i++) { st.sessions.push({ id: `h${i}`, type: 'Fight Focus', completedAt: new Date(clock - (n - i) * 36e5).toISOString(), completedCount: 3, totalCount: 3, xpEarned: 40 + (i % 50) }); st.xp += 40 + (i % 50); } return st; };

// ── F1. storage full: the merge is never lost and the card says so ──────────
{
  cloud.clear();
  mkDevice('F1A', 'f1'); mkDevice('F1B', 'f1');
  onDevice('F1A'); W('tm_user_stats', bigStats(400)); clock += 1000; await sync('F1A');
  clock += 1000; await sync('F1B');
  onDevice('F1B'); const fromB = []; for (let i = 0; i < 40; i++) fromB.push(addRawSession(50)); clock += 1000; await sync('F1B');
  // A's storage is full: the merged stats (40 sessions longer) cannot fit.
  onDevice('F1A'); W('other_app_cache', 'x'.repeat(5000)); quota = bytesUsed() + 500;
  clock += 1000; const st1 = { ...(await cs.syncNow({ reason: 'manual' })) };
  clock += 1000; const st2 = { ...(await cs.syncNow({ reason: 'manual' })) };
  const inCloud = (ids) => { const c = new Set(cloudStats('f1').sessions.map((x) => x.id)); return ids.every((id) => c.has(id)); };
  check('F1 a merge storage cannot take is reported, not "synced"', st1.status === 'error' && st1.error === cs.SYNC_ERROR_STORAGE && st2.status === 'error', JSON.stringify(st1));
  check('F1 the device\'s unmerged data never replaces the cloud\'s', inCloud(fromB) && cloudStats('f1').sessions.length === 440, `${cloudStats('f1').sessions.length}`);
  onDevice('F1A'); store.delete('other_app_cache'); quota = Infinity; clock += 1000; await sync('F1A');
  check('F1 once there is room the device takes the merge', stats('F1A').sessions.length === 440 && cs.getSyncState().status === 'synced');

  // Room that only the copies hold: they are dropped and the merge lands.
  onDevice('F1B'); for (let i = 0; i < 40; i++) fromB.push(addRawSession(50)); clock += 1000; await sync('F1B');
  onDevice('F1A'); W('tm_sync_backup', JSON.stringify({ at: 1, snap: { tm_audio_settings: 'y'.repeat(6000) } })); quota = bytesUsed() + 500;
  clock += 1000; const st3 = { ...(await cs.syncNow({ reason: 'manual' })) };
  check('F1 when storage is full the copies go first and the merge is written', st3.status === 'synced' && stats('F1A').sessions.length === 480 && !store.has('tm_sync_backup'), JSON.stringify(st3));
  quota = Infinity;

  // Room for a whole copy of the device but not for the copy and the merge:
  // the merge must land (or at least reach the cloud), never the old data.
  cloud.clear(); mkDevice('F1C', 'f1c'); mkDevice('F1D', 'f1c');
  onDevice('F1C'); W('tm_user_stats', bigStats(400)); clock += 1000; await sync('F1C'); clock += 1000; await sync('F1D');
  onDevice('F1D'); const fromD = []; for (let i = 0; i < 40; i++) fromD.push(addRawSession(50)); clock += 1000; await sync('F1D');
  onDevice('F1C'); store.delete('tm_sync_backups'); store.delete('tm_sync_backup_index');
  quota = bytesUsed() + 2 * (JSON.stringify([{ at: clock, owner: 'f1c', snap: plainSnap() }]).length + 40) + 1000;
  clock += 1000; await sync('F1C');
  const cl = new Set(cloudStats('f1c').sessions.map((x) => x.id));
  check('F1 a merge that does not fit after a copy is never replaced by the old data', fromD.every((id) => cl.has(id)) && cloudStats('f1c').sessions.length === 440, `${cloudStats('f1c').sessions.length} in the cloud`);
  check('F1 ...and the device takes it, the copy giving way', stats('F1C').sessions.length === 440 && cs.getSyncState().status === 'synced');
  quota = Infinity;
}

// ── F2. an idle device does not make an older version drop its own work ─────
{
  cloud.clear();
  mkDevice('F2O', 'f2'); mkDevice('F2Q', 'f2');
  onDevice('F2O'); W('tm_user_stats', oldStats(20, 35)); oldSync('F2O'); clock += 60e3;
  await sync('F2Q'); clock += 60e3;
  onDevice('F2O'); addRawSession(10); oldSync('F2O'); clock += 60e3;
  // O trains and its upload fails; Q, with nothing new, syncs; then O again.
  onDevice('F2O'); const lost = addRawSession(333); oldSync('F2O', { offline: true }); clock += 60e3;
  await sync('F2Q', 'interval'); clock += 60e3;
  oldSync('F2O'); clock += 60e3;
  check('F2 an older device keeps a session it could not upload yet', stats('F2O').sessions.some((x) => x.id === lost) && cloudStats('f2').sessions.some((x) => x.id === lost));
  // And it still takes a merge that brings something new while it is idle.
  onDevice('F2Q'); const fromQ = addRawSession(77); clock += 60e3; await sync('F2Q'); clock += 60e3;
  oldSync('F2O'); clock += 60e3;
  check('F2 an idle older device still takes the new device\'s session', stats('F2O').sessions.some((x) => x.id === fromQ));
}

// ── F3. XP: penalties stay taken, bonuses add up, old XP counts once ─────────
{
  const r = rng(303);
  // (1) a snapshot merged with itself changes nothing: XP and sessions stay,
  // and stats with a ledger come back exactly as they were.
  const canon = (v) => JSON.stringify(v, (k, x) => (isPlain(x) ? Object.fromEntries(Object.keys(x).sort().map((y) => [y, x[y]])) : x));
  const isPlain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  let bad1 = [];
  for (let i = 0; i < 300; i++) {
    const n = Math.floor(r() * 5);
    const st = { xp: 0, sessions: Array.from({ length: n }, (_, j) => ({ id: `s${j}`, completedAt: `2026-0${1 + j}-01T00:00:00.000Z`, xpEarned: 10 * (1 + Math.floor(r() * 9)) })) };
    const sx = sumXp(st);
    const kind = Math.floor(r() * 3);
    if (kind === 0) st.xp = Math.max(0, sx + Math.floor(r() * 200) - 60);   // no ledger (every user today)
    else {
      const by = {}; for (const id of ['d_a', 'd_b'].slice(0, 1 + Math.floor(r() * 2))) by[id] = { p: Math.floor(r() * 90), n: Math.floor(r() * 40) };
      const legacy = r() < 0.2 ? null : Math.floor(r() * 80) - 20;
      st.bonus = { legacy, by };
      st.xp = Math.max(0, sx + (legacy ?? 0) + Object.values(by).reduce((a, c) => a + c.p - c.n, 0));
      if (kind === 2) st.xp += 1 + Math.floor(r() * 50);   // an older version added XP it does not count
    }
    const t = JSON.stringify(st);
    const re = JSON.stringify({ sessions: [...st.sessions].reverse(), ...(st.bonus ? { bonus: st.bonus } : {}), xp: st.xp });
    for (const out of [sm.normalize('tm_user_stats', t), sm.mergeKey('tm_user_stats', { v: t, t: 1 }, { v: re, t: 2 }).v]) {
      const o = JSON.parse(out);
      if (o.xp !== st.xp || o.sessions.length !== n) bad1.push(`xp ${st.xp} -> ${o.xp}`);
      if (kind === 1 && canon({ ...o, sessions: null }) !== canon({ ...st, sessions: null })) bad1.push(`ledger changed ${canon(st.bonus)} -> ${canon(o.bonus)}`);
      if (kind === 0 && 'bonus' in o) bad1.push('a ledger was added by a merge of ledger-less stats');
    }
    if (sm.normalize('tm_user_stats', sm.normalize('tm_user_stats', t)) !== sm.normalize('tm_user_stats', t)) bad1.push('normal form not stable');
  }
  check('F3(1) merging stats with themselves changes nothing (300 seeded)', bad1.length === 0, bad1.slice(0, 3).join('; '));

  // The ledger merge is order-free: A+B = B+A, (A+B)+C = A+(B+C).
  const gen = () => {
    const st = { sessions: Array.from({ length: Math.floor(r() * 4) }, () => ({ id: ['a', 'b', 'c', 'd'][Math.floor(r() * 4)], completedAt: '2026-01-01T00:00:00.000Z', xpEarned: 20 })) };
    st.sessions = [...new Map(st.sessions.map((x) => [x.id, x])).values()];
    const by = {}; for (const id of ['d_a', 'd_b', 'd_c']) if (r() < 0.6) by[id] = { p: Math.floor(r() * 50), n: Math.floor(r() * 30) };
    if (r() < 0.8) { const legacy = Math.floor(r() * 40); st.bonus = { legacy, by }; st.xp = Math.max(0, sumXp(st) + legacy + Object.values(by).reduce((a, c) => a + c.p - c.n, 0)) + (r() < 0.2 ? 15 : 0); }
    else st.xp = sumXp(st) + Math.floor(r() * 40);
    return { v: JSON.stringify(st), t: Math.floor(r() * 3) };
  };
  let badL = [];
  for (let i = 0; i < 400; i++) {
    const a = gen(); const b = gen(); const c = gen();
    const m = (x, y) => sm.mergeKey('tm_user_stats', x, y);
    const n = (x) => sm.normalize('tm_user_stats', x.v);
    if (n(m(a, b)) !== n(m(b, a))) { badL.push('A+B != B+A'); break; }
    if (n(m(m(a, b), c)) !== n(m(a, m(b, c)))) { badL.push('not associative'); break; }
    if (n(m(m(a, b), m(a, b))) !== n(m(a, b))) { badL.push('merging twice changes it'); break; }
  }
  check('F3 the XP ledger merges in any order to the same result (400 seeded)', badL.length === 0, badL.join('; '));

  // (2) one device: a penalty stays taken across any number of syncs, also
  // when an upload fails and the cloud keeps an older copy of the device.
  let bad2 = [];
  for (let seed = 1; seed <= 25; seed++) {
    const rr = rng(seed * 104729);
    cloud.clear(); mkDevice('F3S', `solo${seed}`);
    let want = 0;
    for (let step = 0; step < 40; step++) {
      clock += 1000 + Math.floor(rr() * 4000);
      onDevice('F3S');
      const x = rr();
      if (x < 0.25) want += ops.session(rr).xp;
      else if (x < 0.4) want += ops.bonus(rr);
      else if (x < 0.6) want -= ops.penalty(rr);
      else {
        failPush = rr() < 0.3;
        await sync('F3S');
        failPush = false;
        const got = stats('F3S').xp;
        if (got !== want) { bad2.push(`seed ${seed} step ${step}: xp ${got}, want ${want}`); break; }
      }
    }
    clock += 1000; await sync('F3S'); clock += 1000; await sync('F3S');
    if (stats('F3S').xp !== want || cloudStats(`solo${seed}`).xp !== want) bad2.push(`seed ${seed} end: ${stats('F3S').xp} / cloud ${cloudStats(`solo${seed}`).xp}, want ${want}`);
  }
  check('F3(2) one device: every penalty stays taken across syncs (25 seeded)', bad2.length === 0, bad2.slice(0, 3).join('; '));

  // (3) three devices earn bonus and take penalties offline, sync in any
  // order: everyone ends on sessions + every bonus - every penalty.
  let bad3 = [];
  for (let seed = 1; seed <= 30; seed++) {
    const rr = rng(seed * 7727);
    cloud.clear();
    const u = `trio${seed}`; const names = ['T1', 'T2', 'T3'];
    for (const nm of names) { mkDevice(nm, u); clock += 1000; await sync(nm); }
    let sXp = 0, bonus = 0, pen = 0;
    const own = Object.fromEntries(names.map((nm) => [nm, 0]));
    for (let step = 0; step < 60; step++) {
      clock += 1000 + Math.floor(rr() * 5000);
      const d = names[Math.floor(rr() * 3)]; onDevice(d);
      const x = rr();
      if (x < 0.3) sXp += ops.session(rr).xp;
      else if (x < 0.45) bonus += ops.bonus(rr);
      else if (x < 0.6) { const p = ops.penalty(rr); pen += p; own[d] += p; }
      else {
        await sync(d);
        // What this device itself took never comes back.
        const most = sXp + bonus - own[d];
        if (stats(d).xp > most) bad3.push(`seed ${seed}: ${d} has ${stats(d).xp}, its own penalties allow at most ${most}`);
      }
    }
    for (let round = 0; round < 2; round++) for (const d of names) { clock += 1000; await sync(d); }
    const want = Math.max(0, sXp + bonus - pen);
    for (const d of names) if (stats(d).xp !== want) bad3.push(`seed ${seed}: ${d} xp ${stats(d).xp}, want ${want}`);
    if (cloudStats(u).xp !== want) bad3.push(`seed ${seed}: cloud xp ${cloudStats(u).xp}, want ${want}`);
  }
  check('F3(3) three devices: sessions + every bonus - every penalty, on all and in the cloud (30 seeded)', bad3.length === 0, bad3.slice(0, 3).join('; '));

  // (4) the bonus from before this version counts once, whichever device
  // updates first and in whatever order they sync.
  let bad4 = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rr = rng(seed * 6007);
    cloud.clear();
    const u = `pre${seed}`;
    mkDevice('PA', u); mkDevice('PB', u);
    onDevice('PA'); W('tm_user_stats', oldStats(10, 30)); oldSync('PA'); clock += 5000;
    oldSync('PB'); clock += 5000;
    const up = { PA: false, PB: false };
    for (let step = 0; step < 12; step++) {
      clock += 1000 + Math.floor(rr() * 4000);
      const d = rr() < 0.5 ? 'PA' : 'PB';
      const x = rr();
      if (x < 0.2) up[d] = true;
      else if (x < 0.45) { onDevice(d); addRawSession(10 + Math.floor(rr() * 40)); }
      else if (up[d]) await sync(d); else oldSync(d);
    }
    for (const d of ['PA', 'PB']) up[d] = true;
    for (let round = 0; round < 3; round++) for (const d of rr() < 0.5 ? ['PA', 'PB'] : ['PB', 'PA']) { clock += 1000; await sync(d); }
    const c = cloudStats(u);
    const want = sumXp(c) + 30;
    for (const d of ['PA', 'PB']) if (stats(d).xp !== want) bad4.push(`seed ${seed}: ${d} xp ${stats(d).xp}, want ${want}`);
    if (c.xp !== want) bad4.push(`seed ${seed}: cloud xp ${c.xp}, want ${want}`);
  }
  check('F3(4) the bonus from before the update counts once, any update and sync order (40 seeded)', bad4.length === 0, bad4.slice(0, 3).join('; '));

  // (5) XP an older-version device adds (it knows nothing of the ledger) is
  // absorbed: not lost, and not counted again once that device updates.
  let bad5 = [];
  for (let seed = 1; seed <= 40; seed++) {
    const rr = rng(seed * 4409);
    cloud.clear();
    const u = `mix${seed}`;
    mkDevice('MA', u); mkDevice('MB', u);
    onDevice('MA'); W('tm_user_stats', oldStats(10, 30)); oldSync('MA'); clock += 5000;
    oldSync('MB'); clock += 5000;
    await sync('MA'); clock += 5000;   // A has the update, B not yet
    let extra = 0; let bUp = false;
    for (let step = 0; step < 24; step++) {
      clock += 1000 + Math.floor(rr() * 4000);
      const x = rr();
      if (x < 0.15) { onDevice('MA'); extra += ops.bonus(rr); }
      else if (x < 0.25) { onDevice('MA'); extra -= ops.penalty(rr); }
      else if (x < 0.4) { onDevice('MB'); addRawSession(20); if (bUp) await sync('MB'); else oldSync('MB'); }
      else if (x < 0.55) { onDevice('MB'); const g = 5 + Math.floor(rr() * 30); extra += addRawXp(g); if (bUp) await sync('MB'); else oldSync('MB'); }
      else if (x < 0.6 && !bUp) bUp = true;
      else if (x < 0.8) await sync('MA');
      else if (bUp) await sync('MB'); else oldSync('MB');
    }
    for (let round = 0; round < 3; round++) for (const d of ['MA', 'MB']) { clock += 1000; await sync(d); }
    const c = cloudStats(u);
    const want = sumXp(c) + 30 + extra;
    for (const d of ['MA', 'MB']) if (stats(d).xp !== want) bad5.push(`seed ${seed}: ${d} xp ${stats(d).xp}, want ${want}`);
    if (c.xp !== want) bad5.push(`seed ${seed}: cloud xp ${c.xp}, want ${want}`);
  }
  check('F3(5) XP from an older-version device counts once, before and after it updates (40 seeded)', bad5.length === 0, bad5.slice(0, 3).join('; '));

  // (6) stats without a ledger (every user today), one device: the first
  // sync on the update keeps XP exactly where it is, including a penalty or
  // a bonus taken offline after the last upload.
  let bad6 = [];
  for (const [label, change] of [['unchanged', 0], ['offline penalty', -150], ['offline bonus', 40]]) {
    cloud.clear(); mkDevice('F3U', `up-${label}`);
    onDevice('F3U'); W('tm_user_stats', oldStats(10, 25)); oldSync('F3U'); clock += 60e3;
    onDevice('F3U'); if (change) addRawXp(change); oldSync('F3U', { offline: true }); clock += 60e3;
    const want = stats('F3U').xp; const ids = stats('F3U').sessions.map((x) => x.id).join();
    for (let i = 0; i < 4; i++) {
      await sync('F3U'); clock += 60e3;
      if (stats('F3U').xp !== want || cloudStats(`up-${label}`).xp !== want) { bad6.push(`${label}: sync ${i} xp ${stats('F3U').xp} / cloud ${cloudStats(`up-${label}`).xp}, want ${want}`); break; }
    }
    if (stats('F3U').sessions.map((x) => x.id).join() !== ids) bad6.push(`${label}: sessions changed`);
  }
  check('F3(6) ledger-less stats on one device: the update changes no XP', bad6.length === 0, bad6.join('; '));
}

// ── F3. the ledger across an account switch on one phone ────────────────────
{
  cloud.clear(); mkDevice('F3W', 'wa'); mkDevice('F3V', 'wa');
  onDevice('F3W'); W('tm_user_stats', oldStats(5, 60)); oldSync('F3W'); clock += 60e3;
  await sync('F3W'); onDevice('F3W'); ops.bonus(rng(71)); ops.penalty(rng(72)); clock += 1000; await sync('F3W');
  onDevice('F3W'); const want = stats('F3W').xp;
  current.user = 'wb'; clock += 1000; await sync('F3W', 'auth');
  onDevice('F3W'); ops.session(rng(73)); clock += 1000; await sync('F3W');
  onDevice('F3W'); current.user = 'wa'; clock += 1000; await sync('F3W', 'auth');
  for (let i = 0; i < 3; i++) { clock += 1000; await sync('F3W'); clock += 1000; await sync('F3V'); }
  check('F3 XP set aside on an account switch comes back once, not twice', stats('F3W').xp === want && stats('F3V').xp === want && cloudStats('wa').xp === want, `${stats('F3W').xp} / ${stats('F3V').xp} / cloud ${cloudStats('wa').xp}, want ${want}`);
  // A copy set aside by the build before the ledger (stats without one).
  cloud.clear(); mkDevice('F3Y', 'ya'); mkDevice('F3Z', 'ya');
  onDevice('F3Z'); W('tm_user_stats', oldStats(4, 80)); clock += 1000; await sync('F3Z');
  onDevice('F3Y'); current.user = 'yb'; ops.session(rng(74)); clock += 1000; await sync('F3Y');
  onDevice('F3Y'); W('tm_sync_user_ya', JSON.stringify({ at: clock, snap: { tm_user_stats: JSON.stringify(oldStats(4, 80)) }, times: {}, seen: null, synced: true }));
  current.user = 'ya'; clock += 1000; await sync('F3Y', 'auth');
  for (let i = 0; i < 2; i++) { clock += 1000; await sync('F3Y'); clock += 1000; await sync('F3Z'); }
  check('F3 an older set-aside copy brings its bonus back once', stats('F3Y').xp === 480 && cloudStats('ya').xp === 480, `${stats('F3Y').xp} / cloud ${cloudStats('ya').xp}, want 480`);
}

// ── F4. switching accounts with full storage ────────────────────────────────
{
  const setup = async (u) => {
    cloud.clear(); mkDevice('F4X', u);
    onDevice('F4X'); W('tm_user_stats', bigStats(300)); W('tm_user_profile', { name: 'Ana' }); clock += 1000; await sync('F4X');
  };
  // (a) only the copies hold the room: they go, and the switch completes.
  await setup('f4a');
  onDevice('F4X'); W('tm_sync_backups', JSON.stringify([{ at: 1, owner: 'f4a', snap: plainSnap() }])); W('tm_sync_backup_index', '[{"at":1,"owner":"f4a"}]');
  quota = bytesUsed() + 2000;
  current.user = 'f4b'; clock += 1000; const a = { ...(await cs.syncNow({ reason: 'auth' })) };
  onDevice('F4X');
  check('F4 storage full of copies: the switch drops them and completes', a.status === 'synced' && J('tm_sync_meta', {}).owner === 'f4b' && store.has('tm_sync_user_f4a') && !store.has('tm_user_profile'), JSON.stringify(a));
  quota = Infinity;
  // (b) no room for the set-aside copy, but the cloud row holds this data.
  await setup('f4c');
  onDevice('F4X'); W('other_app_cache', 'x'.repeat(1000)); quota = bytesUsed() + 2000;
  current.user = 'f4d'; clock += 1000; const b = { ...(await cs.syncNow({ reason: 'auth' })) };
  onDevice('F4X');
  check('F4 no room for a copy but the data is in its cloud row: the switch goes ahead', b.status === 'synced' && J('tm_sync_meta', {}).owner === 'f4d' && !store.has('tm_user_profile') && cloudStats('f4c').sessions.length === 300 && !(cloud.get('f4d')?.data?.tm_user_stats || '').includes('"h1"'), JSON.stringify(b));
  quota = Infinity;
  // (c) no room and the device holds work its cloud row has not got: the
  // switch waits, nothing is mixed, the card says why.
  await setup('f4e');
  onDevice('F4X'); const unsynced = addRawSession(60); W('other_app_cache', 'x'.repeat(1000)); quota = bytesUsed() + 2000;
  current.user = 'f4f'; clock += 1000; const c = { ...(await cs.syncNow({ reason: 'auth' })) };
  clock += 1000; const c2 = { ...(await cs.syncNow({ reason: 'manual' })) };
  onDevice('F4X');
  check('F4 a switch that cannot keep the old data waits and says so', c.status === 'error' && c.error === cs.SYNC_ERROR_SWITCH && c2.error === cs.SYNC_ERROR_SWITCH, JSON.stringify(c));
  check('F4 ...the old account keeps its data and nothing reaches the new row', J('tm_sync_meta', {}).owner === 'f4e' && stats('F4X').sessions.some((x) => x.id === unsynced) && !cloud.has('f4f'));
  quota = Infinity;
}

// ── F5. copies stay small and a workout save never fails for them ───────────
{
  cloud.clear(); mkDevice('F5A', 'f5'); mkDevice('F5B', 'f5');
  onDevice('F5A'); W('tm_user_stats', bigStats(1500)); clock += 1000; await sync('F5A'); clock += 1000; await sync('F5B');
  for (let i = 0; i < 7; i++) {
    onDevice('F5B'); addRawSession(50); W('tm_audio_settings', { volume: i }); clock += 1000; await sync('F5B');
    onDevice('F5A'); clock += 1000; await sync('F5A');
  }
  onDevice('F5A');
  const synced = Object.values(plainSnap()).reduce((n, v) => n + v.length, 0);
  const copies = store.get('tm_sync_backups') || '';
  const cap = Math.min(500000, Math.max(20000, synced * 0.2));
  check('F5 the copies together stay under 1 MB and a fifth of the synced data', copies.length <= cap, `${copies.length} chars, cap ${cap}`);
  check('F5 a copy holds only what a sync changed', copies.includes('tm_audio_settings') && !copies.includes('"h1"'));
  check('F5 a changed setting can still be restored', cs.listLocalBackups().length >= 1);

  // Copies from earlier builds (whole snapshots) leave too little room: the
  // next sync trims them and leaves room for twice the stats.
  onDevice('F5A'); W('tm_sync_backups', JSON.stringify(Array.from({ length: 3 }, (_, i) => ({ at: i, owner: 'f5', snap: plainSnap() })))); store.delete('tm_sync_backup_index');
  quota = bytesUsed() + 4 * (store.get('tm_user_stats').length) - 20000;
  onDevice('F5B'); addRawSession(50); quota = Infinity; clock += 1000; await sync('F5B');
  onDevice('F5A'); quota = bytesUsed() + 4 * (store.get('tm_user_stats').length) - 20000; clock += 1000; await sync('F5A');
  onDevice('F5A');
  const free = quota - bytesUsed();
  check('F5 after a sync there is room for twice the stats', free >= 2 * 2 * store.get('tm_user_stats').length, `${free} bytes free, stats ${2 * store.get('tm_user_stats').length} bytes`);
  quota = Infinity;

  // A workout save that meets full storage drops the copies, not the workout.
  const us = await import('../components/training-mode/data/userStats.js');
  onDevice('F5A'); W('tm_sync_backups', JSON.stringify([{ at: 1, owner: 'f5', snap: { tm_audio_settings: 'z'.repeat(4000) } }])); W('tm_sync_backup_index', '[{"at":1,"owner":"f5"}]');
  quota = bytesUsed() + 100;
  const n0 = J('tm_user_stats').sessions.length;
  let threw = false;
  try { us.addFightFocusSession(3, 3); } catch { threw = true; }
  onDevice('F5A');
  check('F5 a workout save on full storage drops the copies and keeps the workout', !threw && J('tm_user_stats').sessions.length === n0 + 1 && !store.has('tm_sync_backups') && cs.listLocalBackups().length === 0);
  quota = Infinity;
}

// ── F6. odd stored shapes never stop the sync ───────────────────────────────
{
  const good = JSON.stringify({ s1: { completedStages: { A: { completed: true, completedAt: 5, stars: 2 } }, unlockedStages: [1, 2], currentStage: 2 } });
  let threw = '';
  for (const bad of ['{"s1":{"unlockedStages":5}}', '{"s1":{"unlockedStages":{"a":1}}}', '{"s1":{"unlockedStages":"12","completedStages":[]}}']) {
    for (const [x, y] of [[{ v: good, t: 1 }, { v: bad, t: 2 }], [{ v: bad, t: 2 }, { v: good, t: 1 }]]) {
      try { sm.mergeKey('tm_arcade_progress', x, y); } catch (e) { threw = `${bad}: ${e.message}`; }
    }
  }
  check('F6 a non-list where a list belongs does not throw', !threw, threw);
  cloud.clear(); mkDevice('F6A', 'f6');
  onDevice('F6A'); W('tm_arcade_progress', good); ops.session(rng(61)); clock += 1000; await sync('F6A');
  cloud.get('f6').data.tm_arcade_progress = '{"s1":{"unlockedStages":5}}';
  onDevice('F6A'); ops.session(rng(62)); clock += 1000; const st = { ...(await cs.syncNow({ reason: 'manual' })) };
  check('F6 ...and the sync still goes through', st.status === 'synced' && cloudStats('f6').sessions.length === 2, JSON.stringify(st));
}

// ── F7. garbage never replaces real data, however new it is ─────────────────
{
  const goodOf = {
    tm_user_stats: { xp: 500, sessions: [{ id: 'a', completedAt: '2026-01-01T00:00:00Z', xpEarned: 500 }] },
    tm_fight_stats: { rounds: 9, strikes: 99, bestStreak: 7, sessions: 3 },
    tm_achievements: { x: '2026-01-01' },
    tm_arcade_progress: { s1: { completedStages: { A: { completed: true, completedAt: 5 } }, currentStage: 2 } },
    tm_arcade_v2: { p: 5 }, tm_arcade_intro_seen: { p: true }, tm_camp_sessions: { 1: { a: true } },
    tm_starthere_completed: ['l1'], tm_arsenal: { boxing: ['JAB'] }, tm_practice_library_drilled: { a: ['x'] },
    tm_cardio_sessions: [{ id: 'c', completedAt: '2026-01-01T00:00:00Z' }],
    tm_weight_log: { squat: [{ weight: 50, timestamp: 1 }] }, tm_benchmarks: { pushups: [{ n: 10, date: '2026-01-01' }] },
  };
  const bad = [];
  for (const [k, g] of Object.entries(goodOf)) {
    const gv = JSON.stringify(g);
    const wrong = Array.isArray(g) ? '{"a":1}' : '[1,2]';
    for (const junk of ['null', '{bad json', '', '"hello"', '42', wrong]) {
      for (const [x, y] of [[{ v: gv, t: 1 }, { v: junk, t: 9 }], [{ v: junk, t: 9 }, { v: gv, t: 1 }]]) {
        const out = sm.mergeKey(k, x, y).v;
        if (sm.normalize(k, out) !== sm.normalize(k, gv)) bad.push(`${k} + ${junk || "''"} -> ${String(out).slice(0, 40)}`);
      }
    }
  }
  const camp = sm.mergeKey('tm_camp_progress', { v: '6', t: 1 }, { v: 'abc', t: 9 }).v;
  if (camp !== '6') bad.push(`camp + abc -> ${camp}`);
  check('F7 for every merged key, newer garbage loses to real data', bad.length === 0, bad.slice(0, 4).join('; '));
  const combo = JSON.stringify({ state: { currentCombo: 2, longestCombo: 9, history: [] }, lastProcessed: '2026-11-02' });
  const cbad = [];
  for (const junk of ['null', '{bad', '"x"', '[]', '{"state":null,"lastProcessed":{}}', '{"state":{"longestCombo":1},"lastProcessed":""}']) {
    for (const [x, y] of [[{ v: combo, t: 1 }, { v: junk, t: 9 }], [{ v: junk, t: 9 }, { v: combo, t: 1 }]]) {
      const out = sm.mergeKey('tm_combo_v1', x, y).v;
      if (out !== combo) cbad.push(`${junk} -> ${out}`);
    }
  }
  check('F7 combo state: a newer empty or broken copy never wins', cbad.length === 0, cbad.slice(0, 3).join('; '));
}

// ── F9. the account card reads only the short list of copies ─────────────────
{
  onDevice('F5A');
  cloud.clear(); mkDevice('F9A', 'f9'); mkDevice('F9B', 'f9');
  onDevice('F9A'); ops.session(rng(91)); W('tm_audio_settings', { volume: 1 }); clock += 1000; await sync('F9A'); clock += 1000; await sync('F9B');
  onDevice('F9A'); W('tm_audio_settings', { volume: 3 }); clock += 1000; await sync('F9A');
  onDevice('F9B'); clock += 1000; await sync('F9B', 'stats');
  onDevice('F9B'); reads.delete('tm_sync_backups');
  const list = cs.listLocalBackups();
  check('F9 listing the copies does not read the copies', list.length === 1 && !reads.get('tm_sync_backups'), `${list.length} copies, ${reads.get('tm_sync_backups') || 0} reads`);
}

console.log(`\ncloud sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
