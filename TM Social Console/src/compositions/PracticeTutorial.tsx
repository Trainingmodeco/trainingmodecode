import { AbsoluteFill, Audio, Freeze, Sequence, continueRender, delayRender, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useEffect, useState } from 'react';
import { FPS, HEIGHT, WIDTH } from '../brand';
import { Bell } from '../parts/Bell';

// A Practice Mode technique tutorial: one move, 32 s, in the app's own
// Practice look (PracticeMode.jsx / PracticeRound.jsx). Six beats:
//   HOOK   0–2 s   the problem in one line over the move at full speed
//   NAME   2–4 s   gym-number tile, name, level; one clean rep
//   CUES   4–16 s  three key points, 4 s each: slow motion (0.4×), a marker on
//                  the body part landing on the frame it matters
//   WATCH  16–22 s one mistake: freeze, red ✕ on the fault, then the fix in green
//   DRILL  22–28 s real speed, the Practice Round ring calling the work
//   NEXT   28–32 s the move ticked, the next named, OPEN PRACTICE MODE
// The words are the app's own (practiceData.js: cues, mistakes, next). Markers
// come from tools/pose.py (MediaPipe body landmarks) so they follow the body.
export type Mark =
  | 'nose' | 'chin' | 'hips' | 'leadShoulder' | 'rearShoulder' | 'leadElbow' | 'rearElbow'
  | 'leadHand' | 'rearHand' | 'leadKnee' | 'rearKnee' | 'leadFoot' | 'rearFoot';
// `mark` follows a body landmark; `point` ([x, y] as fractions of the clip)
// pins the marker by hand where the landmarks are unreliable (a body half out
// of frame confuses the model).
// `zoom` and `focus` override the composition's camera for this cue (a low
// mark, like a foot, needs a wider or lower frame to stay clear of the card).
export type Cue = { text: string; at: number; mark?: Mark; point?: [number, number]; label?: string; say?: string; voice?: string | null; voiceSec?: number; zoom?: number; focus?: [number, number] };
export type PracticeTutorialProps = {
  discipline: string; // "Muay Thai"
  technique: string; // "Cross"
  number?: string | null; // the gym number (1 = jab, 2 = cross); null for kicks
  badge?: string; // PUNCH / KICK / KNEE / ELBOW / DEFENSE / FOOTWORK
  level?: 'Beginner' | 'Intermediate' | 'Advanced';
  description?: string;
  stance?: 'orthodox' | 'southpaw'; // which side is the lead (orthodox: left)
  hook: string; // two lines split on "|", *gold* words
  hookSub?: string;
  src: string; // the clip (raw-footage/…; staged by tools/render.mjs)
  slowSrc?: string | null; // the same clip at a higher frame rate for slow motion
  pose?: string | null; // raw-footage/…pose.json from tools/pose.py
  hookAt: number; // seconds into the clip: the hook beat plays from here at full speed
  repAt: number; // the NAME beat's clean rep plays from here
  cues: Cue[]; // `at` = the frame the cue belongs to, in clip seconds
  // `fixAt`: where the correct version plays from (default: just before `at`).
  watch: { text: string; fix: string; at: number; fixAt?: number; mark?: Mark; point?: [number, number]; label?: string; say?: string; zoom?: number; focus?: [number, number] };
  drill: { calls: string[]; start: number; cue?: string; label?: string };
  next?: { number?: string | null; name: string; description?: string; level?: string } | null;
  cta?: string;
  zoom?: number; // the camera on the cue and watch beats, centred on the body (1 = full frame)
  focus?: [number, number] | null; // fix the camera's centre (fractions) instead of following the body
};

export const BEATS = { hook: 60, name: 60, cue: 120, watch: 180, drill: 180, next: 120 };
export const SLOW = 0.4;
const CUE_LEAD = 0.9; // seconds of the move shown before the cue's frame
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// The app's Practice palette (PracticeMode.jsx / PracticeRound.jsx).
const P = {
  ground: '#07060C', card: '#0F0B1F', deep: '#0A0716', violet: '#B794FF', violetLine: 'rgba(168,85,247,0.5)',
  gold: '#F2BE45', goldHi: '#FFE9A8', goldLo: '#C98A1C', red: '#EF4444', redSoft: '#F87171', green: '#4ADE80',
  lilac: '#C4A8FF', text: '#fff', soft: '#CFC9E4', muted: '#A9A3C4',
};
const F = { head: "'Chakra Petch', sans-serif", body: 'Barlow, sans-serif', num: 'Orbitron, sans-serif' };
const LEVEL: Record<string, string> = { Beginner: P.green, Intermediate: P.gold, Advanced: P.redSoft };

