import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SharePromptModal from './SharePromptModal';
import CompletedWorkoutShareModal from './CompletedWorkoutShareModal';
import MissionIntegrityBanner from './MissionIntegrityBanner';
import CardioFinisherSummaryCard from './CardioFinisherSummaryCard';
import SafeImage from './SafeImage';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import { Trophy, Zap, Flame, TrendingUp, CircleCheck as CheckCircle, RotateCcw, MessageSquare } from 'lucide-react';
import { C } from './Styles';
import { loadStats, getStreak, getLevel } from './data/userStats';
import { calculatePartialXp } from './utils/missionIntegrity';
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

export default function QuickMissionComplete({ result, cardioResult, onRetry, onFitHub, onHome }) {
  const { completed, roundsCompleted, totalRounds, exercisesCompleted, totalExercises, mission, integrityResult } = result;
  const [stats] = useState(() => loadStats());
  const streak = getStreak(stats);
  const level = getLevel(stats.xp);
  const baseXp = exercisesCompleted * 15 + (completed ? 30 : 0);
  const xp = integrityResult?.awardXp
    ? calculatePartialXp(baseXp, integrityResult.validCompletedUnits, integrityResult.totalRequiredUnits)
    : (integrityResult ? 0 : baseXp);
  const completionRatio = totalExercises > 0 ? exercisesCompleted / totalExercises : 0;

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

        {/* Trophy */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%', background: C.panel,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'visible',
          boxShadow: '0 0 30px rgba(253,224,71,0.4), 0 0 60px rgba(253,224,71,0.15)',
          marginBottom: 16,
        }}>
          {completed ? (
            <SafeImage
              src="/rewards/trophy-universal.png"
              fallbackSrc="/rewards/trophy-universal.svg"
              alt="Trophy"
              style={{ width: 82, height: 82, objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <CheckCircle size={40} style={{ color: GOLD }}/>
          )}
        </div>

        {/* Header */}
        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: C.neon, letterSpacing: '0.2em', marginBottom: 6 }}>
          {completed ? 'MISSION COMPLETE' : 'GOOD EFFORT'}
        </div>
        <h1 style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: GOLD,
          fontSize: 26, letterSpacing: '0.12em', textAlign: 'center',
          textShadow: '0 0 16px rgba(253,224,71,0.5)', marginBottom: 6,
        }}>{mission.title}</h1>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.text, marginBottom: 24 }}>
          {mission.workoutType} &bull; {mission.difficulty} &bull; {mission.duration} min
        </div>

        {/* Integrity Banner */}
        {integrityResult && (
          <MissionIntegrityBanner integrityResult={integrityResult} xpAwarded={xp} />
        )}

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 24 }}>
          <StatCard icon={<Zap size={16}/>} label="ROUNDS" value={`${roundsCompleted}/${totalRounds}`}/>
          <StatCard icon={<Flame size={16}/>} label="EXERCISES" value={`${exercisesCompleted}`}/>
          <StatCard icon={<TrendingUp size={16}/>} label="XP EARNED" value={`+${xp}`}/>
          <StatCard icon={<Trophy size={16}/>} label="STREAK" value={`${streak}d`}/>
        </div>

        <CardioFinisherSummaryCard cardioResult={cardioResult}/>

        {/* CTAs */}
        <button onClick={onRetry} style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          background: `linear-gradient(135deg, ${GOLD}, ${C.yellow})`,
          color: C.bg, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
          letterSpacing: '0.16em', cursor: 'pointer', marginBottom: 10,
          boxShadow: '0 0 24px rgba(253,224,71,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <RotateCcw size={16}/> NEW MISSION
        </button>

        <button onClick={onFitHub} style={{
          width: '100%', padding: '12px 0', borderRadius: 10,
          background: 'rgba(253,224,71,0.08)', border: '1px solid rgba(253,224,71,0.25)',
          color: GOLD, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 12,
          letterSpacing: '0.12em', cursor: 'pointer', marginBottom: 8,
        }}>
          BACK TO FIT MODE
        </button>

        <button onClick={onHome} style={{
          width: '100%', padding: '10px 0', borderRadius: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
          color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
          letterSpacing: '0.1em', cursor: 'pointer',
        }}>
          RETURN HOME
        </button>

        <SharePromptModal placement="inline" shareData={{ mode: 'Quick Mission', xpEarned: xp, streak, level, completedCount: exercisesCompleted, totalCount: totalExercises }}/>

        <button onClick={() => openExternalUrl(BETA_FEEDBACK_FORM_URL)} style={{
          marginTop: 12, padding: '8px 14px', borderRadius: 8, border: 'none',
          background: 'rgba(253,224,71,0.06)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <MessageSquare size={12} color={C.yellow}/>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: C.yellow, letterSpacing: '0.08em' }}>GIVE BETA FEEDBACK</span>
        </button>

      </div>

      <CompletedWorkoutShareModal shareData={{
        workoutName: mission?.title || 'Quick Mission',
        modeName: 'Quick Mission',
        xpEarned: xp,
        streakDays: streak,
      }}/>
    </PhoneFrame>
  );
}
