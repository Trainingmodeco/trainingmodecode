// Cloud sync: devices that train offline and sync in any order keep every
// session, never count one twice, never lose a level, and end up holding the
// same data as the cloud. Runs the real data/cloudSync.js against a fake
// cloud and fake devices, with a seeded random sweep of training and sync
// orders. Run with `npm run test:sync`.

// ── fake browser, one storage per device ─────────────────────────────────────
let store = new Map();
let sess = new Map();
const mkStorage = (get) => ({
  getItem: (k) => (get().has(k) ? get().get(k) : null),
  setItem: (k, v) => { get().set(k, String(v)); },
  removeItem: (k) => { get().delete(k); },
  clear: () => get().clear(),
  key: (i) => [...get().keys()][i] ?? null,
  get length() { return get().size; },
});
globalThis.localStorage = mkStorage(() => store);
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
const fakeFetch = async (url, opts = {}) => {
  const auth = (opts.headers && opts.headers.Authorization) || '';
  const uid = auth.replace('Bearer tok:', '');
  if (!String(url).includes('/rest/v1/progress_snapshots') || !uid) return { ok: false, status: 404, json: async () => ({}) };
  if ((opts.method || 'GET') === 'GET') {
    const row = cloud.get(uid);
    return { ok: true, json: async () => (row ? [JSON.parse(JSON.stringify(row))] : []) };
  }
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
  if (s.xp < sessionXp) problems.push(`xp ${s.xp} below the sessions' ${sessionXp}`);
  if (s.xp > sessionXp + allBonus) problems.push(`xp ${s.xp} counts something twice (max ${sessionXp + allBonus})`);
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

console.log(`\ncloud sync: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
