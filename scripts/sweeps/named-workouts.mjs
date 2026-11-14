// The classic named workouts of Quick Mission (data/namedWorkouts.js: Murph,
// Half Murph, Sally Up x2, Deadly Seven, 5 Minutes of Hell x2, and the owner's
// library sessions from data/workoutLibrary.js), said the way their runner says
// them.
//
// Which path a classic takes. QuickMissionSetup.jsx:577 (startClassic) hands
// the built mission to QuickMissionActive with no v2 flag on the config, but
// QuickMissionActive.jsx:119 reads `v2 = qmV2Enabled()`, and data/qmV2.js has
// QM_V2_FOR_EVERYONE = true. So today a classic runs the v2 runner (intro
// runIntroV2 at :901, rests by restScript, lead / short / chained lines of
// data/missionMoves, the count of countBeats). The old runner (lines such as
// `${ex.name}. ${target}. Ready. Begin.`) is dead while that flag is true, and
// is swept second so it is proven the day the flag goes back to false.
//
// A classic has no level picker, swap sheet or equipment choice: its
// difficulty is a fixed field of the workout (Hard, or Easy / Normal /
// Advanced for the Strike Fitness ones) and is never spoken. What can change
// the words is (a) the coach style (four sessionStart / sessionComplete
// variants), (b) the workout's own workoutType (chaos_engine is Weighted and
// says the weight brief), and (c) the cadence count setting, which a classic
// starts with as true (quickMissionConfig.js:59) but which can be false.
// Classics start with countType 'Bodyweight' (QuickMissionSetup.jsx:586), so
// the count whitelist is judged as a bodyweight run.
//
// A classic has no introSay, say, tips, window, moveId or list, and mission.v2
// is not set, so swappedInLine, introSay, the pace count and the minute
// windows say nothing for it. The only move with its own calls is Sally Up.
import fs from 'node:fs';
import { NAMED_WORKOUTS, buildNamedMission } from '../../components/training-mode/data/namedWorkouts.js';
import * as mm from '../../components/training-mode/data/missionMoves.js';
import { isCadenceEligible, QM_WEIGHT_BRIEF } from '../../components/training-mode/data/quickMissionTiming.js';

