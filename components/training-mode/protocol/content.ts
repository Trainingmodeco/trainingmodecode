// Phase 2 · 2.0 — protocol content binding.
// Loads the v2 protocol JSON (specs 10 + 11) and binds it to the pure engine so
// screens never pass content around by hand. Adding a camp / archetype / module
// = editing the JSON in ./data, never touching a component. The JSON is the
// design source of truth (mirrors protocol-src/); the engine is pure.
import archetypesData from './data/archetypes.json';
import campLevelsData from './data/camp-levels.json';
import timingTablesData from './data/timing-tables.json';
import xpRulesData from './data/xp-rules.json';
import passRulesData from './data/pass-rules.json';
import readinessData from './data/readiness.json';
import equipmentData from './data/equipment.json';
import disciplinesData from './data/disciplines.json';
import achievementsData from './data/achievements.json';
import uiCopyData from './data/ui-copy.json';
import workoutModulesData from './data/workout-modules.json';

import {
  resolveRoundTemplate,
  evaluateSession,
  calcXp,
  assessReadiness,
  getArchetypes,
  getCampLevel,
  splitAvailable,
} from './engine/trainingEngine';
import type {
  Archetype,
  CampLevel,
  TimingTables,
  XpRuleset,
  PassRules,
  Discipline,
  Difficulty,
  RoundTemplate,
  Evaluation,
  SessionResult,
  XpInput,
  SessionOutcome,
  ReadinessAnswers,
  ReadinessVerdict,
} from './engine/trainingEngine';

// JSON widens string literals to `string`, so cast through `unknown` to the
// engine's precise types. The Node smoke test is what actually guards the shapes.
export const archetypes = archetypesData as unknown as Archetype[];
export const campLevels = campLevelsData as unknown as CampLevel[];
export const timingTables = timingTablesData as unknown as TimingTables;
export const xpRuleset = (xpRulesData as { XP_STANDARD: XpRuleset }).XP_STANDARD;
export const passRules = passRulesData as unknown as PassRules;
export const uiCopy = uiCopyData;
export const disciplines = disciplinesData;
export const equipment = equipmentData;
export const achievements = achievementsData;
export const readinessConfig = readinessData;

// ── Bound helpers ──────────────────────────────────────────────────────────
// Every camp/arcade timer derives from here — never hardcode round counts.
export function roundTemplate(discipline: Discipline, level: number, difficulty: Difficulty): RoundTemplate {
  return resolveRoundTemplate(discipline, level, difficulty, timingTables, campLevels);
}
export function archetypesFor(discipline: Discipline): Archetype[] {
  return getArchetypes(archetypes, discipline);
}
export function campLevel(level: number): CampLevel {
  return getCampLevel(campLevels, level);
}
export function isSplitAvailable(level: number): boolean {
  return splitAvailable(campLevels, level);
}
export function evaluate(result: SessionResult, difficulty: Difficulty): Evaluation {
  return evaluateSession(result, difficulty, passRules);
}
export function xpFor(input: XpInput): number {
  return calcXp(input, xpRuleset);
}

