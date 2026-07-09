import { forwardRef } from 'react';
import { C } from './Styles';
import { PUBLIC_SITE_URL } from './data/links';

const CompletedWorkoutShareCard = forwardRef(function CompletedWorkoutShareCard({ workoutName, modeName, xpEarned, streakDays, shareLink }, ref) {
  const name = workoutName || 'Training Mode Workout';
  const mode = modeName || 'Training Mode';
  const xp = xpEarned || 0;
  const streak = streakDays || 1;
  const link = shareLink || PUBLIC_SITE_URL;

  return (
    <div ref={ref} style={{
      position: 'relative', width: '100%', aspectRatio: '9/16',
      borderRadius: 12, overflow: 'hidden', background: '#0a0014',
    }}>
      <img
        src="/social/training-mode-share-card-template.png"
        alt="Training Mode Share Card"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        crossOrigin="anonymous"
      />
      <div style={{
        position: 'absolute',
        top: '62%', left: '10%', right: '10%', bottom: '10%',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'flex-start',
        padding: '3% 4% 3% 4%',
        overflow: 'hidden',
      }}>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 'clamp(8px, 2.2vw, 11px)',
          color: 'rgba(255,255,255,0.85)', lineHeight: 1.4, marginBottom: '2%',
        }}>
          I just completed a Training Mode workout:
        </div>

        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 'clamp(10px, 3vw, 14px)',
          color: C.yellow, letterSpacing: '0.08em', lineHeight: 1.2, marginBottom: '3%',
          textShadow: '0 0 8px rgba(253,224,71,0.4)',
        }}>
          {name}
        </div>

        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 'clamp(8px, 2vw, 10px)',
          color: 'rgba(255,255,255,0.8)', lineHeight: 1.7,
        }}>
          <div>Mode: {mode}</div>
          <div>XP earned: <span style={{ color: C.yellow, fontWeight: 700 }}>+{xp}</span></div>
          <div>Streak: {streak} {streak === 1 ? 'day' : 'days'}</div>
        </div>

        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 'clamp(7px, 1.8vw, 9px)',
          color: 'rgba(255,255,255,0.6)', marginTop: '3%', lineHeight: 1.5,
        }}>
          Session done. Momentum gained.
        </div>

        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 'clamp(7px, 1.8vw, 9px)',
          color: 'rgba(255,255,255,0.5)', marginTop: '2%',
        }}>
          Start your training arc at: {link}
        </div>

        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 'clamp(6px, 1.6vw, 8px)',
          color: C.neon, marginTop: '3%', opacity: 0.8,
        }}>
          #TrainingMode #FightFit #CombatComplete #FitnessJourney
        </div>
      </div>
    </div>
  );
});

export default CompletedWorkoutShareCard;
