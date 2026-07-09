import { useState, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { loadStats, getLevel, getLevelProgress, getWeeklySessions, getStreak, getWeekDayCompletion, WEEKLY_GOAL } from './data/userStats';
import { getSeriesProgress, getActiveChallenge as getStoredActiveChallenge } from './data/arcadeProgress';
import { TRAINING_ARCADE_SERIES } from './data/trainingArcadeData';
import { getFightMiniSuggestion } from './data/recommendations';

// Home — pixel match of design 9c: minimal top bar (logo + name), compact level
// strip, weekly-progress tracker, compact "today's bout" card, a prominent
// Training Arcade card, and a favorites grid.
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TIERS = ['rookie', 'adept', 'veteran', 'elite', 'champion'];

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
  return { series: activeSeries, completedCount, total: activeSeries.stages.length, stored: null };
}

export default function HomeDashboard({ onHome, onFightMode, onProfile, profile, onPractice, onFightFocus, onQuickMission, onFitSetup, onComboCoach, onStartHere, onCombatConditioning, onTrainingArcade, onTrain }) {
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
  const xpPercent = Math.round((levelXp / levelNeeded) * 100);
  const streak = getStreak(stats);
  const WEEK = getWeekDayCompletion(stats);
  const weeklyCount = getWeeklySessions(stats).length;
  const suggestion = getFightMiniSuggestion({ profile: profile || {}, stats, dailyMission: null });

  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const tier = TIERS[Math.min(Math.floor((level - 1) / 3), 4)];
  const name = (profile?.name || 'FIGHTER').toUpperCase();

  // Arcade card data (falls back to the active/first series at stage 1).
  const ac = getActiveChallenge();
  const arSeries = ac?.series || TRAINING_ARCADE_SERIES.find(s => s.isActive) || TRAINING_ARCADE_SERIES[0];
  const arDone = ac?.completedCount ?? 0;
  const arTotal = ac?.total ?? (arSeries?.stages?.length || 6);
  const arCurIdx = Math.min(arDone, arTotal - 1);
  const arCur = arSeries?.stages?.[arCurIdx];
  const arNext = arSeries?.stages?.[arCurIdx + 1];

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

  return (
    <PhoneFrame useBrandBg>
      <Embers count={3}/>

      {/* === TOP BAR === */}
      <div style={{ position: 'sticky', top: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 6px', background: 'rgba(8,0,18,0.9)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <button onClick={onHome} style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
          <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }}/>
          <span style={{ font: "800 11px 'Orbitron',sans-serif", color: '#f5e9ff', letterSpacing: '0.06em' }}>TRAINING MODE</span>
        </button>
        <button onClick={onProfile} style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid rgba(168,85,247,0.3)', borderRadius: 18, padding: '4px 10px', background: 'none', cursor: 'pointer' }}>
          <span style={{ fontSize: 11 }}>👤</span>
          <span style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#c4a4d8', letterSpacing: '0.04em', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </button>
      </div>

      {/* === BODY === */}
      <div className="no-scrollbar" style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', padding: '6px 14px 0', paddingBottom: 'calc(150px + env(safe-area-inset-bottom,0px))' }}>

        {/* Level strip */}
        <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 11, padding: '8px 11px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: 'radial-gradient(circle, rgba(168,85,247,0.2), rgba(10,0,20,0.9))', border: '1px solid rgba(168,85,247,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: "900 13px 'Orbitron',sans-serif", color: '#fff', flexShrink: 0 }}>{level}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ font: "800 7px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.08em' }}>LEVEL {level}</span>
              <span style={{ font: "600 8.5px 'Rajdhani',sans-serif", color: '#c4a4d8' }}>{levelXp}/{levelNeeded} XP</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}><div style={{ width: `${Math.max(3, xpPercent)}%`, height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/></div>
          </div>
          <span style={{ font: "900 12px 'Orbitron',sans-serif", color: '#ff8a3a', flexShrink: 0 }}>🔥{streak}</span>
        </div>

        {/* Weekly progress */}
        <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 11, padding: '8px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ font: "700 7px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.1em' }}>WEEKLY PROGRESS</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {WEEK.map((w, i) => {
              const isToday = w.state === 'pending' || w.state === 'today_done';
              const isDone = w.state === 'done' || w.state === 'today_done';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ font: "700 7px 'Rajdhani',sans-serif", color: isToday ? '#fde047' : isDone ? '#fff' : 'rgba(255,255,255,0.3)' }}>{DAY_LABELS[i]}</span>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isToday ? '#fde047' : isDone ? 'rgba(253,224,71,0.25)' : 'transparent',
                    border: isToday ? 'none' : isDone ? '1.5px solid #fde047' : '1.5px solid rgba(255,255,255,0.15)',
                    boxShadow: isToday ? '0 0 5px rgba(253,224,71,0.6)' : 'none',
                  }}/>
                </div>
              );
            })}
          </div>
          <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#fde047' }}>{weeklyCount}/{WEEKLY_GOAL}</span>
        </div>

        {/* Today's bout (compact) */}
        <button onClick={handleBoutStart} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(168,85,247,0.5)', background: 'radial-gradient(ellipse at 28% 15%, rgba(60,20,90,0.6), #0a0014 68%)', marginBottom: 10, padding: '11px 12px', display: 'flex', gap: 11, alignItems: 'center', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
          <div style={{ width: 52, height: 66, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)' }}>
            <SafeImage src={`/static/tiers/${tier}-${sex}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 6px 'Press Start 2P',monospace", color: '#facc15', marginBottom: 3 }}>TODAY&apos;S BOUT</div>
            <div style={{ font: "900 13px 'Orbitron',sans-serif", color: '#fff', lineHeight: 1.1 }}>{suggestion?.title || 'Fight Focus'}</div>
            <div style={{ font: "600 8px 'Rajdhani',sans-serif", color: '#9a90b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion?.subtitle || 'Timed rounds with coaching'}</div>
          </div>
          <span style={{ font: "900 10px 'Orbitron',sans-serif", color: '#0a0014', background: 'linear-gradient(135deg,#fde047,#f59e0b)', borderRadius: 7, padding: '8px 11px', flexShrink: 0 }}>ENTER</span>
        </button>

        {/* Training Arcade (prominent) */}
        {arSeries && (
          <button onClick={() => onTrainingArcade?.()} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(176,106,255,0.5)', background: 'linear-gradient(135deg,#1a1030,#241640)', boxShadow: '0 0 20px -6px rgba(176,106,255,0.4)', marginBottom: 10, padding: '12px 13px', cursor: 'pointer', textAlign: 'left', width: '100%', display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
              <span style={{ font: "700 7px 'Orbitron',sans-serif", color: '#c9a6ff', letterSpacing: '0.12em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🕹 TRAINING ARCADE · {String(arSeries.title || '').toUpperCase()}</span>
              <span style={{ font: "800 8px 'Orbitron',sans-serif", color: '#8b83a8', flexShrink: 0 }}>STAGE {arCurIdx + 1}/{arTotal}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 9 }}>
              {Array.from({ length: arTotal }).map((_, i) => (
                <span key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i < arDone ? '#22c55e' : i === arDone ? '#fde047' : 'rgba(255,255,255,0.1)', boxShadow: i === arDone ? '0 0 6px rgba(253,224,71,0.6)' : 'none' }}/>
              ))}
            </div>
            <div style={{ font: "900 15px 'Orbitron',sans-serif", color: '#fff', marginBottom: 2 }}>STAGE {arCurIdx + 1}{arCur?.title ? ` · ${String(arCur.title).toUpperCase()}` : ''}</div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8', marginBottom: 10 }}>{arNext?.title ? `Next up after this: Stage ${arCurIdx + 2} · ${arNext.title} (locked)` : 'Final stage — clear it to finish the series.'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ font: "800 9px 'Orbitron',sans-serif", color: '#fde047' }}>{arDone}/{arTotal} CLEARED</span>
              <span style={{ border: 'none', borderRadius: 9, background: 'linear-gradient(135deg,#b975ff,#a855f7)', color: '#fff', font: "900 11px 'Orbitron',sans-serif", letterSpacing: '0.05em', padding: '9px 18px', boxShadow: '0 0 16px rgba(168,85,247,0.4)' }}>{arDone > 0 ? 'CONTINUE CHALLENGE' : 'START CHALLENGE'}</span>
            </div>
          </button>
        )}

        {/* Favorites */}
        <div style={{ font: "600 7px 'Orbitron',sans-serif", color: '#8b83a8', letterSpacing: '0.16em', marginBottom: 6 }}>FAVORITES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          {[
            { emoji: '🎯', label: 'QUICK', onClick: onQuickMission },
            { emoji: '🔥', label: 'HIIT', onClick: onCombatConditioning },
            { emoji: '🥊', label: 'FIGHT', onClick: onFightMode },
            { emoji: '🛠', label: 'BUILD', onClick: onFitSetup },
          ].filter(f => f.onClick).map(f => (
            <button key={f.label} onClick={f.onClick} style={{ background: '#120d20', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 9, padding: '8px 3px', textAlign: 'center', cursor: 'pointer' }}>
              <div style={{ fontSize: 13 }}>{f.emoji}</div>
              <div style={{ font: "700 6.5px 'Rajdhani',sans-serif", color: '#d9d1ef', marginTop: 2 }}>{f.label}</div>
            </button>
          ))}
        </div>

      </div>
    </PhoneFrame>
  );
}
