/**
 * Training Mode — Protocol Engine
 * Pure functions over the JSON content in ../data. No framework dependencies:
 * drop this file + the data folder into any React/React Native/Bolt project.
 */

// ---------- Types ----------

export type Discipline = "boxing" | "kickboxing" | "muay_thai" | "mma";
export type Difficulty = "easy" | "normal" | "hard";
export type Phase = "foundation" | "development" | "hard_camp" | "taper" | "final_boss";
export type SessionPattern = "single" | "split_or_full" | "single_extended";
export type PathKind = "fit" | "fight" | "full_arc";
export type SessionFormat = "split" | "full";

export interface Archetype {
  id: string;
  discipline: Discipline;
  name: string;
  tagline: string;
  variants: Record<Difficulty, string>;
}

export interface CampLevel {
  level: number;
  phase: Phase;
  phase_label: string;
  title: string;              // short per-level nickname (BASICS, ENGINE, PEAK, …) — 45a ladder label
  session_pattern: SessionPattern;
  physical_emphasis: string[];
  combat_emphasis: string[];
  product_rule: string;
  taper?: { volume_reduction: [number, number] };
}

export interface TimingEntry {
  disciplines: Discipline[];
  levels: [number, number];
  difficulty: Difficulty;
  rounds: [number, number];
  round_sec: [number, number];
  rest_sec: [number, number];
  style?: string;
}

export interface TimingTables {
  entries: TimingEntry[];
  final_boss: {
    striking: Record<Difficulty, { active_minutes?: [number, number]; note?: string; requires_readiness_pass?: boolean }>;
    mma: Record<Difficulty, { rounds?: number; round_sec?: number; rest_sec?: number; note?: string; requires_clean_history?: boolean }>;
  };
}

export interface RoundTemplate {
  rounds: number;
  roundSec: number;
  restSec: number;
  style?: string;
  activeMinutesTarget?: number;
  requiresReadinessPass?: boolean;
  requiresCleanHistory?: boolean;
  taperApplied?: boolean;
}

export interface XpRuleset {
  base_xp_per_active_minute: number;
  difficulty_multiplier: Record<Difficulty, number>;
  full_arc_completion_bonus: number;
  clean_technique_bonus: number;
  no_difficulty_drop_weekly_bonus: number;
  completion_multiplier: { pass: number; partial: number; fail: number; validation_failed: number };
}

export type SessionOutcome = "pass" | "partial" | "fail" | "validation_failed";

export interface XpInput {
  activeMinutes: number;
  difficulty: Difficulty;
  outcome: SessionOutcome;
  fullArc?: boolean;
  cleanTechnique?: boolean;
  weeklyNoDropBonus?: boolean;
}

export interface PassThreshold {
  min_completion: number;
  technique: string;
  tactical_objective: "attempted" | "completed" | "completed_cleanly";
}

export interface PassRules {
  thresholds: Record<Difficulty, PassThreshold>;
  fail_types: Record<string, { cause: string; response: string }>;
}

export type FailType = "safety" | "conditioning" | "technical" | "tactical";

export interface SessionResult {
  completionRatio: number;          // 0..1 of prescribed work completed
  majorTechniqueBreakdowns: number; // count of flagged form breakdowns
  tacticalObjective: "missed" | "attempted" | "completed" | "completed_cleanly";
  safetyFlag: boolean;              // danger symptom or integrity hard-flag
  rpeInBand: boolean;
}

export interface Evaluation {
  outcome: SessionOutcome;
  failType?: FailType;
  response?: string;
}

// ---------- Helpers ----------

const mid = ([lo, hi]: [number, number]) => Math.round((lo + hi) / 2);

// ---------- Round timing ----------

/**
 * Resolve the round template for a camp session.
 * Levels 10–11 reuse the level-9-band template with the level's taper
 * volume_reduction applied to the round count (round length is preserved).
 * Level 12 resolves from the final_boss table.
 */
