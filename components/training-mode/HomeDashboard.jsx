import { useState, useEffect, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { ChevronRight, Flame, Play } from 'lucide-react';
import { C } from './Styles';
import { loadStats, getLevel, getLevelProgress, getWeeklySessions, getStreak, getWeekDayCompletion, WEEKLY_GOAL } from './data/userStats';
import { getDisplayName } from './data/userProfile';
import { getSeriesProgress, getActiveChallenge as getStoredActiveChallenge } from './data/arcadeProgress';
import { TRAINING_ARCADE_SERIES } from './data/trainingArcadeData';
import { getFightMiniSuggestion } from './data/recommendations';

const hubStyles = `
@media (prefers-reduced-motion: reduce) {
  .hub-bar-animated { transition: none !important; }
}
.hub-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  position: relative; overflow: hidden;
}
.hub-card:hover {
  transform: scale(1.005) translateY(-1px);
  border-color: rgba(253,224,71,0.5) !important;
  box-shadow: 0 0 22px rgba(253,224,71,0.18), 0 4px 16px rgba(0,0,0,0.3) !important;
}
.hub-card:active { transform: scale(0.98); }
`;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function AnimatedBar({ percent, height = 5, delay = 0 }) {
  const [width, setWidth] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) { setWidth(percent); return; }
    mounted.current = true;
    const t = setTimeout(() => setWidth(percent), 80 + delay);
    return () => clearTimeout(t);
  }, [percent, delay]);

  return (
    <div style={{
      height, borderRadius: 999, overflow: 'hidden',
      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.1)',
    }}>
      <div className="hub-bar-animated" style={{
        width: `${Math.max(2, width)}%`, height: '100%', borderRadius: 999,
        background: `linear-gradient(90deg, ${C.violet}, ${C.gold})`,
        boxShadow: width > 0 ? '0 0 6px rgba(253,224,71,0.4)' : 'none',
        transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
      }}/>
    </div>
  );
}

function getActiveChallenge() {
  const stored = getStoredActiveChallenge();
  if (stored && stored.seriesId) {
    const series = TRAINING_ARCADE_SERIES.find(s => s.id === stored.seriesId);
    if (series) {
      const progress = getSeriesProgress(series.id);
      const completedCount = Object.values(progress.completedStages).filter(s => s.completed).length;
      return { series, completedCount, total: series.stages.length, stored };
    }
  }
  const activeSeries = TRAINING_ARCADE_SERIES.find(s => s.isActive);
  if (!activeSeries) return null;
  const progress = getSeriesProgress(activeSeries.id);
  const completedCount = Object.values(progress.completedStages).filter(s => s.completed).length;
  const hasPartial = Object.keys(progress.completedStages).length > 0;
  if (completedCount === 0 && !hasPartial) return null;
  return { series: activeSeries, completedCount, total: activeSeries.stages.length, stored: null };
}

