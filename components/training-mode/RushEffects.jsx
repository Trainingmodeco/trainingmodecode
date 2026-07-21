import { useState, useEffect, useMemo } from 'react';

const RUSH_STYLES = `
@keyframes rush-overlay-in {
  0%   { opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; pointer-events: none; }
}
@keyframes rush-title-slam {
  0%   { transform: scale(2.2) translateY(10px); opacity: 0; filter: blur(8px); }
  40%  { transform: scale(1.05) translateY(0); opacity: 1; filter: blur(0); }
  55%  { transform: scale(1.0); }
  100% { transform: scale(1.0); opacity: 1; }
}
@keyframes rush-subtitle-in {
  0%   { opacity: 0; transform: translateY(8px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes rush-flash {
  0%   { opacity: 0.7; }
  30%  { opacity: 0; }
  100% { opacity: 0; }
}
@keyframes rush-screen-shake {
  0%,100% { transform: translate(0,0); }
  15% { transform: translate(-2px, 1px); }
  30% { transform: translate(2px, -1px); }
  45% { transform: translate(-1px, 2px); }
  60% { transform: translate(1px, -1px); }
  75% { transform: translate(-1px, 0px); }
}
@keyframes rush-ember-rise {
  0%   { transform: translateY(0) scale(0.8); opacity: 0; }
  15%  { opacity: 1; }
  100% { transform: translateY(-120vh) scale(1.3); opacity: 0; }
}
@keyframes rush-spark-drift {
  0%   { transform: translate(0, 0) scale(0.5); opacity: 0; }
  10%  { opacity: 1; }
  100% { transform: translate(40px, -80vh) scale(0.3); opacity: 0; }
}
@keyframes rush-heat-streak {
  0%   { opacity: 0; transform: translateY(0) scaleY(0.5); }
  20%  { opacity: 0.6; transform: translateY(-10px) scaleY(1); }
  100% { opacity: 0; transform: translateY(-60px) scaleY(1.5); }
}
@keyframes rush-edge-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.7; }
}
@keyframes rush-ring-aura {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.04); }
}
@keyframes rush-glow-burst {
  0%   { opacity: 0; transform: scale(0.9); }
  30%  { opacity: 0.6; }
  100% { opacity: 0; transform: scale(1.2); }
}
@keyframes rush-flicker {
  0%, 40%, 60%, 100% { opacity: 0; }
  45% { opacity: 0.15; }
  55% { opacity: 0.1; }
}
`;

const EMBER_COUNT = 8;
const SPARK_COUNT = 6;

