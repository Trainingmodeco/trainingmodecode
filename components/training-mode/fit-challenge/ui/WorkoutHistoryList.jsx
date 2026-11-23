import { ChevronRight } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, CARD, CARD_BORDER } from '../../shared/FitSetupKit';
import { mmss } from '../../data/challengeTotals';

// YOUR WORKOUTS: past workouts, newest first, one row each: the date, the
// name, rounds and reps, and on the right its time over how much of it was
// done. A row opens that workout on the card to do again. (A hold's seconds
// stay on the card and the results; here they would crowd the line.)
//
// rows: [{ id, dow, day, mon, name, rounds, roundsOf, reps, elapsedSec, pct }]
function Row({ r, onOpen }) {
  const full = r.pct >= 100;
  const roundsWord = r.rounds === r.roundsOf ? `${r.rounds} rounds` : `${r.rounds} of ${r.roundsOf} rounds`;
  const work = `${r.reps} reps`;
  return (
    <li style={{ listStyle: 'none' }}>
      <button type="button" className="fk-row" onClick={() => onOpen?.(r)} aria-label={`${r.name}, ${r.dow} ${r.day} ${r.mon}: ${roundsWord}, ${work}, ${mmss(r.elapsedSec)}, ${r.pct}%`} style={{
        width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', boxSizing: 'border-box',
        borderRadius: 12, background: CARD, border: `1px solid ${CARD_BORDER}`, textAlign: 'left', cursor: 'pointer',
      }}>
        <span aria-hidden="true" style={{ width: 40, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.14em', color: MUTED }}>{r.dow}</span>
          <span style={{ font: `700 20px ${HEAD}`, lineHeight: 1, color: '#fff' }}>{r.day}</span>
          <span style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.14em', color: MUTED }}>{r.mon}</span>
        </span>
        <span aria-hidden="true" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.08em', lineHeight: 1.25, color: '#fff' }}>{r.name}</span>
          <span style={{ font: `500 12px ${BODY}`, lineHeight: 1.3, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>{roundsWord} · {work}</span>
        </span>
        <span aria-hidden="true" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ font: `600 13px ${HEAD}`, color: '#fff' }}>{mmss(r.elapsedSec)}</span>
          <span style={{ font: `700 11px ${HEAD}`, letterSpacing: '0.06em', color: full ? GOLD : MUTED }}>{r.pct}%</span>
        </span>
        <ChevronRight size={16} color="#7D7799" style={{ flexShrink: 0 }}/>
      </button>
    </li>
  );
}

export default function WorkoutHistoryList({ rows = [], onOpen, empty = 'Your finished workouts land here.' }) {
  if (!rows.length) return <div style={{ font: `500 13px ${BODY}`, color: MUTED, padding: '8px 2px' }}>{empty}</div>;
  return (
    <ol data-look="history" aria-label="Your workouts" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((r) => <Row key={r.id} r={r} onOpen={onOpen}/>)}
    </ol>
  );
}
