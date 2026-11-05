// Prints what Combo Coach deals at each level, from the real pool: the weights
// table, the pool's piece counts per pool tier and discipline, and a few thousand
// dealt calls per level and discipline (share per pool tier, pieces, difficult
// kicks a round), plus one sample round per level. Read-only; for the owner and
// the lead to look at, and for the tests' numbers to be checked by eye.
//   node --import ./scripts/extensionless-loader-register.mjs scripts/print-combo-mix.mjs > cc-mix.txt
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const M = await import('../components/training-mode/data/comboMix.js');
const { default: POOL } = await import('../components/training-mode/data/comboCoachData.js');
const A = await import('../components/training-mode/data/athleteLevel.js');

const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const pad = (v, n) => String(v).padEnd(n);
const num = (v, n) => String(v).padStart(n);
const pct = (a, b) => `${((100 * a) / Math.max(1, b)).toFixed(1)}%`;
const P = M.preparedPool();
const out = [];
const say = (s = '') => out.push(s);

say('COMBO COACH BY LEVEL: what each level deals (from the real combo pool)');
say('===================================================================');
say();
say('LEVELS');
say('  EASY      levels 1-2    (Quick Mission reads this as EASY)');
say('  NORMAL    levels 3-5    (Quick Mission: MEDIUM)');
say('  HARD      levels 6-9');
say('  ADVANCED  level 10 and up');
say('  Combo Coach reads the athlete\'s FIGHT level: own Fight XP in full, all other XP at half.');
say();
say('PIECES: a combo\'s length. Strikes, defence words (Slip, Roll, Feint, Pivot, Pull, Parry, Check, Counter)');
say('and movement words (Sprawl, Level Change, Clinch...) all count; "Double" counts twice. Defence counts, so');
say('the cap is the strict reading of "no more than 4": strikes never outnumber pieces.');
say(`DIFFICULT KICKS: ${M.DIFFICULT_KICKS.join(', ')}.`);
say();

say('THE TABLE (share of calls out of 100 by the pool tier a combo comes from, data/comboMix.js COMBO_MIX)');
say(`  ${pad('level', 10)}${num('easy', 6)}${num('normal', 8)}${num('hard', 6)}${num('adv', 6)}  ${pad('single%', 12)}${pad('max pieces', 12)}${pad('hard kicks/round', 18)}swing`);
for (const t of A.TIERS) {
  const m = M.COMBO_MIX[t]; const w = m.weights;
  say(`  ${pad(t, 10)}${num(w.easy, 6)}${num(w.normal, 8)}${num(w.hard, 6)}${num(w.advanced, 6)}  ${pad(`${m.singleShare}% of easy`, 12)}${pad(m.maxPieces === null ? 'none' : m.maxPieces, 12)}${pad(m.maxHardKicks === null ? 'no limit' : m.maxHardKicks, 18)}${m.swing ? `yes (runs of ${M.SWING_RUN_MAX} at most)` : 'no'}`);
}
say();

say('THE POOL: combos per pool tier and discipline, with their piece counts (min / avg / max) and difficult-kick combos');
for (const d of M.DISCIPLINES) {
  say(`  ${d}`);
  say(`    ${pad('pool tier', 10)}${num('combos', 7)}${num('singles', 9)}${num('min', 5)}${num('avg', 6)}${num('max', 5)}${num('with hard kick', 16)}   pieces histogram (1..7)`);
  for (const s of M.SOURCE_TIERS) {
    const list = P[d].filter((c) => c.source === s);
    if (!list.length) { say(`    ${pad(s, 10)}${num(0, 7)}`); continue; }
    const counts = list.map((c) => c.pieces);
    const hist = [1, 2, 3, 4, 5, 6, 7].map((n) => counts.filter((x) => x === n).length).join(' ');
    say(`    ${pad(s, 10)}${num(list.length, 7)}${num(list.filter((c) => c.single).length, 9)}${num(Math.min(...counts), 5)}${num((counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1), 6)}${num(Math.max(...counts), 5)}${num(list.filter((c) => c.hard).length, 16)}   ${hist}`);
  }
}
say(`  The whole pool: ${POOL.length} combos, longest ${Math.max(...POOL.map((c) => M.pieceCount(c.comboText)))} pieces.`);
say();

