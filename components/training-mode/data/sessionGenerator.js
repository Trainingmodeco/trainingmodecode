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
