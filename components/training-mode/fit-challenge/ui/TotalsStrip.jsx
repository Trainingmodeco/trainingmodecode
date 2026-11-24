import { Timer } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';
import { holdWord } from '../../data/challengeTotals';

// The live totals under ROUNDS, as the sum it is:
//
//     99      ×    4      =    396
//   A ROUND       ROUNDS      TOTAL REPS
//   ─────────────────────────────────────
//   About 27 min · 1 min rest between rounds
//
// totals: challengeTotals(). A timed move is counted in seconds, never in
// reps: its seconds ride under the reps ("+ 30s hold"). Nothing here is
// clipped: a label that runs long wraps under its number.
function Cell({ value, label, plus, gold }) {
  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
      <span style={{ font: `700 24px ${HEAD}`, lineHeight: 1, color: gold ? GOLD : '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.12em', lineHeight: 1.25, color: MUTED, textTransform: 'uppercase' }}>{label}</span>
      {plus && <span style={{ font: `600 11px ${BODY}`, lineHeight: 1.2, color: VIOLET_TEXT }}>{plus}</span>}
    </div>
  );
}

const Op = ({ children }) => <span aria-hidden="true" style={{ font: `600 16px ${HEAD}`, color: '#7D7799', paddingTop: 3 }}>{children}</span>;

export default function TotalsStrip({ totals, guide }) {
  const { repsPerRound, secondsPerRound, rounds, totalReps, totalSeconds, estMinutes, restSeconds } = totals;
  const restWord = restSeconds >= 60 && restSeconds % 60 === 0 ? `${restSeconds / 60} min` : `${restSeconds}s`;
  const said = `${repsPerRound} reps a round${secondsPerRound ? ` and ${secondsPerRound} seconds of holds` : ''}, ${rounds} rounds, ${totalReps} reps in all, about ${estMinutes} minutes.`;
  return (
    <div data-guide={guide} role="group" aria-label={said} style={{
      borderRadius: 12, background: 'rgba(7,6,12,0.72)', border: '1px solid rgba(242,190,69,0.3)',
      padding: '10px 8px 8px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'start', gap: 4 }}>
        <Cell value={repsPerRound} label="A round" plus={secondsPerRound ? `+ ${holdWord(secondsPerRound)} of holds` : null}/>
        <Op>×</Op>
        <Cell value={rounds} label="Rounds"/>
        <Op>=</Op>
        <Cell value={totalReps} label="Total reps" plus={totalSeconds ? `+ ${holdWord(totalSeconds)} of holds` : null} gold/>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.08)', font: `500 12px ${BODY}`, color: MUTED, textAlign: 'center' }}>
        <Timer size={14} color={GOLD} style={{ flexShrink: 0 }}/>
        <span><span style={{ color: '#fff', fontWeight: 600 }}>About {estMinutes} min</span> · {restWord} rest between rounds</span>
      </div>
    </div>
  );
}