function RushEmbers({ intenseFinal }) {
  const embers = useMemo(() => Array.from(
    { length: intenseFinal ? EMBER_COUNT + 4 : EMBER_COUNT },
    () => ({
      left: `${8 + Math.random() * 84}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2.5 + Math.random() * 2}s`,
      size: 3 + Math.random() * 4,
      color: Math.random() > 0.5 ? '#ff6b00' : '#fde047',
    })
  ), [intenseFinal]);

  const sparks = useMemo(() => Array.from(
    { length: intenseFinal ? SPARK_COUNT + 3 : SPARK_COUNT },
    () => ({
      left: `${10 + Math.random() * 80}%`,
      bottom: `${Math.random() * 30}%`,
      delay: `${Math.random() * 4}s`,
      duration: `${3 + Math.random() * 2.5}s`,
    })
  ), [intenseFinal]);

  return (
    <div className="rush-embers" style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', overflow: 'hidden' }}>
      {embers.map((e, i) => (
        <div key={`e${i}`} style={{
          position: 'absolute',
          bottom: '-10px',
          left: e.left,
          width: e.size,
          height: e.size,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${e.color} 0%, rgba(255,107,0,0.6) 60%, transparent 100%)`,
          boxShadow: `0 0 ${e.size + 2}px ${e.color}`,
          animation: `rush-ember-rise ${e.duration} ${e.delay} linear infinite`,
        }} />
      ))}
      {sparks.map((s, i) => (
        <div key={`s${i}`} style={{
          position: 'absolute',
          bottom: s.bottom,
          left: s.left,
          width: 2,
          height: 2,
          borderRadius: '50%',
          background: '#ffd27a',
          boxShadow: '0 0 4px #ffd27a',
          animation: `rush-spark-drift ${s.duration} ${s.delay} linear infinite`,
        }} />
      ))}
    </div>
  );
}

function RushHeatStreaks() {
  const streaks = Array.from({ length: 4 }, (_, i) => ({
    left: `${20 + i * 18}%`,
    delay: `${i * 0.7}s`,
  }));

  return (
    <div className="rush-heat-streaks" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
      {streaks.map((s, i) => (
        <div key={i} style={{
          position: 'absolute',
          bottom: '35%',
          left: s.left,
          width: 2,
          height: 30,
          borderRadius: 2,
          background: 'linear-gradient(to top, rgba(255,107,0,0.5), transparent)',
          animation: `rush-heat-streak 2s ${s.delay} ease-out infinite`,
        }} />
      ))}
    </div>
  );
}

function RushEdgeGlow({ intenseFinal }) {
  return (
    <div className="rush-active-aura" style={{
      position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
      boxShadow: intenseFinal
        ? 'inset 0 0 60px rgba(239,68,68,0.25), inset 0 0 120px rgba(255,107,0,0.12)'
        : 'inset 0 0 40px rgba(255,107,0,0.15), inset 0 0 80px rgba(239,68,68,0.06)',
      animation: 'rush-edge-pulse 2s ease-in-out infinite',
      borderRadius: 'inherit',
    }} />
  );
}

function RushFlicker() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 3, pointerEvents: 'none',
      background: 'rgba(255,107,0,0.04)',
      animation: 'rush-flicker 3s steps(1) infinite',
    }} />
  );
}

export function RushTimerAura({ intenseFinal }) {
  return (
    <div className="rush-ring-aura" style={{
      position: 'absolute', inset: intenseFinal ? -12 : -8,
      borderRadius: '50%',
      background: intenseFinal
        ? 'radial-gradient(circle, rgba(239,68,68,0.2) 40%, rgba(255,107,0,0.12) 65%, transparent 80%)'
        : 'radial-gradient(circle, rgba(255,107,0,0.12) 40%, rgba(239,68,68,0.06) 65%, transparent 80%)',
      animation: `rush-ring-aura ${intenseFinal ? '1.2s' : '2.5s'} ease-in-out infinite`,
      pointerEvents: 'none',
    }} />
  );
}

export function RushGlowBurst({ intenseFinal }) {
  if (!intenseFinal) return null;
  return (
    <div style={{
      position: 'absolute', inset: -20,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(239,68,68,0.15) 30%, transparent 70%)',
      animation: 'rush-glow-burst 3s ease-out infinite',
      pointerEvents: 'none',
    }} />
  );
}

export function RushOverlay({ onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="rush-overlay" style={{
      position: 'absolute', inset: 0, zIndex: 150,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
      animation: 'rush-overlay-in 1.3s ease-out forwards',
    }}>
      {/* Dark backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,0,0,0.88)' }} />

      {/* Flash */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(circle at center, rgba(255,140,0,0.4) 0%, transparent 60%)',
        animation: 'rush-flash 0.6s ease-out forwards',
      }} />

      {/* Centered content wrapper */}
      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%', maxWidth: 'calc(100% - 32px)',
        margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        animation: 'rush-screen-shake 0.4s ease-out',
      }}>
        {/* Title */}
        <div className="rush-title" style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 900,
          // Sized so "RUSH MODE" fits one line on a phone without overflowing
          // the frame (was clamp(48,18vw,72) which spilled off narrow screens).
          fontSize: 'clamp(28px, 10.5vw, 48px)',
          letterSpacing: '0.08em',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          padding: '8px 0',
          background: 'linear-gradient(135deg, #ef4444 0%, #ff6b00 35%, #fde047 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 24px rgba(255,255,255,0.9)) drop-shadow(0 0 48px rgba(255,107,0,0.7)) drop-shadow(0 4px 0 rgba(200,50,0,0.4))',
          animation: 'rush-title-slam 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        }}>
          RUSH MODE
        </div>

        {/* Subtitle */}
        <div className="rush-subtitle" style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 600,
          fontSize: 14,
          color: 'rgba(255,240,200,0.9)',
          letterSpacing: '0.06em',
          marginTop: 12,
          textShadow: '0 0 12px rgba(255,200,100,0.5)',
          textAlign: 'center',
          maxWidth: '85%',
          animation: 'rush-subtitle-in 0.5s 0.3s ease-out both',
        }}>
          Strike with everything you have — speed and power.
        </div>
      </div>
    </div>
  );
}

export function RushPersistentEffects({ active, remaining }) {
  if (!active) return null;

  const intenseFinal = remaining <= 10;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RUSH_STYLES }} />
      <RushEmbers intenseFinal={intenseFinal} />
      <RushHeatStreaks />
      <RushEdgeGlow intenseFinal={intenseFinal} />
      <RushFlicker />
    </>
  );
}
