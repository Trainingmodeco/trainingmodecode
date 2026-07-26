import { useMemo, useState, useEffect } from 'react';
import SafeImage from '../SafeImage';

// Training Arcade's own backdrop — previously every arcade screen reused
// FightRingBackdrop (the boxer-in-ring photo also used across Fight Mode),
// so Arcade never looked distinct from the rest of Fight Mode. This is a
// synthwave-grid arena floor + a scanline horizon + slow drifting pixel
// sparks — retro-arcade coded, purple/gold, no photo asset, sits behind the
// content (below zIndex 10) like FightRingBackdrop did.
const SPARK_COUNT = 10;

const ARCADE_BG_CSS = `
@keyframes arcade-grid-drift { 0% { background-position-y: 0; } 100% { background-position-y: 64px; } }
@keyframes arcade-horizon-pulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; } }
@keyframes arcade-spark-rise { 0% { transform: translateY(0); opacity: 0; } 12% { opacity: 1; } 100% { transform: translateY(-100vh); opacity: 0; } }
`;

function ArcadeSparks() {
  const sparks = useMemo(() => Array.from({ length: SPARK_COUNT }, () => ({
    left: `${4 + Math.random() * 92}%`,
    delay: `${Math.random() * 8}s`,
    duration: `${7 + Math.random() * 6}s`,
    size: 2 + Math.round(Math.random() * 2),
    gold: Math.random() > 0.5,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: '-6px', left: s.left,
          width: s.size, height: s.size,
          background: s.gold ? '#fde047' : '#c084fc',
          boxShadow: `0 0 6px 1px ${s.gold ? 'rgba(253,224,71,0.8)' : 'rgba(192,132,252,0.8)'}`,
          animation: `arcade-spark-rise ${s.duration} ${s.delay} linear infinite`,
        }}/>
      ))}
    </div>
  );
}

// `image` — an arena photo to sit behind everything (saga select and the stage
// ladder each get their own). `imageOpacity` dims it so the UI stays readable.
// When no image is given, or the file 404s, the CSS grid arena below shows
// through on its own, so the screen never ends up bare.
export default function ArcadeBackdrop({ opacity = 1, image, imageOpacity = 0.4 }) {
  // If the arena photo is missing (or fails to load) we fall straight back to
  // the drawn grid arena, so a not-yet-added asset never leaves a bare screen.
  const [photoOk, setPhotoOk] = useState(!!image);
  useEffect(() => { setPhotoOk(!!image); }, [image]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none', opacity }}>
      <style dangerouslySetInnerHTML={{ __html: ARCADE_BG_CSS }}/>
      {/* Deep arena base */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 8%, rgba(168,85,247,0.22) 0%, transparent 50%),' +
          'linear-gradient(180deg, #0a0316 0%, #0d0420 42%, #150626 68%, #0a0316 100%)',
      }}/>

      {image && photoOk && (
        // Photo arena: the drawn grid/horizon below would fight it, so while
        // the photo is up only the sparks stay layered over it. SafeImage
        // serves the ~60KB WebP and keeps the PNG as the fallback; if both
        // fail, onFail drops us back to the drawn grid.
        <SafeImage
          src={image} alt="" loading="eager" onFail={() => setPhotoOk(false)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center', opacity: imageOpacity,
          }}
        />
      )}

      {!photoOk && (
        <>
          {/* Perspective floor grid, fading toward a horizon glow */}
          <div style={{
            position: 'absolute', left: '-25%', right: '-25%', bottom: 0, height: '46%',
            backgroundImage:
              'linear-gradient(rgba(217,70,239,0.22) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgba(217,70,239,0.22) 1px, transparent 1px)',
            backgroundSize: '48px 32px',
            transform: 'perspective(220px) rotateX(58deg)',
            transformOrigin: 'bottom',
            animation: 'arcade-grid-drift 3.5s linear infinite',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          }}/>
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: '46%', height: 2,
            background: 'linear-gradient(90deg, transparent, #fde047, #d946ef, transparent)',
            boxShadow: '0 0 16px 2px rgba(217,70,239,0.6)',
            animation: 'arcade-horizon-pulse 3s ease-in-out infinite',
          }}/>
        </>
      )}

      {/* Sparks ride over the photo too — the FX stay either way. */}
      <ArcadeSparks/>
      {/* Scrim stays heavy under the header and the nav footer and opens up
          through the middle, so the arena reads without fighting the cards. */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,1,14,0.7) 0%, rgba(6,1,14,0.12) 30%, rgba(6,1,14,0.2) 62%, rgba(6,1,14,0.8) 100%)' }}/>
    </div>
  );
}
