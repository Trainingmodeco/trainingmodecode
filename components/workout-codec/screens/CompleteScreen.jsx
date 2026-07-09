import React from 'react';
import { CC } from '../CodecStyles';

export default function CompleteScreen({ summary, onStartAnother, onBackToFitMode }) {
  const formatTime = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

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
      {/* Trophy / Check */}
      <div className="anim-codec-check" style={{
        width: 88, height: 88,
        background: `linear-gradient(135deg, rgba(250,204,21,0.15) 0%, rgba(168,85,247,0.1) 100%)`,
        border: `2px solid ${CC.gold}`,
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 32px rgba(250,204,21,0.3), 0 0 64px rgba(250,204,21,0.1)`,
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={CC.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1 className="anim-codec-title" style={{
          fontFamily: "'Orbitron', sans-serif",
          fontWeight: 900,
          fontSize: 24,
          color: CC.gold,
          textShadow: `0 0 20px rgba(250,204,21,0.4)`,
          marginBottom: 6,
        }}>
          MISSION COMPLETE
        </h1>
        <p style={{
          fontFamily: "'Orbitron', sans-serif",
          fontSize: 10,
          color: CC.muted,
          letterSpacing: '0.1em',
        }}>
          WORKOUT CODEX MISSION FINISHED
        </p>
      </div>

      {/* Stats */}
      <div className="codec-panel" style={{
        padding: '20px 24px',
        width: '100%',
        maxWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <StatRow label="TOTAL EXERCISES" value={summary?.totalExercises || 0} />
        <StatRow label="COMPLETED" value={summary?.completedExercises || 0} />
        <StatRow label="TIME ELAPSED" value={formatTime(summary?.estimatedTime)} />
        {/* Future: XP placeholder */}
        <div style={{
          borderTop: '1px solid rgba(168,85,247,0.15)',
          paddingTop: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: CC.muted, fontFamily: "'Orbitron'", letterSpacing: '0.08em' }}>
            XP EARNED
          </span>
          <span style={{
            fontSize: 18, fontWeight: 700, color: CC.gold,
            fontFamily: "'Orbitron'",
          }}>
            +{((summary?.completedExercises || 0) * 25)} XP
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        gap: 12, width: '100%', maxWidth: 320,
      }}>
        <button
          className="codec-btn-gold"
          onClick={onStartAnother}
          style={{ width: '100%', fontSize: 13 }}
        >
          REPEAT MISSION
        </button>
        {onBackToFitMode && (
          <button
            className="codec-btn"
            onClick={onBackToFitMode}
            style={{ width: '100%', fontSize: 13 }}
          >
            BACK TO FIT MODE
          </button>
        )}
      </div>

      {/* Footer */}
      <p style={{
        fontFamily: "'Orbitron', sans-serif",
        fontSize: 9,
        color: 'rgba(167,139,184,0.4)',
        letterSpacing: '0.08em',
        marginTop: 12,
      }}>
        TRAINING MODE // WORKOUT CODEX
      </p>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{
        fontSize: 11, color: CC.muted,
        fontFamily: "'Orbitron', sans-serif",
        letterSpacing: '0.06em',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 16, fontWeight: 700, color: CC.text }}>
        {value}
      </span>
    </div>
  );
}
