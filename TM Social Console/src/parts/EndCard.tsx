import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, C, FONT } from '../brand';
import { Backdrop } from './Backdrop';
import { Bell } from './Bell';

export const END_CARD_FRAMES = 105;

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// STAGE CLEAR! with three stars, then the Training Mode sign-off: gold mark,
// name, tagline, the call to action and the app's address.
export const EndCard: React.FC<{ cta: string; url?: string }> = ({ cta, url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame, fps, config: { damping: 9, stiffness: 170 } });
  const flash = interpolate(frame, [0, 7], [0.85, 0], clamp);
  const shake = frame < 14 ? Math.sin(frame * 2.4) * (14 - frame) * 1.8 : 0;
  const clearUp = interpolate(frame, [32, 44], [0, -520], clamp);
  const clearScale = interpolate(frame, [32, 44], [1, 0.55], clamp);
  const logo = spring({ frame: frame - 38, fps, config: { damping: 14 } });
  const ctaIn = spring({ frame: frame - 54, fps, config: { damping: 11, stiffness: 160 } });
  const address = (url ?? brand.appUrl).replace(/^https?:\/\//, '');
  return (
    <Backdrop>
      <Bell ring="triple" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `translateX(${shake}px)` }}>
        <div style={{ transform: `translateY(${clearUp}px) scale(${clearScale})`, textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 900,
              fontSize: 118,
              color: C.gold,
              letterSpacing: '0.02em',
              lineHeight: 1,
              transform: `scale(${2.2 - 1.2 * slam})`,
              opacity: Math.min(1, slam * 2),
              textShadow: `0 0 50px ${C.gold}aa, 0 8px 0 ${C.red}`,
            }}
          >
            STAGE
            <br />
            CLEAR!
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 30 }}>
            {[0, 1, 2].map((i) => {
              const s = spring({ frame: frame - 10 - i * 5, fps, config: { damping: 10 } });
              return (
                <span key={i} style={{ fontSize: 96, color: C.gold, transform: `scale(${s}) rotate(${(1 - s) * 90}deg)`, textShadow: `0 0 30px ${C.gold}` }}>
                  ★
                </span>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 260 }}>
        <div style={{ opacity: logo, transform: `scale(${0.8 + 0.2 * logo})`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Img src={staticFile(brand.logos.mark)} style={{ width: 230, mixBlendMode: 'lighten', filter: `drop-shadow(0 0 40px ${C.gold}88)` }} />
          <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 88, color: C.text, marginTop: 30, letterSpacing: '0.03em' }}>
            TRAINING MODE
          </div>
          <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 40, color: C.gold, letterSpacing: '0.5em', marginTop: 8 }}>
            TRAIN · FIGHT · WIN
          </div>
        </div>
        <div
          style={{
            marginTop: 70,
            opacity: Math.min(1, ctaIn * 1.5),
            transform: `translateY(${(1 - ctaIn) * 60}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 26,
          }}
        >
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 46,
              color: C.bg,
              background: C.gold,
              padding: '22px 46px',
              letterSpacing: '0.04em',
              clipPath: 'polygon(4% 0, 100% 0, 96% 100%, 0 100%)',
              boxShadow: `0 0 50px ${C.gold}77`,
            }}
          >
            {cta.toUpperCase()}
          </div>
          <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 42, color: C.muted, letterSpacing: '0.08em' }}>{address}</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: flash }} />
    </Backdrop>
  );
};
