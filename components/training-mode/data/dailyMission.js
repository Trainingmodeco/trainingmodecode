// The DAILY MISSION (retention feature 1, switch `weeks`): one short session a
// day at the top of Home, one tap to start. The old Mission of the Day code in
// App.jsx (dailyMission* keys) stays as it is for the switch off.
//
//   - One a LOCAL day, dealt from the date and what the app knows of the
//     athlete (their side, their level, yesterday's sessions), then kept for
//     the day in tm_daily_mission_v2, so it is the same mission all day and on
//     every device the progress syncs to.
//   - A fight-leaning athlete gets one 3-minute Fight Focus round; a
//     fit-leaning one a 3-minute Quick Mission. On their own level, one step
//     easier the day after a session.
//   - Done when a valid, finished session that was started from the card that
//     same day ends (the start tags its config with the date). It pays the
//     existing Mission of the Day bonus (userStats XP_DAILY_MISSION_BONUS),
//     once: the done flag is written first, and nothing is paid if it cannot be.
//
// The deal is pure (dealDailyMission); the rest reads and writes storage.
import { FIT_GOALS } from './profileOptions';
import { xpBySide, athleteTier, TIERS, QUICK_MISSION_WORD } from './athleteLevel';
import { addDailyMissionBonus, XP_DAILY_MISSION_BONUS } from './userStats';
import { safeSetItem, safeStorage } from './storageHealth';
import { trackEvent } from './analytics';
import { isTrainingRow, localIso, addDaysIso } from './weekStreak';

export const DAILY_MISSION_KEY = 'tm_daily_mission_v2';
export const DAILY_MISSION_MINUTES = 3;
// The Quick Mission foci (data/quickMissionConfig QM_FOCI, in the config's
// display form). Listed here because that module pulls in a component.
export const DAILY_FOCI = ['Full Body', 'Upper', 'Lower', 'Core', 'Combat'];
const FIGHT_LEVEL = { EASY: 'Easy', NORMAL: 'Normal', HARD: 'Hard', ADVANCED: 'Hard' };
const DISCIPLINES = ['Boxing', 'Kickboxing', 'Muay Thai', 'MMA'];

