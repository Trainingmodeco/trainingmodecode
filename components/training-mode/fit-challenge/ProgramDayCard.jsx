import { useMemo, useState } from 'react';
import WorkoutCard from './ui/WorkoutCard';
import ProgramDayHeader from './ui/ProgramDayHeader';
import { programDayConfig, programDayIndex, programMinutes } from '../data/workoutPrograms';
import { generateFitModeWorkout } from '../fit-mode/fitModeGenerator';
import { applySetScheme } from '../data/builderTiming';

// A program day on THE WORKOUT CARD (switch fitCard): the card is the day's
// preview (the owner's choice). The day's own exercises, sets and reps, as the
// Workout Builder generates them for the program's scheme; SHUFFLE THIS DAY
// deals the day again; START (RESUME) opens exactly this list in the builder, which
// runs it as it always has (sets × reps, 15 XP an exercise + 30). No rounds,
// no swaps here: the builder's list has its own.
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const EQUIP_TAG = { Bodyweight: 'Bodyweight', Weighted: 'Weights', Hybrid: 'Hybrid' };
const doseOf = (e) => (e.sets ? `${e.sets} × ${e.reps}` : String(e.reps || (e.durationSeconds ? `${e.durationSeconds}s` : '')));

export default function ProgramDayCard({ program, current, equipment, onStart }) {
  const [deal, setDeal] = useState(0);
  const [open, setOpen] = useState(false);
  const idx = programDayIndex(program);
  const day = program.days[idx];
  const split = program.days.length > 1;
  const cfg = useMemo(() => programDayConfig(program, { equipment }), [program, equipment]);
  // One deal per program, equipment and SHUFFLE; the builder keeps its own
  // novelty history, as when it generates the day itself.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const exercises = useMemo(() => applySetScheme(generateFitModeWorkout(cfg), cfg.setScheme), [cfg, deal]);
  const rows = exercises.map((e, i) => ({ swapKey: `p${i}-${e.name}`, name: e.name, dose: doseOf(e), canSwap: false }));
  // The help line names the button it sits over.
  const startLabel = current ? 'RESUME' : 'START';
  return (
    <div data-fc="program" style={{ flexShrink: 0 }}>
    <WorkoutCard
      guide="pg-card"
      eyebrow={current ? 'Continue program' : 'Start a program'}
      title={split ? `${day.label} DAY` : titleCase(program.title)}
      tags={[{ label: `~${programMinutes(program, equipment)} min` }, { label: program.scheme?.id?.replace('x', ' × ') || 'Sets', accent: true }, { label: EQUIP_TAG[equipment] || equipment }]}
      header={split ? <ProgramDayHeader program={titleCase(program.title)} dayIndex={idx} days={program.days.map((d) => d.label)}/> : null}
      onShuffle={() => setDeal((n) => n + 1)} shuffleLabel="SHUFFLE THIS DAY"
      rows={rows}
      runHelp={`The program’s sets and reps. ${startLabel} opens the list.`}
      onStart={() => onStart?.({ ...cfg, savedExercises: exercises })} startLabel={startLabel}
      art="/static/fitmode/banner-gym-programs.webp"
      open={open} onToggle={() => setOpen((o) => !o)}
    />
    </div>
  );
}
