/**
 * Arcade Session Engine — pure logic for the Training Arcade session standard.
 * Framework-free; the caller supplies "now"/indices so nothing reads the clock
 * or RNG. Config + data model: ../data/arcade-session-standards.json.
 * Spec: specs/27-arcade-session-standards.md.
 *
 * Implements the features from the general Arcade update:
 *  - FIT: resolve a counted prescription (sets x reps/sec) by tier + category +
 *    difficulty from the volume ladder; bodyweight <-> weighted re-ranging.
 *  - WEIGHTED FLOW: the review/approve/swap/convert setup + Generate gating +
 *    the announcer countdown script + an adaptive-rest calc for weighted sets.
 *  - COUNTING: bodyweight = rep-counted (voice unless toggled off); weighted =
 *    completion-timed.
 *  - FIGHT: resolve a thematic drill to its canonical discipline/move + pick a
 *    bodyweight finisher (difficulty-scaled).
 *  - BOTH: a shared plyo foot-contact budget across fit + fight.
 */

export type Category =
  | "pull" | "push" | "squat_legs" | "core" | "explosive" | "hold" | "carry"
  | "conditioning" | "mobility";
export type Difficulty = "easy" | "normal" | "hard";
export type Tier = "T1" | "T2" | "T3" | "T4";
export type CountMode = "reps" | "cadence" | "time" | "none";
export type LoadType = "bodyweight" | "weighted" | "either";

/** A stored prescription exercise (mirrors campaign module `prescription[]`). */
export interface Prescription {
  name: string;
  category: Category;
  sets: number;
  reps?: number;          // reps per set (rep movements)
  duration_sec?: number;  // seconds per set (holds/carries/conditioning)
  count_mode?: CountMode;
  load_type?: LoadType;
  load?: string;          // "user_entered" etc.
  rest_sec?: number;
  note?: string;          // present when a movement is TUNED off the ladder
  plyo_counted?: boolean; // explosive that spends the plyo foot-contact cap
}

/** A resolved, concrete dose for a chosen difficulty. */
export interface ResolvedDose {
  name: string;
  category: Category;
  sets: number;
  reps?: number;
  duration_sec?: number;
  count_mode: CountMode;
  load_type: LoadType;
  rest_sec: number;
}

// The volume ladder shape (data/arcade-session-standards.json > volume_ladder.by_category).
export interface LadderCell { sets: number; reps?: number; sec?: number; }
export type LadderCategory = Record<Tier, Record<Difficulty, LadderCell>>;
export interface VolumeLadder { by_category: Partial<Record<Category, { unit?: string } & LadderCategory>>; }

// Ladder categories re-resolve fully from the ladder; everything else is TUNED
// (kept close to its stored normal, scaled gently by difficulty).
const LADDER_CATEGORIES: Category[] = ["pull", "push", "squat_legs", "core", "hold", "explosive"];
const TUNED_FACTOR: Record<Difficulty, number> = { easy: 0.75, normal: 1.0, hard: 1.25 };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const roundReps = (n: number) => Math.max(1, Math.round(n));

/**
 * Resolve a stored prescription to a concrete dose for a difficulty.
 * - A pure LADDER category with NO `note` (i.e. not tuned) pulls sets+reps/sec
 *   straight from the ladder by its tier.
 * - A TUNED movement (has `note`) or a non-ladder category (conditioning /
 *   mobility / carry) keeps its stored shape and scales gently by difficulty
 *   (reps/sec ×0.75 easy / ×1.25 hard; sets unchanged; count_mode "none"/"time"
 *   never gets a rep multiplier applied to reps it doesn't have).
 */
export function resolvePrescription(
  ex: Prescription,
  tier: Tier,
  difficulty: Difficulty,
  ladder: VolumeLadder,
): ResolvedDose {
  const base: ResolvedDose = {
    name: ex.name,
    category: ex.category,
    sets: ex.sets,   // overwritten below per branch
    count_mode: ex.count_mode ?? (ex.duration_sec != null ? "time" : "reps"),
    load_type: ex.load_type ?? "bodyweight",
    rest_sec: ex.rest_sec ?? defaultRest(ex.category),
  };

  const tuned = ex.note != null || ex.load_type === "weighted";
  const cat = ladder.by_category[ex.category];

  if (LADDER_CATEGORIES.includes(ex.category) && cat && !tuned) {
    const cell = cat[tier][difficulty];
    base.sets = cell.sets;
    if (cell.sec != null) base.duration_sec = cell.sec;
    else base.reps = cell.reps;
    return base;
  }

  // Tuned / non-ladder: keep stored shape, scale the dose gently.
  const f = TUNED_FACTOR[difficulty];
  base.sets = ex.sets;
  if (ex.duration_sec != null) base.duration_sec = Math.max(5, Math.round(ex.duration_sec * f));
  if (ex.reps != null) base.reps = roundReps(ex.reps * f);
  return base;
}

