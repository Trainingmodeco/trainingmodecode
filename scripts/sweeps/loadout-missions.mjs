// Quick Mission v2: the lines the coach says for the hand-written loadout
// missions (data/loadoutMissions.js LOADOUT_MISSIONS), made with the app's own
// builders (data/missionMoves.js, data/missionSolo.js) the way
// components/training-mode/QuickMissionActive.jsx calls them.
//
// Which missions: every def, at every level it offers, under every gear
// profile (a base move whose gear is missing opens on its first allowed
// alternative, and which alternatives a swap can reach depends on the gear),
// and every one-swap variant the swap sheet can reach (reachableMoves of each
// row, applied with swapMissionMove from the built base). Two-row swaps only
// for the intro line "Swapped in: A, B." (the one line that names more than one
// swapped move).
//
// Gear profiles. The profile is gearProfile() (loadoutMissions.js:1578): 'none'
// plus 'bag' when the Heavy Bag is ticked in the equipment profile, so TODAY the
// app can only produce {none} and {none, bag}; the other kinds of GEAR_TAGS
// (bell, db, barbell, plate, rower, box, bar) come from the mission's own
// loadout (LOADOUT_GEAR), not from the profile. The profile is nonetheless the
// one input the builders take (every call passes `gear`), so every SUBSET of the
// eight kinds is swept: 256 profiles, each built per def and level, and one
// whose built slot list and reachable moves (with their count multipliers) equal
// those of a profile already built adds nothing and is skipped. The lines that
// only a profile of two or more pieces builds (none of them reachable until
// gearProfile() maps a second kind) are kept apart in their own sweep at the
// end, so they can be told from the lines of {none}, {none, X} and all gear.
// MEASURED (2026-11-14): across the 256 profiles every mission a profile of two
// or more pieces builds, base or one swap, is the same mission {none}, {none, X}
// or all gear builds (2089 distinct built missions in each pass), so that last
// sweep is empty today. (An earlier look found 36 such "only multi-piece" lines,
// e.g. first_bell beginner "Minute 21. 10 swings."; they came from calling
// leadLine for round 2 of a one-round mission and with rounds = total on an
// until-down run, which the runner never does, QuickMissionActive.jsx:374.)
//
// Round-dependent text ("Round 3.", "Minute 7.", the rest tip of the round)
// depends on the round and not on the swap, but a swapped variant is built
// at EVERY round and minute all the same: that costs little and adds lines.
// MEASURED: against rounds 1, 2 and the last it adds 2634 distinct lines
// (lead lines +1696, rest openers +938), none needing a phrase the other lines
// do not already need (see SWAPPED_EVERY_ROUND below).
import process from 'node:process';
import { buildLoadoutMission, swapMissionMove, reachableMoves, LOADOUT_MISSIONS, levelsOf } from '../../components/training-mode/data/loadoutMissions.js';
import * as M from '../../components/training-mode/data/missionMoves.js';
import * as S from '../../components/training-mode/data/missionSolo.js';
import { QM_WEIGHT_BRIEF } from '../../components/training-mode/data/quickMissionTiming.js';

const FEATURE = 'Quick Mission';
// Measurement switch: SWEEP_SWAPPED_SPARSE=1 builds a swapped variant at rounds 1, 2 and the last only (the
// module's earlier behavior), to count the lines the every-round build adds. Never set in the test.
const SWAPPED_EVERY_ROUND = !process.env.SWEEP_SWAPPED_SPARSE;

