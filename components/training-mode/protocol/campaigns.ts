// Phase 2 · 2.10 — ARCADE v2 content binding.
// The five original campaigns (staged in protocol-src, mirrored into ./data/
// campaigns) become themed skins over the SAME camp engine. This module is the
// data foundation (slice 1): it loads every campaign + its stages + modules and
// exposes resolvers the stage-select UI (slice 2) and the runner (slice 3) read
// from. No component imports campaign JSON directly. Difficulty timing reuses the
// campaign's own difficulty_scaling; round goals come from the module.
import bakiCampaign from './data/campaigns/ARC_BAKI/campaign.json';
import bakiStages from './data/campaigns/ARC_BAKI/stages.json';
import bakiModules from './data/campaigns/ARC_BAKI/modules.json';
import berserkCampaign from './data/campaigns/ARC_BERSERK/campaign.json';
import berserkStages from './data/campaigns/ARC_BERSERK/stages.json';
import berserkModules from './data/campaigns/ARC_BERSERK/modules.json';
import darkknightCampaign from './data/campaigns/ARC_DARKKNIGHT/campaign.json';
import darkknightStages from './data/campaigns/ARC_DARKKNIGHT/stages.json';
import darkknightModules from './data/campaigns/ARC_DARKKNIGHT/modules.json';
import ultraegoCampaign from './data/campaigns/ARC_ULTRAEGO/campaign.json';
import ultraegoStages from './data/campaigns/ARC_ULTRAEGO/stages.json';
import ultraegoModules from './data/campaigns/ARC_ULTRAEGO/modules.json';
import ultrainstinctCampaign from './data/campaigns/ARC_ULTRAINSTINCT/campaign.json';
import ultrainstinctStages from './data/campaigns/ARC_ULTRAINSTINCT/stages.json';
import ultrainstinctModules from './data/campaigns/ARC_ULTRAINSTINCT/modules.json';
import gravityCampaign from './data/campaigns/ARC_GRAVITY/campaign.json';
import gravityStages from './data/campaigns/ARC_GRAVITY/stages.json';
import gravityModules from './data/campaigns/ARC_GRAVITY/modules.json';
import sonicCampaign from './data/campaigns/ARC_SONIC/campaign.json';
import sonicStages from './data/campaigns/ARC_SONIC/stages.json';
import sonicModules from './data/campaigns/ARC_SONIC/modules.json';
import garouCampaign from './data/campaigns/ARC_GAROU/campaign.json';
import garouStages from './data/campaigns/ARC_GAROU/stages.json';
import garouModules from './data/campaigns/ARC_GAROU/modules.json';
import { humanizeGoal } from './content';
import { resolveComboParams } from './engine/arcade-session-engine';

export type ArcadePath = 'fit' | 'fight' | 'full_arc';
export type ArcadeDifficulty = 'easy' | 'normal' | 'hard';

// JSON widens literals to string; the Node smoke test guards the real shapes.
interface Raw { campaign: any; stages: any[]; modules: any[]; }

const asArr = (x: any): any[] => (Array.isArray(x) ? x : x?.stages || x?.modules || []);

const RAW: Record<string, Raw> = {
  ARC_BAKI:          { campaign: bakiCampaign,          stages: asArr(bakiStages),          modules: asArr(bakiModules) },
  ARC_BERSERK:       { campaign: berserkCampaign,       stages: asArr(berserkStages),       modules: asArr(berserkModules) },
  ARC_DARKKNIGHT:    { campaign: darkknightCampaign,    stages: asArr(darkknightStages),    modules: asArr(darkknightModules) },
  ARC_ULTRAEGO:      { campaign: ultraegoCampaign,      stages: asArr(ultraegoStages),      modules: asArr(ultraegoModules) },
  ARC_ULTRAINSTINCT: { campaign: ultrainstinctCampaign, stages: asArr(ultrainstinctStages), modules: asArr(ultrainstinctModules) },
  ARC_GRAVITY:       { campaign: gravityCampaign,       stages: asArr(gravityStages),       modules: asArr(gravityModules) },
  ARC_SONIC:         { campaign: sonicCampaign,         stages: asArr(sonicStages),         modules: asArr(sonicModules) },
  ARC_GAROU:         { campaign: garouCampaign,         stages: asArr(garouStages),         modules: asArr(garouModules) },
};

