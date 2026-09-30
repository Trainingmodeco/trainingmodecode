import { useCallback, useEffect, useRef, useState } from 'react';
import SafeImage from '../SafeImage';

// The XP verdict plate — a pixel-art XP GAINED / XP FAILED banner that pops
// dead centre for two and a half seconds, the amount set inside the plate's
// empty bottom panel. Long enough to read, short enough to keep the eyes on
// the session. Shared by the run player (chases, negative splits), the fight
// timers (rushes) and the camp complete screen (stage clear / fail).
//
//   const [flash, fire] = useVerdictFlash();
//   fire({ pass: true, xp: 10, banner: pickXpBanner('gain', { mode: 'fight' }) });
//   <XpVerdictPlate flash={flash} />
const mono = "'Orbitron',sans-serif";
export const VERDICT_FLASH_MS = 2500;

export function useVerdictFlash(ms = VERDICT_FLASH_MS) {
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const fire = useCallback((v) => {
    if (timer.current) clearTimeout(timer.current);
    setFlash(v || null);
    if (v) timer.current = setTimeout(() => setFlash(null), ms);
  }, [ms]);
  return [flash, fire];
}

export default function XpVerdictPlate({ flash }) {
  if (!flash || !flash.banner) return null;
  const { pass, xp, banner } = flash;
  return (
    <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ position: 'relative', width: 'min(56vw, 230px)', animation: 'tm-xp-pop 0.38s cubic-bezier(0.2,1.4,0.4,1)', filter: pass ? 'drop-shadow(0 0 22px rgba(124,58,237,0.55))' : 'drop-shadow(0 0 22px rgba(239,68,68,0.5))' }}>
        <SafeImage src={banner.src} alt={pass ? 'XP gained' : 'XP failed'} loading="eager" style={{ display: 'block', width: '100%', height: 'auto' }} />
        <div style={{
          position: 'absolute', left: `${(1 - banner.panel.w) * 50}%`, width: `${banner.panel.w * 100}%`,
          top: `${banner.panel.cy * 100}%`, transform: 'translateY(-50%)', textAlign: 'center',
          fontFamily: mono, fontWeight: 900, fontSize: 'clamp(15px, 5vw, 21px)', lineHeight: 1, letterSpacing: '0.04em',
          color: pass ? '#ffd84a' : '#ff3b3b',
          textShadow: pass ? '0 0 10px rgba(255,200,60,0.55), 0 2px 0 #7a4b00' : '0 0 10px rgba(255,60,60,0.6), 0 2px 0 #5a0000',
        }}>{pass ? '+' : '−'}{Math.abs(xp)} XP</div>
      </div>
      <style>{'@keyframes tm-xp-pop{0%{transform:scale(0.55);opacity:0}100%{transform:scale(1);opacity:1}}'}</style>
    </div>
  );
}
