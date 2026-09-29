import { ChevronLeft } from 'lucide-react';

// The Simplify revamp's Fight Timer look — shared by Just Train, Fight Focus
// and Combo Coach setup so the three read as one tool with three settings,
// not three different screens.
//
// This is a reskin only. Nothing here changes what a session does: each setup
// still builds the same config and hands it to the same runner.
//
// Royal blue is the Fight side's colour; gold is reserved for what matters
// most on the screen (HARD and above, TOTAL, START) so it keeps meaning.

export const fightTimerCSS = `
.ftk-hit { transition: border-color .18s ease, color .18s ease, box-shadow .18s ease, filter .18s ease; }
.ftk-hit:hover, .ftk-hit:focus-visible { border-color: #F2BE45 !important; }
.ftk-tog:hover, .ftk-tog:focus-visible { color: #F2BE45 !important; }
.ftk-help:hover, .ftk-help:focus-visible { color: #F2BE45 !important; }
.ftk-back:hover, .ftk-back:focus-visible { color: #F2BE45 !important; }
.ftk-hit:active, .ftk-tog:active { transform: scale(0.97); }
`;

// Full-bleed background: a blue glow falling from the top edge.
export function FightBackdrop() {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      background: 'radial-gradient(120% 55% at 50% 0%, #0C1A44 0%, #07060C 62%)',
    }}/>
  );
}

// Back · title over subtitle · round "?" button. No banner — the design drops
// it so every setting fits on one screen above the tab bar.
export function FightHeader({ title, sub, onBack, onHelp, helpGuide }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, flexShrink: 0 }}>
      <button type="button" className="ftk-back" aria-label="Back to Fight Mode" onClick={onBack} style={{
        width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer',
      }}><ChevronLeft size={22}/></button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ font: "700 22px 'Chakra Petch',sans-serif", letterSpacing: '0.06em', lineHeight: 1, color: '#fff' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#A9B4D6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
      </div>
      {onHelp && (
        <button type="button" className="ftk-help ftk-hit" aria-label="How it works" data-guide={helpGuide} onClick={onHelp} style={{
          width: 40, height: 40, borderRadius: '50%', background: 'rgba(61,123,255,0.14)',
          border: '1px solid rgba(61,123,255,0.55)', color: '#8FB4FF', cursor: 'pointer',
          font: "700 17px 'Chakra Petch',sans-serif", flexShrink: 0,
        }}>?</button>
      )}
    </header>
  );
}

export function FightLabel({ children }) {
  return <div style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: '#A9B4D6' }}>{children}</div>;
}

// Difficulty steps up in colour as well as in name: soft blue, royal blue,
// gold with a bolt, then the brightest gold with a blue halo. The eye reads
// how hard a session is before the word.
const DIFF_OFF = { bg: '#0B0F22', border: 'rgba(143,180,255,0.2)', color: '#A9B4D6', shadow: 'none', bolt: false };
const DIFF_ON = {
  Easy: { bg: 'rgba(143,180,255,0.16)', border: '#8FB4FF', color: '#E3ECFF', shadow: '0 0 12px rgba(143,180,255,0.35)', bolt: false, word: '#8FB4FF' },
  Normal: { bg: 'linear-gradient(180deg,#4F8BFF,#2458E0)', border: '#6E9BFF', color: '#FFFFFF', shadow: '0 0 16px rgba(61,123,255,0.6)', bolt: false, word: '#6E9BFF' },
  Hard: { bg: 'linear-gradient(180deg,#FFE9A8,#F2BE45 55%,#C98A1C)', border: '#FFE9A8', color: '#1A1204', shadow: '0 0 18px rgba(242,190,69,0.7), 0 0 36px rgba(242,190,69,0.3)', bolt: true, word: '#F2BE45' },
  Advanced: { bg: 'linear-gradient(180deg,#FFF6D2,#F2BE45 45%,#B8740F)', border: '#FFFFFF', color: '#1A1204', shadow: '0 0 22px rgba(242,190,69,0.9), 0 0 44px rgba(61,123,255,0.55)', bolt: true, word: '#FDE047' },
};

const Bolt = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 14, height: 14, fill: 'currentColor' }}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>
);

export function FightDifficulty({ levels, value, onChange, desc, guide }) {
  const word = (DIFF_ON[value] || DIFF_ON.Normal).word;
  return (
    <div data-guide={guide} style={{ display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0 }}>
      <FightLabel>DIFFICULTY</FightLabel>
      <div role="radiogroup" aria-label="Difficulty" style={{ display: 'flex', gap: 6 }}>
        {levels.map(l => {
          const on = l === value;
          const s = on ? DIFF_ON[l] : DIFF_OFF;
          return (
            <button key={l} type="button" role="radio" aria-checked={on} className="ftk-hit" onClick={() => onChange(l)} style={{
              flex: 1, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              borderRadius: 10, background: s.bg, border: `1px solid ${s.border}`, color: s.color, boxShadow: s.shadow,
              font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', cursor: 'pointer', minWidth: 0,
            }}>{s.bolt && <Bolt/>}{l.toUpperCase()}</button>
          );
        })}
      </div>
      {desc && (
        <div style={{ fontSize: 13, color: '#CFD8F0', lineHeight: 1.35 }}>
          <span style={{ font: "700 13px 'Chakra Petch',sans-serif", color: word }}>{value.toUpperCase()}:</span> {desc}
        </div>
      )}
    </div>
  );
}

// A two-option blue segmented control (Combo Coach's CALL STYLE and MODE).
export function FightToggle({ label, options, value, onChange, format = (o) => o, guide }) {
  return (
    <div data-guide={guide} style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
      <FightLabel>{label}</FightLabel>
      <div role="radiogroup" aria-label={label} style={{
        display: 'flex', padding: 3, gap: 3, borderRadius: 10,
        background: '#0B0F22', border: '1px solid rgba(143,180,255,0.18)',
      }}>
        {options.map(o => {
          const on = o === value;
          return (
            <button key={o} type="button" role="radio" aria-checked={on} className="ftk-tog" onClick={() => onChange(o)} style={{
              flex: 1, height: 36, borderRadius: 7, border: 0, cursor: 'pointer', minWidth: 0,
              background: on ? 'rgba(61,123,255,0.28)' : 'transparent', color: on ? '#FFFFFF' : '#8E98BC',
              boxShadow: on ? 'inset 0 0 0 1px #3D7BFF' : 'none',
              font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.1em',
            }}>{format(o).toUpperCase()}</button>
          );
        })}
      </div>
    </div>
  );
}
