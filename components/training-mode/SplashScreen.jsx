import { useState, useEffect } from 'react';

function Blink({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 300); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)',
        animation: 'rgb-split 0.15s ease-out forwards',
      }}/>
      <div style={{
        position: 'absolute', inset: 0,
        background: '#000000',
        animation: 'blackout-fade 0.15s ease-out 0.1s forwards',
      }}/>
    </div>
  );
}

// Matches design 24a (Hero Enter — the splash) exactly.
const splashCSS = `
@keyframes spark-rise {
  0%   { transform: translateY(0) translateX(0) scale(0.7); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translateY(-92vh) translateX(var(--drift)) scale(1.3); opacity: 0; }
}
@keyframes tapGlow {
  0%, 100% { opacity: 0.5;  text-shadow: 0 0 6px rgba(201,166,255,0.3); }
  50%      { opacity: 1;    text-shadow: 0 0 16px rgba(201,166,255,0.7); }
}
`;

function FireSparks() {
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    left: `${8 + Math.random() * 84}%`,
    size: 3 + Math.random() * 2,
    duration: 3.0 + Math.random() * 1.5,
    delay: Math.random() * 1.6,
    drift: `${(Math.random() - 0.5) * 26}px`,
    color: i % 2 === 0 ? '#ff8a3a' : '#ffd27a',
  }));

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }}>
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 0, left: s.left,
          width: s.size, height: s.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
          boxShadow: `0 0 8px #ff6b00`,
          '--drift': s.drift,
          animation: `spark-rise ${s.duration}s ease-in ${s.delay}s infinite`,
          opacity: 0,
        }}/>
      ))}
    </div>
  );
}

function CornerBrackets() {
  const style = { position: 'absolute', width: 22, height: 22, zIndex: 5 };
  const border = '2px solid #b06aff';
  return (
    <>
      <div style={{ ...style, top: 20, left: 20, borderTop: border, borderLeft: border }}/>
      <div style={{ ...style, top: 20, right: 20, borderTop: border, borderRight: border }}/>
      <div style={{ ...style, bottom: 22, left: 20, borderBottom: border, borderLeft: border }}/>
      <div style={{ ...style, bottom: 22, right: 20, borderBottom: border, borderRight: border }}/>
    </>
  );
}

export default function SplashScreen({ onStart }) {
  const [barPhase, setBarPhase] = useState('idle');
  const [fillPct, setFillPct] = useState(0);
  const [blink, setBlink] = useState(false);

  const handleTap = () => {
    if (barPhase !== 'idle') return;
    setBarPhase('loading');
  };

  useEffect(() => {
    if (barPhase !== 'loading') return;
    const DURATION = 1350;
    const TICK = 15;
    const STEP = (TICK / DURATION) * 100;
    const id = setInterval(() => {
      setFillPct(p => {
        const next = p + STEP;
        if (next >= 100) {
          clearInterval(id);
          setBarPhase('done');
          setBlink(true);
          return 100;
        }
        return next;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [barPhase]);

  return (
    <div
      onClick={handleTap}
      style={{
        position: 'relative', width: '100%', maxWidth: 440,
        minHeight: '100dvh', margin: '0 auto',
        overflow: 'hidden', cursor: barPhase === 'idle' ? 'pointer' : 'default',
        background: '#08010f',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: splashCSS }}/>

      {/* Hero background */}
      <img
        src="/static/hero-enter.webp"
        alt=""
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 20%', zIndex: 0,
        }}
      />
      {/* Dark gradient overlay (24a) */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(180deg, rgba(8,1,15,0.45) 0%, rgba(8,1,15,0.3) 30%, rgba(8,1,15,0.45) 55%, rgba(8,1,15,0.72) 78%, rgba(8,1,15,0.95) 100%)',
      }}/>

      <FireSparks/>
      <CornerBrackets/>

      {/* Content — single centered column (24a) */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', minHeight: '100dvh',
        padding: '0 30px 30px', textAlign: 'center',
      }}>
        {/* System tagline */}
        <div style={{ font: "700 12px 'Orbitron',sans-serif", color: '#f5b301', letterSpacing: '0.16em', lineHeight: 1.4, textShadow: '0 0 12px rgba(245,179,1,0.5)', marginBottom: 16 }}>
          TACTICAL COMBAT<br/>FITNESS SYSTEM
        </div>

        {/* Logo mark */}
        <img src="/static/logo-mark.png" alt="" style={{ width: 70, height: 'auto', marginBottom: 14, filter: 'drop-shadow(0 0 18px rgba(245,179,1,0.6))' }}/>

        {/* Wordmark */}
        <div style={{ font: "900 46px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.02em', lineHeight: 0.98, textShadow: '0 0 24px rgba(168,85,247,0.55)', marginBottom: 20 }}>
          TRAINING<br/>MODE
        </div>

        {/* Disciplines */}
        <div style={{ font: "700 10px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.14em', lineHeight: 1.5, marginBottom: 20 }}>
          BOXING &middot; KICKBOXING<br/>MUAY THAI &middot; MMA
        </div>

        {/* Train like a fighter */}
        <div style={{ font: "900 18px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.05em', marginBottom: 22, textShadow: '0 0 16px rgba(168,85,247,0.6)' }}>
          TRAIN LIKE A FIGHTER
        </div>

        {/* Tap anywhere to enter (24a) — plain lavender, subtle glow in/out */}
        {barPhase === 'idle' ? (
          <div style={{ font: "700 11px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.2em', marginBottom: 20, animation: 'tapGlow 2.6s ease-in-out infinite' }}>
            TAP ANYWHERE TO ENTER
          </div>
        ) : (
          <div style={{ width: '100%', maxWidth: 280, marginBottom: 20 }}>
            <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'rgba(20,0,40,0.85)', border: '1px solid rgba(168,85,247,0.5)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 999, width: `${fillPct}%`, background: 'linear-gradient(90deg, #5b21b6, #a855f7, #c084fc)', boxShadow: '0 0 14px rgba(168,85,247,0.9)', transition: 'width 0.02s linear' }}/>
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ width: '100%', maxWidth: 280, height: 2, background: 'linear-gradient(90deg,transparent,#b06aff,transparent)', marginBottom: 16 }}/>

        {/* Train · Fight · Win */}
        <div style={{ font: "800 11px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.24em' }}>
          TRAIN &middot; FIGHT &middot; WIN
        </div>
      </div>

      {blink && <Blink onDone={onStart}/>}
    </div>
  );
}
