import { loadStats } from './userStats';

// Progression nudges — anti-stagnation motivation. When someone has trained
// a lane consistently for ~2 weeks, encourage them to raise the bar:
// strength → add weight/reps; cardio → add distance or pace. A nudge shows
// at most once per lane per 14 days, and dismissing snoozes it for 14 days.
const STORAGE_KEY = 'tm_progression_nudge';
const WINDOW_DAYS = 14;
const STRENGTH_MIN_SESSIONS = 5;
const CARDIO_MIN_SESSIONS = 4;

const STRENGTH_TYPES = new Set(['Fit Mode', 'Quick Mission']);
const CARDIO_TYPES = new Set(['Cardio']);

const NUDGES = {
  strength: {
    emoji: '🏋️',
    title: 'TWO WEEKS STRONG',
    body: 'You have been putting in consistent strength work. Time to raise the bar — add weight, an extra set, or a couple of reps so the gains keep coming.',
    cta: 'RAISE THE BAR',
  },
  cardio: {
    emoji: '🏃',
    title: 'YOUR ENGINE IS BUILDING',
    body: 'Two weeks of steady cardio — your body has adapted. Push the next run further or faster: add distance, or tighten your pace.',
    cta: 'PUSH THE PACE',
  },
};

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}

function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

// Returns { lane: 'strength'|'cardio', ...NUDGES[lane] } or null.
export function getProgressionNudge() {
  const stats = loadStats();
  const sessions = stats?.sessions || [];
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = sessions.filter(s => {
    const t = new Date(s.completedAt || s.date || 0).getTime();
    return Number.isFinite(t) && t >= cutoff;
  });

  const strength = recent.filter(s => STRENGTH_TYPES.has(s.type)).length;
  const cardio = recent.filter(s => CARDIO_TYPES.has(s.type)).length;

  // Dominant qualifying lane wins; both qualifying → the busier one.
  let lane = null;
  const strengthOk = strength >= STRENGTH_MIN_SESSIONS;
  const cardioOk = cardio >= CARDIO_MIN_SESSIONS;
  if (strengthOk && cardioOk) lane = strength >= cardio ? 'strength' : 'cardio';
  else if (strengthOk) lane = 'strength';
  else if (cardioOk) lane = 'cardio';
  if (!lane) return null;

  // Snoozed within the window?
  const st = loadState();
  const last = st[lane] || 0;
  if (Date.now() - last < WINDOW_DAYS * 24 * 60 * 60 * 1000) return null;

  return { lane, ...NUDGES[lane] };
}

// Dismissing (or acting on) a nudge snoozes that lane for the window.
export function snoozeProgressionNudge(lane) {
  const st = loadState();
  st[lane] = Date.now();
  saveState(st);
}
