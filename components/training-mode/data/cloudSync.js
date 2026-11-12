import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken, getCurrentUser, onAuthChange } from './authClient';
import { migrateArcadeIds } from './arcadeIdMigration';
import { TIMES_KEY, mergeSnapshots, normalize } from './syncMerge';

// ── Cloud progress sync ──────────────────────────────────────────────────────
// The app is local-first and stays that way: every screen reads localStorage and
// works offline, signed out, forever. This layer mirrors that local state into
// the athlete's own Supabase row (RLS: they can only ever touch their own), so a
// new phone, a cleared browser or a reinstall can restore it.
//
// Design notes:
//  • ONE row per user holding a snapshot of whitelisted keys, plus each key's
//    own change time (TIMES_KEY). Older app versions still read and write the
//    plain snapshot and simply ignore the times.
//  • Every sync MERGES the device and the cloud key by key (data/syncMerge.js):
//    sessions and logs are unioned, levels and stars only go up, settings go
//    to whichever side changed that setting last. Two devices that trained
//    offline both keep everything, in whatever order they come back online.
//  • Change times are stamped the first time a sync tick sees a key change
//    (ticks run on every save event, on backgrounding and every 5 minutes,
//    signed in or not, online or not), not when the upload happens.
//  • Local data belongs to one account (meta.owner). Signing in as someone
//    else sets the previous account's data aside on this device and starts
//    from the new account's cloud copy; accounts are never merged.
//  • Before a sync changes anything on the device the old values go into
//    tm_sync_backups (the last 5), which the account card can restore.
//  • Nothing on the device changes, and the page never reloads, while a
//    workout is live: the merge still goes up, the device catches up after.
//  • Never syncs: entitlements (server-authoritative), the paused-session
//    snapshot (device-specific), device permissions and transient nudge state.

const ENDPOINT = `${SUPABASE_URL}/rest/v1/progress_snapshots`;
const META_KEY = 'tm_sync_meta';
const LEGACY_BACKUP_KEY = 'tm_sync_backup';   // the single copy older versions kept
const BACKUPS_KEY = 'tm_sync_backups';
const MAX_BACKUPS = 5;
const USER_STASH_PREFIX = 'tm_sync_user_';    // another account's data, set aside
const RESTORE_FLAG = 'tm_sync_restored';   // sessionStorage, stops reload loops

// Everything that represents the athlete's actual progress or their settings.
export const SYNC_KEYS = [
  // identity + progression
  'tm_user_stats', 'tm_user_profile', 'tm_achievements', 'tm_fight_stats',
  // arcade
  'tm_arcade_progress', 'tm_arcade_v2', 'tm_active_arcade_challenge', 'tm_arcade_intro_seen',
  // training camp
  'tm_camp_progress', 'tm_camp_sessions', 'tm_camp_complete', 'tm_camp_archetype', 'tm_camp_parq',
  // fit / fight content the athlete created or earned
  'tm_benchmarks', 'tm_saved_routines', 'tm_custom_combos', 'tm_arsenal',
  'tm_practice_library_drilled', 'tm_practice_invite_v1',
  'tm_ghost_challenge_v1', 'tm_comeback_v1',
  'tm_fit_builder_history', 'tm_cardio_sessions', 'tm_weight_log',
  'tm_prog_bro', 'tm_prog_ppl', 'tm_prog_ul',
  // plan + preferences
  'tm_game_plan_v1', 'tm_equipment', 'tm_combo_v1', 'tm_ghosts_v1',
  'tm_audio_settings', 'tm_reminder_settings', 'tm_notification_prefs',
  // first-run milestones (so a restored device doesn't re-onboard)
  'tm_starthere_completed', 'trainingModeOnboardingComplete', 'trainingModeTourComplete',
  'trainingModeStartHereFirstLessonComplete',
];

const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// The clock, the account and the network, swappable so the sync can be run
// against a fake cloud in scripts/test-cloud-sync.mjs.
let deps = {
  getUser: getCurrentUser,
  getToken: getAccessToken,
  fetch: (...args) => fetch(...args),
  now: () => Date.now(),
  reload: () => window.location.reload(),
  later: (fn, ms) => setTimeout(fn, ms),
};
export function _setSyncTestDeps(patch) { deps = { ...deps, ...patch }; }

