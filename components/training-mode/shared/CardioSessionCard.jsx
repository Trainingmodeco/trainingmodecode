import { C } from '../Styles';
import { ARCADE } from '../ArcadeUI';

// The generated cardio session, editable the way the Workout Builder's is.
//
// The point of the row controls is that regenerating is the WRONG fix for one
// bad movement. If an athlete has a sore wrist, they want the push-ups gone —
// not a whole new session that might drop the four moves they were happy with.
// So each row can move up, move down, or be swapped for something else, and the
// total retimes itself. SURPRISE ME is there for when they genuinely want to
// start over.
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

export default function CardioSessionCard({
  session, level, onSwap, onMoveUp, onMoveDown, onRemove, onRegenerate,
}) {
  if (!session?.moves?.length) return null;
  const last = session.moves.length - 1;
  const canRemove = session.moves.length > 2;

  const iconBtn = (label, disabled) => ({
    width: 26, height: 26, flexShrink: 0, borderRadius: 7,
    border: `1px solid ${disabled ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.4)'}`,
    background: disabled ? 'transparent' : 'rgba(124,58,237,0.16)',
    color: disabled ? '#4b4466' : '#d6c2ff',
    fontSize: 12, fontWeight: 900, cursor: disabled ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
    WebkitTapHighlightColor: 'transparent',
    'aria-label': label,
  });

  return (
    <div style={{
      borderRadius: ARCADE.radius.md,
      border: '1px solid rgba(253,224,71,0.35)',
      background: 'linear-gradient(180deg, rgba(88,28,135,0.32), rgba(16,4,30,0.85))',
      padding: '11px 12px', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: ARCADE.gold }}>
          ★ BUILT FOR YOU · LEVEL {level}
        </span>
        <button
          type="button" onClick={onRegenerate}
          style={{
            padding: '4px 11px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(176,106,255,0.6)',
            color: '#e6d4ff', fontFamily: ARCADE.fontHead, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em',
          }}
        >⟳ SURPRISE ME</button>
      </div>

      {session.moves.map((m, i) => (
        <div key={`${m.id}-${i}`} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '6px 0',
          borderBottom: i === last ? 'none' : '1px solid rgba(176,106,255,0.12)',
        }}>
          <span style={{ fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 800, color: '#8b83a8', width: 12, flexShrink: 0 }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: ARCADE.fontBody, fontSize: 11.5, color: '#e6d4ff', lineHeight: 1.25 }}>{m.name}</span>
            <span style={{ display: 'block', fontFamily: ARCADE.fontHead, fontSize: 7, color: '#6f6790', letterSpacing: '0.1em', marginTop: 2 }}>
              {String(m.category || '').toUpperCase()}{m.equipment && m.equipment !== 'Bodyweight' ? ` · ${m.equipment.toUpperCase()}` : ''}
            </span>
          </span>
          <button type="button" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => onMoveUp(i)} style={iconBtn('up', i === 0)}>↑</button>
          <button type="button" aria-label={`Move ${m.name} down`} disabled={i === last} onClick={() => onMoveDown(i)} style={iconBtn('down', i === last)}>↓</button>
          <button type="button" aria-label={`Swap out ${m.name}`} onClick={() => onSwap(i)} style={iconBtn('swap', false)}>⇄</button>
          <button type="button" aria-label={`Remove ${m.name}`} disabled={!canRemove} onClick={() => onRemove(i)} style={iconBtn('remove', !canRemove)}>✕</button>
        </div>
      ))}

      <div style={{ fontFamily: ARCADE.fontBody, fontSize: 9, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>
        Reorder with ↑↓, swap one out with ⇄. The coach calls each movement as it comes up.
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 9,
        paddingTop: 9, marginTop: 8, borderTop: '1px solid rgba(176,106,255,0.18)',
      }}>
        <span style={{ fontFamily: ARCADE.fontHead, fontSize: 8, fontWeight: 800, letterSpacing: '0.11em', color: '#b06aff' }}>
          {session.moves.length} MOVES · {session.rounds} ROUNDS · {session.workSec}s / {session.restSec}s
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: ARCADE.fontHead, fontSize: 17, fontWeight: 900, color: ARCADE.gold }}>
          {fmt(session.totalSec)}
        </span>
      </div>
    </div>
  );
}
