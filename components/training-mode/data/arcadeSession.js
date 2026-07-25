// Arcade Session resolver — the app-facing bridge between the authored campaign
// module data (spec 27: prescription / combo_spec / finishers / canonical_map)
// and the pure engine (protocol/engine/arcade-session-engine.ts). It turns a
// stage's module into what the session PLAYER needs:
//   • FIT  → a COUNTED-SETS prescription (sets × reps/sec by tier + difficulty)
//            and a WEIGHTED review/generate setup.
//   • FIGHT→ per-round content: generated Combo-Coach combos for combo rounds,
//            technique cues for skill rounds (canonical-resolved).
//   • BOTH → the announcer "3,2,1 go" line + difficulty-scaled finishers.
import {
  resolvePrescription,
  initSetup,
  canGenerate,
  generateSession,
  announcerScript,
  countPolicy,
  pickFinisher,
  toBodyweight,
  toWeighted,
  adaptiveRest,
  resolveCanonical,
} from '../protocol/engine/arcade-session-engine';
import standards from '../protocol/data/arcade-session-standards.json';
import { getCampaign, campaignStages, stageModule, arcadeStage } from '../protocol/campaigns';
import { generateComboCoachSession } from './sessionGenerator';

const LADDER = { by_category: standards?.volume_ladder?.by_category || {} };
const LADDER_CATEGORIES = ['pull', 'push', 'squat_legs', 'core', 'hold', 'explosive'];

// ── Tier: prefer the authored module tier, else derive from stage position ────
export function stageTier(campaignId, stageId, mod) {
  const t = mod?.tier;
  if (typeof t === 'string' && /^T[1-4]$/.test(t)) return t;
  if (typeof t === 'number') return `T${Math.min(4, Math.max(1, t))}`;
  const stages = campaignStages(campaignId);
  const total = stages.length || 1;
  const idx = Math.max(0, stages.findIndex((s) => s.stage_id === stageId));
  const frac = (idx + 1) / total;
  if (frac <= 0.25) return 'T1';
  if (frac <= 0.6) return 'T2';
  if (frac < 1) return 'T3';
  return 'T4';
}

// ── FIT: resolve the counted prescription for a difficulty ────────────────────
export function usesPrescription(mod) {
  return !!mod && Array.isArray(mod.prescription) && mod.prescription.length > 0 && mod.session_model !== 'timed';
}
export function isWeightedModule(mod) {
  if (!mod) return false;
  if (mod.weighted_flow === true || mod.session_model === 'weighted') return true;
  return (mod.prescription || []).some((ex) => ex.load_type === 'weighted' || ex.load === 'user_entered');
}

export function resolveFitPrescription(campaignId, stageId, difficulty = 'normal') {
  const mod = stageModule(campaignId, stageId, 'fit');
  if (!mod || !usesPrescription(mod)) return null;
  const tier = stageTier(campaignId, stageId, mod);
  const exercises = mod.prescription.map((ex) => {
    const dose = resolvePrescription(ex, tier, difficulty, LADDER);
    return { ...dose, counted: LADDER_CATEGORIES.includes(dose.category), weighted: dose.load_type === 'weighted' };
  });
  return { tier, difficulty, title: mod.title || '', exercises, weighted: isWeightedModule(mod), module: mod };
}

// ── Weighted review/generate flow (engine-backed) ─────────────────────────────
export function initWeightedSetup(exercises) { return initSetup(exercises); }
export { canGenerate, generateSession, toBodyweight, toWeighted, adaptiveRest, countPolicy };

// ── Announcer "3,2,1 go" line ─────────────────────────────────────────────────
export function announcerLine(campaignId, stageId, difficulty, exercises) {
  const stages = campaignStages(campaignId);
  const stage = arcadeStage(campaignId, stageId);
  const stageNumber = stage?.stage_number || (stages.findIndex((s) => s.stage_id === stageId) + 1) || 1;
  const persona = stage?.persona || stage?.coach || getCampaign(campaignId)?.name || 'Coach';
  const list = exercises || resolveFitPrescription(campaignId, stageId, difficulty)?.exercises || [];
  if (!list.length) return '';
  return announcerScript({ stageNumber, persona, exercises: list });
}

// ── FIGHT: per-round content (combos for combo rounds, cues for skill rounds) ──
// combo_spec.generate_combos → generate Combo-Coach combos; otherwise use the
// authored technique_cues. Every drill resolves to a canonical discipline/move.
export function resolveFightRounds(campaignId, stageId, difficulty = 'normal') {
  const mod = stageModule(campaignId, stageId, 'fight');
  if (!mod) return null;
  const rounds = Array.isArray(mod.rounds) ? mod.rounds : [];
  const discipline = mod.discipline || 'boxing';
  const map = Array.isArray(mod.canonical_map) ? mod.canonical_map : [];
  // A shared combo pool for this discipline/difficulty; combo rounds draw from it.
  const comboPool = generateComboCoachSession({ discipline, difficulty, rounds: Math.max(6, rounds.length) }) || [];
  let comboIdx = 0;

  const out = rounds.map((r, i) => {
    const cs = r.combo_spec || {};
    const canon = resolveCanonical(map, r.goal || i + 1) || resolveCanonical(map, i + 1);
    if (cs.generate_combos) {
      const n = difficulty === 'hard' ? 3 : difficulty === 'easy' ? 1 : 2;
      const combos = [];
      for (let k = 0; k < n; k++) { combos.push(comboPool[comboIdx % comboPool.length]); comboIdx++; }
      return { index: r.index || i + 1, goal: r.goal, kind: 'combo', combos, callout: cs.callout || 'voiced', canonical: canon?.canonical };
    }
    return { index: r.index || i + 1, goal: r.goal, kind: 'technique', cues: cs.technique_cues || [], canonical: canon?.canonical };
  });
  return { discipline, rounds: out, module: mod };
}

// ── Finishers: difficulty-scaled bodyweight bursts (module-authored) ──────────
export function resolveFinishers(mod, difficulty = 'normal') {
  const spec = mod?.finishers;
  if (!spec || !Array.isArray(spec.movements) || !spec.movements.length) return [];
  const count = Math.max(1, spec.sets || 1);
  return Array.from({ length: count }, (_, i) => pickFinisher(spec, difficulty, i)).filter(Boolean);
}
export function stageFinishers(campaignId, stageId, path, difficulty = 'normal') {
  const mod = stageModule(campaignId, stageId, path);
  return resolveFinishers(mod, difficulty);
}

// Handy dose label for UI ("3 × 12" or "3 × 30s").
export function doseLabel(ex) {
  if (!ex) return '';
  return ex.duration_sec != null ? `${ex.sets} × ${ex.duration_sec}s` : `${ex.sets} × ${ex.reps}`;
}
