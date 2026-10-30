import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT } from '../brand';
import { ArtLayer, Backdrop } from '../parts/Backdrop';
import { Bell } from '../parts/Bell';

// "STAGE 3: LEG DAY. FIGHT." Every workout announced like a boss fight.
// Five seconds; use it as the hook in front of footage or on its own.
export type BossIntroProps = {
  stage: string; // "STAGE 3"
  title: string; // "LEG DAY"
  boss: string; // "100 SQUATS"
  callout?: string; // "FIGHT!"
  art?: string | null;
};

export const BOSS_INTRO_FRAMES = 150;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const BossIntro: React.FC<BossIntroProps> = ({ stage, title, boss, callout = 'FIGHT!', art }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stageIn = spring({ frame, fps, config: { damping: 14 } });
  const titleSlam = spring({ frame: frame - 14, fps, config: { damping: 8, stiffness: 200 } });
  const flash = interpolate(frame, [14, 20], [0.8, 0], clamp);
  const shake = frame >= 14 && frame < 30 ? Math.sin(frame * 2.6) * (30 - frame) * 1.6 : 0;
  const hp = interpolate(frame, [50, 95], [0, 1], clamp);
  const bossIn = spring({ frame: frame - 46, fps, config: { damping: 12 } });
  const fight = spring({ frame: frame - 104, fps, config: { damping: 7, stiffness: 220 } });
  const fightShake = frame >= 104 && frame < 122 ? Math.sin(frame * 3.1) * (122 - frame) * 2 : 0;
  return (
    <Backdrop>
      {art ? <ArtLayer src={art} opacity={0.5} /> : null}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, ${C.red}33 0%, transparent 60%)` }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateX(${shake + fightShake}px)`, paddingBottom: 140 }}>
        <div
          style={{
            fontFamily: FONT.body,
            fontWeight: 700,
            fontSize: 64,
            letterSpacing: '0.5em',
            color: C.gold,
            opacity: stageIn,
            transform: `translateY(${(1 - stageIn) * -60}px)`,
            marginBottom: 20,
          }}
        >
          {stage.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 900,
            fontSize: Math.min(170, Math.floor(920 / (title.length * 0.82))),
            color: C.text,
            lineHeight: 1,
            textAlign: 'center',
            transform: `scale(${titleSlam > 0 ? 2.4 - 1.4 * titleSlam : 0})`,
            textShadow: `0 0 60px ${C.violet}, 0 10px 0 ${C.violet}`,
          }}
        >
          {title.toUpperCase()}
        </div>
        <div style={{ marginTop: 70, width: 860, opacity: bossIn, transform: `translateY(${(1 - bossIn) * 50}px)` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontWeight: 700, fontSize: 40, letterSpacing: '0.2em', color: C.red }}>
            <span>BOSS</span>
            <span style={{ color: C.text }}>{boss.toUpperCase()}</span>
          </div>
          <div style={{ marginTop: 10, height: 40, border: `5px solid ${C.gold}`, padding: 4, background: 'rgba(0,0,0,0.6)' }}>
            <div style={{ width: `${hp * 100}%`, height: '100%', background: `linear-gradient(90deg, ${C.red}, #ff7a59)`, boxShadow: `0 0 24px ${C.red}` }} />
          </div>
        </div>
      </AbsoluteFill>
      {frame >= 104 ? (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', background: `rgba(8,0,18,${0.75 * Math.min(1, fight)})` }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 900,
              fontSize: Math.min(200, Math.floor(880 / (callout.length * 0.82))),
              color: C.gold,
              transform: `translateX(${fightShake}px) scale(${3 - 2 * fight}) rotate(-6deg)`,
              textShadow: `0 0 80px ${C.gold}, 0 14px 0 ${C.red}`,
            }}
          >
            {callout.toUpperCase()}
          </div>
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
      <Sequence from={102}>
        <Bell ring="single" volume={0.8} />
      </Sequence>
    </Backdrop>
  );
};
