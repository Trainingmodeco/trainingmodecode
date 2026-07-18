import { loadStats } from './userStats';

// Progression nudges — anti-stagnation motivation, shown ON the relevant
// setup screen (strength → Workout Builder, cardio → Cardio Mode). When a
// lane has ~2 weeks of consistent work, encourage raising the bar. The
// cardio nudge is specific: it reads the last logged session's distance/time
// and proposes a concrete next target. Dismissing snoozes the lane 14 days.
const STORAGE_KEY = 'tm_progression_nudge';
const WINDOW_DAYS = 14;
const STRENGTH_MIN_SESSIONS = 5;
const CARDIO_MIN_SESSIONS = 4;

const STRENGTH_TYPES = new Set(['Fit Mode', 'Quick Mission']);
const CARDIO_TYPES = new Set(['Cardio']);

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

const fmtClock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

// Parse completedDistance defensively — sessions may store a number or
// an object like { value, unit }.
function parseDistance(d) {
  if (d == null) return null;
  if (typeof d === 'number' && d > 0) return { value: d, unit: 'km' };
  if (typeof d === 'object' && Number.isFinite(d.value) && d.value > 0) {
    return { value: d.value, unit: d.unit || 'km' };
  }
  const n = parseFloat(d);
  return Number.isFinite(n) && n > 0 ? { value: n, unit: 'km' } : null;
}

// Next distance target: +10%, rounded up to a friendly half-unit.
const nextDistance = (v) => Math.ceil((v * 1.1) * 2) / 2;

// Returns the nudge for a lane ('strength' | 'cardio') or null.
export function getProgressionNudge(lane) {
  const stats = loadStats();
  const sessions = stats?.sessions || [];
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const types = lane === 'strength' ? STRENGTH_TYPES : CARDIO_TYPES;
  const minSessions = lane === 'strength' ? STRENGTH_MIN_SESSIONS : CARDIO_MIN_SESSIONS;

  const recent = sessions.filter(s => {
    if (!types.has(s.type)) return false;
    const t = new Date(s.completedAt || s.date || 0).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });
  if (recent.length < minSessions) return null;

  // Snoozed within the window?
  const st = loadState();
  if (Date.now() - (st[lane] || 0) < WINDOW_DAYS * 24 * 60 * 60 * 1000) return null;

  if (lane === 'strength') {
    return {
      lane,
      emoji: '🏋️',
      title: 'TWO WEEKS STRONG',
      body: `${recent.length} strength sessions in the last two weeks — your body has adapted. Raise the bar today: add weight, an extra set, a couple of reps, or bump the difficulty.`,
      cta: 'ON IT',
    };
  }

  // Cardio — make it specific from the most recent logged session.
  const last = [...recent].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
  const dist = parseDistance(last?.completedDistance);
  const timeSec = last?.completedTimeSeconds || 0;
  let body;
  if (dist) {
    const target = nextDistance(dist.value);
    body = `${recent.length} cardio sessions in two weeks — time to push. Last run: ${dist.value} ${dist.unit}${timeSec ? ` in ${fmtClock(timeSec)}` : ''}. Today: go ${target} ${dist.unit}, or beat that time over the same distance.`;
  } else if (timeSec > 0) {
    const targetMin = Math.ceil((timeSec / 60) * 1.1);
    body = `${recent.length} cardio sessions in two weeks — time to push. Last session: ${fmtClock(timeSec)}. Today: push for ${targetMin} minutes, or hold a faster pace.`;
  } else {
    body = `${recent.length} cardio sessions in two weeks — your engine has adapted. Push the next one: more distance, or a tighter pace.`;
  }
  return { lane, emoji: '🏃', title: 'YOUR ENGINE IS BUILDING', body, cta: 'PUSH IT' };
}

// Dismissing (or acknowledging) a nudge snoozes that lane for the window.
export function snoozeProgressionNudge(lane) {
  const st = loadState();
  st[lane] = Date.now();
  saveState(st);
}
