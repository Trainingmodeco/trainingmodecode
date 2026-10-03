// Concept drops: release windows, Pro / started-in-window access, progress
// counting, tier scaling, cfg shapes for the Fit player and the Fight timer,
// the boss lock and the limited reward. Run with `npm run test:concepts`.
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const C = await import('../components/training-mode/data/concepts/index.js');
const { ULTRA_EGO: UE } = await import('../components/training-mode/data/concepts/ultraEgo.js');
const { SHOTO } = await import('../components/training-mode/data/concepts/shoto.js');
const { NIGHT_VIGILANTE: NV } = await import('../components/training-mode/data/concepts/nightVigilante.js');

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { pass++; console.log(`  ok   ${name}`); } else { fail++; console.log(`  FAIL ${name}  ${extra}`); } };
const at = (iso) => new Date(`${iso}T12:00:00`).getTime();
const entry = C.entryFor('ultra-ego');
const reset = () => store.clear();

// ── windows ─────────────────────────────────────────────────────────────────
check('scheduled', !!entry && entry.concept === UE);
check('upcoming before start', C.windowState(entry, at('2026-11-30')) === 'upcoming');
check('live on start day', C.windowState(entry, at('2026-12-01')) === 'live');
check('live on end day', C.windowState(entry, at('2027-01-31')) === 'live');
check('vault after end', C.windowState(entry, at('2027-02-01')) === 'vault');
reset();
check('not featured before release for users', C.featuredEntry(at('2026-10-15'), false) === null);
check('owner preview features the next drop (Shoto)', C.featuredEntry(at('2026-10-15'), true)?.concept.id === 'shoto');
check('owner preview after Shoto features Ultra Ego', C.featuredEntry(at('2026-11-30') + 13 * 3600 * 1000, true)?.concept.id === 'ultra-ego');
check('featured while live', C.featuredEntry(at('2026-12-10'), false)?.concept.id === 'ultra-ego');
check('Shoto not live Oct 22, live Oct 23', C.featuredEntry(at('2026-10-22'), false) === null && C.featuredEntry(at('2026-10-23'), false)?.concept.id === 'shoto');
check('Shoto still live Nov 30, Ultra Ego from Dec 1', C.featuredEntry(at('2026-11-30'), false)?.concept.id === 'shoto' && C.featuredEntry(at('2026-12-01'), false)?.concept.id === 'ultra-ego');
check('schedule in date order, no overlap', C.CONCEPT_SCHEDULE.every((e, i, a) => i === 0 || e.start > a[i - 1].end));
check('vault lists both past drops, oldest first', C.vaultEntries(at('2027-03-01')).map(e => e.concept.id).join() === 'shoto,ultra-ego');
check('Shoto in the vault while Ultra Ego is live', C.vaultEntries(at('2026-12-10')).map(e => e.concept.id).join() === 'shoto');
check('days left on the last day is 1', C.daysLeft(entry, at('2027-01-31')) === 1);

// ── access ──────────────────────────────────────────────────────────────────
reset();
const fresh = C.loadProgress('ultra-ego');
check('live: free for everyone', C.canPlay(entry, at('2026-12-10'), fresh, false));
check('vault: locked for free users who never started', !C.canPlay(entry, at('2027-03-01'), fresh, false));
check('vault: open for Pro', C.canPlay(entry, at('2027-03-01'), fresh, true));
const started = { ...fresh, startedAt: new Date(at('2027-01-20')).toISOString(), fitDone: 3 };
check('vault: started in window keeps it until finished', C.canPlay(entry, at('2027-03-01'), started, false));
const startedLate = { ...fresh, startedAt: new Date(at('2027-02-05')).toISOString() };
check('vault: starting after the window does not count', !C.canPlay(entry, at('2027-03-01'), startedLate, false));

// ── structure + status ──────────────────────────────────────────────────────
check('fit has 4 training days a week', C.fitTrainingDays(UE).length === 4);
check('fit total is 16 sessions over 4 weeks', C.fitTotal(UE) === 16);
check('fight is 5 days × 4 weeks', C.fightTotal(UE) === 20);
check('boss is the last stage', C.bossIndex(UE) === 9);
check('every fight day has 5 rounds', UE.fight.days.every(d => d.rounds.length === 5));
check('every stage has a plan', UE.arcade.stages.every(s => s.plan && s.plan.rounds >= 1 && s.plan.len > 0));
reset();
let st = C.status(UE);
check('fresh: boss locked', !st.bossUnlocked && st.partsDone === 0 && st.fitWeek === 1 && st.fitNext === 0);