export function tutorialTimeline(p: PracticeTutorialProps) {
  const n = Math.max(1, Math.min(3, p.cues.length));
  const hook = { from: 0, len: BEATS.hook };
  const name = { from: hook.from + hook.len, len: BEATS.name };
  const cues = Array.from({ length: n }, (_, i) => ({ from: name.from + name.len + i * BEATS.cue, len: BEATS.cue }));
  const watch = { from: name.from + name.len + n * BEATS.cue, len: BEATS.watch };
  const drill = { from: watch.from + watch.len, len: BEATS.drill };
  const next = { from: drill.from + drill.len, len: BEATS.next };
  return { hook, name, cues, watch, drill, next, total: next.from + next.len };
}

// ── body landmarks ────────────────────────────────────────────────────────────
type Pt = [number, number] | null;
type PoseFrame = { t: number } & Record<string, Pt | number>;
type Pose = { fps: number; frames: PoseFrame[] };

const usePose = (path?: string | null) => {
  const [pose, setPose] = useState<Pose | null>(null);
  useEffect(() => {
    if (!path) return;
    const h = delayRender('pose landmarks');
    fetch(staticFile(path))
      .then((r) => r.json())
      .then((d: Pose) => {
        setPose(d);
        continueRender(h);
      })
      .catch(() => continueRender(h));
  }, [path]);
  return pose;
};

const at = (pose: Pose | null, t: number) => (pose ? pose.frames[Math.max(0, Math.min(pose.frames.length - 1, Math.round(t * pose.fps)))] : null);
const pt = (f: PoseFrame | null, k: string): [number, number] | null => (f && Array.isArray(f[k]) ? (f[k] as [number, number]) : null);
const mid = (a: [number, number] | null, b: [number, number] | null): [number, number] | null =>
  a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a ?? b;

// Where a mark sits in the frame (fractions), for this stance.
function markPoint(f: PoseFrame | null, mark: Mark, stance: 'orthodox' | 'southpaw'): [number, number] | null {
  const lead = stance === 'orthodox' ? 'l' : 'r';
  const rear = stance === 'orthodox' ? 'r' : 'l';
  switch (mark) {
    case 'nose': return pt(f, 'nose');
    case 'chin': { const n = pt(f, 'nose'); return n ? [n[0], n[1] + 0.035] : null; }
    case 'hips': return mid(pt(f, 'lhip'), pt(f, 'rhip'));
    case 'leadShoulder': return pt(f, `${lead}sho`);
    case 'rearShoulder': return pt(f, `${rear}sho`);
    case 'leadElbow': return pt(f, `${lead}elb`);
    case 'rearElbow': return pt(f, `${rear}elb`);
    case 'leadHand': return pt(f, `${lead}wri`);
    case 'rearHand': return pt(f, `${rear}wri`);
    case 'leadKnee': return pt(f, `${lead}kne`);
    case 'rearKnee': return pt(f, `${rear}kne`);
    case 'leadFoot': return pt(f, `${lead}ank`);
    case 'rearFoot': return pt(f, `${rear}ank`);
  }
}

// The body's centre over ±0.4 s, so the camera glides instead of jittering.
function bodyCentre(pose: Pose | null, t: number): [number, number] {
  if (!pose) return [0.5, 0.5];
  const xs: number[] = [], ys: number[] = [];
  for (let dt = -0.4; dt <= 0.4; dt += 1 / pose.fps) {
    const f = at(pose, t + dt);
    const c = mid(mid(pt(f, 'lhip'), pt(f, 'rhip')), mid(pt(f, 'lsho'), pt(f, 'rsho')));
    if (c) { xs.push(c[0]); ys.push(c[1]); }
  }
  if (!xs.length) return [0.5, 0.5];
  return [xs.reduce((a, b) => a + b, 0) / xs.length, ys.reduce((a, b) => a + b, 0) / ys.length];
}

