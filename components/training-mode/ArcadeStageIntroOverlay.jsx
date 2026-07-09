import { useState, useEffect } from 'react';
import { C } from './Styles';
import SafeImage from './SafeImage';
import { getStageBanner } from './data/arcadeVisualAssets';
import { speakAsync, cancelSpeech } from './voiceCoach';

const INTRO_STYLES = `
@keyframes stage-slam {
  0% { opacity: 0; transform: scale(2.5) translateY(-20px); }
  40% { opacity: 1; transform: scale(0.95) translateY(0); }
  60% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
@keyframes stage-title-in {
  0% { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes xp-pulse {
  0%, 100% { opacity: 0.8; text-shadow: 0 0 8px rgba(253,224,71,0.4); }
  50% { opacity: 1; text-shadow: 0 0 16px rgba(253,224,71,0.7), 0 0 30px rgba(253,224,71,0.3); }
}
@keyframes countdown-pop {
  0% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes constellation-mini-pulse {
  0%, 100% { box-shadow: 0 0 6px rgba(253,224,71,0.3); }
  50% { box-shadow: 0 0 14px rgba(253,224,71,0.7), 0 0 24px rgba(168,85,247,0.4); }
}
@keyframes overlay-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes hud-border-glow {
  0%, 100% { border-color: rgba(168,85,247,0.2); }
  50% { border-color: rgba(168,85,247,0.5); }
}
`;

