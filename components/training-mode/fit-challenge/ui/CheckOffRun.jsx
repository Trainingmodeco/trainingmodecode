import { useEffect, useRef } from 'react';
import { ChevronLeft, Shuffle } from 'lucide-react';
import { GhostButton, GoldButton, HEAD, MUTED, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';
import RunBar, { runHead, keepInView, RUN_CSS, RUN_BAR_CLEAR } from '../../shared/RunBar';
import CheckOffTracker from './CheckOffTracker';
import { mmss } from '../../data/challengeTotals';

// The AT YOUR PACE run with CHECK-OFF on: QuickMissionSolo's top bar and clock,
// the tracker in place of the ROUND tap, then SHUFFLE / ROUNDS (both ask first
// when they would throw ticks away) and PAUSE / STOP as today.
// Render inside PhoneFrame, as QuickMissionSolo does.
// Wired (fit-challenge/FitCheckOffSolo): `readyLeft` shows GET READY's count
// in place of the clock, and `onFinish` puts FINISH under the tracker once
// every round is ticked.
//
// It fits the screen (owner, 2026-11-24): the title, the clock and FINISH are a
// sticky head, PAUSE / STOP a bar fixed above the tab bar (shared/RunBar), and
// the tracker scrolls between them with the next move kept in view.

export default function CheckOffRun({
  title, strip, elapsedSec, thisRoundSec, moves, ticks, roundTimes, rounds,
  onTick, onBack, onShuffle, onRounds, onPause, onStop, paused = false, readyLeft = null, onFinish,
}) {
  const current = ticks.findIndex((r) => !r.every(Boolean));
  const lit = current >= 0 ? ticks[current].findIndex((v) => !v) : -1;
  const rootRef = useRef(null);
  // The next move to tick stays between the head and the bar as the ticks go down the list.
  useEffect(() => {
    if (readyLeft == null) keepInView(rootRef.current?.querySelector('[data-now="true"]'));
  }, [current, lit, readyLeft]);
  return (
    <div ref={rootRef} style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12, padding: `0 16px ${RUN_BAR_CLEAR}px`, boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: RUN_CSS }}/>
      <div data-run-head="true" className="sr-head" style={runHead}>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          {readyLeft != null ? (
            <>
              <div style={{ font: `600 13px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>GET READY</div>
              <div className="sr-clock" style={{ font: `700 56px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{readyLeft}</div>
            </>
          ) : (
            <>
              <div role="timer" className="sr-clock" style={{ font: `700 56px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums', opacity: paused ? 0.6 : 1 }}>{mmss(elapsedSec)}</div>
              <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.12em', color: MUTED, textAlign: 'center' }}>
                {current >= 0 ? `ROUND ${current + 1} OF ${ticks.length} · THIS ROUND ${mmss(thisRoundSec)}` : `ALL ${ticks.length} ROUNDS DONE`}
              </div>
              {paused && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>PAUSED</div>}
            </>
          )}
        </div>

        {onFinish && current < 0 && <GoldButton label="FINISH" height={56} onClick={onFinish} style={{ height: 'var(--sr-fin)' }}/>}
      </div>

      <CheckOffTracker moves={moves} ticks={ticks} roundTimes={roundTimes} onTick={readyLeft != null ? undefined : onTick}/>

      {/* Change the workout mid-run: each asks first when it would drop ticks. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GhostButton label="SHUFFLE" height={46} icon={<Shuffle size={16} color={VIOLET_TEXT}/>} onClick={onShuffle}/>
        <GhostButton label={`ROUNDS · ${rounds}`} height={46} onClick={onRounds}/>
      </div>

      {/* PAUSE / STOP: fixed above the tab bar, so they are always in reach. */}
      <RunBar paused={paused} pauseOff={!onPause} onPause={onPause} onStop={onStop}/>
    </div>
  );
}