// The camera: zoom k about a point (fractions), kept inside the frame.
type Cam = { k: number; tx: number; ty: number };
const camera = (k: number, c: [number, number]): Cam => ({
  k,
  tx: Math.min(0, Math.max(WIDTH - k * WIDTH, WIDTH / 2 - k * c[0] * WIDTH)),
  ty: Math.min(0, Math.max(HEIGHT - k * HEIGHT, HEIGHT / 2 - k * c[1] * HEIGHT)),
});
const toScreen = (cam: Cam, p: [number, number]) => ({ x: cam.tx + cam.k * p[0] * WIDTH, y: cam.ty + cam.k * p[1] * HEIGHT });

// ── footage ───────────────────────────────────────────────────────────────────
const Footage: React.FC<{ src: string; start: number; rate?: number; cam?: Cam; freeze?: boolean; dim?: number; grade?: 'none' | 'cold' }> = ({
  src, start, rate = 1, cam = { k: 1, tx: 0, ty: 0 }, freeze = false, dim = 0, grade = 'none',
}) => {
  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      muted
      trimBefore={Math.round(start * FPS)}
      playbackRate={rate}
      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: grade === 'cold' ? 'saturate(0.7) brightness(0.8)' : 'saturate(0.95) contrast(1.05)' }}
    />
  );
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.k})` }}>
        {freeze ? <Freeze frame={0}>{video}</Freeze> : video}
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(7,6,12,0.6) 0%, rgba(7,6,12,0) 22%, rgba(7,6,12,0) 60%, rgba(7,6,12,0.86) 100%)' }} />
      {dim ? <AbsoluteFill style={{ background: P.ground, opacity: dim }} /> : null}
    </div>
  );
};

// ── pieces of the app's Practice screens ──────────────────────────────────────
const Chip: React.FC<{ children: React.ReactNode; color?: string; line?: string; size?: number }> = ({ children, color = P.lilac, line, size = 22 }) => (
  <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: size, letterSpacing: '0.14em', padding: `${size * 0.5}px ${size * 0.85}px`, borderRadius: 12, border: `2px solid ${line ?? color}99`, color, background: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

const Tile: React.FC<{ mark: string; size: number; color?: string; glow?: boolean }> = ({ mark, size, color = P.gold, glow = true }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,7,22,0.92)', border: `${Math.max(3, size * 0.04)}px solid ${color}DD`, boxShadow: glow ? `0 0 ${size * 0.3}px ${color}55` : 'none', fontFamily: mark.length > 2 ? F.head : F.num, fontWeight: 900, fontSize: mark.length > 2 ? size * 0.3 : size * 0.48, color }}>
    {mark}
  </div>
);

const tileMark = (p: PracticeTutorialProps) => p.number ?? p.technique.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase();

// Top bar on the cue and watch beats: tile, name, the three progress segments.
const TopBar: React.FC<{ p: PracticeTutorialProps; step: number; right?: React.ReactNode }> = ({ p, step, right }) => (
  <div style={{ position: 'absolute', left: 50, right: 50, top: 136, display: 'flex', alignItems: 'center', gap: 24 }}>
    <Tile mark={tileMark(p)} size={84} glow={false} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flexGrow: 1 }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 32, letterSpacing: '0.08em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
        {p.technique.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ width: 84, height: 10, borderRadius: 5, background: i < step ? P.gold : i === step ? P.gold : 'rgba(255,255,255,0.18)', boxShadow: i === step ? `0 0 16px ${P.gold}` : 'none', opacity: i < step ? 0.8 : 1 }} />
        ))}
      </div>
    </div>
    {right}
  </div>
);

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, background: 'rgba(255,255,255,0.12)' }}>
      <div style={{ width: `${(frame / durationInFrames) * 100}%`, height: '100%', background: P.gold }} />
    </div>
  );
};

// A ring on the body part with a short line and a label.
const Marker: React.FC<{ x: number; y: number; label?: string; color?: string; size?: number }> = ({ x, y, label, color = P.gold, size = 150 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 11, stiffness: 240 } });
  const pulse = 1 + 0.04 * Math.sin(frame / 4);
  const left = x + size / 2 + 110 + 260 > WIDTH - 140; // keep the label inside the right safe area
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, opacity: Math.min(1, pop * 1.4) }}>
      <div style={{ position: 'absolute', left: -size / 2, top: -size / 2, width: size, height: size, borderRadius: '50%', border: `7px solid ${color}`, boxShadow: `0 0 40px ${color}CC, inset 0 0 30px ${color}55`, transform: `scale(${(1.6 - 0.6 * pop) * pulse})` }} />
      {label ? (
        <>
          <div style={{ position: 'absolute', top: -2, left: left ? -size / 2 - 90 : size / 2, width: 90, height: 4, background: color }} />
          <div style={{ position: 'absolute', top: -26, left: left ? undefined : size / 2 + 90, right: left ? size / 2 + 90 : undefined, fontFamily: F.head, fontWeight: 700, fontSize: 24, letterSpacing: '0.14em', padding: '12px 16px', borderRadius: 10, background: 'rgba(10,7,22,0.94)', border: `2px solid ${color}DD`, color, whiteSpace: 'nowrap' }}>
            {label}
          </div>
        </>
      ) : null}
    </div>
  );
};

const gold = (s: string) =>
  s.split(/(\*[^*]+\*)/).filter(Boolean).map((part, i) =>
    part.startsWith('*') ? <span key={i} style={{ color: P.gold }}>{part.slice(1, -1)}</span> : <span key={i}>{part}</span>,
  );

const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 190 } });
  return <div style={{ opacity: Math.min(1, s * 1.3), transform: `translateY(${(1 - s) * 40}px)`, ...style }}>{children}</div>;
};

// ── the beats ────────────────────────────────────────────────────────────────
const Hook: React.FC<{ p: PracticeTutorialProps }> = ({ p }) => {
  const [l1, l2 = ''] = p.hook.split('|');
  return (
    <AbsoluteFill>
      <Footage src={p.src} start={p.hookAt} />
      <div style={{ position: 'absolute', left: 50, top: 136, display: 'flex', gap: 14 }}>
        <Chip>PRACTICE MODE</Chip>
        <Chip color="#fff" line="rgba(255,255,255,0.4)">{p.discipline.toUpperCase()}</Chip>
      </div>
      <div style={{ position: 'absolute', left: 50, right: 140, top: 1020, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Rise delay={-6}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 92, lineHeight: 1.02, letterSpacing: '0.02em', textShadow: '0 4px 20px rgba(0,0,0,0.85)' }}>
            {gold(l1)}
            {l2 ? <><br />{gold(l2)}</> : null}
          </div>
        </Rise>
        {p.hookSub ? (
          <Rise delay={6}>
            <div style={{ fontFamily: F.body, fontWeight: 600, fontSize: 42, color: '#E8E4F5', textShadow: '0 2px 12px rgba(0,0,0,0.85)' }}>{p.hookSub}</div>
          </Rise>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: 50, right: 140, bottom: 300, display: 'flex', alignItems: 'center', gap: 28 }}>
        <Tile mark={tileMark(p)} size={140} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 50, letterSpacing: '0.08em', lineHeight: 1 }}>{p.technique.toUpperCase()}</div>
          {p.description ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 30, color: P.soft }}>{p.description}</div> : null}
        </div>
        {p.level ? <span style={{ marginLeft: 'auto' }}><Chip color={LEVEL[p.level] ?? P.gold}>{p.level.toUpperCase()}</Chip></span> : null}
      </div>
    </AbsoluteFill>
  );
};

const Name: React.FC<{ p: PracticeTutorialProps }> = ({ p }) => (
  <AbsoluteFill>
    <Footage src={p.src} start={p.repAt} dim={0.35} />
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 34, paddingBottom: 120 }}>
      <Rise delay={0}><Tile mark={tileMark(p)} size={240} /></Rise>
      <Rise delay={5} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 92, letterSpacing: '0.08em', lineHeight: 1, textAlign: 'center', textShadow: '0 4px 20px rgba(0,0,0,0.85)' }}>{p.technique.toUpperCase()}</div>
        {p.description ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 38, color: P.soft, textAlign: 'center' }}>{p.description}</div> : null}
      </Rise>
      <Rise delay={10} style={{ display: 'flex', gap: 14 }}>
        <Chip color="#fff" line="rgba(255,255,255,0.4)">{p.discipline.toUpperCase()}</Chip>
        {p.badge ? <Chip>{p.badge.toUpperCase()}</Chip> : null}
        {p.level ? <Chip color={LEVEL[p.level] ?? P.gold}>{p.level.toUpperCase()}</Chip> : null}
      </Rise>
      <Rise delay={16}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: P.lilac, marginTop: 10 }}>STEP-BY-STEP · {Math.min(3, p.cues.length)} KEY POINTS</div>
      </Rise>
    </AbsoluteFill>
  </AbsoluteFill>
);

const CueBeat: React.FC<{ p: PracticeTutorialProps; cue: Cue; i: number; pose: Pose | null }> = ({ p, cue, i, pose }) => {
  const frame = useCurrentFrame();
  const src = p.slowSrc ?? p.src;
  const start = Math.max(0, cue.at - CUE_LEAD);
  const t = start + (frame / FPS) * SLOW; // the clip time on screen now
  const landAt = Math.round(((cue.at - start) / SLOW) * FPS); // the frame the cue belongs to
  const cam = camera(cue.zoom ?? p.zoom ?? 1.45, cue.focus ?? p.focus ?? bodyCentre(pose, t));
  const m = cue.point ?? (cue.mark ? markPoint(at(pose, t), cue.mark, p.stance ?? 'orthodox') : null);
  const s = m ? toScreen(cam, m) : null;
  const landed = frame >= landAt;
  // A low mark (feet, knees) would sit under the card: the card moves to the top.
  const cardUp = s != null && s.y > HEIGHT - 330 - 340;
  return (
    <AbsoluteFill>
      <Footage src={src} start={start} rate={SLOW} cam={cam} />
      <TopBar p={p} step={i} right={<Chip size={20}>0.4× SLOW</Chip>} />
      {landed && s ? (
        <Sequence from={landAt} layout="none">
          <Marker x={s.x} y={s.y} label={cue.label} />
        </Sequence>
      ) : null}
      <div style={{ position: 'absolute', left: 50, right: 140, ...(cardUp ? { top: 290 } : { bottom: 330 }), display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 24, letterSpacing: '0.18em', color: P.lilac }}>KEY POINT {i + 1} OF {Math.min(3, p.cues.length)}</div>
        {landed ? (
          <Sequence from={landAt} layout="none">
            <Rise>
              <div style={{ display: 'flex', gap: 30, alignItems: 'center', padding: '30px 36px', borderRadius: 26, background: 'rgba(10,7,22,0.94)', border: `3px solid ${P.gold}EE`, boxShadow: `0 0 36px ${P.gold}77` }}>
                <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 58, color: P.gold, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 50, lineHeight: 1.12 }}>{cue.text}</span>
              </div>
              {cue.say ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 32, color: P.soft, marginTop: 14, paddingLeft: 4 }}>{cue.say}</div> : null}
            </Rise>
          </Sequence>
        ) : (
          <div style={{ height: 150 }} />
        )}
      </div>
      {cue.voice && landed ? (
        <Sequence from={landAt} layout="none">
          <Audio src={staticFile(cue.voice)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

const Watch: React.FC<{ p: PracticeTutorialProps; pose: Pose | null }> = ({ p, pose }) => {
  const frame = useCurrentFrame();
  const FREEZE = 90; // then the fix plays at half speed
  const w = p.watch;
  const fixStart = Math.max(0, w.fixAt ?? w.at - 0.6);
  const t = frame < FREEZE ? w.at : fixStart + ((frame - FREEZE) / FPS) * 0.5;
  const cam = camera(w.zoom ?? p.zoom ?? 1.45, w.focus ?? p.focus ?? bodyCentre(pose, t));
  const m = w.point ?? (w.mark ? markPoint(at(pose, w.at), w.mark, p.stance ?? 'orthodox') : null);
  const s = m ? toScreen(cam, m) : null;
  const redIn = interpolate(frame, [0, 8], [0, 1], clamp);
  const fixing = frame >= FREEZE;
  return (
    <AbsoluteFill>
      {frame < FREEZE ? <Footage src={p.src} start={w.at} freeze grade="cold" cam={cam} /> : null}
      {fixing ? (
        <Sequence from={FREEZE} layout="none">
          <Footage src={p.slowSrc ?? p.src} start={fixStart} rate={0.5} cam={cam} />
        </Sequence>
      ) : null}
      {!fixing ? <AbsoluteFill style={{ boxShadow: 'inset 0 0 220px rgba(239,68,68,0.5)', opacity: redIn }} /> : null}
      <TopBar p={p} step={3} right={<Chip size={20} color="#fff" line="rgba(255,255,255,0.4)">{fixing ? '0.5× FIX' : 'FREEZE'}</Chip>} />
      {!fixing && s ? <Marker x={s.x} y={s.y} label={w.label} color={P.red} size={240} /> : null}
      <div style={{ position: 'absolute', left: 50, right: 140, bottom: 330, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 24, letterSpacing: '0.18em', color: P.redSoft }}>WATCH FOR</div>
        <Rise>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: '26px 36px', borderRadius: 26, background: 'rgba(26,10,18,0.95)', border: `3px solid ${P.red}BB`, opacity: fixing ? 0.55 : 1 }}>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 54, color: P.red, flexShrink: 0 }}>✕</span>
            <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 46, lineHeight: 1.12 }}>{w.text}</span>
          </div>
        </Rise>
        {fixing ? (
          <Sequence from={FREEZE} layout="none">
            <Rise>
              <div style={{ display: 'flex', gap: 28, alignItems: 'center', padding: '26px 36px', borderRadius: 26, background: 'rgba(8,24,14,0.95)', border: `3px solid ${P.green}BB`, boxShadow: `0 0 36px ${P.green}44` }}>
                <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 50, color: P.green, flexShrink: 0 }}>✓</span>
                <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 46, lineHeight: 1.12 }}>{w.fix}</span>
              </div>
              {w.say ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 32, color: P.soft, marginTop: 14, paddingLeft: 4 }}>{w.say}</div> : null}
            </Rise>
          </Sequence>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// The Practice Round ring (PracticeRound.jsx), draining over the drill beat.
const Ring: React.FC<{ call: string; left: number; frac: number; size: number }> = ({ call, left, frac, size }) => {
  const r = 112, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox="0 0 250 250" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="125" cy="125" r={r} fill="none" stroke="rgba(168,85,247,0.2)" strokeWidth="12" />
        <circle cx="125" cy="125" r={r} fill="none" stroke={P.violet} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * frac} style={{ filter: 'drop-shadow(0 0 8px rgba(168,85,247,0.9))' }} />
        <circle cx="125" cy="125" r="94" fill="none" stroke="rgba(242,190,69,0.5)" strokeWidth="1.5" strokeDasharray="3 7" />
      </svg>
      <AbsoluteFill style={{ borderRadius: '50%', background: 'rgba(10,7,22,0.7)', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontFamily: F.num, fontWeight: 900, fontSize: call.length > 10 ? size * 0.1 : size * 0.13, color: P.gold, letterSpacing: '0.04em', textAlign: 'center', maxWidth: size * 0.8, lineHeight: 1.1, textShadow: `0 0 18px ${P.gold}99` }}>{call}</span>
        <span style={{ fontFamily: F.num, fontWeight: 900, fontSize: size * 0.15 }}>0:{String(Math.max(0, Math.ceil(left))).padStart(2, '0')}</span>
      </AbsoluteFill>
    </div>
  );
};

const Drill: React.FC<{ p: PracticeTutorialProps }> = ({ p }) => {
  const frame = useCurrentFrame();
  const sec = BEATS.drill / FPS;
  const calls = p.drill.calls.length ? p.drill.calls : [p.technique.toUpperCase()];
  const per = BEATS.drill / calls.length;
  const i = Math.min(calls.length - 1, Math.floor(frame / per));
  const nextCall = calls[(i + 1) % calls.length];
  return (
    <AbsoluteFill>
      <Footage src={p.src} start={p.drill.start} />
      <TopBar p={p} step={3} right={<Chip size={20} color={P.gold}>{p.drill.label ?? 'DRILL · 20 SLOW · 20 FAST'}</Chip>} />
      <div style={{ position: 'absolute', left: 50, right: 140, bottom: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
        <Sequence from={i * per} layout="none" key={i}>
          <Rise>
            <Ring call={calls[i]} left={sec - frame / FPS} frac={frame / BEATS.drill} size={440} />
          </Rise>
        </Sequence>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: F.body, fontWeight: 500, fontSize: 30, color: P.muted }}>
          NEXT <span style={{ fontFamily: F.head, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>{nextCall}</span>
        </div>
        {p.drill.cue ? (
          <div style={{ padding: '20px 30px', borderRadius: 20, background: 'rgba(15,11,31,0.95)', border: `2px solid ${P.violetLine}`, fontFamily: F.body, fontWeight: 500, fontSize: 32, color: P.soft, textAlign: 'center' }}>
            Cue: <span style={{ color: P.gold, fontWeight: 600 }}>{p.drill.cue}</span>
          </div>
        ) : null}
      </div>
      <Bell ring="single" volume={0.6} />
      <Sequence from={BEATS.drill - 20} layout="none">
        <Bell ring="triple" volume={0.6} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Next: React.FC<{ p: PracticeTutorialProps }> = ({ p }) => {
  const n = p.next;
  return (
    <AbsoluteFill style={{ background: P.ground }}>
      <Footage src={p.src} start={p.drill.start} dim={0.72} grade="cold" />
      <AbsoluteFill style={{ background: 'radial-gradient(110% 50% at 50% 0%, rgba(27,15,58,0.85) 0%, rgba(7,6,12,0.6) 62%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 136, display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: P.lilac }}>PRACTICE MODE · {p.discipline.toUpperCase()}</div>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 140, top: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <Rise style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '34px 40px', borderRadius: 34, background: P.card, border: `3px solid ${P.gold}CC`, boxShadow: `0 0 44px ${P.gold}55` }}>
            <Tile mark={tileMark(p)} size={128} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 46, letterSpacing: '0.08em', lineHeight: 1 }}>{p.technique.toUpperCase()}</div>
              <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 28, color: P.muted }}>{Math.min(3, p.cues.length)} key points · 1 to watch for</div>
            </div>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 56, color: P.green, flexShrink: 0 }}>✓</span>
          </div>
        </Rise>
        {n ? (
          <>
            <Rise delay={8} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke={P.lilac} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></svg>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 26, letterSpacing: '0.2em', color: P.lilac }}>NEXT UP</div>
            </Rise>
            <Rise delay={14} style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '34px 40px', borderRadius: 34, background: P.deep, border: `3px solid ${P.violetLine}`, boxShadow: '0 0 48px rgba(168,85,247,0.35)' }}>
                <Tile mark={n.number ?? n.name.split(/[\s-]+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase()} size={128} color={P.violet} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 46, letterSpacing: '0.08em', lineHeight: 1 }}>{n.name.toUpperCase()}</div>
                  {n.description ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 28, color: P.muted }}>{n.description}</div> : null}
                </div>
                {n.level ? <Chip color={LEVEL[n.level] ?? P.gold} size={20}>{n.level.toUpperCase()}</Chip> : null}
              </div>
            </Rise>
          </>
        ) : null}
      </div>
      <div style={{ position: 'absolute', left: 60, right: 140, bottom: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <Rise delay={20}>
          <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 34, color: P.soft, textAlign: 'center', lineHeight: 1.3 }}>Every move in the app ends in a Practice Round:<br />the coach calls what you just learned.</div>
        </Rise>
        <Rise delay={26} style={{ width: '100%' }}>
          <div style={{ height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1A1204', background: `linear-gradient(180deg, ${P.goldHi} 0%, ${P.gold} 50%, ${P.goldLo} 100%)`, clipPath: 'polygon(28px 0, 100% 0, 100% calc(100% - 28px), calc(100% - 28px) 100%, 0 100%, 0 28px)', fontFamily: F.head, fontWeight: 700, fontSize: 38, letterSpacing: '0.18em', boxShadow: `0 0 50px ${P.gold}66` }}>
            {p.cta ?? 'OPEN PRACTICE MODE'}
          </div>
        </Rise>
        <Rise delay={30}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 24, letterSpacing: '0.16em', color: P.muted }}>LINK IN BIO · COMMENT TRAIN</div>
        </Rise>
      </div>
    </AbsoluteFill>
  );
};

export const PracticeTutorial: React.FC<PracticeTutorialProps> = (p) => {
  const tl = tutorialTimeline(p);
  const pose = usePose(p.pose);
  return (
    <AbsoluteFill style={{ background: P.ground, color: P.text, fontFamily: F.body }}>
      <Sequence from={tl.hook.from} durationInFrames={tl.hook.len}><Hook p={p} /></Sequence>
      <Sequence from={tl.name.from} durationInFrames={tl.name.len}><Name p={p} /></Sequence>
      {tl.cues.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.len}><CueBeat p={p} cue={p.cues[i]} i={i} pose={pose} /></Sequence>
      ))}
      <Sequence from={tl.watch.from} durationInFrames={tl.watch.len}><Watch p={p} pose={pose} /></Sequence>
      <Sequence from={tl.drill.from} durationInFrames={tl.drill.len}><Drill p={p} /></Sequence>
      <Sequence from={tl.next.from} durationInFrames={tl.next.len}><Next p={p} /></Sequence>
      <Progress />
    </AbsoluteFill>
  );
};
