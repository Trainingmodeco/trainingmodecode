import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken, getCurrentUser, onAuthChange } from './authClient';
import { migrateArcadeIds } from './arcadeIdMigration';
import { TIMES_KEY, mergeSnapshots, normalize, ledgerStats, withLedger, mergeKey } from './syncMerge';

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
//  • When a sync changes the device, the old values of the keys it changed go
//    into tm_sync_backups (the last 5, kept small so they never crowd out
//    the athlete's own data), which the account card can restore.
//  • The athlete's data always comes before the copies: when storage is full
//    the copies go first, and a sync that still cannot write says so.
//  • Nothing on the device changes, and the page never reloads, while a
//    workout is live: the merge still goes up, the device catches up after.
//  • Never syncs: entitlements (server-authoritative), the paused-session
//    snapshot (device-specific), device permissions and transient nudge state.

const ENDPOINT = `${SUPABASE_URL}/rest/v1/progress_snapshots`;
const META_KEY = 'tm_sync_meta';
const LEGACY_BACKUP_KEY = 'tm_sync_backup';   // the single copy older versions kept
const BACKUPS_KEY = 'tm_sync_backups';
const BACKUP_INDEX_KEY = 'tm_sync_backup_index';   // [{ at, owner, size }], read by the account card
const MAX_BACKUPS = 5;
// All copies together stay under about 1 MB (browsers count two bytes a
// character) and under a fifth of what the synced keys use, but may always
// use 40 KB: with little data a fifth would not fit even one changed setting.
const BACKUP_MAX_CHARS = 500000;
const BACKUP_MIN_CHARS = 20000;
const BACKUP_SHARE = 0.2;
const PROBE_KEY = 'tm_sync_probe';
const STATS_KEY = 'tm_user_stats';
// What the account card shows when storage stops a sync.
export const SYNC_ERROR_STORAGE = 'storage full';
export const SYNC_ERROR_SWITCH = 'storage full: account switch';
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
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    return isObj(m) ? m : {};
  } catch { return {}; }
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

