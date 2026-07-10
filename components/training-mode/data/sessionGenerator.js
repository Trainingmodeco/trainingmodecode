import FIGHT_FOCUS_POOL from './fightFocusData';
import COMBO_POOL, { SINGLE_STRIKES } from './comboCoachData';

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

  console.log("Fight Focus Generated:", {
    discipline,
    difficulty,
    rounds,
    poolSize: eligible.length,
    historyKey,
    selectedFocuses: selected.map(f => f.title),
  });

  return selected.map(f => ({
    round_title: f.title,
    coach_prompt: f.coachingCue,
    description: f.description,
    session_type: 'Technical',
  }));
}

// TECHNICAL mode (beginner-friendly): mostly single strikes + short basic
// combos (~65%), with a minority of longer combos (~35%). Immediate repeats
// (e.g. "Jab, Jab") are intentional — it drills clean reps.
function buildTechnicalComboList(discipline, difficulty) {
  const disc = normalizeDiscipline(discipline);
  const singles = SINGLE_STRIKES[disc] || SINGLE_STRIKES.boxing;
  const eligible = filterPool(COMBO_POOL, discipline, difficulty);
  const basics = eligible.filter(c => c.category === 'basic' || c.category === 'single').map(c => c.comboText);
  const combos = eligible.filter(c => ['combination', 'counter', 'advanced', 'elite'].includes(c.category)).map(c => c.comboText);
  const basicsPool = basics.length ? basics : singles;
  const combosPool = combos.length ? combos : basicsPool;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const N = 80;
  const out = [];
  for (let i = 0; i < N; i++) {
    const r = Math.random();
    if (r < 0.45) out.push(pick(singles));         // ~45% single strikes
    else if (r < 0.65) out.push(pick(basicsPool));  // ~20% short basic combos
    else out.push(pick(combosPool));                // ~35% combos
  }
  return out;
}

export function generateComboCoachSession({ discipline, difficulty, speed, rounds, roundDuration, mode }) {
  if (String(mode).toLowerCase() === 'technical') {
    return buildTechnicalComboList(discipline, difficulty);
  }
  const eligible = filterPool(COMBO_POOL, discipline, difficulty);
  if (eligible.length === 0) {
    const fallback = COMBO_POOL.filter(c => c.discipline === normalizeDiscipline(discipline));
    const pool = fallback.length > 0 ? fallback : COMBO_POOL.slice(0, 30);
    return shuffle(pool).map(c => c.comboText);
  }

  const historyKey = lruKey('tm_cc_recent', discipline, difficulty);
  const comboOrder = preventBackToBack(lruOrderAll(eligible, historyKey));

  // Append first 20 combo IDs to history.
  appendToLruHistory(historyKey, comboOrder.slice(0, 20).map(c => c.id), eligible.length);

  console.log("Combo Coach Generated:", {
    discipline,
    difficulty,
    speed,
    poolSize: eligible.length,
    historyKey,
    selectedCombos: comboOrder.slice(0, 10).map(c => c.comboText),
  });

  return comboOrder.map(c => c.comboText);
}
