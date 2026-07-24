/**
 * Workout Reminders — pure engine.
 * Lightweight, forgiving reminder + streak ("combo") logic. Framework-free.
 * Config + data model + copy: ../data/workout-reminders.json.
 * Grounded in ../research/reminders-research-report.md.
 *
 * Design rules baked in (evidence-flagged in the research report):
 * - Reminders are IMPLEMENTATION INTENTIONS (if-then plans) — best-supported.
 * - The combo is FORGIVING: planned rest days never break it; a small number of
 *   GUARD tokens absorb an ISOLATED missed day; the combo breaks only on TWO
 *   consecutive unplanned misses with no GUARD (single miss ≠ derailment).
 * - Copy is positive/coach-toned, never guilt. One nudge/day by default.
 * - Nothing promises fast habits (the "21-day" figure is a myth; ~66d median).
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type ReminderStyle = "gentle" | "standard";
export type DayStatus = "trained" | "rest" | "guarded" | "missed";

export interface Reminder {
  id: string;
  enabled: boolean;
  activity: string;         // user-chosen, e.g. "Combo Coach"
  days: Weekday[];          // user-chosen training days
  timeLocal: string;        // "HH:mm" cue time
  copingPlan?: string;      // optional "if {barrier}, then {backup}"
  reminderStyle: ReminderStyle;
}

/** Auto-compose the if-then plan text for a reminder (implementation intention). */
export function ifThenText(r: Reminder): string {
  const days = r.days.length === 7 ? "every day" : r.days.map(dayLabel).join("/");
  const base = `If it's ${r.timeLocal} on ${days}, then I train ${r.activity}.`;
  return r.copingPlan ? `${base} ${r.copingPlan}` : base;
}

const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const dayLabel = (d: Weekday) => d.charAt(0).toUpperCase() + d.slice(1);

/** Weekday key for an ISO date "YYYY-MM-DD" (UTC-safe, no Date-now dependency). */
export function weekdayOf(isoDate: string): Weekday {
  // 1970-01-01 was a Thursday. Compute days since epoch from the date parts.
  const [y, m, d] = isoDate.split("-").map(Number);
  const days = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  // Thursday = index 3 in a Mon-based week (mon=0).
  return WEEK[(((days + 3) % 7) + 7) % 7];
}

/** Is this ISO date a scheduled training day for any enabled reminder? */
export function isScheduledDay(reminders: Reminder[], isoDate: string): boolean {
  const wd = weekdayOf(isoDate);
  return reminders.some((r) => r.enabled && r.days.includes(wd));
}

// ── Streak / combo ────────────────────────────────────────────────────────

export interface ComboConfig {
  plannedRestDays: Weekday[]; // never break the combo
  maxGuards: number;          // freeze tokens held cap (default 2)
  guardEveryDays: number;     // earn 1 GUARD per N-day milestone (default 7)
}

export interface ComboState {
  currentCombo: number;
  longestCombo: number;
  guardsHeld: number;
  lastTrainedDate: string | null; // YYYY-MM-DD
  history: { date: string; status: DayStatus }[];
}

export const defaultComboConfig = (): ComboConfig => ({
  plannedRestDays: [],
  maxGuards: 2,
  guardEveryDays: 7,
});

export const emptyComboState = (): ComboState => ({
  currentCombo: 0,
  longestCombo: 0,
  guardsHeld: 0,
  lastTrainedDate: null,
  history: [],
});

/** Inclusive count of calendar days between two ISO dates (b - a). */
export function daysBetween(a: string, b: string): number {
  const toN = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  };
  return toN(b) - toN(a);
}

export interface ComboEvent {
  date: string;               // YYYY-MM-DD of the event
  trained: boolean;           // did a completed/verified workout happen?
  isRestDay?: boolean;        // explicitly a planned rest day
}

/**
 * Advance the combo by one day's event. Pure: returns a new state + what happened.
 * - trained            → combo +1 (rest/guard-covered gap days between are healed first)
 * - planned rest day    → combo preserved (counts as a kept day), no increment
 * - unplanned miss      → a GUARD is auto-spent to preserve the combo if held;
 *                          otherwise it's a strike. TWO consecutive unguarded
 *                          misses break the combo (isolated single miss survives).
 *
 * The caller feeds days in order (typically one per calendar day, or on app open
 * it can replay each elapsed day). `outcome` tells the UI which copy pack to use.
 */
export type ComboOutcome = "trained" | "rest" | "guarded" | "held" | "broken" | "milestone";