function MiniConstellationMap({ stages, currentStage, completedStageIds }) {
  const completed = new Set(completedStageIds || []);
  const count = stages.length;
  const width = 240;
  const height = 60;
  const gap = width / (count + 1);

  return (
    <div style={{ position: 'relative', width, height, margin: '0 auto' }}>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox={`0 0 ${width} ${height}`}>
        {stages.map((_, i) => {
          if (i === 0) return null;
          const x1 = gap * i;
          const x2 = gap * (i + 1);
          const isComp = completed.has(stages[i - 1]?.id);
          return (
            <line
              key={i}
              x1={x1} y1={height / 2}
              x2={x2} y2={height / 2}
              stroke={isComp ? 'rgba(253,224,71,0.5)' : 'rgba(168,85,247,0.25)'}
              strokeWidth={isComp ? 2 : 1}
              strokeDasharray={isComp ? 'none' : '3,3'}
            />
          );
        })}
      </svg>
      {stages.map((stage, i) => {
        const isComp = completed.has(stage.id);
        const isCurrent = stage.stageNumber === currentStage;
        const size = stage.isFinalRound ? 22 : 16;
        const x = gap * (i + 1);
        return (
          <div key={stage.id} style={{
            position: 'absolute',
            left: x - size / 2,
            top: height / 2 - size / 2,
            width: size,
            height: size,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isComp
              ? 'radial-gradient(circle, rgba(253,224,71,0.3), rgba(168,85,247,0.15))'
              : isCurrent
                ? 'radial-gradient(circle, rgba(168,85,247,0.4), rgba(253,224,71,0.1))'
                : 'rgba(20,0,50,0.8)',
            border: isComp
              ? '2px solid rgba(253,224,71,0.7)'
              : isCurrent
                ? '2px solid rgba(168,85,247,0.8)'
                : '1px solid rgba(168,85,247,0.2)',
            animation: isCurrent ? 'constellation-mini-pulse 2s ease-in-out infinite' : 'none',
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif",
              fontSize: stage.isFinalRound ? 8 : 6,
              fontWeight: 900,
              color: isComp ? C.yellow : isCurrent ? '#c4b5fd' : 'rgba(255,255,255,0.25)',
            }}>
              {stage.isFinalRound ? '\u2605' : stage.stageNumber}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ArcadeStageIntroOverlay({ series, stage, currentStage, completedStageIds, potentialXp, voiceEnabled = true, onComplete }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Speak announcer intro at phase 2
    if (voiceEnabled && stage?.announcerIntro) {
      const speechTimer = setTimeout(() => {
        speakAsync(stage.announcerIntro);
      }, 1000);
      return () => { clearTimeout(speechTimer); cancelSpeech(); };
    }
  }, [stage?.announcerIntro, voiceEnabled]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2200),
      setTimeout(() => setPhase(4), 3000),
      setTimeout(() => setPhase(5), 3700),
      setTimeout(() => setPhase(6), 4400),
      setTimeout(() => onComplete(), 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  const stageNumber = stage?.stageNumber || 1;
  const stageTitle = stage?.title || 'STAGE';
  const stageBanner = getStageBanner(stageNumber);
  const xp = potentialXp || stage?.rewards?.xp || 0;
  const stages = series?.stages || [];
  const motivationLine = stage?.motivationLine || stage?.tagline || 'Every stage builds a legend.';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#030008',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      animation: 'overlay-fade-in 0.3s ease-out',
      overflow: 'hidden',
    }}>
      <style dangerouslySetInnerHTML={{ __html: INTRO_STYLES }}/>

      {/* HUD border accents */}
      <div style={{
        position: 'absolute', inset: 12, borderRadius: 16,
        border: '1px solid rgba(168,85,247,0.2)',
        animation: 'hud-border-glow 3s ease-in-out infinite',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(253,224,71,0.3), transparent)',
      }}/>
      <div style={{
        position: 'absolute', bottom: 16, left: 16, right: 16, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.3), transparent)',
      }}/>

      {/* Corner accents */}
      {[{ top: 12, left: 12 }, { top: 12, right: 12 }, { bottom: 12, left: 12 }, { bottom: 12, right: 12 }].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos, width: 20, height: 20,
          borderTop: i < 2 ? '2px solid rgba(253,224,71,0.4)' : 'none',
          borderBottom: i >= 2 ? '2px solid rgba(253,224,71,0.4)' : 'none',
          borderLeft: (i === 0 || i === 2) ? '2px solid rgba(253,224,71,0.4)' : 'none',
          borderRight: (i === 1 || i === 3) ? '2px solid rgba(253,224,71,0.4)' : 'none',
          borderRadius: i === 0 ? '4px 0 0 0' : i === 1 ? '0 4px 0 0' : i === 2 ? '0 0 0 4px' : '0 0 4px 0',
        }}/>
      ))}

      {/* Top label */}
      {phase >= 1 && (
        <div style={{
          animation: 'stage-title-in 0.5s ease-out forwards',
          marginBottom: 14,
        }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 9,
            fontWeight: 700,
            color: C.yellow,
            letterSpacing: '0.32em',
            marginLeft: '0.32em',
            opacity: 0.85,
          }}>TRAINING ARCADE</span>
        </div>
      )}

      {/* Stage number */}
      {phase >= 1 && (
        <div style={{
          animation: 'stage-slam 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
          marginBottom: 8,
          position: 'relative',
        }}>
          {/* purple anime-energy slash behind the number */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -50%) skewX(-18deg)',
            width: '130%', height: stage.isFinalRound ? 46 : 54,
            background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.55), rgba(217,70,239,0.4), transparent)',
            filter: 'blur(12px)', pointerEvents: 'none',
          }}/>
          {stageBanner ? (
            <SafeImage
              src={stageBanner}
              alt={`STAGE ${stageNumber}`}
              preferWebp={false}
              style={{
                position: 'relative', display: 'block', margin: '0 auto',
                width: '100%', maxWidth: 320, maxHeight: 96,
                objectFit: 'contain', background: 'transparent',
              }}
            />
          ) : (
            <div style={{
              position: 'relative',
              fontFamily: "'Orbitron',sans-serif",
              fontSize: stage.isFinalRound ? 42 : 52,
              fontWeight: 900,
              letterSpacing: '0.15em',
              background: 'linear-gradient(180deg, #fde047 0%, #f59e0b 40%, #92400e 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textShadow: 'none',
              filter: 'drop-shadow(0 2px 8px rgba(253,224,71,0.4)) drop-shadow(0 0 20px rgba(168,85,247,0.3))',
            }}>
              {stage.isFinalRound ? 'FINAL BOSS' : `STAGE ${stageNumber}`}
            </div>
          )}
        </div>
      )}

      {/* Stage title */}
      {phase >= 2 && (
        <div style={{
          animation: 'stage-title-in 0.5s ease-out forwards',
          marginBottom: 8,
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 14,
            fontWeight: 700,
            color: 'rgba(196,181,253,0.9)',
            letterSpacing: '0.12em',
            textShadow: '0 0 12px rgba(168,85,247,0.5), 0 2px 4px rgba(0,0,0,0.8)',
            textAlign: 'center',
            padding: '0 20px',
          }}>
            {stageTitle.toUpperCase()}
          </div>
        </div>
      )}

      {/* Stage focus */}
      {phase >= 2 && stage?.focus && (
        <div style={{
          animation: 'stage-title-in 0.6s ease-out forwards',
          marginBottom: 16,
          maxWidth: 280,
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(196,164,216,0.7)',
            lineHeight: 1.4,
            margin: 0,
          }}>{stage.focus}</p>
        </div>
      )}

      {/* XP card */}
      {phase >= 2 && xp > 0 && (
        <div style={{
          marginBottom: 24,
          padding: '8px 18px',
          borderRadius: 10,
          background: 'rgba(12,2,24,0.85)',
          border: '1px solid rgba(253,224,71,0.35)',
          boxShadow: '0 0 18px rgba(168,85,247,0.25)',
        }}>
          <span style={{
            display: 'block',
            fontFamily: "'Press Start 2P',monospace",
            fontSize: 6,
            color: 'rgba(196,181,253,0.7)',
            letterSpacing: '0.18em',
            marginBottom: 4,
            textAlign: 'center',
          }}>POTENTIAL XP</span>
          <span style={{
            display: 'block',
            animation: 'xp-pulse 2s ease-in-out infinite',
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 18,
            fontWeight: 900,
            color: C.yellow,
            letterSpacing: '0.12em',
            textAlign: 'center',
          }}>
            +{xp}
          </span>
        </div>
      )}

      {/* Mini constellation map */}
      {phase >= 3 && stages.length > 0 && (
        <div style={{
          animation: 'stage-title-in 0.5s ease-out forwards',
          marginBottom: 32,
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(14,0,28,0.8)',
          border: '1px solid rgba(168,85,247,0.15)',
        }}>
          <MiniConstellationMap
            stages={stages}
            currentStage={currentStage}
            completedStageIds={completedStageIds}
          />
        </div>
      )}

      {/* Countdown */}
      {phase >= 4 && phase < 6 && (
        <div style={{
          animation: 'countdown-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          position: 'absolute',
          bottom: 80,
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: '0.2em',
            color: phase === 4 ? '#a855f7' : '#22c55e',
            textShadow: phase === 4
              ? '0 0 20px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.3)'
              : '0 0 20px rgba(34,197,94,0.6), 0 0 40px rgba(34,197,94,0.3)',
          }}>
            {phase === 4 ? 'READY' : 'SET'}
          </div>
        </div>
      )}
      {phase >= 6 && (
        <div style={{
          animation: 'countdown-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          position: 'absolute',
          bottom: 80,
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif",
            fontSize: 34,
            fontWeight: 900,
            letterSpacing: '0.25em',
            background: 'linear-gradient(180deg, #fde047, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 16px rgba(253,224,71,0.6))',
          }}>
            TRAIN
          </div>
        </div>
      )}

      {/* Bottom motivational line */}
      {phase >= 2 && (
        <div style={{
          position: 'absolute',
          bottom: 34,
          left: 24, right: 24,
          textAlign: 'center',
          animation: 'stage-title-in 0.6s ease-out forwards',
        }}>
          <span style={{
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 11,
            fontWeight: 600,
            fontStyle: 'italic',
            color: 'rgba(196,181,253,0.6)',
            letterSpacing: '0.04em',
          }}>
            {motivationLine}
          </span>
        </div>
      )}
    </div>
  );
}
