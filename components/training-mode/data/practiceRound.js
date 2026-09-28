// Practice Round — the short drill after a lesson, built from what the
// athlete has learned so far (Simplify revamp, PracticeRound.dc.html).
//
// Rounds grow with the number of techniques learned: basics done on the
// discipline's path, plus Technique Library moves drilled to the end of a
// round. The focus mix and the calls follow the design: early rounds lean on
// what is already known and keep coming back to the stance; later rounds
// turn into combinations.

export const REST_SEC = 30;

export const PLANS = [
  { rounds: 1, lenSec: 60, name: 'LEVEL 1 · FIRST STEPS', when: 'First 1–2 techniques' },
  { rounds: 2, lenSec: 90, name: 'LEVEL 2 · BUILDING BLOCKS', when: '3–6 techniques learned' },
  { rounds: 3, lenSec: 120, name: 'LEVEL 3 · FUNDAMENTALS DONE', when: 'All fundamentals' },
  { rounds: 3, lenSec: 180, name: 'LEVEL 4 · FIGHT READY', when: 'Basics + 4 library moves' },
];

export const tierFor = (learned) => (learned >= 11 ? 3 : learned >= 7 ? 2 : learned >= 3 ? 1 : 0);
export const xpFor = (tier) => 30 + 20 * tier;

export const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
export const planLine = (plan) => `${plan.rounds} × ${mmss(plan.lenSec)}`;
export const planMinutes = (plan) => Math.ceil((plan.rounds * plan.lenSec + (plan.rounds - 1) * REST_SEC) / 60);

const STANCE_CALLS = ['RESET STANCE', 'GUARD UP'];
const isStanceLesson = (item) => /stance|guard/i.test(item.name);
const isCombo = (call) => call.includes('→');
const single = (item) => item.calls.find(c => !isCombo(c)) || null;

const NUMBERS_SINGLES = ['1', '2', '3'];
const NUMBERS_COMBOS = ['1-2', '1-2-3', '1-1-2', '2-3-2', '1-2 → 3 TO THE BODY'];

// focus: { id?, name, calls }  — the lesson or technique being drilled.
// prior: [{ name, calls }]     — what came before it, oldest first.
export function buildRound({ focus, prior = [], learned = 1 }) {
  const tier = tierFor(learned);
  const plan = PLANS[tier];
  // Stance lessons are the base every round resets to, not strikes to mix
  // in; the last three strikes learned are plenty for a beginner round.
  const strikes = prior.filter(p => !isStanceLesson(p) && p.calls?.length).slice(-3);
  const priorCalls = strikes.flatMap(p => p.calls);
  const numbers = focus.id === 'know_your_numbers';

  // A lesson that is already a combination (Jab-Cross) is not chained onto
  // the strikes before it — that only builds "CROSS → JAB → CROSS".
  const focusSingle = single(focus);
  const priorSingles = strikes.map(single).filter(Boolean);
  const singles = numbers ? NUMBERS_SINGLES : [...new Set([...focus.calls.filter(c => !isCombo(c)), ...priorSingles])];
  let combos = numbers ? NUMBERS_COMBOS : [...new Set([
    ...focus.calls.filter(isCombo),
    ...(focusSingle ? priorSingles.filter(c => c !== focusSingle).map(c => `${c} → ${focusSingle}`) : []),
    ...priorSingles.slice(1).map((c, i) => `${priorSingles[i]} → ${c}`),
  ])];
  if (!combos.length) combos = [`${focusSingle || focus.calls[0]} × 2`];
  if (!singles.length) singles.push(...focus.calls);

  const G = '#F2BE45', V = '#B794FF', B = '#6E9BFF';
  const priorLabel = strikes.map(p => p.name).join(' + ');
  const groups = [
    strikes.length
      ? [{ label: priorLabel, pct: 50, color: G, calls: priorCalls }, { label: 'Stance resets', pct: 25, color: B, calls: STANCE_CALLS }, { label: focus.name, pct: 25, color: V, calls: focus.calls }]
      : [{ label: focus.name, pct: 70, color: G, calls: focus.calls }, { label: 'Stance resets', pct: 30, color: V, calls: STANCE_CALLS }],
    strikes.length
      ? [{ label: priorLabel, pct: 45, color: G, calls: priorCalls }, { label: focus.name, pct: 35, color: V, calls: focus.calls }, { label: 'Stance resets', pct: 20, color: B, calls: STANCE_CALLS }]
      : [{ label: focus.name, pct: 60, color: G, calls: focus.calls }, { label: 'Stance resets', pct: 40, color: V, calls: STANCE_CALLS }],
    numbers
      ? [{ label: 'Single numbers', pct: 50, color: G, calls: singles }, { label: 'Number combos', pct: 50, color: V, calls: combos }]
      : [{ label: `${focus.name} + singles`, pct: 50, color: G, calls: singles }, { label: `Combos with ${focus.name}`, pct: 50, color: V, calls: combos }],
    [{ label: 'Combos', pct: 80, color: G, calls: combos }, { label: 'Single shots + resets', pct: 20, color: V, calls: [...singles, ...STANCE_CALLS] }],
  ][tier];

  // Weighted pick of a group, then a call from it — never the same call
  // twice running, so every call reads as a new instruction.
  const pick = (avoid) => {
    for (let tries = 0; tries < 8; tries++) {
      let r = Math.random() * 100;
      const g = groups.find(x => (r -= x.pct) < 0) || groups[groups.length - 1];
      const c = g.calls[Math.floor(Math.random() * g.calls.length)];
      if (c !== avoid) return c;
    }
    return groups[0].calls[0];
  };

  // One call from each group first, then the rest of the focus: what the
  // setup screen shows as SAMPLE CALLS.
  const sample = [...new Set([...groups.map(g => g.calls[0]), ...groups.flatMap(g => g.calls)])].slice(0, 5);

  return { tier, plan, xp: xpFor(tier), groups, sample, pick, callMs: tier === 0 ? 3500 : 3000 };
}

// How a call is said. The screen shows "JAB × 2" and "1-2-3"; the coach says
// "double jab" and "1, 2, 3".
export function spokenCall(call) {
  return call
    .replace(/^(.+) × 2$/, 'double $1')
    .replace(/(\d)-(?=\d)/g, '$1, ')
    .replace(/ → /g, ', ')
    .toLowerCase();
}