// Phase 2 · 2.8 — real XP for a camp block, from the xp-rules ruleset.
// XP = active_minutes × base(10) × difficulty × completion, plus optional
// quality bonuses. Active minutes = rounds actually completed × round length.
// Outcome is derived from completion + the 1.6 anti-cheat gate (invalid →
// validation_failed → 0 XP, so the gate is preserved). The ruleset guarantees a
// clean Easy pass out-earns a repeated Hard fail. When 2.7 lands, pass an
// explicit `outcome` from evaluateSession instead of deriving it here.
export function campSessionXp(opts: {
  difficulty: Difficulty;
  roundMin: number;        // length of ONE round, in minutes
  doneRounds: number;      // rounds actually completed
  totalRounds: number;     // rounds prescribed
  valid: boolean;          // passed the 1.6 anti-cheat gate
  outcome?: SessionOutcome; // override (e.g. from 2.7 evaluateSession)
  fullArc?: boolean;        // FULL CAMP both-block completion
  cleanTechnique?: boolean;
  weeklyNoDrop?: boolean;
}): number {
  const activeMinutes = Math.max(0, opts.doneRounds) * Math.max(0, opts.roundMin);
  let outcome: SessionOutcome;
  if (opts.outcome) outcome = opts.outcome;
  else if (!opts.valid) outcome = 'validation_failed';
  else if (opts.doneRounds >= opts.totalRounds) outcome = 'pass';
  else if (opts.doneRounds >= opts.totalRounds * 0.5) outcome = 'partial';
  else outcome = 'fail';
  return xpFor({
    activeMinutes,
    difficulty: opts.difficulty,
    outcome,
    fullArc: opts.fullArc,
    cleanTechnique: opts.cleanTechnique,
    weeklyNoDropBonus: opts.weeklyNoDrop,
  });
}
export function readiness(answers: ReadinessAnswers): ReadinessVerdict {
  return assessReadiness(answers);
}

// ── 2.4b — camp block content (fit-vs-fight per mission) ─────────────────────
// Real per-mission content: authored workout-modules win; otherwise fall back
// to the level's own combat_emphasis (skill) / physical_emphasis (conditioning)
// so every discipline & level has distinct S1/S2 content today, and the fight-
// mode chat's modules slot in over the fallback as they land.
export type CampSlot = 'fight' | 'fit';
interface WorkoutModule {
  module_id: string;
  module_type: CampSlot;
  discipline: string;
  phase: string;
  difficulty: string;
  duration_min?: number;
  warmup?: string[];
  rounds: { goal: string }[];
  substitutions?: Record<string, string>;
}
export const workoutModules = workoutModulesData as unknown as WorkoutModule[];

export function humanizeGoal(goal: string): string {
  return String(goal || '').split('_').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function campModule(discipline: Discipline, level: number, difficulty: Difficulty, slot: CampSlot): WorkoutModule | null {
  const phase = campLevels.find((l) => l.level === level)?.phase;
  const wantDisc = slot === 'fit' ? 'multi' : discipline;
  const pool = workoutModules.filter((m) => m.module_type === slot && m.discipline === wantDisc && m.phase === phase);
  if (!pool.length) return null;
  return pool.find((m) => m.difficulty === difficulty) || pool[0];
}

export interface CampBlock {
  goals: string[];
  warmup: string[];
  gear: string[];
  durationMin?: number;
  source: 'module' | 'emphasis';
}
export function campBlock(discipline: Discipline, level: number, difficulty: Difficulty, slot: CampSlot): CampBlock {
  const lvl = campLevels.find((l) => l.level === level);
  const mod = campModule(discipline, level, difficulty, slot);
  const goals = mod ? mod.rounds.map((r) => r.goal)
    : (slot === 'fit' ? (lvl?.physical_emphasis || []) : (lvl?.combat_emphasis || []));
  return {
    goals,
    warmup: mod?.warmup || [],
    gear: mod ? Object.keys(mod.substitutions || {}) : [],
    durationMin: mod?.duration_min,
    source: mod ? 'module' : 'emphasis',
  };
}

// Per-round {round_title, coach_prompt} to feed the shared round timer — cycles
// the block's goal pool across the engine-driven round count.
export function blockRoundsFor(discipline: Discipline, level: number, difficulty: Difficulty, slot: CampSlot, roundCount: number) {
  const { goals } = campBlock(discipline, level, difficulty, slot);
  const pool = goals.length ? goals : [slot === 'fit' ? 'conditioning_round' : 'free_round'];
  const cue = slot === 'fit' ? 'Move with intent. Control your breathing.' : 'Sharp technique. Reset your stance.';
  return Array.from({ length: Math.max(1, roundCount) }, (_, i) => ({
    round_title: humanizeGoal(pool[i % pool.length]),
    coach_prompt: cue,
  }));
}

export type { Discipline, Difficulty, CampLevel, Archetype, RoundTemplate };
