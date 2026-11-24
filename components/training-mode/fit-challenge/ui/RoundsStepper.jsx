import { Minus, Plus, Timer } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT } from '../../shared/FitSetupKit';
import { holdWord } from '../../data/challengeTotals';

// ROUNDS on the wired card (the owner's note: the time stays the input, the
// rounds are generated from it, and + adds a round): − N + on the left, the
// sum on the right, as the sum it is.
//
//   [−]  4  [+]  │  99 × 4 = 396 reps
//     ROUNDS     │  ⏱ About 27 min
//
// A timed move counts in seconds, never in reps: "+ 2:00 hold" joins the
// time line. Both buttons are 44px. totals: data/fitCard cardTotals.
function StepButton({ label, onClick, disabled, children }) {
  return (
    <button type="button" aria-label={label} onClick={disabled ? undefined : onClick} aria-disabled={disabled ? 'true' : undefined} style={{
      width: 44, height: 44, flexShrink: 0, padding: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: disabled ? 'transparent' : 'rgba(157,108,255,0.18)', border: `1px solid ${disabled ? 'rgba(255,255,255,0.1)' : VIOLET}`,
      color: disabled ? '#5F5A78' : '#fff', cursor: disabled ? 'default' : 'pointer',
    }}>{children}</button>
  );
}

export default function RoundsStepper({ totals, min = 1, max = 10, onStep, guide, note }) {
  const { repsPerRound, secondsPerRound, rounds, totalReps, totalSeconds, estMinutes } = totals;
  const said = `${rounds} rounds. ${repsPerRound} reps a round${secondsPerRound ? ` and ${secondsPerRound} seconds of holds` : ''}, ${totalReps} reps in all, about ${estMinutes} minutes.`;
  return (
    <div data-guide={guide} style={{
      borderRadius: 12, background: 'rgba(7,6,12,0.72)', border: '1px solid rgba(242,190,69,0.3)',
      padding: '6px 10px 6px 6px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div role="group" aria-label={said} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <StepButton label="One round less" onClick={() => onStep?.(-1)} disabled={rounds <= min}><Minus size={18}/></StepButton>
          <span aria-live="polite" style={{ minWidth: 30, textAlign: 'center', font: `700 26px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{rounds}</span>
          <StepButton label="One round more" onClick={() => onStep?.(1)} disabled={rounds >= max}><Plus size={18}/></StepButton>
        </div>
        <span aria-hidden="true" style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>ROUNDS</span>
      </div>
      <span aria-hidden="true" style={{ alignSelf: 'stretch', width: 1, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }}/>
      <div aria-hidden="true" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: `700 16px ${HEAD}`, lineHeight: 1.15, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
          {repsPerRound} × {rounds} = <span style={{ color: GOLD }}>{totalReps}</span> <span style={{ font: `600 12px ${BODY}`, color: MUTED }}>reps</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', font: `500 12px ${BODY}`, lineHeight: 1.25, color: MUTED }}>
          <Timer size={13} color={GOLD} style={{ flexShrink: 0 }}/>
          <span style={{ color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>About {estMinutes} min</span>
          {totalSeconds > 0 && <span style={{ color: VIOLET_TEXT, whiteSpace: 'nowrap' }}>+ {holdWord(totalSeconds)} of holds</span>}
        </span>
        {note && <span style={{ font: `500 11px ${BODY}`, lineHeight: 1.3, color: MUTED }}>{note}</span>}
      </div>
    </div>
  );
}
