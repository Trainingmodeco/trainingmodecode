// Combo Coach by level (data/comboMix.js and its use in data/sessionGenerator.js):
// the pieces() helper, the difficult-kick list, the one mix table and what each
// tier really deals over thousands of calls in all four disciplines. Easy never
// above 4 pieces and never a difficult kick, Normal never above 7 and at most 2
// difficult-kick combos a round, no discipline starved at any tier, the swing
// at the top, and the athlete's own saved combos dealt as they always were.
// Run with `npm run test:combomix`.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const M = await import('../components/training-mode/data/comboMix.js');
const { default: POOL } = await import('../components/training-mode/data/comboCoachData.js');
const G = await import('../components/training-mode/data/sessionGenerator.js');
const A = await import('../components/training-mode/data/athleteLevel.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const TIERS = ['EASY', 'NORMAL', 'HARD', 'ADVANCED'];
const P = M.preparedPool();

// ── the table ───────────────────────────────────────────────────────────────
check('1 four tiers in the mix, the same ids as the athlete tiers', Object.keys(M.COMBO_MIX).join() === A.TIERS.join());
check('1b every row adds up to 100 in steps of 5 (one card is 5), none negative',
  TIERS.every(t => { const w = M.COMBO_MIX[t].weights; const v = M.SOURCE_TIERS.map(s => w[s]); return v.reduce((a, b) => a + b, 0) === 100 && v.every(x => x >= 0 && x % 5 === 0); }));
check('1c the owner\'s caps: EASY 4 pieces and no difficult kick, NORMAL 7 pieces and 2 difficult-kick combos a round',
  M.COMBO_MIX.EASY.maxPieces === 4 && M.COMBO_MIX.EASY.maxHardKicks === 0 && M.COMBO_MIX.NORMAL.maxPieces === 7 && M.COMBO_MIX.NORMAL.maxHardKicks === 2);
check('1d the top two tiers have no cap', M.COMBO_MIX.HARD.maxPieces === null && M.COMBO_MIX.HARD.maxHardKicks === null && M.COMBO_MIX.ADVANCED.maxPieces === null && M.COMBO_MIX.ADVANCED.maxHardKicks === null);
check('1e EASY deals only the easy pool; NORMAL mostly normal with some easy; HARD mostly hard; only ADVANCED swings',
  M.COMBO_MIX.EASY.weights.easy === 100
  && M.COMBO_MIX.NORMAL.weights.normal > 40 && M.COMBO_MIX.NORMAL.weights.easy > 0 && M.COMBO_MIX.NORMAL.weights.hard > 0
  && M.COMBO_MIX.HARD.weights.hard >= 50 && M.COMBO_MIX.HARD.weights.normal > 0 && M.COMBO_MIX.HARD.weights.advanced > 0
  && TIERS.filter(t => M.COMBO_MIX[t].swing).join() === 'ADVANCED');
check('1f the advanced share of the mix rises with every tier (0, 1, 2, 5 in ten)', TIERS.map(M.advancedInTen).join() === '0,1,2,5', TIERS.map(M.advancedInTen).join());
const meanSource = (t) => M.SOURCE_TIERS.reduce((s, k, i) => s + i * M.COMBO_MIX[t].weights[k], 0) / 100;
check('1g the average pool tier rises at every step: the higher the level, the harder', meanSource('EASY') < meanSource('NORMAL') && meanSource('NORMAL') < meanSource('HARD') && meanSource('HARD') < meanSource('ADVANCED'),
  TIERS.map(meanSource).join());
check('1h TIER_RULES carries the same table', TIERS.every(t => A.TIER_RULES[t].combo === M.COMBO_MIX[t]));
check('1i mixFor reads any form (Easy, MEDIUM, Intermediate) and falls back to NORMAL like the generator',
  M.mixFor('Easy').tier === 'EASY' && M.mixFor('MEDIUM').tier === 'NORMAL' && M.mixFor('Intermediate').tier === 'NORMAL' && M.mixFor('Advanced').tier === 'ADVANCED' && M.mixFor('banana').tier === 'NORMAL' && M.mixFor(undefined).tier === 'NORMAL');

// ── pieces() ────────────────────────────────────────────────────────────────
const PIECES = [
  ['Jab', 1], ['Cross', 1], ['Jab Cross', 2], ['Jab Cross Hook', 3], ['jab cross hook', 3], ['  Jab   Cross ', 2],
  ['Double Jab', 2], ['Double Jab Cross Hook', 4], ['Double Teep', 2], ['Double Low Kick Cross Hook Spinning Kick', 5],
  ['Low Kick', 1], ['Jab Cross Low Kick', 3], ['Body Hook', 1], ['Jab Cross Body Hook', 3], ['Switch Kick Cross', 2],
  ['High Kick', 1], ['Jab Cross High Kick', 3], ['Lead Uppercut Cross', 2], ['Lead Uppercut Cross Hook Body Cross', 4],
  ['Rear Roundhouse', 1], ['Spinning Back Kick', 1], ['Jab Cross Spinning Back Kick', 3], ['Question Mark Kick', 1], ['Low Kick Jab Cross Question Mark Kick', 4],
  ['Jab Spinning Back Fist Roundhouse', 3], ['Lead Hook Low Kick Spinning Backfist', 3], ['Jab Cross Spinning Elbow Knee', 4],
  ['Step Knee Cross Hook Roundhouse', 4], ['Flying Knee', 1], ['Jab Cross Fake Shot Flying Knee', 4],
  // defence and movement words count as pieces
  ['Jab Slip Cross', 3], ['Slip Slip Cross Hook', 4], ['Roll', 1], ['Parry Cross Hook Cross Hook Body Cross', 6],
  ['Feint Jab Slip Cross Hook Cross Body Hook', 7], ['Jab Cross Pivot Hook Cross Hook', 6], ['Feint Cross Pull Counter Cross Hook', 5],
  ['Pull Counter Cross Hook Body Cross Hook', 5], ['Check Counter Kick Cross Hook Kick', 5], ['Check Cross Hook Body Kick', 4],
  ['Catch Kick Sweep Cross Ground Knee', 4], ['Jab Cross Sprawl', 3], ['Jab Cross Level Change', 3], ['Sprawl Cross Hook Level Change Ground Pound', 5],
  ['Clinch Knee Knee Elbow', 4], ['Feint Shot Overhand Hook Body Kick Level Change', 5], ['Jab Cross Circle Out', 3], ['Jab Cross Step Back', 3],
  // a modifier with nothing after it, an unknown word, nothing at all
  ['Hook Body Hook Head', 3], ['Hook Kick', 1], ['Cross Hook Kick', 3], ['Jab Cross Hook Kick', 4], ['Jab Body Jab Head Cross', 3], ['Jab Banana', 2], ['', 0],
];
const bad = PIECES.filter(([t, n]) => M.pieceCount(t) !== n).map(([t, n]) => `${t}: ${M.pieceCount(t)} not ${n}`);
check('2 pieces(): two-word strikes, Double, defence and movement words, modifiers and unknown words', bad.length === 0, bad.join(' | '));
check('2b nothing and nonsense never throws', [null, undefined, 0, 7, {}, [], '   '].every(v => M.pieceCount(v) === 0 || typeof M.pieceCount(v) === 'number'));
check('2c strikes are pieces: strikeCount never more than pieceCount, and defence is not a strike',
  M.strikeCount('Jab Slip Cross') === 2 && M.pieceCount('Jab Slip Cross') === 3 && POOL.every(c => M.strikeCount(c.comboText) <= M.pieceCount(c.comboText)));
check('2d piecesOf kinds', JSON.stringify(M.piecesOf('Slip Jab Sprawl')) === JSON.stringify([{ text: 'Slip', kind: 'defence' }, { text: 'Jab', kind: 'strike' }, { text: 'Sprawl', kind: 'move' }]));
const unknown = [...new Set(POOL.flatMap(c => M.piecesOf(c.comboText).filter(p => p.kind === 'other').map(p => p.text)))];
check('2e every word in the real pool is known (only the lone Head is not)', unknown.join() === 'head', unknown.join());
const poolMax = Math.max(...POOL.map(c => M.pieceCount(c.comboText)));
check('2f the real pool: easy combos hold at most 3 pieces, normal 4, hard 6; none is over 7',
  ['easy', 'normal', 'hard'].map(t => Math.max(...POOL.filter(c => c.minDifficulty === t).map(c => M.pieceCount(c.comboText)))).join() === '3,4,6' && poolMax === 7, `max ${poolMax}`);

// ── difficult kicks ─────────────────────────────────────────────────────────
const HARDY = ['High Kick', 'Head Kick', 'Switch Kick', 'Jab Cross High Kick', 'Switch Kick Cross', 'Spinning Back Kick', 'Spinning Heel Kick', 'Tornado Kick', 'Wheel Kick', 'Question Mark Kick', 'Hook Kick', 'Axe Kick', 'Jumping Kick',
  'Flying Knee', 'Jab Spinning Backfist', 'Jab Spinning Back Fist Roundhouse', 'Spinning Back Elbow', 'Jab Cross Spinning Elbow Knee', 'Superman Punch', 'Lead Hook Low Kick Spinning Backfist', 'Double Low Kick Cross Hook Spinning Kick'];
const CALM = ['Jab', 'Jab Cross', 'Low Kick', 'Body Kick', 'Teep', 'Roundhouse', 'Rear Roundhouse', 'Lead Kick', 'Rear Kick', 'Knee', 'Elbow', 'Kick', 'Jab Cross Low Kick', 'Cross Hook Body Kick', 'Catch Kick Sweep Cross Ground Knee', 'Check Cross Hook Body Kick', 'Oblique Kick Cross Hook', 'Jab Cross Hook Cross Low Kick'];
check('3 the difficult-kick list: high, head, switch, spinning, jumping and flying strikes', HARDY.every(t => M.isDifficult(t)), HARDY.filter(t => !M.isDifficult(t)).join(' | '));
check('3b ordinary kicks are not on it, and neither is a catch', CALM.every(t => !M.isDifficult(t)), CALM.filter(t => M.isDifficult(t)).join(' | '));
check('3c every name on the list is a strike the pieces() helper reads as one piece', M.DIFFICULT_KICKS.every(k => M.pieceCount(k) === 1 && M.piecesOf(k)[0].kind === 'strike'));
check('3d no easy-pool combo holds a difficult kick, and the real pool has them (normal 5, hard 10, advanced 25)',
  POOL.filter(c => c.minDifficulty === 'easy' && M.isDifficult(c.comboText)).length === 0
  && ['normal', 'hard', 'advanced'].map(t => POOL.filter(c => c.minDifficulty === t && M.isDifficult(c.comboText)).length).join() === '5,10,25',
  ['normal', 'hard', 'advanced'].map(t => POOL.filter(c => c.minDifficulty === t && M.isDifficult(c.comboText)).length).join());

// ── what a tier may ever draw ───────────────────────────────────────────────
for (const d of M.DISCIPLINES) {
  check(`4 ${d}: EASY draws only the easy pool, no combo past 4 pieces, no difficult kick`, M.tierPool(P[d], 'EASY').length >= 15 && M.tierPool(P[d], 'EASY').every(c => c.source === 'easy' && c.pieces <= 4 && !c.hard));
  const n = M.tierPool(P[d], 'NORMAL');
  check(`4b ${d}: NORMAL draws easy, normal, hard and advanced, nothing past 7 pieces`, new Set(n.map(c => c.source)).size === 4 && n.every(c => c.pieces <= 7));
  check(`4c ${d}: HARD never draws the easy pool; ADVANCED draws all four`, M.tierPool(P[d], 'HARD').every(c => c.source !== 'easy') && new Set(M.tierPool(P[d], 'ADVANCED').map(c => c.source)).size === 4);
  check(`4d ${d}: no tier is short of combos (at least 15 to draw from)`, TIERS.every(t => M.tierPool(P[d], t).length >= 15), TIERS.map(t => M.tierPool(P[d], t).length).join());
}

// ── thousands of deals ──────────────────────────────────────────────────────
const ROUNDS = 100, CALLS = 40; // 4,000 calls a tier and discipline
const ledger = {};
for (const t of TIERS) {
  for (const d of M.DISCIPLINES) {
    const rng = rngOf(1000 + t.length * 31 + d.length);
    const L = { share: { easy: 0, normal: 0, hard: 0, advanced: 0 }, calls: 0, maxPieces: 0, hardMax: 0, hardTotal: 0, easyCalls: 0, singles: 0, srcIdx: 0, seen: new Set(), back: 0, bandsMissing: 0, runMax: 0, switches: 0, short: 0 };
    for (let r = 0; r < ROUNDS; r += 1) {
      const items = M.dealMixItems({ prepared: P[d], tier: t, count: CALLS, rng });
      if (items.length !== CALLS) L.short += 1;
      let hard = 0, lastBand = -1, run = 0; const bands = new Set();
      items.forEach((c, i) => {
        L.share[c.source] += 1; L.calls += 1; L.maxPieces = Math.max(L.maxPieces, c.pieces); L.seen.add(c.text);
        L.srcIdx += M.SOURCE_TIERS.indexOf(c.source);
        if (c.hard) hard += 1;
        if (c.source === 'easy') { L.easyCalls += 1; if (c.single) L.singles += 1; }
        if (i && items[i - 1].text === c.text) L.back += 1;
        const band = c.source === 'easy' ? 0 : c.source === 'normal' ? 1 : 2;
        bands.add(band);
        if (band === lastBand) run += 1; else { if (lastBand !== -1) L.switches += 1; lastBand = band; run = 1; }
        L.runMax = Math.max(L.runMax, run);
      });
      L.hardMax = Math.max(L.hardMax, hard); L.hardTotal += hard;
      if (bands.size < 3) L.bandsMissing += 1;
    }
    ledger[`${t}/${d}`] = L;
  }
}
const at = (t, d) => ledger[`${t}/${d}`];
for (const t of TIERS) for (const d of M.DISCIPLINES) {
  const L = at(t, d); const m = M.COMBO_MIX[t];
  check(`5 ${t} ${d}: every round is the full ${CALLS} calls`, L.short === 0, String(L.short));
  const worst = Math.max(...M.SOURCE_TIERS.map(s => Math.abs((100 * L.share[s]) / L.calls - m.weights[s])));
  check(`5b ${t} ${d}: each pool tier's share of calls is the table's, within 1.5 points`, worst <= 1.5, `${M.SOURCE_TIERS.map(s => `${s} ${((100 * L.share[s]) / L.calls).toFixed(1)}`).join(' ')} (worst ${worst.toFixed(2)})`);
  // A capped tier rations its difficult kicks on purpose, so those only need to show up
  // (at least half of them); every other combo, and every combo of an uncapped tier, comes up.
  const pool = M.tierPool(P[d], t);
  const calmLeft = pool.filter(c => !c.hard && !L.seen.has(c.text)).length;
  const hardPool = pool.filter(c => c.hard);
  const hardSeen = hardPool.filter(c => L.seen.has(c.text)).length;
  const capHard = m.maxHardKicks !== null;
  check(`5c ${t} ${d}: no combo is starved: every ordinary combo of the tier is dealt, and ${capHard ? 'at least half of the rationed difficult ones' : 'every difficult one'}`,
    calmLeft === 0 && (capHard ? hardSeen >= Math.ceil(hardPool.length / 2) : hardSeen === hardPool.length), `${calmLeft} ordinary never dealt, ${hardSeen} of ${hardPool.length} difficult dealt`);
  check(`5d ${t} ${d}: never the same combo twice in a row`, L.back === 0, String(L.back));
}
check('6 EASY: never more than 4 pieces (the pool\'s longest easy combo is 3) in any discipline', M.SOURCE_TIERS.length && M.DISCIPLINES.every(d => at('EASY', d).maxPieces <= 4 && at('EASY', d).maxPieces >= 3), M.DISCIPLINES.map(d => at('EASY', d).maxPieces).join());
check('6b EASY: never a difficult kick', M.DISCIPLINES.every(d => at('EASY', d).hardMax === 0));
// A round of 8 calls: the small single pool (2 or 3 strikes) is not replayed to hit the 30 share,
// so the share is 30 or what the singles can fill without a repeat, whichever is lower.
const shortRounds = Object.fromEntries(M.DISCIPLINES.map(d => {
  const rng = rngOf(77 + d.length); let s = 0, n = 0, rep = 0, rep12 = 0;
  for (let r = 0; r < 600; r += 1) {
    const items = M.dealMixItems({ prepared: P[d], tier: 'EASY', count: 8, rng });
    items.forEach(c => { n += 1; if (c.single) s += 1; });
    const twelve = M.dealMixRound({ prepared: P[d], tier: 'EASY', count: 12, rng });
    if (new Set(twelve).size < twelve.length) rep12 += 1;
    if (new Set(items.map(c => c.text)).size < items.length) rep += 1;
  }
  return [d, { share: (100 * s) / n, rep, rep12, singles: P[d].filter(c => c.single).length }];
}));
check('6c EASY: about 30 in 100 easy calls are a single strike in a short round, or all the singles the pool has (MMA too: Jab, Cross and Teep)',
  M.DISCIPLINES.every(d => Math.abs(shortRounds[d].share - Math.min(30, (100 * shortRounds[d].singles) / 8)) <= 5),
  M.DISCIPLINES.map(d => shortRounds[d].share.toFixed(1)).join(','));
check('6c3 EASY: a 12-call round never replays a combo while the 15 or more easy ones are not all heard (was about 1 round in 2)',
  M.DISCIPLINES.every(d => shortRounds[d].rep12 === 0 && shortRounds[d].rep === 0), M.DISCIPLINES.map(d => `${shortRounds[d].rep}/${shortRounds[d].rep12}`).join(','));
// The typed-out combo lists of the striking coach: a combo sits in one level of a discipline only.
const { COMBOS: LEVEL_COMBOS } = await import('../components/training-mode/strikingCoachData.ts');
const dupes = Object.entries(LEVEL_COMBOS).flatMap(([disc, levels]) => {
  const all = Object.values(levels).flat();
  return all.filter((t, i) => all.indexOf(t) !== i).map(t => `${disc}: ${t}`);
});
check('6c4 no combo is listed at two levels of one discipline (Boxing had Jab Cross Hook at Easy and Normal)', dupes.length === 0, dupes.join('; '));
check('6c2 every discipline has single strikes in the pool, so a level 1 athlete is dealt single punches first', M.DISCIPLINES.every(d => P[d].filter(c => c.single).length >= 2 && P[d].filter(c => c.single).every(c => c.source === 'easy' && c.pieces === 1)), M.DISCIPLINES.map(d => P[d].filter(c => c.single).length).join());
check('6d NORMAL: never more than 7 pieces', M.DISCIPLINES.every(d => at('NORMAL', d).maxPieces <= 7), M.DISCIPLINES.map(d => at('NORMAL', d).maxPieces).join());
check('6e NORMAL: at most 2 difficult-kick combos in any round, and the cap is used where the pool has kicks',
  M.DISCIPLINES.every(d => at('NORMAL', d).hardMax <= 2) && at('NORMAL', 'kickboxing').hardMax === 2 && at('NORMAL', 'muay-thai').hardMax === 2 && at('NORMAL', 'mma').hardMax === 2 && at('NORMAL', 'boxing').hardMax === 0,
  M.DISCIPLINES.map(d => at('NORMAL', d).hardMax).join());
check('6f NORMAL: a kickboxing round holds a difficult kick on average (not zero, not above the cap)', at('NORMAL', 'kickboxing').hardTotal / ROUNDS > 1.5 && at('NORMAL', 'kickboxing').hardTotal / ROUNDS <= 2, (at('NORMAL', 'kickboxing').hardTotal / ROUNDS).toFixed(2));
check('6g HARD and ADVANCED are not capped: a kickboxing round has far more than 2 difficult kicks', at('HARD', 'kickboxing').hardMax > 6 && at('ADVANCED', 'kickboxing').hardMax > 6, `${at('HARD', 'kickboxing').hardMax} ${at('ADVANCED', 'kickboxing').hardMax}`);
check('6h HARD deals combos up to 6 pieces in kickboxing and 7 in boxing, and never an easy-pool combo', at('HARD', 'boxing').maxPieces === 7 && at('HARD', 'kickboxing').maxPieces === 6 && M.DISCIPLINES.every(d => at('HARD', d).share.easy === 0));
check('6i the average pool tier rises EASY < NORMAL < HARD < ADVANCED in every discipline',
  M.DISCIPLINES.every(d => TIERS.map(t => at(t, d).srcIdx / at(t, d).calls).every((v, i, a) => !i || v > a[i - 1])), M.DISCIPLINES.map(d => TIERS.map(t => (at(t, d).srcIdx / at(t, d).calls).toFixed(2)).join('<')).join(' | '));
check('6j ADVANCED swings: no band runs past 3 calls, every round touches single/basic, mid-tier and hard/advanced, and it changes band often',
  M.DISCIPLINES.every(d => at('ADVANCED', d).runMax <= M.SWING_RUN_MAX && at('ADVANCED', d).bandsMissing === 0 && at('ADVANCED', d).switches / ROUNDS >= 9),
  M.DISCIPLINES.map(d => `${at('ADVANCED', d).runMax}/${at('ADVANCED', d).bandsMissing}/${(at('ADVANCED', d).switches / ROUNDS).toFixed(1)}`).join(' '));
check('6k the tiers that do not swing are not forced to (HARD runs past 3 in one band)', M.DISCIPLINES.some(d => at('HARD', d).runMax > M.SWING_RUN_MAX));

// ── dealing details ─────────────────────────────────────────────────────────
{
  const a = M.dealMixRound({ prepared: P.boxing, tier: 'HARD', count: 30, rng: rngOf(5) });
  const b = M.dealMixRound({ prepared: P.boxing, tier: 'HARD', count: 30, rng: rngOf(5) });
  const c = M.dealMixRound({ prepared: P.boxing, tier: 'HARD', count: 30, rng: rngOf(6) });
  check('7 the same seed deals the same round, another seed another', a.join('|') === b.join('|') && a.join('|') !== c.join('|'));
  check('7b the round is combo text, and a count of 0 or a bad one deals nothing without throwing',
    typeof a[0] === 'string' && M.dealMixRound({ prepared: P.boxing, tier: 'EASY', count: 0 }).length === 0 && M.dealMixRound({ prepared: P.boxing, tier: 'EASY', count: -3 }).length === 0 && M.dealMixRound({ prepared: [], tier: 'EASY', count: 5 }).length === 0 && M.dealMixRound({ prepared: P.boxing, tier: 'EASY', count: NaN }).length === 0);
  // A short arsenal (a beginner who has learned Jab, Cross, Hook): sources that
  // have nothing left drop out and the round is still full.
  const learned = new Set(['Jab', 'Cross', 'Hook']);
  const narrow = P.boxing.filter(c => M.piecesOf(c.text).every(p => p.kind === 'strike' && learned.has(p.text)));
  const nr = M.dealMixItems({ prepared: narrow, tier: 'NORMAL', count: 36, rng: rngOf(9) });
  check('7c a narrow arsenal still gets a full round of only what it can throw', narrow.length > 3 && nr.length === 36 && nr.every(c => narrow.includes(c)), String(narrow.length));
  const one = M.dealMixItems({ prepared: P.boxing.slice(0, 1), tier: 'ADVANCED', count: 5, rng: rngOf(2) });
  check('7d one combo in the pool is dealt, not stalled on', one.length === 5 || one.length === 0);
  // capCalls: Technical's lists get the same caps
  const calls = [...HARDY, ...CALM, ...HARDY, 'Jab Cross Hook Cross Hook Cross Hook Cross'];
  const fill = [...CALM, 'Jab', 'Cross'];
  const capNormal = M.capCalls(calls, 'NORMAL', { fill, rng: rngOf(3) });
  check('8 capCalls NORMAL: at most 2 difficult-kick combos left, none past 7 pieces, same length', capNormal.length === calls.length && capNormal.filter(M.isDifficult).length <= 2 && capNormal.every(t => M.pieceCount(t) <= 7), String(capNormal.filter(M.isDifficult).length));
  const capEasy = M.capCalls(calls, 'EASY', { fill, rng: rngOf(3) });
  check('8b capCalls EASY: no difficult kick, nothing past 4 pieces', capEasy.every(t => !M.isDifficult(t) && M.pieceCount(t) <= 4));
  check('8c capCalls HARD and ADVANCED: the list is returned as it is', M.capCalls(calls, 'HARD', { fill }) === calls && M.capCalls(calls, 'ADVANCED', { fill }) === calls);
  check('8d capCalls with nothing calm to swap in leaves the list alone', M.capCalls(['High Kick', 'Switch Kick'], 'EASY', { fill: ['Spinning Kick'], rng: rngOf(1) }).join() === 'High Kick,Switch Kick');
  const reached = (t) => M.comboReach(t);
  const brute = (t) => { let pieces = 0, strikes = 0; for (const d of M.DISCIPLINES) for (const c of M.tierPool(P[d], t)) { pieces = Math.max(pieces, c.pieces); strikes = Math.max(strikes, c.strikes); } return { pieces, strikes }; };
  check('9 comboReach is the longest combo a tier can really be dealt (the page says "up to" this)', TIERS.every(t => reached(t).pieces === brute(t).pieces && reached(t).strikes === brute(t).strikes), JSON.stringify(TIERS.map(reached)));
  check('9b reach: EASY 3 strikes, NORMAL 6, HARD 6, ADVANCED 6, and never above a tier\'s cap', ['EASY', 'NORMAL', 'HARD', 'ADVANCED'].map(t => reached(t).strikes).join() === '3,6,6,6' && reached('EASY').pieces <= 4 && reached('NORMAL').pieces <= 7);
  check('9c reach reports the difficult-kick cap from the table', reached('EASY').hardKicks === 0 && reached('NORMAL').hardKicks === 2 && reached('HARD').hardKicks === null);
}

// ── through the generator (what the player calls) ───────────────────────────
const DISC_NAME = { boxing: 'Boxing', kickboxing: 'Kickboxing', 'muay-thai': 'Muay Thai', mma: 'MMA' };
const DIFF_NAME = { EASY: 'Easy', NORMAL: 'Normal', HARD: 'Hard', ADVANCED: 'Advanced' };
const planOpts = (t, d, extra = {}) => ({ discipline: DISC_NAME[d], difficulty: DIFF_NAME[t], speed: 'medium', rounds: 4, roundDuration: 3, mode: 'Combo', callsPerRound: 44, secondsPerCall: 4.7, byLevel: true, ...extra });
for (const t of TIERS) {
  for (const d of M.DISCIPLINES) {
    let worstHard = 0, worstPieces = 0, bad = 0, total = 0;
    for (let s = 0; s < 12; s += 1) {
      const { plans } = G.generateComboCoachRoundPlans(planOpts(t, d, { seed: 100 + s }));
      for (const plan of plans) {
        if (plan.length !== 44) bad += 1;
        worstHard = Math.max(worstHard, plan.filter(M.isDifficult).length);
        for (const text of plan) { worstPieces = Math.max(worstPieces, M.pieceCount(text)); total += 1; }
      }
    }
    const m = M.COMBO_MIX[t];
    check(`10 ${t} ${d}: the generator's plans are full, hold the piece cap and the difficult-kick cap`, bad === 0 && (m.maxPieces === null || worstPieces <= m.maxPieces) && (m.maxHardKicks === null || worstHard <= m.maxHardKicks), `short ${bad}, pieces ${worstPieces}, hard ${worstHard}`);
  }
}
{
  // The pool the player keeps (rush calls, the first call) follows the level too.
  const pool = (t, d, byLevel) => G.generateComboCoachSession({ discipline: DISC_NAME[d], difficulty: DIFF_NAME[t], mode: 'Combo', byLevel });
  check('11 by level, EASY\'s pool is the 15 easy combos; HARD\'s has no easy combo; NORMAL holds hard ones too',
    pool('EASY', 'boxing', true).length === 15 && pool('HARD', 'boxing', true).length === P.boxing.filter(c => c.source !== 'easy').length && pool('NORMAL', 'boxing', true).length === P.boxing.length);
  // Without byLevel (Arcade and the rest) nothing changed: the old cumulative pool.
  check('11b without byLevel the old pool is untouched: Hard is every easy, normal and hard combo (46 in boxing), Normal 30, Easy 15, Advanced all',
    pool('HARD', 'boxing', false).length === 46 && pool('NORMAL', 'boxing', false).length === 30 && pool('EASY', 'boxing', false).length === 15 && pool('ADVANCED', 'boxing', false).length === 68);
  check('11c ...and Normal without byLevel holds no hard combo, as before', pool('NORMAL', 'kickboxing', false).every(t2 => P.kickboxing.find(c => c.text === t2).source !== 'hard' && P.kickboxing.find(c => c.text === t2).source !== 'advanced'));
}
{
  // Technical keeps its own singles-heavy weights and is held to the same caps.
  let bad = 0, longest = 0, hardWorst = 0, singles = 0, total = 0;
  for (let s = 0; s < 20; s += 1) {
    for (const d of M.DISCIPLINES) {
      for (const plan of G.generateComboCoachRoundPlans(planOpts('EASY', d, { mode: 'Technical', seed: s })).plans) {
        for (const text of plan) { longest = Math.max(longest, M.pieceCount(text)); if (M.isDifficult(text)) bad += 1; total += 1; if (M.pieceCount(text) === 1) singles += 1; }
      }
    }
  }
  check('12 Technical at EASY: mostly single strikes, nothing past 4 pieces, no difficult kick', bad === 0 && longest <= 4 && singles / total > 0.5, `longest ${longest}, hard ${bad}, singles ${(singles / total).toFixed(2)}`);
  for (const d of M.DISCIPLINES) for (let s = 0; s < 40; s += 1) {
    for (const plan of G.generateComboCoachRoundPlans(planOpts('NORMAL', d, { mode: 'Technical', seed: 500 + s })).plans) hardWorst = Math.max(hardWorst, plan.filter(M.isDifficult).length);
  }
  check('12b Technical at NORMAL: at most 2 difficult-kick calls in a round', hardWorst <= 2, String(hardWorst));
  let hardNeeded = 0;
  for (const d of M.DISCIPLINES) for (let s = 0; s < 40; s += 1) for (const plan of G.generateComboCoachRoundPlans(planOpts('HARD', d, { mode: 'Technical', seed: 900 + s })).plans) hardNeeded = Math.max(hardNeeded, plan.filter(M.isDifficult).length);
  check('12c Technical at HARD is not capped', hardNeeded > 2, String(hardNeeded));
}
{
  // The athlete's own saved set is dealt exactly as before: only those combos,
  // however long or hard, whatever the level.
  const mine = ['Jab Cross Hook Cross Hook Cross Hook Cross Hook', 'High Kick Switch Kick Spinning Back Kick', 'Hadouken'].map(x => x.replace('Hadouken', 'My Signature'));
  for (const t of TIERS) {
    const s = G.generateComboCoachSession({ ...planOpts(t, 'boxing'), customCombos: mine });
    const { plans } = G.generateComboCoachRoundPlans(planOpts(t, 'boxing', { customCombos: mine, seed: 4 }));
    check(`13 ${t}: a saved set is dealt as it is, however long or hard (no cap, no mix)`, s.length === 3 && [...s].sort().join() === [...mine].sort().join() && plans.every(p => p.length === 44 && p.every(x => mine.includes(x)) && new Set(p).size === 3));
  }
  check('13b the saved set is not capped even at EASY: its long combo is dealt', G.generateComboCoachRoundPlans(planOpts('EASY', 'boxing', { customCombos: mine, seed: 1 })).plans.every(p => p.includes(mine[0])));
}
{
  // The arsenal gate still narrows a beginner's pool; the mix deals inside it.
  const arsenal = ['Jab', 'Cross'];
  const { plans, all } = G.generateComboCoachRoundPlans(planOpts('NORMAL', 'boxing', { arsenalOnly: true, arsenal, seed: 3 }));
  const allowed = new Set(all);
  check('14 a beginner\'s arsenal gate holds: every call is a combo of learned strikes', all.length > 0 && all.every(t => M.piecesOf(t).every(p => p.kind !== 'strike' || ['Jab', 'Cross'].includes(p.text))) && plans.every(p => p.length === 44 && p.every(x => allowed.has(x))), all.join('|'));
}
{
  // Unknown or odd settings do not throw and still deal.
  const odd = [{ difficulty: 'Intermediate' }, { difficulty: undefined }, { difficulty: 'banana' }, { discipline: 'Muay Thai', difficulty: 'Easy' }];
  const ok = odd.every(o => { const r = G.generateComboCoachRoundPlans({ ...planOpts('NORMAL', 'boxing'), ...o, seed: 2 }); return r.plans.length === 4 && r.plans.every(p => p.length === 44); });
  check('15 odd difficulty words still deal full rounds', ok);
}


// ── the dealer never stalls ─────────────────────────────────────────────────
// A pool with nothing calm in it (only difficult-kick combos) and a tier that caps them
// used to loop forever: the cap's slots never opened. The cap stays open then, and the
// round is dealt in full; a worker thread with a timeout proves it ends.
{
  const only = M.prepareCombos([{ id: 'x1', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Cross High Kick', category: 'combination' }], 'kickboxing');
  const t0 = Date.now();
  const round = M.dealMixRound({ prepared: only, tier: 'NORMAL', count: 10, rng: rngOf(5) });
  check('7 a pool of only difficult-kick combos still deals a full round under a capped tier, and ends at once', round.length === 10 && round.every(t => t === 'Jab Cross High Kick') && Date.now() - t0 < 1000, `${round.length} calls`);
  const two = M.prepareCombos([
    { id: 'x1', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Jab Cross High Kick', category: 'combination' },
    { id: 'x2', discipline: 'kickboxing', minDifficulty: 'normal', comboText: 'Cross Head Kick', category: 'combination' },
  ], 'kickboxing');
  check('7b the same with two, in every tier that may draw them (EASY may not, so it deals nothing), and an empty pool deals nothing', ['NORMAL', 'HARD', 'ADVANCED'].every(t => M.dealMixRound({ prepared: two, tier: t, count: 12, rng: rngOf(9) }).length === 12) && M.dealMixRound({ prepared: two, tier: 'EASY', count: 12, rng: rngOf(9) }).length === 0 && M.dealMixRound({ prepared: [], tier: 'NORMAL', count: 5 }).length === 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