// ── fit cfg + scaling ───────────────────────────────────────────────────────
reset();
const cfg = C.fitDayCfg(UE, { tier: 'normal', now: at('2026-12-02') });
check('fit cfg: explicit exercise list', Array.isArray(cfg.savedExercises) && cfg.savedExercises.length === 6);
check('fit cfg: player-required fields', Array.isArray(cfg.muscleGroups) && typeof cfg.equipment === 'string');
check('fit cfg: tagged for completion', cfg.conceptId === 'ultra-ego' && cfg.conceptKind === 'fit' && cfg.conceptSeq === 0);
check('fit cfg: marks started', !!C.loadProgress('ultra-ego').startedAt);
const ex0 = cfg.savedExercises[0];
check('player exercise shape', ex0.name === 'Neck Curls (Front)' && ex0.reps === '25' && ex0.restSeconds === 45 && ex0.equipment === 'Bodyweight');
const press = cfg.savedExercises.find(e => e.name.includes('Military'));
check('library exercise keeps its id', press && press.id.startsWith('shoulders') || (press && !press.id.startsWith('concept_')), press?.id);
check('weighted moves run as weighted', press?.equipment === 'Weighted');
const home = C.fitDayExercises(UE, 0, { home: true });
check('home swaps the barbell press for pike push-ups', home.some(e => e.name === 'Pike Push-Ups') && !home.some(e => e.name.includes('Military')));
const easy = C.scaleRow({ sets: 4, reps: 8 }, 'easy'), hard = C.scaleRow({ sets: 4, reps: 8 }, 'hard');
check('easy drops a set and reps', easy.sets === 3 && easy.reps === 6);
check('hard adds a set and reps', hard.sets === 5 && hard.reps === 9);
check('never below 2 sets', C.scaleRow({ sets: 2, reps: 25 }, 'easy').sets === 2);

// ── completion counting ─────────────────────────────────────────────────────
reset();
const c1 = C.fitDayCfg(UE, { now: at('2026-12-02') });
C.recordConceptSession(c1, 5, 6);
check('fit counts at 75%', C.loadProgress('ultra-ego').fitDone === 1);
C.recordConceptSession(c1, 6, 6);
check('the same session never counts twice', C.loadProgress('ultra-ego').fitDone === 1);
const c2 = C.fitDayCfg(UE, { now: at('2026-12-03') });
C.recordConceptSession(c2, 2, 6);
check('under 75% does not count', C.loadProgress('ultra-ego').fitDone === 1);
check('next fit day advances', C.status(UE).fitNext === 1);

// ── fight cfg ───────────────────────────────────────────────────────────────
reset();
const f = C.fightDayCfg(UE, { tier: 'hard', now: at('2026-12-02') });
check('fight cfg: scripted rounds', f.blockRounds.length === 5 && f.blockRounds[0].round_title === 'Planted Jab-Cross' && f.blockRounds[0].coach_prompt.length > 10);
check('fight cfg: timer fields', f.rounds === 5 && f.roundMin === 3 && f.restSec === 60 && f.difficulty === 'Hard' && f.mode === 'Fight Focus');
check('fight day 2 turns rush on', C.loadProgress('ultra-ego').fightDone === 0 && UE.fight.days[1].rush === true);
for (let i = 0; i < 5; i++) C.recordConceptSession(C.fightDayCfg(UE), 5, 5);
st = C.status(UE);
check('one week of fight is not the whole program', !st.fightComplete && st.fightWeek === 2 && st.fightNext === 0);
for (let i = 0; i < 15; i++) C.recordConceptSession(C.fightDayCfg(UE), 5, 5);
st = C.status(UE);
check('four weeks of fight completes Fight', st.fightComplete && st.fightNext === null);
check('finishing Fight marks the boss unlockable', st.bossUnlocked);

