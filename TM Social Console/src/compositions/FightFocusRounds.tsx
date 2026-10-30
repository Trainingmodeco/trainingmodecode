import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, FPS } from '../brand';
import { Bell } from '../parts/Bell';
import { END_CARD_FRAMES, EndCard } from '../parts/EndCard';
import { Slash } from '../parts/Hud';

// A Fight Focus session as a montage, dressed as the app's own Fight Focus
// timer (FightFocusTimer.jsx): the top third is the timer screen (FIGHT FOCUS
// title, ROUND / discipline / difficulty chips, the ring timer, round squares)
// and the owner's footage plays below. The session opens with the app's
// 3-2-1-GO and every round with its call screen ("ROUND 1" in gold, the drill
// under it) while the coach says "Round 1. Pendulum boxing." in the app's
// voice. No music (the owner adds it on the platform).
export type Round = {
  title: string; // "Pendulum boxing"
  src: string; // footage; raw-footage/ files are staged by tools/render.mjs
  start: number; // seconds into the clip
  end: number;
  rate?: number; // 1 = real time
  focusX?: number; // crop centre, 0-100
  focusY?: number; // crop centre, 0-100 (default frames a standing fighter head to feet)
  clockFrom?: number; // seconds left on the round clock when the clip starts
  voice?: string | null; // the spoken call (tools/voice.mjs)
  voiceSec?: number;
};

export type FightFocusRoundsProps = {
  discipline: string; // "Boxing"
  difficulty?: string; // "Normal"
  roundSec?: number; // the round length shown as "OF 3:00"
  hook: string; // under the 3-2-1-GO countdown
  intro?: { src: string; start: number; rate?: number; focusX?: number; focusY?: number } | null;
  rounds: Round[];
  cta: string;
  url?: string;
};

export const INTRO_FRAMES = 60;
const CALL_FRAMES = 36;
const VOICE_AT = 10;
const PANEL_H = 830;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// The app's timer colours (FightFocusTimer.jsx).
const APP = { gold: '#fde047', work: '#facc15', muted: '#8b83a8', lilac: '#c4a4d8', overlay: 'rgba(10,0,20,0.92)' };
const ringColor = (left: number) => (left <= 30 ? '#ef4444' : left > 60 ? '#a855f7' : '#f59e0b');
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const plainText = (s: string) => s.replace(/\*/g, '');

export const roundFrames = (r: Round) =>
  Math.max(
    CALL_FRAMES + 20,
    Math.round(((r.end - r.start) / (r.rate ?? 1)) * FPS),
    r.voice && r.voiceSec ? VOICE_AT + Math.ceil((r.voiceSec + 0.4) * FPS) : 0,
  );

export function roundsTimeline(p: FightFocusRoundsProps) {
  let from = INTRO_FRAMES;
  const rounds = p.rounds.map((round, index) => {
    const len = roundFrames(round);
    const s = { round, index, from, len };
    from += len;
    return s;
  });
  return { rounds, endFrom: from, total: from + END_CARD_FRAMES };
}

const Footage: React.FC<{ src: string; start: number; rate?: number; focusX?: number; focusY?: number; top?: number; dim?: number }> = ({
  src,
  start,
  rate = 1,
  focusX = 50,
  focusY = 62,
  top = PANEL_H,
  dim = 0,
}) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden', background: '#000' }}>
      <OffthreadVideo
        src={staticFile(src)}
        muted
        trimBefore={Math.round(start * fps)}
        playbackRate={rate}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focusX}% ${focusY}%`, filter: 'saturate(0.9) contrast(1.06)' }}
      />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, #0a0014 0%, rgba(10,0,20,0) 9%, rgba(10,0,20,0) 82%, rgba(10,0,20,0.55) 100%)' }} />
      {dim ? <AbsoluteFill style={{ background: '#000', opacity: dim }} /> : null}
    </div>
  );
};

// Back chevron and the gold FIGHT FOCUS title, as the timer's top bar.
const TopBar: React.FC = () => (
  <div style={{ position: 'absolute', top: 150, left: 60, right: 60, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <svg viewBox="0 0 24 24" width="54" height="54" style={{ position: 'absolute', left: 0 }} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
    <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 38, color: APP.gold, letterSpacing: '0.12em', textShadow: '0 0 26px rgba(253,224,71,0.35)' }}>
      FIGHT FOCUS
    </div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; gold?: boolean }> = ({ children, gold }) => (
  <span
    style={{
      fontFamily: FONT.display,
      fontWeight: 700,
      fontSize: 21,
      letterSpacing: '0.04em',
      color: gold ? APP.work : APP.lilac,
      border: `2px solid ${gold ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.4)'}`,
      borderRadius: 15,
      padding: '9px 22px',
      background: 'rgba(10,0,20,0.35)',
    }}
  >
    {children}
  </span>
);

const BellIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);

// The ring timer: the app's ring art, the progress arc on its edge in the
// phase colour with the white tip, the dashed outer ring, and the clock.
const RING_SIZE = 394;
const RING_R = 162;
const RING_STROKE = 12;
const RingTimer: React.FC<{ left: number; total: number; size: number }> = ({ left, total, size }) => {
  const frame = useCurrentFrame();
  const shown = Math.max(0, Math.ceil(left));
  const color = ringColor(shown);
  const c = RING_SIZE / 2;
  const circ = 2 * Math.PI * RING_R;
  const pct = Math.max(0, Math.min(1, left / total));
  const angle = pct * 2 * Math.PI - Math.PI / 2;
  const tip = { x: c + RING_R * Math.cos(angle), y: c + RING_R * Math.sin(angle) };
  const k = size / 250; // the app draws the ring at about 250 px
  const final = shown <= 30;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <Img src={staticFile('tm/ui/ring-fight.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', opacity: 0.35 }} />
      <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <circle cx={c} cy={c} r={RING_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={RING_STROKE} />
        <circle cx={c} cy={c} r={RING_R + 14} fill="none" stroke={color} opacity={0.15} strokeWidth={1} strokeDasharray="3 7" transform={`rotate(${frame * 0.4} ${c} ${c})`} />
        <circle
          cx={c}
          cy={c}
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - pct * circ}
          transform={`rotate(-90 ${c} ${c})`}
          style={{ filter: final ? `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 28px ${color})` : `drop-shadow(0 0 8px ${color})` }}
        />
        {pct > 0 && pct < 1 ? <circle cx={tip.x} cy={tip.y} r={5} fill="#fff" stroke={color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 10px ${color})` }} /> : null}
      </svg>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 * k, fontFamily: FONT.pixel, fontSize: 9 * k, color: APP.work, letterSpacing: '0.12em', marginBottom: 8 * k }}>
          <BellIcon color={APP.work} size={11 * k} />
          WORK
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: 46 * k, color: '#fff', lineHeight: 1, letterSpacing: '0.02em', textShadow: `0 0 ${20 * k}px ${color}` }}>
          {mmss(shown)}
        </div>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 10 * k, color: APP.muted, letterSpacing: '0.1em', marginTop: 8 * k }}>
          OF {Math.floor(total / 60)}:{String(total % 60).padStart(2, '0')}
        </div>
        {final ? (
          <div style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 8 * k, color: '#ef4444', letterSpacing: '0.2em', marginTop: 4 * k, opacity: 0.85 }}>FINAL 30</div>
        ) : null}
      </AbsoluteFill>
    </div>
  );
};

// Numbered round squares: done ones dim gold, the current one lit.
const RoundDots: React.FC<{ current: number; total: number }> = ({ current, total }) => (
  <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
    {Array.from({ length: total }, (_, i) => {
      const on = i === current;
      const done = i < current;
      return (
        <div
          key={i}
          style={{
            width: 54,
            height: 54,
            borderRadius: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 21,
            background: on ? 'rgba(253,224,71,0.15)' : done ? 'rgba(253,224,71,0.06)' : 'rgba(255,255,255,0.03)',
            border: on ? '3px solid rgba(253,224,71,0.7)' : done ? '2px solid rgba(253,224,71,0.25)' : '2px solid rgba(255,255,255,0.08)',
            color: on ? APP.gold : done ? 'rgba(253,224,71,0.5)' : 'rgba(255,255,255,0.2)',
            boxShadow: on ? '0 0 18px rgba(253,224,71,0.3)' : 'none',
          }}
        >
          {i + 1}
        </div>
      );
    })}
  </div>
);

// The timer screen's top third over the app's brand background.
const AppPanel: React.FC<{ n: number; total: number; discipline: string; difficulty: string; left: number; roundSec: number }> = ({
  n,
  total,
  discipline,
  difficulty,
  left,
  roundSec,
}) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: PANEL_H, overflow: 'hidden' }}>
    <Img src={staticFile('tm/ui/brand-bg.webp')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%' }} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(10,0,20,0.55) 0%, rgba(10,0,20,0.72) 100%)' }} />
    <TopBar />
    <div style={{ position: 'absolute', top: 222, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16 }}>
      <Chip gold>
        ROUND {n}/{total}
      </Chip>
      <Chip>{discipline.toUpperCase()}</Chip>
      <Chip>{difficulty.toUpperCase()}</Chip>
    </div>
    <div style={{ position: 'absolute', top: 284, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
      <RingTimer left={left} total={roundSec} size={460} />
    </div>
    <div style={{ position: 'absolute', top: 756, left: 0, right: 0 }}>
      <RoundDots current={n - 1} total={total} />
    </div>
  </div>
);

// The app's call screen: dark veil, the word in gold Orbitron, a line under it.
const CallScreen: React.FC<{ big: string; sub?: string; size: number; color?: string; glow?: string }> = ({
  big,
  sub,
  size,
  color = APP.gold,
  glow = 'rgba(253,224,71,0.8)',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const rise = { opacity: Math.min(1, s * 1.3), transform: `translateY(${(1 - s) * 40}px)` };
  return (
    <AbsoluteFill style={{ background: APP.overlay, alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
      <div style={{ fontFamily: FONT.display, fontWeight: 900, fontSize: size, color, lineHeight: 1, textAlign: 'center', textShadow: `0 0 ${size * 0.5}px ${glow}`, ...rise }}>
        {big}
      </div>
      {sub ? (
        <div style={{ fontFamily: FONT.body, fontWeight: 600, fontSize: 58, color: '#fff', letterSpacing: '0.1em', marginTop: 38, textAlign: 'center', ...rise, opacity: 0.85 * rise.opacity }}>
          {sub}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

// 3-2-1-GO, as the app counts a session in.
const Intro: React.FC<{ p: FightFocusRoundsProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const step = Math.min(3, Math.floor(frame / 15));
  const word = ['3', '2', '1', 'GO'][step];
  const bg = p.intro ?? p.rounds[0];
  return (
    <AbsoluteFill style={{ background: '#0a0014' }}>
      {bg ? <Footage {...bg} top={0} dim={0.25} /> : null}
      <Sequence from={step * 15} durationInFrames={15}>
        <CallScreen
          big={word}
          sub={plainText(p.hook)}
          size={word === 'GO' ? 280 : 360}
          color={word === 'GO' ? '#22c55e' : APP.gold}
          glow={word === 'GO' ? 'rgba(34,197,94,0.8)' : 'rgba(253,224,71,0.8)'}
        />
      </Sequence>
      <TopBar />
    </AbsoluteFill>
  );
};

const RoundScene: React.FC<{ r: Round; n: number; total: number; p: FightFocusRoundsProps }> = ({ r, n, total, p }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const roundSec = p.roundSec ?? 180;
  const left = (r.clockFrom ?? roundSec) - frame / fps;
  const final = Math.ceil(left) <= 30;
  const callOut = interpolate(frame, [CALL_FRAMES - 7, CALL_FRAMES], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: '#0a0014' }}>
      <Footage src={r.src} start={r.start} rate={r.rate} focusX={r.focusX} focusY={r.focusY} />
      <AppPanel n={n} total={total} discipline={p.discipline} difficulty={p.difficulty ?? 'Normal'} left={left} roundSec={roundSec} />
      {final ? (
        <AbsoluteFill
          style={{
            background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.16) 0%, transparent 70%)',
            opacity: 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI),
          }}
        />
      ) : null}
      {frame < CALL_FRAMES ? (
        <AbsoluteFill style={{ opacity: callOut }}>
          <CallScreen big={`ROUND ${n}`} sub={r.title} size={116} />
        </AbsoluteFill>
      ) : null}
      <Bell ring="single" volume={0.6} />
      {r.voice ? (
        <Sequence from={VOICE_AT}>
          <Audio src={staticFile(r.voice)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

export const FightFocusRounds: React.FC<FightFocusRoundsProps> = (p) => {
  const { rounds, endFrom } = roundsTimeline(p);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <Intro p={p} />
      </Sequence>
      {rounds.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={s.len}>
          <RoundScene r={s.round} n={s.index + 1} total={rounds.length} p={p} />
        </Sequence>
      ))}
      <Sequence from={endFrom - 5} durationInFrames={11}>
        <Slash />
      </Sequence>
      <Sequence from={endFrom}>
        <EndCard cta={p.cta} url={p.url} />
      </Sequence>
    </AbsoluteFill>
  );
};
