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

const splashCSS = `
@keyframes spark-rise {
  0%   { transform: translateY(0) translateX(0) scale(0.7); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translateY(-92vh) translateX(var(--drift)) scale(1.3); opacity: 0; }
}
@keyframes glow-pulse-cta {
  0%, 100% { opacity: 0.55; text-shadow: 0 0 8px rgba(168,85,247,0.4); }
  50%      { opacity: 1;    text-shadow: 0 0 18px rgba(168,85,247,0.8), 0 0 36px rgba(168,85,247,0.3); }
}
`;

function FireSparks() {
  const sparks = Array.from({ length: 8 }, (_, i) => ({
    left: `${12 + Math.random() * 76}%`,
    size: 3 + Math.random() * 2,
    duration: 3.5 + Math.random() * 2.5,
    delay: Math.random() * 4,
    drift: `${(Math.random() - 0.5) * 30}px`,
    color: i % 3 === 0 ? '#fde047' : i % 3 === 1 ? '#ff8a4a' : '#f59e0b',
  }));

  return (
    <>
      {sparks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 0, left: s.left, zIndex: 3,
          width: s.size, height: s.size, borderRadius: '50%',
          background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
          boxShadow: `0 0 6px ${s.color}`,
          '--drift': s.drift,
          animation: `spark-rise ${s.duration}s linear ${s.delay}s infinite`,
          opacity: 0,
        }}/>
      ))}
    </>
  );
}

function CornerBrackets() {
  const style = { position: 'absolute', width: 22, height: 22, zIndex: 5 };
  const border = '2px solid #b06aff';
  return (
    <>
      <div style={{ ...style, top: 18, left: 18, borderTop: border, borderLeft: border }}/>
      <div style={{ ...style, top: 18, right: 18, borderTop: border, borderRight: border }}/>
      <div style={{ ...style, bottom: 18, left: 18, borderBottom: border, borderLeft: border }}/>
      <div style={{ ...style, bottom: 18, right: 18, borderBottom: border, borderRight: border }}/>
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
        background: '#080012',
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
      {/* Dark gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to bottom, rgba(8,0,18,0.45) 0%, rgba(8,0,18,0.12) 30%, rgba(8,0,18,0.12) 55%, rgba(8,0,18,0.95) 100%)',
      }}/>

      {/* Sparks */}
      <FireSparks/>

      {/* Corner brackets */}
      <CornerBrackets/>

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        minHeight: '100dvh', padding: '22dvh 28px 36px',
      }}>

        {/* Center stack */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          {/* Tactical subtitle */}
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
            color: '#fde047', letterSpacing: '0.2em', textAlign: 'center',
            textShadow: '0 0 12px rgba(253,224,71,0.5)', marginBottom: 16,
          }}>
            TACTICAL COMBAT FITNESS SYSTEM
          </div>

          {/* Logo mark */}
          <img
            src="/static/logo-mark.png"
            alt=""
            style={{ width: 70, height: 70, objectFit: 'contain', marginBottom: 18 }}
          />

          {/* TRAINING MODE */}
          <h1 style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 'clamp(2.2rem, 10vw, 2.9rem)',
            color: '#ffffff', textAlign: 'center', letterSpacing: '0.08em',
            lineHeight: 1.05, margin: 0,
            textShadow: '0 0 24px rgba(168,85,247,0.5), 0 0 60px rgba(168,85,247,0.2), 0 2px 0 rgba(0,0,0,0.7)',
          }}>
            TRAINING<br/>MODE
          </h1>

          {/* Disciplines */}
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
            color: '#b06aff', letterSpacing: '0.15em', textAlign: 'center',
            marginTop: 16, lineHeight: 1.9,
          }}>
            BOXING &middot; KICKBOXING<br/>MUAY THAI &middot; MMA
          </div>
        </div>

        {/* Bottom section */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {/* Train like a fighter */}
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 'clamp(0.9rem, 4vw, 1.1rem)',
            color: '#fff', letterSpacing: '0.12em', textAlign: 'center',
            textShadow: '0 0 18px rgba(255,255,255,0.5), 0 0 36px rgba(168,85,247,0.3)',
          }}>
            TRAIN LIKE A FIGHTER
          </div>

          {/* TAP ANYWHERE TO ENTER */}
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
            color: '#b06aff', letterSpacing: '0.2em', textAlign: 'center',
            animation: barPhase === 'idle' ? 'glow-pulse-cta 2.6s ease-in-out infinite' : 'none',
            opacity: barPhase !== 'idle' ? 0 : undefined,
            transition: 'opacity 0.3s',
          }}>
            TAP ANYWHERE TO ENTER
          </div>

          {/* Loading bar */}
          {barPhase !== 'idle' && (
            <div style={{ width: '100%' }}>
              <div style={{
                width: '100%', height: 4, borderRadius: 999,
                background: 'rgba(20,0,40,0.85)',
                border: '1px solid rgba(168,85,247,0.5)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 999,
                  width: `${fillPct}%`,
                  background: 'linear-gradient(90deg, #5b21b6, #a855f7, #c084fc)',
                  boxShadow: '0 0 14px rgba(168,85,247,0.9)',
                  transition: 'width 0.02s linear',
                }}/>
              </div>
            </div>
          )}

          {/* Violet divider */}
          <div style={{ width: 48, height: 1, background: 'rgba(168,85,247,0.5)' }}/>

          {/* TRAIN FIGHT WIN */}
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
            color: 'rgba(168,85,247,0.7)', letterSpacing: '0.35em', textAlign: 'center',
          }}>
            TRAIN &middot; FIGHT &middot; WIN
          </div>
        </div>
      </div>

      {blink && <Blink onDone={onStart}/>}
    </div>
  );
}
