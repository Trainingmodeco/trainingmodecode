import { archetypesFor } from '../protocol/content';

// The fighter-style picker for Training Camp.
//
// It used to be three stacked cards, each with a long name ("Slick Counter
// Boxer"), a tagline and a paragraph — the tallest thing on the session
// card. Now it is the same three-way strip as difficulty, with plain names,
// and ONE line under it describing the style that is picked. The line is the
// blurb for the difficulty already chosen, so changing difficulty still
// changes what the style means.
const GOLD = '#fde047';

export default function ArchetypePicker({
  discipline,               // 'boxing' | 'kickboxing' | 'muay_thai' | 'mma'
  difficulty = 'normal',    // drives which variant blurb is shown
  value,                    // selected archetype id
  onChange,
}) {
  const list = archetypesFor(discipline) || [];
  if (!list.length) return null;
  const picked = list.find((a) => a.id === value) || list[0];
  const blurb = picked.variants?.[difficulty] || picked.variants?.normal || picked.tagline;

  return (
    <div>
      <div style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 6 }}>
        FIGHTING STYLE
      </div>
      <div role="radiogroup" aria-label="Fighting style" style={{ display: 'flex', gap: 5 }}>
        {list.map((a) => {
          const on = a.id === picked.id;
          return (
            <button
              key={a.id}
              role="radio"
              aria-checked={on}
              onClick={() => onChange?.(a.id)}
              style={{
                flex: 1, minWidth: 0, padding: '7px 2px', borderRadius: 7, cursor: 'pointer',
                background: on ? 'rgba(253,224,71,0.14)' : 'rgba(8,2,18,0.4)',
                border: `1px solid ${on ? 'rgba(253,224,71,0.55)' : 'rgba(168,85,247,0.25)'}`,
                font: "800 7.5px 'Orbitron',sans-serif", letterSpacing: '0.02em', lineHeight: 1.25,
                color: on ? GOLD : '#c4a4d8',
              }}
            >{a.name.toUpperCase()}</button>
          );
        })}
      </div>
      <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#d7c9ee', marginTop: 6, lineHeight: 1.3, textAlign: 'center' }}>
        {blurb}
      </div>
    </div>
  );
}