export function resolveRoundTemplate(
  discipline: Discipline,
  level: number,
  difficulty: Difficulty,
  tables: TimingTables,
  campLevels: CampLevel[]
): RoundTemplate {
  if (level === 12) {
    if (discipline === "mma") {
      const fb = tables.final_boss.mma[difficulty];
      return {
        rounds: fb.rounds ?? 5,
        roundSec: fb.round_sec ?? 300,
        restSec: fb.rest_sec ?? 60,
        requiresCleanHistory: fb.requires_clean_history ?? false,
      };
    }
    const fb = tables.final_boss.striking[difficulty];
    return {
      rounds: 0,
      roundSec: 0,
      restSec: 60,
      activeMinutesTarget: fb.active_minutes ? mid(fb.active_minutes) : 25,
      requiresReadinessPass: fb.requires_readiness_pass ?? false,
    };
  }

  const lookupLevel = level >= 10 ? 9 : level;
  const entry = tables.entries.find(
    (e) =>
      e.disciplines.includes(discipline) &&
      lookupLevel >= e.levels[0] &&
      lookupLevel <= e.levels[1] &&
      e.difficulty === difficulty
  );
  if (!entry) throw new Error(`No timing entry for ${discipline} L${level} ${difficulty}`);

  let rounds = mid(entry.rounds);
  let taperApplied = false;
  if (level >= 10) {
    const camp = campLevels.find((c) => c.level === level);
    const reduction = camp?.taper ? mid(camp.taper.volume_reduction.map((x) => x * 100) as [number, number]) / 100 : 0.25;
    rounds = Math.max(2, Math.round(rounds * (1 - reduction)));
    taperApplied = true;
  }

  return {
    rounds,
    roundSec: mid(entry.round_sec),
    restSec: mid(entry.rest_sec),
    style: entry.style,
    taperApplied,
  };
}

// ---------- Session evaluation ----------

/**
 * Evaluate a finished session against the pass rules.
 * Order matters: safety → conditioning → technical → tactical.
 */
export function evaluateSession(
  result: SessionResult,
  difficulty: Difficulty,
  rules: PassRules
): Evaluation {
  const t = rules.thresholds[difficulty];

  if (result.safetyFlag) {
    return { outcome: "fail", failType: "safety", response: rules.fail_types.safety.response };
  }
  if (result.completionRatio < t.min_completion) {
    const outcome: SessionOutcome = result.completionRatio >= 0.5 ? "partial" : "fail";
    return { outcome, failType: "conditioning", response: rules.fail_types.conditioning.response };
  }

  const breakdownLimit = difficulty === "easy" ? 2 : difficulty === "normal" ? 1 : 0;
  if (result.majorTechniqueBreakdowns > breakdownLimit) {
    return { outcome: "fail", failType: "technical", response: rules.fail_types.technical.response };
  }

  const tacticalRank = { missed: 0, attempted: 1, completed: 2, completed_cleanly: 3 } as const;
  const requiredRank = tacticalRank[t.tactical_objective];
  if (tacticalRank[result.tacticalObjective] < requiredRank) {
    return { outcome: "fail", failType: "tactical", response: rules.fail_types.tactical.response };
  }

  return { outcome: "pass" };
}

// ---------- Title Fight (camp L12) ----------

export interface TitleFightRound {
  index: number;
  objective: string;      // what this round is scored on
  coachPrompt: string;
  championship: boolean;  // the last three — the rounds that decide it
}

export interface TitleFightPlan {
  rounds: number;
  roundSec: number;
  restSec: number;
  activeMinutes: number;
  formGated: boolean;         // technique breakdown ends the fight, not just the round
  requiresReadinessPass: boolean;
  requiresCleanHistory: boolean;
  roundPlan: TitleFightRound[];
}

// A title fight is twelve rounds. The striking table gives L12 an
// active-minutes target and calls for "structured objective rounds", but
// nothing built them — the camp resolved rounds: 0 and the app ran ONE
// 27-minute block. These are the objectives, cycling the whole camp's work and
// ending on the three championship rounds.
const TITLE_FIGHT_OBJECTIVES = [
  "feel him out — range and guard",
  "establish the jab",
  "work the body",
  "counter off his lead",
  "take the centre",
  "hold your output as it gets hard",
  "defence only — make him miss",
  "answer every exchange",
  "cut the angles",
  "championship round — dig in",
  "championship round — do not break",
  "championship round — finish in control",
];

const MMA_OBJECTIVES = [
  "feel him out — range and level",
  "strike into the takedown",
  "control and pass",
  "scramble and reset",
  "championship round — finish in control",
];

/**
 * Resolve camp Level 12 into a real title fight rather than one long block.
 *
 * Striking runs twelve rounds, the round length chosen so the total sits
 * inside the difficulty's active-minutes band. MMA keeps the championship
 * shape the timing table already specifies (4-5 rounds of 4-5 minutes).
 * Either way the fight is FORM-GATED: this is the one camp session where
 * technique breaking down ends it.
 */
