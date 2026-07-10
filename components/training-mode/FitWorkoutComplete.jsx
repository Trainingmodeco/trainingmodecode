import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SharePromptModal from './SharePromptModal';
import CardioFinisherSummaryCard from './CardioFinisherSummaryCard';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { loadStats, getStreak, getLevel, getLevelProgress, getWeeklySessions } from './data/userStats';
import { loadProfile } from './data/userProfile';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from './data/links';

// Fit Mode workout complete — design 8a layout (shared with Quick Mission).
const GOLD = '#fde047';
const RANKS = ['Combat Rookie', 'Combat Adept', 'Combat Veteran', 'Combat Elite', 'Combat Champion'];
const TIERS = ['rookie', 'adept', 'veteran', 'elite', 'champion'];

function Stat({ value, label, color, highlight }) {
  return (
    <div style={{ background: highlight ? 'rgba(253,224,71,0.08)' : 'rgba(8,2,18,0.88)', border: `1px solid ${highlight ? 'rgba(253,224,71,0.4)' : 'rgba(168,85,247,0.25)'}`, borderRadius: 11, padding: 11, textAlign: 'center' }}>
      <div style={{ font: "900 20px 'Orbitron',sans-serif", color }}>{value}</div>
      <div style={{ font: "600 8px 'Orbitron',sans-serif", color: highlight ? '#facc15' : '#c4a4d8', letterSpacing: '0.08em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function FitWorkoutComplete({ cfg, completedCount, totalCount, cardioResult, onHome }) {
  const allDone = totalCount > 0 && completedCount >= totalCount;
  const xp = completedCount * 15 + (allDone ? 30 : 0);
  const [stats] = useState(() => loadStats());
  const streak = getStreak(stats);
  const level = getLevel(stats.xp);
  const lp = getLevelProgress(stats.xp);
  const exerciseLabel = totalCount > 0 ? `${completedCount}/${totalCount}` : `${completedCount}`;

  const sex = String(loadProfile()?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const ri = Math.min(Math.floor((level - 1) / 3), 4);
  const weekSess = getWeeklySessions(stats);
  const weekXp = weekSess.reduce((a, s) => a + (s.xpEarned || 0), 0);
  const weekModes = new Set(weekSess.map(s => s.type)).size;
  const pct = lp.needed ? Math.round((lp.current / lp.needed) * 100) : 100;

  return (
    <PhoneFrame useBrandBg>
      <Embers count={5}/>
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '18px 16px calc(24px + env(safe-area-inset-bottom,0px))' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ font: "700 8px 'Press Start 2P',monospace", color: '#facc15', letterSpacing: '0.16em', marginBottom: 8 }}>◈ {allDone ? 'WORKOUT COMPLETE' : 'SESSION ENDED'} ◈</div>
            <div style={{ font: "900 20px 'Orbitron',sans-serif", color: '#fff', letterSpacing: '0.04em' }}>{allDone ? 'GREAT WORK' : 'GOOD EFFORT'}</div>
            <div style={{ font: "600 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 2 }}>{cfg.muscleGroups.join(' + ')} · {cfg.equipment} · {cfg.difficulty}</div>
          </div>

          {/* Stat grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
            <Stat value={exerciseLabel} label="EXERCISES" color={GOLD}/>
            <Stat value={String(cfg.muscleGroups.length)} label="MUSCLE FOCUS" color="#fff"/>
            <Stat value={`+${xp}`} label="XP EARNED" color={GOLD} highlight/>
            <Stat value={`🔥${streak}`} label="DAY STREAK" color="#ff8a3a"/>
          </div>

          {/* Muscle chips */}
          <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '11px 14px', marginBottom: 14 }}>
            <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#c4a4d8', letterSpacing: '0.16em', marginBottom: 9 }}>SESSION SUMMARY</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cfg.muscleGroups.map(g => (
                <span key={g} style={{ font: "700 8px 'Orbitron',sans-serif", color: GOLD, padding: '3px 8px', borderRadius: 5, background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.2)' }}>{g.toUpperCase()}</span>
              ))}
              {cfg.addCardio && <span style={{ font: "700 8px 'Orbitron',sans-serif", color: '#ff8a4a', padding: '3px 8px', borderRadius: 5, background: 'rgba(255,138,74,0.08)', border: '1px solid rgba(255,138,74,0.25)' }}>HIIT</span>}
            </div>
          </div>

          <CardioFinisherSummaryCard cardioResult={cardioResult}/>

          {/* Your progress */}
          <div style={{ background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(176,106,255,0.3)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ font: "700 8px 'Orbitron',sans-serif", color: '#b06aff', letterSpacing: '0.16em', marginBottom: 9 }}>YOUR PROGRESS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(253,224,71,0.5)', flexShrink: 0 }}>
                <SafeImage src={`/static/tiers/${TIERS[ri]}-${sex}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%' }}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: "700 10px 'Orbitron',sans-serif", color: '#fde047', marginBottom: 3 }}><span>LEVEL {level} · {RANKS[ri].toUpperCase()}</span><span style={{ color: '#c4a4d8', fontWeight: 600 }}>{lp.current}/{lp.needed} XP</span></div>
                <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#b06aff,#fde047)' }}/></div>
              </div>
            </div>
            <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#9a90b8' }}>This week: <span style={{ color: '#fff', fontWeight: 700 }}>{weekSess.length} sessions</span> · <span style={{ color: '#fde047', fontWeight: 700 }}>{weekXp.toLocaleString()} XP</span> · <span style={{ color: '#fff', fontWeight: 700 }}>{weekModes} mode{weekModes === 1 ? '' : 's'}</span></div>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <button onClick={onHome} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: 'linear-gradient(135deg,#fde047,#f59e0b)', color: '#0a0014', font: "900 13px 'Orbitron',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 0 20px rgba(253,224,71,0.35)' }}>RETURN HOME</button>
          </div>

          <div style={{ marginTop: 14 }}>
            <SharePromptModal placement="inline" shareData={{ mode: 'Fit Mode', xpEarned: xp, streak, level, completedCount, totalCount }}/>
          </div>

          <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{ margin: '12px auto 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'rgba(253,224,71,0.06)', cursor: 'pointer' }}>
            <span style={{ font: "700 8px 'Orbitron',sans-serif", color: GOLD, letterSpacing: '0.08em' }}>💬 GIVE BETA FEEDBACK</span>
          </button>
        </div>
      </div>

    </PhoneFrame>
  );
}
