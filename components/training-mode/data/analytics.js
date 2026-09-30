export function trackEvent(name, props) {
  if (typeof window === 'undefined') return;
  if (typeof window.plausible === 'function') {
    window.plausible(name, props ? { props } : undefined);
  }
}

// Paired with the existing session_complete events, so the dashboard shows
// which modes people start and where they drop off.
export function trackSessionStart(mode, props) {
  trackEvent('session_start', { mode, ...(props || {}) });
}

export function trackPageView() {
  trackEvent('pageview');
}

// ── Crash reporting ─────────────────────────────────────────────────────────
// Errors go to the same Plausible dashboard as everything else, as an
// "App Error" event with the message, the screen it happened on and where it
// was caught — no extra service, no account, no user data. Without this the
// only way to learn about a crash was a user telling us.
//
// To see them: Plausible → Site settings → Goals → add custom event
// "App Error", and add the custom properties message / screen / source.
//
// Guard rails: the same message is reported once per session, at most
// MAX_REPORTS per session, and messages are cut to 150 characters with URLs
// stripped (they can carry query strings).
const MAX_REPORTS = 8;
const reported = new Set();
let currentScreen = 'boot';

/** App.jsx keeps this current so a report says where the athlete was. */
export function setErrorScreen(screen) {
  if (screen) currentScreen = String(screen);
}

export function reportError(error, source = 'unknown') {
  try {
    const raw = (error && (error.message || error.reason?.message || error.reason)) || String(error || '');
    const message = String(raw).replace(/https?:\/\/\S+/g, '<url>').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Unknown error';
    const key = `${source}|${message}`;
    if (reported.has(key) || reported.size >= MAX_REPORTS) return;
    reported.add(key);
    trackEvent('App Error', { message, screen: currentScreen, source });
  } catch { /* reporting must never throw */ }
}

let installed = false;
/** Catch what React's error boundary cannot: async code, timers, promises. */
export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (e) => {
    // A failed <img>/<script> load fires 'error' without an Error object;
    // images already have fallbacks (SafeImage), so only real script errors count.
    if (!e?.error && !e?.message) return;
    reportError(e.error || e.message, 'window');
  });
  window.addEventListener('unhandledrejection', (e) => reportError(e?.reason, 'promise'));
}
