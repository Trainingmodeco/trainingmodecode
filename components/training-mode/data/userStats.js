const STORAGE_KEY = 'tm_user_stats';

export const WEEKLY_GOAL = 5;

const XP_PER_FIT_EXERCISE = 15;
const XP_FIT_FULL_BONUS = 30;
const XP_PER_FIGHT_ROUND = 20;
const XP_PER_COMBO_ROUND = 20;
const XP_SESSION_BONUS = 50;
const XP_PER_LEVEL = 500;

function getDefaultStats() {
  return {
    xp: 0,
    sessions: [],
  };
}

// Cache the parsed stats so repeated loadStats() calls (many per render across
// screens) don't re-read + JSON.parse localStorage every time. The cache is
// invalidated on save and on cross-tab storage events, so the next load returns
// a fresh object — keeping event-driven React refreshes reactive.
let _statsCache = null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (!e.key || e.key === STORAGE_KEY) _statsCache = null; });
}

export function loadStats() {
  if (_statsCache) return _statsCache;
  try {
    if (typeof localStorage === 'undefined') return getDefaultStats();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { _statsCache = getDefaultStats(); return _statsCache; }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sessions)) { _statsCache = getDefaultStats(); return _statsCache; }
    _statsCache = parsed;
    return _statsCache;
  } catch {
    return getDefaultStats();
  }
}

function saveStats(stats) {
  _statsCache = null; // invalidate → next loadStats re-parses a fresh object
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('training-mode-stats-updated'));
  }
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function addFightFocusSession(roundsCompleted, totalRounds) {
  const stats = loadStats();
  const xpEarned = (roundsCompleted * XP_PER_FIGHT_ROUND) +
    (roundsCompleted === totalRounds ? XP_SESSION_BONUS : 0);
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Fight Focus',
    completedAt: new Date().toISOString(),
    completedCount: roundsCompleted,
    totalCount: totalRounds,
    xpEarned,
  });
  saveStats(stats);
  return xpEarned;
}

export function addComboCoachSession(roundsCompleted, totalRounds) {
  const stats = loadStats();
  const xpEarned = (roundsCompleted * XP_PER_COMBO_ROUND) +
    (roundsCompleted === totalRounds ? XP_SESSION_BONUS : 0);
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Combo Coach',
    completedAt: new Date().toISOString(),
    completedCount: roundsCompleted,
    totalCount: totalRounds,
    xpEarned,
  });
  saveStats(stats);
  return xpEarned;
}

export function addFitModeSession(exercisesCompleted, totalExercises, difficulty) {
  const stats = loadStats();
  const full = exercisesCompleted === totalExercises && totalExercises > 0;
  const xpEarned = (exercisesCompleted * XP_PER_FIT_EXERCISE) +
    (full ? XP_FIT_FULL_BONUS : 0);
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Fit Mode',
    completedAt: new Date().toISOString(),
    difficulty: difficulty || null,
    completedCount: exercisesCompleted,
    totalCount: totalExercises,
    xpEarned,
  });
  saveStats(stats);
  return xpEarned;
}

export function addQuickMissionSession(exercisesCompleted, totalExercises, completed) {
  const stats = loadStats();
  const xpEarned = (exercisesCompleted * XP_PER_FIT_EXERCISE) +
    (completed ? XP_FIT_FULL_BONUS : 0);
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Quick Mission',
    completedAt: new Date().toISOString(),
    completedCount: exercisesCompleted,
    totalCount: totalExercises,
    xpEarned,
  });
  saveStats(stats);
  return xpEarned;
}

export function addCombatConditioningSession(drillsCompleted, totalDrills, roundsCompleted, totalRounds, completed) {
  const stats = loadStats();
  const xpEarned = (drillsCompleted * XP_PER_FIT_EXERCISE) +
    (completed ? XP_FIT_FULL_BONUS : 0);
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Combat Conditioning',
    completedAt: new Date().toISOString(),
    completedCount: drillsCompleted,
    totalCount: totalDrills,
    roundsCompleted,
    totalRounds,
    xpEarned,
  });
  saveStats(stats);
  return xpEarned;
}

const XP_START_HERE_LESSON = 20;
const XP_DAILY_MISSION_BONUS = 25;

