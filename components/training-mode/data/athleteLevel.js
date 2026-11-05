// The athlete's level, read for training: which difficulty a workout should
// start on. One pure module, so the Quick Mission page, the Fit hub, Home,
// Combo Coach and the Level page all say the same thing about the same athlete.
//
// The rule (the owner's, confirmed):
//   effective XP = the side's own XP in full + every other XP at half
//   level        = getLevel(effective XP)      (the app's own level maths)
//   tier         = level 1-2 EASY, 3-5 NORMAL, 6-9 HARD, 10 and up ADVANCED
// A Fit feature (Fit Mode, Quick Mission, Cardio, Coach's Tapes fit) reads the
// 'fit' side, a Fight feature (Fight Focus, Combo Coach, Practice, Coach's
// Tapes fight) the 'fight' side. So Fit progress counts most for a Fit
// workout, and the other side still counts, at half.
//
// Which side a session row belongs to is tiers.sessionMode, the same bucket
// the Level page and the tier ladder use. Rows that are on neither side
// ('cc' Combat Conditioning, 'camp' Training Camp, 'bonus' award rows and any
// unknown type) are 'other', so they count at half for both sides. XP that
// has no session row (a combo bonus, a chase result) is other too: the total
// is stats.xp, the side's own XP is the sum of its rows, and the rest is half.
//
// Pure and deterministic: no storage, no clock, no randomness of its own (the
// surprise roll takes the random number as an argument). Tolerant of whatever
// is in storage: null stats, NaN, negative or huge XP, a missing sessions list,
// rows that are not objects and unknown session types all give a sensible
// answer (level 1, EASY, at worst).
import { getLevel, getLevelProgress } from './userStats';
import { sessionMode } from './tiers';
import { COMBO_MIX } from './comboMix';

export const SIDES = ['fit', 'fight'];
// What a side's own XP and everyone else's XP weigh. Half is the owner's rule.
export const OWN_WEIGHT = 1;
export const OTHER_WEIGHT = 0.5;
// Beyond this the numbers are not real any more (levelStory.js uses the same).
const MAX_XP = 1e12;

// The four tiers, easiest first. These are the stored ids: the Quick Mission
// generator and its saved keys already use EASY / NORMAL / HARD, and NORMAL is
// the word MEDIUM on screen (quickMissionConfig QM_LEVEL_WORD).
export const TIERS = ['EASY', 'NORMAL', 'HARD', 'ADVANCED'];
// The word Quick Mission prints for each tier (the owner's words): NORMAL reads
// MEDIUM. Combo Coach prints Easy, Normal, Hard, Advanced. One table, read by
// the Quick Mission page (QM_LEVEL_WORD), the Level page and the content kit.
export const QUICK_MISSION_WORD = { EASY: 'EASY', NORMAL: 'MEDIUM', HARD: 'HARD', ADVANCED: 'ADVANCED' };
// The first level of each tier above EASY.
export const TIER_START_LEVEL = { EASY: 1, NORMAL: 3, HARD: 6, ADVANCED: 10 };
export const XP_PER_LEVEL = getLevelProgress(0).needed;

const finite = (n) => (typeof n === 'number' ? n : Number(n));
const xpOf = (n) => { const v = finite(n); return Number.isFinite(v) && v > 0 ? Math.min(v, MAX_XP) : 0; };
const sideOf = (side) => (side === 'fight' ? 'fight' : 'fit');

// ── the XP ──────────────────────────────────────────────────────────────────
// { total, fit, fight, other } in whole XP. total is stats.xp (the bank);
// fit and fight are the sums of their own rows; other is everything else
// (never negative, and total = fit + fight + other unless the rows add up to
// more than the bank, in which case the sides are scaled down to fit it).
export function xpBySide(stats) {
  const total = xpOf(stats?.xp);
  let fit = 0, fight = 0;
  for (const s of Array.isArray(stats?.sessions) ? stats.sessions : []) {
    if (!s || typeof s !== 'object') continue;
    const mode = sessionMode(s);
    if (mode === 'fit') fit += xpOf(s.xpEarned);
    else if (mode === 'fight') fight += xpOf(s.xpEarned);
  }
  // More in the rows than in the bank (a penalty, or a hand-edited store): the
  // bank wins, and the sides keep their share of it.
  const rows = fit + fight;
  if (rows > total) {
    const k = rows > 0 ? total / rows : 0;
    fit *= k; fight *= k;
  }
  return { total, fit, fight, other: Math.max(0, total - fit - fight) };
}

