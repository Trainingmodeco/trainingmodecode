// Practice Mode promo with the house character (the Higgsfield "Training mode
// coach/avatar" Soul character): a stylized vertical spot, not app footage.
// Beats: HOOK (about to strike) → WATCH IT (a clean Boxing jab) → DRILL IT
// (the count) → LEARNED (badge + the list growing) → THEN USE IT (combos, with
// timed rounds only as what's next) → CLOSE (the mark + the app's address).
//
// The post lists its beats, so a cutdown is the same composition with fewer
// beats. Every clip and voice line comes from raw-footage/ (staged by render).
// Facts it must keep (the brief): only Boxing strikes are drilled on screen;
// Practice feeds Combo Coach and never unlocks Fight Focus (shown as next only);
// no price, no free vs. Pro; no video claims for the other disciplines.
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { brand, C, FONT } from '../brand';

type Kind = 'hook' | 'watch' | 'drill' | 'learned' | 'use' | 'close';
export type PromoBeat = {
  kind: Kind;
  sec: number; // length on screen
  src?: string; // the character clip (720×1280 or any 9:16)
  from?: number; // clip second to start at
  rate?: number;
  voice?: string; // the narrator line, starts with the beat
  voiceAt?: number; // seconds into the beat
  counts?: number[]; // drill: seconds into the beat where 1, 2, 3, 4 are said
};
export type PracticePromoProps = {
  beats: PromoBeat[];
  music?: string;
  musicVolume?: number;
  strike?: string; // the drilled strike (Boxing only)
  combo?: string[];
  learned?: string[];
  url?: string;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const promoFrames = (p: PracticePromoProps, fps = 30) => Math.round(p.beats.reduce((s, b) => s + b.sec, 0) * fps);

// Safe area: nothing in the bottom 350 px or the right 140 px.
const SAFE = { left: 80, right: 160, bottomGap: 380 };

const Clip: React.FC<{ b: PromoBeat; push?: number; dim?: number }> = ({ b, push = 0.06, dim = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps / b.sec;
  if (!b.src) return null;
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      <OffthreadVideo
        muted
        src={staticFile(b.src)}
        startFrom={Math.round((b.from ?? 0) * fps)}
        playbackRate={b.rate ?? 1}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${1 + push * t})` }}
      />
      {/* violet floor glow + top shade so the white type reads */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg}d0 0%, ${C.bg}00 34%, ${C.bg}00 62%, ${C.bg}b0 100%)` }} />
      {dim ? <AbsoluteFill style={{ background: C.bg, opacity: dim }} /> : null}
    </AbsoluteFill>
  );
};

// A short white flash + hit on each cut.
const CutFlash: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#fff', opacity: interpolate(frame, [0, 4], [0.55, 0], clamp) }} />;
};

const Kicker: React.FC<{ text: string; color?: string; top?: number }> = ({ text, color = C.gold, top = 250 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 190 } });
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: SAFE.left,
        right: SAFE.right,
        fontFamily: FONT.display,
        fontWeight: 900,
        fontSize: 108,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color,
        letterSpacing: '0.01em',
        transform: `translateX(${(1 - s) * -160}px) skewX(-8deg)`,
        opacity: Math.min(1, s * 1.6),
        textShadow: `0 0 40px ${color}99, 0 7px 0 ${C.bg}`,
      }}
    >
      {text}
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode; delay?: number; color?: string; top: number }> = ({ children, delay = 6, color = C.violet, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 13 } });
  return (
    <div style={{ position: 'absolute', top, left: SAFE.left, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
      <span
        style={{
          display: 'inline-block',
          fontFamily: FONT.body,
          fontWeight: 700,
          fontSize: 46,
          letterSpacing: '0.12em',
          color: C.text,
          padding: '10px 26px',
          border: `3px solid ${color}`,
          borderRadius: 14,
          background: `${C.panel}cc`,
          boxShadow: `0 0 24px ${color}66`,
        }}
      >
        {children}
      </span>
    </div>
  );
};

const Hook: React.FC<{ b: PromoBeat }> = ({ b }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame: frame - 8, fps, config: { damping: 12 } });
  const c = spring({ frame: frame - 16, fps, config: { damping: 12 } });
  return (
    <>
      <Clip b={b} push={0.1} />
      <div style={{ position: 'absolute', top: 230, left: SAFE.left, right: SAFE.right, fontFamily: FONT.display, fontWeight: 900, lineHeight: 1.02 }}>
        <div style={{ fontSize: 110, color: C.text, opacity: a, transform: `translateY(${(1 - a) * 40}px)`, textShadow: `0 6px 0 ${C.bg}` }}>ONE STRIKE</div>
        <div style={{ fontSize: 110, color: C.gold, opacity: c, transform: `translateY(${(1 - c) * 40}px) skewX(-8deg)`, textShadow: `0 0 40px ${C.gold}99, 0 6px 0 ${C.bg}` }}>AT A TIME.</div>
      </div>
    </>
  );
};

