// A phone that will not keep what the app saves must not freeze the finished screen, and must be told.
// Run: npm run test:storage
import process from 'node:process';

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => { if (ok) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}${detail ? ': ' + detail : ''}`); } };

// A localStorage that works, and can be told to refuse writes or to throw on access (blocked site data).
const makeStore = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { if (store.refuse) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' }); m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; }, refuse: false }; };
let store = makeStore();
const events = [];
const win = { events, dispatchEvent: (e) => { events.push(e.type); return true; }, addEventListener() {}, removeEventListener() {}, plausible: (name, o) => events.push(`plausible:${name}:${JSON.stringify(o?.props || {})}`), matchMedia: () => ({ matches: false }) };
Object.defineProperty(win, 'localStorage', { get() { if (win.blocked) throw new Error('SecurityError'); return store; }, configurable: true });
globalThis.window = win;
globalThis.localStorage = store;
globalThis.document = { cookie: '', visibilityState: 'visible' };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone) Safari', storage: { persist: async () => true } }, configurable: true });
globalThis.Event = class { constructor(type) { this.type = type; } };

const H = await import('../components/training-mode/data/storageHealth.js');
const S = await import('../components/training-mode/data/userStats.js');
const P = await import('../components/training-mode/data/userProfile.js');

// ── a failed save does not throw, and the visit keeps what was banked ─────
{
  store.refuse = true;
  let threw = null;
  try { S.addCombatConditioningSession(3, 3, 1, 1, true); } catch (e) { threw = e; }
  check('banking a Combat Conditioning run with storage refusing writes does not throw', !threw, threw && threw.message);
  const stats = S.loadStats();
  check('the visit still shows the banked run and its XP', stats.sessions.some((x) => x.mode === 'Combat Conditioning' || /combat/i.test(JSON.stringify(x))) && stats.xp > 0, `xp ${stats.xp}, sessions ${stats.sessions.length}`);
  check('the failure is recorded', H.getStorageHealth().writeFailed === true && H.getStorageHealth().failedKeys.includes('tm_user_stats'));
  const wf = events.filter((e) => e.startsWith('plausible:storage_write_failed'));
  check('the dashboard is told once, with the key', wf.length === 1 && /"key":"tm_user_stats"/.test(wf[0]), wf[0]);
  S.addCombatConditioningSession(3, 3, 1, 1, true);
  check('a second failed save is not reported again', events.filter((e) => e.startsWith('plausible:storage_write_failed')).length === 1 && S.loadStats().sessions.length === 2);
  let t2 = null; try { P.saveProfile({ name: 'A', goal: 'Build Muscle', experience: 'Beginner' }); } catch (e) { t2 = e; }
  check('saving the profile with storage refusing writes does not throw, and the visit keeps it', !t2 && P.loadProfile().name === 'A', t2 && t2.message);
  check('safeSetItem returns false instead of throwing', H.safeSetItem('trainingModeOnboardingComplete', 'true') === false);
  store.refuse = false;
}

// ── a good phone saves exactly as before ─────────────────────────────────
{
  H._resetStorageHealth(); store = makeStore(); globalThis.localStorage = store; events.length = 0;
  const before = S.loadStats().sessions.length;
  S.addCombatConditioningSession(2, 2, 1, 1, true);
  check('with working storage a run is saved to tm_user_stats', JSON.parse(store.getItem('tm_user_stats') || '{}').sessions?.length >= 1 || S.loadStats().sessions.length > before);
  check('and nothing is flagged', H.getStorageHealth().writeFailed === false);
  check('safeSetItem saves and returns true', H.safeSetItem('k', 'v') === true && store.getItem('k') === 'v');
}

// ── blocked site data: the getter itself throws ──────────────────────────
{
  win.blocked = true;
  check('safeStorage returns null instead of throwing when site data is blocked', H.safeStorage() === null);
  check('probeStorage says no', H.probeStorage() === false);
  check('safeSetItem does not throw', H.safeSetItem('x', '1') === false);
  win.blocked = false;
}

// ── what is detected, and what the banner says ───────────────────────────
{
  const ua = (s) => H.detectInAppBrowser(s);
  check('Instagram', ua('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4) AppleWebKit Mobile/15E148 Instagram 320.0.0.12.108') === 'instagram');
  check('Facebook', ua('Mozilla/5.0 [FBAN/FBIOS;FBAV/450.0]') === 'facebook' && ua('Mozilla/5.0 (Linux; Android 14) FB_IAB/FB4A') === 'facebook');
  check('TikTok', ua('Mozilla/5.0 (Linux; Android 13) musical_ly_32.0.0') === 'tiktok');
  check('Safari and Chrome are not in-app browsers', ua('Mozilla/5.0 (iPhone) Version/17.4 Mobile/15E148 Safari/604.1') === null && ua('Mozilla/5.0 (Linux; Android 14) Chrome/124 Mobile Safari/537.36') === null);

  const base = { writeFailed: false, probeOk: true, inapp: null, returning: 'onboarded' };
  check('a normal phone gets no notice', H.storageNotice(base) === null);
  check('a failed write is the most serious notice', H.storageNotice({ ...base, writeFailed: true, inapp: 'instagram' })?.kind === 'cannot-save');
  check('a failed probe says cannot-save', H.storageNotice({ ...base, probeOk: false })?.kind === 'cannot-save');
  check('lost progress says wiped', H.storageNotice({ ...base, returning: 'cookie_only' })?.kind === 'wiped');
  check('an in-app browser gets its notice, naming the app', /Instagram/.test(H.storageNotice({ ...base, inapp: 'instagram' })?.text || ''));
  check('wiped outranks in-app', H.storageNotice({ ...base, inapp: 'instagram', returning: 'cookie_only' })?.kind === 'wiped');
  // dismissal: in memory, and a new failed save brings a dismissed "cannot save" back
  H._resetStorageHealth();
  check('nothing is dismissed to begin with', H.noticeDismissed('cannot-save') === false && H.noticeDismissed('inapp') === false);
  store.refuse = true; H.safeSetItem('a', '1');
  H.dismissNotice('cannot-save');
  check('GOT IT hides a failure to save', H.noticeDismissed('cannot-save') === true);
  H.safeSetItem('b', '1');
  check('and the next failed save shows it again', H.noticeDismissed('cannot-save') === false);
  H.dismissNotice('inapp');
  check('GOT IT hides the in-app notice even though storage refuses the write', H.noticeDismissed('inapp') === true);
  store.refuse = false;
}

// ── the once-per-open check and the cookie that survives a wipe ──────────
{
  H._resetStorageHealth(); store = makeStore(); globalThis.localStorage = store; events.length = 0; globalThis.document.cookie = '';
  const s1 = H.runStorageCheck({ onboardingDone: false });
  check('a first-time visitor is "new"', s1.returning === 'new' && s1.probeOk === true);
  H.markOnboarded();
  check('finishing onboarding sets the long-lived cookie', /tm_seen=1/.test(globalThis.document.cookie) && /max-age=31536000/.test(globalThis.document.cookie), globalThis.document.cookie);
  globalThis.document.cookie = 'a=b; tm_seen=1';
  H._resetStorageHealth(); events.length = 0;
  const s2 = H.runStorageCheck({ onboardingDone: false });
  check('the cookie without the onboarding flag is "cookie_only" (storage was wiped)', s2.returning === 'cookie_only');
  const ev = events.filter((e) => e.startsWith('plausible:storage_check'));
  check('storage_check is sent once, with ok / inapp / standalone / returning', ev.length === 1 && /"ok":"yes"/.test(ev[0]) && /"returning":"cookie_only"/.test(ev[0]) && /"inapp":"none"/.test(ev[0]) && /"standalone":"no"/.test(ev[0]), ev[0]);
  H.runStorageCheck({ onboardingDone: false });
  check('and only once per open', events.filter((e) => e.startsWith('plausible:storage_check')).length === 1);
  const s3 = (H._resetStorageHealth(), H.runStorageCheck({ onboardingDone: true }));
  check('a returning athlete whose flag survived is "onboarded"', s3.returning === 'onboarded');
}

console.log(`\nstorage health: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
