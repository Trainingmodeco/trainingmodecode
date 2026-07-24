// Spec 23 — the forgiving COMBO streak + if-then reminder nudges (app side).
// Pure rules live in protocol/reminders-engine.ts; copy + config in
// protocol/data/workout-reminders.json. This module derives the combo from the
// EXISTING session history (data/userStats sessions) — no session flow needs a
// hook — and replays elapsed days through the engine on demand:
//   - trained day  → combo +1 (milestones earn a GUARD + bonus XP)
//   - planned rest → combo preserved (any non-scheduled day counts as rest;
//                    with no schedule set, every untrained day is rest — the
//                    combo never breaks on someone who never opted in)
//   - unplanned miss on a SCHEDULED day → GUARD absorbs it; two consecutive
//     unguarded misses break the combo (single miss ≠ derailment, Lally 2010)
import {
  applyComboEvent, emptyComboState, defaultComboConfig, weekdayOf, fillCopy, ifThenText,
} from '../protocol/reminders-engine';
import remindersData from '../protocol/data/workout-reminders.json';
import { loadStats, addComboBonus } from './userStats';
import { loadReminderSettings } from './reminderEngine';
import { trackEvent } from './analytics';

const KEY = 'tm_combo_v1';
const MILESTONES = (remindersData.xp_and_ranks && remindersData.xp_and_ranks.combo_milestones) || [];
const COPY = remindersData.copy_packs || {};
const MILESTONE_XP = 150;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function addDaysIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

function load() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    const p = raw ? JSON.parse(raw) : null;
    if (p && p.state) return p;
  } catch { /* fresh */ }
  return { state: emptyComboState(), lastProcessed: null, copyIdx: 0, flash: null };
}

function save(s) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* quota */ }
}

// Local calendar dates (YYYY-MM-DD) that have at least one completed session.
function trainedDates() {
  const out = new Set();
  for (const s of (loadStats().sessions || [])) {
    if (!s.completedAt) continue;
    const d = new Date(s.completedAt);
    if (Number.isNaN(d.getTime())) continue;
    out.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return out;
}

// A day is "scheduled" only if the user set an if-then plan covering it.
function isPlannedDay(iso) {
  const r = loadReminderSettings();
  if (!r.enabled || !Array.isArray(r.days) || r.days.length === 0) return false;
  return r.days.includes(weekdayOf(iso));
}

// Replay any unprocessed calendar days through the engine. Today only counts
// once trained (a live day is never marked missed). Returns current snapshot.
export function syncCombo() {
  const box = load();
  const cfg = defaultComboConfig();
  const trained = trainedDates();
  const today = todayIso();

  let start = box.lastProcessed ? addDaysIso(box.lastProcessed, 1) : null;
  if (!start) {
    // First run: begin at the earliest session (or today), capped at 60 days
    // back so a long history doesn't replay forever.
    const all = [...trained].sort();
    start = all.length ? all[0] : today;
    const cap = addDaysIso(today, -60);
    if (start < cap) start = cap;
  }

  let changed = false;
  for (let d = start; d <= today; d = addDaysIso(d, 1)) {
    const isToday = d === today;
    const didTrain = trained.has(d);
    if (isToday && !didTrain) break; // live day stays open
    const res = applyComboEvent(box.state, cfg, {
      date: d,
      trained: didTrain,
      isRestDay: !didTrain && !isPlannedDay(d),
    });
    box.state = res.state;
    box.lastProcessed = d;
    changed = true;
    if (res.outcome === 'milestone' && res.milestoneDays) {
      const m = MILESTONES.filter((x) => x.days <= res.milestoneDays).pop();
      addComboBonus(MILESTONE_XP, `Combo ×${res.milestoneDays}`);
      box.flash = { kind: 'milestone', text: fillCopy(COPY.milestone || [], box.copyIdx++, { days: res.milestoneDays, rank: m?.rank || '', flavor: m?.flavor || '' }) };
      trackEvent('combo_milestone', { days: res.milestoneDays });
    } else if (res.outcome === 'guarded') {
      box.flash = { kind: 'guarded', text: fillCopy(COPY.guard_used || [], box.copyIdx++, { combo: box.state.currentCombo }) };
      trackEvent('combo_guarded', { combo: box.state.currentCombo });
    } else if (res.outcome === 'broken') {
      box.flash = { kind: 'broken', text: fillCopy(COPY.combo_break || [], box.copyIdx++, { longest: box.state.longestCombo }) };
      trackEvent('combo_broken', { longest: box.state.longestCombo });
    }
    // Trim history so storage stays small.
    if (box.state.history.length > 120) box.state.history = box.state.history.slice(-120);
  }
  if (changed) save(box);
  return getCombo();
}

// Current combo snapshot (does not replay). rank = highest milestone reached.
export function getCombo() {
  const { state } = load();
  const rank = MILESTONES.filter((m) => m.days <= state.currentCombo).pop() || null;
  return {
    combo: state.currentCombo,
    longest: state.longestCombo,
    guards: state.guardsHeld,
    rank: rank ? rank.rank : null,
  };
}

// One-shot outcome flash (milestone / guarded / broken) for the Home banner.
export function consumeComboFlash() {
  const box = load();
  const f = box.flash;
  if (f) { box.flash = null; save(box); }
  return f;
}

// The scheduled if-then nudge for TODAY (spec: one/day, positive framing,
// quiet-hours + snooze respected, only until a workout is logged).
const SNOOZE_KEY = 'tm_combo_snooze_until';
const NUDGE_DAY_KEY = 'tm_combo_nudge_day';

export function snoozeNudge(minutes) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SNOOZE_KEY, String(Date.now() + minutes * 60000)); } catch { /* noop */ }
}
export function dismissNudgeToday() {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(NUDGE_DAY_KEY, todayIso()); } catch { /* noop */ }
}