// Display order for the saga carousel.
export const CAMPAIGN_ORDER = ['ARC_BAKI', 'ARC_DARKKNIGHT', 'ARC_BERSERK', 'ARC_ULTRAINSTINCT', 'ARC_ULTRAEGO', 'ARC_GAROU', 'ARC_GRAVITY', 'ARC_SONIC'];

// 2.10 — franchise-flavored coach lines per campaign (archetype-safe, original —
// never reproduces trademarked characters/quotes). Rotated across the rounds so
// each drill carries the campaign's identity; the underlying exercises stay real.
const CAMPAIGN_COACH: Record<string, { fit: string[]; fight: string[] }> = {
  ARC_BAKI: {
    fit: ['Own your bodyweight — brace the core.', 'Train like a human, chase the monster.', 'Iron core. Control every rep.'],
    fight: ['Read the phantom — counter it.', 'Shadow-fight your strongest self.', 'Relaxed power. Flow into the strike.'],
  },
  ARC_DARKKNIGHT: {
    fit: ['Train in the dark. Master your body.', 'No shortcuts — forge every rep.', 'Peak human is built, not born.'],
    fight: ['Control the fight. Never panic.', 'Precise, silent, decisive.', 'Read, counter, reset.'],
  },
  ARC_BERSERK: {
    fit: ['Struggle forward — one more rep.', 'Heavy work builds a heavy blade.', 'Endure. Swing through the fatigue.'],
    fight: ['Relentless pressure — keep advancing.', 'Every swing carries your whole body.', 'Never stop moving forward.'],
  },
  ARC_ULTRAEGO: {
    fit: ['Embrace the strain — grow from it.', 'Pride fuels the last rep.', 'The harder it gets, the stronger you get.'],
    fight: ['Take the hit, return it doubled.', 'Rising power under pressure.', 'Dominate the exchange.'],
  },
  ARC_ULTRAINSTINCT: {
    fit: ['Move before you think — stay loose.', 'Flow: smooth, relaxed, precise.', 'Let the body lead.'],
    fight: ['React, don’t decide — pure flow.', 'Slip, counter, flow onward.', 'Calm mind, instant hands.'],
  },
  ARC_GRAVITY: {
    fit: ['Control the tension — breathe through it.', 'Slow it down. Own every inch of the rep.', 'Hold to the target, then release. Never grind.', 'Keep breathing — never hold your breath.'],
    fight: ['Control the tension — breathe through it.', 'Slow, steady, deliberate.', 'Breathe. Stay in control.'],
  },
  ARC_SONIC: {
    fit: ['Gotta go fast — but keep your form.', 'Quick feet, light on the ground.', 'Explode, then recover. Repeat.', 'Speed is earned rep by rep.'],
    fight: ['Fast hands, faster feet.', 'Blitz the round — then reset.', 'Explosive and precise.'],
  },
  ARC_GAROU: {
    fit: ['Build the engine — legs drive the punch.', 'Lean, fast, relentless.', 'Evolve rep by rep — no shortcuts.'],
    fight: ['Learn the style. Steal its speed.', 'Fast hands — stay loose, stay sharp.', 'Every round, a new lesson.'],
  },
};

const mid = (v: any, fallback = 0): number => {
  if (Array.isArray(v)) return Math.round((Number(v[0]) + Number(v[1])) / 2);
  return Number.isFinite(Number(v)) ? Number(v) : fallback;
};

// ── Campaign metadata (for the saga list / header) ──────────────────────────
export interface ArcadeCampaignMeta {
  id: string;
  name: string;
  type: string;
  tagline: string;
  paths: ArcadePath[];
  difficulties: ArcadeDifficulty[];
  stageCount: number;
  splitStages: number[];
}

export const arcadeCampaigns: ArcadeCampaignMeta[] = CAMPAIGN_ORDER
  .filter((id) => RAW[id])
  .map((id) => {
    const c = RAW[id].campaign;
    return {
      id,
      name: c.name || id,
      type: c.type || 'fit_fight',
      tagline: c.tagline || '',
      paths: (c.paths_available || ['fit', 'fight', 'full_arc']) as ArcadePath[],
      difficulties: (c.difficulties || ['easy', 'normal', 'hard']) as ArcadeDifficulty[],
      stageCount: c.stage_count || RAW[id].stages.length,
      splitStages: c.split_stages || [],
    };
  });