function defaultRest(cat: Category): number {
  switch (cat) {
    case "pull": return 90;
    case "push": return 60;
    case "squat_legs": return 60;
    case "core": return 45;
    case "explosive": return 75;
    case "hold": return 45;
    case "carry": return 60;
    case "conditioning": return 60;
    case "mobility": return 30;
  }
}

// ── Bodyweight <-> weighted re-ranging ─────────────────────────────────────

/** High-rep bodyweight band by category (the "very heavy equivalent"). */
const BODYWEIGHT_HEAVY_REPS: Partial<Record<Category, number>> = {
  pull: 12, push: 40, squat_legs: 40, core: 40,
};

/** Convert a weighted movement to a bodyweight equivalent (high reps, no load). */
export function toBodyweight(ex: Prescription): Prescription {
  const reps = BODYWEIGHT_HEAVY_REPS[ex.category] ?? (ex.reps != null ? ex.reps * 3 : undefined);
  return {
    ...ex, load_type: "bodyweight", load: undefined,
    reps: ex.duration_sec != null ? undefined : reps,
    count_mode: ex.duration_sec != null ? "time" : "reps",
  };
}

/** Convert a bodyweight movement to a weighted equivalent (lower reps at load). */
export function toWeighted(ex: Prescription, loadLabel = "user_entered"): Prescription {
  return {
    ...ex, load_type: "weighted", load: loadLabel,
    reps: ex.duration_sec != null ? undefined : clamp(ex.reps ?? 10, 6, 12),
    count_mode: ex.duration_sec != null ? "time" : "reps",
    rest_sec: Math.max(ex.rest_sec ?? 60, 90),
  };
}

// ── Weighted setup flow (review -> approve/swap/convert -> Generate) ────────

export type SlotStatus = "pending" | "approved" | "swapped" | "converted";
export interface SetupSlot { exercise: Prescription; status: SlotStatus; }
export interface WeightedSetup { slots: SetupSlot[]; }

export const initSetup = (exercises: Prescription[]): WeightedSetup => ({
  slots: exercises.map((exercise) => ({ exercise, status: "pending" })),
});

const withSlot = (s: WeightedSetup, i: number, patch: Partial<SetupSlot>): WeightedSetup => ({
  slots: s.slots.map((slot, idx) => (idx === i ? { ...slot, ...patch } : slot)),
});

export const approveSlot = (s: WeightedSetup, i: number): WeightedSetup =>
  withSlot(s, i, { status: "approved" });

export const swapSlot = (s: WeightedSetup, i: number, replacement: Prescription): WeightedSetup =>
  withSlot(s, i, { exercise: replacement, status: "swapped" });

export const makeSlotBodyweight = (s: WeightedSetup, i: number): WeightedSetup =>
  withSlot(s, i, { exercise: toBodyweight(s.slots[i].exercise), status: "converted" });

export const makeSlotWeighted = (s: WeightedSetup, i: number, loadLabel?: string): WeightedSetup =>
  withSlot(s, i, { exercise: toWeighted(s.slots[i].exercise, loadLabel), status: "converted" });

/** The Generate button activates (glows) only once every slot is resolved. */
export const canGenerate = (s: WeightedSetup): boolean =>
  s.slots.length > 0 && s.slots.every((slot) => slot.status !== "pending");

/** Produce the final exercise list (throws if not all slots resolved). */
export function generateSession(s: WeightedSetup): Prescription[] {
  if (!canGenerate(s)) throw new Error("Cannot generate: some exercises are still pending approval.");
  return s.slots.map((slot) => slot.exercise);
}

// ── Announcer script ───────────────────────────────────────────────────────