// ── arcade ──────────────────────────────────────────────────────────────────
reset();
check('arcade is closed on day one', !C.arcadeGate(UE).open && !C.stagePlayable(UE, 0));
{
  const { WARRIOR_QUEEN: WQ } = await import('../components/training-mode/data/concepts/warriorQueen.js');
  const set = (fitDone, fightDone) => store.set('tm_concepts_v1', JSON.stringify({ 'warrior-queen': { fitDone, fightDone } }));
  set(3, 0); check('3 fit sessions: still closed', !C.arcadeGate(WQ).open && C.arcadeGate(WQ).nextNote === 'Finish week 1 of Fit or Fight');
  set(4, 0); let g = C.arcadeGate(WQ);
  check('week 1 of Fit opens stage 1 only', g.open && g.allowed === 1 && g.nextNote === 'Stage 2 in 1 more workout', g.nextNote);
  set(0, 4); check('week 1 of Fight opens it too', C.arcadeGate(WQ).open && C.arcadeGate(WQ).allowed === 1);
  set(4, 3); check('each workout opens one more stage', C.arcadeGate(WQ).allowed === 4);
  set(9, 4); g = C.arcadeGate(WQ);
  check('boss waits for a full program', g.allowed === 9 && g.nextNote === 'Boss opens when the Fit or Fight program is done', g.nextNote);
  set(9, 8); check('full Fight program opens the boss', C.arcadeGate(WQ).allowed === 10 && C.stagePlayable(WQ, 9));
  set(4, 0);
  const sg = (await import('../components/training-mode/data/concepts/saga.js')).conceptSaga('warrior-queen');
  check('the ladder gets the gate', sg.status === 'active' && sg.maxUnlocked === 1 && /Stage 2/.test(sg.gateNote));
  reset();
}
check('boss locked from day one', !C.stagePlayable(UE, 9));
const s4 = C.stageCfg(UE, 3);
check('EMOM stage: 10 one-minute rounds', s4.blockRounds.length === 10 && s4.blockRounds[0].length_sec === 60);
check('stage cfg tagged', s4.conceptKind === 'arcade' && s4.conceptStage === 3);
C.recordConceptSession(s4, 9, 10);
check('a stage needs every round', !C.loadProgress('ultra-ego').cleared.includes(3));
C.recordConceptSession(s4, 10, 10);
check('a full stage clears', C.loadProgress('ultra-ego').cleared.includes(3));

// ── reward ──────────────────────────────────────────────────────────────────
reset();
store.set('tm_concepts_v1', JSON.stringify({ 'ultra-ego': { fitDone: 16, fightDone: 20, cleared: [9] } }));
check('all three done: reward ready in window', C.rewardState(entry, at('2026-12-20')) === 'ready');
check('all three done after window: expired', C.rewardState(entry, at('2027-02-10')) === 'expired');
C.claimReward('ultra-ego', at('2026-12-20'));
check('claimed once', C.rewardState(entry, at('2026-12-21')) === 'claimed');
reset();
store.set('tm_concepts_v1', JSON.stringify({ 'ultra-ego': { fitDone: 16, fightDone: 5, cleared: [] } }));
check('boss not cleared: reward locked', C.rewardState(entry, at('2026-12-20')) === 'locked');

// ── pop-up ──────────────────────────────────────────────────────────────────
reset();
check('pop-up due when live and unseen', C.duePopup(at('2026-12-02'))?.concept.id === 'ultra-ego');
C.markPopupSeen('ultra-ego');
check('pop-up shows once', C.duePopup(at('2026-12-03')) === null);
reset();
check('no pop-up before any release', C.duePopup(at('2026-10-10')) === null);

