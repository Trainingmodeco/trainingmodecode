// Fight Mode lifetime stats (design 1.5). Separate from userStats (which tracks
// XP / sessions across ALL modes) because these totals are Fight-Mode-specific
// and feed future trophies and ghost battles.
//
// NOTE on "strikes": today this is the number of strikes the coach CALLED and
// you shadowboxed in Combo Coach — a real, honest count. When 1.4 (the
// accelerometer strike counter) lands, motion-verified thrown strikes replace
// it and the label becomes "STRIKES THROWN".
const STORAGE_KEY = 'tm_fight_stats';

function getDefault() {
  return { rounds: 0, strikes: 0, bestStreak: 0, sessions: 0 };
}

export function loadFightStats() {
  try {
    if (typeof localStorage === 'undefined') return getDefault();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefault();
    const parsed = JSON.parse(raw);
    return { ...getDefault(), ...(parsed || {}) };
  } catch {
    return getDefault();
  }
}

function save(stats) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch { /* quota */ }
}

// Record a finished Fight-Mode session. All fields optional and defaulted, so a
// Fight Focus session (rounds only, no combo strikes/streak) is fine.
// Returns the updated lifetime totals.
export function recordFightSession({ rounds = 0, strikes = 0, peakStreak = 0 } = {}) {
  const stats = loadFightStats();
  stats.rounds += Math.max(0, Math.round(rounds));
  stats.strikes += Math.max(0, Math.round(strikes));
  stats.bestStreak = Math.max(stats.bestStreak, Math.max(0, Math.round(peakStreak)));
  stats.sessions += 1;
  save(stats);
  return stats;
}
