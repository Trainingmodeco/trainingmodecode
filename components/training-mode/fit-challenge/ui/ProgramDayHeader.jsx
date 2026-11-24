import { HEAD, BODY, MUTED, GOLD } from '../../shared/FitSetupKit';

// A program day on the WORKOUT CARD: where the day sits in its split, in
// ProgramsScreen's words and pips ("Day 2 of 3"). Programs rotate days and
// have no weeks (ProgramsScreen's header says so), so there is no week here.
export default function ProgramDayHeader({ program, dayIndex, days }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ minWidth: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase' }}>{program}</span>
        <span style={{ flexShrink: 0, font: `500 12px ${BODY}`, color: MUTED }}>Day {dayIndex + 1} of {days.length}</span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', gap: 4 }}>
        {days.map((d, i) => (
          <span key={d} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ height: 5, borderRadius: 3, background: i <= dayIndex ? GOLD : 'rgba(255,255,255,0.12)' }}/>
            <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.12em', color: i === dayIndex ? GOLD : MUTED, textAlign: 'center' }}>{d}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