// Whether a workout is live right now. App.jsx sets this from the screen it
// shows and what the session reports. If the check itself fails, assume live:
// a missed reload is harmless, a reload mid-round is not.
let liveCheck = () => false;
export function setTrainingLiveCheck(fn) { liveCheck = typeof fn === 'function' ? fn : () => false; }
function trainingLive() { try { return !!liveCheck(); } catch { return true; } }

// ── local meta ───────────────────────────────────────────────────────────────
function readMeta() {
  if (!isBrowser) return {};
  try { return JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch { return {}; }
}
function writeMeta(patch) {
  if (!isBrowser) return {};
  const next = { ...readMeta(), ...patch };
  try { localStorage.setItem(META_KEY, JSON.stringify(next)); } catch { /* quota */ }
  return next;
}
function deviceId() {
  const m = readMeta();
  if (m.deviceId) return m.deviceId;
  const id = `d_${Math.random().toString(36).slice(2, 10)}${deps.now().toString(36)}`;
  writeMeta({ deviceId: id });
  return id;
}
function deviceLabel() {
  if (!isBrowser) return 'device';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'device';
}

// ── snapshot ─────────────────────────────────────────────────────────────────
export function collectSnapshot() {
  if (!isBrowser) return {};
  const out = {};
  for (const k of SYNC_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

function hashText(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}

// Cheap, ORDER-INDEPENDENT content fingerprint — avoids pushing when nothing
// changed. Key order must not matter: the local snapshot is built in SYNC_KEYS
// order while the cloud copy comes back in whatever order the server serialised
// it, and an order-sensitive hash would make identical data look different.
function hashSnapshot(snap) {
  return hashText(Object.keys(snap).sort().map((k) => `${k}\u0000${snap[k]}`).join('\u0001'));
}
// Fingerprint of the data itself, not its text: a device's own text and the
// merged text can order the same rows differently.
function dataHash(snap) {
  const out = {};
  for (const k of Object.keys(snap)) out[k] = k === TIMES_KEY ? snap[k] : normalize(k, snap[k]);
  return hashSnapshot(out);
}
function keyHashes(snap) {
  const out = {};
  for (const k of SYNC_KEYS) if (typeof snap[k] === 'string') out[k] = hashText(snap[k]);
  return out;
}

function xpOf(snap) {
  try { return JSON.parse(snap.tm_user_stats || '{}').xp || 0; } catch { return 0; }
}
function hasRealProgress(snap) {
  if (!snap.tm_user_stats) return false;
  try {
    const s = JSON.parse(snap.tm_user_stats);
    return (s.xp || 0) > 0 || (Array.isArray(s.sessions) ? s.sessions.length : 0) > 0;
  } catch { return false; }
}

// Stamp each key that changed since the last tick with the time it was seen
// to change; a key that disappeared is stamped as removed.
function noticeLocalChanges(snap) {
  const meta = readMeta();
  const now = deps.now();
  if (!isObj(meta.seen)) {
    // First tick of the merging sync on this device. If nothing changed since
    // the old sync last looked, the old "changed at" is still right for every
    // key; if something did, it changed since then; a device that never
    // synced has no claim on any time.
    const unchanged = meta.lastHash && hashSnapshot(snap) === meta.lastHash;
    const at = meta.changedAt ? (unchanged ? meta.changedAt : now) : 0;
    const times = {};
    for (const k of SYNC_KEYS) if (typeof snap[k] === 'string') times[k] = at;
    return writeMeta({ seen: keyHashes(snap), times });
  }
  const seen = { ...meta.seen };
  const times = { ...(isObj(meta.times) ? meta.times : {}) };
  let changed = false;
  for (const k of SYNC_KEYS) {
    const h = typeof snap[k] === 'string' ? hashText(snap[k]) : undefined;
    if (seen[k] !== h) {
      if (h === undefined) delete seen[k]; else seen[k] = h;
      times[k] = now;
      changed = true;
    }
  }
  return changed ? writeMeta({ seen, times }) : meta;
}

// ── backups ──────────────────────────────────────────────────────────────────
function readBackups() {
  if (!isBrowser) return [];
  try {
    const list = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((b) => isObj(b) && isObj(b.snap)) : [];
  } catch { return []; }
}
// Newest first, the last MAX_BACKUPS kept. When storage is full keep fewer
// copies rather than none; false only when not even one fits.
function writeBackups(list) {
  for (let n = Math.min(MAX_BACKUPS, list.length); n >= 0; n--) {
    try {
      if (n === 0) localStorage.removeItem(BACKUPS_KEY);
      else localStorage.setItem(BACKUPS_KEY, JSON.stringify(list.slice(0, n)));
      return n > 0 || list.length === 0;
    } catch { /* quota: try with fewer */ }
  }
  return false;
}
function saveBackup(snap) {
  const owner = readMeta().owner || null;
  return writeBackups([{ at: deps.now(), owner, snap }, ...readBackups()]);
}
// The single copy older versions kept becomes the oldest entry, owned by the
// account this device's data is first claimed for.
function adoptLegacyBackup(owner) {
  try {
    const b = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY) || 'null');
    if (isObj(b?.snap) && writeBackups([...readBackups(), { at: b.at || 0, owner, snap: b.snap }])) {
      localStorage.removeItem(LEGACY_BACKUP_KEY);
    }
  } catch { /* keep the old copy where it is */ }
}

/** Copies this account can restore on this device, newest first: [{ at }]. */
export function listLocalBackups() {
  const owner = readMeta().owner || null;
  return readBackups().filter((b) => b.owner === owner).map((b) => ({ at: b.at || 0 }));
}

// Put back the newest copy taken before a sync changed this device, and drop
// it from the list (so a second restore goes one copy further back). Sessions
// and levels from other devices are still in the cloud and merge back in on
// the next sync; settings restored here count as changed now, so they win.
export function restoreLocalBackup() {
  if (!isBrowser) return false;
  const owner = readMeta().owner || null;
  const list = readBackups();
  const i = list.findIndex((b) => b.owner === owner);
  if (i < 0) return false;
  try {
    for (const k of SYNC_KEYS) {
      const v = list[i].snap[k];
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
  } catch { return false; }
  list.splice(i, 1);
  writeBackups(list);
  noticeLocalChanges(collectSnapshot());
  announceLocalChange();
  scheduleReload('manual', true);
  return true;
}

// ── accounts on one device ───────────────────────────────────────────────────
// Set the current account's data aside under its own key, clear the synced
// keys, and bring back the new account's own set-aside data if this device
// has some. False (and nothing changed) if the old data could not be kept.
function switchOwner(fromId, toId) {
  const meta = readMeta();
  const stash = { at: deps.now(), snap: collectSnapshot(), times: meta.times || {}, seen: meta.seen || null, synced: !!meta.synced };
  try { localStorage.setItem(USER_STASH_PREFIX + fromId, JSON.stringify(stash)); } catch { return false; }
  let back = null;
  try { back = JSON.parse(localStorage.getItem(USER_STASH_PREFIX + toId) || 'null'); } catch { back = null; }
  if (!isObj(back?.snap)) back = null;
  for (const k of SYNC_KEYS) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  let restored = true;
  if (back) {
    for (const k of SYNC_KEYS) {
      const v = back.snap[k];
      if (typeof v === 'string') { try { localStorage.setItem(k, v); } catch { restored = false; } }
    }
  }
  const now = collectSnapshot();
  writeMeta({
    owner: toId,
    times: back && isObj(back.times) ? back.times : {},
    seen: back && isObj(back.seen) ? back.seen : keyHashes(now),
    synced: !!back?.synced,
    lastPushedHash: null,
  });
  if (back && restored) { try { localStorage.removeItem(USER_STASH_PREFIX + toId); } catch { /* noop */ } }
  return true;
}

// ── state broadcast (for the Profile card) ───────────────────────────────────
let state = { status: 'idle', at: null, error: null };   // idle|syncing|synced|error|offline
const listeners = new Set();
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => { try { fn(state); } catch { /* listener threw */ } });
}
export function getSyncState() { return state; }
export function onSyncState(fn) { listeners.add(fn); fn(state); return () => listeners.delete(fn); }