export default function HomeDashboard({ onHome, onFightMode, onFitBuilder, onProfile, profile, onPractice, onFightFocus, onQuickMission, onFitSetup, onComboCoach, onStartHere, onStartDailyMission, onCombatConditioning, onBetaFeedback, onTrainingArcade, onTrain }) {
  const [stats, setStats] = useState(() => loadStats());

  useEffect(() => {
    const refreshStats = () => setStats(loadStats());
    refreshStats();
    if (typeof window !== 'undefined') {
      window.addEventListener('training-mode-stats-updated', refreshStats);
      window.addEventListener('storage', refreshStats);
      return () => {
        window.removeEventListener('training-mode-stats-updated', refreshStats);
        window.removeEventListener('storage', refreshStats);
      };
    }
  }, []);

  const level = getLevel(stats.xp);
  const { current: levelXp, needed: levelNeeded } = getLevelProgress(stats.xp);
  const streak = getStreak(stats);
  const WEEK = getWeekDayCompletion(stats);
  const weeklyCount = getWeeklySessions(stats).length;
  const activeChallenge = getActiveChallenge();
  const xpPercent = Math.round((levelXp / levelNeeded) * 100);

  const suggestion = getFightMiniSuggestion({ profile: profile || {}, stats, dailyMission: null });

  const handleBoutStart = () => {
    if (!suggestion) { onTrain?.(); return; }
    switch (suggestion.actionType) {
      case 'fightFocus': onFightFocus?.(suggestion.actionPayload || 'Boxing'); break;
      case 'comboCoach': onComboCoach?.(suggestion.actionPayload || 'Boxing'); break;
      case 'quickMission': onQuickMission?.(); break;
      case 'fitMode': onFitSetup?.(); break;
      case 'combatConditioning': onCombatConditioning?.(); break;
      case 'startHere': onStartHere?.(); break;
      case 'practice': onPractice?.(); break;
      default: onTrain?.(); break;
    }
  };

  const handleContinueChallenge = () => { onTrainingArcade?.(); };

  const currentStageIdx = activeChallenge ? activeChallenge.completedCount + 1 : 1;
  const currentStageName = activeChallenge?.series?.stages?.[activeChallenge.completedCount]?.name || '';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: hubStyles }}/>
      <Embers count={3}/>

      {/* === HEADER === */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 80,
        padding: '12px 14px 0',
        background: 'rgba(8,0,18,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(168,85,247,0.15)',
      }}>
        {/* Top row: wordmark + LV badge + streak */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button onClick={onHome} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <SafeImage src="/static/logo-wordmark.png" alt="Training Mode" style={{ height: 22, width: 'auto', display: 'block' }}/>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* LV badge */}
            <div style={{
              padding: '3px 10px', borderRadius: 6,
              background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.35)',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
              color: C.gold, letterSpacing: '0.06em',
            }}>
              LV {level}
            </div>
            {/* Streak */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Flame size={14} color={streak > 0 ? '#ff8a4a' : C.faint} strokeWidth={2.5}/>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
                color: streak > 0 ? C.gold : C.faint,
              }}>{streak}</span>
            </div>
          </div>
        </div>

        {/* XP bar */}
        <div style={{ paddingBottom: 10 }}>
          <AnimatedBar percent={xpPercent} height={4} delay={0}/>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginTop: 3,
            fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
            color: C.faint, letterSpacing: '0.06em',
          }}>
            <span>LV {level} &middot; {levelXp}/{levelNeeded} XP</span>
            <span>NEXT LV</span>
          </div>
        </div>
      </div>

      {/* === BODY === */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '14px 14px 0',
        paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* === TODAY'S BOUT === */}
        <div className="hub-card" onClick={handleBoutStart} style={{
          borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
          border: '1px solid rgba(253,224,71,0.3)',
          boxShadow: '0 0 18px rgba(253,224,71,0.08), 0 4px 20px rgba(0,0,0,0.4)',
          marginBottom: 14, height: 200,
        }}>
          {/* BG */}
          <SafeImage src="/static/bout-bg.png" alt="" loading="eager" decoding="async" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
          }}/>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to right, rgba(8,0,18,0.82) 0%, rgba(8,0,18,0.35) 60%, rgba(8,1,15,0.35) 100%)',
          }}/>

          {/* Left content */}
          <div style={{
            position: 'absolute', bottom: 18, left: 16, zIndex: 5,
            display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '60%',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
              color: C.gold, letterSpacing: '0.14em',
              textShadow: '0 0 8px rgba(253,224,71,0.4)',
            }}>
              TODAY&apos;S BOUT
            </div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.04em', lineHeight: 1.2,
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}>
              {suggestion?.title || 'Fight Focus'}
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
              color: C.muted, lineHeight: 1.3,
            }}>
              {suggestion?.subtitle || 'Timed rounds with coaching'}
            </div>
            <button onClick={(e) => { e.stopPropagation(); handleBoutStart(); }} style={{
              marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(to bottom, #fde047, #f59e0b)',
              color: '#000', fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
              fontSize: 11, letterSpacing: '0.1em',
              boxShadow: '0 0 16px rgba(253,224,71,0.4)',
              width: 'fit-content',
            }}>
              <Play size={12} fill="#000" strokeWidth={0}/> START
            </button>
          </div>

          {/* Right avatar frame */}
          <div style={{
            position: 'absolute', right: 14, bottom: 18, zIndex: 5,
            width: 100, height: 126, borderRadius: 12, overflow: 'hidden',
            border: '2px solid rgba(253,224,71,0.4)',
            background: 'rgba(8,0,18,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 52, height: 52, objectFit: 'contain', opacity: 0.6 }}/>
            {/* LV badge on avatar */}
            <div style={{
              position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(253,224,71,0.9)', color: '#000',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8,
              letterSpacing: '0.06em',
            }}>
              LV {level}
            </div>
          </div>
        </div>

        {/* === WEEKLY TRACKER === */}
        <div style={{
          borderRadius: 12, padding: '14px 16px',
          background: C.cardBg, border: `1px solid ${C.cardBorder}`,
          marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
          }}>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
              color: C.gold, letterSpacing: '0.1em',
            }}>WEEKLY TRACKER</span>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
              color: '#fff', letterSpacing: '0.06em',
            }}>
              {weeklyCount} OF {WEEKLY_GOAL} THIS WEEK
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {WEEK.map((w, i) => {
              const isToday = w.state === 'pending' || w.state === 'today_done';
              const isDone = w.state === 'done' || w.state === 'today_done';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                    color: isDone ? C.gold : isToday ? '#fff' : C.faint,
                  }}>
                    {DAY_LABELS[i]}
                  </span>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDone ? C.gold : 'transparent',
                    border: isToday && !isDone
                      ? `2px solid ${C.gold}`
                      : isDone ? 'none' : '1.5px solid rgba(255,255,255,0.1)',
                    boxShadow: isDone ? '0 0 8px rgba(253,224,71,0.4)' : 'none',
                  }}>
                    {isDone && (
                      <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9, color: '#000' }}>&#10003;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === TRAINING ARCADE PREVIEW === */}
        {activeChallenge && activeChallenge.series && (
          <div className="hub-card" onClick={handleContinueChallenge} style={{
            borderRadius: 12, cursor: 'pointer',
            background: C.cardBg, border: `1px solid ${C.cardBorder}`,
            padding: '14px 16px',
            marginBottom: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Stage badge */}
              <div style={{
                width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                border: '1.5px solid rgba(168,85,247,0.3)',
                background: 'rgba(168,85,247,0.08)',
              }}>
                <SafeImage
                  src={`/static/stages/s${Math.min(currentStageIdx, 10)}.webp`}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                  color: C.violet, letterSpacing: '0.1em', marginBottom: 2,
                }}>
                  TRAINING ARCADE
                </div>
                <div style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
                  color: '#fff', letterSpacing: '0.04em', lineHeight: 1.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {activeChallenge.series.name}
                </div>
                <div style={{
                  fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11,
                  color: C.muted, marginTop: 2,
                }}>
                  STAGE {currentStageIdx} {currentStageName ? `\u00B7 ${currentStageName}` : ''} &middot; {activeChallenge.completedCount}/{activeChallenge.total} cleared
                </div>
              </div>

              {/* Arrow */}
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <ChevronRight size={16} color={C.violet}/>
              </div>
            </div>
          </div>
        )}

      </div>
    </PhoneFrame>
  );
}
