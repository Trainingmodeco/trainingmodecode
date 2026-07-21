import { C } from './Styles';
import { Shield, TriangleAlert as AlertTriangle, Clock, Trophy, RotateCcw, Hop as Home } from 'lucide-react';

const GOLD = C.yellow;

function getBannerConfig(integrityResult) {
  const { validityStatus, isFullyValid } = integrityResult;
  if (isFullyValid) {
    return {
      icon: <Trophy size={18} color={GOLD} />,
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
        icon: <Shield size={18} color="#4f8cff" />,
        title: 'PARTIAL COMPLETION',
        subtitle: 'Valid rounds counted toward XP',
        color: '#4f8cff',
        bgGlow: 'rgba(79,140,255,0.1)',
        borderColor: 'rgba(79,140,255,0.3)',
      };
    case 'tooFast':
      return {
        icon: <AlertTriangle size={18} color="#f59e0b" />,
        title: 'TOO FAST TO VERIFY',
        subtitle: 'Rounds completed below minimum time',
        color: '#f59e0b',
        bgGlow: 'rgba(245,158,11,0.1)',
        borderColor: 'rgba(245,158,11,0.3)',
      };
    case 'expired':
    case 'idleTimeout':
      return {
        icon: <Clock size={18} color="#ef4444" />,
        title: 'SESSION EXPIRED',
        subtitle: 'Session exceeded time limit or was idle',
        color: '#ef4444',
        bgGlow: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
      };
    case 'suspicious':
      return {
        icon: <AlertTriangle size={18} color="#ef4444" />,
        title: 'MISSION VALIDATION FAILED',
        subtitle: 'Unverified completion detected',
        color: '#ef4444',
        bgGlow: 'rgba(239,68,68,0.1)',
        borderColor: 'rgba(239,68,68,0.3)',
      };
    default:
      return {
        icon: <AlertTriangle size={18} color={C.muted} />,
        title: 'INCOMPLETE',
        subtitle: 'Mission was not finished',
        color: C.muted,
        bgGlow: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.15)',
      };
  }
}

export default function MissionIntegrityBanner({ integrityResult, onRetry, onHome }) {
  if (!integrityResult) return null;

  const { validCompletedUnits, totalRequiredUnits, partialCompletionRatio, awardXp, leaderboardEligible, validityStatus } = integrityResult;
  const banner = getBannerConfig(integrityResult);

  // Collapse to a single clean line for everything benign — a verified win OR
  // just stopping early — so GOOD EFFORT reads as calm as MISSION COMPLETE.
  // The full forensic breakdown only shows for real anti-cheat flags, where the
  // numbers actually explain a withheld/blocked result.
  const forensic = ['tooFast', 'suspicious', 'expired', 'idleTimeout'].includes(validityStatus);
  if (!forensic && !onRetry && !onHome) {
    return (
      <div style={{
        width: '100%', maxWidth: 360, borderRadius: 10,
        background: `linear-gradient(135deg, rgba(10,0,20,0.9), ${banner.bgGlow})`,
        border: `1px solid ${banner.borderColor}`,
        padding: '8px 12px', marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'flex', flexShrink: 0 }}>{banner.icon}</span>
        <span style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10.5,
          color: banner.color, letterSpacing: '0.09em',
        }}>{banner.title}</span>
        <span style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 10, fontWeight: 600,
          color: C.muted, marginLeft: 'auto', textAlign: 'right',
        }}>{banner.subtitle}</span>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', maxWidth: 360, borderRadius: 12,
      background: `linear-gradient(135deg, rgba(10,0,20,0.9), ${banner.bgGlow})`,
      border: `1px solid ${banner.borderColor}`,
      padding: '11px 13px', marginBottom: 8,
    }}>
      {/* Header — icon sits inline (LT-5); the old 38px icon tile was pure
          height on a screen that has to fit in one viewport. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span style={{ display: 'flex', flexShrink: 0 }}>{banner.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11.5,
            color: banner.color, letterSpacing: '0.09em',
          }}>{banner.title}</div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: 10.5, fontWeight: 500,
            color: C.muted, marginTop: 1,
          }}>{banner.subtitle}</div>
        </div>
      </div>

      {/* Stats + completion, merged into one block (LT-5). XP lives in the big
          card below this banner, so it isn't repeated here. */}
      <div style={{
        marginBottom: 8, padding: '7px 10px 8px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 7 }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: banner.color }}>
              {validCompletedUnits}/{totalRequiredUnits}
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5.5, color: C.muted, letterSpacing: '0.1em', marginTop: 2 }}>
              VALID ROUNDS
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: banner.color }}>
              {Math.round(partialCompletionRatio * 100)}%
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5.5, color: C.muted, letterSpacing: '0.1em', marginTop: 2 }}>
              COMPLETION
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: leaderboardEligible ? '#22c55e' : C.muted }}>
              {leaderboardEligible ? 'YES' : 'NO'}
            </div>
            <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 5.5, color: C.muted, letterSpacing: '0.1em', marginTop: 2 }}>
              LEADERBOARD
            </div>
          </div>
        </div>
        <div style={{
          width: '100%', height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(partialCompletionRatio * 100, 100)}%`,
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${banner.color}, ${banner.color}aa)`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Leaderboard note for partial */}
      {!leaderboardEligible && awardXp && (
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 10.5, fontWeight: 500,
          color: C.muted, textAlign: 'center', marginBottom: 8,
          fontStyle: 'italic',
        }}>
          No leaderboard credit unless fully completed
        </div>
      )}

      {/* No XP message */}
      {!awardXp && (
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: 11.5, fontWeight: 600,
          color: '#f59e0b', textAlign: 'center', marginBottom: 8,
          padding: '6px 12px', borderRadius: 6,
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
