// The athlete's level for training (data/athleteLevel.js): effective XP (the
// side's own XP in full, every other XP at half), the level and the tier
// (1-2 EASY, 3-5 NORMAL, 6-9 HARD, 10+ ADVANCED), the one-step surprise range
// and the helpers the Level page and Combo Coach reuse. Also that odd stats
// never throw. Run with `npm run test:athlete`.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const A = await import('../components/training-mode/data/athleteLevel.js');
const { getLevel, getLevelProgress } = await import('../components/training-mode/data/userStats.js');
const { sessionMode } = await import('../components/training-mode/data/tiers.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const XPL = getLevelProgress(0).needed; // XP a level takes: the app's own number

// A stats object: `rows` is [type, count, xpEach, extra?] tuples; xp defaults to the row sum.
const mk = (rows, xp) => {
  const sessions = [];
  for (const [type, n, each = 100, extra = {}] of rows) {
    for (let i = 0; i < n; i += 1) sessions.push({ id: `${type}${i}`, type, xpEarned: each, completedAt: '2026-11-01T10:00:00.000Z', ...extra });
  }
  return { xp: xp ?? sessions.reduce((a, s) => a + s.xpEarned, 0), sessions };
};
// A Fit-only athlete with exactly `xp` XP (one Fit Mode row holds it all).
const fitXp = (xp) => mk([['Fit Mode', 1, xp]]);
const tierOf = (stats, side) => A.athleteTier(stats, side);

// ── the ladder: the cutoffs the owner gave ──────────────────────────────────
check('1 four tiers, easiest first', A.TIERS.join() === 'EASY,NORMAL,HARD,ADVANCED');
const LEVEL_TIER = [[1, 'EASY'], [2, 'EASY'], [3, 'NORMAL'], [4, 'NORMAL'], [5, 'NORMAL'], [6, 'HARD'], [7, 'HARD'], [8, 'HARD'], [9, 'HARD'], [10, 'ADVANCED'], [11, 'ADVANCED'], [15, 'ADVANCED'], [40, 'ADVANCED']];
check('2 level to tier: 1-2 EASY, 3-5 NORMAL, 6-9 HARD, 10+ ADVANCED', LEVEL_TIER.every(([l, t]) => A.tierForLevel(l) === t),
  LEVEL_TIER.filter(([l, t]) => A.tierForLevel(l) !== t).map(([l]) => `${l}=${A.tierForLevel(l)}`).join(' '));
// The boundaries in XP: the last XP of a level and the first of the next.
const BOUNDS = [[2, 3, 'EASY', 'NORMAL'], [5, 6, 'NORMAL', 'HARD'], [9, 10, 'HARD', 'ADVANCED']];
for (const [lo, hi, a, b] of BOUNDS) {
  const lastOfLo = hi === 3 ? 2 * XPL - 1 : (hi - 1) * XPL - 1;
  const firstOfHi = (hi - 1) * XPL;
  check(`3 boundary ${lo}/${hi}: ${lastOfLo} XP is level ${lo} ${a}, ${firstOfHi} XP is level ${hi} ${b}`,
    A.athleteLevel(fitXp(lastOfLo)) === lo && tierOf(fitXp(lastOfLo)) === a && A.athleteLevel(fitXp(firstOfHi)) === hi && tierOf(fitXp(firstOfHi)) === b,
    `${A.athleteLevel(fitXp(lastOfLo))}/${tierOf(fitXp(lastOfLo))} ${A.athleteLevel(fitXp(firstOfHi))}/${tierOf(fitXp(firstOfHi))}`);
}
check('3b the tier cutoffs are the first level of each tier', A.TIER_START_LEVEL.NORMAL === 3 && A.TIER_START_LEVEL.HARD === 6 && A.TIER_START_LEVEL.ADVANCED === 10);
check('3c the level maths is the app\'s own getLevel', [0, 499, 500, 1234, 4500, 99999].every(x => A.athleteLevel(fitXp(x)) === getLevel(x)));

// ── effective XP: the side's own in full, everything else at half ──────────
// Same total XP, two athletes: 3000 XP, all Fit or all Fight.
const fitHeavy = mk([['Fit Mode', 20, 100], ['Quick Mission', 10, 100]]);
const fightHeavy = mk([['Fight Focus', 20, 100], ['Combo Coach', 10, 100]]);
check('4 same total XP', fitHeavy.xp === 3000 && fightHeavy.xp === 3000);
check('4b Fit side: all-Fit counts in full, all-Fight at half', A.effectiveXp(fitHeavy, 'fit') === 3000 && A.effectiveXp(fightHeavy, 'fit') === 1500);
check('4c Fight side: all-Fight counts in full, all-Fit at half', A.effectiveXp(fightHeavy, 'fight') === 3000 && A.effectiveXp(fitHeavy, 'fight') === 1500);
check('4d the Fit-heavy athlete is HARD (level 7) for Fit and NORMAL (level 4) for Fight; the Fight-heavy one the reverse',
  tierOf(fitHeavy, 'fit') === 'HARD' && A.athleteLevel(fitHeavy, 'fit') === 7 && tierOf(fitHeavy, 'fight') === 'NORMAL' && A.athleteLevel(fitHeavy, 'fight') === 4
  && tierOf(fightHeavy, 'fight') === 'HARD' && tierOf(fightHeavy, 'fit') === 'NORMAL');
check('4e Fit is the default side', A.effectiveXp(fitHeavy) === 3000 && A.athleteTier(fitHeavy) === 'HARD' && A.athleteStart(fightHeavy).tier === 'NORMAL');
check('4f an unknown side reads as Fit', A.effectiveXp(fitHeavy, 'banana') === 3000);
// A balanced athlete: 1000 Fit + 1000 Fight = 1500 effective on either side.
const even = mk([['Fit Mode', 10, 100], ['Fight Focus', 10, 100]]);
check('4g a balanced athlete reads the same on both sides (own full + other half)', A.effectiveXp(even, 'fit') === 1500 && A.effectiveXp(even, 'fight') === 1500);
// The half-weight rule moves a boundary: 1800 Fit + 1800 Fight = 2700 effective, level 6 (HARD) on both sides.
const rich = mk([['Fit Mode', 18, 100], ['Fight Focus', 18, 100]]);
check('4h own + other/2 can cross a cutoff the single side would not (1800 + 900 = level 6)', A.athleteLevel(rich, 'fit') === 6 && tierOf(rich, 'fit') === 'HARD');
// Every session type, in its bucket.
const FIT_TYPES = ['Fit Mode', 'Quick Mission', 'Cardio'];
const FIGHT_TYPES = ['Fight Focus', 'Combo Coach', 'Practice'];
check('5 Fit types count in full for Fit', FIT_TYPES.every(t => A.effectiveXp(mk([[t, 1, 1000]]), 'fit') === 1000 && A.effectiveXp(mk([[t, 1, 1000]]), 'fight') === 500));
check('5b Fight types count in full for Fight', FIGHT_TYPES.every(t => A.effectiveXp(mk([[t, 1, 1000]]), 'fight') === 1000 && A.effectiveXp(mk([[t, 1, 1000]]), 'fit') === 500));
check("5c Coach's Tapes follow their kind", A.effectiveXp(mk([["Coach's Tapes", 1, 1000, { kind: 'fit' }]]), 'fit') === 1000
  && A.effectiveXp(mk([["Coach's Tapes", 1, 1000, { kind: 'fight' }]]), 'fight') === 1000
  && A.effectiveXp(mk([["Coach's Tapes", 1, 1000, { kind: 'fight' }]]), 'fit') === 500);
const OTHER_TYPES = ['Combat Conditioning', 'Training Camp', 'Mission of the Day', 'Hybrid Training Bonus', 'Start Here', 'Some New Mode', undefined, 42];
check('5d Combat Conditioning, Training Camp, award rows and unknown types are "other": half for both sides',
  OTHER_TYPES.every(t => A.effectiveXp(mk([[t, 1, 1000]]), 'fit') === 500 && A.effectiveXp(mk([[t, 1, 1000]]), 'fight') === 500),
  OTHER_TYPES.map(t => `${t}:${A.effectiveXp(mk([[t, 1, 1000]]), 'fit')}`).join(' '));
check('5e the bucket is tiers.sessionMode (the Level page\'s own)', FIT_TYPES.every(t => sessionMode({ type: t }) === 'fit') && FIGHT_TYPES.every(t => sessionMode({ type: t }) === 'fight')
  && sessionMode({ type: 'Mission of the Day' }) === 'bonus' && sessionMode({ type: 'Nope' }) === 'other');
// XP in the bank with no row behind it (a combo bonus, a chase): other, half.
const loose = { xp: 2000, sessions: [{ type: 'Fit Mode', xpEarned: 1000 }] };
check('6 XP with no session row counts as other (half): 1000 Fit + 1000 loose = 1500', A.effectiveXp(loose, 'fit') === 1500 && A.effectiveXp(loose, 'fight') === 1000);
check('6b xpBySide splits the bank: total, fit, fight, other', (() => {
  const x = A.xpBySide(mk([['Fit Mode', 2, 100], ['Fight Focus', 1, 50], ['Combat Conditioning', 1, 30], ['Mission of the Day', 1, 25]], 400));
  return x.total === 400 && x.fit === 200 && x.fight === 50 && x.other === 150;
})(), JSON.stringify(A.xpBySide(mk([['Fit Mode', 2, 100], ['Fight Focus', 1, 50], ['Combat Conditioning', 1, 30], ['Mission of the Day', 1, 25]], 400))));
// Rows that add up to more than the bank (a penalty came off the total, or a store was edited): the bank wins.
const over = { xp: 500, sessions: [{ type: 'Fit Mode', xpEarned: 800 }, { type: 'Fight Focus', xpEarned: 200 }] };
check('6c rows adding up to more than the bank never push the effective XP above the bank', A.effectiveXp(over, 'fit') <= 500 && A.effectiveXp(over, 'fight') <= 500 && A.effectiveXp(over, 'fit') > 0,
  `${A.effectiveXp(over, 'fit')} / ${A.effectiveXp(over, 'fight')}`);
check('6d effective XP is never more than the bank and never less than half of it', [fitHeavy, fightHeavy, even, rich, loose, over].every(s => ['fit', 'fight'].every(side => A.effectiveXp(s, side) <= s.xp && A.effectiveXp(s, side) >= s.xp / 2)));

// ── empty and odd stats ─────────────────────────────────────────────────────
const ODD = [
  ['null', null], ['undefined', undefined], ['empty object', {}], ['no sessions', { xp: 1200 }], ['sessions not a list', { xp: 800, sessions: 'x' }],
  ['NaN xp', { xp: NaN, sessions: [] }], ['negative xp', { xp: -500, sessions: [] }], ['string xp', { xp: 'lots', sessions: [] }], ['Infinity', { xp: Infinity, sessions: [] }],
  ['rows that are not objects', { xp: 300, sessions: [null, 7, 'x', [], undefined, { type: 'Fit Mode', xpEarned: 'NaN' }] }],
  ['NaN and negative row XP', { xp: 300, sessions: [{ type: 'Fit Mode', xpEarned: NaN }, { type: 'Fight Focus', xpEarned: -90 }] }],
  ['huge xp', { xp: 1e300, sessions: [{ type: 'Fit Mode', xpEarned: 1e300 }] }],
];
let threw = null;
const odd = ODD.map(([name, s]) => { try { return [name, A.athleteStart(s, 'fit'), A.athleteStart(s, 'fight')]; } catch (e) { threw = `${name}: ${e.message}`; return [name, null, null]; } });
check('7 odd stats never throw', !threw, threw || '');
check('7b odd stats always give a level of 1 or more, a real tier and a finite effective XP', odd.every(([, a, b]) => [a, b].every(r => r && Number.isInteger(r.level) && r.level >= 1 && A.TIERS.includes(r.tier) && Number.isFinite(r.xp) && r.xp >= 0)),
  odd.filter(([, a]) => !a || !(a.level >= 1)).map(([n]) => n).join());
check('7c empty stats: level 1, EASY, 0 XP', (() => { const r = A.athleteStart({ xp: 0, sessions: [] }); return r.level === 1 && r.tier === 'EASY' && r.xp === 0 && r.index === 0; })());
check('7d null, {} and no-sessions: EASY (or the bank at half, for a bank with no rows)', A.athleteTier(null) === 'EASY' && A.athleteTier({}) === 'EASY' && A.athleteTier(undefined, 'fight') === 'EASY');
check('7e a bank with no rows counts at half: 1200 XP reads as 600 (level 2, EASY)', A.effectiveXp({ xp: 1200 }) === 600 && A.athleteLevel({ xp: 1200 }) === 2);
check('7f NaN, negative and text XP are 0', ODD.slice(5, 8).every(([, s]) => A.effectiveXp(s) === 0));
check('7g huge XP is capped, not Infinity', Number.isFinite(A.effectiveXp({ xp: Infinity })) && Number.isFinite(A.effectiveXp(ODD[11][1])) && A.athleteTier(ODD[11][1]) === 'ADVANCED');
check('7h a numeric string in a row counts (a store that kept it as text)', A.effectiveXp({ xp: 1000, sessions: [{ type: 'Fit Mode', xpEarned: '1000' }] }) === 1000);
// Purity: the same stats twice give the same answer, and the input is not changed.
const frozen = Object.freeze({ xp: 3000, sessions: Object.freeze(fitHeavy.sessions.map(s => Object.freeze({ ...s }))) });
check('8 pure and deterministic: frozen input, same answer twice', (() => { const a = JSON.stringify(A.athleteStart(frozen)); const b = JSON.stringify(A.athleteStart(frozen)); return a === b; })());

// ── the picture of an athlete ───────────────────────────────────────────────
check('9 level 1 (a new athlete) is EASY', tierOf(fitXp(0)) === 'EASY' && tierOf(mk([['Fit Mode', 2, 100]])) === 'EASY');
check('9b mid-tier (level 4 and 5) is NORMAL', tierOf(fitXp(3 * XPL + 100)) === 'NORMAL' && tierOf(fitXp(4 * XPL + 100)) === 'NORMAL');
check('9c about level 10 mostly on Fit is ADVANCED; the same athlete\'s Fight side is HARD or less', (() => {
  const s = mk([['Fit Mode', 40, 100], ['Quick Mission', 10, 100], ['Fight Focus', 2, 100]]); // 5200 XP, 5000 Fit
  return A.athleteLevel(s, 'fit') >= 10 && tierOf(s, 'fit') === 'ADVANCED' && tierOf(s, 'fight') !== 'ADVANCED';
})());
check('9d an athlete with lots of Fight XP and almost no Fit still starts a Fit workout at half credit (level 1 never gets HARD)', (() => {
  const s = mk([['Fight Focus', 9, 100]]); // 900 XP, none of it Fit: effective 450, level 1
  return A.athleteLevel(s, 'fit') === 1 && tierOf(s, 'fit') === 'EASY';
})());
check('9e level 1 or 2 is never HARD or ADVANCED, whatever the mix', [0, 100, 499, 500, 999].every(x => ['fit', 'fight'].every(side => ['EASY'].includes(tierOf(mk([['Fit Mode', 1, x]]), side)))));
check('9f more XP never lowers the tier (steps of 50 XP, both sides)', (() => {
  let ok = true, prevFit = 0, prevFight = 0;
  for (let x = 0; x <= 12000; x += 50) {
    const s = mk([['Fit Mode', 1, x]]);
    const f = A.athleteStart(s, 'fit').index, g = A.athleteStart(s, 'fight').index;
    if (f < prevFit || g < prevFight) ok = false;
    prevFit = f; prevFight = g;
  }
  return ok;
})());

// ── surprise ────────────────────────────────────────────────────────────────
const RANGE = { EASY: 'EASY,NORMAL', NORMAL: 'EASY,NORMAL,HARD', HARD: 'NORMAL,HARD,ADVANCED', ADVANCED: 'HARD,ADVANCED' };
check('10 the surprise range is one step either side, never below EASY, never above the top', A.TIERS.every(t => A.surpriseTiers(t).join() === RANGE[t]), A.TIERS.map(t => `${t}:${A.surpriseTiers(t)}`).join(' '));
check('10b a level 1-2 athlete only ever gets EASY or NORMAL; a HARD one never EASY', (() => {
  const seen = (t) => { const out = new Set(); for (let i = 0; i < 100; i++) out.add(A.rollSurpriseTier(t, { rand: () => i / 100 })); return [...out].sort().join(); };
  return seen('EASY') === 'EASY,NORMAL' && seen('HARD') === 'ADVANCED,HARD,NORMAL' && seen('NORMAL') === 'EASY,HARD,NORMAL' && seen('ADVANCED') === 'ADVANCED,HARD';
})());
check('10c the roll never goes more than one step from the start (random, 2000 rolls)', A.TIERS.every(t => { for (let i = 0; i < 500; i++) if (Math.abs(A.tierIndex(A.rollSurpriseTier(t)) - A.tierIndex(t)) > 1) return false; return true; }));
check('10d the roll is deterministic with a given random, and the ends of [0, 1) hit the first and last tier', A.rollSurpriseTier('NORMAL', { rand: () => 0 }) === 'EASY' && A.rollSurpriseTier('NORMAL', { rand: () => 0.999999 }) === 'HARD' && A.rollSurpriseTier('NORMAL', { rand: () => 0.5 }) === 'NORMAL');
check('10e `not` skips the tier on screen so a roll always changes it (and a lone tier ignores it)', (() => {
  for (let i = 0; i < 60; i++) { const r = i / 60; if (A.rollSurpriseTier('NORMAL', { rand: () => r, not: 'NORMAL' }) === 'NORMAL') return false; }
  return A.rollSurpriseTier('EASY', { rand: () => 0.9, not: 'NORMAL' }) === 'EASY' && A.rollSurpriseTier('ADVANCED', { rand: () => 0.1, not: 'HARD' }) === 'ADVANCED';
})());
check('10f a bad random or a bad start still rolls a real tier', A.TIERS.includes(A.rollSurpriseTier('EASY', { rand: () => NaN })) && A.TIERS.includes(A.rollSurpriseTier('banana')) && A.surpriseTiers(null).join() === 'EASY,NORMAL');

// ── helpers the Level page and Combo Coach reuse ────────────────────────────
check('11 normalizeTier reads every stored form, MEDIUM included', ['EASY', 'Easy', 'easy', 'NORMAL', 'Normal', 'MEDIUM', 'medium', 'HARD', 'Hard', 'ADVANCED', 'Advanced'].map(A.normalizeTier).join()
  === 'EASY,EASY,EASY,NORMAL,NORMAL,NORMAL,NORMAL,HARD,HARD,ADVANCED,ADVANCED' && A.normalizeTier('Brutal') === null && A.normalizeTier(null) === null && A.normalizeTier(7) === null);
check('11b nextTierAfter: what the next tier is and how far', (() => {
  const a = A.nextTierAfter(1), b = A.nextTierAfter(5), c = A.nextTierAfter(9);
  return a.tier === 'NORMAL' && a.level === 3 && a.levelsAway === 2 && b.tier === 'HARD' && b.levelsAway === 1 && c.tier === 'ADVANCED' && c.levelsAway === 1
    && A.nextTierAfter(10) === null && A.nextTierAfter(99) === null && A.nextTierAfter(NaN).tier === 'NORMAL';
})());
check('11c tierLevels: the levels each tier covers', (() => {
  const t = Object.fromEntries(A.TIERS.map(x => [x, A.tierLevels(x)]));
  return t.EASY.from === 1 && t.EASY.to === 2 && t.NORMAL.from === 3 && t.NORMAL.to === 5 && t.HARD.from === 6 && t.HARD.to === 9 && t.ADVANCED.from === 10 && t.ADVANCED.to === null;
})());
check('11d TIER_RULES is the one table per tier (a place for Combo Coach\'s mix)', A.TIERS.every(t => A.TIER_RULES[t]?.tier === t));
check('11e tierIndex is in ladder order and unknown reads as the first', A.tierIndex('ADVANCED') === 3 && A.tierIndex('Normal') === 1 && A.tierIndex('x') === 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
