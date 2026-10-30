import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, FONT } from '../brand';

const Corner: React.FC<{ top?: boolean; left?: boolean; color: string }> = ({ top, left, color }) => {
  const arm = 78;
  const t = 7;
  const pos: React.CSSProperties = { position: 'absolute', width: arm, height: arm };
  pos[top ? 'top' : 'bottom'] = 46;
  pos[left ? 'left' : 'right'] = 46;
  return (
    <div style={pos}>
      <div style={{ position: 'absolute', [top ? 'top' : 'bottom']: 0, left: 0, width: arm, height: t, background: color }} />
      <div style={{ position: 'absolute', top: 0, [left ? 'left' : 'right']: 0, width: t, height: arm, background: color }} />
    </div>
  );
};

// Fighting-game HUD over every scene: corner brackets, the section label top
// left, a scene counter top right and the boss HP bar draining as the video
// plays (the workout is the boss). Kept in the top third so TikTok, Reels and
// Shorts buttons never cover it.
export const Hud: React.FC<{ kicker: string; boss: string; counter?: string; progress: number; dark?: boolean }> = ({
  kicker,
  boss,
  counter,
  progress,
  dark,
}) => {
  const ink = dark ? C.bg : C.gold;
  const hp = Math.max(0, 1 - progress);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <Corner top left color={ink} />
      <Corner top color={ink} />
      <Corner left color={ink} />
      <Corner color={ink} />
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 90,
          right: 90,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: FONT.body,
          fontWeight: 700,
          fontSize: 38,
          letterSpacing: '0.3em',
          color: ink,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 18, height: 18, background: dark ? C.bg : C.violet, boxShadow: dark ? 'none' : `0 0 18px ${C.violet}` }} />
          {kicker.toUpperCase()}
        </span>
        {counter ? <span style={{ fontFamily: FONT.display, letterSpacing: '0.12em', fontSize: 32 }}>{counter}</span> : null}
      </div>
      <div style={{ position: 'absolute', top: 214, left: 90, right: 90 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT.body,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '0.24em',
            color: dark ? C.bg : C.muted,
            marginBottom: 8,
          }}
        >
          <span>BOSS · {boss.toUpperCase()}</span>
          <span>HP {Math.ceil(hp * 100)}</span>
        </div>
        <div style={{ height: 26, border: `4px solid ${ink}`, background: dark ? 'rgba(8,0,18,0.25)' : 'rgba(0,0,0,0.55)', padding: 3 }}>
          <div
            style={{
              height: '100%',
              width: `${hp * 100}%`,
              background: `repeating-linear-gradient(90deg, transparent 0 46px, rgba(0,0,0,0.35) 46px 50px), linear-gradient(90deg, ${C.red}, #ff7a59)`,
              boxShadow: `0 0 18px ${C.red}aa`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Gold blade that sweeps across on every cut.
export const Slash: React.FC = () => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 10], [-1500, 1500], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          top: -500,
          left: 240 + x,
          width: 600,
          height: 2900,
          background: C.gold,
          transform: 'rotate(18deg)',
          boxShadow: `0 0 90px ${C.gold}`,
        }}
      />
    </AbsoluteFill>
  );
};
