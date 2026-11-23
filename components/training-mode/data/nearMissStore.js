// Near-miss retry (retention feature 3, switch `nearMiss`): the app side. Reads
// the session rows (finished sessions today) and keeps one small log of today's
// tries per stage or session (tm_retry_log_v1: { day, tries: { [key]: n } },
// yesterday's dropped on the next write). Written only with the switch on, by
// an end screen when it opens, and only for a finished, valid session (a
// refused one or one with nothing done is no try). The gap and the rule are pure
// (data/nearMiss.js, data/retrySafety.js).
import { loadStats } from './userStats';
import { safeSetItem, safeStorage } from './storageHealth';
import { nearMiss, showsNearMiss } from './nearMiss';
import { canRetryNow, countsAsTry, sessionsOn, triesOn, withTry, arcadeRetryKey } from './retrySafety';
import { arcadeOverlayOutcome } from './arcadeOutcome';
import { stageStarRule, stageStars } from './pathStars';
import { getSeriesProgress } from './arcadeProgress';
import { isFinalBoss } from '../protocol/campaigns';
import { entryFor, arcStages } from './concepts';

export const RETRY_LOG_KEY = 'tm_retry_log_v1';

export function loadRetryLog() {
  try {
    const p = JSON.parse(safeStorage()?.getItem(RETRY_LOG_KEY) || 'null');
    if (p && typeof p === 'object' && typeof p.day === 'string' && p.tries && typeof p.tries === 'object') return { day: p.day, tries: p.tries };
  } catch { /* unreadable: no tries logged */ }
  return { day: null, tries: {} };
}

// An end screen counts its own session once (the result object it shows, kept
// for this run of the app), however often it renders.
const counted = new WeakSet();
const isCounted = (token) => !!token && typeof token === 'object' && counted.has(token);

// Everything an end screen needs, worked out once when it opens.
//   facts: { key, token, boss, maxEffort, ...the nearMiss() input (unit, done,
//            total, outcome | timeSec, tiers, stars) }
// → { key, token, counts, miss, show, gate: canRetryNow() + { attemptsToday, sessionsToday } }
// counts: whether this end is a try at all (retrySafety countsAsTry: not a
// refused session, not one with nothing done); one that is not adds nothing
// to today's tries, here or in noteAttempt.
export function settleNearMiss(facts, now = Date.now()) {
  if (!facts?.key) return null;
  const miss = nearMiss(facts);
  const counts = countsAsTry(facts);
  const attemptsToday = triesOn(loadRetryLog(), facts.key, now) + (counts && !isCounted(facts.token) ? 1 : 0);
  const sessionsToday = Math.max(1, sessionsOn(loadStats().sessions, now));
  const gate = { ...canRetryNow({ boss: facts.boss, maxEffort: facts.maxEffort, attemptsToday, sessionsToday }), attemptsToday, sessionsToday };
  return { key: facts.key, token: facts.token, counts, miss, show: showsNearMiss(miss, facts.outcome), gate };
}

// The end screen's session, logged as one try at its key today (once). A
// refused session or one with nothing done is not a try: nothing is written.
export function noteAttempt(settled, now = Date.now()) {
  if (!settled?.key || settled.counts === false) return;
  const { token } = settled;
  if (token && typeof token === 'object') {
    if (counted.has(token)) return;
    counted.add(token);
  }
  safeSetItem(RETRY_LOG_KEY, JSON.stringify(withTry(loadRetryLog(), settled.key, now)));
}

// The classic saga's end (ArcadeSessionPlayer → ArcadeStageClearOverlay): a
// partial or failed stage by its tasks (the benchmark: exercises tested), a
// clear by its time against the next star above what the stage holds now
// (stored after this clear). A benchmark that ranked shows its rank, not
// stars: nothing to chase there. The retry label names the star.
const ORDINAL = { 1: 'FIRST', 2: 'SECOND', 3: 'THIRD' };
export function classicNearMiss(series, stage, result, now = Date.now()) {
  if (!series?.id || !stage?.id || !result || typeof result !== 'object') return null;
  const { screen } = arcadeOverlayOutcome(result);
  // The overlay's screen as a verdict: a refused run (invalid) is no try.
  const outcome = { invalid: 'validation_failed', failed: 'fail', partial: 'partial' }[screen] || 'pass';
  const base = { key: arcadeRetryKey(series.id, stage.id), token: result, boss: classicStageBoss(series, stage), outcome };
  if (screen === 'partial' || screen === 'failed') {
    return settleNearMiss({ ...base, unit: stage.stageType === 'benchmark' ? 'exercises' : 'tasks', done: result.completedTasks, total: result.totalTasks }, now);
  }
  if (screen === 'cleared' && !result.rank) {
    const rule = stageStarRule(series, stage);
    if (rule.kind === 'time') {
      const held = stageStars(series, stage, getSeriesProgress(series.id)?.completedStages?.[stage.id]);
      const out = settleNearMiss({ ...base, unit: 'time', timeSec: result.elapsedSeconds, tiers: rule.tiers, stars: held.stars || 0 }, now);
      return out?.miss ? { ...out, retryLabel: `GO FOR THE ${ORDINAL[out.miss.nextStars] || 'NEXT'} STAR` } : out;
    }
  }
  return settleNearMiss(base, now);
}

// ── what a stage was (no retry after a boss or a saga's final stage) ──────
// A v2 campaign stage: its boss flag, else the saga's last stage.
export function arcadeStageBoss(campaignId, stageId, series) {
  try { if (campaignId && isFinalBoss(campaignId, stageId)) return 'boss'; } catch { /* unknown campaign */ }
  return classicStageBoss(series, (series?.stages || []).find((s) => s.id === stageId));
}
// A classic stage (or a v2 series stage): the boss flag, else the last stage.
export function classicStageBoss(series, stage) {
  if (!stage) return false;
  if (stage.isFinalRound || stage.isBoss || stage.stageType === 'bossCircuit') return 'boss';
  const stages = series?.stages || [];
  return stages.length > 1 && stages[stages.length - 1]?.id === stage.id ? 'final' : false;
}
// A concept saga stage (its Fight Focus cfg carries no boss flag).
export function conceptStageBoss(cfg) {
  if (!cfg?.conceptId) return false;
  try {
    const concept = entryFor(cfg.conceptId)?.concept;
    const stages = concept ? arcStages(concept, cfg.conceptArc || 'hybrid') : [];
    const idx = Number(cfg.conceptStage) || 0;
    if (stages[idx]?.boss) return 'boss';
    return stages.length > 1 && idx === stages.length - 1 ? 'final' : false;
  } catch { return false; }
}

// ── camp: RETRY opens the camp map on that level's card ───────────────────
// Kept in memory until the map takes it (the readiness and gear checks run
// as on any start), dropped after 15 s.
let campRetry = null;
export function requestCampRetry(level) { campRetry = Number(level) > 0 ? { level: Number(level), at: Date.now() } : null; }
export function takeCampRetry() {
  if (!campRetry || Date.now() - campRetry.at > 15000) { campRetry = null; return null; }
  const { level } = campRetry;
  campRetry = null;
  return level;
}
