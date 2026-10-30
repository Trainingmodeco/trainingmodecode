import type { Caption } from '@remotion/captions';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { useMemo } from 'react';
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, FONT, FPS } from '../brand';
import { END_CARD_FRAMES, EndCard } from '../parts/EndCard';
import { Hud, Slash } from '../parts/Hud';

// Your own footage with the Training Mode frame: HUD and boss bar on top,
// word-by-word captions from Whisper, a title card, and STAGE CLEAR at the end.
export type FootageShortProps = {
  video: string; // public/ path (tools/render.mjs copies raw footage in)
  durationSec: number; // length of the part of the clip to use
  trimStartSec?: number;
  captions: Caption[];
  kicker: string;
  boss: string;
  title: string; // card over the first two seconds; *stars* mark gold words
  cta: string;
  url?: string;
  volume?: number;
};

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

export const footageFrames = (p: FootageShortProps) => Math.max(1, Math.round(p.durationSec * FPS));

const TitleCard: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12 } });
  const out = interpolate(frame, [50, 60], [1, 0], clamp);
  const parts = title.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 900,
          fontSize: 92,
          lineHeight: 1.08,
          textAlign: 'center',
          textTransform: 'uppercase',
          color: C.text,
          background: 'rgba(8,0,18,0.78)',
          padding: '36px 50px',
          maxWidth: 940,
          borderLeft: `10px solid ${C.gold}`,
          transform: `scale(${0.6 + 0.4 * s})`,
          opacity: s,
        }}
      >
        {parts.map((p, i) =>
          p.startsWith('*') ? (
            <span key={i} style={{ color: C.gold }}>
              {p.slice(1, -1)}
            </span>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </div>
    </AbsoluteFill>
  );
};

// One caption page at a time; the word being spoken turns gold and pops.
const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = useMemo(() => createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds: 900 }), [captions]);
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs);
  if (!page) return null;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-start', paddingTop: 1180 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 34px', width: 940 }}>
        {page.tokens.map((t, i) => {
          const active = ms >= t.fromMs && ms < t.toMs;
          return (
            <span
              key={i}
              style={{
                fontFamily: FONT.body,
                fontWeight: 700,
                fontSize: 92,
                textTransform: 'uppercase',
                color: active ? C.gold : C.text,
                transform: `scale(${active ? 1.08 : 1})`,
                WebkitTextStroke: `10px ${C.bg}`,
                paintOrder: 'stroke fill',
                textShadow: active ? `0 0 30px ${C.gold}aa` : '0 6px 0 rgba(0,0,0,0.5)',
              }}
            >
              {t.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const FootageShort: React.FC<FootageShortProps> = (p) => {
  const frame = useCurrentFrame();
  const len = footageFrames(p);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Sequence from={0} durationInFrames={len}>
        <OffthreadVideo
          src={staticFile(p.video)}
          trimBefore={Math.round((p.trimStartSec ?? 0) * FPS)}
          volume={p.volume ?? 1}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(8,0,18,0.7) 0%, transparent 22%, transparent 70%, rgba(8,0,18,0.55) 100%)' }} />
        <Captions captions={p.captions} />
        <Hud kicker={p.kicker} boss={p.boss} progress={frame / len} />
      </Sequence>
      <Sequence from={0} durationInFrames={60}>
        <TitleCard title={p.title} />
      </Sequence>
      <Sequence from={len - 5} durationInFrames={11}>
        <Slash />
      </Sequence>
      <Sequence from={len} durationInFrames={END_CARD_FRAMES}>
        <EndCard cta={p.cta} url={p.url} />
      </Sequence>
    </AbsoluteFill>
  );
};