export function applyComboEvent(
  state: ComboState,
  cfg: ComboConfig,
  ev: ComboEvent,
): { state: ComboState; outcome: ComboOutcome; milestoneDays?: number } {
  const restDay =
    ev.isRestDay === true || cfg.plannedRestDays.includes(weekdayOf(ev.date));

  const next: ComboState = {
    ...state,
    history: [...state.history],
  };

  // Planned rest day (and not trained): preserve the combo, no increment.
  if (!ev.trained && restDay) {
    next.history.push({ date: ev.date, status: "rest" });
    return { state: next, outcome: "rest" };
  }

  // Trained: increment, heal, maybe earn a GUARD / hit a milestone.
  if (ev.trained) {
    next.currentCombo = state.currentCombo + 1;
    next.longestCombo = Math.max(state.longestCombo, next.currentCombo);
    next.lastTrainedDate = ev.date;
    next.history.push({ date: ev.date, status: "trained" });

    // Earn a GUARD each guardEveryDays of combo, capped.
    let outcome: "trained" | "milestone" = "trained";
    let milestoneDays: number | undefined;
    if (next.currentCombo > 0 && next.currentCombo % cfg.guardEveryDays === 0) {
      next.guardsHeld = Math.min(cfg.maxGuards, state.guardsHeld + 1);
      outcome = "milestone";
      milestoneDays = next.currentCombo;
    }
    return { state: next, outcome, milestoneDays };
  }

  // Unplanned miss on a day that mattered.
  // Look back: was the immediately previous recorded day also an unguarded miss?
  const prev = state.history[state.history.length - 1];
  const prevWasMiss = prev?.status === "missed";

  if (!prevWasMiss && state.guardsHeld > 0) {
    // Isolated miss + GUARD available → block it, combo survives.
    next.guardsHeld = state.guardsHeld - 1;
    next.history.push({ date: ev.date, status: "guarded" });
    return { state: next, outcome: "guarded" };
  }

  if (!prevWasMiss) {
    // First miss, no GUARD: record it but DON'T break yet — a single missed day
    // doesn't derail habit formation (Lally 2010). A second consecutive miss
    // breaks the combo. The combo count is preserved ("held").
    next.history.push({ date: ev.date, status: "missed" });
    return { state: next, outcome: "held" };
  }

  // Second consecutive unguarded miss → break.
  next.currentCombo = 0;
  next.history.push({ date: ev.date, status: "missed" });
  return { state: next, outcome: "broken" };
}

// ── Next reminder time ─────────────────────────────────────────────────────

/**
 * Given enabled reminders and "now" (ISO date + HH:mm), find the next reminder
 * fire (date + time + which reminder). Pure; caller supplies now so the engine
 * never reads the clock. Returns null if no reminders are enabled.
 */
export function nextReminder(
  reminders: Reminder[],
  nowIsoDate: string,
  nowHHmm: string,
): { reminderId: string; date: string; time: string } | null {
  const enabled = reminders.filter((r) => r.enabled && r.days.length > 0);
  if (enabled.length === 0) return null;

  const nowMin = hhmmToMin(nowHHmm);
  let best: { reminderId: string; date: string; time: string; sort: number } | null = null;

  for (let offset = 0; offset < 8; offset++) {
    const date = addDays(nowIsoDate, offset);
    const wd = weekdayOf(date);
    for (const r of enabled) {
      if (!r.days.includes(wd)) continue;
      const t = hhmmToMin(r.timeLocal);
      if (offset === 0 && t <= nowMin) continue; // already passed today
      const sort = offset * 1440 + t;
      if (!best || sort < best.sort) {
        best = { reminderId: r.id, date, time: r.timeLocal, sort };
      }
    }
    if (best && offset >= 0 && best.date === date) break; // earliest found on this day
  }
  return best ? { reminderId: best.reminderId, date: best.date, time: best.time } : null;
}

const hhmmToMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

function addDays(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

// ── Copy selection ─────────────────────────────────────────────────────────

/**
 * Deterministically pick + fill a copy line (rotates by an index the caller
 * supplies — e.g. a per-user counter — to fight habituation without randomness).
 */
export function fillCopy(
  lines: string[],
  index: number,
  tokens: Record<string, string | number>,
): string {
  if (lines.length === 0) return "";
  const line = lines[((index % lines.length) + lines.length) % lines.length];
  return line.replace(/\{(\w+)\}/g, (_, k) => (k in tokens ? String(tokens[k]) : `{${k}}`));
}