/**
 * Build the countdown announcer line, e.g.
 * "3, 2, 1. Stage 5: Jack Hanma. 1 workout. Muscle-ups, 1 of 5 sets, 20 reps! Ready — go!"
 */
export function announcerScript(args: {
  stageNumber: number;
  persona: string;
  exercises: ResolvedDose[];
  firstDose?: ResolvedDose;   // defaults to exercises[0]
}): string {
  const count = args.exercises.length;
  const first = args.firstDose ?? args.exercises[0];
  const workoutWord = count === 1 ? "workout" : "workouts";
  let doseText = "";
  if (first) {
    const dose = first.duration_sec != null
      ? `${first.duration_sec} seconds`
      : `${first.reps} reps`;
    doseText = ` ${first.name}, 1 of ${first.sets} sets, ${dose}!`;
  }
  return `3, 2, 1. Stage ${args.stageNumber}: ${args.persona}. ${count} ${workoutWord}.${doseText} Ready — go!`;
}

// ── Counting policy ────────────────────────────────────────────────────────

export interface CountPolicy {
  voiceCount: boolean;    // coach counts reps aloud
  onScreenCount: boolean; // the counter is always shown
  timedCompletion: boolean; // weighted: time-to-complete instead of rep count
}

/**
 * Bodyweight → rep-counted (voice unless toggled off; on-screen counter always).
 * Weighted → timed completion (the user presses COMPLETE; see adaptiveRest).
 */
export function countPolicy(ex: Prescription | ResolvedDose, voiceEnabled: boolean): CountPolicy {
  const weighted = ex.load_type === "weighted";
  const timed = weighted || ex.count_mode === "time";
  return {
    voiceCount: !timed && ex.count_mode !== "none" && voiceEnabled,
    onScreenCount: ex.count_mode !== "none",
    timedCompletion: weighted,
  };
}

// ── Adaptive rest (weighted) ───────────────────────────────────────────────

/**
 * Weighted set finished → how long to rest. Longer/heavier sets earn more rest.
 * Formula (tunable; flagged convention in the data): base on the time the set
 * took, plus a load bonus, clamped to a sane window and floored higher for the
 * big compound lower-body/pull lifts.
 */
export function adaptiveRest(args: {
  timeToCompleteSec: number;
  loadKg?: number;     // optional numeric load if the user entered kg
  category: Category;
  reps?: number;
}): number {
  const heavyCompound = args.category === "squat_legs" || args.category === "pull";
  const minRest = heavyCompound ? 90 : 60;
  const timeComponent = args.timeToCompleteSec * 1.5;
  const loadComponent = args.loadKg != null ? args.loadKg * 0.5 : 0;
  return Math.round(clamp(timeComponent + loadComponent, minRest, 240));
}

// ── Fight: canonical resolution + finisher selection ───────────────────────

export interface CanonicalEntry { drill?: string; round?: number; discipline: string; canonical: string; type?: string; }

/** Resolve a thematic drill (or round index) to its canonical discipline/move. */
export function resolveCanonical(
  map: CanonicalEntry[],
  key: string | number,
): CanonicalEntry | null {
  if (typeof key === "number") return map.find((m) => m.round === key) ?? null;
  const k = key.toLowerCase();
  return map.find((m) => (m.drill ?? "").toLowerCase().includes(k)) ?? null;
}

export interface FinisherSpec {
  movements: string[];
  placement: string;
  sets: number;
  work_sec: number;
  difficulty_scaled?: boolean;
  counts_toward_plyo_cap?: boolean;
}
export interface ResolvedFinisher { movement: string; sets: number; work_sec: number; placement: string; countsPlyo: boolean; }

/**
 * Pick + scale a finisher. Movement chosen deterministically by a caller index
 * (no RNG). Difficulty scales work seconds (easy 0.75 / hard 1.25) when flagged.
 */
export function pickFinisher(spec: FinisherSpec, difficulty: Difficulty, index = 0): ResolvedFinisher | null {
  if (!spec.movements.length) return null;
  const movement = spec.movements[((index % spec.movements.length) + spec.movements.length) % spec.movements.length];
  const f = spec.difficulty_scaled ? TUNED_FACTOR[difficulty] : 1;
  return {
    movement,
    sets: spec.sets,
    work_sec: Math.max(10, Math.round(spec.work_sec * f)),
    placement: spec.placement,
    countsPlyo: spec.counts_toward_plyo_cap === true,
  };
}

