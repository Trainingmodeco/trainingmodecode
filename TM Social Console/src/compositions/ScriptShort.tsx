import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { C, FPS } from '../brand';
import { ArtLayer, Backdrop, type Broll, FootageLayer } from '../parts/Backdrop';
import { Bell } from '../parts/Bell';
import { END_CARD_FRAMES, EndCard } from '../parts/EndCard';
import { Hud, Slash } from '../parts/Hud';
import { KineticText, plain } from '../parts/KineticText';

// A motion-graphic short made from a script: the hook, then one beat per
// card, then STAGE CLEAR and the sign-off. Scenes can run the owner's footage
// behind the words (`broll`), or app art, or the plain arcade stage.
export type ScriptShortProps = {
  kicker: string; // top-left label, e.g. "FIGHT MODE"
  boss: string; // HP bar label, e.g. "FIGHT FOCUS"
  hook: string; // first card; *stars* mark gold words
  beats: string[]; // one card each
  cta: string; // end-card button, e.g. "LINK IN BIO"
  url?: string; // defaults to the app address
  art?: string | null; // public/ path, e.g. "tm/drops/shoto/arcade.webp"
  artBeats?: number[]; // scenes (0 = hook) that show the art
  goldBeats?: number[]; // scenes that flip to the gold background
  voiceover?: string | null; // public/ path to a voiceover track
  // Footage per scene (0 = hook), e.g. { src: "raw-footage/bag.mp4", start: 2, rate: 0.75 }.
  // null leaves that scene on art / the arcade stage. tools/render.mjs stages raw-footage files.
  broll?: (Broll | null)[];
};

// Reading time: about 2.7 words a second plus a beat to land, within limits.
export function sceneFrames(text: string, first: boolean) {
  const words = plain(text).split(/\s+/).filter(Boolean).length;
  return Math.max(first ? 75 : 60, Math.min(165, Math.round((words / 2.7) * FPS) + 24));
}

export function scriptTimeline(p: ScriptShortProps) {
  let from = 0;
  const scenes = [p.hook, ...p.beats].map((text, i) => {
    const len = sceneFrames(text, i === 0);
    const s = { text, from, len, index: i };
    from += len;
    return s;
  });
  return { scenes, endFrom: from, total: from + END_CARD_FRAMES };
}

const Scene: React.FC<{ text: string; first: boolean; gold: boolean; art?: string | null; broll?: Broll | null }> = ({
  text,
  first,
  gold,
  art,
  broll,
}) => (
  <Backdrop tone={gold ? 'gold' : 'dark'}>
    {broll ? <FootageLayer {...broll} tone={gold ? 'gold' : 'dark'} /> : art && !gold ? <ArtLayer src={art} /> : null}
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 120 }}>
      <KineticText
        text={text}
        face={first ? 'display' : 'body'}
        max={first ? 112 : 128}
        color={gold ? C.bg : C.text}
        hot={C.gold}
        hotChip={gold ? C.bg : undefined}
        stagger={first ? 4 : 3}
        // The hook is already landing on frame 0: that frame is the autoplay preview.
        delay={first ? -10 : 0}
        shadow={!!broll && !gold}
      />
    </AbsoluteFill>
  </Backdrop>
);

export const ScriptShort: React.FC<ScriptShortProps> = (p) => {
  const frame = useCurrentFrame();
  const { scenes, endFrom } = scriptTimeline(p);
  const current = scenes.findIndex((s) => frame >= s.from && frame < s.from + s.len);
  const artBeats = p.artBeats ?? [0];
  const goldBeats = p.goldBeats ?? [];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {scenes.map((s) => (
        <Sequence key={s.index} from={s.from} durationInFrames={s.len}>
          <Scene
            text={s.text}
            first={s.index === 0}
            gold={goldBeats.includes(s.index)}
            art={artBeats.includes(s.index) ? p.art : null}
            broll={p.broll?.[s.index] ?? null}
          />
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={endFrom}>
        <Hud
          kicker={p.kicker}
          boss={p.boss}
          counter={current >= 0 ? `${String(current + 1).padStart(2, '0')}/${String(scenes.length).padStart(2, '0')}` : undefined}
          progress={frame / endFrom}
          dark={current >= 0 && goldBeats.includes(current)}
        />
      </Sequence>
      <Bell ring="single" volume={0.55} />
      {scenes.slice(1).map((s) => (
        <Sequence key={`cut-${s.index}`} from={s.from - 5} durationInFrames={11}>
          <Slash />
        </Sequence>
      ))}
      <Sequence from={endFrom - 5} durationInFrames={11}>
        <Slash />
      </Sequence>
      <Sequence from={endFrom}>
        <EndCard cta={p.cta} url={p.url} />
      </Sequence>
      {p.voiceover ? <Audio src={staticFile(p.voiceover)} /> : null}
    </AbsoluteFill>
  );
};
