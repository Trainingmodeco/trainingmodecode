import { useState } from 'react';
import { loadProfile, saveProfile } from '../data/userProfile';

// The Simplify revamp's discipline selector, shared by Fight Mode, Practice
// Mode and Combat Conditioning.
//
// It replaces three different pickers that all meant the same thing: the
// four-across character tiles on the Fight hub, the chip row on Combat
// Conditioning, and Practice Mode's own list. One control, one piece of state,
// so switching to Muay Thai on any screen is switching to Muay Thai on all of
// them.
//
// The shape is a parallelogram with only its LEFT edge slanted, so the row
// reads as a stack of overlapping cards leaning into the next one rather than
// as four separate skewed buttons. The outline is drawn as three SVG lines
// (diagonal, top, right) instead of a CSS border because a border follows the
// element box and would cut straight down the left edge, outside the clip.
const SLANT = 16;

export const DISCIPLINES = [
  { id: 'Boxing', key: 'boxing', label: 'BOXING' },
  { id: 'Kickboxing', key: 'kickboxing', label: 'KICKBOXING' },
  { id: 'Muay Thai', key: 'muay_thai', label: 'MUAY THAI' },
  { id: 'MMA', key: 'mma', label: 'MMA' },
];

// Each discipline wears its own colours, so the selected tab says WHICH
// discipline at a glance instead of only that one is selected. Boxing is red
// and white, Kickboxing blue and gold, Muay Thai gold and black, MMA black and
// white. Unselected tabs stay muted but keep a faint edge in their colour.
const THEMES = {
  Boxing: {
    bg: 'linear-gradient(180deg,#8E1420 0%,#4A0A12 60%,#2A060B 100%)',
    line: '#FF8A8A', rgb: '255,90,90', color: '#FFFFFF',
    bar: 'linear-gradient(90deg,#E0283A,#FFFFFF 50%,#E0283A)',
  },
  Kickboxing: {
    bg: 'linear-gradient(180deg,#16307A 0%,#0C1838 60%,#081026 100%)',
    line: '#F2BE45', rgb: '61,123,255', color: '#FFFFFF',
    bar: 'linear-gradient(90deg,#2458E0,#F2BE45 50%,#2458E0)',
  },
  'Muay Thai': {
    bg: 'linear-gradient(180deg,#3A2A08 0%,#15100A 60%,#0A0806 100%)',
    line: '#F2BE45', rgb: '242,190,69', color: '#F2BE45',
    bar: 'linear-gradient(90deg,#0A0806,#F2BE45 50%,#0A0806)',
  },
  MMA: {
    bg: 'linear-gradient(180deg,#26262B 0%,#101014 60%,#060608 100%)',
    line: '#FFFFFF', rgb: '255,255,255', color: '#FFFFFF',
    bar: 'linear-gradient(90deg,#3A3A40,#FFFFFF 50%,#3A3A40)',
  },
};

function themeFor(id, on) {
  const t = THEMES[id] || THEMES.Kickboxing;
  if (on) {
    return {
      bg: t.bg, line: t.line, color: t.color, bar: t.bar,
      glow: `drop-shadow(0 0 5px rgba(${t.rgb},.7))`,
      barGlow: `0 0 8px rgba(${t.rgb},.9)`,
    };
  }
  return {
    bg: 'rgba(14,16,36,.55)',
    line: `rgba(${t.rgb},.24)`,
    glow: 'none',
    color: '#6F7699',
    bar: 'transparent',
    barGlow: 'none',
  };
}

export const disciplineTabsCSS = `
.dt-tab { transition: color .18s ease, filter .18s ease; }
.dt-tab:hover:not([aria-selected="true"]), .dt-tab:focus-visible:not([aria-selected="true"]) { color: #FFFFFF; }
.dt-tab:focus-visible { outline: 2px solid #F2BE45; outline-offset: -2px; }
.dt-tab:active { filter: brightness(1.15); }
`;

// The selected discipline lives on the profile, which is what every downstream
// feature already reads. The hook exists so callers cannot drift into keeping
// their own copy and writing it back in a slightly different shape.
export function useDiscipline() {
  const [disc, setDisc] = useState(() => loadProfile()?.discipline || 'Boxing');
  const pick = (id) => {
    setDisc(id);
    try { saveProfile({ ...loadProfile(), discipline: id }); } catch { /* storage is best-effort */ }
  };
  return [disc, pick];
}

export default function DisciplineTabs({ value, onChange, style, guide }) {
  return (
    <>
      <style>{disciplineTabsCSS}</style>
      <div
        role="tablist" aria-label="Discipline" data-guide={guide}
        style={{
          display: 'flex', gap: 3, height: 40, flexShrink: 0,
          borderBottom: `1px solid rgba(${(THEMES[value] || THEMES.Kickboxing).rgb},.3)`,
          ...style,
        }}
      >
        {DISCIPLINES.map((d) => {
          const on = d.id === value;
          const t = themeFor(d.id, on);
          return (
            <button
              key={d.id} className="dt-tab" type="button"
              role="tab" aria-selected={on ? 'true' : 'false'}
              onClick={() => onChange(d.id)}
              style={{
                position: 'relative', flex: 1, border: 0, padding: `0 0 0 ${SLANT - 6}px`,
                background: 'transparent', color: t.color, cursor: 'pointer',
                fontFamily: "'Chakra Petch', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{
                position: 'absolute', inset: 0,
                clipPath: `polygon(${SLANT}px 0, 100% 0, 100% 100%, 0 100%)`,
                background: t.bg,
              }}/>
              {/* Half a pixel of inset on the top edge: a 1.5px stroke centred
                  on y=0 would lose its upper half to the clip. */}
              <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', filter: t.glow }}>
                <line x1="0" y1="100%" x2={SLANT} y2="0.75" stroke={t.line} strokeWidth="1.5"/>
                <line x1={SLANT} y1="0.75" x2="100%" y2="0.75" stroke={t.line} strokeWidth="1.5"/>
                <line x1="100%" y1="0" x2="100%" y2="100%" stroke={t.line} strokeWidth="1.5"/>
              </svg>
              <span style={{ position: 'relative' }}>{d.label}</span>
              <span style={{
                position: 'absolute', left: '30%', right: '18%', bottom: 5, height: 2,
                borderRadius: 2, background: t.bar, boxShadow: t.barGlow,
              }}/>
            </button>
          );
        })}
      </div>
    </>
  );
}
