import { AbsoluteFill, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../brand';

export type Tone = 'dark' | 'gold';

// The arcade stage every scene stands on: violet glow, a perspective grid
// floor that scrolls toward the viewer, scanlines and a vignette. `gold` is
// the inverse used for punch beats.
export const Backdrop: React.FC<{ tone?: Tone; children?: React.ReactNode }> = ({ tone = 'dark', children }) => {
  const frame = useCurrentFrame();
  const gold = tone === 'gold';
  const line = gold ? 'rgba(8,0,18,0.16)' : `${C.violet}50`;
  const glowY = 28 + Math.sin(frame / 40) * 4;
  return (
    <AbsoluteFill style={{ background: gold ? C.gold : C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: gold
            ? 'radial-gradient(circle at 50% 30%, #fffbe0 0%, rgba(253,224,71,0) 62%)'
            : `radial-gradient(circle at 50% ${glowY}%, ${C.violet}60 0%, ${C.panel}b0 34%, ${C.bg} 72%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -600,
          right: -600,
          bottom: -240,
          height: 1150,
          transform: 'perspective(700px) rotateX(62deg)',
          transformOrigin: '50% 100%',
          backgroundImage: `linear-gradient(${line} 3px, transparent 3px), linear-gradient(90deg, ${line} 3px, transparent 3px)`,
          backgroundSize: '120px 120px',
          backgroundPosition: `0 ${(frame * 3) % 120}px`,
          maskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
          WebkitMaskImage: 'linear-gradient(to top, black 10%, transparent 85%)',
        }}
      />
      {children}
      <AbsoluteFill
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 2px, transparent 2px 6px)',
          opacity: gold ? 0.25 : 0.55,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)' }} />
    </AbsoluteFill>
  );
};

// App art behind a scene: slow push-in, darkened top and bottom so text and
// the platform's own buttons stay readable.
export const ArtLayer: React.FC<{ src: string; opacity?: number }> = ({ src, opacity = 0.6 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1.06, 1.16]);
  return (
    <AbsoluteFill>
      <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, opacity }} />
      <AbsoluteFill
        style={{ background: `linear-gradient(180deg, ${C.bg}e6 0%, ${C.bg}40 30%, ${C.bg}66 62%, ${C.bg}f2 100%)` }}
      />
    </AbsoluteFill>
  );
};

// The owner's footage behind a scene: muted and toned into the brand so text
// stays readable. `duotone` (B-roll under words): greyscale, violet, gold on
// gold beats. `light` (footage as the star, e.g. Fight Focus rounds): colour
// kept, a violet wash, dark top and bottom for the HUD and platform buttons.
// focusX: where to centre a landscape clip in the vertical crop (0 = left, 100 = right).
export type Broll = { src: string; start: number; rate?: number; focusX?: number };

export const FootageLayer: React.FC<Broll & { tone?: Tone; grade?: 'duotone' | 'light' }> = ({
  src,
  start,
  rate = 0.75,
  focusX = 50,
  tone = 'dark',
  grade = 'duotone',
}) => {
  const { fps } = useVideoConfig();
  const gold = tone === 'gold';
  const light = grade === 'light';
  return (
    <AbsoluteFill>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        trimBefore={Math.round(start * fps)}
        playbackRate={rate}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${focusX}% 50%`,
          filter: light ? 'saturate(0.75) contrast(1.12) brightness(0.97)' : 'grayscale(1) contrast(1.25) brightness(1.05)',
          transform: 'scale(1.04)',
        }}
      />
      {light ? (
        <>
          <AbsoluteFill style={{ background: C.violet, mixBlendMode: 'multiply', opacity: 0.35 }} />
          <AbsoluteFill
            style={{ background: `linear-gradient(180deg, ${C.bg}d9 0%, ${C.bg}00 30%, ${C.bg}00 68%, ${C.bg}c0 100%)` }}
          />
        </>
      ) : gold ? (
        <>
          <AbsoluteFill style={{ background: C.gold, mixBlendMode: 'multiply' }} />
          <AbsoluteFill style={{ background: C.gold, opacity: 0.6 }} />
        </>
      ) : (
        <>
          <AbsoluteFill style={{ background: C.violet, mixBlendMode: 'multiply', opacity: 0.9 }} />
          <AbsoluteFill
            style={{ background: `linear-gradient(180deg, ${C.bg}e6 0%, ${C.bg}66 28%, ${C.bg}80 58%, ${C.bg}f2 100%)` }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};
