import { useState, useEffect, useRef } from 'react';
import SafeImage from './SafeImage';
import { C } from './Styles';
import { ArcadePrimaryButton, ArcadeSecondaryButton } from './ArcadeUI';
import { RotateCcw, Play, Share2, ChevronLeft, Star } from 'lucide-react';

const OVERLAY_STYLES = `
@keyframes ov-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ov-slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ov-slam {
  0% { opacity: 0; transform: scale(2.5); }
  40% { opacity: 1; transform: scale(0.9); }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes ov-glow-pulse {
  0%, 100% { box-shadow: 0 0 40px rgba(34,197,94,0.2); }
  50% { box-shadow: 0 0 60px rgba(34,197,94,0.4); }
}
@keyframes ov-glow-pulse-red {
  0%, 100% { box-shadow: 0 0 40px rgba(239,68,68,0.2); }
  50% { box-shadow: 0 0 60px rgba(239,68,68,0.4); }
}
@keyframes ov-glow-pulse-violet {
  0%, 100% { box-shadow: 0 0 40px rgba(168,85,247,0.2); }
  50% { box-shadow: 0 0 60px rgba(168,85,247,0.4); }
}
@keyframes ov-count-tick {
  0% { transform: scale(1); }
  50% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
`;

function playTone(freq, duration, volume = 0.06) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function formatTime(seconds) {
  if (!seconds && seconds !== 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getRankStars(rank) {
  if (rank === 'S') return 5;
  if (rank === 'A') return 4;
  if (rank === 'B') return 3;
  if (rank === 'C') return 2;
  return 1;
}

// ─── STAGE CLEARED ───────────────────────────────────────────────────────────

function StageClearedScreen({
  series, stage, result, pointsEarned, xpEarned, statRewards,
  completedStageIds, onContinue, onNextStage, onReturnToArcade, onShare,
}) {
  const [phase, setPhase] = useState(0);
  const [displayXp, setDisplayXp] = useState(0);
  const [countDone, setCountDone] = useState(false);
  const animRef = useRef(null);
  const rank = result?.rank || null;
  const stages = series?.stages || [];
  const stageIdx = stages.findIndex(s => s.id === stage?.id);
  const nextStage = stageIdx >= 0 && stageIdx < stages.length - 1 ? stages[stageIdx + 1] : null;
  const nextStageNum = nextStage ? (nextStage.stageNumber || stageIdx + 2) : null;

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 150),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === 1) playTone(880, 0.3, 0.06);
  }, [phase]);

  useEffect(() => {
    if (phase < 3 || !xpEarned) return;
    const duration = 900;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayXp(Math.round(xpEarned * eased));
      if (p < 1) animRef.current = requestAnimationFrame(tick);
      else { setDisplayXp(xpEarned); setCountDone(true); playTone(1200, 0.3, 0.06); }
    }
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [phase, xpEarned]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, #030008 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, overflow: 'hidden',
      animation: 'ov-fade-in 0.3s ease-out',
    }}>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_STYLES }}/>

      {/* Green glow frame */}
      <div style={{
        position: 'absolute', inset: 10, borderRadius: 16,
        border: '1px solid rgba(34,197,94,0.25)', pointerEvents: 'none',
        animation: 'ov-glow-pulse 3s ease-in-out infinite',
      }}/>

      {/* Hero image */}
      {phase >= 1 && (
        <div style={{ animation: 'ov-slam 0.5s cubic-bezier(0.22,1,0.36,1) forwards', marginBottom: 12 }}>
          <SafeImage
            src="/static/arcade/stage-complete.webp"
            alt="Stage Cleared"
            style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>
      )}

      {/* Title */}
      {phase >= 1 && (
        <div style={{
          animation: 'ov-slide-up 0.4s ease-out forwards',
          fontFamily: "'Orbitron',sans-serif", fontSize: 28, fontWeight: 900,
          letterSpacing: '0.1em', color: '#22c55e', textAlign: 'center',
          textShadow: '0 0 20px rgba(34,197,94,0.5)',
          marginBottom: 4,
        }}>
          {stage?.isFinalRound ? 'BOSS DEFEATED' : 'STAGE CLEARED'}
        </div>
      )}

      {phase >= 2 && (
        <div style={{
          animation: 'ov-slide-up 0.3s ease-out forwards',
          fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
          color: C.muted, marginBottom: 16, textAlign: 'center',
        }}>
          {stage?.title?.toUpperCase() || 'COMPLETE'}
        </div>
      )}

      {/* Stats row */}
      {phase >= 2 && (
        <div style={{
          animation: 'ov-slide-up 0.3s ease-out forwards',
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '12px 20px', borderRadius: 12,
          background: 'rgba(34,197,94,0.04)',
          border: '1px solid rgba(34,197,94,0.2)',
          marginBottom: 16,
        }}>
          {/* Time */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 2 }}>YOUR TIME</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#fff' }}>
              {formatTime(result?.elapsedSeconds)}
            </div>
            {result?.newBest && (
              <div style={{ marginTop: 3, display: 'inline-block', padding: '1px 7px', borderRadius: 99, background: 'rgba(253,224,71,0.12)', border: '1px solid rgba(253,224,71,0.45)', fontFamily: "'Orbitron',sans-serif", fontSize: 6.5, fontWeight: 800, color: '#fde047', letterSpacing: '0.14em' }}>
                ★ NEW BEST
              </div>
            )}
          </div>

          <div style={{ width: 1, height: 28, background: 'rgba(34,197,94,0.2)' }}/>

          {/* XP */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 2 }}>XP EARNED</div>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#22c55e' }}>
              +{displayXp}
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: 'rgba(34,197,94,0.2)' }}/>

          {/* Stars — benchmark shows its rank; timed stages show the 3-star
              tier rating earned this run */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 2 }}>{rank ? 'RANK' : 'STARS'}</div>
            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              {rank
                ? Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={12} fill={i < getRankStars(rank) ? '#22c55e' : 'transparent'} color={i < getRankStars(rank) ? '#22c55e' : 'rgba(255,255,255,0.15)'} strokeWidth={1.5}/>
                  ))
                : Array.from({ length: 3 }, (_, i) => (
                    <Star key={i} size={13} fill={i < (result?.stars || 1) ? '#fde047' : 'transparent'} color={i < (result?.stars || 1) ? '#fde047' : 'rgba(255,255,255,0.18)'} strokeWidth={1.5}/>
                  ))}
            </div>
          </div>
        </div>
      )}

      {/* UP NEXT teaser */}
      {phase >= 3 && countDone && nextStage && (
        <div style={{
          animation: 'ov-slide-up 0.3s ease-out forwards',
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(253,224,71,0.04)',
          border: '1px solid rgba(253,224,71,0.2)',
          marginBottom: 18, width: '100%', maxWidth: 300,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
            border: '1.5px solid rgba(253,224,71,0.3)',
            background: 'rgba(10,0,20,0.8)',
          }}>
            <SafeImage
              src={`/static/stages/s${Math.min(nextStageNum, 10)}.webp`}
              alt={`Stage ${nextStageNum}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
              color: C.gold, letterSpacing: '0.12em', marginBottom: 2,
            }}>UP NEXT &middot; UNLOCKED</div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 900,
              color: '#fff', letterSpacing: '0.04em',
            }}>STAGE {nextStageNum} &middot; {nextStage.title}</div>
          </div>
        </div>
      )}

      {/* Buttons */}
      {phase >= 3 && countDone && (
        <div style={{ animation: 'ov-fade-in 0.4s ease-out', display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
          {nextStage && onNextStage && (
            <ArcadePrimaryButton onClick={onNextStage}>
              <Play size={15} fill="#0a0014" strokeWidth={0}/> START STAGE {nextStageNum}
            </ArcadePrimaryButton>
          )}
          {onShare && (
            <ArcadeSecondaryButton onClick={onShare}>
              <Share2 size={14}/> SHARE
            </ArcadeSecondaryButton>
          )}
          <button onClick={onReturnToArcade} style={{
            width: '100%', padding: '11px', borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.muted,
          }}>
            <ChevronLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }}/> Back to Arcade
          </button>
        </div>
      )}
    </div>
  );
}

// ─── MISSION FAILED ──────────────────────────────────────────────────────────

function MissionFailedScreen({ stage, result, onRetry, onReturnToArcade }) {
  const targetMinutes = stage?.scoringTiers?.[0]?.maxMinutes || null;
  const yourTime = result?.elapsedSeconds || 0;
  const targetSeconds = targetMinutes ? targetMinutes * 60 : null;
  const missedBy = targetSeconds ? Math.max(0, yourTime - targetSeconds) : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.06) 0%, #030008 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, overflow: 'hidden',
      animation: 'ov-fade-in 0.3s ease-out',
    }}>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_STYLES }}/>

      {/* Red glow frame */}
      <div style={{
        position: 'absolute', inset: 10, borderRadius: 16,
        border: '1px solid rgba(239,68,68,0.2)', pointerEvents: 'none',
        animation: 'ov-glow-pulse-red 3s ease-in-out infinite',
      }}/>

      {/* Hero image */}
      <SafeImage
        src="/static/arcade/mission-failure.webp"
        alt="Mission Failed"
        style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto 16px' }}
      />

      {/* Title */}
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 26, fontWeight: 900,
        letterSpacing: '0.1em', color: '#ef4444', textAlign: 'center',
        textShadow: '0 0 20px rgba(239,68,68,0.5)',
        marginBottom: 6,
      }}>MISSION FAILED</div>

      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
        color: C.muted, marginBottom: 20, textAlign: 'center',
      }}>
        {stage?.title?.toUpperCase() || 'STAGE INCOMPLETE'}
      </div>

      {/* Time comparison row */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(239,68,68,0.2)',
        marginBottom: 20, width: '100%', maxWidth: 300,
      }}>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(239,68,68,0.04)' }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>YOUR TIME</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#ef4444' }}>
            {formatTime(yourTime)}
          </div>
        </div>
        {targetSeconds && (
          <>
            <div style={{ width: 1, background: 'rgba(239,68,68,0.15)' }}/>
            <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>TARGET</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: C.muted }}>
                {formatTime(targetSeconds)}
              </div>
            </div>
            <div style={{ width: 1, background: 'rgba(239,68,68,0.15)' }}/>
            <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(239,68,68,0.04)' }}>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>MISSED BY</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#ef4444' }}>
                +{formatTime(missedBy)}
              </div>
            </div>
          </>
        )}
      </div>

      {/* No XP */}
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
        color: 'rgba(239,68,68,0.7)', letterSpacing: '0.15em',
        marginBottom: 20, textAlign: 'center',
      }}>NO XP AWARDED</div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
        <ArcadePrimaryButton onClick={onRetry} style={{
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          boxShadow: '0 0 20px rgba(239,68,68,0.4)',
        }}>
          <RotateCcw size={15}/> RETRY
        </ArcadePrimaryButton>
        <button onClick={onReturnToArcade} style={{
          width: '100%', padding: '11px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
          cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.muted,
        }}>
          <ChevronLeft size={12} style={{ verticalAlign: 'middle', marginRight: 4 }}/> Back to Arcade
        </button>
      </div>
    </div>
  );
}

// ─── PARTIAL COMPLETION ──────────────────────────────────────────────────────

function PartialCompletionScreen({ stage, result, xpEarned, onRetry, onReturnToArcade }) {
  const completionPercent = result?.completionPercent || Math.round((result?.completedTasks || 0) / (result?.totalTasks || 1) * 100);
  const partialXp = xpEarned || Math.round((stage?.rewards?.xp || 0) * (completionPercent / 100) * 0.5);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at center, rgba(168,85,247,0.06) 0%, #030008 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, overflow: 'hidden',
      animation: 'ov-fade-in 0.3s ease-out',
    }}>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_STYLES }}/>

      {/* Violet glow frame */}
      <div style={{
        position: 'absolute', inset: 10, borderRadius: 16,
        border: '1px solid rgba(168,85,247,0.2)', pointerEvents: 'none',
        animation: 'ov-glow-pulse-violet 3s ease-in-out infinite',
      }}/>

      {/* Hero image */}
      <SafeImage
        src="/static/arcade/partial-complete.webp"
        alt="Partial Completion"
        style={{ width: 180, height: 'auto', display: 'block', margin: '0 auto 16px' }}
      />

      {/* Title */}
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 900,
        letterSpacing: '0.08em', color: '#a855f7', textAlign: 'center',
        textShadow: '0 0 20px rgba(168,85,247,0.5)',
        marginBottom: 6,
      }}>PARTIAL COMPLETION</div>

      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
        color: C.muted, marginBottom: 20, textAlign: 'center',
      }}>
        {stage?.title?.toUpperCase() || 'STAGE INCOMPLETE'}
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', alignItems: 'stretch', gap: 0,
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(168,85,247,0.2)',
        marginBottom: 16, width: '100%', maxWidth: 300,
      }}>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(168,85,247,0.04)' }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>PARTIAL XP</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#a855f7' }}>
            +{partialXp}
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(168,85,247,0.15)' }}/>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>COMPLETE</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900, color: '#a855f7' }}>
            {completionPercent}%
          </div>
        </div>
        <div style={{ width: 1, background: 'rgba(168,85,247,0.15)' }}/>
        <div style={{ flex: 1, padding: '12px 10px', textAlign: 'center', background: 'rgba(168,85,247,0.04)' }}>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em', marginBottom: 3 }}>NEXT STAGE</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 900, color: C.muted }}>
            LOCKED
          </div>
        </div>
      </div>

      {/* Encouragement */}
      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
        color: 'rgba(168,85,247,0.7)', marginBottom: 20, textAlign: 'center',
        maxWidth: 260, lineHeight: 1.5,
      }}>
        You made progress but did not finish. Complete the full stage to unlock the next one.
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
        <ArcadePrimaryButton onClick={onRetry} style={{
          background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
          boxShadow: '0 0 20px rgba(168,85,247,0.4)',
        }}>
          <RotateCcw size={15}/> FINISH THE STAGE
        </ArcadePrimaryButton>
        <button onClick={onReturnToArcade} style={{
          width: '100%', padding: '11px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
          cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.muted,
        }}>
          Save &amp; Exit
        </button>
      </div>
    </div>
  );
}

// ─── VALIDATION FAILED (stub for P13 anti-cheat) ─────────────────────────────

function ValidationFailedScreen({ stage, result, onRetry, onReturnToArcade }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, #030008 70%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, overflow: 'hidden',
      animation: 'ov-fade-in 0.3s ease-out',
    }}>
      <style dangerouslySetInnerHTML={{ __html: OVERLAY_STYLES }}/>

      <div style={{
        position: 'absolute', inset: 10, borderRadius: 16,
        border: '1px solid rgba(245,158,11,0.2)', pointerEvents: 'none',
      }}/>

      <SafeImage
        src="/static/arcade/validation-fail.webp"
        alt="Validation Failed"
        style={{ width: 160, height: 'auto', display: 'block', margin: '0 auto 16px' }}
      />

      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 900,
        letterSpacing: '0.08em', color: '#f59e0b', textAlign: 'center',
        textShadow: '0 0 14px rgba(245,158,11,0.4)',
        marginBottom: 8,
      }}>VALIDATION FAILED</div>

      <div style={{
        fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500,
        color: C.muted, marginBottom: 24, textAlign: 'center', maxWidth: 260, lineHeight: 1.5,
      }}>
        {result?.reason || 'This attempt could not be verified. No XP awarded.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 300 }}>
        <ArcadePrimaryButton onClick={onRetry} style={{
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          boxShadow: '0 0 20px rgba(245,158,11,0.35)',
        }}>
          <RotateCcw size={15}/> RETRY STAGE
        </ArcadePrimaryButton>
        <button onClick={onReturnToArcade} style={{
          width: '100%', padding: '11px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
          cursor: 'pointer', fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.muted,
        }}>
          Return to Arcade
        </button>
      </div>
    </div>
  );
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

export default function ArcadeStageClearOverlay({
  series, stage, result, pointsEarned, xpEarned, statRewards,
  totalArcadeXpBefore, completedStageIds, onContinue, onRetry, onReturnToArcade, onNextStage, onShare,
}) {
  const isInvalid = result?.invalid === true;
  const isPartial = result?.partial === true;
  const isHardFail = result?.hardFail === true || result?.missionFailed === true;

  if (isInvalid) {
    return (
      <ValidationFailedScreen
        stage={stage}
        result={result}
        onRetry={onRetry || onContinue}
        onReturnToArcade={onReturnToArcade}
      />
    );
  }

  if (isHardFail) {
    return (
      <MissionFailedScreen
        stage={stage}
        result={result}
        onRetry={onRetry || onContinue}
        onReturnToArcade={onReturnToArcade}
      />
    );
  }

  if (isPartial) {
    return (
      <PartialCompletionScreen
        stage={stage}
        result={result}
        xpEarned={xpEarned}
        onRetry={onRetry || onContinue}
        onReturnToArcade={onReturnToArcade}
      />
    );
  }

  return (
    <StageClearedScreen
      series={series}
      stage={stage}
      result={result}
      pointsEarned={pointsEarned}
      xpEarned={xpEarned}
      statRewards={statRewards}
      completedStageIds={completedStageIds}
      onContinue={onContinue}
      onNextStage={onNextStage}
      onReturnToArcade={onReturnToArcade}
      onShare={onShare}
    />
  );
}