export function addStartHereLesson(lessonTitle) {
  const stats = loadStats();
  stats.xp += XP_START_HERE_LESSON;
  stats.sessions.push({
    id: makeId(),
    type: 'Start Here',
    completedAt: new Date().toISOString(),
    completedCount: 1,
    totalCount: 1,
    xpEarned: XP_START_HERE_LESSON,
    lessonTitle,
  });
  saveStats(stats);
  return XP_START_HERE_LESSON;
}

export function addDailyMissionBonus() {
  const stats = loadStats();
  stats.xp += XP_DAILY_MISSION_BONUS;
  stats.sessions.push({
    id: makeId(),
    type: 'Mission of the Day',
    completedAt: new Date().toISOString(),
    completedCount: 1,
    totalCount: 1,
    xpEarned: XP_DAILY_MISSION_BONUS,
  });
  saveStats(stats);
  return XP_DAILY_MISSION_BONUS;
}

const XP_CARDIO_BASE = 20;
const XP_CARDIO_PER_MINUTE = 5;

export function addCardioSession(session) {
  const stats = loadStats();
  const minutes = session?.completedTimeSeconds
    ? Math.round(session.completedTimeSeconds / 60)
    : 0;
  const xpEarned = XP_CARDIO_BASE + minutes * XP_CARDIO_PER_MINUTE;
  stats.xp += xpEarned;
  stats.sessions.push({
    id: makeId(),
    type: 'Cardio',
    completedAt: session?.completedAt || new Date().toISOString(),
    completedCount: 1,
    totalCount: 1,
    xpEarned,
    method: session?.methodLabel || 'Cardio',
    cardioType: session?.cardioType || null,
    completedTimeSeconds: session?.completedTimeSeconds || 0,
    completedDistance: session?.completedDistance || null,
  });
  saveStats(stats);
  return xpEarned;
}

const XP_HYBRID_BONUS = 40;

// Awarded once per session when the main workout AND its cardio finisher are
// both completed. Callers gate on their own per-session flag so a refresh or
// reopen cannot double-award.
export function addHybridTrainingBonus() {
  const stats = loadStats();
  stats.xp += XP_HYBRID_BONUS;
  stats.sessions.push({
    id: makeId(),
    type: 'Hybrid Training Bonus',
    completedAt: new Date().toISOString(),
    completedCount: 1,
    totalCount: 1,
    xpEarned: XP_HYBRID_BONUS,
  });
  saveStats(stats);
  return XP_HYBRID_BONUS;
}

export function getLevel(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function getLevelProgress(xp) {
  const currentLevelXp = xp % XP_PER_LEVEL;
  return { current: currentLevelXp, needed: XP_PER_LEVEL };
}

function startOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - diff);
  return monday;
}

export function getWeeklySessions(stats) {
  const weekStart = startOfWeek();
  return stats.sessions.filter(s => new Date(s.completedAt) >= weekStart);
}

export function getStreak(stats) {
  if (stats.sessions.length === 0) return 0;

  const daySet = new Set();
  for (const s of stats.sessions) {
    const d = new Date(s.completedAt);
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  let streak = 0;
  const check = new Date(today);

  if (!daySet.has(todayKey)) {
    check.setDate(check.getDate() - 1);
    const yKey = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (!daySet.has(yKey)) return 0;
  }

  while (true) {
    const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`;
    if (daySet.has(key)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getFavoriteMode(stats) {
  if (stats.sessions.length === 0) return 'None';
  const counts = {};
  for (const s of stats.sessions) {
    counts[s.type] = (counts[s.type] || 0) + 1;
  }
  let max = 0;
  let fav = 'None';
  for (const [type, count] of Object.entries(counts)) {
    if (count > max) { max = count; fav = type; }
  }
  return fav;
}

export function getWeekDayCompletion(stats) {
  const weekStart = startOfWeek();
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const todayIdx = ((today.getDay() + 6) % 7);

  const completedDays = new Set();
  for (const s of stats.sessions) {
    const d = new Date(s.completedAt);
    if (d >= weekStart) {
      const idx = ((d.getDay() + 6) % 7);
      completedDays.add(idx);
    }
  }

  return days.map((day, i) => ({
    day,
    state: i === todayIdx && completedDays.has(i) ? 'today_done'
      : i === todayIdx ? 'pending'
      : completedDays.has(i) ? 'done'
      : 'inactive',
  }));
}
