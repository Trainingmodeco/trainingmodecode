import { archetypesFor } from '../protocol/content';

// Item 14 — the archetype picker for Training Camp.
//
// 12 archetypes have lived in protocol/data/archetypes.json since Phase 2 and
// TrainingCampMap just took [0]. This is the picker that TODO asked for.
//
// It sits AFTER difficulty on purpose: every archetype carries an easy/normal/
// hard blurb, and the blurb is the whole point of the choice. Showing
// "Ring-cutting, body jab, body-head combinations" when the athlete has already
// picked normal is a real decision; showing a generic tagline is not. Change
// difficulty and every card re-reads — the component is pure, so that happens
// for free.
const GOLD = '#fde047';

export default function ArchetypePicker({
  discipline,               // 'boxing' | 'kickboxing' | 'muay_thai' | 'mma'
  difficulty = 'normal',    // drives which variant blurb each card shows
  value,                    // selected archetype id
  onChange,
  compact = false,
}) {
  const list = archetypesFor(discipline) || [];
  if (!list.length) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em' }}>
          FIGHTER ARCHETYPE
        </span>
        <span style={{ font: "600 7px 'Rajdhani',sans-serif", color: '#8b83a8' }}>
          {String(difficulty).toUpperCase()} PLAN
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {list.map((a) => {
          const on = a.id === value;
          // The blurb for the difficulty already chosen — never a placeholder,
          // never the normal text standing in for hard.
          const blurb = a.variants?.[difficulty] || a.variants?.normal || a.tagline;
          return (
            <button
              key={a.id}
              onClick={() => onChange?.(a.id)}
              aria-pressed={on}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer',
                padding: compact ? '6px 9px' : '8px 10px', borderRadius: 8,
                background: on ? 'rgba(253,224,71,0.10)' : 'rgba(8,2,18,0.45)',
                border: `1px solid ${on ? 'rgba(253,224,71,0.6)' : 'rgba(168,85,247,0.25)'}`,
                boxShadow: on ? '0 0 14px rgba(253,224,71,0.18)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{
                  font: "800 9px 'Orbitron',sans-serif", color: on ? GOLD : '#fff',
                  letterSpacing: '0.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{a.name.toUpperCase()}</span>
                <span style={{
                  flexShrink: 0, font: "600 7px 'Rajdhani',sans-serif", color: on ? '#e6d48a' : '#9a90b8',
                }}>{a.tagline}</span>
              </div>
              <div style={{
                font: "600 8.5px 'Rajdhani',sans-serif", color: on ? '#e8dcff' : '#b9a9d8',
                marginTop: 2, lineHeight: 1.3,
              }}>{blurb}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
