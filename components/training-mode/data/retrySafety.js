// Near-miss retry (retention feature 3): when a one-tap RETRY is safe to offer.
// Pure. The app saves no recovery data (the camp's readiness check is never
// stored, session rows carry no load), so until the owner approves another
// rule this is it (docs/retention/BUILD-NOTES.md):
//   - never after a boss, a saga's final stage, the title fight or MAX OUT;
//   - never after 2 attempts at the same stage or session today;
//   - never after 3 finished sessions today.
// Otherwise the screen says when to come back instead: tomorrow.
import { isTrainingRow, localIso } from './weekStreak';

export const RETRY_MAX_ATTEMPTS = 2;
export const RETRY_MAX_SESSIONS = 3;

const COME_BACK = 'Come back fresh tomorrow.';
const LINES = {
  boss: `That was a boss fight. ${COME_BACK}`,
  final: `That was the saga's final stage. ${COME_BACK}`,
  title: `That was the title fight. ${COME_BACK}`,
  max: `That was a max effort. ${COME_BACK}`,
  attempts: `Two goes at this one today. ${COME_BACK}`,
  load: `Three sessions done today. ${COME_BACK}`,
};

// boss: false, or what the stage was: true / 'boss', 'final' (the saga's last
//   stage), 'title' (the camp's title fight).
// attemptsToday: tries at this stage or session today, this one included.
// sessionsToday: finished sessions today, this one included.
// → { allowed, reason: null | 'boss'|'final'|'title'|'max'|'attempts'|'load', line }
export function canRetryNow({ boss = false, maxEffort = false, attemptsToday = 1, sessionsToday = 1 } = {}) {
  const no = (reason) => ({ allowed: false, reason, line: LINES[reason] });
  if (boss) return no(boss === 'final' || boss === 'title' ? boss : 'boss');
  if (maxEffort) return no('max');
  if ((Number(attemptsToday) || 0) >= RETRY_MAX_ATTEMPTS) return no('attempts');
  if ((Number(sessionsToday) || 0) >= RETRY_MAX_SESSIONS) return no('load');
  return { allowed: true, reason: null, line: null };
}

// Finished sessions on the local day of `now`: the week streak's training
// rows (no award rows, no sessions with no work done, none the integrity
// check refused).
export function sessionsOn(rows, now = Date.now()) {
  const today = localIso(now);
  let n = 0;
  for (const s of Array.isArray(rows) ? rows : []) if (isTrainingRow(s) && localIso(s.completedAt) === today) n++;
  return n;
}

// Whether an end counts as a try at its stage or session: only a finished,
// valid session does, like the sessions above. A session the integrity check
// refused (validation_failed) or one ended with nothing done (0 of its count)
// moves nothing, so the next honest go is still the first.
//   facts: the end screen's { outcome, unit, done } (data/nearMissStore)
const COUNT_UNITS = new Set(['rounds', 'exercises', 'drills', 'tasks', 'sets']);
export function countsAsTry({ outcome, unit, done } = {}) {
  if (outcome === 'validation_failed') return false;
  if (COUNT_UNITS.has(unit) && done != null && !(Number(done) > 0)) return false;
  return true;
}

// The attempts log ({ day, tries: { [key]: n } }): tries at `key` on the
// local day of `now` (a log from another day counts nothing).
export function triesOn(log, key, now = Date.now()) {
  if (!log || log.day !== localIso(now) || !key) return 0;
  const n = Number(log.tries?.[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// The log with one more try at `key` today (another day's entries dropped).
export function withTry(log, key, now = Date.now()) {
  const day = localIso(now);
  const tries = log && log.day === day && log.tries && typeof log.tries === 'object' ? { ...log.tries } : {};
  if (key) tries[key] = triesOn({ day, tries }, key, now) + 1;
  return { day, tries };
}

// "The same stage or session": a key from what the session is.
const part = (v) => String(v ?? '').trim().toLowerCase().replace(/\|/g, '/');
export const retryKey = (kind, ...parts) => [kind, ...parts.map(part)].join('|');

// Fight Focus / Just Train / a concept stage (its timer cfg), Combo Coach.
export function timerRetryKey(cfg = {}, disc = '') {
  if (cfg.conceptId) return retryKey('concept', cfg.conceptId, cfg.conceptArc, cfg.conceptStage);
  const kind = cfg.mode === 'Combo Coach' ? 'combo' : cfg.mode === 'Just Train' ? 'justtrain' : 'fight';
  return retryKey(kind, disc, cfg.rounds, cfg.roundMin, cfg.difficulty);
}
export const arcadeRetryKey = (seriesId, stageId) => retryKey('arcade', seriesId, stageId);
export const campRetryKey = (discipline, level, slot) => retryKey('camp', discipline, level, slot || 's1');
// A generated mission's id is the same for every deal ('generated'): its title tells them apart.
export function quickMissionRetryKey(mission = {}, cfg = {}) {
  const id = mission.id && mission.id !== 'generated' ? mission.id : mission.title;
  return retryKey('qm', cfg.missionId || id, mission.difficulty || cfg.difficulty, mission.rounds);
}
export const combatRetryKey = (mission = {}) => retryKey('cc', mission.missionName, mission.style, mission.difficulty);
export function fitRetryKey(cfg = {}) {
  if (cfg.programId) return retryKey('fit', 'program', cfg.programId, cfg.programDayIndex);
  return retryKey('fit', (cfg.muscleGroups || []).join('+'), cfg.equipment, cfg.difficulty);
}
