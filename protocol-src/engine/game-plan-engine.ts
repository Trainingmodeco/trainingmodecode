/**
 * Game Plan — pure scheduling engine.
 * Turns "I don't have time" into "you have 20 minutes at 2pm, here's a session
 * that fits." Framework-free; the caller supplies "now", availability, and
 * free/busy blocks — the engine never reads the clock or the calendar itself.
 * Config + data model: ../data/game-plan.json. Spec: specs/26-game-plan-scheduler.md.
 *
 * Reuses concepts from the rest of the protocol:
 * - readiness gate (../data/readiness.json) — caller passes the assessed state.
 * - combo streak + reminders (../engine/reminders-engine.ts) — rest days don't
 *   break the combo; nudges are forgiving and positive.
 */

import type { Weekday } from "./reminders-engine";

export type Tier = "free" | "pro";
export type SessionMode = "fight" | "fit" | "fight_fit" | "camp" | "arcade";
export type ReadinessState = "ready" | "suggest_easy_or_recovery" | "halt";

/** A session type Game Plan can route to (mirrors data/game-plan.json session_catalog). */
export interface SessionType {
  id: string;
  label: string;
  mode: SessionMode | "fight_fit";
  minMin: number;   // shortest the session can run
  maxMin: number;   // longest it typically runs
  tier: Tier;
}

/** A free window on a given day, in minutes-from-midnight. */
export interface FreeBlock { startMin: number; endMin: number; }

export interface UserPrefs {
  tier: Tier;
  daysPerWeek: number;          // 2..7
  sessionMinutes: number;       // 10 | 20 | 30 | 45(+)
  enabledModes: SessionMode[];  // which modes the user has on
  ownedEquipment: string[];     // equipment ids the user has (for filtering)
  preferredTime: "morning" | "midday" | "evening" | "varies";
  restDays?: Weekday[];         // explicit rest days (optional)
}

const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const blockLen = (b: FreeBlock) => b.endMin - b.startMin;

// ── Gap → session matching ─────────────────────────────────────────────────

/**
 * Which sessions fit a free gap (minutes)? A session "fits" when its FLOOR
 * (minMin) is within the gap — sessions are flexible ranges, so a [20,40] block
 * can be done in a 30-min gap. Returns eligible sessions ordered richest-first
 * (highest floor that still fits = the most substantial session the time
 * allows), tie-broken toward the tighter maxMin (less likely to overrun),
 * filtered by the user's enabled modes and tier.
 */
export function sessionsForGap(
  gapMin: number,
  catalog: SessionType[],
  prefs: Pick<UserPrefs, "tier" | "enabledModes">,
): SessionType[] {
  const tierOk = (t: Tier) => prefs.tier === "pro" || t === "free";
  const modeOk = (m: SessionType["mode"]) =>
    prefs.enabledModes.length === 0 ||
    m === "fight_fit" ||
    prefs.enabledModes.includes(m as SessionMode);

  return catalog
    .filter((s) => tierOk(s.tier) && modeOk(s.mode) && gapMin >= s.minMin)
    .sort((a, b) => (b.minMin - a.minMin) || (a.maxMin - b.maxMin));
}

/** The single best session for a gap, or null if nothing fits. */
export function bestSessionForGap(
  gapMin: number,
  catalog: SessionType[],
  prefs: Pick<UserPrefs, "tier" | "enabledModes">,
): SessionType | null {
  return sessionsForGap(gapMin, catalog, prefs)[0] ?? null;
}

// ── Weekly plan ────────────────────────────────────────────────────────────

export interface PlanDay { day: Weekday; training: boolean; rest: boolean; }

/**
 * Distribute `daysPerWeek` training slots across the week, spaced out, honoring
 * explicit rest days. Pure + deterministic (no randomness). Non-training days
 * are planned rest days (they never break the combo).
 */
