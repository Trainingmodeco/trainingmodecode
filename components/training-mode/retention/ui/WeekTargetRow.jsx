import { C } from '../../Styles';
import { WEEK_TARGETS, MAX_FREEZES, WEEKS_PER_FREEZE } from '../../data/weekStreak';

// The weekly target, in Profile's Game Plan card (retention feature 1): its
// "Days per week" row, offering 2 to 6 training days, with what a change does
// (it starts next Monday) and the freezes held. One setting: the same number
// Today's Bout plans with.
//   value:   the target chosen (it holds from next Monday)
//   current: the target this week is judged by
const TEAL = '#2dd4bf';

export default function WeekTargetRow({ value, current, onPick, freezes = 0, nextFreezeIn = null }) {
  const pending = value !== current;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return (
    <div data-retention="week-target" style={{ background: 'rgba(10,0,20,0.6)', borderRadius: 8, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: C.muted, display: 'block' }}>Days per week</span>
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 11, color: C.faint, display: 'block', marginBottom: 6, lineHeight: 1.3 }}>
        Training days a week. Keeps your streak; rest days never break it.
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        {WEEK_TARGETS.map((n) => (
          <button key={n} type="button" aria-pressed={value === n} onClick={() => onPick?.(n)} style={{
            flex: 1, minWidth: 0, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 11,
            background: value === n ? TEAL : 'rgba(255,255,255,0.06)',
            color: value === n ? '#041210' : C.muted,
          }}>{n}</button>
        ))}
      </div>
      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10.5, color: pending ? '#fde047' : C.faint, marginTop: 6, lineHeight: 1.3 }}>
        {pending ? `${value} days from Monday. This week stays at ${current}.` : `${value} days a week${value === 4 ? ' · recommended' : ''}.`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '0.12em', color: '#9ad8ff', whiteSpace: 'nowrap' }}>❄ FREEZES {freezes}/{MAX_FREEZES}</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 10.5, color: C.faint, lineHeight: 1.3 }}>
          {nextFreezeIn == null ? 'You hold the most there is.' : `Next one after ${plural(nextFreezeIn, 'more week')} on target.`}
        </span>
      </div>
      {nextFreezeIn != null && (
        <div aria-hidden style={{ display: 'flex', gap: 3, marginTop: 5 }}>
          {Array.from({ length: WEEKS_PER_FREEZE }, (_, i) => (
            <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < WEEKS_PER_FREEZE - nextFreezeIn ? '#9ad8ff' : 'rgba(255,255,255,0.08)' }}/>
          ))}
        </div>
      )}
    </div>
  );
}
