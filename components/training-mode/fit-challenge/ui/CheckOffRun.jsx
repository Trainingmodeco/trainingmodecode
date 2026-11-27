import { useEffect, useRef } from 'react';
import { ChevronLeft, Shuffle, Check } from 'lucide-react';
import { GhostButton, HEAD, BODY, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';
import RunBar, { runHead, keepInView, RUN_CSS, RUN_BAR_CLEAR, RunBackdrop, RunWatermark } from '../../shared/RunBar';
import RunRing, { RING_COLORS } from '../../shared/RunRing';
import TrainingCTA from '../../shared/TrainingCTA';
import CheckOffTracker from './CheckOffTracker';
import { mmss, doseWord, tickProgress } from '../../data/challengeTotals';

// The AT YOUR PACE run with CHECK-OFF on: QuickMissionSolo's top bar and clock,
// the tracker in place of the ROUND tap, then SHUFFLE / ROUNDS (both ask first
// when they would throw ticks away) and PAUSE / STOP as today.
// Render inside PhoneFrame, as QuickMissionSolo does.
// Wired (fit-challenge/FitCheckOffSolo): `readyLeft` (of `readySec`) shows GET
// READY's count in place of the clock, and `onFinish` puts FINISH under the tracker once
// every round is ticked.
//
// It fits the screen (owner, 2026-11-24): the title, the clock and FINISH are a
// sticky head, PAUSE / STOP a bar fixed above the tab bar (shared/RunBar), and
// the tracker scrolls between them with the next move kept in view.
//
// The look (owner, 2026-11-24: "it looks too plain… the workouts themselves
// should stand out"): QuickMissionSolo's ring (shared/RunRing; its arc is the
// share of the workout ticked) with the move to tick next beside it, big, and
// the one after it; the brand T and the lightning bolt behind; FINISH raised gold.

export default function CheckOffRun({
  title, strip, elapsedSec, thisRoundSec, moves, ticks, roundTimes, rounds,
  onTick, onBack, onShuffle, onRounds, onPause, onStop, paused = false, readyLeft = null, readySec = 5, onFinish,
}) {
  const current = ticks.findIndex((r) => !r.every(Boolean));
  const lit = current >= 0 ? ticks[current].findIndex((v) => !v) : -1;
  const rootRef = useRef(null);
  // The next move to tick stays between the head and the bar as the ticks go down the list.
  useEffect(() => {
    if (readyLeft == null) keepInView(rootRef.current?.querySelector('[data-now="true"]'));
  }, [current, lit, readyLeft]);
  const p = tickProgress(moves, ticks);
  const now = lit >= 0 ? moves[lit] : null;
  // The move after the one to tick: the next in this round, else the first of the next round.
  const after = lit >= 0 ? (lit + 1 < moves.length ? moves[lit + 1] : current + 1 < ticks.length ? moves[0] : null) : null;
  const ready = readyLeft != null;
  const ring = ready
    ? { time: String(readyLeft), pct: readyLeft / readySec, color: RING_COLORS.ready, word: 'GET READY' }
    : { time: mmss(elapsedSec), pct: p.pct / 100, color: RING_COLORS.work, word: paused ? 'PAUSED' : `${p.pct}% DONE` };
  return (
    <div ref={rootRef} style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12, padding: `0 16px ${RUN_BAR_CLEAR}px`, boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: RUN_CSS }}/>
      <RunWatermark/>
      <div data-run-head="true" className="sr-head" style={runHead}>
        <RunBackdrop tint={ring.color}/>
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center' }}>
          <button type="button" className="fk-back" aria-label="Back" onClick={onBack} style={{ width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
            <ChevronLeft size={22}/>
          </button>
          <div style={{ minWidth: 0, textAlign: 'center' }}>
            <div style={{ font: `700 11px ${HEAD}`, letterSpacing: '0.16em', color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>AT YOUR PACE{strip ? ` · ${String(strip).split(' · ')[0]}` : ''}</div>
            <div style={{ font: `700 18px ${HEAD}`, letterSpacing: '0.06em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 12px rgba(181,123,255,0.45)' }}>{title}</div>
          </div>
          <span/>
        </div>

        {/* The ring and the move to tick next, big, with the one after it. */}
        <div className="sr-hero">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <RunRing time={ring.time} pct={ring.pct} color={ring.color} word={ring.word} paused={paused} timer={!ready} label={ready ? undefined : `Clock ${ring.time}`}/>
            {!ready && <div style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.1em', color: '#fff', whiteSpace: 'nowrap' }}>{current >= 0 ? `ROUND ${current + 1} OF ${ticks.length}` : `ALL ${ticks.length} ROUNDS DONE`}</div>}
            {!ready && current >= 0 && <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.1em', color: '#D9D2F2', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>THIS ROUND {mmss(thisRoundSec)}</div>}
          </div>
          <div data-run-now="true" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ font: `700 13px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>{ready ? 'FIRST UP' : now ? 'NOW' : 'ALL DONE'}</div>
            <div className="sr-name" style={{ fontFamily: HEAD, fontWeight: 700, lineHeight: 1.08, color: '#fff', overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{now ? now.name : 'TAP FINISH'}</div>
            {now && <div className="sr-dose" style={{ fontFamily: HEAD, fontWeight: 800, lineHeight: 1.05, color: GOLD, textShadow: '0 0 14px rgba(242,190,69,0.45)' }}>{doseWord(now).toUpperCase()}</div>}
            {after && (
              <div style={{ font: `700 15px ${BODY}`, lineHeight: 1.25, color: '#EDE8FF', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                <span style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT }}>NEXT: </span>{after.name}
              </div>
            )}
          </div>
        </div>

        {onFinish && current < 0 && (
          <div style={{ position: 'relative' }}>
            <TrainingCTA label="FINISH" variant="gold" depth height={56} icon={<Check size={18} strokeWidth={3}/>} onClick={onFinish} style={{ height: 'var(--sr-fin)', fontSize: 18, borderRadius: 14 }}/>
          </div>
        )}
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