// ── reloads ──────────────────────────────────────────────────────────────────
// Modules read localStorage at import time, so after the device takes in data
// a one-shot reload is the only way every screen shows it. It happens only at
// moments a reload is expected (app start, sign-in, a tap, coming back to the
// app), never while a workout is live and never right after the app's own save
// (that is the summary screen); otherwise it waits for the next such moment.
const RELOAD_NOW = new Set(['start', 'auth', 'manual', 'visible', 'online']);
let pendingReload = false;
let pendingForce = false;
function announceLocalChange() {
  try {
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('training-mode-stats-updated'));
  } catch { /* noop */ }
}
function scheduleReload(reason, force = false) {
  let already = false;
  try { already = !!sessionStorage.getItem(RESTORE_FLAG); } catch { /* noop */ }
  if (already && !force && !pendingForce) { pendingReload = false; return; }
  if (trainingLive() || !RELOAD_NOW.has(reason)) {
    pendingReload = true;
    pendingForce = pendingForce || force;
    return;
  }
  pendingReload = false;
  pendingForce = false;
  try { sessionStorage.setItem(RESTORE_FLAG, '1'); } catch { /* noop */ }
  deps.later(() => { try { deps.reload(); } catch { /* noop */ } }, 400);
}

// ── network ──────────────────────────────────────────────────────────────────
async function authHeaders() {
  const token = await deps.getToken();
  if (!token) return null;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function pullRow(headers) {
  const res = await deps.fetch(`${ENDPOINT}?select=data,client_changed_at,updated_at,device_label&limit=1`, { headers });
  if (!res.ok) throw new Error(`pull ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function pushRow(headers, userId, snap, changedAt, keepalive = false) {
  const body = JSON.stringify({
    user_id: userId,
    data: snap,
    client_changed_at: new Date(changedAt).toISOString(),
    device_id: deviceId(),
    device_label: deviceLabel(),
  });
  const res = await deps.fetch(ENDPOINT, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body,
    // keepalive lets a push survive the tab closing, but the browser caps those
    // bodies at 64KB — a long training history blows past that and the request
    // would throw. Over the cap we fall back to a normal fetch.
    keepalive: keepalive && body.length < 60000,
  });
  if (!res.ok) throw new Error(`push ${res.status}`);
}

// Each key's change time in the cloud row. A row an older version wrote has
// no times: every key in it is as old as the row.
function cloudTimesOf(row) {
  const data = isObj(row?.data) ? row.data : {};
  try {
    const t = JSON.parse(data[TIMES_KEY] || 'null');
    if (isObj(t)) return t;
  } catch { /* an older row */ }
  const at = Date.parse(row?.client_changed_at || row?.updated_at || 0) || 0;
  const out = {};
  for (const k of SYNC_KEYS) if (typeof data[k] === 'string') out[k] = at;
  return out;
}

// Write the merge onto the device, after keeping a copy of what it replaces.
// False (and nothing written) if no copy could be kept.
function applyMerged(merged, removed, times, before) {
  if (!saveBackup(before)) return false;
  for (const k of SYNC_KEYS) {
    if (typeof merged[k] === 'string' && normalize(k, merged[k]) !== normalize(k, before[k])) { try { localStorage.setItem(k, merged[k]); } catch { /* quota */ } }
  }
  for (const k of removed) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  // The cloud may hold data from a device that has not taken the arcade-id
  // rename yet, so it can carry legacy campaign / series / stage ids.
  // Re-running the migration here is what stops a restore from resurrecting
  // them (and is why that migration is deliberately flag-free and idempotent).
  try { migrateArcadeIds(); } catch { /* never block a restore */ }
  writeMeta({ times, seen: keyHashes(collectSnapshot()) });
  return true;
}

// ── the one entry point ──────────────────────────────────────────────────────
let running = false;

export async function syncNow({ reason = 'manual', keepalive = false } = {}) {
  if (!isBrowser || running) return state;
  running = true;
  try {
    // Stamp local changes on every tick, signed in or not, online or not, so
    // each key's time is close to when it really changed.
    let snap = collectSnapshot();
    noticeLocalChanges(snap);
    if (pendingReload && reason !== 'unload') scheduleReload(reason);

    const user = await deps.getUser();
    if (!user) { setState({ status: 'idle', error: null }); return state; }
    if (navigator.onLine === false) { setState({ status: 'offline' }); return state; }

    setState({ status: 'syncing', error: null });
    const headers = await authHeaders();
    if (!headers) throw new Error('no token');

    // Whose data is on this device. A device that never synced (or synced
    // before owners were kept) is claimed by the first account to sync it.
    let meta = readMeta();
    let switched = false;
    if (!meta.owner) {
      meta = writeMeta({ owner: user.id });
      adoptLegacyBackup(user.id);
    } else if (meta.owner !== user.id) {
      // Not mid-workout: that would swap the data under a live session.
      if (trainingLive()) { setState({ status: 'idle' }); return state; }
      if (!switchOwner(meta.owner, user.id)) throw new Error('storage full');
      switched = true;
      snap = collectSnapshot();
      noticeLocalChanges(snap);
      meta = readMeta();
    }

    const row = await pullRow(headers);
    const cloudSnap = isObj(row?.data) ? row.data : {};
    // A device that has never synced with this account and holds no training
    // of its own takes the account's settings, not the defaults it wrote on
    // first run.
    const localTimes = !meta.synced && !hasRealProgress(snap) ? {} : (meta.times || {});
    const { merged, times, removed } = mergeSnapshots(snap, cloudSnap, {
      keys: SYNC_KEYS, localTimes, cloudTimes: row ? cloudTimesOf(row) : {},
    });

    const deviceChanges = removed.length > 0 || SYNC_KEYS.some((k) => normalize(k, merged[k] ?? null) !== normalize(k, snap[k] ?? null));
    let applied = false;
    if (deviceChanges && !trainingLive()) {
      // Something saved while we were talking to the server: leave the device
      // alone this round (the merge still goes up) and come back to it.
      if (hashSnapshot(collectSnapshot()) === hashSnapshot(snap)) applied = applyMerged(merged, removed, times, snap);
      else deps.later(() => syncNow({ reason: 'storage' }), 4000);
    }

    const upSnap = applied ? collectSnapshot() : merged;
    const up = { ...upSnap, [TIMES_KEY]: JSON.stringify(times) };
    const upHash = dataHash(up);
    if (!row || upHash !== dataHash(cloudSnap)) {
      await pushRow(headers, user.id, up, deps.now(), keepalive);
      writeMeta({ lastPushedHash: upHash, lastPushedAt: deps.now() });
    }
    writeMeta({ synced: true, lastPulledAt: deps.now() });

    setState({ status: 'synced', at: deps.now(), ...(applied ? { restoredXp: xpOf(merged) } : {}) });
    if (applied || switched) {
      announceLocalChange();
      scheduleReload(reason, switched);
    }
    return state;
  } catch (e) {
    setState({ status: 'error', error: String(e?.message || e) });
    return state;
  } finally {
    running = false;
  }
}

// ── wiring ───────────────────────────────────────────────────────────────────
let started = false;
let debounce = 0;

export function startCloudSync() {
  if (!isBrowser || started) return () => {};
  started = true;

  const kick = (reason) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => syncNow({ reason }), 4000);
  };

  const onStats = () => kick('stats');
  const onStorage = () => kick('storage');
  const onOnline = () => syncNow({ reason: 'online' });
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      clearTimeout(debounce);
      syncNow({ reason: 'unload', keepalive: true });   // flush before backgrounding
    } else {
      kick('visible');
    }
  };

  window.addEventListener('training-mode-stats-updated', onStats);
  window.addEventListener('storage', onStorage);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisibility);

  // Sign-in is the moment a restore matters most; sign-out just goes quiet.
  const unsubAuth = onAuthChange((user) => {
    if (user) syncNow({ reason: 'auth' });
    else { try { sessionStorage.removeItem(RESTORE_FLAG); } catch { /* noop */ } setState({ status: 'idle', at: null, error: null }); }
  });

  // Catch-all for long sessions where nothing else fires.
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') syncNow({ reason: 'interval' });
  }, 5 * 60 * 1000);

  syncNow({ reason: 'start' });

  return () => {
    started = false;
    clearTimeout(debounce);
    clearInterval(interval);
    window.removeEventListener('training-mode-stats-updated', onStats);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubAuth();
  };
}