export function getComboNudge(profileName) {
  const r = loadReminderSettings();
  if (!r.enabled || !Array.isArray(r.days) || r.days.length === 0) return null;
  const today = todayIso();
  if (!r.days.includes(weekdayOf(today))) return null;
  if (trainedDates().has(today)) return null;
  try {
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem(NUDGE_DAY_KEY) === today) return null;
      const sn = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (sn && Date.now() < sn) return null;
    }
  } catch { /* noop */ }
  // Quiet hours (reuse the sheet's hours) + only from the chosen cue time on.
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const cue = r.time || `${String(r.preferredTime ?? 9).padStart(2, '0')}:00`;
  if (hhmm < cue) return null;
  if (r.quietHoursEnabled) {
    const h = now.getHours();
    const inQuiet = r.quietStart < r.quietEnd ? (h >= r.quietStart && h < r.quietEnd) : (h >= r.quietStart || h < r.quietEnd);
    if (inQuiet) return null;
  }
  const box = load();
  const { combo, guards } = getCombo();
  const lines = combo > 0 && r.streakReminders ? (COPY.streak_safety || []) : (COPY.scheduled_reminder || []);
  const text = fillCopy(lines, box.copyIdx++, {
    name: profileName || 'Fighter', activity: r.activity || 'a session', time: cue, combo, guards,
  });
  save(box);
  trackEvent('reminder_delivered', { kind: combo > 0 ? 'streak_safety' : 'scheduled' });
  return { text, activity: r.activity || null };
}

// Composed implementation-intention sentence for the settings sheet preview.
export function planText() {
  const r = loadReminderSettings();
  if (!r.enabled || !Array.isArray(r.days) || r.days.length === 0) return null;
  return ifThenText({
    id: 'plan', enabled: true, activity: r.activity || 'a session',
    days: r.days, timeLocal: r.time || `${String(r.preferredTime ?? 9).padStart(2, '0')}:00`,
    copingPlan: r.copingPlan || undefined, reminderStyle: 'standard',
  });
}