// A small stable number from the date, so the deal does not change all day.
function dateSeed(iso) {
  let h = 2166136261;
  for (let i = 0; i < iso.length; i++) { h ^= iso.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();

// Which side the athlete leans to: their stated goal (the app's own rule,
// recommendations.firstPick), else where their XP is.
export function missionSide(profile, stats) {
  const goal = profile?.goal;
  if (FIT_GOALS.has(goal)) return 'fit';
  if (goal) return 'fight';
  const x = xpBySide(stats);
  return x.fit > x.fight ? 'fit' : 'fight';
}

// The mission for `date` ('YYYY-MM-DD', local). Pure.
export function dealDailyMission({ date, profile = {}, stats = {} }) {
  const side = missionSide(profile, stats);
  const yesterday = addDaysIso(date, -1);
  const trainedYesterday = (Array.isArray(stats?.sessions) ? stats.sessions : [])
    .some((s) => isTrainingRow(s) && localIso(s.completedAt) === yesterday);
  const own = athleteTier(stats, side);
  const tier = trainedYesterday ? TIERS[Math.max(0, TIERS.indexOf(own) - 1)] : own;
  const lighter = trainedYesterday && tier !== own;
  const why = lighter ? 'lighter after yesterday' : 'fits your level';
  const base = { date, side, minutes: DAILY_MISSION_MINUTES, bonusXp: XP_DAILY_MISSION_BONUS, tier, lighter };
  if (side === 'fight') {
    const discipline = DISCIPLINES.includes(profile?.discipline) ? profile.discipline : 'Boxing';
    const difficulty = FIGHT_LEVEL[tier] || 'Normal';
    return {
      ...base, id: `${date}:fight`, discipline, difficulty,
      title: `One Round: ${discipline}`,
      line: `Fight Focus · ${difficulty} · ${why}`,
    };
  }
  const focus = DAILY_FOCI[dateSeed(date) % DAILY_FOCI.length];
  return {
    ...base, id: `${date}:fit`, focus, difficulty: cap(tier),
    title: `Quick Mission: ${focus}`,
    line: `No gear · ${cap(QUICK_MISSION_WORD[tier] || tier)} · ${why}`,
  };
}

// What START runs. The config carries `dailyMission: <date>`, which is how
// the end of the session knows it was started from the card. `qmConfig` is
// data/quickMissionConfig's builder (passed in: that module pulls in a component).
export function dailyMissionCfg(mission, { profile, qmConfig } = {}) {
  if (!mission) return null;
  if (mission.side === 'fight') {
    return {
      difficulty: mission.difficulty, mode: 'Technical', rounds: 1, roundMin: DAILY_MISSION_MINUTES, restSec: 60,
      voiceOn: true, rushMode: false, rushPattern: 'endRound', rushMix: 'explosive',
      encouragement: profile?.encouragement || 'normal', warmupMin: 0, ghost: null, ghostChallengeId: null,
      dailyMission: mission.date,
    };
  }
  const cfg = qmConfig({ duration: DAILY_MISSION_MINUTES, focus: mission.focus, difficulty: mission.difficulty });
  return { ...cfg, dailyMission: mission.date };
}

// ── storage ────────────────────────────────────────────────────────────────
// { date, mission, done, doneAt, xp }
function readBox() {
  try {
    const raw = safeStorage()?.getItem(DAILY_MISSION_KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p === 'object' && typeof p.date === 'string') return p;
  } catch { /* unreadable: a fresh deal */ }
  return null;
}

// Today's mission and whether it is done. Reads only: a fresh deal is saved
// by rememberDailyMission (from an effect, never a render).
export function todaysDailyMission({ now = Date.now(), profile, stats } = {}) {
  const today = localIso(now);
  const box = readBox();
  if (box && box.date === today && box.mission) return { mission: box.mission, done: !!box.done, saved: true };
  return { mission: dealDailyMission({ date: today, profile, stats }), done: !!(box && box.date === today && box.done), saved: false };
}

export function rememberDailyMission(mission) {
  if (!mission?.date) return;
  const box = readBox();
  if (box && box.date === mission.date && box.mission) return;
  safeSetItem(DAILY_MISSION_KEY, JSON.stringify({ date: mission.date, mission, done: !!(box && box.date === mission.date && box.done), doneAt: null, xp: 0 }));
}

// After a session banked: pays the bonus when `cfg` came from today's card,
// the session was valid and finished, and today's mission is not done yet.
// Returns the XP paid (0 when nothing was). Never throws.
export function settleDailyMission({ cfg, valid, now = Date.now() }) {
  try {
    const today = localIso(now);
    if (!cfg || cfg.dailyMission !== today || !valid) return 0;
    const box = readBox();
    if (box && box.date === today && box.done) return 0;
    const next = { date: today, mission: box && box.date === today ? box.mission : null, done: true, doneAt: new Date(now).toISOString(), xp: XP_DAILY_MISSION_BONUS };
    // The flag decides: if it cannot be saved the bonus would pay again, so nothing is paid.
    if (!safeSetItem(DAILY_MISSION_KEY, JSON.stringify(next))) return 0;
    const xp = addDailyMissionBonus();
    trackEvent('daily_mission_complete', { v: 2, side: next.mission?.side || null });
    return xp;
  } catch {
    return 0;
  }
}

// The mission finished by the session that just ended (for the end screen's
// strip): done today, within the last `freshMs`.
export function justDoneDailyMission(now = Date.now(), freshMs = 15 * 60 * 1000) {
  const box = readBox();
  if (!box || box.date !== localIso(now) || !box.done || !box.doneAt) return null;
  const at = new Date(box.doneAt).getTime();
  return Number.isFinite(at) && now - at <= freshMs && at <= now + 60000 ? { xp: box.xp || XP_DAILY_MISSION_BONUS } : null;
}
