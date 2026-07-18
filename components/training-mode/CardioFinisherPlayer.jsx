import { useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import CornerHUD from './CornerHUD';
import CardioProtocolPlayer from './CardioProtocolPlayer';
import { HeartPulse, SkipForward } from 'lucide-react';
import { C } from './Styles';
import { cardioAddonToPlayer, summarizeCardioAddon, getCardioStyleLabel } from './data/cardioAddon';
import { createCardioSession, logCardioSession } from './data/cardioSessions';

const NEON = C.neon;

// Intermediate screen after the main workout completes. Runs the cardio
// finisher, logs the cardio session (awarding cardio XP once), then hands a
// cardioResult back to the parent so the summary can show it.
export default function CardioFinisherPlayer({ addon, sourceMode, onComplete, onSkip }) {
  const player = cardioAddonToPlayer(addon);
  const firedRef = useRef(false);

  const finish = (result = {}) => {
    if (firedRef.current) return;
    firedRef.current = true;
    const completed = result.completed !== false;
    const fallbackSeconds = addon.targetType === 'time'
      ? (player.estimatedSeconds ?? addon.targetTimeSeconds ?? 0)
      : 0;
    const seconds = result.completedTimeSeconds ?? fallbackSeconds;
    const session = createCardioSession({
      sourceMode: sourceMode || addon.sourceMode || 'fit',
      placement: 'finisher',
      cardioType: addon.cardioType,
      methodLabel: addon.cardioLabel,
      targetType: addon.targetType,
      targetTimeSeconds: addon.targetType === 'time' ? addon.targetTimeSeconds : null,
      targetDistance: addon.targetType === 'distance' ? addon.targetDistance : null,
      distanceUnit: result.distanceUnit || addon.distanceUnit || null,
      style: addon.style,
      intervals: addon.intervals || null,
      completedTimeSeconds: seconds,
      completedDistance: result.completedDistance || null,
      calories: result.calories ?? null,
      notes: result.notes || '',
      completed,
    });
    const { xpEarned } = logCardioSession(session, { awardXp: true });
    onComplete({
      completed,
      cardioType: addon.cardioType,
      cardioLabel: addon.cardioLabel,
      style: addon.style,
      styleLabel: getCardioStyleLabel(addon.style),
      targetType: addon.targetType,
      summary: summarizeCardioAddon(addon),
      timeSeconds: seconds,
      completedTimeSeconds: seconds,
      targetDistance: addon.targetType === 'distance' ? addon.targetDistance : null,
      distanceUnit: result.distanceUnit || addon.distanceUnit || null,
      completedDistance: result.completedDistance || null,
      calories: result.calories ?? null,
      notes: result.notes || '',
      xpEarned: xpEarned || 0,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <Embers count={4}/>
      <CornerHUD color="rgba(176,106,255,0.3)" size={22} inset={10}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100dvh', padding: '24px 20px calc(40px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(176,106,255,0.14)', border: '1px solid rgba(176,106,255,0.35)',
          boxShadow: '0 0 24px rgba(176,106,255,0.3)',
        }}>
          <HeartPulse size={30} color={NEON}/>
        </div>

        <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 8, color: NEON, letterSpacing: '0.2em', marginBottom: 6 }}>
          CARDIO FINISHER · UP NEXT
        </div>
        <h1 style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: C.text,
          fontSize: 20, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 4,
        }}>{addon.cardioLabel}</h1>
        <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: C.muted, marginBottom: 18, textAlign: 'center' }}>
          {summarizeCardioAddon(addon)}
        </div>

        <div style={{
          width: '100%', maxWidth: 340, borderRadius: 16, padding: '18px 14px',
          background: 'rgba(8,0,18,0.7)', border: '1px solid rgba(176,106,255,0.2)',
          marginBottom: 16,
        }}>
          <CardioProtocolPlayer
            format={addon.targetType === 'manual' ? 'steady' : player.format}
            durationSeconds={player.durationSeconds}
            intervalConfig={player.intervalConfig}
            methodLabel={null}
            styleLabel={null}
            distanceLabel={player.distanceLabel}
            headerLabel={null}
            manualOnly={addon.targetType === 'manual'}
            distanceMode={addon.targetType === 'distance'}
            distanceTargetLabel={player.distanceLabel}
            initialDistanceUnit={addon.distanceUnit || 'mi'}
            onComplete={finish}
          />
        </div>

        <button onClick={onSkip} style={{
          padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          color: C.muted, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
          letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <SkipForward size={14}/> SKIP CARDIO
        </button>
      </div>
    </PhoneFrame>
  );
}