// ── Shoto ───────────────────────────────────────────────────────────────────
reset();
check('Shoto fit: 4 training days a week (incl. Shoto Practice), 16 sessions', C.fitTrainingDays(SHOTO).length === 4 && C.fitTotal(SHOTO) === 16);
check('Shoto Practice is fight training', C.fitDayExercises(SHOTO, 2).some(e => e.name === 'Roundhouse Kick Drill'));
check('Shoto: fit and fight weeks match', C.fitTrainingDays(SHOTO).length === SHOTO.fight.days.length);
check('Shoto fight: 4 days × 2 weeks', C.fightTotal(SHOTO) === 8);
const sf = C.fightDayCfg(SHOTO, { now: at('2026-10-20') });
check('Shoto fight day 1 calls combos', sf.blockRounds.every(r => Array.isArray(r.combos) && r.combos.length >= 3) && sf.blockRounds[0].combos[0] === 'Jab, cross, double-hand push');
check('Shoto fight discipline is Kickboxing', SHOTO.fight.discipline === 'Kickboxing');
for (let i = 0; i < 2; i++) C.recordConceptSession(C.fightDayCfg(SHOTO), 5, 5);
const k3 = C.fightDayCfg(SHOTO);
check('pressure day: rush on, 30 s rest', k3.rushMode === true && k3.restSec === 30);
C.recordConceptSession(k3, 5, 5);
const k4 = C.fightDayCfg(SHOTO);
check('practice day: light, some rounds without combos', k4.rounds === 4 && k4.blockRounds.some(r => !r.combos));
C.recordConceptSession(k4, 4, 4);
let ss = C.status(SHOTO);
check('week 2 starts back on day 1', ss.fightNext === 0 && ss.fightWeek === 2 && !ss.fightComplete);
for (let i = 0; i < 4; i++) { const c = C.fightDayCfg(SHOTO); C.recordConceptSession(c, c.rounds, c.rounds); }
check('two weeks completes Shoto Fight', C.status(SHOTO).fightComplete);
const homeShoto = C.fitDayExercises(SHOTO, 0, { home: true });
check('Shoto home swaps sandbag and med-ball moves', homeShoto.some(e => e.name === 'Burpees') && homeShoto.some(e => e.name === 'Explosive Push-Ups') && !homeShoto.some(e => /Sandbag|Med-Ball/.test(e.name)));
{
  const { SUPERS } = await import('../components/training-mode/data/concepts/shoto.js');
  reset();
  const days = [0, 1, 2].map(() => { const c = C.fightDayCfg(SHOTO); C.recordConceptSession(c, c.rounds, c.rounds); return c; });
  const supers = days.map(d => d.blockRounds.filter(r => r.super));
  check('each style day has exactly one super, on its last round', supers.every((x, i) => x.length === 1 && days[i].blockRounds.at(-1).super));
  check('supers run as a 30 s rush', supers.flat().every(r => r.rush?.pattern === 'end30'));
  check('three supers by style', supers.map(x => x[0].super.name).join() === [SUPERS.ryu.name, SUPERS.ken.name, SUPERS.akuma.name].join());
  check('demon barrage opens with the sliding fake teep', SUPERS.akuma.calls[0].startsWith('Sliding fake teep'));
  check('Ryu fit has the squat to press', C.fitDayExercises(SHOTO, 0).some(e => e.name === 'Alternating Squat to Press'));
  check('Ken fit has the 180 tuck jump', C.fitDayExercises(SHOTO, 1).some(e => e.name === '180° Tuck Jumps'));
}
{
  for (const c of [SHOTO, UE]) {
    for (const arc of ['fit', 'fight', 'hybrid']) {
      const st = C.arcStages(c, arc);
      check(`${c.id} ${arc}: 10 stages, boss last, all planned`, st.length === 10 && st[9].boss && st.every(x => x.plan && x.items.length >= 2));
    }
  }
  check('arc tracks are different content', C.arcStages(SHOTO, 'fit')[0].items.join() !== C.arcStages(SHOTO, 'fight')[0].items.join());
  check('fitness arc has no strikes', C.arcStages(UE, 'fit').every(x => !/jab|cross|hook|kick|knee|elbow|straight|bag/i.test(x.items.join(' '))));
  reset();
  const a1 = C.stageCfg(UE, 0, { arc: 'fight' });
  check('stage cfg carries the arc', a1.conceptArc === 'fight' && /TOURNAMENT ARC/.test(a1.archetypeName));
  C.recordConceptSession(a1, a1.rounds, a1.rounds);
  const pr = C.loadProgress('ultra-ego');
  check('clearing in one arc marks that arc only', pr.cleared.includes(0) && C.arcsCleared(pr, 0).join() === 'fight');
  const a2 = C.stageCfg(UE, 0, { arc: 'fit' }); C.recordConceptSession(a2, a2.rounds, a2.rounds);
  check('a second arc adds its mark, stage counted once', C.arcsCleared(C.loadProgress('ultra-ego'), 0).join() === 'fit,fight' && C.loadProgress('ultra-ego').cleared.length === 1);
}
check('no character names in Shoto', !/\b(Ryu|Ken|Akuma|Hadoken|Shoryuken|Tatsumaki)\b/i.test(JSON.stringify(SHOTO)));
check('Shoto gauntlet: 10 stages, boss last', SHOTO.arcade.stages.length === 10 && C.bossIndex(SHOTO) === 9);