export function getCampaign(campaignId: string): any | null {
  return RAW[campaignId]?.campaign || null;
}
export function campaignStages(campaignId: string): any[] {
  return (RAW[campaignId]?.stages || []).slice().sort((a, b) => (a.stage_number || 0) - (b.stage_number || 0));
}
export function arcadeStage(campaignId: string, stageId: string): any | null {
  return (RAW[campaignId]?.stages || []).find((s) => s.stage_id === stageId) || null;
}
export function arcadeModuleById(campaignId: string, moduleId: string): any | null {
  return (RAW[campaignId]?.modules || []).find((m) => m.module_id === moduleId) || null;
}

// The module backing a stage's path (fit | fight). Stages list module_ids per
// path; we take the first (campaigns author one module per path per stage).
export function stageModule(campaignId: string, stageId: string, path: 'fit' | 'fight'): any | null {
  const stage = arcadeStage(campaignId, stageId);
  const ids = stage?.paths?.[path]?.module_ids || [];
  return ids.length ? arcadeModuleById(campaignId, ids[0]) : null;
}

// Which formats a stage offers (fit / fight / full arc / split).
export function stageFormats(campaignId: string, stageId: string) {
  const s = arcadeStage(campaignId, stageId) || {};
  return {
    fit: s.fit_available !== false,
    fight: s.fight_available !== false,
    fullArc: s.full_arc_available === true,
    split: s.split_available === true,
    defaultFormat: s.default_format || 'full',
  };
}

// ── Boss finale — the universal final-stage experience ──────────────────────
// Every campaign's final boss runs the same scripted finale REGARDLESS of the
// authored module rounds (which the campaign-wide difficulty_scaling used to
// truncate anyway): FIGHT is a 9-round gauntlet (fight focus → combo coach →
// MMA rounds → a closing circuit) with per-round disciplines, lengths, and
// rush surges; FIT is a 12-round full-body burnout (~30 min) with rest scaled
// to each movement's severity. Round entries carry `length_sec` / `rest_sec` /
// `rush` overrides the camp runners honor per-round.
export function isFinalBoss(campaignId: string, stageId: string): boolean {
  const s = arcadeStage(campaignId, stageId);
  return !!s && (s.boss === true || s.phase === 'final_boss');
}

const BOSS_POOLS: Record<string, string[]> = {
  boxing: ['Jab', 'Cross', 'Lead hook', 'Rear hook', 'Lead uppercut', 'Rear uppercut', 'Body jab', 'Body cross'],
  kickboxing: ['Jab', 'Cross', 'Lead hook', 'Low kick', 'Head kick', 'Switch kick', 'Front kick', 'Rear hook'],
  muay_thai: ['Jab', 'Cross', 'Elbow', 'Rear elbow', 'Knee', 'Switch knee', 'Teep', 'Low kick', 'Head kick'],
  // Dutch style — boxing combinations that end in kicks.
  dutch: ['Jab', 'Cross', 'Lead hook', 'Rear hook', 'Body hook', 'Low kick', 'Head kick'],
  mma: ['Jab', 'Cross', 'Level change', 'Sprawl', 'Elbow', 'Knee', 'Overhand', 'Low kick'],
};

// Deterministic per (seed, i) like buildComboCalls, so re-renders never
// reshuffle. `pShare` = share of calls drawn from the primary pool (the rest
// come from `secondary` — the MMA-specific pool on the mixed rounds).
function bossCalls(primary: string[], secondary: string[] | null, pShare: number, seed: number, count = 12): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const pool = !secondary || ((seed * 7 + i * 13) % 10) < pShare * 10 ? primary : secondary;
    const len = 2 + ((i + seed) % 3);
    const parts: string[] = [];
    for (let j = 0; j < len; j++) parts.push(pool[(seed * 5 + i * 3 + j * (2 + (i % 2))) % pool.length]);
    out.push(parts.join(', '));
  }
  return out;
}

// The 5-minutes-of-hell closer: called on the same cadence as combos, each
// call is the next movement to grind.
const BOSS_CIRCUIT_CALLS = [
  'Burpees — go', 'Mountain climbers — go', 'Jump squats — go', 'Sprawls — go',
  'Tuck jumps — go', 'Push-ups — max reps', 'Jumping lunges — go', 'High knees — sprint',
  'Plank jacks — go', 'Squat hold — breathe',
];

