import { useState } from 'react';
import SafeImage from '../../SafeImage';

// The RUSTY look (retention, switch `power`): a fighter a month away from
// training, covered in dust and rust. Until the owner's art arrives, the
// athlete's own tier portrait (data/tiers tierImage) stands in: greyed and
// rust-toned by a filter, with a dust and rust layer over it. Nothing else
// on the screen changes (the level, name and XP stay as they are).
//
// The owner's art, when it lands (docs/retention/ART-RUSTY-REVIVE.md):
//   /static/retention/rusty-{male,female}.webp   the fighter covered in dust and rust
//   /static/retention/revive-{male,female}.webp  the fighter wiping it off
// FinalArt shows that file when it loads, and the stand-in when it is missing:
// never a broken image.

export const RUSTY_FILTER = 'grayscale(0.85) sepia(0.45) brightness(0.7) contrast(1.12)';

export const retentionArt = (kind, sex) => {
  const s = String(sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  return `/static/retention/${kind}-${s}.webp`;
};

// Noise (SVG feTurbulence) kept only where it is brightest, in one colour:
// fine specks of dust, soft clouds of dust, and patches of rust.
const noise = (w, h, freq, octaves, seed, rgb, a, b) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>`
    + `<filter id='d' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='${octaves}' seed='${seed}'/>`
    + `<feColorMatrix values='0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  ${a} 0 0 0 ${b}'/></filter>`
    + "<rect width='100%' height='100%' filter='url(#d)'/></svg>";
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
const SPECKS = noise(180, 180, 0.8, 2, 7, [0.86, 0.80, 0.70], 13, -9.0);
const CLOUDS = noise(300, 500, 0.012, 3, 9, [0.80, 0.72, 0.60], 2.4, -1.1);
const RUST = noise(300, 500, 0.018, 3, 21, [0.66, 0.32, 0.12], 3.2, -1.7);

// The dust and rust layer over a portrait. Its box must be position: relative.
// Put any label that sits on the portrait after it, so it stays on top.
// The specks tile; the clouds and the rust stretch over the whole portrait
// (one tile, so no seam).
export function RustyOverlay({ style }) {
  const layer = { position: 'absolute', inset: 0 };
  return (
    <span aria-hidden data-retention="rusty-look" style={{ ...layer, pointerEvents: 'none', overflow: 'hidden', ...style }}>
      <span style={{ ...layer, backgroundImage: SPECKS, backgroundSize: '180px 180px', opacity: 0.55 }}/>
      <span style={{ ...layer, backgroundImage: CLOUDS, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', opacity: 0.3 }}/>
      <span style={{ ...layer, backgroundImage: RUST, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', opacity: 0.85, mixBlendMode: 'color' }}/>
      <span style={{ ...layer, background: 'linear-gradient(180deg, rgba(214,200,172,.12) 0%, rgba(60,40,24,.25) 100%)' }}/>
    </span>
  );
}

// A tier portrait, rusty or not. `imgStyle` is the image's own style; the
// filter is added to it when rusty.
export function RustyPortraitImage({ src, rusty = false, imgStyle, loading }) {
  return (
    <>
      <SafeImage src={src} alt="" loading={loading} style={rusty ? { ...imgStyle, filter: RUSTY_FILTER } : imgStyle}/>
      {rusty && <RustyOverlay/>}
    </>
  );
}

// The owner's art if the file is there, else the stand-in (any element, laid
// out to fill the same box). While the file loads the stand-in shows; once it
// loads the art takes its place, so a transparent file never shows the
// stand-in through it.
export function FinalArt({ src, standIn, style }) {
  const [art, setArt] = useState('pending');
  return (
    <>
      {art !== 'ok' && standIn}
      {art !== 'missing' && (
        <SafeImage
          src={src} alt="" loading="eager" preferWebp={false}
          onLoaded={() => setArt('ok')} onFail={() => setArt('missing')}
          style={{ ...style, opacity: art === 'ok' ? 1 : 0, transition: 'opacity .25s ease' }}
        />
      )}
    </>
  );
}
