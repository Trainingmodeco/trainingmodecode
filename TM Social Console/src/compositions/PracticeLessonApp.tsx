import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS } from '../brand';
import { CUE_LEAD, Chip, F, LEVEL, Marker, P, Rise, SLOW, Tile, at, bodyCentre, markPoint, tileMark, usePose, type Cue, type PracticeTutorialProps } from './PracticeTutorial';

// The in-app cut of a Practice tutorial: 16:9 (1920×1080) for the lesson
// card's player (PracticeMode.jsx DetailCard, which is 16:9 and only ~390 px
// wide on a phone), so the type is big and the chrome is light. No hook, no
// drill, no end card: the card around the player already names the move, lists
// the key points and offers START PRACTICE ROUND. 23 s: NAME 2 s, three KEY
// POINTS 5 s each in slow motion with the marker, WATCH FOR 6 s.
// A horizontal clip fills the frame with a translucent panel on the right; a
// vertical clip sits on the left at 3:4 (no blow-up) beside a solid panel.
// Same props as PracticeTutorial, plus `srcSize` (the clip's pixel size).
export type PracticeLessonAppProps = PracticeTutorialProps & { srcSize?: [number, number] };

export const APP_BEATS = { name: 60, cue: 150, watch: 180 };
const W = 1920, H = 1080;
const PANEL_SPLIT = 1110; // the panel beside a vertical clip
const PANEL_OVER = 760; // the panel over a horizontal clip
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export function lessonTimeline(p: PracticeLessonAppProps) {
  const n = Math.max(1, Math.min(3, p.cues.length));
  const name = { from: 0, len: APP_BEATS.name };
  const cues = Array.from({ length: n }, (_, i) => ({ from: name.len + i * APP_BEATS.cue, len: APP_BEATS.cue }));
  const watch = { from: name.len + n * APP_BEATS.cue, len: APP_BEATS.watch };
  return { name, cues, watch, total: watch.from + watch.len };
}

type Size = { w: number; h: number };
type Cam = { s: number; tx: number; ty: number };
// Cover the view with the clip at zoom k, centred on c (fractions), inside the clip.
const camera = (k: number, c: [number, number], view: Size, src: Size): Cam => {
  const s = Math.max(view.w / src.w, view.h / src.h) * k;
  return {
    s,
    tx: Math.min(0, Math.max(view.w - s * src.w, view.w / 2 - s * c[0] * src.w)),
    ty: Math.min(0, Math.max(view.h - s * src.h, view.h / 2 - s * c[1] * src.h)),
  };
};
const toView = (cam: Cam, p: [number, number], src: Size) => ({ x: cam.tx + cam.s * p[0] * src.w, y: cam.ty + cam.s * p[1] * src.h });

