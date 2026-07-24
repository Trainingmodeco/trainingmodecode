// Spec 26 — Game Plan (free tier v1): the manual scheduler that powers the
// EXISTING Today's Bout card. The user states days/week, minutes they can give,
// and a preferred time; the pure engine (protocol/game-plan-engine.ts) spaces a
// weekly plan, treats non-training days as combo-safe rest, and picks the
// richest session that FITS the stated free window. No calendar in v1 — the
// questionnaire's stated availability drives everything (calendar is the Pro
// upgrade). Game Plan never invents a workout; it routes to existing modes.
import { pickTodaySession, generateWeeklyPlan } from '../protocol/game-plan-engine';
import { weekdayOf } from '../protocol/reminders-engine';
import gamePlanData from '../protocol/data/game-plan.json';
import { loadStats } from './userStats';
import { loadReminderSettings, saveReminderSettings } from './reminderEngine';

const KEY = 'tm_game_plan_v1';

const DEFAULTS = {
  setup: false,
  hurdle: 'time',
  daysPerWeek: 3,
  sessionMinutes: 20,
  preferredTime: 'varies',
  restDays: [],
};

export function loadGamePlan() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

// Cue times seeded from the preferred training time (self-selected beats
// prescribed — reminders research). Only applied while the reminder cue is
// still the untouched default.
const CUE_BY_TIME = { morning: '07:30', midday: '12:30', evening: '18:30' };

export function saveGamePlan(patch) {
  const next = { ...loadGamePlan(), ...patch, setup: true };
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* quota */ }
  if (patch.preferredTime && CUE_BY_TIME[patch.preferredTime]) {
    const r = loadReminderSettings();
    if (!r.time || r.time === '09:00') saveReminderSettings({ ...r, time: CUE_BY_TIME[patch.preferredTime] });
  }
  return next;
}

export function hasGamePlan() {
  return loadGamePlan().setup === true;
}

// Engine catalog from the protocol data (reaction_mode excluded — that mode
// isn't built yet, and Game Plan must only route to sessions that exist).
const CATALOG = ((gamePlanData.session_catalog && gamePlanData.session_catalog.sessions) || [])
  .filter((s) => s.id !== 'reaction_mode')
  .map((s) => ({ id: s.id, label: s.label, mode: s.mode, minMin: s.min_min, maxMin: s.max_min, tier: s.tier }));

// Session id → the Home bout card's action routes.
const ACTION_MAP = {
  combo_coach: 'comboCoach',
  fight_focus: 'fightFocus',
  quick_mission: 'quickMission',
  combat_conditioning: 'combatConditioning',
  camp_session: 'train',
  arcade_stage: 'train',
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function trainedToday() {
  const t = todayIso();
  return (loadStats().sessions || []).some((s) => {
    if (!s.completedAt) return false;
    const d = new Date(s.completedAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === t;
  });
}

// Free tier: the stated window (preferred time + minutes) is today's free block.
const BLOCK_START = { morning: 7 * 60 + 30, midday: 12 * 60 + 30, evening: 18 * 60 + 30, varies: 12 * 60 };

// The Today's Bout recommendation, or null when the questionnaire hasn't been
// done (the card then falls back to the existing suggestion).
export function getTodayBout() {
  const gp = loadGamePlan();
  if (!gp.setup) return null;
  const prefs = {
    tier: 'free',
    daysPerWeek: gp.daysPerWeek,
    sessionMinutes: gp.sessionMinutes,
    enabledModes: [],
    ownedEquipment: [],
    preferredTime: gp.preferredTime,
    restDays: gp.restDays || [],
  };
  const start = BLOCK_START[gp.preferredTime] ?? BLOCK_START.varies;
  const rec = pickTodaySession({
    todayWeekday: weekdayOf(todayIso()),
    plan: generateWeeklyPlan(prefs),
    freeBlocks: [{ startMin: start, endMin: start + gp.sessionMinutes }],
    alreadyTrainedToday: trainedToday(),
    readiness: 'ready',
    prefs,
    catalog: CATALOG,
  });
  if (rec.kind === 'train') {
    return { ...rec, actionType: ACTION_MAP[rec.session.id] || 'train' };
  }
  return rec;
}
