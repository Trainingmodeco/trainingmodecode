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
};

// Display order for the saga carousel.
export const CAMPAIGN_ORDER = ['ARC_BAKI', 'ARC_DARKKNIGHT', 'ARC_BERSERK', 'ARC_ULTRAINSTINCT', 'ARC_ULTRAEGO'];

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

  // fit — a conditioning circuit; keep the module's own round timing. Difficulty
  // scaling adjusts sets/reps/rest inside the block, surfaced as a note, not the
  // round count. Exercises drive the goal list when no per-round goal exists.
  const rounds = Math.max(1, modRounds.length || 1);
  const roundSec = modRounds[0]?.length_sec || 1200;
  const restSec = modRounds[0]?.rest_sec ?? 0;
  const fitGoals = goals.length ? goals : (mod.exercises || []).slice(0, 6);
  return { rounds, roundSec, restSec, goals: fitGoals.length ? fitGoals : ['conditioning_round'], durationMin: mod.duration_min };
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
