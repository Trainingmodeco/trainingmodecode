// The cardio session builder, checked against the real exercise library.
// Run with `npm run test:cardio` (needs the extensionless loader, because the
// module imports a sibling the way Metro resolves it).
//
// The point of the pool assertions is that every movement the owner asked for
// by name is actually reachable, and that nothing needing a rack, a barbell or
// a set of cones can ever be generated — a suggested session you cannot start
// is worse than no suggestion.

import { cardioMovePool, availableMoves, generateCardioSession, swapMove, reorderMove, removeMove, sessionToIntervalConfig, moveAtInterval, scaleForLevel }
  from '../components/training-mode/data/cardioGenerator.js';
let pass=0, fail=0;
const ok=(n,c,x='')=>{ if(c){pass++;console.log('  ok   '+n+(x?'  '+x:''));} else {fail++;console.log('  FAIL '+n+'  '+x);} };

const pool = cardioMovePool();
console.log('pool size:', pool.length);
console.log(pool.map(m=>`${m.name} [${m.category}/${m.difficulty}/${m.equipment}]`).join('\n'));

const names = pool.map(m=>m.name);
// Everything the owner named must be reachable.
for (const want of ['Burpees','Jumping Jacks','Tuck Jumps','Explosive Push-Ups','Jumping Lunges','Sprints',
  'Medicine Ball Slams','High Knees','Mountain Climbers','Hurdle Jumps','Explosive Pull-Ups',
  'Battle Rope Slams','Shadowbox — Hands Only','Shadowbox — Kicks Only','Shadowbox — Knees Only']) {
  ok(`pool has ${want}`, names.includes(want));
}
ok('jump rope present', names.some(n=>/Jump Rope/i.test(n)));
ok('burpee+shadowbox combo present', names.some(n=>/Burpee to Shadowbox/i.test(n)));
// Nothing needing a rack, barbell, cable or cones.
const banned = pool.filter(m => /Barbell|Trap Bar|Cable|Cones|Agility Ladder|Dip Station|Sandbag|Dummy|Ankle Weights|Speed Bag/.test(m.equipment || ''));
ok('no advanced/gym-only equipment', banned.length===0, banned.map(b=>b.name).join(', ')||'clean');
ok('no Advanced difficulty', pool.every(m=>m.difficulty!=='Advanced'));

// Level gating.
const l1 = availableMoves(1).map(m=>m.difficulty);
ok('level 1 gets Easy only', l1.every(d=>d==='Easy'), [...new Set(l1)].join(','));
ok('level 7 unlocks Hard', availableMoves(7).some(m=>m.difficulty==='Hard'));
ok('higher level = more moves', availableMoves(9).length > availableMoves(1).length,
  `${availableMoves(1).length} -> ${availableMoves(9).length}`);

// Deterministic generation.
let seed=42; const rng=()=>((seed=seed*1103515245+12345&0x7fffffff)/0x7fffffff);
// A brand-new athlete has a deliberately small pool, so a 5-move request comes
// back short rather than reaching for movements they have not earned.
const beginner = generateCardioSession({ level: 1, moveCount: 5, rng });
ok('level 1 session is short, not padded with Hard moves',
  beginner.moves.length === availableMoves(1).length && beginner.moves.every(m=>m.difficulty==='Easy'),
  `${beginner.moves.length} moves`);
ok('level 2 can fill a full card', generateCardioSession({ level: 2, moveCount: 5, rng }).moves.length === 5);

const s = generateCardioSession({ level: 7, moveCount: 5, rng });
console.log('\nsample level-7 session:');
s.moves.forEach((m,i)=>console.log(`  ${i+1}. ${m.name}  (${m.category})`));
console.log(`  ${s.moves.length} moves · ${s.rounds} rounds · ${s.workSec}s work / ${s.restSec}s rest · total ${Math.round(s.totalSec/60)}min`);
ok('5 distinct moves', new Set(s.moves.map(m=>m.id)).size===5);
ok('total maths', s.totalSec === 5*(s.workSec+s.restSec)*s.rounds, String(s.totalSec));
ok('scale by level differs', JSON.stringify(scaleForLevel(1))!==JSON.stringify(scaleForLevel(9)));

// Swap replaces exactly one and never duplicates.
const sw = swapMove(s, 2, { level: 7, rng });
const kept = s.moves.filter((_,i)=>i!==2).map(m=>m.id);
const keptAfter = sw.moves.filter((_,i)=>i!==2).map(m=>m.id);
ok('swap changes only index 2', JSON.stringify(kept)===JSON.stringify(keptAfter), keptAfter.join(','));
ok('swap actually changed it', sw.moves[2].id !== s.moves[2].id, `${s.moves[2].name} -> ${sw.moves[2].name}`);
ok('swap keeps all distinct', new Set(sw.moves.map(m=>m.id)).size===5);

// Reorder.
const up = reorderMove(s, 2, 'up');
ok('move up swaps 1 and 2', up.moves[1].id===s.moves[2].id && up.moves[2].id===s.moves[1].id);
ok('cannot move first up', reorderMove(s,0,'up').moves[0].id===s.moves[0].id);
ok('cannot move last down', reorderMove(s,4,'down').moves[4].id===s.moves[4].id);

// Remove, with a floor.
const rm = removeMove(s, 0);
ok('remove drops one and retotals', rm.moves.length===4 && rm.totalSec===4*(s.workSec+s.restSec)*s.rounds);
let tiny = { moves: s.moves.slice(0,2), workSec: 40, restSec: 20, rounds: 3 };
ok('will not go below two moves', removeMove(tiny,0).moves.length===2);

// Interval config + the movement the coach names.
const cfg = sessionToIntervalConfig(s, 3);
ok('interval config rounds = moves x rounds', cfg.rounds === 5*s.rounds, String(cfg.rounds));
ok('warmup carried in seconds', cfg.warmupSeconds===180);
ok('coach names move 1 at interval 0', moveAtInterval(s,0).id===s.moves[0].id);
ok('cycles back round', moveAtInterval(s,5).id===s.moves[0].id);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
