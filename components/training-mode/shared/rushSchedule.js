// Rush-mode scheduling. Given the active pattern and where we are in a round,
// decide whether the fighter should be "rushing" right now. Deterministic per
// (roundIndex, roundSec) so re-renders never reshuffle the random windows.

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random 5–10s surges spread across the round (non-overlapping, with breathers).
function randomWindows(roundSec, roundIndex) {
  const rng = mulberry32(1013 + roundIndex * 97 + Math.round(roundSec));
  const wins = [];
  let cursor = 5;
  const guardEnd = roundSec - 3;
  for (let i = 0; i < 8; i++) {
    const gap = 6 + Math.floor(rng() * 9);   // 6–14s breather
    const len = 5 + Math.floor(rng() * 6);   // 5–10s surge
    const start = cursor + gap;
    if (start + len > guardEnd) break;
    wins.push([start, start + len]);
    cursor = start + len;
  }
  return wins;
}

const cache = new Map();
function windowsFor(roundSec, roundIndex) {
  const key = `${roundIndex}:${roundSec}`;
  if (!cache.has(key)) cache.set(key, randomWindows(roundSec, roundIndex));
  return cache.get(key);
}

// pattern: 'random' | 'every10' | 'endRound'
export function isRushAt(pattern, elapsedSec, remainingSec, roundSec, roundIndex = 0) {
  if (elapsedSec < 1) return false;
  if (pattern === 'every10') {
    // 5s rush at the top of each 10s block: 1–5 rush, 6–10 breathe, repeat.
    return Math.floor(elapsedSec) % 10 < 5;
  }
  if (pattern === 'random') {
    const e = Math.floor(elapsedSec);
    return windowsFor(roundSec, roundIndex).some(([s, en]) => e >= s && e < en);
  }
  // endRound (default): 20–30s all-out push at the end.
  return remainingSec > 0 && remainingSec <= 25;
}

export const RUSH_PATTERNS = [
  { id: 'random', label: 'RANDOM SURGES', sub: 'Random 5–10s bursts throughout the round.' },
  { id: 'every10', label: 'EVERY 10 SECONDS', sub: 'A short rush every 10s of the round.' },
  { id: 'endRound', label: 'END OF ROUND', sub: 'A 20–30s all-out push at the end of each round.' },
];

export function rushPatternLabel(id) {
  return (RUSH_PATTERNS.find(p => p.id === id) || RUSH_PATTERNS[2]).label;
}