export function generateWeeklyPlan(prefs: UserPrefs): PlanDay[] {
  const n = Math.max(0, Math.min(7, Math.floor(prefs.daysPerWeek)));
  const rest = new Set(prefs.restDays ?? []);
  const candidates = WEEK.filter((d) => !rest.has(d));

  // Evenly space n picks across the candidate days (deterministic, non-clustered).
  const picks = new Set<Weekday>();
  const k = Math.min(n, candidates.length);
  for (let i = 0; i < k; i++) {
    picks.add(candidates[Math.round((i * candidates.length) / k)] ?? candidates[i]);
  }

  return WEEK.map((day) => ({
    day,
    training: picks.has(day),
    rest: !picks.has(day),
  }));
}

// ── Today's Bout (the home-card recommendation) ────────────────────────────

export interface TodayContext {
  todayWeekday: Weekday;
  plan: PlanDay[];
  freeBlocks: FreeBlock[];       // today's known free windows (calendar or stated)
  alreadyTrainedToday: boolean;
  readiness: ReadinessState;
  prefs: UserPrefs;
  catalog: SessionType[];
}

export type TodayRecommendation =
  | { kind: "rest_day"; reason: string }
  | { kind: "already_trained"; reason: string }
  | { kind: "halt"; reason: string }
  | { kind: "recovery"; reason: string }
  | { kind: "train"; session: SessionType; block: FreeBlock; gapMin: number };

/**
 * The "Today's Bout" recommendation. Picks the best session for today's largest
 * free block, gated by the plan, readiness, and whether they already trained.
 */
export function pickTodaySession(ctx: TodayContext): TodayRecommendation {
  if (ctx.readiness === "halt")
    return { kind: "halt", reason: "Readiness says rest today — recover, don't train." };

  const today = ctx.plan.find((d) => d.day === ctx.todayWeekday);
  if (today && today.rest && !today.training)
    return { kind: "rest_day", reason: "Planned rest day — recovery is training. Your combo is safe." };

  if (ctx.alreadyTrainedToday)
    return { kind: "already_trained", reason: "You've trained today — nice. No need to double up." };

  if (ctx.readiness === "suggest_easy_or_recovery")
    return { kind: "recovery", reason: "Low readiness — an Easy variant or a recovery session keeps your combo." };

  // Largest free block today.
  const block = [...ctx.freeBlocks].sort((a, b) => blockLen(b) - blockLen(a))[0];
  if (!block)
    return { kind: "recovery", reason: "No known free block today — tell Game Plan when you're free, or grab a Quick Mission." };

  const gapMin = blockLen(block);
  const session = bestSessionForGap(gapMin, ctx.catalog, ctx.prefs);
  if (!session)
    return { kind: "recovery", reason: `Only ${gapMin} min free — try a short mobility or Reaction round.` };

  return { kind: "train", session, block, gapMin };
}

// ── Opportunistic "a gap appeared" nudge (Pro) ─────────────────────────────

export interface NudgeContext {
  tier: Tier;
  isTrainingDay: boolean;
  alreadyTrainedToday: boolean;
  dismissedLastNudgeToday: boolean;
  nowMin: number;                 // minutes-from-midnight
  quietStartMin: number;          // e.g. 21:30 -> 1290
  quietEndMin: number;            // e.g. 07:00 -> 420
  minsSinceLastNudge: number;
  cooldownHours: number;
  gapMin: number;                 // size of the free gap that just appeared
  catalog: SessionType[];
  prefs: UserPrefs;
}

/**
 * Should Game Plan fire an opportunistic "free gap just appeared" nudge?
 * Pro-only, and only when it genuinely helps: a training day, not yet trained,
 * outside quiet hours, past the cooldown, not previously dismissed today, and a
 * real session fits the gap. Returns the session to suggest, or null.
 */
export function opportunisticNudge(ctx: NudgeContext): SessionType | null {
  if (ctx.tier !== "pro") return null;
  if (!ctx.isTrainingDay || ctx.alreadyTrainedToday || ctx.dismissedLastNudgeToday) return null;
  if (isQuietHours(ctx.nowMin, ctx.quietStartMin, ctx.quietEndMin)) return null;
  if (ctx.minsSinceLastNudge < ctx.cooldownHours * 60) return null;
  return bestSessionForGap(ctx.gapMin, ctx.catalog, ctx.prefs);
}

/** Quiet hours can wrap past midnight (start > end). */
export function isQuietHours(nowMin: number, startMin: number, endMin: number): boolean {
  return startMin <= endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin;
}
