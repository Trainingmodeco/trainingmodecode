import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SharePromptModal from './SharePromptModal';
import CompletedWorkoutShareModal from './CompletedWorkoutShareModal';
import SafeImage from './SafeImage';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import CardioFinisherSummaryCard from './CardioFinisherSummaryCard';
import { Trophy, Dumbbell, Flame, TrendingUp, CircleCheck as CheckCircle, MessageSquare } from 'lucide-react';
import { C } from './Styles';
import { loadStats, getStreak, getLevel } from './data/userStats';
import { BETA_FEEDBACK_FORM_URL, openExternalUrl } from './data/links';

const GOLD = C.yellow;

function StatCard({ icon, label, value }) {
  return (
    <div style={{
      borderRadius: 10, padding: '12px 8px', textAlign: 'center',
      background: 'rgba(10,0,20,0.7)', border: '1px solid rgba(253,224,71,0.15)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    }}>
      <div style={{ color: GOLD, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD, fontSize: 16, letterSpacing: '0.06em' }}>
        {value}
      </div>
      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 6, color: C.muted, letterSpacing: '0.1em' }}>
        {label}
      </div>
    </div>
  );
}

export default function FitWorkoutComplete({ cfg, completedCount, totalCount, cardioResult, onHome }) {
  const allDone = totalCount > 0 && completedCount >= totalCount;
  const xp = completedCount * 15 + (allDone ? 30 : 0);
  const [stats] = useState(() => loadStats());
  const streak = getStreak(stats);
  const exerciseLabel = totalCount > 0
    ? `${completedCount} / ${totalCount}`
    : `${completedCount}`;

  return (
    <PhoneFrame useBrandBg>
      <Embers count={5}/>
      <CornerHUD color="rgba(253,224,71,0.3)" size={22} inset={10}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        minHeight: '100dvh', paddingTop: 24,
        padding: '24px 20px calc(160px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* Trophy / icon */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%', background: C.panel,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'visible',
          boxShadow: '0 0 30px rgba(253,224,71,0.4), 0 0 60px rgba(253,224,71,0.15)',
          marginBottom: 16,
        }}>
          {allDone ? (
            <SafeImage
              src="/rewards/trophy-fit-mode.png"
              fallbackSrc="/rewards/trophy-fit-mode.svg"
              alt="Trophy"
              style={{ width: 82, height: 82, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <CheckCircle size={40} style={{ color: GOLD }}/>
          )}
        </div>

        {/* Header */}
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: C.neon, letterSpacing: '0.2em', marginBottom: 6 }}>
          {allDone ? 'WORKOUT COMPLETE' : 'SESSION ENDED'}
        </div>
        <h1 style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD,
          fontSize: 28, letterSpacing: '0.12em', textAlign: 'center',
          textShadow: '0 0 16px rgba(253,224,71,0.5)',
          marginBottom: 6,
        }}>{allDone ? 'GREAT WORK' : 'GOOD EFFORT'}</h1>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, color: C.text, marginBottom: 24 }}>
          {cfg.muscleGroups.join(' + ')} &bull; {cfg.equipment} &bull; {cfg.difficulty}
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 24 }}>
          <StatCard icon={<Dumbbell size={16}/>} label="EXERCISES" value={exerciseLabel}/>
          <StatCard icon={<Flame size={16}/>} label="MUSCLE FOCUS" value={cfg.muscleGroups.length}/>
          <StatCard icon={<TrendingUp size={16}/>} label="XP EARNED" value={`+${xp}`}/>
          <StatCard icon={<Trophy size={16}/>} label="STREAK" value={`${streak}d`}/>
        </div>

        {/* Session summary card */}
        <div style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          background: 'rgba(10,0,20,0.6)', border: '1px solid rgba(253,224,71,0.12)',
          marginBottom: 28,
        }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: C.muted, letterSpacing: '0.1em', marginBottom: 8 }}>
            SESSION SUMMARY
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cfg.muscleGroups.map(g => (
              <span key={g} style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
                color: GOLD, padding: '3px 8px', borderRadius: 5,
                background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.2)',
              }}>{g.toUpperCase()}</span>
            ))}
            {cfg.addCardio && (
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700,
                color: C.rush, padding: '3px 8px', borderRadius: 5,
                background: 'rgba(255,107,0,0.08)', border: '1px solid rgba(255,107,0,0.2)',
              }}>HIIT</span>
            )}
          </div>
        </div>

        <CardioFinisherSummaryCard cardioResult={cardioResult}/>

        {/* CTA */}
        <button onClick={onHome} style={{
          width: '100%', padding: '16px 0', borderRadius: 12, border: 'none',
          background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
          color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 15,
          letterSpacing: '0.18em', cursor: 'pointer',
          boxShadow: '0 0 28px rgba(253,224,71,0.5), 0 0 8px rgba(253,224,71,0.3)',
        }}>
          RETURN HOME
        </button>

        <SharePromptModal placement="inline" shareData={{ mode: 'Fit Mode', xpEarned: xp, streak, level: getLevel(stats.xp), completedCount, totalCount }}/>

        <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'rgba(253,224,71,0.06)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <MessageSquare size={12} color={C.yellow}/>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.yellow, letterSpacing: '0.08em' }}>GIVE BETA FEEDBACK</span>
        </button>

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em' }}>
            TRAIN &middot; BUILD &middot; WIN
          </div>
        </div>
      </div>

      <CompletedWorkoutShareModal shareData={{
        workoutName: cfg.muscleGroups.join(' + '),
        modeName: 'Fit Mode',
        xpEarned: xp,
        streakDays: streak,
      }}/>
    </PhoneFrame>
  );
}