export function bossFightBlockRounds(): any[] {
  return [
    { round_title: 'Fight Focus · Boxing', coach_prompt: 'Sharp boxing. The surge hits at the end — empty it.', length_sec: 180, rest_sec: 30, rush: { pattern: 'end10' }, combos: bossCalls(BOSS_POOLS.boxing, null, 1, 1) },
    { round_title: 'Fight Focus · Kickboxing', coach_prompt: 'Add the legs. Twenty-second surge to close.', length_sec: 180, rest_sec: 30, rush: { pattern: 'end20' }, combos: bossCalls(BOSS_POOLS.kickboxing, null, 1, 2) },
    { round_title: 'Fight Focus · Muay Thai', coach_prompt: 'Elbows and knees. Thirty seconds of hell at the bell.', length_sec: 180, rest_sec: 30, rush: { pattern: 'end30' }, combos: bossCalls(BOSS_POOLS.muay_thai, null, 1, 3) },
    { round_title: 'Combo Coach · Boxing', coach_prompt: 'React to every call. Surge to finish.', length_sec: 180, rest_sec: 30, rush: { pattern: 'end20' }, combos: bossCalls(BOSS_POOLS.boxing, null, 1, 4, 14) },
    { round_title: 'Combo Coach · Kickboxing', coach_prompt: 'Every minute ends in a ten-second rush. Stay ready.', length_sec: 180, rest_sec: 30, rush: { pattern: 'perMin10' }, combos: bossCalls(BOSS_POOLS.kickboxing, null, 1, 5, 14) },
    { round_title: 'MMA Round 1 · Muay Thai Edge', coach_prompt: 'Five minutes. Clinch weapons lead — surges come at random.', length_sec: 300, rest_sec: 30, rush: { pattern: 'random' }, combos: bossCalls(BOSS_POOLS.muay_thai, BOSS_POOLS.mma, 0.6, 6, 16) },
    { round_title: 'MMA Round 2 · Boxing Edge', coach_prompt: 'Hands lead this one. Random surges — answer every alarm.', length_sec: 300, rest_sec: 30, rush: { pattern: 'random' }, combos: bossCalls(BOSS_POOLS.boxing, BOSS_POOLS.mma, 0.6, 7, 16) },
    { round_title: 'MMA Round 3 · Dutch Edge', coach_prompt: 'Dutch pace — combinations into kicks. Random surges to the end.', length_sec: 300, rest_sec: 30, rush: { pattern: 'random' }, combos: bossCalls(BOSS_POOLS.dutch, BOSS_POOLS.mma, 0.6, 8, 16) },
    { round_title: 'Final Circuit · 5 Minutes of Hell', coach_prompt: 'No strikes left. Bodyweight to the final bell.', length_sec: 300, rest_sec: 0, combos: BOSS_CIRCUIT_CALLS },
  ];
}

// FIT finale — 12 energy-zapping full-body rounds. Rest scales with each
// movement's severity (heavy 45s · moderate 35s · light 25s); work scales
// with difficulty. ~30 minutes at normal.
const BOSS_FIT_MOVES: { title: string; cue: string; severity: 'heavy' | 'moderate' | 'light' }[] = [
  { title: 'Burpee Tuck Jumps', cue: 'Chest to floor, explode to the tuck. To burnout.', severity: 'heavy' },
  { title: 'Mountain Climbers', cue: 'Sprint the floor. Hips low, knees driving.', severity: 'moderate' },
  { title: 'Jump Squats', cue: 'Land soft, load, explode again.', severity: 'moderate' },
  { title: 'Push-Up Burnout', cue: 'Max clean reps. Drop to knees before form breaks.', severity: 'heavy' },
  { title: 'Jumping Lunges', cue: 'Switch in the air. Knees track the toes.', severity: 'moderate' },
  { title: 'Sprawls', cue: 'Hips down hard, spring back to your feet.', severity: 'moderate' },
  { title: 'High-Rep Squat Burnout', cue: 'Full depth, no lockout rest. Keep moving.', severity: 'heavy' },
  { title: 'Plank Jacks', cue: 'Core braced — feet fly, hips stay quiet.', severity: 'light' },
  { title: 'Skater Bounds', cue: 'Stick each landing before the next bound.', severity: 'moderate' },
  { title: 'Star Jumps', cue: 'Full extension every rep.', severity: 'light' },
  { title: 'Up-Downs', cue: 'Chest down, drive up. Grind it out.', severity: 'moderate' },
  { title: 'Final Burnout · Burpees to the Bell', cue: 'Everything you have left. See you at the bell.', severity: 'heavy' },
];
const BOSS_REST: Record<string, number> = { heavy: 45, moderate: 35, light: 25 };

