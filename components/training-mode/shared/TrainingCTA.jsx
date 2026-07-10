import { ARCADE } from '../ArcadeUI';

// Premium "leveled-up" primary CTA per the Training Mode brand guide.
//  - variant="primary": purple→blue gradient, gold corner cuts, white text.
//  - variant="gold": metallic gold fill, dark text, purple glow (premium accent).
// Shared so every setup/workout screen uses the same START treatment.
const CTA_STYLES = `
@keyframes tm-cta-pulse {
  0%, 100% { box-shadow: 0 0 16px rgba(124,58,237,0.42), 0 6px 20px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 28px rgba(79,140,255,0.58), 0 6px 20px rgba(0,0,0,0.35); }
}
@keyframes tm-cta-pulse-gold {
  0%, 100% { box-shadow: 0 0 16px rgba(168,85,247,0.4), 0 4px 16px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 26px rgba(253,224,71,0.5), 0 4px 16px rgba(0,0,0,0.35); }
}
@keyframes tm-cta-pulse-red {
  0%, 100% { box-shadow: 0 0 16px rgba(239,68,68,0.42), 0 6px 20px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 28px rgba(239,68,68,0.62), 0 6px 20px rgba(0,0,0,0.35); }
}
@keyframes tm-cta-pulse-violet {
  0%, 100% { box-shadow: 0 0 16px rgba(176,106,255,0.42), 0 6px 20px rgba(0,0,0,0.35); }
  50% { box-shadow: 0 0 28px rgba(201,166,255,0.62), 0 6px 20px rgba(0,0,0,0.35); }
}
@keyframes tm-cta-shimmer {
  0% { transform: translateX(-160%) skewX(-18deg); }
  60%, 100% { transform: translateX(320%) skewX(-18deg); }
}
.tm-cta-3d { transition: transform .07s ease, box-shadow .07s ease; }
.tm-cta-3d:active { transform: translateY(3px); }
`;

function corner(pos, c) {
  const base = { position: 'absolute', width: 10, height: 10, pointerEvents: 'none' };
  if (pos === 'tl') return { ...base, top: 5, left: 5, borderTop: `2px solid ${c}`, borderLeft: `2px solid ${c}` };
  if (pos === 'tr') return { ...base, top: 5, right: 5, borderTop: `2px solid ${c}`, borderRight: `2px solid ${c}` };
  if (pos === 'bl') return { ...base, bottom: 5, left: 5, borderBottom: `2px solid ${c}`, borderLeft: `2px solid ${c}` };
  return { ...base, bottom: 5, right: 5, borderBottom: `2px solid ${c}`, borderRight: `2px solid ${c}` };
}

const SKINS = {
  gold: {
    border: '1.5px solid rgba(255,238,150,0.9)',
    background: 'linear-gradient(180deg,#ffe574 0%,#f7c33f 55%,#eaa62a 100%)',
    color: '#2a1400', fontSize: 14, textShadow: '0 1px 0 rgba(255,255,255,0.25)',
    pulse: 'tm-cta-pulse-gold', corner: 'rgba(90,45,0,0.55)', shimmer: 'rgba(255,255,255,0.45)',
    lip: '#a9741a', inset: 'rgba(255,255,255,0.55)',
  },
  red: {
    border: '1.5px solid rgba(255,150,150,0.55)',
    background: 'linear-gradient(180deg,#f5544f 0%,#ef4444 55%,#b91c1c 100%)',
    color: '#fff', fontSize: 14, textShadow: '0 1px 4px rgba(0,0,0,0.4)',
    pulse: 'tm-cta-pulse-red', corner: 'rgba(255,220,220,0.6)', shimmer: 'rgba(255,255,255,0.35)',
    lip: '#7f1414', inset: 'rgba(255,255,255,0.3)',
  },
  primary: {
    border: '1.5px solid rgba(253,224,71,0.7)',
    background: 'linear-gradient(180deg,#8b5cf6 0%,#7c3aed 55%,#5b21b6 100%)',
    color: '#fff', fontSize: 15, textShadow: '0 1px 6px rgba(0,0,0,0.45)',
    pulse: 'tm-cta-pulse', corner: 'rgba(253,224,71,0.9)', shimmer: 'rgba(255,255,255,0.28)',
    lip: '#3a1d7a', inset: 'rgba(255,255,255,0.34)',
  },
  // Light violet — used for the PAUSE state of the go/pause toggle.
  violet: {
    border: '1.5px solid rgba(224,196,255,0.75)',
    background: 'linear-gradient(180deg,#d8bcff 0%,#b975ff 55%,#a855f7 100%)',
    color: '#2a0a45', fontSize: 15, textShadow: '0 1px 0 rgba(255,255,255,0.28)',
    pulse: 'tm-cta-pulse-violet', corner: 'rgba(60,20,90,0.5)', shimmer: 'rgba(255,255,255,0.5)',
    lip: '#7c3aed', inset: 'rgba(255,255,255,0.5)',
  },
};

export default function TrainingCTA({ label, onClick, icon = '▶', disabled = false, height = 56, variant = 'primary', depth = false, style }) {
  const sk = SKINS[variant] || SKINS.primary;
  const base = {
    position: 'relative', overflow: 'hidden', width: '100%', height, flexShrink: 0,
    borderRadius: 13, cursor: disabled ? 'default' : 'pointer',
    fontFamily: ARCADE.fontHead, fontWeight: 900, letterSpacing: '0.14em',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  };
  // 2.5D depth: a hard bottom "lip" + inset top highlight so the button reads as
  // a raised physical key; it presses down on :active.
  const depthShadow = `inset 0 2px 0 ${sk.inset}, 0 5px 0 ${sk.lip}, 0 10px 16px rgba(0,0,0,0.45)`;
  const skin = {
    border: sk.border, background: sk.background, color: sk.color, fontSize: sk.fontSize,
    textShadow: sk.textShadow,
    animation: disabled || depth ? 'none' : `${sk.pulse} 2.6s ease-in-out infinite`,
  };
  const cornerColor = sk.corner;
  const shimmerColor = sk.shimmer;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={depth ? 'tm-cta-3d' : undefined}
      style={{ ...base, ...skin, ...(depth ? { boxShadow: depthShadow, marginBottom: 5 } : null), ...style }}
    >
      <style dangerouslySetInnerHTML={{ __html: CTA_STYLES }} />
      <span style={corner('tl', cornerColor)} /><span style={corner('tr', cornerColor)} />
      <span style={corner('bl', cornerColor)} /><span style={corner('br', cornerColor)} />
      {!disabled && (
        <span style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%',
          background: `linear-gradient(90deg,transparent,${shimmerColor},transparent)`,
          animation: 'tm-cta-shimmer 4.2s ease-in-out infinite', pointerEvents: 'none',
        }} />
      )}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 12 }}>{icon}</span>{label}
      </span>
    </button>
  );
}
