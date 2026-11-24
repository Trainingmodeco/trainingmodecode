import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import PhoneFrame from '../PhoneFrame';
import useWakeLock from '../hooks/useWakeLock';
import { stopVoiceSession } from '../voiceCoach';
import { playBell, playBeep, unlockAudio } from '../data/audioEngine';
import { fitKitCSS, GoldButton, GhostButton, Modal, BODY } from '../shared/FitSetupKit';
import { totalSlots } from '../data/missionSolo';
import { soloFromGenerated } from '../data/soloFromGenerated';
import { levelWord } from '../data/quickMissionConfig';
import { emptyTicks, setTick, tickProgress } from '../data/challengeTotals';
import { shuffleCard, snapshotOf, snapshotMission, stepRounds, cardTotals, CARD_MIN_ROUNDS, CARD_MAX_ROUNDS } from '../data/fitCard';
import CheckOffRun from './ui/CheckOffRun';
import DiscardConfirm from './ui/DiscardConfirm';
import RoundsStepper from './ui/RoundsStepper';

// AT YOUR PACE with CHECK-OFF (switch fitCard; a remembered choice on the
// card): the card's workout as rounds of tick boxes (ui/CheckOffTracker), one
// count-up clock, bells and beeps only (no coach line, so no clips).
//
//   · Only the current round takes ticks; a round counts when every move in it
//     is ticked (data/challengeTotals). A round's time is from the tick that
//     finished the round before it to the tick that finishes it.
//   · SHUFFLE deals new moves at the same level, gear, focus and rounds; ROUNDS
//     changes the rounds. Either asks START OVER? first when it would throw
//     ticks away (KEEP GOING, SHUFFLE / START OVER, and END at the bottom: the
//     owner's note), and then starts again from GET READY.
//   · FINISH (every round ticked), STOP → END, or the cap ends the run with
//     QuickMissionSolo's result shape, so App banks and settles it exactly as
//     an AT YOUR PACE run (data/missionSolo settleSoloXp: one settle at the
//     end, the too-fast floor, a stopped run's share by time). Ticks never pay.
//   · What it reports through onStateChange is what it restores from (the
//     ticks, the round times, the mission and the card), so Continue works.
const READY_SEC = 5;
const TICK_MS = 250;

function startState(resume, cfg) {
  const fresh = (mission, card) => ({
    phase: 'ready', elapsedMs: 0, pausedMs: 0, hiddenMs: 0, mission, card,
    ticks: emptyTicks(mission.rounds, mission.exercises.length), roundAt: [],
  });
  if (resume?.kind === 'solo' && resume.checkOff && resume.mission && Array.isArray(resume.ticks)) {
    const ms = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
    return {
      phase: resume.phase === 'ready' ? 'ready' : 'paused', elapsedMs: ms(resume.elapsedMs), pausedMs: ms(resume.pausedMs), hiddenMs: ms(resume.hiddenMs),
      mission: resume.mission, card: resume.card || cfg.card,
      ticks: resume.ticks.map((r) => (Array.isArray(r) ? r.map(Boolean) : [])), roundAt: (resume.roundAt || []).filter(Number.isFinite),
    };
  }
  return fresh(cfg.mission, cfg.card);
}