export function bossFitBlockRounds(difficulty: ArcadeDifficulty): any[] {
  const workSec = difficulty === 'easy' ? 95 : difficulty === 'hard' ? 125 : 110;
  return BOSS_FIT_MOVES.map((m, i) => ({
    round_title: m.title,
    coach_prompt: m.cue,
    length_sec: workSec,
    // The last round ends the session — no trailing rest.
    rest_sec: i === BOSS_FIT_MOVES.length - 1 ? 0 : BOSS_REST[m.severity],
  }));
}

// ── Runner bridge — round plan for a stage's path at a difficulty ────────────
// Reuses the campaign's difficulty_scaling for timing (fight rounds/length/rest;
// fit keeps its circuit rounds) and the module's per-round goals for titles. The
// slice-3 runner turns this into the same cfg shape the camp timers consume.
export interface ArcadeRoundPlan {
  rounds: number;
  roundSec: number;
  restSec: number;
  goals: string[];
  durationMin?: number;
  activeMinutesTarget?: number;
}

export function resolveArcadeRounds(campaignId: string, stageId: string, path: 'fit' | 'fight', difficulty: ArcadeDifficulty): ArcadeRoundPlan | null {
  // Final boss — the universal scripted finale replaces the module plan (the
  // campaign-wide scaling used to flatten the boss to 5–7 generic rounds).
  if (isFinalBoss(campaignId, stageId)) {
    if (path === 'fight') {
      const script = bossFightBlockRounds();
      return { rounds: script.length, roundSec: 180, restSec: 30, goals: script.map((r) => r.round_title), durationMin: 39 };
    }
    const script = bossFitBlockRounds(difficulty);
    return { rounds: script.length, roundSec: script[0].length_sec, restSec: 35, goals: script.map((r) => r.round_title), durationMin: 30 };
  }
  const mod = stageModule(campaignId, stageId, path);
  if (!mod) return null;
  const camp = getCampaign(campaignId);
  const scale = camp?.difficulty_scaling?.[difficulty];
  const modRounds = Array.isArray(mod.rounds) ? mod.rounds : [];
  const goals = modRounds.map((r: any) => r.goal).filter(Boolean);

  if (path === 'fight') {
    const fs = scale?.fight;
    const rounds = fs?.rounds != null ? mid(fs.rounds, modRounds.length || 5) : (modRounds.length || 5);
    const roundSec = fs?.round_sec != null ? mid(fs.round_sec, modRounds[0]?.length_sec || 120) : (modRounds[0]?.length_sec || 120);
    const restSec = fs?.rest_sec != null ? mid(fs.rest_sec, modRounds[0]?.rest_sec ?? 45) : (modRounds[0]?.rest_sec ?? 45);
    return { rounds: Math.max(1, rounds), roundSec, restSec, goals: goals.length ? goals : ['free_round'], durationMin: mod.duration_min };
  }

  // fit — surface each authored exercise as its OWN timed work round, so the
  // conditioning session cycles real named drills instead of one long generic
  // circuit. Per-exercise work time is the block duration split across the
  // exercises, clamped to a sane 2–4 min; rest scales with difficulty.
  // Arcade session standard (specs/27): fit modules carry a counted
  // `prescription` (sets x reps/sec per movement) instead of a plain exercises
  // list. Surface each prescribed movement with its dose as the round title;
  // legacy modules (Gravity/Sonic keep their own models) still use exercises.
  const rx = Array.isArray(mod.prescription) ? mod.prescription : [];
  const ex = rx.length
    ? rx.map((p: any) => {
        const dose = p.duration_sec != null ? `${p.sets}×${p.duration_sec}s` : `${p.sets}×${p.reps}`;
        return p.name ? `${p.name} — ${dose}` : '';
      }).filter(Boolean)
    : (mod.exercises || []).filter(Boolean);
  if (ex.length > 1) {
    const totalSec = (mod.duration_min ? mod.duration_min * 60 : (modRounds[0]?.length_sec || 1500));
    let roundSec = Math.round((totalSec / ex.length) / 5) * 5;
    roundSec = Math.max(120, Math.min(240, roundSec));
    const restSec = difficulty === 'hard' ? 30 : difficulty === 'easy' ? 60 : 45;
    return { rounds: ex.length, roundSec, restSec, goals: ex, durationMin: mod.duration_min };
  }
  // fallback — a single circuit (module has no exercise list)
  const rounds = Math.max(1, modRounds.length || 1);
  const roundSec = modRounds[0]?.length_sec || 1200;
  const restSec = modRounds[0]?.rest_sec ?? 0;
  const fitGoals = goals.length ? goals : ex.slice(0, 6);
  return { rounds, roundSec, restSec, goals: fitGoals.length ? fitGoals : ['conditioning_round'], durationMin: mod.duration_min };
}

