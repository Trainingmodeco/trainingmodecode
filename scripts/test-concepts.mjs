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
check('Shoto live on Oct 19', C.featuredEntry(at('2026-10-19'), false)?.concept.id === 'shoto');
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
check('fight is 5 days', C.fightTotal(UE) === 5);
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
check('five fight days completes Fight', st.fightComplete && st.fightNext === null);
check('finishing Fight unlocks the boss', st.bossUnlocked && C.stagePlayable(UE, 9));

// ── arcade ──────────────────────────────────────────────────────────────────
reset();
check('stages 1-9 open from day one', [0, 1, 2, 3, 4, 5, 6, 7, 8].every(i => C.stagePlayable(UE, i)));
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
store.set('tm_concepts_v1', JSON.stringify({ 'ultra-ego': { fitDone: 16, fightDone: 5, cleared: [9] } }));
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
check('Shoto fit: 3 training days a week, 12 sessions', C.fitTrainingDays(SHOTO).length === 3 && C.fitTotal(SHOTO) === 12);
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
check('no character names in Shoto', !/\b(Ryu|Ken|Akuma|Hadoken|Shoryuken|Tatsumaki)\b/i.test(JSON.stringify(SHOTO)));
check('Shoto gauntlet: 10 stages, boss last', SHOTO.arcade.stages.length === 10 && C.bossIndex(SHOTO) === 9);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