export function resolveTitleFight(
  discipline: Discipline,
  difficulty: Difficulty,
  tables: TimingTables
): TitleFightPlan {
  if (discipline === "mma") {
    const fb = tables.final_boss.mma[difficulty];
    const rounds = fb.rounds ?? 5;
    const roundSec = fb.round_sec ?? 300;
    return {
      rounds, roundSec, restSec: fb.rest_sec ?? 60,
      activeMinutes: Math.round((rounds * roundSec) / 60),
      formGated: true,
      requiresReadinessPass: false,
      requiresCleanHistory: fb.requires_clean_history ?? false,
      roundPlan: Array.from({ length: rounds }, (_, i) => ({
        index: i + 1,
        objective: MMA_OBJECTIVES[Math.min(i, MMA_OBJECTIVES.length - 1)],
        coachPrompt: "Championship rounds. Control decides this.",
        championship: i >= rounds - 1,
      })),
    };
  }

  const fb = tables.final_boss.striking[difficulty];
  const target = fb.active_minutes ? mid(fb.active_minutes) : 25;
  const rounds = 12;
  // Round length lands the twelve rounds on the difficulty's own target:
  // ~2 min at easy/normal, ~3 min at hard. Clamped so no round is under 90s.
  const roundSec = Math.max(90, Math.round(((target * 60) / rounds) / 30) * 30);
  return {
    rounds, roundSec, restSec: 60,
    activeMinutes: Math.round((rounds * roundSec) / 60),
    formGated: true,
    requiresReadinessPass: fb.requires_readiness_pass ?? false,
    requiresCleanHistory: false,
    roundPlan: Array.from({ length: rounds }, (_, i) => ({
      index: i + 1,
      objective: TITLE_FIGHT_OBJECTIVES[i],
      coachPrompt: i >= rounds - 3
        ? "Championship round. This is where the fight is won."
        : "Hit the objective. Form holds or the fight stops.",
      championship: i >= rounds - 3,
    })),
  };
}

// ---------- XP ----------

/**
 * XP = active_minutes × base × difficulty × completion × quality bonuses.
 * The completion multipliers guarantee the balancing rule: a clean Easy
 * pass (1.0 × 1.0) always beats a Hard fail (1.3 × 0.15).
 */
export function calcXp(input: XpInput, rules: XpRuleset): number {
  let xp =
    input.activeMinutes *
    rules.base_xp_per_active_minute *
    rules.difficulty_multiplier[input.difficulty] *
    rules.completion_multiplier[input.outcome];

  let bonus = 1;
  if (input.outcome === "pass") {
    if (input.fullArc) bonus += rules.full_arc_completion_bonus;
    if (input.cleanTechnique) bonus += rules.clean_technique_bonus;
    if (input.weeklyNoDropBonus) bonus += rules.no_difficulty_drop_weekly_bonus;
  }
  return Math.round(xp * bonus);
}

// ---------- Readiness ----------

export interface ReadinessAnswers {
  sleep: number;    // 1–5, 5 = great
  fatigue: number;  // 1–5, 5 = fresh
  soreness: number; // 1–5, 5 = none
  stress: number;   // 1–5, 5 = calm
  mood: number;     // 1–5, 5 = motivated
  dangerSymptom: boolean;
}

export type ReadinessVerdict = "halt" | "suggest_easy_or_recovery" | "go";

export function assessReadiness(a: ReadinessAnswers): ReadinessVerdict {
  if (a.dangerSymptom) return "halt";
  const score = a.sleep + a.fatigue + a.soreness + a.stress + a.mood; // 5..25
  return score <= 12 ? "suggest_easy_or_recovery" : "go";
}

// ---------- Lookups ----------

export function getArchetypes(archetypes: Archetype[], discipline: Discipline): Archetype[] {
  return archetypes.filter((a) => a.discipline === discipline);
}

export function getCampLevel(campLevels: CampLevel[], level: number): CampLevel {
  const found = campLevels.find((c) => c.level === level);
  if (!found) throw new Error(`Unknown camp level ${level}`);
  return found;
}

/** Split option is only offered on split_or_full levels (4–11). */
export function splitAvailable(campLevels: CampLevel[], level: number): boolean {
  return getCampLevel(campLevels, level).session_pattern === "split_or_full";
}
