// The path + stars (retention feature 2): the star rule per saga type (the
// classic saga's time tiers, one star per path on a multi-path v2 saga, one on
// a single-path one, one per arc on a concept saga, a check mark where there
// are no tiers), what the next star needs, the path's node states against the
// ladder's own gate, Training Camp's 12 levels (S1/S2 pips, the title fight as
// the boss, check marks), Home's NEXT UP row from the last session, and that
// none of it writes to storage.
// Run with `npm run test:path`.
const store = new Map();
let writes = 0;
const ls = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { writes++; store.set(k, String(v)); },
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.localStorage = ls;
globalThis.window = { localStorage: ls, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.Event = globalThis.Event || class { constructor(t) { this.type = t; } };

const P = await import('../components/training-mode/data/pathStars.js');
const N = await import('../components/training-mode/data/pathNextUp.js');
const A = await import('../components/training-mode/data/trainingArcadeData.js');
const CS = await import('../components/training-mode/data/concepts/saga.js');
const CI = await import('../components/training-mode/data/concepts/index.js');
const FX = await import('../components/training-mode/data/fightSessionXp.js');
const { campLevels } = await import('../components/training-mode/protocol/content.ts');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const section = (t) => console.log(`\n${t}`);

const byId = (id) => A.TRAINING_ARCADE_SERIES.find((s) => s.id === id);
const OP = byId('one-punch-protocol');
const GRAV = byId('gravity-chamber-protocol');
const MM = byId('martial-monster-protocol');
const GRAP = byId('grappler-protocol');
const DEMON = byId('demon-back-protocol');
const conceptId = CI.CONCEPT_SCHEDULE[0].concept.id;
const CONCEPT = CS.conceptSaga(conceptId);

section('star rule per saga type');
check('classic saga: time tiers, 3', eq(P.sagaStarRule(OP), { kind: 'time', max: 3 }));
check('classic stage with tiers: 3, fastest first', P.stageStarRule(OP, OP.stages[1]).kind === 'time' && P.stageStarRule(OP, OP.stages[1]).tiers[0].stars === 3);
check('classic benchmark (stage 1) tiers from its scoring tiers', P.stageStarRule(OP, OP.stages[0]).tiers?.[0]?.maxMinutes === 15);
check('a stage with no tiers: none, 0', eq(P.stageStarRule(DEMON, DEMON.stages[0]), { kind: 'none', max: 0 }));
check('multi-path v2 (Grappler): one per path, 3', P.sagaStarRule(GRAP).kind === 'paths' && P.sagaStarRule(GRAP).max === 3);
check('multi-path v2 (Martial Monster): 2 paths, 2', P.sagaStarRule(MM).kind === 'paths' && P.sagaStarRule(MM).max === 2);
check('single-path v2 (Gravity Chamber): 1', eq(P.sagaStarRule(GRAV), { kind: 'single', max: 1, paths: ['fit'] }));
check('concept saga: by arcs, 3', P.sagaStarRule(CONCEPT).kind === 'arcs' && P.sagaStarRule(CONCEPT).max === 3);

section('stage stars from what is stored');
const op2 = OP.stages[1]; // 3★ < 22, 2★ < 28, 1★ < 36
check('not cleared: 0 stars', P.stageStars(OP, op2, undefined).stars === 0 && !P.stageStars(OP, op2, undefined).cleared);
check('cleared with no stars saved reads 1 (the ladder\'s `stars || 1`)', P.stageStars(OP, op2, { completed: true }).stars === 1);
let info = P.stageStars(OP, op2, { completed: true, stars: 2, bestTimeSeconds: 22 * 60 + 11 });
check('2★, best 22:11: next star is the third, under 22:00', info.stars === 2 && info.next.stars === 3 && info.next.needs === 'under 22:00');
check('… 11 s off (the two times as the tiles show them)', info.next.gapSec === 11, JSON.stringify(info.next));
check('… line', P.nextStarLine(info) === '11 s off the third star. Replays keep your best result.', P.nextStarLine(info));
info = P.stageStars(OP, op2, { completed: true, stars: 1, bestTimeSeconds: 30 * 60 + 5 });
check('1★, best 30:05: the second star needs under 28:00, 2:05 off', info.next.stars === 2 && info.next.needs === 'under 28:00' && P.fmtGap(info.next.gapSec) === '2:05');
// The replay sheet's line agrees with its tiles (YOUR BEST · ★★★ NEEDS under m:ss).
const op3 = OP.stages[2];
info = P.stageStars(OP, op3, { completed: true, stars: 2, bestTimeSeconds: 17 * 60 + 40 });
check('YOUR BEST 17:40 · under 15:00 → "2:40 off the third star" (was 2:41)', P.fmtTime(info.bestSec) === '17:40' && info.next.needs === 'under 15:00'
  && P.nextStarLine(info).startsWith('2:40 off the third star.'), `${P.fmtTime(info.bestSec)} ${info.next.needs} ${P.nextStarLine(info)}`);
info = P.stageStars(OP, op2, { completed: true, stars: 2, bestTimeSeconds: 22 * 60 });
check('a best exactly on the line (22:00, under 22:00): 1 s off, never 0', info.next.gapSec === 1 && P.nextStarLine(info).startsWith('1 s off'), JSON.stringify(info.next));
check('times show whole seconds cut down: 17:40.6 → 17:40, 17:59.7 → 17:59 (never 17:60)', P.fmtTime(1060.6) === '17:40' && P.fmtTime(1079.7) === '17:59' && P.fmtTime(1080) === '18:00');
{
  // Every best time from the line to 12 minutes over, in tenths: the gap in
  // the line is the difference of the two tiles as shown.
  const sec = (t) => { const [m, x] = t.split(':').map(Number); return m * 60 + x; };
  let bad = null;
  for (let t = 22 * 60; t <= 34 * 60 && !bad; t += 0.1) {
    const i2 = P.stageStars(OP, op2, { completed: true, stars: 2, bestTimeSeconds: t });
    const shown = sec(P.fmtTime(i2.bestSec)), need = sec(i2.next.needs.replace('under ', ''));
    const gapText = P.nextStarLine(i2).split(' off ')[0];
    const gap = gapText.endsWith(' s') ? Number(gapText.slice(0, -2)) : sec(gapText);
    if (gap !== Math.max(1, shown - need)) bad = `${t.toFixed(1)}: ${P.fmtTime(i2.bestSec)} vs ${i2.next.needs} → ${gapText}`;
  }
  check('the line always agrees with the tiles (22:00 to 34:00 in tenths)', !bad, bad || '');
}
info = P.stageStars(OP, op2, { completed: true, stars: 1 });
check('no best time stored: says the time to beat', P.nextStarLine(info) === 'Finish under 28:00 for the second star. Replays keep your best result.', P.nextStarLine(info));
info = P.stageStars(OP, op2, { completed: true, stars: 3, bestTimeSeconds: 1200 });
check('3★: nothing left', info.next === null && /All three stars/.test(P.nextStarLine(info)));
check('stored 5 is capped at 3', P.stageStars(OP, op2, { completed: true, stars: 5 }).stars === 3);
info = P.stageStars(DEMON, DEMON.stages[0], { completed: true, stars: 1 });
check('no tiers: a check mark, no stars', info.check && info.stars === null && info.max === 0);
check('no tiers, not cleared: no stars either', P.stageStars(DEMON, DEMON.stages[0], undefined).stars === null);
info = P.stageStars(GRAP, GRAP.stages[0], { completed: true, stars: 1, paths: ['fit'] });
check('Grappler, FIT cleared: 1 of 3, FIGHT and BOTH left', info.stars === 1 && info.max === 3 && eq(info.missing, ['fight', 'both']));
check('… line names the paths', P.nextStarLine(info) === 'One star per path cleared. Next: FIGHT or BOTH.', P.nextStarLine(info));
info = P.stageStars(MM, MM.stages[0], { completed: true, stars: 3, paths: ['fit', 'fight'] });
check('Martial Monster: an old 3 reads 2 of 2 (its max), nothing left', info.stars === 2 && info.max === 2 && info.next === null);
info = P.stageStars(GRAP, GRAP.stages[0], { completed: true, stars: 2 });
check('an old clear with no paths saved: stars kept, paths unknown', info.stars === 2 && eq(info.missing, []) && P.nextStarLine(info) === 'One star per path cleared. Replays keep your best result.', P.nextStarLine(info));
info = P.stageStars(GRAV, GRAV.stages[0], { completed: true, stars: 3, paths: ['fit'] });
check('Gravity Chamber: 1 of 1 whatever was stored', info.stars === 1 && info.max === 1 && /One star for a clear/.test(P.nextStarLine(info)));
info = P.stageStars(CONCEPT, CONCEPT.stages[0], { completed: true, stars: 2, paths: ['fit', 'both'] });
check('concept: 2 arcs of 3, FIGHT left', info.stars === 2 && eq(info.missing, ['fight']) && P.nextStarLine(info) === 'One star per arc cleared. Next: FIGHT.');

section('the saga path against the ladder\'s gate');
const prog = (map) => ({ completedStages: Object.fromEntries(Object.entries(map).map(([id, v]) => [id, { completed: true, ...v }])) });
let p = P.sagaPath(OP, prog({ 'op-stage-1': { stars: 3 }, 'op-stage-2': { stars: 2 }, 'op-stage-3': {} }));
check('3 cleared: stage 4 is current, 5..10 locked', p.current === 3 && p.nodes.slice(0, 3).every((n) => n.state === 'cleared') && p.nodes.slice(4).every((n) => n.state === 'locked'));
check('stars earned 3+2+1 of 30', p.earned === 6 && p.total === 30 && p.hasStars);
check('the boss is the last node', p.nodes.at(-1).boss && !p.nodes[0].boss);
p = P.sagaPath(OP, prog({ 'op-stage-1': {}, 'op-stage-2': {}, 'op-stage-4': {} }));
check('a gap (4 cleared, 3 not): 3 is current, 4 shows cleared, 5 locked', p.current === 2 && p.nodes[3].state === 'cleared' && p.nodes[4].state === 'locked');
p = P.sagaPath(OP, prog(Object.fromEntries(OP.stages.map((s) => [s.id, { stars: 3 }]))));
check('all cleared: no current, 30 of 30', p.current === -1 && p.allCleared && p.earned === 30);
p = P.sagaPath({ ...CONCEPT, maxUnlocked: 2 }, prog({ [CONCEPT.stages[0].id]: {}, [CONCEPT.stages[1].id]: {} }));
check('a concept gate (maxUnlocked 2) after 2 clears: no current, stage 3 locked', p.current === -1 && p.nodes[2].state === 'locked');
p = P.sagaPath({ ...CONCEPT, maxUnlocked: 0 }, prog({}));
check('a concept gate of 0: every stage locked', p.nodes.every((n) => n.state === 'locked'));
p = P.sagaPath(DEMON, prog({ 'db-s1': {} }));
check('a saga with no tiers: no stars to earn, a check on the clear', !p.hasStars && p.nodes[0].check && p.nodes[0].stars === null);
const ladderState = (i) => (i < 2 ? 'complete' : i === 2 ? 'current' : 'locked');
p = P.sagaPath(OP, prog({}), ladderState);
check('the ladder\'s own stageState wins when given', p.current === 2 && p.nodes[0].state === 'cleared');
// The ladder's gate is the same count as openStageCount on every prefix.
let same = true;
for (let k = 0; k <= OP.stages.length; k++) {
  const pr = prog(Object.fromEntries(OP.stages.slice(0, k).map((s) => [s.id, {}])));
  if (P.openStageCount(OP, pr) !== Math.min(OP.stages.length, k + 1)) same = false;
}
check('open stages = cleared + 1 on every prefix (capped at 10)', same);

section('Training Camp');
let cp = P.campPath({ levels: campLevels, current: 5, sessions: { 5: { s1: true } } });
check('12 levels in order', cp.nodes.length === 12 && cp.nodes[0].number === 1 && cp.nodes[11].number === 12);
check('level 5 current, 1..4 cleared with a check, 6..12 locked', cp.current === 4 && cp.nodes.slice(0, 4).every((n) => n.state === 'cleared' && n.check) && cp.nodes.slice(5).every((n) => n.state === 'locked'));
check('no stars anywhere', cp.nodes.every((n) => n.stars === null && n.max === 0) && !cp.hasStars);
check('split levels 4..11 carry S1/S2 pips; 1..3 and 12 do not', cp.nodes.every((n) => (n.number >= 4 && n.number <= 11) === !!n.pips));
check('level 5: S1 done, S2 not; level 4 (cleared): both', eq(cp.nodes[4].pips, { s1: true, s2: false }) && eq(cp.nodes[3].pips, { s1: true, s2: true }));
check('level 12 is the boss', cp.nodes[11].boss && cp.nodes.filter((n) => n.boss).length === 1);
cp = P.campPath({ levels: campLevels, current: 12, campDone: true });
check('title won: all 12 cleared, no current', cp.allCleared && cp.current === -1);
cp = P.campPath({ levels: campLevels, current: 12 });
check('on the title fight, not won: 12 is current', cp.current === 11 && cp.nodes[11].state === 'current');

section('the path\'s layout, from the real width');
let inside = true, climbs = true;
for (const w of [300, 328, 360, 390, 430, 768]) {
  const L = P.pathLayout(12, w);
  L.pts.forEach((pt, i) => {
    const half = P.PATH_SIZE.boss / 2;
    if (pt.x - half < P.PATH_EDGE - 0.01 || pt.x + half > w - P.PATH_EDGE + 0.01) inside = false;
    if (i > 0 && !(pt.y < L.pts[i - 1].y)) climbs = false;
  });
  if (L.pts[0].y + 70 !== L.height) climbs = false;
}
check('at 300 to 768 px every node (boss size) keeps 16 px from the sides', inside);
check('node 1 at the bottom, each next one higher', climbs);
check('the road is centred on the box, not on a fixed 360', P.pathLayout(1, 430).pts[0].x === 215 && P.pathLayout(1, 360).pts[0].x === 180);

// The label under a node (stars, or the camp's S1/S2 pips) hangs clear of the
// road: no point of either road segment at the node comes within the road's
// half stroke of the label, and the label stays inside the box. Sizes: 3, 2
// and 1 stars, the cleared and the locked pips, under a plain node and under
// the current one (bigger, with its ring).
const roadHits = (a, b, r, pad) => {
  for (let k = 0; k <= 400; k++) {
    const t = k / 400, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
    if (x >= r.l - pad && x <= r.r + pad && y >= r.t - pad && y <= r.b + pad) return true;
  }
  return false;
};
let crossed = [], outside = [], centredFirst = true;
for (const w of [280, 300, 320, 340, 360, 375, 390, 412, 430]) {
  for (const count of [5, 10, 12]) {
    const { pts } = P.pathLayout(count, w);
    for (let i = 0; i < count; i++) {
      for (const [lw, lh, size] of [[53, 19, P.PATH_SIZE.node], [38, 19, P.PATH_SIZE.node], [23, 19, P.PATH_SIZE.node], [76, 18, P.PATH_SIZE.node], [56, 18, P.PATH_SIZE.node], [76, 18, P.PATH_SIZE.current]]) {
        const top = size / 2 + P.PATH_LABEL_GAP;
        const left = P.pathLabelLeft(pts, i, { top, w: lw, h: lh, width: w });
        const r = { l: left, r: left + lw, t: pts[i].y + top, b: pts[i].y + top + lh };
        if ((pts[i - 1] && roadHits(pts[i], pts[i - 1], r, P.PATH_ROAD_HALF)) || (pts[i + 1] && roadHits(pts[i], pts[i + 1], r, P.PATH_ROAD_HALF))) crossed.push(`${w}px/${count}/#${i}/${lw}`);
        if (left < P.PATH_LABEL_EDGE - 0.01 || left + lw > w - P.PATH_LABEL_EDGE + 0.01) outside.push(`${w}px/${count}/#${i}/${lw}`);
        if (i === 0 && Math.abs(left - (pts[0].x - lw / 2)) > 0.01) centredFirst = false;
      }
    }
  }
}
check('at 280 to 430 px the road never runs through a node\'s stars or pips', !crossed.length, crossed.slice(0, 6).join(' '));
check('… and every label stays 8 px inside the box', !outside.length, outside.slice(0, 6).join(' '));
check('… the first node (no road below it) keeps its label centred', centredFirst);
check('… a label moves off centre only as far as the road needs (the gap is the clearance)', (() => {
  const { pts } = P.pathLayout(10, 360);
  const top = P.PATH_SIZE.node / 2 + P.PATH_LABEL_GAP, lw = 53, lh = 19;
  const left = P.pathLabelLeft(pts, 4, { top, w: lw, h: lh, width: 360 });
  const dx = pts[3].x - pts[4].x; // the road below stage 5 heads right, so the label hangs left
  const roadAt = pts[4].x + (dx * top) / (pts[3].y - pts[4].y);
  return dx > 0 && Math.abs(left + lw - (roadAt - P.PATH_ROAD_HALF - P.PATH_LABEL_CLEAR)) < 0.01;
})());

section('Home NEXT UP');
const find = (over = {}) => ({
  series: ({ seriesId, conceptId: cid }) => (cid ? CONCEPT : byId(seriesId)),
  progress: () => prog({ 'op-stage-1': {}, 'op-stage-2': {} }),
  playable: A.isSeriesPlayable,
  camp: () => ({ levels: campLevels, current: 7, campDone: false, sessions: {} }),
  ...over,
});
check('no last session: hidden', P.nextUpFrom(null, find()) === null);
check('a Fight Focus last session: hidden', P.nextUpFrom({ kind: 'timer', cfg: { mode: 'Fight Focus' } }, find()) === null);
let nu = P.nextUpFrom({ kind: 'arcade', cfg: { seriesId: 'one-punch-protocol', stageNumber: 2 } }, find());
check('arcade: the saga\'s current node (stage 3)', nu?.kind === 'arcade' && nu.seriesId === 'one-punch-protocol' && nu.number === 3, JSON.stringify(nu));
check('… copy: the name alone (the badge has the number), the label says both', eq(P.nextUpCopy(nu), { eyebrow: `NEXT UP · ${OP.title.toUpperCase()}`, title: 'Pull Balance Foundation', label: `Next up in ${OP.title}: Stage 3, Pull Balance Foundation. Start` }), JSON.stringify(P.nextUpCopy(nu)));
const dashed = P.nextUpCopy({ kind: 'arcade', saga: 'The Climb', number: 4, title: 'Loop-de-Loop — Land, Stabilize & Build the Base' });
check('… a title with a tagline: the name alone on the row, the whole title in the label', dashed.title === 'Loop-de-Loop' && dashed.label === 'Next up in The Climb: Stage 4, Loop-de-Loop — Land, Stabilize & Build the Base. Start', JSON.stringify(dashed));
// Folded into Home's Continue card (the last session is that saga or camp).
check('folded into Continue: "Stage 3 · Pull Balance Foundation", the label says the whole', eq(P.nextUpLine(nu), { parts: ['Stage 3', 'Pull Balance Foundation'], label: `Next up in ${OP.title}: Stage 3, Pull Balance Foundation. Continue` }), JSON.stringify(P.nextUpLine(nu)));
check('… a saga\'s boss reads "Boss · name"; a node with no name just "Stage n"', eq(P.nextUpLine({ kind: 'arcade', saga: 'X', number: 10, title: 'The Hundred', boss: true }).parts, ['Boss', 'The Hundred'])
  && eq(P.nextUpLine({ kind: 'arcade', saga: 'X', number: 4, title: '' }).parts, ['Stage 4']));
check('… the camp: discipline, level, name ("Boxing · Level 5 · Volume"); the title fight', eq(P.nextUpLine({ kind: 'camp', saga: 'Training Camp', disc: 'Boxing', number: 5, title: 'Volume' }).parts, ['Boxing', 'Level 5', 'Volume'])
  && eq(P.nextUpLine({ kind: 'camp', saga: 'Training Camp', disc: 'Boxing', number: 12, title: 'Title Fight', boss: true }).parts, ['Boxing', 'Level 12', 'Title Fight']));
check('… nothing next: nothing', P.nextUpLine(null) === null);
check('arcade, all cleared: hidden', P.nextUpFrom({ kind: 'arcade', cfg: { seriesId: 'one-punch-protocol' } }, find({ progress: () => prog(Object.fromEntries(OP.stages.map((s) => [s.id, {}]))) })) === null);
check('a saga that cannot be played: hidden', P.nextUpFrom({ kind: 'arcade', cfg: { seriesId: 'demon-back-protocol' } }, find()) === null);
check('an unknown saga: hidden', P.nextUpFrom({ kind: 'arcade', cfg: { seriesId: 'nope' } }, find({ series: () => null })) === null);
check('a concept saga still locked (its gate not open): hidden', CONCEPT.status !== 'locked' || P.nextUpFrom({ kind: 'timer', cfg: { conceptId, conceptKind: 'arcade', conceptStage: 0 } }, find({ progress: () => prog({}) })) === null);
nu = P.nextUpFrom({ kind: 'timer', cfg: { conceptId, conceptKind: 'arcade', conceptStage: 0 } }, find({ series: () => ({ ...CONCEPT, maxUnlocked: 10 }), progress: () => prog({}), playable: () => true }));
check('a concept stage (stored as a timer session): its saga, stage 1, title case', nu?.conceptId === conceptId && nu.number === 1 && /[a-z]/.test(nu.title), JSON.stringify(nu));
nu = P.nextUpFrom({ kind: 'camp', cfg: { level: 6 }, disc: 'Muay Thai' }, find());
check('camp: the cursor\'s level (7), the discipline kept', nu?.kind === 'camp' && nu.number === 7 && nu.disc === 'Muay Thai');
check('… copy', P.nextUpCopy(nu).eyebrow === 'NEXT UP · TRAINING CAMP' && !/^Level/.test(P.nextUpCopy(nu).title) && /: Level 7, /.test(P.nextUpCopy(nu).label), JSON.stringify(P.nextUpCopy(nu)));
nu = P.nextUpFrom({ kind: 'camp', cfg: {} }, find({ camp: () => ({ levels: campLevels, current: 12, campDone: false, sessions: {} }) }));
check('camp on level 12: the Title Fight', nu?.title === 'Title Fight' && nu.boss);
check('camp, title won: hidden', P.nextUpFrom({ kind: 'camp', cfg: {} }, find({ camp: () => ({ levels: campLevels, current: 12, campDone: true, sessions: {} }) })) === null);

section('the real stores (read only)');
store.clear(); writes = 0;
check('nothing stored: no row', N.loadNextUp() === null);
store.set('tm_last_session_v1', JSON.stringify({ kind: 'arcade', cfg: { seriesId: 'grappler-protocol', stageNumber: 1 }, at: Date.now() }));
store.set('tm_arcade_progress', JSON.stringify({ 'grappler-protocol': { completedStages: { [GRAP.stages[0].id]: { completed: true, stars: 1, paths: ['fit'] } } } }));
nu = N.loadNextUp();
check('Grappler, stage 1 cleared: NEXT UP is stage 2', nu?.seriesId === 'grappler-protocol' && nu.number === 2, JSON.stringify(nu));
store.set('tm_last_session_v1', JSON.stringify({ kind: 'camp', cfg: { level: 3 }, disc: 'Boxing', at: Date.now() }));
store.set('tm_camp_progress', '4');
nu = N.loadNextUp();
check('camp cursor 4: NEXT UP is level 4', nu?.kind === 'camp' && nu.number === 4);
store.set('tm_last_session_v1', '{bad json');
check('a broken record: no row, no throw', N.loadNextUp() === null);
check('reading wrote nothing to storage', writes === 0, `writes ${writes}`);

section('the end screens\' stars row (as stored after the clear)');
store.set('tm_arcade_progress', JSON.stringify({ 'grappler-protocol': { completedStages: { [GRAP.stages[0].id]: { completed: true, stars: 2, paths: ['fit', 'fight'] } } } }));
let es = N.arcadeEndStars({ campaignId: 'ARC_GRAPPLER', stageNumber: 1 });
check('Grappler stage 1, FIT and FIGHT: 2 of 3, the paths named', es?.stars === 2 && es.max === 3 && es.line === 'One star per path: FIT ✓ · FIGHT ✓ · BOTH', JSON.stringify(es));
check('a stage not cleared: no row', N.arcadeEndStars({ campaignId: 'ARC_GRAPPLER', stageNumber: 2 }) === null);
store.set('tm_arcade_progress', JSON.stringify({ 'gravity-chamber-protocol': { completedStages: { [GRAV.stages[0].id]: { completed: true, stars: 1, paths: ['fit'] } } } }));
es = N.arcadeEndStars({ campaignId: 'ARC_GRAVITY', stageNumber: 1 });
check('Gravity Chamber: 1 of 1, a clear is the one star', es?.stars === 1 && es.max === 1 && /One star for a clear/.test(es.line));
check('an unknown campaign: no row', N.arcadeEndStars({ campaignId: 'ARC_NOPE', stageNumber: 1 }) === null);
store.set('tm_concepts_v1', JSON.stringify({ [conceptId]: { cleared: [0], clearedBy: { fight: [0], hybrid: [0] } } }));
es = N.conceptEndStars({ conceptId, conceptKind: 'arcade', conceptStage: 0 });
check('a concept stage cleared on FIGHT and BOTH: 2 of 3 arcs', es?.stars === 2 && es.max === 3 && es.line === 'One star per arc: FIT · FIGHT ✓ · BOTH ✓', JSON.stringify(es));
check('a concept fight day (not a stage): no row', N.conceptEndStars({ conceptId, conceptKind: 'fight' }) === null);
check('a concept stage not cleared: no row', N.conceptEndStars({ conceptId, conceptKind: 'arcade', conceptStage: 1 }) === null);
// The concept stage's end screen asks with this session's own result
// (SessionSummary, through the same settleFightXp the host banks with): a
// replay of a stage cleared on an earlier day shows its stored stars only when
// this run is finished and valid.
const stageCfg0 = { conceptId, conceptKind: 'arcade', conceptStage: 0, difficulty: 'Normal', mode: 'Fight Focus' };
const settle = (completed, integrityResult = null) => {
  const r = FX.settleFightXp({ completed, total: 3, difficulty: 'Normal', integrityResult, mode: 'fight' });
  return { completed, total: 3, outcome: r.verdict.outcome, refused: r.refused, xp: r.xp };
};
es = N.conceptSessionStars(stageCfg0, settle(3));
check('a replay that passes: the stored stars, 2 of 3', es?.stars === 2 && es.max === 3, JSON.stringify(es));
const cheat = settle(3, { awardXp: false, validityStatus: 'tooFast', validCompletedUnits: 0, totalRequiredUnits: 3 });
check('… the regression: a replay of the cleared stage that fails validation shows no stars', cheat.outcome === 'validation_failed' && N.conceptSessionStars(stageCfg0, cheat) === null, JSON.stringify(cheat));
check('… a refused run (the integrity check paid nothing) shows no stars', N.conceptSessionStars(stageCfg0, settle(3, { awardXp: false, validityStatus: 'incomplete', validCompletedUnits: 0, totalRequiredUnits: 3 })) === null);
check('… a full run the engine failed shows no stars', N.conceptSessionStars(stageCfg0, { completed: 3, total: 3, outcome: 'fail', refused: false, xp: 0 }) === null);
check('… a pass that paid no XP shows no stars', N.conceptSessionStars(stageCfg0, { completed: 3, total: 3, outcome: 'pass', refused: false, xp: 0 }) === null);
check('… a run ended before the last round shows no stars', N.conceptSessionStars(stageCfg0, settle(2)) === null);
check('… no result at all shows no stars', N.conceptSessionStars(stageCfg0) === null);

section('the NEXT UP tap');
const calls = [];
N.openNextUp({ kind: 'camp', disc: 'Boxing' }, { goTrainingCamp: (d) => calls.push(['camp', d]), goArcadeDetail: () => calls.push(['arcade']) });
check('camp: opens the camp, asks it to open on the current level once', eq(calls, [['camp', 'Boxing']]) && N.takePathFocus('camp') && !N.takePathFocus('camp'));
store.set('tm_last_session_v1', JSON.stringify({ kind: 'arcade', cfg: { seriesId: 'one-punch-protocol', settings: { difficulty: 'standard', cadence: 'fast' } }, at: Date.now() }));
calls.length = 0;
N.openNextUp({ kind: 'arcade', seriesId: 'one-punch-protocol' }, { goTrainingCamp: () => calls.push(['camp']), goArcadeDetail: (s, st) => calls.push([s.id, st]) });
check('arcade: the saga with the settings it last ran with', calls[0]?.[0] === 'one-punch-protocol' && calls[0][1]?.cadence === 'fast');
check('… the focus is the saga\'s, not the camp\'s', !N.takePathFocus('camp') && N.takePathFocus('one-punch-protocol'));
calls.length = 0;
N.openNextUp({ kind: 'arcade', conceptId }, { goArcadeDetail: (s, st) => calls.push([s.id, st]) });
check('a concept saga opens by its concept id', calls[0]?.[0] === `concept-${conceptId}` && calls[0][1] === null);
N.takePathFocus(`concept-${conceptId}`);
N.requestPathFocus('x');
check('an old request (over 15 s) is dropped', (() => { const real = Date.now; Date.now = () => real() + 16000; const r = N.takePathFocus('x'); Date.now = real; return r === false; })());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