export default function FitCheckOffSolo({ missionCfg, onEnd, onStateChange, initialResumeData }) {
  useWakeLock(true);
  useEffect(() => { unlockAudio(); }, []);
  const [init] = useState(() => startState(initialResumeData, missionCfg));
  const [mission, setMission] = useState(init.mission);
  const [card, setCard] = useState(init.card);
  const [phase, setPhase] = useState(init.phase);
  const [elapsedMs, setElapsedMs] = useState(init.elapsedMs);
  const [readyLeft, setReadyLeft] = useState(READY_SEC);
  const [ticks, setTicks] = useState(init.ticks);
  const [roundAt, setRoundAt] = useState(init.roundAt);
  const [ask, setAsk] = useState(null); // null | 'stop' | 'rounds' | { kind: 'shuffle' } | { kind: 'rounds', to }
  const [roundsDraft, setRoundsDraft] = useState(null);
  const clock = useRef({ elapsedMs: init.elapsedMs, pausedMs: init.pausedMs, hiddenMs: init.hiddenMs, lastAt: null, pauseAt: init.phase === 'paused' ? Date.now() : null, hiddenAt: null, done: false });

  const moves = useMemo(() => mission.exercises.map((e) => (e.mode === 'timed' ? { name: e.name, seconds: e.work } : { name: e.name, reps: e.reps })), [mission]);
  const p = tickProgress(moves, ticks);
  const capMs = (mission.capSec || 0) * 1000;

  // The clock: wall time while running, as QuickMissionSolo's.
  const finishRef = useRef(null);
  const tick = useCallback(() => {
    const c = clock.current;
    if (c.done) return;
    const now = Date.now();
    if (c.lastAt == null) { c.lastAt = now; return; }
    let next = c.elapsedMs + Math.max(0, now - c.lastAt);
    c.lastAt = now;
    if (capMs > 0 && c.elapsedMs < capMs - 60000 && next >= capMs - 60000) { playBeep(); setTimeout(playBeep, 150); }
    if (capMs > 0 && next >= capMs) { next = capMs; c.elapsedMs = next; setElapsedMs(next); finishRef.current?.('cap'); return; }
    c.elapsedMs = next;
    setElapsedMs(next);
  }, [capMs]);
  useEffect(() => {
    if (phase !== 'running') return undefined;
    const c = clock.current;
    c.lastAt = Date.now();
    const id = setInterval(tick, TICK_MS);
    return () => { clearInterval(id); c.lastAt = null; };
  }, [phase, tick]);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVis = () => {
      const c = clock.current;
      if (document.hidden) { if (c.hiddenAt == null) c.hiddenAt = Date.now(); } else if (c.hiddenAt != null) { c.hiddenMs += Date.now() - c.hiddenAt; c.hiddenAt = null; }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // GET READY 5…1: a beep at 3, 2 and 1, then the bell and the clock starts.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const t0 = Date.now();
    let shown = READY_SEC;
    setReadyLeft(READY_SEC);
    const id = setInterval(() => {
      const left = READY_SEC - Math.floor((Date.now() - t0) / 1000);
      if (left <= 0) { clearInterval(id); playBell(1); setPhase('running'); return; }
      if (left !== shown) { shown = left; setReadyLeft(left); if (left <= 3) playBeep(); }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // Autosave / Continue.
  useEffect(() => {
    const c = clock.current;
    if (typeof onStateChange !== 'function' || c.done) return;
    const now = Date.now();
    onStateChange({
      kind: 'solo', checkOff: true, phase, elapsedMs: Math.round(elapsedMs),
      pausedMs: Math.round(c.pausedMs + (c.pauseAt != null ? now - c.pauseAt : 0)),
      hiddenMs: Math.round(c.hiddenMs + (c.hiddenAt != null ? now - c.hiddenAt : 0)),
      ticks, roundAt, mission, card,
    });
  }, [phase, elapsedMs, ticks, roundAt, mission, card, onStateChange]);

  const closePause = () => { const c = clock.current; if (c.pauseAt != null) { c.pausedMs += Date.now() - c.pauseAt; c.pauseAt = null; } };

  // The end, in QuickMissionSolo's result shape (App banks it once).
  const finish = (end) => {
    const c = clock.current;
    if (c.done) return;
    c.done = true;
    closePause();
    if (c.hiddenAt != null) { c.hiddenMs += Date.now() - c.hiddenAt; c.hiddenAt = null; }
    const sec = Math.max(0, Math.floor(c.elapsedMs / 1000));
    const slots = totalSlots(mission);
    const done = end === 'finish';
    const prog = tickProgress(moves, ticks);
    const score = done ? { kind: 'time', timeSec: sec, value: sec } : end === 'cap' ? { kind: 'time', capped: true, reps: prog.repsDone, value: prog.repsDone } : null;
    stopVoiceSession();
    onEnd({
      mode: 'solo', checkOff: true, completed: done || end === 'cap', stopped: end === 'stop', capped: end === 'cap',
      missionId: mission.id, mission, format: mission.format, level: mission.level, scaled: false, swaps: [],
      elapsedSec: sec, pausedSec: Math.floor(c.pausedMs / 1000), hiddenSec: Math.floor(c.hiddenMs / 1000), clockSec: 0,
      roundTaps: prog.roundsDone, blockTaps: null, splits: roundAt.map((at) => ({ at, block: 0 })),
      score, totalSlots: slots, roundsCompleted: prog.roundsDone, totalRounds: mission.rounds,
      exercisesCompleted: done ? slots : prog.ticked, totalExercises: slots,
      integrityResult: null, ticks: ticks.map((r) => [...r]), card,
    });
  };
  useEffect(() => { finishRef.current = finish; });

  // A tick: only in the current round (a round can never be skipped). The
  // tick that completes a round takes its time and rings the bell.
  const onTick = (r, k) => {
    if (phase !== 'running' && phase !== 'paused') return;
    if (r !== (p.currentRound ?? 0) - 1) return;
    const next = setTick(ticks, r, k);
    const wasDone = ticks[r].every(Boolean);
    const nowDone = next[r].every(Boolean);
    if (!wasDone && nowDone) { setRoundAt((list) => [...list.slice(0, r), Math.round(clock.current.elapsedMs)]); playBell(1); }
    setTicks(next);
  };

  const pause = () => {
    if (phase === 'running') { tick(); clock.current.pauseAt = Date.now(); setPhase('paused'); } else if (phase === 'paused') { closePause(); setPhase('running'); }
  };

  // Start again from GET READY with this mission (SHUFFLE / START OVER).
  const restart = (nextMission, nextCard) => {
    const c = clock.current;
    c.elapsedMs = 0; c.pausedMs = 0; c.hiddenMs = 0; c.pauseAt = null; c.lastAt = null;
    setElapsedMs(0); setRoundAt([]);
    setMission(nextMission); setCard(nextCard);
    setTicks(emptyTicks(nextMission.rounds, nextMission.exercises.length));
    setAsk(null); setPhase('ready');
  };
  // The next deal for the card's own settings (the card snapshot holds what a
  // new deal needs: the page's level, gear, focus and minutes), at this run's
  // rounds; the card becomes the new deal's (data/fitCard shuffleCard).
  const doShuffle = () => {
    const next = shuffleCard(card, { rounds: mission.rounds, fallback: mission });
    const solo = soloFromGenerated(next.mission);
    if (!solo) return;
    restart(solo, next.card);
  };
  const progress = p.ticked > 0;
  const shuffleTap = () => (progress ? setAsk({ kind: 'shuffle' }) : doShuffle());

  // ROUNDS: a stepper; a count that keeps every ticked round needs no question.
  // The card's snapshot (its doses and rests) at n rounds, run at your pace.
  const withRounds = (n) => {
    const snap = card || snapshotOf({ ...mission, exercises: mission.exercises.map((e) => ({ ...e, rest: 0 })) });
    return { solo: soloFromGenerated(snapshotMission({ ...snap, rounds: n })), card: card ? { ...card, rounds: n } : card };
  };
  const applyRounds = (n, { startOver = false } = {}) => {
    const { solo, card: nextCard } = withRounds(n);
    if (!solo) return;
    if (startOver) { restart(solo, nextCard); return; }
    setMission(solo); setCard(nextCard);
    setTicks((t) => (n >= t.length ? [...t, ...emptyTicks(n - t.length, solo.exercises.length)] : t.slice(0, n)));
    setRoundAt((list) => list.slice(0, n));
    setAsk(null);
  };
  const keep = p.roundsDone + (p.currentRound && ticks[p.currentRound - 1]?.some(Boolean) ? 1 : 0);
  const roundsDone = () => {
    const n = roundsDraft ?? mission.rounds;
    setRoundsDraft(null);
    if (n === mission.rounds) { setAsk(null); return; }
    if (n < keep) { setAsk({ kind: 'rounds', to: n }); return; }
    applyRounds(n);
  };

  const elapsedSec = Math.floor(elapsedMs / 1000);
  const lastAt = roundAt.length ? roundAt[roundAt.length - 1] : 0;
  const roundTimes = roundAt.map((at, i) => Math.round((at - (i ? roundAt[i - 1] : 0)) / 1000));
  const movesDone = p.ticked - p.roundsDone * moves.length;
  const soFar = (
    <span style={{ whiteSpace: 'nowrap' }}>So far: <b style={{ color: '#fff', fontWeight: 600 }}>{p.roundsDone} {p.roundsDone === 1 ? 'round' : 'rounds'} and {movesDone} {movesDone === 1 ? 'move' : 'moves'}</b>.</span>
  );
  const draftRounds = roundsDraft ?? mission.rounds;
  const draftTotals = cardTotals({ ...mission, rounds: draftRounds, exercises: card?.exercises || mission.exercises });

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <div data-fc="checkoff">
        <CheckOffRun
          title={mission.title} strip={`CHECK-OFF · ${levelWord(mission.difficulty)} · ${mission.rounds} ${mission.rounds === 1 ? 'ROUND' : 'ROUNDS'}`}
          elapsedSec={elapsedSec} thisRoundSec={Math.max(0, Math.floor((elapsedMs - lastAt) / 1000))}
          moves={moves} ticks={ticks} roundTimes={roundTimes} rounds={mission.rounds}
          onTick={onTick} onBack={() => setAsk('stop')} onShuffle={shuffleTap} onRounds={() => { setRoundsDraft(null); setAsk('rounds'); }}
          onPause={phase === 'ready' ? undefined : pause} onStop={() => setAsk('stop')} paused={phase === 'paused'}
          readyLeft={phase === 'ready' ? readyLeft : null} onFinish={p.done ? () => finish('finish') : undefined}
        />
      </div>

      {ask === 'stop' && (
        <Modal title="END MISSION?" onClose={() => setAsk(null)} footer={(
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <GoldButton label="KEEP GOING" height={46} onClick={() => setAsk(null)} style={{ fontSize: 13, letterSpacing: '0.12em' }}/>
            <GhostButton label="END" onClick={() => finish('stop')} style={{ border: '1px solid rgba(239,68,68,0.5)', color: '#FCA5A5' }}/>
          </div>
        )}>
          <div style={{ font: `500 14px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 }}>XP counts once you pass a quarter of the standard time. {soFar}</div>
        </Modal>
      )}

      {ask === 'rounds' && (
        <Modal title="ROUNDS" onClose={() => setAsk(null)} footer={(
          <GoldButton label="DONE" height={46} onClick={roundsDone} style={{ fontSize: 14 }}/>
        )}>
          <div data-look="rounds" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RoundsStepper totals={draftTotals} min={CARD_MIN_ROUNDS} max={CARD_MAX_ROUNDS} onStep={(d) => setRoundsDraft(stepRounds(draftRounds, d))}/>
            <div style={{ font: `500 12px ${BODY}`, color: '#CFC9E4', lineHeight: 1.4 }}>
              {draftRounds < keep ? 'Fewer rounds than you have started: DONE asks to start over.' : 'Your ticks stay. The time and XP follow the rounds.'}
            </div>
          </div>
        </Modal>
      )}

      {ask?.kind && (
        <DiscardConfirm
          title="START OVER?"
          body={ask.kind === 'shuffle'
            ? <>SHUFFLE deals new moves and clears your ticks. {soFar}</>
            : <>{ask.to} {ask.to === 1 ? 'round is' : 'rounds are'} fewer than you have started, so your ticks clear. {soFar}</>}
          confirmLabel={ask.kind === 'shuffle' ? 'SHUFFLE' : 'START OVER'}
          onKeep={() => setAsk(null)}
          onConfirm={ask.kind === 'shuffle' ? doShuffle : () => applyRounds(ask.to, { startOver: true })}
          onEnd={() => finish('stop')}
        />
      )}
    </PhoneFrame>
  );
}