const Clip: React.FC<{ src: string; start: number; rate?: number; cam: Cam; srcSize: Size; freeze?: boolean; cold?: boolean }> = ({ src, start, rate = 1, cam, srcSize, freeze, cold }) => {
  const video = (
    <OffthreadVideo
      src={staticFile(src)}
      muted
      trimBefore={Math.round(start * FPS)}
      playbackRate={rate}
      style={{ position: 'absolute', left: 0, top: 0, width: srcSize.w, height: srcSize.h, transformOrigin: '0 0', transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.s})`, filter: cold ? 'saturate(0.7) brightness(0.8)' : 'saturate(0.95) contrast(1.05)' }}
    />
  );
  return freeze ? <Freeze frame={0}>{video}</Freeze> : video;
};

const Segments: React.FC<{ step: number; n: number }> = ({ step, n }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {Array.from({ length: n }, (_, i) => (
      <span key={i} style={{ width: 96, height: 12, borderRadius: 6, background: i <= step ? P.gold : 'rgba(255,255,255,0.18)', boxShadow: i === step ? `0 0 16px ${P.gold}` : 'none', opacity: i < step ? 0.75 : 1 }} />
    ))}
  </div>
);

const Head: React.FC<{ p: PracticeLessonAppProps; small?: boolean }> = ({ p, small }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
    <Tile mark={tileMark(p)} size={small ? 84 : 110} glow={false} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: small ? 40 : 52, letterSpacing: '0.08em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.technique.toUpperCase()}</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Chip size={17} color="#fff" line="rgba(255,255,255,0.4)">{p.discipline.toUpperCase()}</Chip>
        {p.badge ? <Chip size={17}>{p.badge.toUpperCase()}</Chip> : null}
        {p.level ? <Chip size={17} color={LEVEL[p.level] ?? P.gold}>{p.level.toUpperCase()}</Chip> : null}
      </div>
    </div>
  </div>
);

export const PracticeLessonApp: React.FC<PracticeLessonAppProps> = (p) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tl = lessonTimeline(p);
  const pose = usePose(p.pose);
  const srcSize: Size = { w: p.srcSize?.[0] ?? 1080, h: p.srcSize?.[1] ?? 1920 };
  const split = srcSize.w < srcSize.h;
  const view: Size = split ? { w: W - PANEL_SPLIT, h: H } : { w: W, h: H };
  const panelW = split ? PANEL_SPLIT : PANEL_OVER;
  const n = tl.cues.length;

  // Which beat we are in, and that beat's clip, camera and marker.
  type Beat = { kind: 'name' | 'cue' | 'watch'; i: number; local: number };
  const beat: Beat =
    frame < tl.name.len ? { kind: 'name', i: 0, local: frame }
    : frame < tl.watch.from ? { kind: 'cue', i: Math.floor((frame - tl.name.len) / APP_BEATS.cue), local: (frame - tl.name.len) % APP_BEATS.cue }
    : { kind: 'watch', i: 0, local: frame - tl.watch.from };

  let clip: React.ReactNode = null;
  let mark: { x: number; y: number; color: string } | null = null;
  let landed = false;
  let seqFrom = 0; // where the marker's and the text's pop-in start, in composition frames
  const zoomOf = (z?: number) => z ?? p.zoom ?? 1.3;

  if (beat.kind === 'name') {
    const cam = camera(1, p.focus ?? bodyCentre(pose, p.repAt + beat.local / fps), view, srcSize);
    clip = <Clip src={p.src} start={p.repAt} cam={cam} srcSize={srcSize} />;
  } else if (beat.kind === 'cue') {
    const cue: Cue = p.cues[beat.i];
    const lead = CUE_LEAD + 0.3;
    const start = Math.max(0, cue.at - lead);
    const t = start + (beat.local / fps) * SLOW;
    const landAt = Math.round(((cue.at - start) / SLOW) * fps);
    landed = beat.local >= landAt;
    seqFrom = tl.cues[beat.i].from + landAt;
    const m = cue.point ?? (cue.mark ? markPoint(at(pose, t), cue.mark, p.stance ?? 'orthodox') : null);
    // The view is tighter than a phone's, so frame between the body and the marked point.
    const body = bodyCentre(pose, t);
    const auto: [number, number] = m ? [(body[0] + m[0]) / 2, (body[1] + m[1]) / 2] : body;
    const cam = camera(zoomOf(cue.zoom), cue.focus ?? p.focus ?? auto, view, srcSize);
    if (m && landed) mark = { ...toView(cam, m, srcSize), color: P.gold };
    clip = <Clip src={p.slowSrc ?? p.src} start={start} rate={SLOW} cam={cam} srcSize={srcSize} />;
  } else {
    const w = p.watch;
    const FREEZE = 90;
    const fixing = beat.local >= FREEZE;
    seqFrom = tl.watch.from;
    const fixStart = Math.max(0, w.fixAt ?? w.at - 0.6);
    const t = fixing ? fixStart + ((beat.local - FREEZE) / fps) * 0.5 : w.at;
    const cam = camera(zoomOf(w.zoom), w.focus ?? p.focus ?? bodyCentre(pose, t), view, srcSize);
    const m = w.point ?? (w.mark ? markPoint(at(pose, w.at), w.mark, p.stance ?? 'orthodox') : null);
    if (m && !fixing) mark = { ...toView(cam, m, srcSize), color: P.red };
    clip = fixing
      ? <Sequence from={FREEZE} layout="none"><Clip src={p.slowSrc ?? p.src} start={fixStart} rate={0.5} cam={cam} srcSize={srcSize} /></Sequence>
      : <Clip src={p.src} start={w.at} cam={cam} srcSize={srcSize} freeze cold />;
  }

  const fixing = beat.kind === 'watch' && beat.local >= 90;
  const redIn = beat.kind === 'watch' && !fixing ? interpolate(beat.local, [0, 8], [0, 1], clamp) : 0;

  return (
    <AbsoluteFill style={{ background: P.ground, color: P.text, fontFamily: F.body }}>
      {/* the clip */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: view.w, height: view.h, overflow: 'hidden', background: '#000' }}>
        {clip}
        {redIn ? <AbsoluteFill style={{ boxShadow: 'inset 0 0 160px rgba(239,68,68,0.55)', opacity: redIn }} /> : null}
        {mark ? (
          <Sequence from={seqFrom} layout="none">
            <Marker x={mark.x} y={mark.y} color={mark.color} size={split ? 120 : 150} />
          </Sequence>
        ) : null}
        {!split ? <AbsoluteFill style={{ background: `linear-gradient(90deg, rgba(7,6,12,0) ${W - panelW - 200}px, rgba(7,6,12,0.86) ${W - panelW + 60}px)` }} /> : null}
      </div>

      {/* the panel */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: panelW, height: H, boxSizing: 'border-box', padding: '64px 70px 60px', display: 'flex', flexDirection: 'column', gap: 30, background: split ? `linear-gradient(180deg, #1B0F3A 0%, ${P.ground} 70%)` : 'transparent', borderLeft: split ? `2px solid ${P.violetLine}` : 'none' }}>
        {beat.kind === 'name' ? (
          <>
            <Rise><Tile mark={tileMark(p)} size={170} /></Rise>
            <Rise delay={5}>
              <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 74, letterSpacing: '0.08em', lineHeight: 1.05 }}>{p.technique.toUpperCase()}</div>
            </Rise>
            {p.description ? <Rise delay={9}><div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 40, color: P.soft, lineHeight: 1.25 }}>{p.description}</div></Rise> : null}
            <Rise delay={13} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Chip size={20} color="#fff" line="rgba(255,255,255,0.4)">{p.discipline.toUpperCase()}</Chip>
              {p.badge ? <Chip size={20}>{p.badge.toUpperCase()}</Chip> : null}
              {p.level ? <Chip size={20} color={LEVEL[p.level] ?? P.gold}>{p.level.toUpperCase()}</Chip> : null}
            </Rise>
            <div style={{ flexGrow: 1 }} />
            <Rise delay={18}><div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, letterSpacing: '0.2em', color: P.lilac }}>STEP-BY-STEP · {n} KEY POINTS</div></Rise>
          </>
        ) : beat.kind === 'cue' ? (
          <>
            <Head p={p} small />
            <div style={{ flexGrow: 1 }} />
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, letterSpacing: '0.2em', color: P.lilac }}>KEY POINT {beat.i + 1} OF {n}</div>
            <div style={{ minHeight: 330, display: 'flex', flexDirection: 'column', gap: 22 }}>
              {landed ? (
                <Sequence from={seqFrom} layout="none">
                  <Rise>
                    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
                      <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 80, color: P.gold, lineHeight: 1, flexShrink: 0 }}>{beat.i + 1}</span>
                      <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 72, lineHeight: 1.1 }}>{p.cues[beat.i].text}</span>
                    </div>
                    {p.cues[beat.i].say ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 36, color: P.soft, marginTop: 22, lineHeight: 1.25 }}>{p.cues[beat.i].say}</div> : null}
                  </Rise>
                </Sequence>
              ) : (
                <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 40, color: P.muted }}>Watch the move…</div>
              )}
            </div>
            <Segments step={beat.i} n={n} />
          </>
        ) : (
          <>
            <Head p={p} small />
            <div style={{ flexGrow: 1 }} />
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, letterSpacing: '0.2em', color: P.redSoft }}>WATCH FOR</div>
            <div style={{ minHeight: 330, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Rise>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '26px 32px', borderRadius: 24, background: 'rgba(26,10,18,0.95)', border: `3px solid ${P.red}BB`, opacity: fixing ? 0.5 : 1 }}>
                  <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 56, color: P.red, flexShrink: 0 }}>✕</span>
                  <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 52, lineHeight: 1.1 }}>{p.watch.text}</span>
                </div>
              </Rise>
              {fixing ? (
                <Sequence from={tl.watch.from + 90} layout="none">
                  <Rise>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '26px 32px', borderRadius: 24, background: 'rgba(8,24,14,0.95)', border: `3px solid ${P.green}BB`, boxShadow: `0 0 36px ${P.green}44` }}>
                      <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 52, color: P.green, flexShrink: 0 }}>✓</span>
                      <span style={{ fontFamily: F.body, fontWeight: 600, fontSize: 52, lineHeight: 1.1 }}>{p.watch.fix}</span>
                    </div>
                    {p.watch.say ? <div style={{ fontFamily: F.body, fontWeight: 500, fontSize: 36, color: P.soft, marginTop: 18, lineHeight: 1.25 }}>{p.watch.say}</div> : null}
                  </Rise>
                </Sequence>
              ) : null}
            </div>
            <Segments step={n} n={n} />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