// getCoachCopy (data/coachCopy.js:24) reads the profile's coach style, which
// is cached once per process, so the four variants are read from the source.
const COPY_SRC = fs.readFileSync(new URL('../../components/training-mode/data/coachCopy.js', import.meta.url), 'utf8');
const copyLines = (key) => {
  const block = COPY_SRC.match(new RegExp(`${key}:\\s*\\{([^}]*)\\}`))?.[1] || '';
  return [...block.matchAll(/:\s*(["'])((?:(?!\1).)*)\1/g)].map((m) => m[2]);
};

// QuickMissionActive.jsx:94-98 (spokenTarget), copied.
const spokenTarget = (ex) => {
  if (ex.mode === 'timed') return mm.secondsPhrase(ex.work);
  if (ex.unit) return `${ex.reps} ${String(ex.unit).toLowerCase()}`;
  return `${ex.reps} reps`;
};
// QuickMissionActive.jsx:100-104 (getPrepMessage), copied.
const getPrepMessage = (workoutType) => {
  if (workoutType === 'Weighted') return 'Grab your weight and prepare.';
  if (workoutType === 'Hybrid') return 'Prepare your setup.';
  return 'Get in position.';
};

export default async () => {
  const v2Lines = new Set();
  const intro = new Set();
  const legacy = new Set();
  const finish = new Set();

  // Spoken 3-2-1 (QuickMissionActive.jsx:1043); one value each is enough.
  for (const n of [1, 2, 3]) v2Lines.add(String(n));

  for (const style of copyLines('sessionStart')) intro.add(style); // :860 and :930
  for (const style of copyLines('sessionComplete')) finish.add(style); // :1237

  for (const w of NAMED_WORKOUTS) {
    const mission = buildNamedMission(w.id);
    const all = [...mission.exercises, ...mission.finisherExercises];
    const rounds = mission.rounds || 1;
    const workoutType = mission.workoutType || 'Bodyweight';
    if (workoutType === 'Weighted' || workoutType === 'Hybrid') intro.add(QM_WEIGHT_BRIEF); // :853 and :923
    // :280, the count config of a classic.
    const countCfgs = [{ workoutType: 'Bodyweight', cadenceCount: true }, { workoutType: 'Bodyweight', cadenceCount: false }];

    for (const countCfg of countCfgs) {
      const legacyCountedFor = (ex) => !!ex && !mm.isCatalogSlot(ex) && isCadenceEligible(ex, countCfg); // :365
      const nextSlotOf = (idx, r) => { // :364, getNextExerciseInfo at :80
        if (idx + 1 < all.length) return all[idx + 1];
        return r < rounds ? all[0] : null;
      };
      // planRest (:373): the script of a rest before slot nextIdx of round nextRound.
      const plan = (restSec, { kind = 'rest', roundEnd = false, completedRound = 0, nextIdx, nextRound }) => {
        const next = all[nextIdx];
        const lead = mm.leadLine(next, { round: nextRound, idx: nextIdx, rounds, slotsPerRound: all.length, format: mission.format, legacyCounted: legacyCountedFor(next) });
        const sec = kind === 'lead' ? mm.getReadySeconds(lead) : restSec;
        const script = mm.restScript({ restSec: sec, kind, roundEnd, completedRound, format: mission.format, tips: mission.tips || [], lead, short: mm.shortRestLine(next) });
        // What is spoken: the opener (:399), the short line (:401), the lead at leadAt (:1040).
        if (script.opener) v2Lines.add(script.opener);
        if (script.plan === 'short' && script.short) v2Lines.add(script.short);
        if (script.leadAt != null && script.lead) v2Lines.add(script.lead);
        const announcedBy = script.leadAt != null && script.lead ? 'lead' : script.plan === 'short' && script.short ? 'short' : null;
        return announcedBy;
      };
      // Work start of a slot (:463) and its count (:1007 calls, :796 beats, :1050 near end).
      const work = (ex, idx, r, announcedBy) => {
        const line = mm.workStartLine(ex, { announcedBy, legacyCounted: legacyCountedFor(ex) });
        if (line) v2Lines.add(line);
        if (ex.calls?.length && ex.mode === 'timed') for (const c of ex.calls) v2Lines.add(c.say);
        const next = nextSlotOf(idx, r);
        if (ex.mode === 'reps' && (mm.isCatalogSlot(ex) || isCadenceEligible(ex, countCfg))) {
          for (const b of mm.countBeats(ex, { next }) || []) v2Lines.add(String(b.say));
        }
        if (ex.mode === 'timed' && next && mm.nearEndUpNextAt(ex, next) != null) v2Lines.add(`Up next: ${mm.spokenMove(next)}.`);
      };

      // The intro's GET READY rest for slot 1, then slot 1 (beginRunV2 at :409).
      let by = plan(null, { kind: 'lead', nextIdx: 0, nextRound: 1 });
      work(all[0], 0, 1, by);
      // Every slot of every round, the rest after it (advanceV2 at :482), and the next slot.
      for (let r = 1; r <= rounds; r += 1) {
        for (let i = 0; i < all.length; i += 1) {
          const ex = all[i];
          const last = i === all.length - 1;
          if (last && r >= rounds) continue; // finish
          const nextIdx = last ? 0 : i + 1;
          const nextRound = last ? r + 1 : r;
          const rest = ex.rest || 0; // a classic is not a generated mission: no held-minute rest
          if (rest > 0) by = plan(rest, { roundEnd: last, completedRound: r, nextIdx, nextRound });
          else by = null;
          work(all[nextIdx], nextIdx, nextRound, by);
        }
      }
      // REWIND (:678): a 5 s rest before any slot, as round 1 or as a later round's slot.
      for (let r = 1; r <= rounds; r += 1) {
        for (let i = 0; i < all.length; i += 1) {
          by = plan(5, { kind: 'rest', nextIdx: i, nextRound: r });
          work(all[i], i, r, by);
        }
      }
    }

    // The old runner (dead while QM_V2_FOR_EVERYONE is true). Rest lines :342-352, 10 s call :1026,
    // first move :886, later moves :579. A move with its own calls says only its name.
    const prep = getPrepMessage(workoutType);
    for (const cadence of [true, false]) {
      const countCfg = { workoutType: 'Bodyweight', cadenceCount: cadence };
      const startLine = (ex, first) => {
        const intro2 = isCadenceEligible(ex, countCfg) ? ' On my count.' : '';
        return ex.calls?.length ? `${ex.name}.` : `${first ? 'Round 1. ' : ''}${ex.name}. ${spokenTarget(ex)}.${intro2} Ready. Begin.`;
      };
      legacy.add(startLine(all[0], true));
      for (let r = 1; r <= rounds; r += 1) {
        for (let i = 0; i < all.length; i += 1) {
          const ex = all[i];
          const restSec = Math.max(1, Number(ex.rest) || 0);
          const last = i === all.length - 1;
          if (last) {
            if (r < rounds) {
              legacy.add(`Round ${r} complete. Rest. ${mm.secondsPhrase(restSec)}. Up next: Round ${r + 1}. ${all[0].name}. ${prep}`);
              legacy.add(startLine(all[0], false));
            } else legacy.add(`Round ${r} complete. Rest.`);
          } else {
            legacy.add(`Rest. ${mm.secondsPhrase(restSec)}. Up next: ${all[i + 1].name}. ${prep}`);
            legacy.add(startLine(all[i + 1], false));
          }
        }
      }
    }
  }
  legacy.add('10 seconds. Get ready.'); // :1026
  legacy.add('Rest.'); // :352

  return [
    { feature: 'Quick Mission', name: 'classic named workouts: intro, finish and weight brief (every coach style)', lines: [...intro, ...finish] },
    { feature: 'Quick Mission', name: 'classic named workouts, v2 runner: GET READY, leads, short lines, rests, starts, counts, Sally Up calls, up-next (every workout, round and rest)', lines: [...v2Lines] },
    { feature: 'Quick Mission', name: 'classic named workouts, old runner (dormant while QM v2 is on): rest, round and move lines', lines: [...legacy] },
  ];
};
