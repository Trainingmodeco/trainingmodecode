import { ChevronLeft, Shuffle } from 'lucide-react';
import { GhostButton, GoldButton, HEAD, MUTED, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';
import CheckOffTracker from './CheckOffTracker';
import { mmss } from '../../data/challengeTotals';

// The AT YOUR PACE run with CHECK-OFF on: QuickMissionSolo's top bar and clock,
// the tracker in place of the ROUND tap, then SHUFFLE / ROUNDS (both ask first
// when they would throw ticks away) and PAUSE / STOP as today.
// Render inside PhoneFrame, as QuickMissionSolo does.
// Wired (fit-challenge/FitCheckOffSolo): `readyLeft` shows GET READY's count
// in place of the clock, and `onFinish` puts FINISH under the tracker once
// every round is ticked.
const RED_BORDER = 'rgba(239,68,68,0.5)';

export default function CheckOffRun({
  title, strip, elapsedSec, thisRoundSec, moves, ticks, roundTimes, rounds,
  onTick, onBack, onShuffle, onRounds, onPause, onStop, paused = false, readyLeft = null, onFinish,
}) {
  const current = ticks.findIndex((r) => !r.every(Boolean));
  return (
    <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 16px 24px', boxSizing: 'border-box', minHeight: '100dvh' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center' }}>
        <button type="button" className="fk-back" aria-label="Back" onClick={onBack} style={{ width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
          <ChevronLeft size={22}/>
        </button>
        <div style={{ minWidth: 0, textAlign: 'center' }}>
          <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>AT YOUR PACE</div>
          <div style={{ font: `700 16px ${HEAD}`, letterSpacing: '0.06em', color: '#fff', overflowWrap: 'anywhere' }}>{title}</div>
        </div>
        <span/>
      </div>
      <div style={{ textAlign: 'center', font: `600 11px ${HEAD}`, letterSpacing: '0.14em', color: MUTED, marginTop: -8 }}>{strip}</div>

      {/* The clock */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        {readyLeft != null ? (
          <>
            <div style={{ font: `600 13px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>GET READY</div>
            <div style={{ font: `700 56px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{readyLeft}</div>
          </>
        ) : (
          <>
            <div role="timer" style={{ font: `700 56px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', opacity: paused ? 0.6 : 1 }}>{mmss(elapsedSec)}</div>
            <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.12em', color: MUTED, textAlign: 'center' }}>
              {current >= 0 ? `ROUND ${current + 1} OF ${ticks.length} · THIS ROUND ${mmss(thisRoundSec)}` : `ALL ${ticks.length} ROUNDS DONE`}
            </div>
            {paused && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>PAUSED</div>}
          </>
        )}
      </div>

      <CheckOffTracker moves={moves} ticks={ticks} roundTimes={roundTimes} onTick={readyLeft != null ? undefined : onTick}/>

      {onFinish && current < 0 && <GoldButton label="FINISH" height={56} onClick={onFinish}/>}

      {/* Change the workout mid-run: each asks first when it would drop ticks. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GhostButton label="SHUFFLE" height={46} icon={<Shuffle size={16} color={VIOLET_TEXT}/>} onClick={onShuffle}/>
        <GhostButton label={`ROUNDS · ${rounds}`} height={46} onClick={onRounds}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GhostButton label={paused ? 'RESUME' : 'PAUSE'} height={46} onClick={onPause}/>
        <GhostButton label="STOP" height={46} onClick={onStop} style={{ border: `1px solid ${RED_BORDER}` }}/>
      </div>
    </div>
  );
}
