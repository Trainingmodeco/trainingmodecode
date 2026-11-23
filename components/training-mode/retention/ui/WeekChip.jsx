import { HOME, head, RETENTION_CSS } from './tokens';
import OneUpMark from './OneUpMark';
import { MAX_FREEZES } from '../../data/weekStreak';

// The week chip (retention feature 1): the week streak, this week's days as
// dots (gold done, green rest, a ring on today, a grey dot for a day still to
// come), the days done against the target, and the 1UPs held (the spare
// lives once called freezes: `freezes` is their count). Sized for Home's
// header at 360 px, beside the level bar and the help button.
//   days:  7 × 'done' | 'rest' | 'today' | 'future'   (Monday first)
//   pop:   the index of a dot that just filled (it pops in)
//   count: false leaves out the "3/4 DAYS" caption under the dots (the end
//          screen's strip says the same in its title)

const DOT = 6;
function Dot({ s, pop }) {
  const base = { width: DOT, height: DOT, borderRadius: DOT / 2, display: 'block', flexShrink: 0, boxSizing: 'border-box' };
  if (s === 'done') return <span style={{ ...base, background: HOME.gold, boxShadow: '0 0 5px rgba(242,190,69,.7)', animation: pop ? 'rt-dot .6s .45s both' : 'none' }}/>;
  if (s === 'today') return <span style={{ ...base, border: `1.5px solid ${HOME.gold}` }}/>;
  if (s === 'rest') return <span style={{ ...base, background: 'rgba(143,232,172,.55)' }}/>;
  return <span style={{ ...base, background: 'rgba(169,163,196,.34)' }}/>;
}

export default function WeekChip({ days = [], done = 0, target = 4, streak = 0, freezes = 0, pop = null, count = true, style }) {
  const label = `${streak} week streak. ${done} of ${target} training days this week. 1UPs: ${freezes} of ${MAX_FREEZES}.`;
  return (
    <div role="img" aria-label={label} title={label} className="rt-anim" style={{
      display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 7px', borderRadius: 16,
      background: HOME.chip, color: HOME.gold, flexShrink: 0, boxSizing: 'border-box', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12, alignSelf: 'center' }}>🔥</span>
        <span style={{ ...head(13), letterSpacing: 0 }}>{streak}</span>
        <span style={{ ...head(8, 600, { letterSpacing: '0.04em' }), color: HOME.muted }}>WK</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <span style={{ display: 'flex', gap: 3 }}>{days.map((s, i) => <Dot key={i} s={s} pop={pop === i && s === 'done'}/>)}</span>
        {count && <span style={{ ...head(8, 700, { letterSpacing: '0.04em', lineHeight: 1 }), color: HOME.muted, whiteSpace: 'nowrap' }}>{done}/{target} DAYS</span>}
      </span>
      <OneUpMark stacked count={freezes}/>
    </div>
  );
}
