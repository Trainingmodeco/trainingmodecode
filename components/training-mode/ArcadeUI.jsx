import { C } from './Styles';

// Shared Training Arcade visual system.
// Black / deep-purple panels, neon-violet HUD borders, metallic-gold headings,
// yellow primary CTAs. Reusable across arcade screens.
export const ARCADE = {
  gold: C.gold,
  goldBright: C.yellow,
  violet: C.neon,
  violetBorder: 'rgba(168,85,247,0.55)',
  violetBorderSoft: 'rgba(168,85,247,0.28)',
  violetBorderStrong: 'rgba(168,85,247,0.8)',
  goldBorder: 'rgba(253,224,71,0.4)',
  goldBorderSoft: 'rgba(253,224,71,0.18)',
  panelBg: 'rgba(12,2,24,0.82)',
  panelBgDeep: 'rgba(8,0,18,0.92)',
  text: C.text,
  muted: C.muted,
  radius: { sm: 8, md: 10, lg: 14, pill: 999 },
  glowViolet: '0 0 22px rgba(168,85,247,0.4)',
  glowGold: '0 0 24px rgba(253,224,71,0.45)',
  fontHead: "'Orbitron',sans-serif",
  fontBody: "'Rajdhani',sans-serif",
  fontPixel: "'Press Start 2P',monospace",
  goldGradient: 'linear-gradient(180deg, #fff6c2 0%, #fde047 38%, #facc15 62%, #a8780a 100%)',
};

const metallicGoldText = {
  background: ARCADE.goldGradient,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  color: 'transparent',
};

export function ArcadeHudPanel({ children, style, glow = 'violet', ...rest }) {
  return (
    <div
      style={{
        background: ARCADE.panelBg,
        border: `1px solid ${ARCADE.violetBorderSoft}`,
        borderRadius: ARCADE.radius.lg,
        boxShadow: glow === 'gold' ? '0 0 24px rgba(253,224,71,0.14)' : '0 0 28px rgba(168,85,247,0.12)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ArcadeSectionLabel({ children, style, ...rest }) {
  return (
    <div
      style={{
        fontFamily: ARCADE.fontHead,
        fontWeight: 700,
        color: ARCADE.gold,
        fontSize: 10,
        letterSpacing: '0.2em',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ArcadePrimaryButton({ children, disabled, style, ...rest }) {
  return (
    <button
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 0',
        borderRadius: ARCADE.radius.lg,
        background: disabled ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${ARCADE.goldBright}, ${ARCADE.gold})`,
        color: disabled ? ARCADE.muted : '#0a0014',
        border: disabled ? '1px solid rgba(255,255,255,0.1)' : 'none',
        fontFamily: ARCADE.fontHead,
        fontWeight: 900,
        fontSize: 14,
        letterSpacing: '0.18em',
        boxShadow: disabled ? 'none' : '0 0 28px rgba(253,224,71,0.5), 0 0 8px rgba(253,224,71,0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ArcadeSecondaryButton({ children, style, ...rest }) {
  return (
    <button
      style={{
        width: '100%',
        padding: '12px 0',
        borderRadius: ARCADE.radius.md,
        background: 'rgba(14,2,28,0.65)',
        border: `1.5px solid ${ARCADE.violetBorder}`,
        color: ARCADE.text,
        fontFamily: ARCADE.fontHead,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.08em',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ArcadeStatusChip({ children, tone = 'gold', style, ...rest }) {
  const tones = {
    gold: { border: ARCADE.goldBorder, bg: 'rgba(253,224,71,0.06)', color: ARCADE.gold },
    violet: { border: ARCADE.violetBorder, bg: 'rgba(168,85,247,0.12)', color: ARCADE.violet },
    muted: { border: 'rgba(255,255,255,0.12)', bg: 'rgba(255,255,255,0.03)', color: ARCADE.muted },
  };
  const t = tones[tone] || tones.gold;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: ARCADE.radius.pill,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.color,
        fontFamily: ARCADE.fontHead,
        fontWeight: 700,
        fontSize: 8,
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

export function ArcadeStageTitle({ label = 'STAGE', number, subtitle, style }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: ARCADE.radius.lg,
        border: `1px solid ${ARCADE.violetBorderStrong}`,
        background: ARCADE.panelBgDeep,
        boxShadow: '0 0 0 1px rgba(168,85,247,0.18) inset, 0 0 26px rgba(168,85,247,0.3)',
        padding: '16px 18px 14px',
        overflow: 'hidden',
        textAlign: 'center',
        ...style,
      }}
    >
      {/* purple energy slash behind the number */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '52%',
          transform: 'translate(-50%, -50%) skewX(-18deg)',
          width: '70%',
          height: 52,
          background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.55), rgba(217,70,239,0.4), transparent)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            fontFamily: ARCADE.fontHead,
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '0.42em',
            marginLeft: '0.42em',
            ...metallicGoldText,
          }}
        >
          {label}
        </div>
        {number != null && (
          <div
            style={{
              fontFamily: ARCADE.fontHead,
              fontWeight: 900,
              fontSize: 46,
              lineHeight: 1,
              margin: '2px 0',
              ...metallicGoldText,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 16px rgba(253,224,71,0.35))',
            }}
          >
            {number}
          </div>
        )}
        {subtitle && (
          <div
            style={{
              fontFamily: ARCADE.fontBody,
              fontSize: 11,
              fontWeight: 600,
              color: ARCADE.text,
              letterSpacing: '0.04em',
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

// stateConfig: locked | current | completed | boss | selected variants merge in.
export function ArcadeStageNode({ state = 'locked', selected = false, label, sublabel, children, onClick, disabled, style, ...rest }) {
  const palette = {
    locked: { border: 'rgba(168,85,247,0.15)', bg: 'rgba(10,0,20,0.7)', text: ARCADE.muted, glow: 'none' },
    current: { border: 'rgba(168,85,247,0.6)', bg: 'rgba(168,85,247,0.08)', text: '#c4b5fd', glow: '0 0 10px rgba(168,85,247,0.35)' },
    completed: { border: 'rgba(253,224,71,0.5)', bg: 'rgba(253,224,71,0.05)', text: ARCADE.gold, glow: '0 0 6px rgba(253,224,71,0.15)' },
    boss: { border: 'rgba(253,224,71,0.55)', bg: 'rgba(253,224,71,0.06)', text: ARCADE.gold, glow: '0 0 10px rgba(253,224,71,0.25)' },
  };
  const p = palette[state] || palette.locked;
  const border = selected ? `2px solid ${ARCADE.goldBright}` : `1.5px solid ${p.border}`;
  const bg = selected ? 'rgba(253,224,71,0.12)' : p.bg;
  const glow = selected ? '0 0 12px rgba(253,224,71,0.3)' : p.glow;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        borderRadius: ARCADE.radius.md,
        border,
        background: bg,
        boxShadow: glow,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: state === 'locked' ? 0.4 : 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 2,
        transition: 'all 0.2s',
        ...style,
      }}
      {...rest}
    >
      {children}
      {sublabel && (
        <span
          style={{
            fontFamily: ARCADE.fontPixel,
            fontSize: 5,
            color: selected ? ARCADE.gold : p.text,
            letterSpacing: '0.05em',
          }}
        >
          {sublabel}
        </span>
      )}
    </button>
  );
}
