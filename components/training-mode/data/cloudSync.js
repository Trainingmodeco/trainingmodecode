import { SUPABASE_URL, SUPABASE_ANON_KEY, getAccessToken, getCurrentUser, onAuthChange } from './authClient';
import { migrateArcadeIds } from './arcadeIdMigration';

// ── Cloud progress sync ──────────────────────────────────────────────────────
// The app is local-first and stays that way: every screen reads localStorage and
// works offline, signed out, forever. This layer mirrors that local state into
// the athlete's own Supabase row (RLS: they can only ever touch their own), so a
// new phone, a cleared browser or a reinstall can restore it.
//
// Design notes:
//  • ONE row per user holding a snapshot of whitelisted keys. Simple, atomic,
//    and impossible to half-apply.
//  • Change detection is a cheap hash of the snapshot, not an event bus, so keys
//    written by any screen (routines, camp, arcade, weight log) are all covered
//    without every module having to remember to announce itself.
//  • Conflict resolution is last-writer-wins on the device's own "progress last
//    changed" clock — the device you trained on most recently wins, which is what
//    an athlete expects. Before ever adopting the cloud copy we stash the local
//    one in tm_sync_backup so nothing is unrecoverable.
//  • Never syncs: entitlements (server-authoritative), the paused-session
//    snapshot (device-specific), device permissions and transient nudge state.

const ENDPOINT = `${SUPABASE_URL}/rest/v1/progress_snapshots`;
const META_KEY = 'tm_sync_meta';
const BACKUP_KEY = 'tm_sync_backup';
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
  const id = `d_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
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

// Cheap, ORDER-INDEPENDENT content fingerprint — avoids pushing when nothing
// changed. Key order must not matter: the local snapshot is built in SYNC_KEYS
// order while the cloud copy comes back in whatever order the server serialised
// it, and an order-sensitive hash would make identical data look different and
// trigger a pointless restore.
function hashSnapshot(snap) {
  const s = Object.keys(snap).sort().map((k) => `${k}\u0000${snap[k]}`).join('\u0001');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
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

function applySnapshot(data) {
  if (!isBrowser || !data) return;
  // Back up what we're about to replace — never leave a restore unrecoverable.
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), snap: collectSnapshot() })); } catch { /* quota */ }
  for (const k of SYNC_KEYS) {
    const v = data[k];
    // Only write keys the cloud actually has; a key missing there must not wipe
    // local-only progress made before this device ever synced.
    if (typeof v === 'string') { try { localStorage.setItem(k, v); } catch { /* quota */ } }
  }
  // The snapshot may have been written by a device that has not taken the
  // arcade-id rename yet, so it can carry legacy campaign / series / stage ids.
  // Re-running the migration here is what stops a restore from resurrecting
  // them (and is why that migration is deliberately flag-free and idempotent).
  try { migrateArcadeIds(); } catch { /* never block a restore */ }
}

export function restoreLocalBackup() {
  if (!isBrowser) return false;
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null');
    if (!b?.snap) return false;
    for (const [k, v] of Object.entries(b.snap)) if (typeof v === 'string') localStorage.setItem(k, v);
    return true;
  } catch { return false; }
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

// ── network ──────────────────────────────────────────────────────────────────
async function authHeaders() {
  const token = await getAccessToken();
  if (!token) return null;
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function pullRow(headers) {
  const res = await fetch(`${ENDPOINT}?select=data,client_changed_at,updated_at,device_label&limit=1`, { headers });
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
  const res = await fetch(ENDPOINT, {
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

// ── the one entry point ──────────────────────────────────────────────────────
let running = false;

export async function syncNow({ reason = 'manual', keepalive = false } = {}) {
  if (!isBrowser || running) return state;
  const user = await getCurrentUser();
  if (!user) { setState({ status: 'idle', error: null }); return state; }
  if (navigator.onLine === false) { setState({ status: 'offline' }); return state; }

  running = true;
  setState({ status: 'syncing', error: null });
  try {
    const headers = await authHeaders();
    if (!headers) throw new Error('no token');

    const snap = collectSnapshot();
    const hash = hashSnapshot(snap);
    const meta = readMeta();
    // First run on this device: treat "now" as the change time so a device that
    // has been training offline doesn't look older than an untouched cloud row.
    const localChangedAt = meta.changedAt || Date.now();
    if (hash !== meta.lastHash) writeMeta({ changedAt: Date.now(), lastHash: hash });

    const row = await pullRow(headers);

    if (!row) {                                   // nothing in the cloud yet
      await pushRow(headers, user.id, snap, readMeta().changedAt || Date.now(), keepalive);
      writeMeta({ lastPushedHash: hash, lastPushedAt: Date.now() });
      setState({ status: 'synced', at: Date.now() });
      return state;
    }

    const cloudChangedAt = Date.parse(row.client_changed_at || row.updated_at || 0) || 0;
    const cloudSnap = row.data || {};
    const cloudIsNewer = cloudChangedAt > (readMeta().changedAt || localChangedAt) + 2000;
    const freshDevice = !hasRealProgress(snap) && hasRealProgress(cloudSnap);

    if (freshDevice || cloudIsNewer) {
      const sameContent = hashSnapshot(cloudSnap) === hash;
      if (!sameContent) {
        applySnapshot(cloudSnap);
        // Never store a zero/NaN clock — that would make this device look
        // infinitely stale and re-adopt the cloud copy on every future sync.
        writeMeta({ changedAt: cloudChangedAt || Date.now(), lastHash: hashSnapshot(collectSnapshot()), lastPulledAt: Date.now() });
        setState({ status: 'synced', at: Date.now(), restoredXp: xpOf(cloudSnap) });
        // Modules read localStorage at import time, so a one-shot reload is the
        // only way to guarantee every screen reflects a restore consistently.
        const already = sessionStorage.getItem(RESTORE_FLAG);
        if (!already && reason !== 'unload') {
          sessionStorage.setItem(RESTORE_FLAG, '1');
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('training-mode-stats-updated'));
          setTimeout(() => { try { window.location.reload(); } catch { /* noop */ } }, 400);
        }
        return state;
      }
    }

    // Local is authoritative (or identical) — back it up if it changed.
    if (hash !== meta.lastPushedHash) {
      await pushRow(headers, user.id, snap, readMeta().changedAt || Date.now(), keepalive);
      writeMeta({ lastPushedHash: hash, lastPushedAt: Date.now() });
    }
    setState({ status: 'synced', at: Date.now() });
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