const Watch: React.FC<{ b: PromoBeat; strike: string }> = ({ b, strike }) => (
  <>
    <Clip b={b} push={0.04} />
    <CutFlash />
    <Kicker text="WATCH IT." />
    <Chip top={410}>BOXING · {strike.toUpperCase()}</Chip>
  </>
);

const Drill: React.FC<{ b: PromoBeat }> = ({ b }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const counts = b.counts ?? [0.8, 1.35, 1.95, 2.5];
  const n = counts.filter((c) => t >= c).length;
  const since = n ? t - counts[n - 1] : 0;
  const pop = n ? interpolate(since, [0, 0.12, 0.3], [1.5, 0.95, 1], clamp) : 0;
  const shake = n && since < 0.12 ? Math.sin(frame * 3) * 10 : 0;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${shake}px)` }}>
        <Clip b={b} push={0.08} />
      </div>
      <CutFlash />
      <Kicker text="DRILL IT!" color={C.gold} />
      {n ? (
        <div
          style={{
            position: 'absolute',
            top: 760,
            left: SAFE.left,
            right: SAFE.right,
            textAlign: 'center',
            fontFamily: FONT.display,
            fontWeight: 900,
            fontSize: 300,
            color: C.text,
            transform: `scale(${pop})`,
            textShadow: `0 0 60px ${C.violet}, 0 10px 0 ${C.bg}`,
          }}
        >
          {n}
        </div>
      ) : null}
      <div style={{ position: 'absolute', top: 410, left: SAFE.left, display: 'flex', gap: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ width: 70, height: 18, borderRadius: 9, background: i < n ? C.gold : `${C.text}33`, boxShadow: i < n ? `0 0 18px ${C.gold}` : 'none' }} />
        ))}
      </div>
    </>
  );
};

// The app's Practice look: dark panel, gold title, green ticks.
const Learned: React.FC<{ b: PromoBeat; learned: string[] }> = ({ b, learned }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const badge = spring({ frame, fps, config: { damping: 9, stiffness: 180 } });
  const step = 0.42 * fps;
  const shown = Math.min(learned.length, Math.max(0, Math.floor((frame - 10) / step) + 1));
  return (
    <>
      <Clip b={b} push={0.02} dim={0.62} />
      <CutFlash />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, paddingRight: SAFE.right - SAFE.left }}>
        <div
          style={{
            transform: `scale(${2 - badge}) rotate(${(1 - badge) * -12}deg)`,
            opacity: Math.min(1, badge * 2),
            fontFamily: FONT.display,
            fontWeight: 900,
            fontSize: 92,
            color: C.bg,
            background: C.gold,
            padding: '22px 46px',
            borderRadius: 22,
            boxShadow: `0 0 70px ${C.gold}aa, 0 10px 0 ${C.red}`,
            letterSpacing: '0.03em',
          }}
        >
          ✓ LEARNED
        </div>
        <div
          style={{
            marginTop: 70,
            width: 700,
            background: `${C.panel}ee`,
            border: `3px solid ${C.violet}`,
            borderRadius: 26,
            padding: '30px 40px',
            boxShadow: `0 0 50px ${C.violet}55`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FONT.body, fontWeight: 700, fontSize: 40, letterSpacing: '0.14em', color: C.muted }}>
            <span>BOXING</span>
            <span style={{ fontFamily: FONT.display, color: C.gold }}>
              {shown}/{learned.length}
            </span>
          </div>
          {learned.map((name, i) => {
            const s = spring({ frame: frame - 10 - i * step, fps, config: { damping: 12 } });
            const done = i < shown;
            return (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  marginTop: 24,
                  opacity: done ? s : 0.28,
                  transform: `translateX(${done ? (1 - s) * 60 : 0}px)`,
                  fontFamily: FONT.body,
                  fontWeight: 700,
                  fontSize: 64,
                  color: C.text,
                }}
              >
                <span
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    background: done ? C.green : 'transparent',
                    border: `3px solid ${done ? C.green : C.muted}`,
                    color: C.bg,
                  }}
                >
                  {done ? '✓' : ''}
                </span>
                {name.toUpperCase()}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </>
  );
};

const Use: React.FC<{ b: PromoBeat; combo: string[] }> = ({ b, combo }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nextAt = Math.round((b.sec - 1.35) * fps);
  const next = spring({ frame: frame - nextAt, fps, config: { damping: 13 } });
  return (
    <>
      <Clip b={b} push={0.08} />
      <CutFlash />
      <Kicker text="THEN USE IT." />
      <Chip top={410} color={C.gold}>
        COMBO COACH
      </Chip>
      <div style={{ position: 'absolute', top: 520, left: SAFE.left, right: SAFE.right, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        {combo.map((s, i) => {
          const k = spring({ frame: frame - 12 - i * 9, fps, config: { damping: 10, stiffness: 200 } });
          return (
            <div key={s + i} style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: Math.min(1, k * 2), transform: `scale(${0.6 + 0.4 * k})` }}>
              {i ? <span style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 46, color: C.gold }}>→</span> : null}
              <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 50, color: C.text, textShadow: `0 0 22px ${C.violet}, 0 5px 0 ${C.bg}` }}>{s.toUpperCase()}</span>
            </div>
          );
        })}
      </div>
      {/* what's next: timed rounds (shown only as next, never as unlocked) */}
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          bottom: SAFE.bottomGap + 10,
          opacity: next,
          transform: `translateY(${(1 - next) * 40}px)`,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          background: `${C.panel}e6`,
          border: `2px solid ${C.muted}88`,
          borderRadius: 18,
          padding: '16px 28px',
        }}
      >
        <span style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: 36, letterSpacing: '0.16em', color: C.muted }}>NEXT</span>
        <span style={{ fontFamily: FONT.display, fontWeight: 800, fontSize: 40, color: C.text }}>TIMED ROUNDS</span>
        <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 40, color: C.gold }}>3:00</span>
      </div>
    </>
  );
};

const Close: React.FC<{ url: string }> = ({ url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 11, stiffness: 150 } });
  const title = spring({ frame: frame - 10, fps, config: { damping: 13 } });
  const addr = spring({ frame: frame - 18, fps, config: { damping: 13 } });
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${C.panel} 0%, ${C.bg} 70%)` }}>
      <CutFlash />
      <AbsoluteFill style={{ alignItems: 'center', paddingTop: 300, paddingRight: SAFE.right - SAFE.left }}>
        <Img src={staticFile('brand/logo-t-gold.png')} style={{ width: 330, transform: `scale(${0.7 + 0.3 * logo})`, opacity: logo, filter: `drop-shadow(0 0 40px ${C.gold}66)` }} />
        <div style={{ marginTop: 40, fontFamily: FONT.display, fontWeight: 900, fontSize: 92, color: C.text, opacity: logo, letterSpacing: '0.04em', textShadow: `0 0 30px ${C.violet}` }}>TRAINING MODE</div>
        <div style={{ marginTop: 14, fontFamily: FONT.display, fontWeight: 900, fontSize: 64, letterSpacing: '0.1em', color: C.gold, opacity: title, transform: `translateY(${(1 - title) * 30}px)`, textShadow: `0 0 36px ${C.gold}88` }}>
          PRACTICE MODE
        </div>
        <div style={{ marginTop: 40, fontFamily: FONT.body, fontWeight: 700, fontSize: 58, letterSpacing: '0.06em', color: C.text, opacity: addr, transform: `translateY(${(1 - addr) * 30}px)` }}>
          {url}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const PracticePromo: React.FC<PracticePromoProps> = (p) => {
  const { fps, durationInFrames } = useVideoConfig();
  const url = (p.url ?? brand.appUrl).replace(/^https?:\/\//, '').replace(/\/$/, '');
  let at = 0;
  const seqs = p.beats.map((b, i) => {
    const from = Math.round(at * fps);
    const len = Math.round(b.sec * fps);
    at += b.sec;
    const body =
      b.kind === 'hook' ? <Hook b={b} /> :
      b.kind === 'watch' ? <Watch b={b} strike={p.strike ?? 'Jab'} /> :
      b.kind === 'drill' ? <Drill b={b} /> :
      b.kind === 'learned' ? <Learned b={b} learned={p.learned ?? ['Jab', 'Cross', 'Lead Hook']} /> :
      b.kind === 'use' ? <Use b={b} combo={p.combo ?? ['Jab', 'Cross', 'Lead Hook']} /> :
      <Close url={url} />;
    return (
      <Sequence key={i} from={from} durationInFrames={len} name={b.kind}>
        {body}
        {b.voice ? (
          <Sequence from={Math.round((b.voiceAt ?? 0) * fps)}>
            <Audio src={staticFile(b.voice)} />
          </Sequence>
        ) : null}
      </Sequence>
    );
  });
  const vol = p.musicVolume ?? 0.35;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {seqs}
      {p.music ? (
        <Audio
          src={staticFile(p.music)}
          volume={(f) => vol * interpolate(f, [durationInFrames - Math.round(0.9 * fps), durationInFrames - 1], [1, 0], clamp)}
        />
      ) : null}
    </AbsoluteFill>
  );
};
