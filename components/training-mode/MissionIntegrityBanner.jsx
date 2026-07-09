import { C } from './Styles';
import { Shield, TriangleAlert as AlertTriangle, Clock, Trophy, RotateCcw, Hop as Home } from 'lucide-react';

const GOLD = C.yellow;

function getBannerConfig(integrityResult) {
  const { validityStatus, isFullyValid } = integrityResult;
  if (isFullyValid) {
    return {
      icon: <Trophy size={32} color={GOLD} />,
      title: 'MISSION COMPLETE',
      subtitle: 'All rounds verified',
      color: GOLD,
      bgGlow: 'rgba(253,224,71,0.15)',
      borderColor: 'rgba(253,224,71,0.4)',
    };
  }
  switch (validityStatus) {
    case 'partial':
      return {
        icon: <Shield size={32} color="#4f8cff" />,
        title: 'PARTIAL COMPLETION',
        subtitle: 'Valid rounds counted toward XP',
        color: '#4f8cff',
        bgGlow: 'rgba(79,140,255,0.1)',
        borderColor: 'rgba(79,140,255,0.3)',
      };
    case 'tooFast':
      return {
        icon: <AlertTriangle size={32} color="#f59e0b" />,
        title: 'TOO FAST TO VERIFY',
        subtitle: 'Rounds completed below minimum time',
        color: '#f59e0b',
        bgGlow: 'rgba(245,158,11,0.1)',
        borderColor: 'rgba(245,158,11,0.3)',
      };
    case 'expired':
    case 'idleTimeout':
      return {
        icon: <Clock size={32} color="#ef4444" />,
        title: 'SESSION EXPIRED',
        subtitle: 'Session exceeded time limit or was idle',
        color: '#ef4444',
        bgGlow: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
      };
    case 'suspicious':
      return {
        icon: <AlertTriangle size={32} color="#ef4444" />,
        title: 'MISSION VALIDATION FAILED',
        subtitle: 'Unverified completion detected',
        color: '#ef4444',
        bgGlow: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
      };
    default:
      return {
        icon: <AlertTriangle size={32} color={C.muted} />,
        title: 'INCOMPLETE',
        subtitle: 'Mission was not finished',
        color: C.muted,
        bgGlow: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.15)',
      };
  }
}

export default function MissionIntegrityBanner({ integrityResult, xpAwarded, onRetry, onHome }) {
  if (!integrityResult) return null;

  const { validCompletedUnits, totalRequiredUnits, partialCompletionRatio, awardXp, leaderboardEligible } = integrityResult;
  const banner = getBannerConfig(integrityResult);

  return (
    <div style={{
      width: '100%', maxWidth: 360, borderRadius: 14,
      background: `linear-gradient(135deg, rgba(10,0,20,0.9), ${banner.bgGlow})`,
      border: `1px solid ${banner.borderColor}`,
      padding: '20px 18px', marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${banner.color}15`, border: `1px solid ${banner.color}44`,
        }}>
          {banner.icon}
        </div>
        <div>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13,
            color: banner.color, letterSpacing: '0.1em',
          }}>{banner.title}</div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
            color: C.muted, marginTop: 2,
          }}>{banner.subtitle}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 10, marginBottom: 14,
        padding: '10px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, color: banner.color }}>
            {validCompletedUnits}/{totalRequiredUnits}
          </div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.1em', marginTop: 3 }}>
            VALID ROUNDS
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, color: awardXp ? GOLD : C.muted }}>
            {awardXp ? `+${xpAwarded || 0}` : '0'}
          </div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.1em', marginTop: 3 }}>
            XP EARNED
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 16, color: leaderboardEligible ? '#22c55e' : C.muted }}>
            {leaderboardEligible ? 'YES' : 'NO'}
          </div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.1em', marginTop: 3 }}>
            LEADERBOARD
          </div>
        </div>
      </div>

      {/* Completion bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.muted, letterSpacing: '0.1em' }}>
            COMPLETION
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: banner.color, letterSpacing: '0.1em' }}>
            {Math.round(partialCompletionRatio * 100)}%
          </span>
        </div>
        <div style={{
          width: '100%', height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(partialCompletionRatio * 100, 100)}%`,
            height: '100%', borderRadius: 3,
            background: `linear-gradient(90deg, ${banner.color}, ${banner.color}aa)`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Leaderboard note for partial */}
      {!leaderboardEligible && awardXp && (
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 11, fontWeight: 500,
          color: C.muted, textAlign: 'center', marginBottom: 12,
          fontStyle: 'italic',
        }}>
          No leaderboard credit unless fully completed
        </div>
      )}

      {/* No XP message */}
      {!awardXp && (
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
          color: '#f59e0b', textAlign: 'center', marginBottom: 12,
          padding: '8px 12px', borderRadius: 6,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        }}>
          No XP Awarded
        </div>
      )}

      {/* Action buttons */}
      {(onRetry || onHome) && (
        <div style={{ display: 'flex', gap: 10 }}>
          {onRetry && (
            <button onClick={onRetry} style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: `${banner.color}15`, border: `1px solid ${banner.color}44`,
              color: banner.color, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
              fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
            }}>
              <RotateCcw size={12} /> RETRY
            </button>
          )}
          {onHome && (
            <button onClick={onHome} style={{
              flex: 1, padding: '10px 0', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
              color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
              fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer',
            }}>
              <Home size={12} /> RETURN
            </button>
          )}
        </div>
      )}
    </div>
  );
}
