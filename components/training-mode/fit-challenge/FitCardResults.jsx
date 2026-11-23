import { useState } from 'react';
import ChallengeResults from './ui/ChallengeResults';
import { OUTCOME_PRESET, resolveOutcome } from '../shared/sessionOutcome';
import { levelWord } from '../data/quickMissionConfig';
import { estimateQuickMissionSeconds } from '../fit-mode/quickMissionGenerator';
import { cardRunDone, snapshotOf } from '../data/fitCard';
import { saveCardWorkout, isSaved } from '../data/fitCardStore';

// The results of a card run (switch fitCard): the app's own end screen
// (shared/MissionComplete) through ui/ChallengeResults: rounds, total reps and
// the time in its stats; the share done, the moves ticked (or done) and each
// round's time in its recap; REPEAT, NEW CHALLENGE and SAVE WORKOUT.
//
// The run was banked once already, in App, before this screen opened: this
// screen only shows the XP it banked (result.xpEarned). SAVE WORKOUT keeps the
// card's moves to repeat from CHOOSE (data/fitCardStore): it never writes the
// stats or the XP again. Bonus work is not on it (the owner's choice).
const SOLO_PRESET = { pass: 'pass', partial: 'partial', too_fast: 'validation_failed', none: 'fail' };
const word = (t) => String(t || '').charAt(0) + String(t || '').slice(1).toLowerCase();

export default function FitCardResults({ result, onRepeat, onNew, onBack }) {
  const card = result.card;
  const solo = result.mode === 'solo';
  const done = result.cardDone || cardRunDone(card, { ticks: result.ticks, exercisesCompleted: result.exercisesCompleted });
  const [saved, setSaved] = useState(() => isSaved(snapshotOf(card)));
  const save = () => { saveCardWorkout(snapshotOf(card)); setSaved(true); };

  let preset;
  let failReason;
  if (solo) {
    preset = OUTCOME_PRESET[SOLO_PRESET[result.settle?.outcome] || 'fail'];
    failReason = result.settle?.message || undefined;
  } else {
    const verdict = resolveOutcome({
      completed: result.exercisesCompleted, total: result.totalExercises, difficulty: result.mission?.difficulty, integrityResult: result.integrityResult, advancedAs: 'hard',
    });
    preset = verdict.preset;
    failReason = verdict.response;
  }
  // A guided run keeps the coach's time: its clock is the plan's, for the
  // sets it ran. An AT YOUR PACE run has its own clock and round times.
  const elapsedSec = solo ? result.elapsedSec || 0 : Math.round(estimateQuickMissionSeconds({ ...card, finisherExercises: [] }) * Math.min(1, done.ticked / Math.max(1, done.cells)));
  const splits = solo && Array.isArray(result.rounds) ? result.rounds.map((r) => r.lapSec) : [];
  const how = solo ? (result.checkOff ? 'Check-off' : 'At your pace') : 'Guided';

  return (
    <div data-fc="results">
      <ChallengeResults
        title={card.title} subtitle={`Circuit · ${word(levelWord(card.difficulty))} · ${how}`}
        rounds={done.roundsDone} totalRounds={card.rounds} reps={done.repsDone} elapsedSec={elapsedSec}
        pct={done.pct} ticked={done.ticked} cells={done.cells} splits={splits} xp={result.xpEarned || 0}
        variant={preset.variant} eyebrow={preset.eyebrow} failReason={preset.variant === 'success' ? undefined : failReason}
        doneWord={result.checkOff ? 'ticked' : 'done'} note={done.holdSec ? `Holds: ${done.holdSec}s in all.` : null}
        saved={saved} onSave={save} onRepeat={onRepeat} onNew={onNew} onBack={onBack}
      />
    </div>
  );
}