// ── Fight: combo_spec -> generator parameters ──────────────────────────────

export type ComboComplexity = "single" | "intro" | "basic" | "standard" | "advanced" | "burst";

/** The per-round seed the campaign data carries (rounds[].combo_spec). */
export interface ComboSpec {
  generate_combos: boolean;
  focus: string;
  allowed_strikes?: string[];
  allowed_defense?: string[];
  complexity?: ComboComplexity;
  phantom?: boolean;
  technique_cues?: string[];
  emphasis?: string;
  capped?: boolean;
  /**
   * A grappling/stance round that still opens with real strikes: the round
   * generates combos AND keeps its technique cues, so the player alternates a
   * strike entry with the cue instead of running a whole round with no combos
   * called.
   */
  mixed_with_cue?: boolean;
}

/** What the app's Combo Coach / Fight Focus generator consumes. */
export interface ComboParams {
  mode: "generate" | "cues";
  minLen: number;            // strikes per generated combo
  maxLen: number;
  allowedStrikes: string[];
  allowedDefense: string[];
  phantom: boolean;
  cues: string[];            // technique cues (mode "cues", or mixed rounds)
  emphasis?: string;
  capped: boolean;
  /** Generate combos, but interleave them with the round's technique cues. */
  mixedWithCue: boolean;
}

const COMPLEXITY_BANDS: Record<ComboComplexity, [number, number]> = {
  single: [1, 1], intro: [1, 2], basic: [2, 3], standard: [2, 4], advanced: [3, 5], burst: [3, 6],
};

/** Default boxing vocabulary when a round doesn't restrict it. */
const DEFAULT_STRIKES = ["1", "2", "3", "4", "5", "6", "2b", "3b"];

/**
 * Resolve a round's combo_spec + difficulty into generator parameters — the
 * seed the app's EXISTING Combo Coach / Fight Focus generator consumes, so
 * arcade fight rounds generate combos exactly like those modes. Difficulty
 * shifts the max combo length (easy -1, hard +1), never below the min and
 * capped at 8; "single" stays a single strike at every difficulty.
 */
export function resolveComboParams(spec: ComboSpec, difficulty: Difficulty): ComboParams {
  if (!spec.generate_combos) {
    return {
      mode: "cues", minLen: 0, maxLen: 0,
      allowedStrikes: [], allowedDefense: [],
      phantom: spec.phantom === true,
      cues: spec.technique_cues ?? [],
      emphasis: spec.emphasis, capped: spec.capped === true,
      mixedWithCue: false,
    };
  }
  const [min, baseMax] = COMPLEXITY_BANDS[spec.complexity ?? "standard"];
  const shift = difficulty === "easy" ? -1 : difficulty === "hard" ? 1 : 0;
  const maxLen = spec.complexity === "single" ? 1 : clamp(baseMax + shift, min, 8);
  return {
    mode: "generate", minLen: min, maxLen,
    allowedStrikes: spec.allowed_strikes?.length ? spec.allowed_strikes : DEFAULT_STRIKES,
    allowedDefense: spec.allowed_defense ?? [],
    phantom: spec.phantom === true,
    cues: spec.technique_cues ?? [],
    emphasis: spec.emphasis, capped: spec.capped === true,
    mixedWithCue: spec.mixed_with_cue === true,
  };
}

// ── BOTH: shared plyo foot-contact budget ──────────────────────────────────

/**
 * When a stage runs as BOTH, fit explosive + fight finishers share the plyo
 * foot-contact cap. Returns how many contacts the fit explosive block may keep
 * after the fight finisher has spent its share, and whether a trim was needed.
 */
export function sharedPlyoBudget(args: {
  cap: number;
  fightFinisherContacts: number;
  fitExplosiveContacts: number;
}): { fitAllowed: number; trimmed: boolean; totalIfUntrimmed: number } {
  const remaining = Math.max(0, args.cap - args.fightFinisherContacts);
  const fitAllowed = Math.min(args.fitExplosiveContacts, remaining);
  return {
    fitAllowed,
    trimmed: fitAllowed < args.fitExplosiveContacts,
    totalIfUntrimmed: args.fightFinisherContacts + args.fitExplosiveContacts,
  };
}