// ── concept sagas on the Arcade ladder ──────────────────────────────────────
{
  const S = await import('../components/training-mode/data/concepts/saga.js');
  const sg = S.conceptSaga('shoto');
  check('saga: 10 stages, boss last, three paths', sg.stages.length === 10 && sg.stages[9].isFinalRound && sg.modeOptions.join() === 'fit,fight,both');
  check('saga: each stage lists every path', sg.stages.every(st => ['fit', 'fight', 'both'].every(m => st.pathItems[m].items.length >= 2)));
  reset();
  const c1 = C.stageCfg(SHOTO, 0, { arc: 'fight' }); C.recordConceptSession(c1, c1.rounds, c1.rounds);
  const c2 = C.stageCfg(SHOTO, 0, { arc: 'hybrid' }); C.recordConceptSession(c2, c2.rounds, c2.rounds);
  const lp = S.conceptSagaProgress('shoto').completedStages['shoto-stg-1'];
  check('ladder progress: stars = paths cleared', lp.completed && lp.stars === 2 && lp.paths.join() === 'fight,both');
  const AP = await import('../components/training-mode/data/arcadeProgress.js');
  AP.completeStage('x', 's1', 0, null, null, null, { path: 'fit' }); AP.completeStage('x', 's1', 0, null, null, null, { path: 'fit' }); AP.completeStage('x', 's1', 0, null, null, null, { path: 'both' });
  const e = AP.getSeriesProgress('x').completedStages.s1;
  check('saga stars: one per distinct path', e.stars === 2 && e.paths.join() === 'fit,both');
}

