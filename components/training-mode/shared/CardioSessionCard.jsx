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
  // Whether ⇄ can reach anything for a given row. A level-1 card can hold
  // every Easy movement there is, and when it did the button sat there
  // looking live and doing nothing. The generator now widens a tier rather
  // than give up, so this is rarely false — but when it is, the control
  // says so instead of pretending.
  canSwapAt = null,
}) {
  if (!session?.moves?.length) return null;
  const last = session.moves.length - 1;
  const canRemove = session.moves.length > 2;

  const iconBtn = (label, disabled) => ({
    width: 24, height: 24, flexShrink: 0, borderRadius: 7,
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
      padding: '7px 10px', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
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
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 0',
          borderBottom: i === last ? 'none' : '1px solid rgba(176,106,255,0.12)',
        }}>
          <span style={{ fontFamily: ARCADE.fontHead, fontSize: 9, fontWeight: 800, color: '#8b83a8', width: 12, flexShrink: 0 }}>{i + 1}</span>
          {/* The caption only earns its line when it says something the name
              does not. "Battle Rope Waves · CONDITIONING" tells you nothing;
              "· BATTLE ROPE" tells you to go and find one. So the category is
              dropped and the line appears only for kit, which on a five-move
              card at 375x667 is the difference between fitting and not. */}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: ARCADE.fontBody, fontSize: 11, color: '#e6d4ff', lineHeight: 1.2 }}>{m.name}</span>
            {m.equipment && m.equipment !== 'Bodyweight' && (
              <span style={{ display: 'block', fontFamily: ARCADE.fontHead, fontSize: 7, color: '#8b7fb0', letterSpacing: '0.1em', marginTop: 1 }}>
                {m.equipment.toUpperCase()}
              </span>
            )}
          </span>
          <button type="button" aria-label={`Move ${m.name} up`} disabled={i === 0} onClick={() => onMoveUp(i)} style={iconBtn('up', i === 0)}>↑</button>
          <button type="button" aria-label={`Move ${m.name} down`} disabled={i === last} onClick={() => onMoveDown(i)} style={iconBtn('down', i === last)}>↓</button>
          <button
            type="button" aria-label={`Swap out ${m.name}`}
            disabled={canSwapAt ? !canSwapAt(i) : false}
            onClick={() => onSwap(i)}
            style={iconBtn('swap', canSwapAt ? !canSwapAt(i) : false)}
          >⇄</button>
          <button type="button" aria-label={`Remove ${m.name}`} disabled={!canRemove} onClick={() => onRemove(i)} style={iconBtn('remove', !canRemove)}>✕</button>
        </div>
      ))}

      <div style={{ fontFamily: ARCADE.fontBody, fontSize: 8.5, color: C.muted, marginTop: 6, lineHeight: 1.3 }}>
        Reorder ↑↓ · swap ⇄ · remove ✕. The coach calls each move as it lands.
      </div>

      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 9,
        paddingTop: 5, marginTop: 5, borderTop: '1px solid rgba(176,106,255,0.18)',
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
