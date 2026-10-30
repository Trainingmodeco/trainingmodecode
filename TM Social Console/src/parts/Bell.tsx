import { Audio, interpolate, staticFile } from 'remotion';

// The app's boxing bell file holds three signals; each ring is trimmed out of
// it by frame (30 fps): single at 0.1s, double at 9.3s, triple at 17.8s.
const RINGS = {
  single: { from: 3, frames: 66 },
  double: { from: 279, frames: 72 },
  triple: { from: 535, frames: 80 },
} as const;

// The last half second fades out so the cut never clicks.
export const Bell: React.FC<{ ring?: keyof typeof RINGS; volume?: number }> = ({ ring = 'single', volume = 0.7 }) => {
  const { from, frames } = RINGS[ring];
  return (
    <Audio
      src={staticFile('tm/audio/bell-signals.mp3')}
      trimBefore={from}
      durationInFrames={frames}
      volume={(f) => interpolate(f, [0, frames - 15, frames - 1], [volume, volume, 0], { extrapolateRight: 'clamp' })}
    />
  );
};