// ── Night Vigilante: tiers with real alternates, home versions, multi rounds ─
{
  reset();
  const nv = C.entryFor('night-vigilante');
  check('NV scheduled over Batman Day (Sep 18 2027)', nv && C.windowState(nv, at('2027-09-18')) === 'live' && C.windowState(nv, at('2027-07-31')) === 'upcoming');
  check('NV fit: 6 training days a week incl. the long run, 24 sessions', C.fitTrainingDays(NV).length === 6 && C.fitTotal(NV) === 24);
  check('NV fight: 4 days × 4 weeks, MMA', C.fightTotal(NV) === 16 && NV.fight.discipline === 'MMA');
  check('NV tier labels', NV.tierLabels.easy === 'ROOKIE' && NV.tierLabels.hard === 'ELITE');
  const rings = (tier, home = false) => C.fitDayExercises(NV, 1, { tier, home }).map(e => e.name);
  check('rookie gets the beginner gymnastics rungs', rings('easy').join() === 'Lying Rope Pulls,Ring Rows,Bench Dips,Box Step-Ups,Lying Leg Raises,Crunches', rings('easy').join());
  check('normal gets the standard rungs', rings('normal').slice(0, 3).join() === 'Rope Climb,Low-Ring Muscle-Up Transitions,Ring Support Hold');
  check('elite gets the advanced skills', rings('hard').slice(0, 3).join() === 'Legless Rope Climb,Strict Muscle-Ups,Ring Dips');
  check('home swaps the rope and rings', rings('normal', true).slice(0, 3).join() === 'Towel Pull-Ups,Table-Row Negatives,Chair Support Hold', rings('normal', true).slice(0, 3).join());
  const neg = C.fitDayExercises(NV, 1, { tier: 'easy' })[1];
  check('a rookie rung keeps its own numbers', neg.name === 'Ring Rows' && neg.sets === 3 && neg.reps === '12');
  const climb = (tier, home = false) => C.fitDayExercises(NV, 4, { tier, home }).map(e => e.name);
  check('the climb: hang circuit at the gym, grip circuit at home', climb('normal').includes('Monkey Bar Traverse') && climb('normal', true).includes('Farmer Hold') && climb('normal', true).includes('Towel Wrings'));
  check('no bouldering anywhere', !JSON.stringify(NV).toLowerCase().includes('boulder'));
  check('clean and jerk → dumbbell for rookies', C.fitDayExercises(NV, 0, { tier: 'easy' })[0].name === 'Dumbbell Hang Clean and Press');
  const allFight = NV.fight.days.flatMap(d => d.rounds);
  check('multiple-opponents rounds in the fight program', allFight.filter(r => r.multi).length >= 5);
  for (let i = 0; i < 2; i++) { const c = C.fightDayCfg(NV); C.recordConceptSession(c, c.rounds, c.rounds); }
  const mo = C.fightDayCfg(NV);
  check('day 3 is multiple opponents and the timer gets multi', mo.archetypeName.includes('MULTIPLE OPPONENTS') && mo.blockRounds.filter(r => r.multi).length === 4);
  const rk = C.fightDayCfg(NV, { tier: 'easy' });
  check('rookie fight: 3 × 2:00, super kept', rk.rounds === 3 && rk.roundMin === 2 && !!rk.blockRounds[2].super && rk.blockRounds[2].super.calls[0] === 'Jab, cross, dash out');
  check('rookie combos are the simple ones', rk.blockRounds[0].combos.every(x => !/spinning|level change/i.test(x)));
  check('every combo ends or flows with movement somewhere', allFight.some(r => (r.combos || []).some(x => /dash/.test(x))));
  check('NV arcade: 3 arcs × 10, boss last', ['fit', 'fight', 'hybrid'].every(a => C.arcStages(NV, a).length === 10 && C.arcStages(NV, a)[9].boss));
  C.setPrefs('night-vigilante', { tier: 'easy' });
  const st = C.stageCfg(NV, 1, { arc: 'fit' });
  check('rookie arcade stage uses the beginner stations', st.blockRounds[0].coach_prompt.includes('ring rows'));
  const ms = C.stageCfg(NV, 4, { arc: 'hybrid' });
  check('a multi arcade stage carries multi to the timer', ms.blockRounds.every(r => r.multi));
  // Skill ladders: two hits move a rung up; ↓ steps down; the day follows.
  reset(); C.setPrefs('night-vigilante', { tier: 'easy' });
  const mu = () => C.ladderState(NV, { tier: 'easy' }).find(l => l.id === 'muscle-up');
  check('ladder starts at the tier rung', mu().rung.name === 'Ring Rows' && mu().idx === 2 && mu().target === '3 × 12');
  C.ladderHit(NV, 'muscle-up', 'easy');
  check('one hit is not enough', mu().idx === 2 && mu().hits === 1);
  C.ladderHit(NV, 'muscle-up', 'easy');
  check('two hits move up a rung', mu().idx === 3 && mu().hits === 0 && mu().rung.name === 'Band-Assisted Pull-Ups');
  check('the Fit day runs the new rung', C.fitDayExercises(NV, 1, { tier: 'easy' })[1].name === 'Band-Assisted Pull-Ups');
  C.ladderStep(NV, 'muscle-up', -1, 'easy');
  check('step down', mu().idx === 2);
  // Metcon circuit: chained in the player, rounds by tier.
  reset();
  const f0 = C.fitDayCfg(NV, { tier: 'easy' });
  check('metcon rows are one chain', f0.savedExercises.filter(e => e._chain === 'concept-metcon').length === 3 && f0.chainRounds['concept-metcon'] === 3);
  check('elite metcon is 5 rounds', C.fitDayCfg(NV, { tier: 'hard' }).chainRounds['concept-metcon'] === 5);
  // Long run day: opens Cardio Mode, counts when a long-enough run is logged.
  reset();
  store.set('tm_concepts_v1', JSON.stringify({ 'night-vigilante': { fitDone: 3 } }));
  const rc = C.fitDayCfg(NV, { tier: 'normal', now: at('2027-08-04') });
  check('the long run day is a Cardio Mode run', rc.conceptRun && rc.goal === 4 && rc.unit === 'mi');
  check('a short run does not count', C.settleConceptRun('night-vigilante', [{ at: at('2027-08-04') + 3600e3, distance: 2, unit: 'mi' }]).fitDone === 3);
  check('an old run does not count', C.settleConceptRun('night-vigilante', [{ at: at('2027-08-03'), distance: 5, unit: 'mi' }]).fitDone === 3);
  check('a long-enough run counts once', C.settleConceptRun('night-vigilante', [{ at: at('2027-08-04') + 3600e3, distance: 3.7, unit: 'mi' }]).fitDone === 4
    && C.settleConceptRun('night-vigilante', [{ at: at('2027-08-04') + 3600e3, distance: 9, unit: 'mi' }]).fitDone === 4);
  check('NV is not the owner-preview feature before Shoto/UE end', C.featuredEntry(at('2026-10-15'), true)?.concept.id === 'shoto');
}

