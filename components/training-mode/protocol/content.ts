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
export function readiness(answers: ReadinessAnswers): ReadinessVerdict {
  return assessReadiness(answers);
}

export type { Discipline, Difficulty, CampLevel, Archetype, RoundTemplate };
