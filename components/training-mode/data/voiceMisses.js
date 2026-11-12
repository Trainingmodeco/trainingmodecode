// Lines the coach could not say fully from the recorded voice, kept on this
// device so the VOICE CHECK can show them and the missing phrases can be
// recorded. Before this a lost line left no trace: the owner found them only
// by ear. Nothing here leaves the phone.
//
// Stored under tm_voice_misses: the last MAX_MISSES distinct lines, newest
// first, each { line, at, reason }. reason:
//   'no-clip'  some phrase has no clip (the speech engine got the line, or
//              nothing could say it)
//   'partial'  the engine could not speak, so only the phrases with clips played
//   'dropped'  a newer queued line took its place before it was said
//   'late'     the clips were not ready in time (bank still loading, a slow or
//              failed clip, audio not running), so the engine got the line
// `count` is the number of such lines since the app opened.

export const VOICE_MISSES_KEY = 'tm_voice_misses';
export const MAX_MISSES = 30;
export const MISS_REASONS = ['no-clip', 'partial', 'dropped', 'late'];

let list = null;   // read from storage once
let count = 0;

function load() {
  if (list) return list;
  list = [];
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(VOICE_MISSES_KEY);
    const a = raw ? JSON.parse(raw) : [];
    if (Array.isArray(a)) {
      list = a.filter((m) => m && typeof m.line === 'string' && m.line && MISS_REASONS.includes(m.reason))
        .map((m) => ({ line: m.line, at: Number(m.at) || 0, reason: m.reason }))
        .slice(0, MAX_MISSES);
    }
  } catch { list = []; }
  return list;
}

function save() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(VOICE_MISSES_KEY, JSON.stringify(list)); } catch { /* storage full or off: the list still lives for this visit */ }
}

// Record one line. A line already in the list moves to the front.
export function noteVoiceMiss(line, reason, at = Date.now()) {
  const text = String(line || '').trim().slice(0, 200);
  if (!text || !MISS_REASONS.includes(reason)) return;
  count += 1;
  const l = load().filter((m) => m.line !== text);
  l.unshift({ line: text, at, reason });
  list = l.slice(0, MAX_MISSES);
  save();
}

export function getVoiceMisses() {
  return { count, list: load().slice() };
}

export function clearVoiceMisses() {
  count = 0;
  list = [];
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(VOICE_MISSES_KEY); } catch { /* ignore */ }
}
