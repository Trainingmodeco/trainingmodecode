import { HOME, head, RETENTION_CSS } from './tokens';

// The week chip (retention feature 1): the week streak, this week's days as
// dots (gold done, green rest, a ring on today), the days done against the
// target, and the freezes held. Sized for Home's header at 360 px, beside the
// level bar and the help button.
//   days: 7 × 'done' | 'rest' | 'today' | 'future'   (Monday first)
//   pop:  the index of a dot that just filled (it pops in)

function Dot({ s, pop }) {
  const base = { width: 5, height: 5, borderRadius: 3, display: 'block', flexShrink: 0, boxSizing: 'border-box' };
  if (s === 'done') return <span style={{ ...base, background: HOME.gold, boxShadow: '0 0 5px rgba(242,190,69,.7)', animation: pop ? 'rt-dot .6s .45s both' : 'none' }}/>;
  if (s === 'today') return <span style={{ ...base, border: `1.2px solid ${HOME.gold}` }}/>;
  if (s === 'rest') return <span style={{ ...base, background: 'rgba(143,232,172,.38)' }}/>;
  return <span style={{ ...base, background: '#2A2545' }}/>;
}

export default function WeekChip({ days = [], done = 0, target = 4, streak = 0, freezes = 0, pop = null, style }) {
  const label = `${streak} week streak. ${done} of ${target} training days this week. ${freezes} ${freezes === 1 ? 'freeze' : 'freezes'}.`;
  return (
    <div role="img" aria-label={label} title={label} className="rt-anim" style={{
      display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 8px', borderRadius: 16,
      background: HOME.chip, color: HOME.gold, flexShrink: 0, boxSizing: 'border-box', ...style,
    }}>
      <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 1, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12, alignSelf: 'center' }}>🔥</span>
        <span style={{ ...head(13), letterSpacing: 0 }}>{streak}</span>
        <span style={{ ...head(7.5, 600, { letterSpacing: '0.04em' }), color: HOME.muted }}>WK</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ display: 'flex', gap: 2 }}>{days.map((s, i) => <Dot key={i} s={s} pop={pop === i && s === 'done'}/>)}</span>
        <span style={{ ...head(7.5, 700, { letterSpacing: '0.04em', lineHeight: 1 }), color: HOME.muted, whiteSpace: 'nowrap' }}>{done}/{target} DAYS</span>
      </span>
      <span style={{ ...head(11, 700, { letterSpacing: 0 }), color: HOME.ice, whiteSpace: 'nowrap' }}>❄{freezes}</span>
    </div>
  );
}
