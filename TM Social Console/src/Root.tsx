import { Composition } from 'remotion';
import { FPS, HEIGHT, loadBrandFonts, WIDTH } from './brand';
import { BOSS_INTRO_FRAMES, BossIntro, type BossIntroProps } from './compositions/BossIntro';
import { FootageShort, footageFrames, type FootageShortProps } from './compositions/FootageShort';
import { ScriptShort, scriptTimeline, type ScriptShortProps } from './compositions/ScriptShort';
import { END_CARD_FRAMES } from './parts/EndCard';

loadBrandFonts();

// Studio defaults only; real posts pass their props from queue/*.json.
const scriptDefaults: ScriptShortProps = {
  kicker: 'Fight Mode',
  boss: 'Fight Focus',
  hook: 'Shadowboxing alone? Get a *coach* in your ear.',
  beats: [
    '*Fight Focus*: voice-coached rounds on a real fight timer.',
    'The *bell* starts the round. The coach calls the work.',
    'Rest between rounds. Then *go again*.',
  ],
  cta: 'Link in bio',
  art: 'tm/drops/shoto/arcade.webp',
  artBeats: [0],
  goldBeats: [2],
};

const bossDefaults: BossIntroProps = { stage: 'Stage 3', title: 'Leg Day', boss: '100 Squats' };

const footageDefaults: FootageShortProps = {
  video: 'sample/footage.mp4',
  durationSec: 6,
  captions: [],
  kicker: 'Fight Mode',
  boss: 'Heavy bag',
  title: 'Round *one*',
  cta: 'Link in bio',
};

export const Root: React.FC = () => (
  <>
    <Composition
      id="ScriptShort"
      component={ScriptShort}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={300}
      defaultProps={scriptDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: scriptTimeline(props).total })}
    />
    <Composition id="BossIntro" component={BossIntro} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={BOSS_INTRO_FRAMES} defaultProps={bossDefaults} />
    <Composition
      id="FootageShort"
      component={FootageShort}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={300}
      defaultProps={footageDefaults}
      calculateMetadata={({ props }) => ({ durationInFrames: footageFrames(props) + END_CARD_FRAMES })}
    />
  </>
);