// ── Arcade combo calling (specs/27 · PROMPT B1.5) ───────────────────────────
// Each fight round's combo_spec seeds the SAME numbered vocabulary Combo Coach
// uses; here we pre-render a deterministic call list per round so the fight
// timer voices real combos ("Jab, Cross… Slip Left, Cross, Body Hook") during
// the round instead of only announcing the focus. Cue-based rounds (grappling /
// stance / footwork) call their technique cues on the same cadence.
const STRIKE_NAMES: Record<string, string> = {
  '1': 'Jab', '2': 'Cross', '3': 'Lead Hook', '4': 'Rear Hook',
  '5': 'Lead Uppercut', '6': 'Rear Uppercut', 'oh': 'Overhand',
  'lk': 'Low Kick', 'rk': 'Roundhouse Kick', 'tp': 'Teep', 'kn': 'Knee', 'el': 'Elbow',
};
const DEFENSE_NAMES: Record<string, string> = {
  'slip-left': 'Slip Left', 'slip-right': 'Slip Right', 'roll': 'Roll', 'check': 'Check',
};
const strikeName = (t: string) =>
  STRIKE_NAMES[t] || (t.endsWith('b') && STRIKE_NAMES[t.slice(0, -1)] ? `Body ${STRIKE_NAMES[t.slice(0, -1)]}` : t);

// Focus saturation (Baki playtest feedback): ~60% of calls drill the round's
// focus purely; ~40% mix in other strikes of the discipline (hooks, uppercuts,
// body shots — kicks in kick disciplines) plus occasional head movement, so a
// jab-cross round stays a jab-cross round without becoming monotonous.
// "single" complexity (one-perfect-strike drills) stays 100% focus.
const SECONDARY_STRIKES: Record<string, string[]> = {
  boxing: ['3', '4', '5', '6', '2b', '3b'],
  mma: ['3', '4', '5', '6', '2b', '3b'],
  kickboxing: ['3', '4', '5', '6', '2b', 'lk', 'rk'],
  muay_thai: ['3', '4', '5', '6', 'lk', 'kn', 'el'],
};
const HEAD_MOVEMENT = ['slip-left', 'slip-right', 'roll'];

function buildComboCalls(spec: any, difficulty: ArcadeDifficulty, roundSeed: number, discipline = 'boxing', count = 10): string[] {
  const p = resolveComboParams(spec, difficulty === 'easy' ? 'easy' : difficulty === 'hard' ? 'hard' : 'normal');
  if (p.mode === 'cues') return p.cues || [];
  const focus = p.allowedStrikes;
  if (!focus.length) return [];
  const single = spec?.complexity === 'single';
  const secondaries = (SECONDARY_STRIKES[discipline] || SECONDARY_STRIKES.boxing).filter((s) => !focus.includes(s));
  const mixedPool = focus.concat(secondaries);
  const span = Math.max(1, p.maxLen - p.minLen + 1);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // 2 of every 5 calls are "mixed" (~40%) — never on single-strike drills.
    const mixed = !single && secondaries.length > 0 && (i % 5 === 2 || i % 5 === 4);
    const len = p.minLen + ((i + roundSeed) % span);
    const parts: string[] = [];
    for (let j = 0; j < len; j++) {
      // Mixed calls still LEAD with a focus strike, then draw from the wider pool.
      const src = mixed && j > 0 ? mixedPool : focus;
      parts.push(strikeName(src[(roundSeed * 3 + i * 2 + j * (1 + (i % 3))) % src.length]));
    }
    // Head movement sprinkled in: explicit defense rounds keep their cadence;
    // otherwise some mixed calls open with a slip/roll.
    if (p.allowedDefense.length && i % 3 === 2) {
      parts.unshift(DEFENSE_NAMES[p.allowedDefense[(i + roundSeed) % p.allowedDefense.length]] || 'Slip');
    } else if (mixed && i % 5 === 4 && !single) {
      parts.unshift(DEFENSE_NAMES[HEAD_MOVEMENT[(i + roundSeed) % HEAD_MOVEMENT.length]]);
    }
    out.push(parts.join(', '));
  }
  // Mixed rounds (strike entry into clinch/ground work) alternate a generated
  // combo with the round's technique cue, so a grappling round still gets
  // combos called instead of running cue-only.
  if (p.mixedWithCue && p.cues.length) {
    return out.map((call, i) => (i % 3 === 2 ? p.cues[Math.floor(i / 3) % p.cues.length] : call));
  }
  return out;
}