say('WHAT EACH LEVEL CAN EVER DEAL (the pool after the caps)');
say(`  ${pad('level', 10)}${pad('discipline', 12)}${num('combos', 8)}${num('max pieces', 12)}${num('max strikes', 13)}${num('hard-kick combos', 18)}`);
for (const t of A.TIERS) for (const d of M.DISCIPLINES) {
  const list = M.tierPool(P[d], t);
  say(`  ${pad(t, 10)}${pad(d, 12)}${num(list.length, 8)}${num(Math.max(...list.map((c) => c.pieces)), 12)}${num(Math.max(...list.map((c) => c.strikes)), 13)}${num(list.filter((c) => c.hard).length, 18)}`);
}
say();
say('  What the Level page says (read from the same table and pool):');
for (const t of A.TIERS) { const r = M.comboReach(t); say(`    ${pad(t, 10)}up to ${r.strikes}-strike combos (${r.pieces} pieces); difficult kicks per round: ${r.hardKicks === null ? 'no limit' : r.hardKicks}`); }
say();

const ROUNDS = 200, CALLS = 40;
say(`DEALT: ${ROUNDS} rounds of ${CALLS} calls (${ROUNDS * CALLS} calls) per level and discipline`);
say(`  ${pad('level', 10)}${pad('discipline', 12)}${num('easy%', 7)}${num('norm%', 7)}${num('hard%', 7)}${num('adv%', 7)}${num('avg pcs', 9)}${num('max pcs', 9)}${num('singles%', 10)}${num('hk/rnd avg', 12)}${num('hk/rnd max', 12)}${num('distinct', 10)}${num('band swaps', 12)}`);
for (const t of A.TIERS) {
  for (const d of M.DISCIPLINES) {
    const rng = rngOf(7000 + t.length * 31 + d.length);
    const share = { easy: 0, normal: 0, hard: 0, advanced: 0 };
    let calls = 0, pieces = 0, maxP = 0, singles = 0, hardTotal = 0, hardMax = 0, swaps = 0;
    const seen = new Set();
    for (let r = 0; r < ROUNDS; r += 1) {
      const items = M.dealMixItems({ prepared: P[d], tier: t, count: CALLS, rng });
      let hard = 0, last = -1;
      for (const c of items) {
        share[c.source] += 1; calls += 1; pieces += c.pieces; maxP = Math.max(maxP, c.pieces); seen.add(c.text);
        if (c.pieces === 1) singles += 1;
        if (c.hard) hard += 1;
        const band = c.source === 'easy' ? 0 : c.source === 'normal' ? 1 : 2;
        if (last !== -1 && band !== last) swaps += 1;
        last = band;
      }
      hardTotal += hard; hardMax = Math.max(hardMax, hard);
    }
    say(`  ${pad(t, 10)}${pad(d, 12)}${num(pct(share.easy, calls), 7)}${num(pct(share.normal, calls), 7)}${num(pct(share.hard, calls), 7)}${num(pct(share.advanced, calls), 7)}${num((pieces / calls).toFixed(2), 9)}${num(maxP, 9)}${num(pct(singles, calls), 10)}${num((hardTotal / ROUNDS).toFixed(2), 12)}${num(hardMax, 12)}${num(seen.size, 10)}${num((swaps / ROUNDS).toFixed(1), 12)}`);
  }
}
say('  (avg pcs: the average combo length; singles%: one-piece calls; hk/rnd: combos with a difficult kick in a round;');
say('   distinct: how many different combos came up; band swaps: changes between single/basic, mid-tier and hard/advanced in a 40-call round)');
say();

say('SAMPLE ROUNDS (12 calls each, boxing and kickboxing; [source tier, pieces], * marks a difficult kick)');
for (const t of A.TIERS) {
  for (const d of ['boxing', 'kickboxing']) {
    const items = M.dealMixItems({ prepared: P[d], tier: t, count: 12, rng: rngOf(42 + t.length) });
    say(`  ${pad(t, 9)}${pad(d, 11)}${items.map((c) => `${c.text}${c.hard ? '*' : ''} [${c.source[0]}${c.pieces}]`).join(' | ')}`);
  }
}
say();

console.log(out.join('\n'));