// ── Every drop: shape, no franchise names in what users see ────────────────
{
  reset();
  const ids = C.CONCEPT_SCHEDULE.map(e => e.concept.id);
  check('six drops in order', ids.join() === 'shoto,ultra-ego,flow-state,one-hundred,warrior-queen,night-vigilante', ids.join());
  check('Flow State Feb–Mar, One Hundred Apr–May', C.windowState(C.entryFor('flow-state'), at('2027-02-01')) === 'live' && C.windowState(C.entryFor('one-hundred'), at('2027-05-31')) === 'live');
  const BANNED = /goku|vegeta|saiyan|dragon ball|ultra instinct|ultra ego|saitama|wonder woman|diana|themyscira|amazon|lasso|one[- ]punch|garou|batman|gotham|serious (punch|series)|normal punches|ryu\b|ken\b|akuma|capcom|street fighter/i;
  for (const e of C.CONCEPT_SCHEDULE) {
    const c = e.concept;
    const { art, ...shown } = c;
    const txt = JSON.stringify(shown).replace(/"(id|accent|frame)":"[^"]*"/g, '');
    check(`${c.id}: no franchise names in user text`, c.id === 'ultra-ego' || !BANNED.test(txt), (txt.match(BANNED) || [])[0]);
    check(`${c.id}: arcade 3 × 10, boss last`, ['fit', 'fight', 'hybrid'].every(a => C.arcStages(c, a).length === 10 && C.arcStages(c, a)[9].boss));
    check(`${c.id}: every training day builds`, C.fitTrainingDays(c).every((d, i) => d.run || C.fitDayExercises(c, i).length >= 4));
    check(`${c.id}: every fight day builds with a super`, c.fight.days.every((d, i) => { store.set('tm_concepts_v1', JSON.stringify({ [c.id]: { fightDone: i } })); const f = C.fightDayCfg(c); return f.rounds >= 3 && f.blockRounds.some(r => r.super); }) || c.id === 'ultra-ego' || c.id === 'shoto');
    reset();
  }
  const { ONE_HUNDRED: OH } = await import('../components/training-mode/data/concepts/oneHundred.js');
  const push = (tier) => C.fitDayExercises(OH, 0, { tier }).slice(0, 10).reduce((n, e) => n + e.sets * Number(e.reps), 0);
  check('One Hundred push day: 300 / 600 / 1000 reps', push('easy') === 300 && push('normal') === 600 && push('hard') === 1000, `${push('easy')}/${push('normal')}/${push('hard')}`);
  store.set('tm_concepts_v1', JSON.stringify({ 'one-hundred': { fitDone: 2 } }));
  const tk = C.fitDayCfg(OH, { tier: 'hard', now: at('2027-04-07') });
  check('One Hundred 10K is a 10 km Cardio Mode run for elite', tk.conceptRun && tk.goal === 10 && tk.unit === 'km');
  check('a 9.5 km run counts the 10K', C.settleConceptRun('one-hundred', [{ at: at('2027-04-07') + 3600e3, distance: 9.5, unit: 'km' }]).fitDone === 3);
}

{
  reset();
  const S2 = await import('../components/training-mode/data/concepts/saga.js');
  check('old sagas stay before their drops', S2.retiredSagaIds(at('2026-10-20'), () => false, false).size === 0);
  check('Flow State saga retires Feb 1', S2.retiredSagaIds(at('2027-02-01'), () => false, false).has('flow-state-protocol') && !S2.retiredSagaIds(at('2027-02-01'), () => false, false).has('one-punch-protocol'));
  check('all three retired by Aug 2027', ['flow-state-protocol', 'one-punch-protocol', 'vigilante-protocol'].every(id => S2.retiredSagaIds(at('2027-08-02'), () => false, false).has(id)));
  check('The Destroyer retires Dec 1', !S2.retiredSagaIds(at('2026-11-30'), () => false, false).has('destroyer-protocol') && S2.retiredSagaIds(at('2026-12-01'), () => false, false).has('destroyer-protocol'));
  check('Pro keeps every old saga', S2.retiredSagaIds(at('2027-08-02'), () => false, true).size === 0);
  check('kept for someone with progress', !S2.retiredSagaIds(at('2027-04-02'), id => id === 'one-punch-protocol', false).has('one-punch-protocol'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