// ── Runner cfg — the camp timers consume this shape (slice 3 handoff) ────────
// Turns a stage+path+difficulty into the same cfg FightFocusTimer / CampFitRunner
// read (rounds, roundMin, restSec, blockRounds), so arcade reuses the camp engine.
export function arcadeBlockRounds(campaignId: string, stageId: string, path: 'fit' | 'fight', difficulty: ArcadeDifficulty) {
  // Final boss — hand the runners the scripted finale directly (per-round
  // length_sec / rest_sec / rush overrides included).
  if (isFinalBoss(campaignId, stageId)) {
    return path === 'fight' ? bossFightBlockRounds() : bossFitBlockRounds(difficulty);
  }
  const plan = resolveArcadeRounds(campaignId, stageId, path, difficulty);
  if (!plan) return [];
  const goals = plan.goals.length ? plan.goals : [path === 'fit' ? 'conditioning_round' : 'free_round'];
  const fallback = path === 'fit' ? ['Move with intent. Control your breathing.'] : ['Sharp technique. Reset your stance.'];
  const cues = CAMPAIGN_COACH[campaignId]?.[path === 'fit' ? 'fit' : 'fight'] || fallback;
  const mod = path === 'fight' ? stageModule(campaignId, stageId, 'fight') : null;
  const modRounds = Array.isArray(mod?.rounds) ? mod.rounds : [];
  return Array.from({ length: Math.max(1, plan.rounds) }, (_, i) => {
    const entry: any = {
      round_title: humanizeGoal(goals[i % goals.length]),
      coach_prompt: cues[i % cues.length],
    };
    const spec = modRounds.length ? modRounds[i % modRounds.length]?.combo_spec : null;
    if (spec) {
      const calls = buildComboCalls(spec, difficulty, i, mod?.discipline || 'boxing');
      if (calls.length) entry.combos = calls;
      if (spec.emphasis) entry.coach_prompt = spec.emphasis;
    }
    return entry;
  });
}

export function arcadeCfg(campaignId: string, stageId: string, path: 'fit' | 'fight', difficulty: ArcadeDifficulty) {
  const plan = resolveArcadeRounds(campaignId, stageId, path, difficulty);
  if (!plan) return null;
  const boss = isFinalBoss(campaignId, stageId);
  return {
    difficulty,
    rounds: plan.rounds,
    roundMin: plan.roundSec / 60,
    restSec: plan.restSec,
    voiceOn: true,
    encouragement: 'normal',
    rushMode: false,
    // Boss finale: the script drives per-round rush; surges call movements AND
    // strikes. The flag also tells App.jsx to skip the prescription/finisher
    // layers — the finale is already the whole test.
    ...(boss ? { bossFinale: true, rushMix: 'both' } : {}),
    warmupMin: 3,
    blockRounds: arcadeBlockRounds(campaignId, stageId, path, difficulty),
  };
}

// Merged gear→substitution map for a stage's path(s) — feeds the gear check.
export function arcadeSubs(campaignId: string, stageId: string, paths: ('fit' | 'fight')[]): Record<string, string> {
  return paths.reduce((acc, p) => {
    const mod = stageModule(campaignId, stageId, p);
    return { ...acc, ...(mod?.substitutions || {}) };
  }, {} as Record<string, string>);
}

// Stage equipment (for the stage-select chips): required / recommended + swaps.
export function stageEquipment(campaignId: string, stageId: string) {
  const s = arcadeStage(campaignId, stageId) || {};
  const e = s.equipment || {};
  return {
    required: e.required || [],
    recommended: e.recommended || [],
    alternatives: e.alternatives || {},
  };
}
