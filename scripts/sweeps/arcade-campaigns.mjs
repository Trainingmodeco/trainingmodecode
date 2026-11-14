// The Training Arcade campaigns, as they are spoken.
//
// Three sources are swept here.
//
// (a) The stage announcer of a prescribed fit stage. App.jsx:854 sets
//     cfg.announcer = announcerLine(campaignId, stage.id, diff, plan.exercises)
//     for every open campaign stage that has a prescription (a final boss
//     skips the prescription layer, App.jsx:849, so it is skipped here too).
//     announcerLine (data/arcadeSession.js:71) calls announcerScript in
//     protocol/engine/arcade-session-engine.ts:192. Node loads that TypeScript
//     file through its own type stripping and the extensionless loader that
//     _try.mjs and the test runner register, so the real builder is called.
//     CampFitSetRunner.jsx:168 says it after "3, 2, 1" were counted out, with
//     the leading "3, 2, 1." and the trailing "Ready - go!" cut off by the two
//     regexes copied below. When the announcer is empty it says the fallback
//     `${cur?.name}. ${doseLabel(cur)}.` (same line), swept for the first
//     movement of every plan, as prescribed and after each weighted toggle.
//
// (b) The counted-sets runner, components/training-mode/CampFitSetRunner.jsx.
//     Every active campaign (the carousel entries with isActive and status
//     active that carry a v2Campaign), every stage the series lists (the
//     Arcade cap of 10, final boss out), easy, normal and hard. The lines:
//       beginSet, :181-184, one of four sentences per set, chosen by
//         countPolicy(ex, true) and ex.duration_sec, for every set number of
//         every exercise;
//       completeSet rest call, :229, "Rest. N seconds. Next: NAME.";
//       the finishers, :249 (opening) and :254 (the rest), for every finisher
//         the fit stage resolves at that difficulty (stageFinishers);
//       the rep count in the auto counter, :200, String(n) for every n a set
//         can reach;
//       "Halfway." :201, a fixed line, kept so a hold of any length is proven.
//     The weighted review (:53 decides, :293 flips a slot) shows when any
//     exercise of the plan is weighted, and each slot can be flipped with
//     toBodyweight or toWeighted from the engine, so for such a stage every
//     exercise is also built flipped, and the rest of a weighted set is
//     whatever adaptiveRest gives for the time the athlete took (swept over
//     every take from 0 to 400 seconds, every category the stage has).
//
// (c) The legacy Arcade player (series without v2Campaign, today One Punch),
//     ArcadeCadenceRepPlayer.jsx, with its task list built the way
//     buildTaskList in ArcadeSessionPlayer.jsx:29-150 builds it (that function
//     is inside a React file, so its steps are re-typed below, each marked
//     with its line). For every open stage of every open legacy series, fit
//     and fight block:
//       :153  `${title}. ${reps} reps. On my count.` for every cadenceReps
//             task and for every Back-Balance option (the option label, its
//             reps, or 10 when it has none: targetReps is `task?.reps || 10`,
//             ArcadeCadenceRepPlayer.jsx:96);
//       :168  `Rest for ${restSeconds} seconds. Next workout is ${nextLabel}.
//             If you need more rest, pause before the next session.` with the
//             task's own rest (20 s when it has none, 15 s for a Back-Balance
//             option) and the title of the task after it, 'Back-Balance Work'
//             and 'Cardio Protocol' included, or "the next exercise" when
//             there is none;
//       :224  String(i) for every rep count up to the largest target.
//     One Punch scales the fit reps of a cadence circuit down to the athlete's
//     max-out baseline (ArcadeSessionPlayer.jsx:89-90, scaleFitTasks), by whole
//     reps from 4 up to the authored number, so the intro is swept over that
//     whole range for those tasks.
//
// Not built here: the rest seconds 1 to 300 as a number (proven by the Quick
// Mission rest call in spoken-sweeps.mjs; here the real values of the data are
// used), the benchmark player (ArcadeBenchmarkPlayer.jsx) and the cardio
// player, which are other sources.

