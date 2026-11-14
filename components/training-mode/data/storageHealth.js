// Whether this phone keeps what the app saves, and what the athlete is told when it does not.
//
// Everything the app remembers (the profile, XP, history, the "onboarding done" flag) lives in the
// browser's localStorage. Some places do not keep it: a private tab, an in-app browser (Instagram,
// TikTok, Facebook), a browser that was set to clear site data, or a different browser than the one
// the athlete first used. There the app looked fine during a visit and started from scratch on the
// next one, and said nothing. This module is what notices, once per visit, and what keeps a failed
// write from taking the screen down with it.
//
// Plausible gets two events (data/analytics.js):
//   storage_check        once per open: { ok: yes|no, inapp: instagram|facebook|tiktok|snapchat|line|linkedin|none,
//                        standalone: yes|no, returning: onboarded|cookie_only|new }
//                        returning = cookie_only means a long-lived cookie says this person finished
//                        onboarding, but localStorage lost the flag: their phone threw the data away.
//   storage_write_failed once per key per open: { key }
import { trackEvent, reportError } from './analytics';

const PROBE_KEY = '__tm_probe__';
const SEEN_COOKIE = 'tm_seen';
const DISMISS_KEY = 'tm_storage_notice_dismissed';

let state = { writeFailed: false, failedKeys: [], failures: 0, probeOk: null, inapp: null, standalone: false, returning: 'new' };
// Notices the athlete dismissed this visit (kept in memory, so GOT IT works even when storage refuses writes).
const dismissedKinds = new Set();
let hardDismissedAt = -1;
const listeners = new Set();
const reportedKeys = new Set();
let checked = false;

export function getStorageHealth() { return state; }
export function subscribeStorageHealth(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function set(patch) { state = { ...state, ...patch }; listeners.forEach((fn) => { try { fn(state); } catch { /* a listener must not break a save */ } }); }

/** window.localStorage, or null. With site data blocked the getter itself throws (even under typeof). */
export function safeStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** A save failed (quota full, storage blocked): remember it, tell the dashboard once, never throw. */
export function noteWriteFailure(key, err) {
  const short = String(key || 'unknown').slice(0, 60);
  if (!reportedKeys.has(short)) {
    reportedKeys.add(short);
    trackEvent('storage_write_failed', { key: short });
    reportError(err || new Error('storage write failed'), 'storage');
  }
  // Every failed save counts, so a dismissed "cannot save" notice comes back when another save fails.
  set({ writeFailed: true, failures: state.failures + 1, failedKeys: state.failedKeys.includes(short) ? state.failedKeys : [...state.failedKeys, short] });
}

/** localStorage.setItem that cannot throw. Returns whether it was saved. */
export function safeSetItem(key, value) {
  const s = safeStorage();
  if (!s) { noteWriteFailure(key, new Error('storage unavailable')); return false; }
  try { s.setItem(key, value); return true; } catch (e) { noteWriteFailure(key, e); return false; }
}

export function detectInAppBrowser(ua) {
  const u = String(ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '') ?? '');
  if (/Instagram/i.test(u)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(u)) return 'facebook';
  if (/TikTok|musical_ly|BytedanceWebview/i.test(u)) return 'tiktok';
  if (/Snapchat/i.test(u)) return 'snapchat';
  if (/\bLine\//i.test(u)) return 'line';
  if (/LinkedInApp/i.test(u)) return 'linkedin';
  return null;
}

function isStandalone() {
  try {
    return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  } catch { return false; }
}

function hasSeenCookie() {
  try { return typeof document !== 'undefined' && new RegExp(`(?:^|;\\s*)${SEEN_COOKIE}=1`).test(document.cookie || ''); } catch { return false; }
}

/** Write, read back and remove a test key: the one honest way to know a save will stick this visit. */
export function probeStorage() {
  const s = safeStorage();
  if (!s) return false;
  try {
    s.setItem(PROBE_KEY, '1');
    const ok = s.getItem(PROBE_KEY) === '1';
    s.removeItem(PROBE_KEY);
    return ok;
  } catch { return false; }
}

/** Once per open, at boot. `onboardingDone` is the app's own flag. */
export function runStorageCheck({ onboardingDone } = {}) {
  if (checked) return state;
  checked = true;
  const probeOk = probeStorage();
  const inapp = detectInAppBrowser();
  const standalone = isStandalone();
  const returning = onboardingDone ? 'onboarded' : hasSeenCookie() ? 'cookie_only' : 'new';
  // An athlete who set up before this existed (or restored from an account) has no cookie yet: give
  // them one now, so a later wipe reads as "wiped", not "new".
  if (onboardingDone) markOnboarded();
  set({ probeOk, inapp, standalone, returning });
  trackEvent('storage_check', { ok: probeOk ? 'yes' : 'no', inapp: inapp || 'none', standalone: standalone ? 'yes' : 'no', returning });
  return state;
}

/** When onboarding finishes: a cookie that outlives a wiped localStorage, and a request to keep the data. */
export function markOnboarded() {
  try { if (typeof document !== 'undefined') document.cookie = `${SEEN_COOKIE}=1; max-age=31536000; path=/; SameSite=Lax`; } catch { /* best effort */ }
  try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch { /* best effort */ }
}

/** What the banner says, or null. Most serious first. */
export function storageNotice(s = state) {
  if (s.writeFailed || s.probeOk === false) {
    return { kind: 'cannot-save', text: "Your phone isn't letting Training Mode save, so your progress can be lost when you close it. If you're in a private tab or another app's browser, open Training Mode in Safari or Chrome." };
  }
  if (s.returning === 'cookie_only') {
    return { kind: 'wiped', text: "Your phone cleared Training Mode's saved progress, so this is a fresh start. If you have a Training Mode account, sign in from Profile to get it back. Adding the app to your Home Screen helps it keep your data." };
  }
  if (s.inapp) {
    const name = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', snapchat: 'Snapchat', line: 'Line', linkedin: 'LinkedIn' }[s.inapp] || 'another app';
    return { kind: 'inapp', text: `You opened Training Mode inside ${name}. That browser can forget your setup and progress. Tap its menu, choose Open in Safari or Open in browser, then add Training Mode to your Home Screen.` };
  }
  return null;
}

// A failure to save can be dismissed, but it comes back with the next failed save; the other two stay
// dismissed (in memory, and in storage when it works, so they do not nag on every visit).
export function noticeDismissed(kind) {
  if (kind === 'cannot-save') return hardDismissedAt === state.failures;
  if (dismissedKinds.has(kind)) return true;
  try { const s = safeStorage(); return !!s && s.getItem(DISMISS_KEY) === kind; } catch { return false; }
}
export function dismissNotice(kind) {
  if (kind === 'cannot-save') { hardDismissedAt = state.failures; return; }
  dismissedKinds.add(kind);
  try { const s = safeStorage(); if (s) s.setItem(DISMISS_KEY, kind); } catch { /* in memory only: it comes back next visit */ }
}

/** Tests only. */
export function _resetStorageHealth() { state = { writeFailed: false, failedKeys: [], failures: 0, probeOk: null, inapp: null, standalone: false, returning: 'new' }; reportedKeys.clear(); dismissedKinds.clear(); hardDismissedAt = -1; checked = false; }
