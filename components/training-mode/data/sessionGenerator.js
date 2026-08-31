import FIGHT_FOCUS_POOL from './fightFocusData';
import COMBO_POOL, { SINGLE_STRIKES, ADVANCED_STRIKES } from './comboCoachData';
import { filterCombosToArsenal } from './arsenal';

const DIFFICULTY_LEVELS = ['easy', 'normal', 'hard', 'advanced'];

function normalizeDiscipline(d) {
  const map = {
    'Boxing': 'boxing',
    'Kickboxing': 'kickboxing',
    'Muay Thai': 'muay-thai',
    'MMA': 'mma',
  };
  return map[d] || d.toLowerCase().replace(/\s+/g, '-');
}

function normalizeDifficulty(d) {
  const map = { 'Easy': 'easy', 'Normal': 'normal', 'Intermediate': 'normal', 'Hard': 'hard', 'Advanced': 'advanced' };
  return map[d] || 'normal';
}

function getDifficultyThreshold(diff) {
  const idx = DIFFICULTY_LEVELS.indexOf(diff);
  return idx >= 0 ? idx : 1;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- LRU History (per discipline+difficulty) ---

function lruKey(prefix, discipline, difficulty) {
  const disc = normalizeDiscipline(discipline);
  const diff = normalizeDifficulty(difficulty);
  return `${prefix}::${disc}::${diff}`;
}

function loadLruHistory(key) {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function saveLruHistory(key, ids, maxSize) {
  if (typeof localStorage === 'undefined') return;
  try {
    const trimmed = ids.slice(-maxSize);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

function appendToLruHistory(key, newIds, poolSize) {
  const maxSize = poolSize * 2;
  const existing = loadLruHistory(key);
  const merged = [...existing, ...newIds].slice(-maxSize);
  saveLruHistory(key, merged, maxSize);
}

// Rank items by LRU: never-used first, then oldest-used first.
// Shuffle within equal-recency groups for randomness.
function lruRank(eligible, historyIds) {
  const positionMap = new Map();
  historyIds.forEach((id, idx) => {
    positionMap.set(id, idx);
  });

  // Group by recency bucket: -1 = never used, otherwise position in history
  // (lower = older = should surface sooner).
  const neverUsed = [];
  const usedItems = [];

  for (const item of eligible) {
    if (!positionMap.has(item.id)) {
      neverUsed.push(item);
    } else {
      usedItems.push({ item, pos: positionMap.get(item.id) });
    }
  }

  // Sort used items by position ascending (oldest first).
  usedItems.sort((a, b) => a.pos - b.pos);

  // Group used items by position for shuffle within same recency.
  const groups = [];
  let currentGroup = [];
  let currentPos = -1;

  for (const entry of usedItems) {
    if (entry.pos !== currentPos) {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [entry.item];
      currentPos = entry.pos;
    } else {
      currentGroup.push(entry.item);
    }
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Build final ranked list: shuffled never-used, then shuffled groups oldest-first.
  const ranked = shuffle(neverUsed);
  for (const group of groups) {
    ranked.push(...shuffle(group));
  }

  return ranked;
}

// Select `count` items via LRU ranking. Hard rule: never return the exact same
// set AND order as the immediately previous session for the same key.
function lruSelect(eligible, count, historyKey) {
  const history = loadLruHistory(historyKey);
  const ranked = lruRank(eligible, history);

  const selected = [];
  const usedIds = new Set();

  for (const item of ranked) {
    if (selected.length >= count) break;
    if (!usedIds.has(item.id)) {
      selected.push(item);
      usedIds.add(item.id);
    }
  }

  // Fill if ranked didn't have enough unique items (shouldn't happen, but safety).
  if (selected.length < count) {
    for (const item of shuffle(eligible)) {
      if (selected.length >= count) break;
      if (!usedIds.has(item.id)) {
        selected.push(item);
        usedIds.add(item.id);
      }
    }
  }

  // Hard rule: if identical set AND order to last session, force different order.
  const lastSessionIds = history.slice(-count);
  const selectedIds = selected.map(s => s.id);
  if (selectedIds.length === lastSessionIds.length &&
      selectedIds.every((id, i) => id === lastSessionIds[i])) {
    const reshuffled = shuffle(selected);
    // Ensure at least one position differs.
    if (reshuffled.every((item, i) => item.id === selected[i].id)) {
      // Force swap first two if shuffle didn't change order.
      if (reshuffled.length >= 2) {
        [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
      }
    }
    return reshuffled;
  }

  return selected;
}

// LRU-order the full pool (for Combo Coach which returns all eligible items).
function lruOrderAll(eligible, historyKey) {
  const history = loadLruHistory(historyKey);
  const ranked = lruRank(eligible, history);

  // Hard rule: if identical set AND order to last session, force different order.
  const lastSessionIds = history.slice(-Math.min(20, ranked.length));
  const rankedIds = ranked.slice(0, lastSessionIds.length).map(r => r.id);
  if (rankedIds.length === lastSessionIds.length &&
      rankedIds.every((id, i) => id === lastSessionIds[i])) {
    const reshuffled = shuffle(ranked);
    if (reshuffled.length >= 2 && reshuffled.every((item, i) => item.id === ranked[i].id)) {
      [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
    }
    return reshuffled;
  }

  return ranked;
}

function filterPool(pool, discipline, difficulty) {
  const disc = normalizeDiscipline(discipline);
  const diff = normalizeDifficulty(difficulty);
  const threshold = getDifficultyThreshold(diff);
  return pool.filter(item => {
    if (item.discipline !== disc) return false;
    const itemLevel = getDifficultyThreshold(item.minDifficulty);
    return itemLevel <= threshold;
  });
}

function preventBackToBack(items) {
  if (items.length <= 1) return items;
  const result = [items[0]];
  const remaining = items.slice(1);

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].id !== result[result.length - 1].id) {
      result.push(remaining[i]);
    } else {
      const swapIdx = remaining.findIndex((r, j) => j > i && r.id !== result[result.length - 1].id);
      if (swapIdx >= 0) {
        [remaining[i], remaining[swapIdx]] = [remaining[swapIdx], remaining[i]];
        result.push(remaining[i]);
      } else {
        result.push(remaining[i]);
      }
    }
  }
  return result;
}

export function generateFightFocusSession({ discipline, difficulty, rounds }) {
  const eligible = filterPool(FIGHT_FOCUS_POOL, discipline, difficulty);
  if (eligible.length === 0) {
    const fallback = FIGHT_FOCUS_POOL.filter(f => f.discipline === normalizeDiscipline(discipline));
    const pool = fallback.length > 0 ? fallback : FIGHT_FOCUS_POOL.slice(0, 20);
    const shuffled = shuffle(pool);
    return shuffled.slice(0, rounds).map(f => ({
      round_title: f.title,
      coach_prompt: f.coachingCue,
      description: f.description,
      session_type: 'Technical',
    }));
  }

  const historyKey = lruKey('tm_ff_recent', discipline, difficulty);
  const selected = lruSelect(eligible, rounds, historyKey);

  // Append picked IDs to history.
  appendToLruHistory(historyKey, selected.map(f => f.id), eligible.length);

  
  return selected.map(f => ({
    round_title: f.title,
    coach_prompt: f.coachingCue,
    description: f.description,
    session_type: 'Technical',
  }));
}

// TECHNICAL mode: mostly single strikes + basic combos, scaling with difficulty.
// Easy is nearly all base singles + a few basic combos; higher difficulties fold
// in advanced single strikes (spinning kicks, bolo punch…) and longer/advanced
// combos for a more fight-paced feel. Immediate repeats ("Jab, Jab") are
// intentional — it drills clean reps.
const TECH_WEIGHTS = {
  //          base  advStrike  basic  normal  adv
  easy:     { base: 0.72, advStrike: 0.00, basic: 0.28, normal: 0.00, adv: 0.00 },
  normal:   { base: 0.54, advStrike: 0.03, basic: 0.10, normal: 0.33, adv: 0.00 },
  hard:     { base: 0.32, advStrike: 0.15, basic: 0.11, normal: 0.22, adv: 0.20 },
  advanced: { base: 0.22, advStrike: 0.20, basic: 0.08, normal: 0.22, adv: 0.28 },
};

function buildTechnicalComboList(discipline, difficulty) {
  const disc = normalizeDiscipline(discipline);
  const singles = SINGLE_STRIKES[disc] || SINGLE_STRIKES.boxing;
  const advStrikes = ADVANCED_STRIKES[disc] || ADVANCED_STRIKES.boxing;
  const all = COMBO_POOL.filter(c => c.discipline === disc);
  const basics = all.filter(c => c.category === 'basic' || c.category === 'single').map(c => c.comboText);
  const normals = all.filter(c => ['combination', 'counter'].includes(c.category)).map(c => c.comboText);
  const advs = all.filter(c => ['advanced', 'elite'].includes(c.category)).map(c => c.comboText);

  const W = TECH_WEIGHTS[normalizeDifficulty(difficulty)] || TECH_WEIGHTS.normal;
  const buckets = [
    { pool: singles, w: W.base },
    { pool: advStrikes, w: W.advStrike },
    { pool: basics.length ? basics : singles, w: W.basic },
    { pool: normals.length ? normals : (basics.length ? basics : singles), w: W.normal },
    { pool: advs.length ? advs : (normals.length ? normals : singles), w: W.adv },
  ].filter(b => b.w > 0 && b.pool.length);
  const total = buckets.reduce((s, b) => s + b.w, 0) || 1;

  const N = 80;
  const out = [];
  for (let i = 0; i < N; i++) {
    let r = Math.random() * total;
    let chosen = buckets[0];
    for (const b of buckets) { if (r < b.w) { chosen = b; break; } r -= b.w; }
    out.push(chosen.pool[Math.floor(Math.random() * chosen.pool.length)]);
  }
  return out;
}

export function generateComboCoachSession({ discipline, difficulty, speed, rounds, roundDuration, mode, arsenalOnly, arsenal, customCombos }) {
  // 1.3b — if the fighter picked their own saved combos, drill exactly those
  // (shuffled so back-to-back rounds feel fresh). Overrides difficulty/mode
  // selection since the athlete chose the content directly.
  if (Array.isArray(customCombos) && customCombos.length > 0) {
    return shuffle([...customCombos]);
  }
  // 1.2 — beginners drill only strikes they've learned in Practice (never empty).
  const gate = (list) => (arsenalOnly ? filterCombosToArsenal(list, arsenal) : list);
  if (String(mode).toLowerCase() === 'technical') {
    return gate(buildTechnicalComboList(discipline, difficulty));
  }
  const eligible = filterPool(COMBO_POOL, discipline, difficulty);
  if (eligible.length === 0) {
    const fallback = COMBO_POOL.filter(c => c.discipline === normalizeDiscipline(discipline));
    const pool = fallback.length > 0 ? fallback : COMBO_POOL.slice(0, 30);
    return gate(shuffle(pool).map(c => c.comboText));
  }

  const historyKey = lruKey('tm_cc_recent', discipline, difficulty);
  const comboOrder = preventBackToBack(lruOrderAll(eligible, historyKey));

  // Append first 20 combo IDs to history.
  appendToLruHistory(historyKey, comboOrder.slice(0, 20).map(c => c.id), eligible.length);

  return gate(comboOrder.map(c => c.comboText));
}

/**
 * Combo Coach session content, planned PER ROUND so no two rounds repeat the
 * same order. Wraps generateComboCoachSession (which still supplies the
 * eligible content, LRU ordering, arsenal gating and custom/technical modes)
 * and adds tier buckets + the anti-repeat deck.
 *
 * @returns {{ plans: string[][], all: string[] }}
 */
export function generateComboCoachRoundPlans(opts = {}) {
  const {
    discipline, difficulty, rounds = 3, callsPerRound = 40, secondsPerCall = 5, seed,
  } = opts;
  const all = generateComboCoachSession(opts) || [];
  if (!all.length) return { plans: Array.from({ length: rounds }, () => []), all };

  // Tier buckets, keyed by comboText so they survive the string-only pool the
  // player consumes. Custom/technical/fallback content has no tier metadata —
  // it lands in `all` only, and the planner falls back to the full deck.
  const disc = normalizeDiscipline(discipline);
  const tierOf = new Map();
  for (const item of COMBO_POOL) {
    if (item.discipline === disc) tierOf.set(item.comboText, item.minDifficulty);
  }
  const byTier = {};
  for (const text of all) {
    const tier = tierOf.get(text);
    if (!tier) continue;
    (byTier[tier] = byTier[tier] || []).push(text);
  }

  const plans = planComboRounds({
    byTier, all, difficulty: normalizeDifficulty(difficulty),
    rounds, callsPerRound, secondsPerCall, seed,
  });
  return { plans, all };
}

// ── Per-round call planning (anti-repeat) ──────────────────────────────────
//
// WHY THIS EXISTS. Combo Coach used to build ONE ordered pool per session and
// walk it with `pool[i % pool.length]`. That is a fixed cycle: with ~36-40
// calls in a 3-minute round and 38 eligible combos at Advanced, a single
// round consumes almost exactly one lap, so every later round replayed the
// SAME combos in the SAME order. Five rounds felt like one round on loop.
//
// The fix is a per-round DECK: each round gets its own shuffle, combos are
// drawn without replacement so nothing repeats until the deck is exhausted,
// the deck reshuffles when empty (never repeating across the seam), and each
// round starts from a different seed. Repetition can't be abolished — 5×36
// calls over 38 combos means everything appears ~4-5 times — but it is now
// spread as far apart as the content allows instead of cycling on a timer.

// Small seeded RNG (mulberry32) so a plan is reproducible and testable.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A draw-without-replacement deck. Reshuffles when exhausted and never deals
 * the same item twice in a row across that seam.
 */
function makeDeck(items, rng) {
  let rest = shuffleWith(items, rng);
  let last = null;
  return (avoid) => {
    if (!items.length) return null;
    if (!rest.length) {
      rest = shuffleWith(items, rng);
      if (items.length > 1 && rest[0] === last) rest.push(rest.shift());
    }
    // Prefer a card that isn't in the caller's recent window. Small tier
    // buckets (hard has only ~6 combos) otherwise reshuffle fast enough to
    // land the same combo two calls apart, which reads as a repeat even
    // though the deck technically dealt fairly.
    let idx = 0;
    if (avoid && avoid.size) {
      const free = rest.findIndex((c) => !avoid.has(c));
      if (free >= 0) idx = free;
    }
    last = rest.splice(idx, 1)[0];
    return last;
  };
}

// Advanced rounds are built as a RAMP, per the owner's spec: a short easy
// opening, a normal stretch, a longer hard block, then the rest advanced —
// still jumping between tiers, but weighted to advanced. Band lengths are in
// SECONDS and jittered per round so no two rounds share a shape.
const ADVANCED_BANDS = [
  { tier: 'easy',   min: 20, max: 30 },
  { tier: 'normal', min: 25, max: 35 },
  { tier: 'hard',   min: 50, max: 70 },
];
// The tail: mostly advanced, with occasional jumps back down so the round
// keeps mixing rather than flattening into one tier.
const TAIL_MIX = [
  ['advanced', 0.65], ['hard', 0.20], ['normal', 0.10], ['easy', 0.05],
];

function pickWeighted(mix, rng) {
  let r = rng();
  for (const [tier, w] of mix) { r -= w; if (r <= 0) return tier; }
  return mix[mix.length - 1][0];
}

/**
 * Plan the calls for ONE round.
 * @param {object} o
 * @param {Record<string,string[]>} o.byTier  comboText[] bucketed by tier
 * @param {string[]} o.all                    every eligible comboText
 * @param {string} o.difficulty               easy|normal|hard|advanced
 * @param {number} o.callCount                how many calls this round needs
 * @param {number} o.secondsPerCall           used to convert bands → calls
 * @param {function} o.rng
 * @param {object} o.decks                    shared decks (session-scoped)
 * @returns {string[]}
 */
function planRound({ byTier, all, difficulty, callCount, secondsPerCall, rng, decks }) {
  const out = [];
  // Rolling window of what was just called, so no combo comes back within a
  // few calls of itself. Sized to the content available — a tiny pool cannot
  // support a long window without starving.
  //
  // The cap and the guarantee are the same number plus one: a window of N
  // means the soonest a combo can return is N+1 calls later. PROMPT CC-1
  // asks for a worst repeat gap of >= 12 on ADVANCED, so the cap must be
  // >= 11. It was 6, which made 12 unreachable by construction - advanced
  // sessions measured a floor of exactly 7 (= 6+1) in all four disciplines,
  // ~20% of the time. The /4 scaling was already correct and still protects
  // small pools: easy (15 eligible) keeps 3, normal (30) gets 7, hard (46)
  // and advanced (68) get the full 11.
  const windowSize = Math.max(1, Math.min(11, Math.floor(all.length / 4)));
  const recent = new Set();
  const remember = (c) => {
    if (!c) return;
    out.push(c);
    recent.add(c);
    if (recent.size > windowSize) recent.delete(recent.values().next().value);
  };
  const drawFrom = (tier) => {
    const deck = decks[tier];
    // A tier with no content (or an empty band) falls back to the full set,
    // so a plan is never short and never stalls on a missing bucket.
    const v = deck ? deck(recent) : null;
    return v == null ? decks.all(recent) : v;
  };

  if (difficulty !== 'advanced') {
    for (let i = 0; i < callCount; i++) remember(decks.all(recent));
    return out.filter(Boolean);
  }

  // A band whose own tier is smaller than the band is long WILL repeat: the
  // hard bucket holds ~6 combos but a 60-second hard band wants ~12 calls, so
  // its deck reshuffles mid-band and the recent-window has nothing left to
  // prefer. Widen such a band upward (hard → hard+advanced) so it still
  // climbs in difficulty but has enough content to stay fresh.
  const widened = (tier, n) => {
    const own = byTier[tier] || [];
    if (own.length >= n) return null;
    const order = DIFFICULTY_LEVELS.slice(DIFFICULTY_LEVELS.indexOf(tier) + 1);
    let merged = [...own];
    for (const up of order) {
      merged = merged.concat(byTier[up] || []);
      if (merged.length >= n) break;
    }
    return merged.length > own.length ? merged : null;
  };

  for (const band of ADVANCED_BANDS) {
    const seconds = band.min + rng() * (band.max - band.min);
    const n = Math.max(1, Math.round(seconds / secondsPerCall));
    const wide = widened(band.tier, n);
    const bandDeck = wide ? makeDeck(wide, rng) : null;
    for (let i = 0; i < n && out.length < callCount; i++) {
      if (bandDeck) remember(bandDeck(recent));
      else remember((byTier[band.tier] || []).length ? drawFrom(band.tier) : decks.all(recent));
    }
  }
  while (out.length < callCount) {
    const tier = pickWeighted(TAIL_MIX, rng);
    remember((byTier[tier] || []).length ? drawFrom(tier) : decks.all(recent));
  }
  return out.filter(Boolean);
}

/**
 * Build one call list PER ROUND. Every round is shuffled independently, so no
 * two rounds share an order.
 * @returns {string[][]}
 */
export function planComboRounds({ byTier, all, difficulty, rounds, callsPerRound, secondsPerCall = 5, seed }) {
  const list = Array.isArray(all) ? all.filter(Boolean) : [];
  if (!list.length) return Array.from({ length: Math.max(1, rounds) }, () => []);
  const baseSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1e9);
  const plans = [];
  for (let r = 0; r < Math.max(1, rounds); r++) {
    // A per-round seed is what makes round 2 differ from round 1; the decks
    // are rebuilt per round too, so each round starts from a fresh shuffle.
    const rng = makeRng(baseSeed + r * 7919);
    const decks = { all: makeDeck(list, rng) };
    for (const tier of Object.keys(byTier || {})) {
      if ((byTier[tier] || []).length) decks[tier] = makeDeck(byTier[tier], rng);
    }
    plans.push(planRound({
      byTier: byTier || {}, all: list, difficulty, rng, decks,
      callCount: Math.max(1, callsPerRound), secondsPerCall,
    }));
  }
  return plans;
}