// The XP that counts for this side: its own in full, everything else at half.
export function effectiveXp(stats, side = 'fit') {
  const x = xpBySide(stats);
  const own = x[sideOf(side)];
  return own * OWN_WEIGHT + (x.total - own) * OTHER_WEIGHT;
}

export function athleteLevel(stats, side = 'fit') {
  return getLevel(effectiveXp(stats, side));
}

// ── level → tier ────────────────────────────────────────────────────────────
export function tierForLevel(level) {
  const n = Number.isFinite(Number(level)) ? Math.floor(Number(level)) : 1;
  let tier = 'EASY';
  for (const t of TIERS) if (n >= TIER_START_LEVEL[t]) tier = t;
  return tier;
}
// Any stored form ('Normal', 'normal', 'MEDIUM', 'Advanced') as a tier id, or
// null for anything that is not one. MEDIUM is the screen's word for NORMAL.
export function normalizeTier(t) {
  const w = String(t ?? '').trim().toUpperCase();
  if (w === 'MEDIUM') return 'NORMAL';
  return TIERS.includes(w) ? w : null;
}
export const tierIndex = (t) => Math.max(0, TIERS.indexOf(normalizeTier(t) || 'EASY'));

// The tier this athlete's workouts start on, for the Fit side or the Fight
// side. { side, xp (effective), level, tier, index }.
export function athleteStart(stats, side = 'fit') {
  const s = sideOf(side);
  const xp = effectiveXp(stats, s);
  const level = getLevel(xp);
  const tier = tierForLevel(level);
  return { side: s, xp, level, tier, index: TIERS.indexOf(tier) };
}
export const athleteTier = (stats, side = 'fit') => athleteStart(stats, side).tier;

// ── surprise ────────────────────────────────────────────────────────────────
// SURPRISE ME rolls one step either side of the athlete's start: never below
// EASY, never more than one above the start, so a level 1-2 athlete only ever
// gets EASY or NORMAL. Easiest first. A start that is not a tier reads as EASY.
export function surpriseTiers(start) {
  const i = tierIndex(start);
  return TIERS.slice(Math.max(0, i - 1), Math.min(TIERS.length, i + 2));
}
// One roll from that range. `rand` is a function returning [0, 1), so a test
// (or a seeded caller) is deterministic; Math.random is only the default.
// `not` skips one tier (the one on screen) so a roll always changes something;
// with only one tier in the range it is ignored.
export function rollSurpriseTier(start, { rand = Math.random, not = null } = {}) {
  const all = surpriseTiers(start);
  const skip = normalizeTier(not);
  const pool = skip && all.length > 1 ? all.filter(t => t !== skip) : all;
  const r = Number(rand());
  const k = Number.isFinite(r) ? Math.min(pool.length - 1, Math.max(0, Math.floor(r * pool.length))) : 0;
  return pool[k];
}

// ── what the next tier is ───────────────────────────────────────────────────
// { tier, level, levelsAway } for the next tier above this level, or null at
// the top. For the Level page's "what the next tier unlocks".
export function nextTierAfter(level) {
  const n = Number.isFinite(Number(level)) ? Math.max(1, Math.floor(Number(level))) : 1;
  const i = TIERS.indexOf(tierForLevel(n));
  if (i >= TIERS.length - 1) return null;
  const tier = TIERS[i + 1];
  return { tier, level: TIER_START_LEVEL[tier], levelsAway: TIER_START_LEVEL[tier] - n };
}
// The levels a tier covers: { from, to } with `to` null for the open top tier.
export function tierLevels(tier) {
  const i = tierIndex(tier);
  const t = TIERS[i];
  const next = TIERS[i + 1];
  return { from: TIER_START_LEVEL[t], to: next ? TIER_START_LEVEL[next] - 1 : null };
}

// ── per-tier rules ──────────────────────────────────────────────────────────
// What each tier means in the app, in one table the Level page reads. Quick
// Mission needs nothing beyond the tier itself: its generator tables are keyed
// by it. Combo Coach's mix (which combos each tier is dealt: single strikes and
// short combos for EASY, longer combos with a few difficult kicks for NORMAL,
// mostly hard for HARD, a swing from single strikes to the hardest combos for
// ADVANCED) lives in data/comboMix, the same table the dealer reads; the Fight
// side's tier from athleteStart(stats, 'fight') picks the row.
export const TIER_RULES = Object.fromEntries(TIERS.map(t => [t, { tier: t, combo: COMBO_MIX[t] }]));
