import { useEffect, useRef } from 'react';
import { ARC, RETENTION_CSS } from './tokens';

// A row of stars (retention feature 2): `n` gold of `of`. With `land`, the gold
// ones slam in one by one, `step` seconds apart after `delay`, and `onLand(i)`
// runs as each lands (the clear screen plays its tone there). Reduced motion:
// they simply show.
export default function StarsRow({ n = 0, of = 3, size = 16, gap = 2, land = false, delay = 0, step = 0.45, onLand, label, color = ARC.star, glow = 'rgba(253,224,71,0.7)', style }) {
  const lit = Math.max(0, Math.min(of, Math.round(n || 0)));
  // The latest onLand, so a parent re-rendering (an XP count-up) does not
  // restart the timers.
  const landRef = useRef(onLand);
  landRef.current = onLand;
  useEffect(() => {
    if (!land) return undefined;
    // A star is "landed" at 45% of its slam, where it hits full size.
    const timers = Array.from({ length: lit }, (_, i) => setTimeout(() => landRef.current?.(i), (delay + i * step + 0.25) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [land, lit, delay, step]);
  return (
    <span role="img" aria-label={label || `${lit} of ${of} ${of === 1 ? 'star' : 'stars'}`} className="rt-anim" style={{ display: 'inline-flex', gap, lineHeight: 1, ...style }}>
      {land && <style dangerouslySetInnerHTML={{ __html: RETENTION_CSS }}/>}
      {Array.from({ length: of }, (_, i) => (
        <span key={i} aria-hidden style={{
          fontSize: size, lineHeight: 1, display: 'inline-block',
          color: i < lit ? color : ARC.starOff,
          textShadow: i < lit ? `0 0 10px ${glow}, 0 1px 3px rgba(0,0,0,0.9)` : '0 1px 3px rgba(0,0,0,0.6)',
          animation: land && i < lit ? `rt-slam .55s ${delay + i * step}s both` : 'none',
        }}>★</span>
      ))}
    </span>
  );
}
