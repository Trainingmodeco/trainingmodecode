import React, { useEffect, useState } from 'react';
import { CC } from '../CodecStyles';

export default function DecodeScreen({ rawText, onComplete, onBack }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('scanning');

  useEffect(() => {
    const steps = [
      { p: 20, ph: 'scanning', delay: 400 },
      { p: 50, ph: 'detecting', delay: 600 },
      { p: 75, ph: 'parsing', delay: 500 },
      { p: 95, ph: 'structuring', delay: 400 },
      { p: 100, ph: 'complete', delay: 300 },
    ];

    let timeout;
    let i = 0;

    function next() {
      if (i >= steps.length) {
        timeout = setTimeout(onComplete, 400);
        return;
      }
      setProgress(steps[i].p);
      setPhase(steps[i].ph);
      timeout = setTimeout(() => { i++; next(); }, steps[i].delay);
    }

    next();
    return () => clearTimeout(timeout);
  }, [onComplete]);

  const phaseLabels = {
    scanning: 'SCANNING INPUT DATA...',
    detecting: 'DETECTING EXERCISE PATTERNS...',
    parsing: 'PARSING WORKOUT STRUCTURE...',
    structuring: 'STRUCTURING MISSION BLOCKS...',
    complete: 'DECODE COMPLETE',
  };

  const lines = rawText.split('\n').filter(l => l.trim()).slice(0, 8);

  return (
    <div className="no-scrollbar" style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 0 20px',
      minHeight: '100dvh',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      gap: 28,
    }}>
      {/* Decode Animation */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(168,85,247,0.15)" strokeWidth="6"/>
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke={progress === 100 ? CC.gold : CC.neon}
            strokeWidth="6"
            strokeDasharray={`${2 * Math.PI * 52}`}
            strokeDashoffset={`${2 * Math.PI * 52 * (1 - progress / 100)}`}
            strokeLinecap="round"
            className="codec-timer-ring"
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: "'Orbitron', sans-serif",
            fontWeight: 900,
            fontSize: 22,
            color: progress === 100 ? CC.gold : CC.text,
          }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Phase Label */}
      <div style={{ textAlign: 'center' }}>
        <p className="anim-codec-blink" style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 11,
          color: progress === 100 ? CC.gold : CC.neon,
          letterSpacing: '0.1em',
          fontWeight: 700,
        }}>
          {phaseLabels[phase]}
        </p>
      </div>

      {/* Raw Text Preview */}
      {lines.length > 0 && (
        <div className="codec-panel" style={{
          width: '100%',
          maxWidth: 360,
          padding: '16px 18px',
          maxHeight: 180,
          overflow: 'hidden',
        }}>
          <p style={{
            fontFamily: "'Orbitron', sans-serif",
            fontSize: 9,
            color: CC.muted,
            letterSpacing: '0.1em',
            marginBottom: 10,
          }}>
            RAW SIGNAL
          </p>
          {lines.map((line, i) => (
            <p key={i} style={{
              fontSize: 13,
              color: i < Math.ceil(lines.length * progress / 100) ? CC.text : 'rgba(167,139,184,0.3)',
              fontFamily: "'Rajdhani', monospace",
              lineHeight: 1.6,
              transition: 'color 0.3s ease',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {line}
            </p>
          ))}
        </div>
      )}

      {/* Back Button */}
      <button onClick={onBack} style={{
        background: 'none',
        border: 'none',
        color: CC.muted,
        fontSize: 12,
        fontFamily: "'Orbitron', sans-serif",
        cursor: 'pointer',
        marginTop: 12,
      }}>
        CANCEL
      </button>
    </div>
  );
}
