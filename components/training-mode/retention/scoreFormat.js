// The score board's words and numbers, with no React in them, so the board's
// rule (scoreBoards.js), the app's board rules (data/scoreBoardRules.js) and
// the scripts that test them can share one copy with the components
// (ui/ScoreBoard.jsx re-exports both).

// 1ST, 2ND, 3RD, 4TH ... 11TH, 12TH, 13TH ... 21ST.
export const ORD = (n) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}TH`;
  return `${n}${({ 1: 'ST', 2: 'ND', 3: 'RD' })[n % 10] || 'TH'}`;
};

const pad2 = (n) => String(n).padStart(2, '0');
// 'count' 1,284 · 'time' 14:52 (1:02:05 past an hour) · 'roundsReps' 7 + 12
// (value = rounds × 1000 + reps).
export function formatScore(kind, value) {
  const v = Math.max(0, Math.round(Number(value) || 0));
  if (kind === 'time') {
    const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60), s = v % 60;
    return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  }
  if (kind === 'roundsReps') return `${Math.floor(v / 1000)} + ${v % 1000}`;
  return v.toLocaleString('en-US');
}
