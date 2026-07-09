import { addCardioSession } from './userStats';

const STORAGE_KEY = 'tm_cardio_sessions';
const MAX_STORED = 200;

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Reusable cardio session shape shared by Training Arcade, Fit Mode, Daily Quest,
// and any future cardio feature. Callers pass whatever they know; the rest is
// filled with safe defaults so the object is always complete.
export function createCardioSession({
  sourceMode = 'fit',
  placement = 'standalone',
  cardioType = 'custom-cardio',
  methodLabel = 'Cardio',
  targetType = 'time',
  targetTimeSeconds = null,
  targetDistance = null,
  distanceUnit = null,
  style = null,
  intervals = null,
  completedTimeSeconds = null,
  completedDistance = null,
  calories = null,
  notes = '',
  completed = true,
} = {}) {
  return {
    id: makeId(),
    sourceMode,
    placement,
    cardioType,
    methodLabel,
    targetType,
    targetTimeSeconds,
    targetDistance,
    distanceUnit,
    style,
    intervals,
    completedTimeSeconds,
    completedDistance,
    calories,
    notes,
    completed,
    completedAt: new Date().toISOString(),
  };
}

export function loadCardioSessions() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(sessions) {
  try {
    if (typeof localStorage === 'undefined') return;
    const trimmed = sessions.length > MAX_STORED
      ? sessions.slice(sessions.length - MAX_STORED)
      : sessions;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('training-mode-cardio-updated'));
    }
  } catch {}
}

// Saves the detailed cardio log. When awardXp is true it also records a Cardio
// session in the shared user-stats store (XP, streaks, history). Training Arcade
// passes awardXp:false because stage rewards already handle XP there. Returns the
// saved session plus the XP awarded (0 when awardXp is false) so callers can show
// the exact amount without recomputing it.
export function logCardioSession(session, { awardXp = true } = {}) {
  const sessions = loadCardioSessions();
  sessions.push(session);
  persist(sessions);
  const xpEarned = awardXp ? addCardioSession(session) : 0;
  return { session, xpEarned };
}