// CampFitSetRunner.jsx:168, copied character for character.
const stripAnnouncer = (a) => String(a || '').replace(/^\s*3\s*,\s*2\s*,\s*1\s*[.!]?\s*/i, '').replace(/\s*ready\s*[—–-]+\s*go!?\s*$/i, '').trim();

const DIFFS = ['easy', 'normal', 'hard'];

export default async () => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: () => null, length: 0 };
  }
  const S = await import('../../components/training-mode/data/arcadeSession.js');
  const E = await import('../../components/training-mode/protocol/engine/arcade-session-engine.ts');
  const C = await import('../../components/training-mode/protocol/campaigns.ts');
  const A = await import('../../components/training-mode/data/trainingArcadeData.js');

  const open = (s) => s && s.isActive === true && s.status === 'active' && !s.construction;
  const campaigns = A.TRAINING_ARCADE_SERIES.filter((s) => s.v2Campaign && open(s));
  const legacy = A.TRAINING_ARCADE_SERIES.filter((s) => !s.v2Campaign && open(s) && A.isSeriesPlayable(s));

  const announcer = new Set(); const sets = new Set(); const rests = new Set(); const finishers = new Set(); const counts = new Set();
  const cadenceIntro = new Set(); const cadenceRest = new Set(); const cadenceCounts = new Set();

  // ── (a) and (b): the v2 campaigns on the counted-sets runner ───────────────
  const names = new Set();
  const plans = [];
  for (const series of campaigns) {
    for (const stage of series.stages) {
      if (C.isFinalBoss(series.v2Campaign, stage.id)) continue; // App.jsx:849, the boss finale has no prescription layer
      for (const diff of DIFFS) {
        const plan = S.resolveFitPrescription(series.v2Campaign, stage.id, diff);
        if (!plan?.exercises?.length) continue;
        plans.push({ campaignId: series.v2Campaign, stageId: stage.id, diff, exercises: plan.exercises });
        // App.jsx:854
        announcer.add(stripAnnouncer(S.announcerLine(series.v2Campaign, stage.id, diff, plan.exercises)));
        // Fit finishers, App.jsx:878. No campaign stage has a 'fit' finisher today (stageFinishers returns [] for all
        // of them: the finishers live on the FIGHT modules), so this sweep builds 0 lines. It stays so a finisher
        // added to a fit module is guarded from the day it lands; the ones the app does say are swept below.
        const fins = S.stageFinishers(series.v2Campaign, stage.id, 'fit', diff);
        fins.forEach((f, i) => {
          // CampFitSetRunner.jsx:249 (the opening one) and :254 (the next ones)
          if (i === 0) finishers.add(`Finisher. ${f.movement}. ${f.work_sec} seconds. Go!`);
          else finishers.add(`${f.movement}. ${f.work_sec} seconds. Go!`);
        });
      }
    }
  }

  // ── (b2): the FIGHT-path finishers, spoken by FightFocusTimer ──────────────
  // App.jsx:886-888 withFightFinishers: base.finishers = stageFinishers(campaignId, stage.id, 'fight', diff) for every
  // open stage except a boss finale (App.jsx:888 `if (!base.bossFinale)`, the flag arcadeCfg sets for isFinalBoss),
  // at every difficulty, with no prescription needed (a fight stage has none). FightFocusTimer.jsx:618 and :723 say
  // the first one as `Finisher. ${movement}. ${work_sec} seconds. Go!`, :664 each next one as
  // `${movement}. ${work_sec} seconds. Go!`.
  const fightFinishers = new Set();
  for (const series of campaigns) {
    for (const stage of series.stages) {
      if (C.isFinalBoss(series.v2Campaign, stage.id)) continue;
      for (const diff of DIFFS) {
        S.stageFinishers(series.v2Campaign, stage.id, 'fight', diff).forEach((f, i) => {
          fightFinishers.add(i === 0 ? `Finisher. ${f.movement}. ${f.work_sec} seconds. Go!` : `${f.movement}. ${f.work_sec} seconds. Go!`);
        });
      }
    }
  }

  // The lines of one exercise list, as the runner says them.
  const sayExercise = (ex, nextName, voiceOn = true) => {
    names.add(ex.name);
    const pol = E.countPolicy(ex, voiceOn);
    const nSets = ex.sets || 1; // CampFitSetRunner.jsx:217, `ex.sets || 1`
    for (let si = 0; si < nSets; si++) {
      // CampFitSetRunner.jsx:181-184
      if (pol.timedCompletion && ex.duration_sec != null) sets.add(`${ex.name}. Set ${si + 1}. Hold ${ex.duration_sec} seconds. Go.`);
      else if (pol.timedCompletion) sets.add(`${ex.name}. Set ${si + 1}. ${ex.reps} reps. Go.`);
      else if (ex.duration_sec != null) sets.add(`${ex.name}. Hold ${ex.duration_sec} seconds.`);
      else sets.add(`${ex.name}. Set ${si + 1}. ${ex.reps} reps.`);
    }
    // CampFitSetRunner.jsx:200-201, the counter: reps are counted aloud, a hold says "Halfway."
    const isHold = ex.duration_sec != null;
    if (!isHold && pol.voiceCount) for (let n = 1; n <= ex.reps; n++) counts.add(String(n));
    if (isHold) counts.add('Halfway.');
    // CampFitSetRunner.jsx:218-229, rest after a set. A weighted set rests by adaptiveRest of the time the athlete
    // took (COMPLETE is tapped by hand), any other set by rest_sec or 60. adaptiveRest (arcade-session-engine.ts:241)
    // is clamp(took * 1.5, 60 or 90 by category, 240) rounded, and the runner passes no loadKg, so it saturates at
    // 240 from a 160 s set on: every whole second of 0 to 400 s taken (a set cannot say a new value past that) is
    // swept with the exercise's own category, and every distinct result is a rest the app can say.
    const restValues = new Set();
    if (pol.timedCompletion) {
      for (let took = 0; took <= 400; took++) restValues.add(E.adaptiveRest({ timeToCompleteSec: took, category: ex.category, reps: ex.reps }));
    } else restValues.add(ex.rest_sec || 60);
    // Names: after a set the next call names this exercise, after its last set the next one.
    const nexts = [ex.name]; if (nextName) nexts.push(nextName);
    for (const r of restValues) for (const n of nexts) rests.add(`Rest. ${r} seconds. Next: ${n}.`);
  };

  for (const p of plans) {
    const weightedReview = p.exercises.some((e) => e.weighted || e.load_type === 'weighted'); // CampFitSetRunner.jsx:53
    const flip = (e) => (e.load_type === 'weighted' ? E.toBodyweight(e) : E.toWeighted(e)); // CampFitSetRunner.jsx:293
    const variants = [p.exercises];
    if (weightedReview) variants.push(p.exercises.map(flip));
    for (const exs of variants) {
      exs.forEach((ex, i) => sayExercise(ex, exs[i + 1]?.name));
      // The first movement of the run, as the fallback opener says it.
      announcer.add(`${exs[0].name}. ${S.doseLabel(exs[0])}.`);
    }
  }

  // ── (c): the legacy Arcade player ─────────────────────────────────────────
  // ArcadeSessionPlayer.jsx:29-150, re-typed: the task list of a block.
  const buildTaskList = (stage, blockKey) => {
    const block = blockKey === 'fit' ? stage.fitBlock : stage.fightBlock; // :30
    if (!block) return [];
    let tasks = [];
    if (block.tasks) tasks = [...block.tasks]; // :36
    else if (block.tasksPerRound && block.rounds) { // :38
      const isBoss = stage.stageType === 'bossCircuit';
      const isVariation = block.variationByRound;
      for (let r = 0; r < block.rounds; r++) {
        const roundTasks = isVariation ? block.tasksPerRound.filter((t) => t.roundNumber === r + 1) : block.tasksPerRound; // :46-50
        roundTasks.forEach((t) => {
          tasks.push({ ...t, title: `${t.title}${block.rounds > 1 && !isVariation ? ` (Round ${r + 1})` : ''}` }); // :61-68
        });
        if (isBoss && block.backBalanceInsertAfterRounds?.includes(r + 1)) { // :72
          const bbOptions = block.backBalanceInsert?.chooseOne || [];
          if (bbOptions.length > 0) tasks.push({ type: 'backBalance', title: 'Back-Balance Work', options: bbOptions }); // :75-87
        }
      }
    }
    // :112 and :127, the stage-level Back-Balance block (integrated or not, the title and options are the same)
    if (stage.backBalanceBlock && (stage.backBalanceBlock.options || []).length > 0) tasks.push({ type: 'backBalance', title: 'Back-Balance Work', options: stage.backBalanceBlock.options });
    // :143-160, the cardio block. Required stages always add it, optional ones when the toggle is on (it defaults to on).
    if (stage.cardioBlock && blockKey === 'fit') tasks.push({ type: 'cardio', title: 'Cardio Protocol' });
    return tasks;
  };

  for (const series of legacy) {
    for (const stage of series.stages) {
      for (const blockKey of ['fit', 'fight']) {
        const tasks = buildTaskList(stage, blockKey);
        // OP-1, ArcadeSessionPlayer.jsx:89-90: One Punch cadence circuits scale the fit reps from 4 up to the authored number.
        const scalable = blockKey === 'fit' && series.id === 'one-punch-protocol' && stage.stageType === 'cadenceCircuit';
        tasks.forEach((t, i) => {
          const next = tasks[i + 1]?.title; // ArcadeSessionPlayer.jsx:432
          const restLine = (rest) => `Rest for ${rest} seconds. Next workout is ${next || 'the next exercise'}. If you need more rest, pause before the next session.`; // ArcadeCadenceRepPlayer.jsx:168
          const introLine = (title, reps) => `${title || 'Exercise'}. ${reps || 10} reps. On my count.`; // ArcadeCadenceRepPlayer.jsx:153 (title) and :95 (reps)
          if (t.type === 'cadenceReps') {
            const authored = t.reps || 10;
            const repValues = new Set([authored]);
            if (scalable && Number.isFinite(t.reps)) for (let n = 4; n <= t.reps; n++) repValues.add(n);
            for (const n of repValues) cadenceIntro.add(introLine(t.title, n));
            cadenceRest.add(restLine(t.restSeconds || 20)); // :100
            for (let n = 1; n <= Math.max(...repValues); n++) cadenceCounts.add(String(n)); // :224
          } else if (t.type === 'backBalance') {
            // ArcadeSessionPlayer.jsx:668-681: the chosen option becomes the task (title, reps or 0, rest 15).
            for (const o of t.options || []) {
              cadenceIntro.add(introLine(o.label, o.reps || 0));
              cadenceRest.add(restLine(t.restSeconds || 15));
              for (let n = 1; n <= (o.reps || 10); n++) cadenceCounts.add(String(n));
            }
          }
        });
      }
    }
  }

  const out = [];
  const push = (feature, name, set) => out.push({ feature, name, lines: [...set].filter((l) => typeof l === 'string' && l.trim()) });
  push('Training Camp', 'Arcade campaign stage announcer and fallback opener (CampFitSetRunner.jsx:168, App.jsx:854)', announcer);
  push('Training Camp', 'Counted-sets runner, set calls as prescribed and after the weighted review toggle (CampFitSetRunner.jsx:181-184)', sets);
  push('Training Camp', 'Counted-sets runner, rest calls (CampFitSetRunner.jsx:229)', rests);
  push('Training Camp', 'Counted-sets runner, rep counts and Halfway (CampFitSetRunner.jsx:200-201)', counts);
  push('Training Camp', 'Counted-sets runner, finishers (CampFitSetRunner.jsx:249, :254; builds 0 lines today, no fit stage has a finisher)', finishers);
  push('Training Camp', 'Fight-path finishers (FightFocusTimer.jsx:618, :664, :723; App.jsx:886-888)', fightFinishers);
  push('Training Arcade', 'Legacy arcade cadence player, intro per task and Back-Balance option (ArcadeCadenceRepPlayer.jsx:153)', cadenceIntro);
  push('Training Arcade', 'Legacy arcade cadence player, rest and next workout (ArcadeCadenceRepPlayer.jsx:168)', cadenceRest);
  push('Training Arcade', 'Legacy arcade cadence player, rep counts (ArcadeCadenceRepPlayer.jsx:224)', cadenceCounts);
  return out;
};
