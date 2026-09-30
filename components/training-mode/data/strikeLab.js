// Strike Lab access — a private diagnostics screen, not linked from anywhere
// in the app. It opens only from a URL carrying the owner's code
// (?lab=<code>); only the SHA-256 of the code lives in the bundle.
const LAB_HASH = 'd773b59228c77bf6abf57de6de4595b96f084e4b912899e04941b3de0b42812f';
const LOG_KEY = 'tm_strike_lab_log_v1';

async function sha256Hex(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Reads ?lab= from the URL, strips it, and resolves true when the code matches.
export async function consumeLabCode() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const code = params.get('lab');
  if (!code) return false;
  const strip = () => {
    const now = new URLSearchParams(window.location.search);
    if (!now.has('lab')) return;
    now.delete('lab');
    const qs = now.toString();
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  };
  // The router writes its own URL back once it settles, so strip the code
  // again after that — it must not linger in the address bar or history.
  strip();
  [300, 1200, 3000].forEach(ms => setTimeout(strip, ms));
  return (await sha256Hex(code.trim())) === LAB_HASH;
}

export function loadLabLog() {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}
export function saveLabLog(rows) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(rows.slice(-60))); } catch { /* quota */ }
}