export default async () => {
  // Gear profile comes from localStorage unless passed; every call here passes it.
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear(), key: () => null, length: 0 };
  }
  // Every subset of the gear kinds (the 'none' of GEAR_TAGS is always in a profile). Profiles of at most one piece
  // and all gear (the first pass) are told from the profiles of two or more pieces short of all (the second pass).
  const kinds = M.GEAR_TAGS.filter((g) => g !== 'none');
  const allProfiles = [];
  for (let mask = 0; mask < (1 << kinds.length); mask++) allProfiles.push({ pieces: kinds.filter((_, i) => mask & (1 << i)), mask });
  const toSet = (p) => new Set(['none', ...p.pieces]);
  const FULL = (1 << kinds.length) - 1;
  const gearSets = [new Set(M.GEAR_TAGS), ...allProfiles.filter((p) => p.pieces.length <= 1 && p.mask !== FULL).map(toSet)];
  const multiGearSets = allProfiles.filter((p) => p.pieces.length >= 2 && p.mask !== FULL).map(toSet);

  const KEYS = ['intro', 'introPairs', 'lead', 'chained', 'workStart', 'rest', 'count', 'nearEnd', 'calls', 'down', 'max', 'misc'];
  const newSets = () => Object.fromEntries(KEYS.map((k) => [k, new Set()]));
  const sets = newSets();      // the first pass: {none}, {none, X} and all gear
  const multi = newSets();     // the second pass: every other subset
  let target = sets;
  let maxTop = 200; // at least the 0-200 range of the earlier audit
  const add = (k, line) => { if (typeof line === 'string' && line.trim()) target[k].add(line); };

  // The slots a run plays, in order, with the same "next" the runner uses
  // (getNextExerciseInfo: the next slot, the first of the next round, or none).
  const nextOf = (ex, idx, r, rounds) => (idx + 1 < ex.length ? ex[idx + 1] : r < rounds ? ex[0] : null);

  const sweepMission = (m, rounds) => {
    const ex = [...m.exercises, ...(m.finisherExercises || [])];
    if (!ex.length) return;
    const untilDown = S.isUntilDown(m);
    const roundsDown = untilDown && m.downUnit === 'round';
    const maxReps = S.isMaxReps(m);
    const total = m.rounds || 1;
    const dc = S.downCopy(m);

    // runIntroV2 (QuickMissionActive.jsx:922-932): weight brief for Weighted and
    // Hybrid, "Swapped in: ...", the mission's own line, MAX REPS safety line.
    if (m.workoutType === 'Weighted' || m.workoutType === 'Hybrid') add('intro', QM_WEIGHT_BRIEF);
    add('intro', M.swappedInLine(m));
    add('intro', m.introSay);
    if (maxReps && m.safety) add('intro', m.safety);

    for (const r of rounds) {
      ex.forEach((slot, idx) => {
        const next = nextOf(ex, idx, r, total);
        const legacyOpts = [false, true]; // legacyCountedFor(ex) is false for a catalog slot; both are built
        // planRest (QuickMissionActive.jsx:366-383): the lead line for slot idx of round r.
        for (const lc of legacyOpts) {
          const lead = M.leadLine(slot, { round: r, idx, rounds: untilDown && !roundsDown ? 1 : total, slotsPerRound: ex.length, format: m.format, legacyCounted: lc });
          const short = M.shortRestLine(slot);
          // The rest before this slot: what the previous slot authored (window slots rest what is left of the minute).
          const prev = idx > 0 ? ex[idx - 1] : r > 1 ? ex[ex.length - 1] : null;
          const restSecs = new Set();
          if (prev) {
            if (prev.window) for (let w = 0; w <= prev.window; w++) restSecs.add(M.windowRest(prev, w));
            else restSecs.add(prev.rest || 0);
          }
          restSecs.add(5); // UNDO / REWIND rests 5 s (QuickMissionActive.jsx:678)
          const roundEnd = idx === 0 && r > 1;
          const completedRound = idx === 0 ? Math.max(0, r - 1) : r;
          for (const sec of restSecs) {
            if (!(sec > 0)) continue;
            const sc = M.restScript({ restSec: sec, kind: 'rest', roundEnd, completedRound, format: m.format, tips: m.tips || [], lead, short });
            add('rest', sc.opener); add('rest', sc.leadAt != null ? sc.lead : null); add('rest', sc.plan === 'short' ? sc.short : null);
            // A short rest also speaks the short line on SKIP and RESUME (:1092, :1133).
            add('rest', short);
          }
          if (r === 1 && idx === 0) { // the intro's GET READY (kind 'lead', :414)
            const gr = M.getReadySeconds(lead);
            const sc = M.restScript({ restSec: gr, kind: 'lead', format: m.format, tips: m.tips || [], lead, short });
            add('rest', sc.lead);
          }
          add('lead', lead);
        }
        add('chained', M.chainedLine(slot));
        // moveToNextV2 (QuickMissionActive.jsx:460-464).
        for (const lc of legacyOpts) {
          for (const ab of ['lead', 'short', null]) add('workStart', M.workStartLine(slot, { announcedBy: ab, legacyCounted: lc }));
          add('workStart', M.chainedLine(slot, { legacyCounted: lc }));
        }
        if (untilDown) add('workStart', roundsDown ? M.roundLine(r) : M.switchLine(slot)); // also :1421 after "Still going?"
        // startWorkCount (:426): no "Up next" inside an until-down run.
        const beats = M.countBeats(slot, { next: untilDown ? null : next });
        (beats || []).forEach((b) => add('count', b.say));
        // The pace count on a timed move (:690) says plain numbers.
        const pace = M.paceBeats(slot);
        if (pace) for (let i = 1; i <= pace.n; i++) add('count', String(i));
        // The near-end call (:1050) uses nextSlotOf, also in an until-down run.
        if (M.nearEndUpNextAt(slot, next) != null) add('nearEnd', `Up next: ${M.spokenMove(next)}.`);
        // Scripted calls on a timed move (:1007).
        if (slot.mode === 'timed') (slot.calls || []).forEach((c) => add('calls', c.say));
        // The MAX REPS cap call (:1440): only a hinge or swing set with a cap.
        if (maxReps && slot.max && M.maxCapCallSec(slot, m.level) != null) add('misc', M.MAX_CAP_CALL);
      });
    }

    if (untilDown) {
      // endDown (:1282) and askCheck (:1414).
      add('down', dc.capSay);
      add('misc', 'Still going?');
      // Sets (or rounds) a run can reach: advanceV2 finishes the run after the last slot of the last round
      // (QuickMissionActive.jsx:503), so the count never passes totalSlots (NO CONTINUES 90, UPPER LOWER DIPS 60).
      const top = S.totalSlots(m);
      for (let n = 1; n <= top; n++) add('down', `${dc.doneSay} ${S.downCount(m, n)}.`);
    }
    if (maxReps) {
      // endMax (:1341): "Time." on the cap, else "Done. N reps." for the saved total. The most one run can total:
      // every set of the plan at the rep sheet's limit (maxRepsLimit) for an even share of the cap.
      add('max', 'Time.');
      let most = 0;
      for (let i = 0; i < S.totalSlots(m); i++) most += S.maxRepsLimit(ex[i % ex.length], (m.capSec || 0) / S.totalSlots(m), m.level);
      maxTop = Math.max(maxTop, most);
    }
  };

  // One pass over a list of profiles. A mission is built once per distinct content (the dedupe key), and a profile
  // whose built base and reachable moves (with their count multipliers) are those of an earlier profile of the same
  // def and level is skipped whole: the swap variants, the pairs and so the lines would be the same.
  const sigSeen = new Set();
  const runPass = (profiles, into) => {
    const built = [];
    const seen = new Set();
    const push = (m, full) => {
      if (!m) return;
      const key = JSON.stringify([m.id, m.level, m.exercises.map((s) => [s.moveId || s.name, s.mode, s.reps, s.work, s.rest, s.cadenceMs, s.max, s.leave, s.cap, (s.list || []).map((t) => [t.moveId, t.reps, t.work])]), full]);
      if (seen.has(key) || builtAll.has(key)) return;
      seen.add(key); builtAll.add(key);
      built.push([m, full]);
    };
    target = into;
    for (const def of LOADOUT_MISSIONS) {
      for (const lv of levelsOf(def)) {
        for (const gear of profiles) {
          const base = buildLoadoutMission(def.id, { level: lv.id, gear });
          if (!base) continue;
          const keys = M.rowItems(base).map(({ item }) => item.swapKey);
          const reach = keys.map((key) => [key, reachableMoves(base, key, { gear })]);
          const sig = JSON.stringify([def.id, lv.id, base.exercises, reach.map(([k, r]) => [k, [...r].map(([id, v]) => `${id}:${v.x}`).sort()])]);
          if (sigSeen.has(sig)) continue;
          sigSeen.add(sig);
          push(base, true);
          const swapped = [];
          for (const [key, moves] of reach) {
            for (const moveId of moves.keys()) {
              const m2 = swapMissionMove(base, key, moveId, { gear });
              if (m2 === base) continue;
              push(m2, SWAPPED_EVERY_ROUND);
              swapped.push([key, moveId, m2]);
            }
          }
          // Two different rows swapped: only the intro line "Swapped in: A, B." differs.
          for (let i = 0; i < swapped.length; i++) {
            for (let j = i + 1; j < swapped.length; j++) {
              if (swapped[i][0] === swapped[j][0]) continue;
              const both = swapMissionMove(swapped[i][2], swapped[j][0], swapped[j][1], { gear });
              add('introPairs', M.swappedInLine(both));
            }
          }
        }
      }
    }
    for (const [m, full] of built) {
      const total = m.rounds || 1;
      const rounds = full ? Array.from({ length: total }, (_, i) => i + 1) : [...new Set([1, 2, total].filter((r) => r >= 1 && r <= total))];
      sweepMission(m, rounds);
    }
  };
  const builtAll = new Set();
  runPass(gearSets, sets);
  runPass(multiGearSets, multi);
  target = sets;
  // Done. N reps. for every total a MAX REPS run can reach (0 up to the largest bound found above).
  for (let n = 0; n <= maxTop; n++) add('max', M.maxFinishLine(n));

  const list = (k) => [...sets[k]];
  const named = (name, k) => ({ feature: FEATURE, name, lines: list(k) });
  // What only a profile of two or more pieces builds: the lines of the second pass the first has not got.
  const onlyMulti = KEYS.flatMap((k) => [...multi[k]].filter((l) => !sets[k].has(l)));
  return [
    named('loadout missions: intro lines (weight brief, swapped in, intro say, MAX OUT safety)', 'intro'),
    named('loadout missions: intro line with two rows swapped (Swapped in: A, B.)', 'introPairs'),
    named('loadout missions: lead lines (every round, minute, slot, level, gear, swap)', 'lead'),
    named('loadout missions: chained, switch and round lines at work start', 'workStart'),
    named('loadout missions: chained start lines', 'chained'),
    named('loadout missions: rest openers with tips, lead and short lines', 'rest'),
    named('loadout missions: count beats (Switch, One more, Two more, Up next, steps)', 'count'),
    named('loadout missions: near-end Up next calls', 'nearEnd'),
    named('loadout missions: scripted calls on timed moves', 'calls'),
    named('loadout missions: until-down finish lines', 'down'),
    named('loadout missions: MAX REPS finish lines', 'max'),
    named('loadout missions: fixed lines (Still going, cap call)', 'misc'),
    { feature: FEATURE, name: 'loadout missions: lines only a gear profile of two or more pieces builds (not reachable until gearProfile() maps a second kind)', lines: onlyMulti },
  ];
};