// ── storage ──────────────────────────────────────────────────────────────────
function trySet(k, v) {
  try { localStorage.setItem(k, v); return true; } catch { return false; }
}
// The copies are the only thing the sync keeps that can go without losing
// anything the athlete did. userStats.js drops the same keys when a workout
// save meets full storage.
function clearBackupList() {
  for (const k of [BACKUPS_KEY, BACKUP_INDEX_KEY]) { try { localStorage.removeItem(k); } catch { /* noop */ } }
}
function dropBackups() {
  clearBackupList();
  try { localStorage.removeItem(LEGACY_BACKUP_KEY); } catch { /* noop */ }
}
// Write a key the athlete's data needs; if storage is full, drop the copies
// and try once more.
function setData(k, v) {
  if (trySet(k, v)) return true;
  dropBackups();
  return trySet(k, v);
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

// Per-key hashes as one text, whatever order the keys are in.
const hashesKey = (h) => (isObj(h) ? Object.keys(h).sort().map((k) => `${k}=${h[k]}`).join('|') : '');

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
// Each copy holds only the keys one sync changed, as they were before it:
// { at, owner, snap: { key: old text }, size }. The list of copies (times and
// sizes) is kept apart, so the account card never reads the copies.
function readBackups() {
  if (!isBrowser) return [];
  try {
    const list = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((b) => isObj(b) && isObj(b.snap)) : [];
  } catch { return []; }
}
const sizeOf = (b) => JSON.stringify(b).length;
function backupCap(snap) {
  let used = 0;
  for (const k of SYNC_KEYS) if (typeof snap[k] === 'string') used += snap[k].length;
  return Math.min(BACKUP_MAX_CHARS, Math.max(BACKUP_MIN_CHARS, Math.floor(used * BACKUP_SHARE)));
}
// Newest first: at most MAX_BACKUPS, all together within `cap`. When storage
// is full keep fewer rather than fail. Returns how many were kept.
function writeBackups(list, cap) {
  const keep = [];
  let total = 0;
  for (const b of list.slice(0, MAX_BACKUPS)) {
    const size = sizeOf(b);
    if (total + size > cap) break;
    keep.push({ ...b, size });
    total += size;
  }
  for (let n = keep.length; n >= 0; n--) {
    const index = JSON.stringify(keep.slice(0, n).map((b) => ({ at: b.at || 0, owner: b.owner ?? null, size: b.size })));
    if (n === 0) { clearBackupList(); trySet(BACKUP_INDEX_KEY, '[]'); return 0; }
    if (trySet(BACKUPS_KEY, JSON.stringify(keep.slice(0, n)))) {
      if (!trySet(BACKUP_INDEX_KEY, index)) { clearBackupList(); return 0; }
      return n;
    }
  }
  return 0;
}
// A copy that is larger than the cap leaves out the stats: their merge only
// ever adds sessions and grows the XP counters, so that copy matters least
// and costs most. Null when even the rest does not fit.
function fitBackup(b, cap) {
  if (sizeOf(b) <= cap) return b;
  const { [STATS_KEY]: _s, ...rest } = b.snap;
  const slim = { ...b, snap: rest };
  return Object.keys(rest).length && sizeOf(slim) <= cap ? slim : null;
}
function saveBackup(before, keys) {
  const snap = {};
  for (const k of keys) if (typeof before[k] === 'string') snap[k] = before[k];
  if (!Object.keys(snap).length) return;
  const cap = backupCap(before);
  const b = fitBackup({ at: deps.now(), owner: readMeta().owner || null, snap }, cap);
  if (b) writeBackups([b, ...readBackups()], cap);
}
// Leave room for at least twice the stats (and the sync's own small notes
// written after this), so the next workout save fits: drop the oldest copies
// until a probe that size can be written.
function keepHeadroom() {
  if (!isBrowser) return;
  const index = localStorage.getItem(BACKUP_INDEX_KEY);
  const has = (index !== null && index !== '[]') || (index === null && localStorage.getItem(BACKUPS_KEY) !== null)
    || localStorage.getItem(LEGACY_BACKUP_KEY) !== null;
  if (!has) return;
  const stats = (localStorage.getItem(STATS_KEY) || '').length;
  if (!stats) return;
  const need = 2 * stats + 20000;
  const probe = () => { const ok = trySet(PROBE_KEY, 'x'.repeat(need)); try { localStorage.removeItem(PROBE_KEY); } catch { /* noop */ } return ok; };
  let list = readBackups();
  const cap = backupCap(collectSnapshot());
  while (!probe()) {
    if (!list.length) { dropBackups(); return; }
    list = list.slice(0, -1);
    if (!writeBackups(list, cap)) list = [];
  }
}
// The single copy older versions kept becomes the oldest entry, owned by the
// account this device's data is first claimed for.
function adoptLegacyBackup(owner) {
  try {
    const b = JSON.parse(localStorage.getItem(LEGACY_BACKUP_KEY) || 'null');
    if (!isObj(b?.snap)) return;
    const cap = backupCap(collectSnapshot());
    const old = fitBackup({ at: b.at || 0, owner, snap: b.snap }, cap);
    const list = readBackups();
    if (old && writeBackups([...list, old], cap) > list.length) localStorage.removeItem(LEGACY_BACKUP_KEY);
  } catch { /* keep the old copy where it is */ }
}

function readBackupIndex() {
  if (!isBrowser) return [];
  try {
    const raw = localStorage.getItem(BACKUP_INDEX_KEY);
    if (raw !== null) {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(isObj) : [];
    }
  } catch { return []; }
  // Copies written before the list was kept apart (whole snapshots): trim
  // them to the size rules and build the list, once.
  if (localStorage.getItem(BACKUPS_KEY) === null) return [];
  const cap = backupCap(collectSnapshot());
  const list = readBackups().map((b) => fitBackup(b, cap)).filter(Boolean);
  const n = writeBackups(list, cap);
  return list.slice(0, n).map((b) => ({ at: b.at || 0, owner: b.owner ?? null }));
}

/** Copies this account can restore on this device, newest first: [{ at }]. */
export function listLocalBackups() {
  const owner = readMeta().owner || null;
  return readBackupIndex().filter((b) => (b.owner ?? null) === owner).map((b) => ({ at: b.at || 0 }));
}

// Put back the newest copy taken before a sync changed this device, and drop
// it from the list (so a second restore goes one copy further back). Sessions
// and levels from other devices are still in the cloud and merge back in on
// the next sync; settings restored here count as changed now, so they win.
export function restoreLocalBackup() {
  if (!isBrowser) return false;
  const owner = readMeta().owner || null;
  const list = readBackups();
  const i = list.findIndex((b) => (b.owner ?? null) === owner);
  // No copy for this account: the list may be stale (a workout save that met
  // full storage drops the copies), so write it again from what is there.
  if (i < 0) { writeBackups(list, Infinity); return false; }
  try {
    for (const k of SYNC_KEYS) {
      let v = list[i].snap[k];
      if (typeof v !== 'string') continue;
      // Stats are put back merged with what the device has now: the next
      // sync would bring the sessions back anyway, and the XP counters must
      // never go back (a later penalty would then be lost against the
      // cloud's larger count).
      const now = localStorage.getItem(k);
      if (k === STATS_KEY && typeof now === 'string') v = mergeKey(k, { v, t: 0 }, { v: now, t: 0 }).v;
      if (!setData(k, v)) return false;
    }
  } catch { return false; }
  list.splice(i, 1);
  writeBackups(list, Infinity);
  noticeLocalChanges(collectSnapshot());
  announceLocalChange();
  scheduleReload('manual', true);
  return true;
}

// ── accounts on one device ───────────────────────────────────────────────────
// Set the current account's data aside under its own key, clear the synced
// keys, and bring back the new account's own set-aside data if this device
// has some. False (and nothing changed) if the old data could not be kept.
//
// When storage is too full for the set-aside copy, the copies go first; if
// it still does not fit and the data on the device is exactly what the last
// sync left in the old account's cloud row, that row is its copy and the
// switch goes ahead without one. Otherwise the switch waits: the data stays
// under the old account and the new one does not sync here (syncNow says
// so on the account card), so the two are never mixed in either cloud row.
//
// Known gap, left as it is: a device that has no owner yet (it last synced
// on a version that did not keep one) is claimed by whoever syncs first,
// even if it holds someone else's data. That version already uploaded it to
// the signed-in account as soon as they trained, so this is not new.
function switchOwner(fromId, toId) {
  const meta = readMeta();
  const snap = collectSnapshot();
  const stash = JSON.stringify({ at: deps.now(), snap, times: meta.times || {}, seen: meta.seen || null, synced: !!meta.synced });
  if (!setData(USER_STASH_PREFIX + fromId, stash)) {
    const inCloud = !!meta.cloudHolds && meta.cloudHolds === hashesKey(keyHashes(snap));
    if (!inCloud) return false;
  }
  let back = null;
  try { back = JSON.parse(localStorage.getItem(USER_STASH_PREFIX + toId) || 'null'); } catch { back = null; }
  if (!isObj(back?.snap)) back = null;
  for (const k of SYNC_KEYS) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  let restored = true;
  if (back) {
    for (const k of SYNC_KEYS) {
      const v = back.snap[k];
      if (typeof v === 'string' && !setData(k, v)) restored = false;
    }
  }
  const now = collectSnapshot();
  writeMeta({
    owner: toId,
    times: back && isObj(back.times) ? back.times : {},
    seen: back && isObj(back.seen) ? back.seen : keyHashes(now),
    synced: !!back?.synced,
    lastPushedHash: null,
    cloudHolds: null,
    // The account's own data, back from where it was set aside: its XP was
    // already counted, so the ledger takes it as a first look, not as XP
    // this device just earned.
    bonusId: null,
  });
  if (back && restored) { try { localStorage.removeItem(USER_STASH_PREFIX + toId); } catch { /* noop */ } }
  return true;
}

// ── XP ledger ────────────────────────────────────────────────────────────────
// Bring the device's own stats in line with the bonus ledger (syncMerge.js,
// ledgerStats) before anything is merged: XP the sessions do not explain
// goes on this device's counter, so a penalty stays taken and two devices'
// bonuses add up. Runs on every tick, signed in or not. Returns the snapshot
// to merge (with the ledger, even if storage was too full to write it).
function keepLedger(snap) {
  const text = snap[STATS_KEY];
  const meta = readMeta();
  const first = !meta.bonusId;
  const id = meta.bonusId || deviceId();
  if (typeof text !== 'string') {
    if (first) writeMeta({ bonusId: id });
    return snap;
  }
  // Stats unchanged since they were last found in line: nothing to do (this
  // skips parsing a long history on every quiet tick).
  const h = hashText(text);
  if (!first && meta.ledgerOk === h) return snap;
  const freshId = `${deviceId()}.${deps.now().toString(36)}`;
  const r = ledgerStats(text, { id, first, freshId });
  if (r.text === text) {
    writeMeta({ bonusId: r.id, ledgerOk: h });
    return snap;
  }
  if (!setData(STATS_KEY, r.text)) {
    // A fresh counter only counts if it is kept: merging it unwritten and
    // making another next tick would count the same XP twice. Merge the
    // stats as they are instead (their extra XP is a claim on the shared
    // bucket, which can only count once).
    return r.id === id ? { ...snap, [STATS_KEY]: r.text } : snap;
  }
  const m = readMeta();
  const hNew = hashText(r.text);
  writeMeta({ bonusId: r.id, ledgerOk: hNew, ...(isObj(m.seen) ? { seen: { ...m.seen, [STATS_KEY]: hNew } } : {}) });
  // userStats.js caches the parsed stats and drops the cache on this event;
  // a stale copy saved over the ledger would be absorbed again, but this
  // keeps it from happening at all.
  try { window.dispatchEvent(new Event('storage')); } catch { /* noop */ }
  return { ...snap, [STATS_KEY]: r.text };
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

// Write the merge onto the device, data first, then a copy of what it
// replaced. Returns { wrote, failed }: the keys written and the keys storage
// could not take even after dropping the copies (those keep their old value
// and their old change time, so the next sync tries again).
function applyMerged(merged, removed, times, before) {
  const changed = SYNC_KEYS.filter((k) => typeof merged[k] === 'string' && normalize(k, merged[k]) !== normalize(k, before[k]));
  // The stats first: they hold the workouts.
  changed.sort((a, b) => (b === STATS_KEY) - (a === STATS_KEY));
  const wrote = [];
  const failed = [];
  for (const k of changed) (setData(k, merged[k]) ? wrote : failed).push(k);
  for (const k of removed) { try { localStorage.removeItem(k); } catch { /* noop */ } }
  // The cloud may hold data from a device that has not taken the arcade-id
  // rename yet, so it can carry legacy campaign / series / stage ids.
  // Re-running the migration here is what stops a restore from resurrecting
  // them (and is why that migration is deliberately flag-free and idempotent).
  try { migrateArcadeIds(); } catch { /* never block a restore */ }
  const meta = readMeta();
  const kept = { ...times };
  const oldTimes = isObj(meta.times) ? meta.times : {};
  for (const k of failed) { if (k in oldTimes) kept[k] = oldTimes[k]; else delete kept[k]; }
  writeMeta({ times: kept, seen: keyHashes(collectSnapshot()) });
  if (wrote.length || removed.length) saveBackup(before, [...wrote, ...removed]);
  keepHeadroom();
  return { wrote, failed };
}

// The time to send as the row's change time. Older versions take the cloud
// row only when it is more than 2 s newer than their own last change, and
// then replace their data with it.
//  • Normally the latest change of any key, not the moment of the upload, so
//    a push that adds only bookkeeping never looks newer than a change an
//    older device has not uploaded yet.
//  • When the merge holds data the cloud row did not (another device's
//    older session, say), just past the row's own time: an older device that
//    has not changed anything since that row takes the merge, and one that
//    has (its change time is later) keeps its own and uploads it.
function changeTimeFor(times, row, news) {
  let t = 0;
  for (const v of Object.values(times)) if (Number.isFinite(v) && v > t) t = v;
  t = Math.min(t, deps.now());
  const rowAt = Date.parse(row?.client_changed_at || '');
  return news && Number.isFinite(rowAt) ? Math.max(t, rowAt + 2001) : t;
}

// ── the one entry point ──────────────────────────────────────────────────────
let running = false;

// The device's data as the sync sees it: change times stamped, the XP
// ledger kept. `snap` is what to merge, `base` what storage holds.
function readLocal() {
  const raw = collectSnapshot();
  noticeLocalChanges(raw);
  const snap = keepLedger(raw);
  return { snap, base: snap === raw ? raw : collectSnapshot() };
}

export async function syncNow({ reason = 'manual', keepalive = false } = {}) {
  if (!isBrowser || running) return state;
  running = true;
  try {
    // Stamp local changes on every tick, signed in or not, online or not, so
    // each key's time is close to when it really changed.
    let { snap, base } = readLocal();
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
      if (!switchOwner(meta.owner, user.id)) {
        setState({ status: 'error', error: SYNC_ERROR_SWITCH });
        return state;
      }
      switched = true;
      ({ snap, base } = readLocal());
      meta = readMeta();
    }

    const row = await pullRow(headers);
    const cloudSnap = isObj(row?.data) ? row.data : {};
    // A device that has never synced with this account and holds no training
    // of its own takes the account's settings, not the defaults it wrote on
    // first run.
    const localTimes = !meta.synced && !hasRealProgress(snap) ? {} : (meta.times || {});
    // The cloud's stats are this device's own last upload from before the XP
    // ledger: their bonus part is an older copy of this device's own.
    const cloudStats = cloudSnap[STATS_KEY];
    const ownStats = !!row && !!meta.lastPushedHash && typeof cloudStats === 'string' && !cloudStats.includes('"bonus"')
      && meta.lastPushedHash === hashSnapshot(cloudSnap);
    const { merged, times, removed } = mergeSnapshots(snap, cloudSnap, {
      keys: SYNC_KEYS, localTimes, cloudTimes: row ? cloudTimesOf(row) : {}, ownStats,
    });
    if (typeof merged[STATS_KEY] === 'string') merged[STATS_KEY] = withLedger(merged[STATS_KEY]);

    const deviceChanges = removed.length > 0 || SYNC_KEYS.some((k) => normalize(k, merged[k] ?? null) !== normalize(k, base[k] ?? null));
    let applied = false;
    let failed = [];
    let up = merged;
    let concurrent = false;
    if (deviceChanges && !trainingLive()) {
      // Something saved while we were talking to the server: leave the device
      // alone this round (the merge still goes up) and come back to it.
      if (hashSnapshot(collectSnapshot()) === hashSnapshot(base)) {
        const res = applyMerged(merged, removed, times, base);
        applied = res.wrote.length > 0 || removed.length > 0;
        failed = res.failed;
        // Always upload the merge, never the device's unmerged data: only
        // keys the arcade-id migration just rewrote are read back.
        const after = collectSnapshot();
        up = { ...merged };
        for (const k of SYNC_KEYS) {
          if (failed.includes(k)) continue;
          const expect = res.wrote.includes(k) ? merged[k] : (removed.includes(k) ? undefined : base[k]);
          if (after[k] !== expect) { if (typeof after[k] === 'string') up[k] = after[k]; else delete up[k]; }
        }
      } else { concurrent = true; deps.later(() => syncNow({ reason: 'storage' }), 4000); }
    }

    const upFull = { ...up, [TIMES_KEY]: JSON.stringify(times) };
    const upHash = dataHash(upFull);
    if (!row || upHash !== dataHash(cloudSnap)) {
      const news = !!row && SYNC_KEYS.some((k) => normalize(k, up[k] ?? null) !== normalize(k, typeof cloudSnap[k] === 'string' ? cloudSnap[k] : null));
      await pushRow(headers, user.id, upFull, changeTimeFor(times, row, news), keepalive);
      writeMeta({ lastPushedHash: upHash, lastPushedAt: deps.now() });
    }
    // Whether the cloud row now holds exactly the data on this device (an
    // account switch may then go ahead without a set-aside copy).
    const holds = !failed.length && !concurrent && (applied || !deviceChanges);
    writeMeta({ synced: true, lastPulledAt: deps.now(), cloudHolds: holds ? hashesKey(readMeta().seen) : null });

    if (failed.length) setState({ status: 'error', error: SYNC_ERROR_STORAGE });
    else setState({ status: 'synced', at: deps.now(), ...(applied ? { restoredXp: xpOf(merged) } : {}) });
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
