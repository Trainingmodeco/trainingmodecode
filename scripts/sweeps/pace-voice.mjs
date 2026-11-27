// AT YOUR PACE's coach (components/training-mode/data/paceVoice.js, said by
// QuickMissionSolo.jsx and the warm-up it opens with, shared/WarmupTimer.jsx).
// Its lines are fixed sentences chosen by the mission's format: the warm-up
// lines, the WORKOUTS line (with and without swapping), the start under GET
// READY (what the buttons of this format do) and the run's cues. This sweep
// builds them with the module's own functions for every library mission at
// every level and for today's generated mission over the setup's choices
// (data/soloFromGenerated: the same moves at 1 to 6 rounds, one round has
// FINISH only), and the Fit card's CHECK-OFF start (one line: it does not
// depend on the mission).
const range = (lo, hi, step = 1) => { const out = []; for (let v = lo; v <= hi; v += step) out.push(v); return out; };

export default async function sweep() {
  const PV = await import('../../components/training-mode/data/paceVoice.js');
  const L = await import('../../components/training-mode/data/loadoutMissions.js');
  const GEN = await import('../../components/training-mode/data/soloFromGenerated.js');
  const { generateQuickMission } = await import('../../components/training-mode/fit-mode/quickMissionGenerator.js');
  const fixed = new Set([PV.PACE_WARMUP.intro, PV.PACE_WARMUP.half, PV.PACE_WARMUP.lastTen, PV.PACE_WARMUP.done,
    PV.workoutsLine({ canSwap: true }), PV.workoutsLine({ canSwap: false }), ...Object.values(PV.PACE_RUN)]);
  // The Fit card's CHECK-OFF run starts the same way (fit-challenge/FitCheckOffSolo): its own how-to, no run cues.
  const start = new Set([PV.startLine(null, { checkOff: true })]);
  const cues = new Set();
  const say = (m) => { start.add(PV.startLine(m)); for (const c of PV.runVoiceCues(m)) cues.add(c.say); };
  for (const d of L.LOADOUT_MISSIONS) for (const lv of L.levelsOf(d)) say(L.buildLoadoutMission(d.id, { level: lv.id }));
  let seed = 11;
  const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const workoutType of ['Bodyweight', 'Weighted', 'Hybrid']) for (const difficulty of ['Easy', 'Normal', 'Hard', 'Advanced']) for (const duration of range(5, 60, 5)) {
    for (const cardioFinisher of [false, true]) {
      const gen = generateQuickMission({ workoutType, duration, difficulty, cardioFinisher, rng });
      for (const rounds of range(1, 6)) say(GEN.soloFromGenerated({ ...gen, rounds }));
    }
  }
  return [
    { feature: 'Quick Mission', name: 'AT YOUR PACE: the warm-up, WORKOUTS and the run\'s fixed lines', lines: [...fixed] },
    { feature: 'Quick Mission', name: 'AT YOUR PACE: the spoken start of every library mission and generated mission', lines: [...start] },
    { feature: 'Quick Mission', name: 'AT YOUR PACE: the run\'s cues (rest, back to work, the last minute)', lines: [...cues] },
  ];
}
