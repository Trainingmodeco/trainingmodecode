import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChevronLeft, Minus, Plus } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import useWakeLock from './hooks/useWakeLock';
import { stopVoiceSession } from './voiceCoach';
import { playBell, playBeep, unlockAudio } from './data/audioEngine';
import MoveSwapSheet, { MoveRow } from './shared/MoveSwapSheet';
import {
  fitKitCSS, GoldButton, GhostButton, Label, Modal,
  HEAD, BODY, GOLD, MUTED, CARD, CARD_BORDER,
} from './shared/FitSetupKit';
import { cardRows, swapMissionMove, gearProfile, FORMAT_LABEL } from './data/loadoutMissions';
import {
  isFixedClock, missionClockSec, soloTimeline, segmentAt, repsPerRound, paceTargets, prefillScore,
  totalSlots, soloExpectedSec, soloFloorSec, formatScore,
} from './data/missionSolo';
import { mmss } from './data/missionMoves';

// Quick Mission · SOLO. The whole workout on one screen with one clock, at the
// athlete's own pace. No coach voice: the cues are bells and beeps only.
//
// It is a race clock, so it keeps running when the screen locks or the app is
// hidden (no useAutoPauseOnHidden); only PAUSE stops it. Time spent hidden is
// recorded (hiddenSec) but does not change the XP: App settles that from the
// floor rule (data/missionSolo settleSoloXp), honor system.
//
// Renders inside the qm_active screen (ScreenRouter picks it for a SOLO cfg or
// a SOLO stash), so pause / autosave / Continue / replay all work unchanged.
// What it reports through onStateChange is exactly what it restores from.

const RED_BORDER = 'rgba(239,68,68,0.5)';
const READY_SEC = 5;
const TICK_MS = 250;
// A cue whose moment passed more than this long ago is skipped, not replayed:
// ticks are throttled while the page is hidden, and a pile of stale bells on
// the way back would be noise.
const STALE_MS = 1000;

const isMultiBlock = (m) => m?.format === 'amrap' && (m.rounds || 1) > 1;
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));

// Every bell and beep of the run, as moments on the clock (ms). Segment 0's
// start is the end of GET READY, which rings its own bell.
function soloCues(mission, timeline) {
  if (mission.format === 'forTime') {
    const cap = mission.capSec || 0;
    return cap > 60 ? [{ at: (cap - 60) * 1000, kind: 'warn' }] : [];
  }
  const cues = [];
  let start = 0;
  timeline.forEach((seg, i) => {
    if (i > 0) cues.push({ at: start * 1000, kind: seg.kind === 'work' ? 'work' : 'rest' });
    const end = start + seg.sec;
    for (let s = 3; s >= 1; s -= 1) if (seg.sec > s) cues.push({ at: (end - s) * 1000, kind: 'beep' });
    start = end;
  });
  return cues;
}

function playCue(kind) {
  if (kind === 'work') { playBell(1); return; }
  playBeep();
  // A rest start and the one-minute cap warning are a double beep.
  if (kind === 'rest' || kind === 'warn') setTimeout(playBeep, 150);
}

// The score panel's starting values once a fixed clock ends (or STOP at 95%).
function clockDraft(mission, roundTaps, blockTaps) {
  const kind = mission.scoreRule?.kind;
  const pre = prefillScore(mission, { roundTaps, blockTaps });
  if (kind === 'roundsReps') {
    return pre?.blocks
      ? { end: 'clock', blocks: pre.blocks.map(b => ({ rounds: b.rounds, reps: 0 })) }
      : { end: 'clock', rounds: pre?.rounds || 0, reps: 0 };
  }
  if (kind === 'minutesHeld') {
    const of = Math.round(missionClockSec(mission) / 60);
    return { end: 'clock', minutesHeld: clampInt(pre, 0, of), of };
  }
  if (kind === 'reps') return { end: 'clock', reps: Math.max(0, Math.round(pre || 0)) };
  return { end: 'clock' };
}
function capDraft(mission, roundTaps) {
  return { end: 'cap', reps: Math.min(repsPerRound(mission) * (mission.rounds || 1), roundTaps * repsPerRound(mission)) };
}

// The Score object App stores (see the Drop A spec, 3.7).
function scoreFromDraft(mission, draft, finishSec) {
  if (!draft) return null;
  const rule = mission.scoreRule || {};
  const rpr = repsPerRound(mission);
  if (draft.end === 'finish') return { kind: 'time', timeSec: finishSec, value: finishSec };
  if (draft.end === 'cap') return { kind: 'time', capped: true, reps: draft.reps, value: draft.reps };
  if (rule.kind === 'roundsReps') {
    if (Array.isArray(draft.blocks)) {
      const blocks = draft.blocks.map(b => ({ rounds: b.rounds, reps: b.reps }));
      const rounds = blocks.reduce((s, b) => s + b.rounds, 0);
      const reps = blocks.reduce((s, b) => s + b.reps, 0);
      return { kind: 'roundsReps', rounds, reps, blocks, value: rounds * rpr + reps };
    }
    return { kind: 'roundsReps', rounds: draft.rounds, reps: draft.reps, value: draft.rounds * rpr + draft.reps };
  }
  if (rule.kind === 'minutesHeld') return { kind: 'minutesHeld', minutesHeld: draft.minutesHeld, of: draft.of, value: draft.minutesHeld };
  if (rule.kind === 'reps') return { kind: 'reps', reps: draft.reps, label: rule.label, value: draft.reps };
  return null;
}

// Where the screen starts. A SOLO stash comes back paused at its elapsed time
// (time lost to an OS kill or a nav-away is not added: nobody knows what
// happened in it); a stashed GET READY counts down again; a stashed score
// panel comes back as it was, without restarting the race clock. A run whose
// clock or cap already ran out goes straight to the score.
function startState(resume, mission) {
  const now = Date.now();
  const blocks0 = isMultiBlock(mission) ? Array.from({ length: mission.rounds }, () => 0) : null;
  const clock = (elapsedMs, pausedMs, hiddenMs, paused) => ({
    elapsedMs, pausedMs, hiddenMs, lastAt: null, pauseAt: paused ? now : null, hiddenAt: null, over: false, done: false,
  });
  const fresh = { phase: 'ready', roundTaps: 0, blockTaps: blocks0, finishSec: null, scoreDraft: null, clock: clock(0, 0, 0, false) };
  if (resume?.kind !== 'solo' || resume.phase === 'ready') return fresh;

  const ms = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const roundTaps = clampInt(resume.roundTaps, 0, 9999);
  const blockTaps = blocks0 ? blocks0.map((_, b) => clampInt(resume.blockTaps?.[b], 0, 9999)) : null;
  let elapsedMs = ms(resume.elapsedMs);
  const base = { roundTaps, blockTaps, finishSec: null, scoreDraft: null };
  const draft = resume.scoreDraft && typeof resume.scoreDraft === 'object' ? resume.scoreDraft : null;

  if (resume.phase === 'score' && draft) {
    if (draft.end !== 'finish') {
      return { ...base, phase: 'score', scoreDraft: draft, clock: { ...clock(elapsedMs, ms(resume.pausedMs), ms(resume.hiddenMs), false), over: true } };
    }
    if (Number.isFinite(resume.finishSec)) {
      // FINISH was tapped: the panel waits, the clock held (NOT YET → paused).
      return { ...base, phase: 'score', finishSec: resume.finishSec, scoreDraft: { end: 'finish', from: 'paused' }, clock: clock(elapsedMs, ms(resume.pausedMs), ms(resume.hiddenMs), true) };
    }
  }

  const capMs = (mission.format === 'forTime' ? mission.capSec || 0 : missionClockSec(mission)) * 1000;
  if (capMs > 0 && elapsedMs >= capMs) {
    elapsedMs = capMs;
    const scoreDraft = mission.format === 'forTime' ? capDraft(mission, roundTaps) : clockDraft(mission, roundTaps, blockTaps);
    return { ...base, phase: 'score', scoreDraft, clock: { ...clock(elapsedMs, ms(resume.pausedMs), ms(resume.hiddenMs), false), over: true } };
  }
  return { ...base, phase: 'paused', clock: clock(elapsedMs, ms(resume.pausedMs), ms(resume.hiddenMs), true) };
}

// − value + with 44×44 buttons. No hold-to-repeat.
function ScoreStepper({ label, name, value, min = 0, max = 9999, onChange }) {
  const btn = (disabled) => ({
    width: 44, height: 44, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(157,108,255,0.14)', border: '1px solid rgba(157,108,255,0.45)', color: '#fff',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, padding: 0,
  });
  const spoken = name || label.toLowerCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, minWidth: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{label}</span>
      <button type="button" aria-label={`Less ${spoken}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} style={btn(value <= min)}>
        <Minus size={18}/>
      </button>
      <span style={{ minWidth: 64, textAlign: 'center', font: `700 28px ${HEAD}`, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <button type="button" aria-label={`More ${spoken}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} style={btn(value >= max)}>
        <Plus size={18}/>
      </button>
    </div>
  );
}

export default function QuickMissionSolo({ missionCfg, onEnd, onStateChange, initialResumeData }) {
  useWakeLock(true);
  useEffect(() => { unlockAudio(); }, []);

  // The mission as run. Swaps change it (the clock never stops for one), and
  // a resume brings back the swapped version.
  const [init] = useState(() => startState(initialResumeData, initialResumeData?.mission || missionCfg.mission));
  const [mission, setMission] = useState(() => initialResumeData?.mission || missionCfg.mission);
  const gear = useState(() => gearProfile())[0];

  const [phase, setPhase] = useState(init.phase);
  const [elapsedMs, setElapsedMs] = useState(init.clock.elapsedMs);
  const [readyLeft, setReadyLeft] = useState(READY_SEC);
  const [roundTaps, setRoundTaps] = useState(init.roundTaps);
  const [blockTaps, setBlockTaps] = useState(init.blockTaps);
  const [finishSec, setFinishSec] = useState(init.finishSec);
  const [scoreDraft, setScoreDraft] = useState(init.scoreDraft);
  const [confirmStop, setConfirmStop] = useState(false);
  const [swapKeyOpen, setSwapKeyOpen] = useState(null);

  // The clock's books, mutated by the tick: elapsed/paused/hidden ms, the last
  // tick's wall time, when the open pause or hidden span began.
  const clockRef = useRef(init.clock);

  const format = mission.format;
  const fixedClock = isFixedClock(format);
  const multiBlock = isMultiBlock(mission);
  const timeline = useMemo(() => soloTimeline(mission), [mission]);
  const cues = useMemo(() => soloCues(mission, timeline), [mission, timeline]);
  const rows = useMemo(() => cardRows(mission, { gear }), [mission, gear]);
  const pace = useMemo(() => paceTargets(mission), [mission]);
  const rpr = useMemo(() => repsPerRound(mission), [mission]);
  const clockSec = fixedClock ? missionClockSec(mission) : 0;
  const capSec = format === 'forTime' ? mission.capSec || 0 : 0;
  const ticking = phase === 'running' || (phase === 'score' && scoreDraft?.end === 'finish' && scoreDraft.from === 'running');

  // What the interval and the visibility listener read (they outlive renders).
  const liveRef = useRef(null);
  useEffect(() => {
    liveRef.current = { mission, cues, phase, ticking, finishSec, roundTaps, blockTaps, format, clockMs: clockSec * 1000, capMs: capSec * 1000 };
  });

  // The cap or the fixed clock ran out: the clock stops there, the bell rings
  // three times, and the score panel opens.
  const endRun = useCallback((kind) => {
    const L = liveRef.current;
    clockRef.current.over = true;
    playBell(3);
    setConfirmStop(false);
    setSwapKeyOpen(null);
    setScoreDraft(kind === 'cap' ? capDraft(L.mission, L.roundTaps) : clockDraft(L.mission, L.roundTaps, L.blockTaps));
    setPhase('score');
  }, []);

  // One step of the clock: add the wall time since the last step, play the
  // cues that fell inside it, end the run at the cap / clock. Returns true when
  // this step ended the run.
  const tick = useCallback(() => {
    const c = clockRef.current;
    const L = liveRef.current;
    if (!L || c.over) return false;
    const now = Date.now();
    if (c.lastAt == null) { c.lastAt = now; return false; }
    const prev = c.elapsedMs;
    let next = prev + Math.max(0, now - c.lastAt);
    c.lastAt = now;
    if (typeof document !== 'undefined' && document.hidden && c.hiddenAt == null) c.hiddenAt = now;
    let end = null;
    if (L.format === 'forTime') {
      // While FINISH waits on the panel the cap does not end the run.
      if (L.finishSec == null && L.capMs > 0 && next >= L.capMs) { next = L.capMs; end = 'cap'; }
    } else if (L.clockMs > 0 && next >= L.clockMs) { next = L.clockMs; end = 'clock'; }
    c.elapsedMs = next;
    if (L.phase === 'running') {
      L.cues.forEach(q => { if (q.at > prev && q.at <= next && next - q.at < STALE_MS) playCue(q.kind); });
    }
    setElapsedMs(next);
    if (end) { endRun(end); return true; }
    return false;
  }, [endRun]);

  useEffect(() => {
    if (!ticking) return undefined;
    const c = clockRef.current;
    c.lastAt = Date.now();
    const id = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(id);
      c.lastAt = null;
      if (c.hiddenAt != null) { c.hiddenMs += Date.now() - c.hiddenAt; c.hiddenAt = null; }
    };
  }, [ticking, tick]);

  // Hidden time while the clock runs: stored only (Drop B may look at it).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      const c = clockRef.current;
      const now = Date.now();
      if (document.hidden) {
        if (liveRef.current?.ticking && c.hiddenAt == null) c.hiddenAt = now;
      } else if (c.hiddenAt != null) {
        c.hiddenMs += now - c.hiddenAt;
        c.hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // GET READY 5…1: a beep at 3, 2 and 1, then the bell and the clock starts.
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const t0 = Date.now();
    let shown = READY_SEC;
    setReadyLeft(READY_SEC);
    const id = setInterval(() => {
      const left = READY_SEC - Math.floor((Date.now() - t0) / 1000);
      if (left <= 0) {
        clearInterval(id);
        playBell(1);
        setPhase('running');
        return;
      }
      if (left !== shown) {
        shown = left;
        setReadyLeft(left);
        if (left <= 3) playBeep();
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // State for App's autosave and nav/hidden stash: every change, and four
  // times a second while the clock runs.
  useEffect(() => {
    const c = clockRef.current;
    if (typeof onStateChange !== 'function' || c.done) return;
    const now = Date.now();
    onStateChange({
      kind: 'solo', phase, elapsedMs: Math.round(elapsedMs),
      pausedMs: Math.round(c.pausedMs + (c.pauseAt != null ? now - c.pauseAt : 0)),
      hiddenMs: Math.round(c.hiddenMs + (c.hiddenAt != null ? now - c.hiddenAt : 0)),
      roundTaps, blockTaps, finishSec, scoreDraft, mission,
    });
  }, [phase, elapsedMs, roundTaps, blockTaps, finishSec, scoreDraft, mission, onStateChange]);

  const closePause = () => {
    const c = clockRef.current;
    if (c.pauseAt != null) { c.pausedMs += Date.now() - c.pauseAt; c.pauseAt = null; }
  };

  // The result App settles and stores (see the Drop A spec, 3.7).
  const finish = ({ completed, stopped = false, capped = false, score = null, elapsedSec }) => {
    const c = clockRef.current;
    if (c.done) return;
    c.done = true;
    c.over = true;
    closePause();
    if (c.hiddenAt != null) { c.hiddenMs += Date.now() - c.hiddenAt; c.hiddenAt = null; }
    const slots = totalSlots(mission);
    const expected = soloExpectedSec(mission);
    const sec = Math.max(0, Math.floor(elapsedSec));
    stopVoiceSession();
    onEnd({
      mode: 'solo', completed, stopped, capped,
      missionId: mission.id, mission, format, level: mission.level, scaled: !!mission.scaled, swaps: mission.swaps || [],
      elapsedSec: sec, pausedSec: Math.floor(c.pausedMs / 1000), hiddenSec: Math.floor(c.hiddenMs / 1000), clockSec: mission.clockSec || 0,
      roundTaps, blockTaps: blockTaps ? [...blockTaps] : null,
      score, totalSlots: slots,
      roundsCompleted: 0, totalRounds: mission.rounds,
      exercisesCompleted: completed ? slots : Math.round(slots * (expected > 0 ? Math.min(1, sec / expected) : 0)),
      totalExercises: slots,
      integrityResult: null,
    });
  };

  const handlePauseToggle = () => {
    if (phase === 'running') {
      if (tick()) return;
      clockRef.current.pauseAt = Date.now();
      setPhase('paused');
    } else if (phase === 'paused') {
      closePause();
      setPhase('running');
    }
  };

  // FINISH (for time): the time is taken now; the clock keeps running under
  // the panel so NOT YET loses nothing.
  const handleFinish = () => {
    if (phase !== 'running' && phase !== 'paused') return;
    if (phase === 'running' && tick()) return;
    setFinishSec(Math.floor(clockRef.current.elapsedMs / 1000));
    setScoreDraft({ end: 'finish', from: phase });
    setSwapKeyOpen(null);
    setPhase('score');
  };
  const handleNotYet = () => {
    const back = scoreDraft?.from === 'running' ? 'running' : 'paused';
    setFinishSec(null);
    setScoreDraft(null);
    setPhase(back);
  };

  // END in the STOP confirm. Past 95% of a fixed clock it counts as finished
  // and goes to the score; otherwise the run ends here with no score.
  const handleStopEnd = () => {
    setConfirmStop(false);
    if (phase === 'score') return;
    if (phase === 'running' && tick()) return;
    const sec = Math.floor(clockRef.current.elapsedMs / 1000);
    if (fixedClock && (phase === 'running' || phase === 'paused') && sec >= soloFloorSec(mission)) {
      closePause();
      clockRef.current.over = true;
      playBell(3);
      setSwapKeyOpen(null);
      setScoreDraft(clockDraft(mission, roundTaps, blockTaps));
      setPhase('score');
      return;
    }
    finish({ completed: false, stopped: true, score: null, elapsedSec: sec });
  };

  const handleSave = () => {
    const d = scoreDraft;
    if (!d) return;
    const score = scoreFromDraft(mission, d, finishSec);
    if (d.end === 'finish') finish({ completed: true, score, elapsedSec: finishSec });
    else if (d.end === 'cap') finish({ completed: true, capped: true, score, elapsedSec: capSec });
    else finish({ completed: true, score, elapsedSec: clockRef.current.elapsedMs / 1000 });
  };

  // ── what the clock shows ──────────────────────────────────────────────────
  const elapsedF = elapsedMs / 1000;
  const elapsedSec = Math.floor(elapsedF);
  const at = timeline.length ? segmentAt(timeline, Math.min(elapsedF, Math.max(0, clockSec - 0.001))) : null;
  const seg = at?.segment || null;
  const segLeft = at ? Math.ceil(at.remainingSec - 1e-6) : 0;
  const totalLeft = Math.max(0, Math.ceil(clockSec - elapsedF - 1e-6));
  const block = seg?.block ?? 0;
  const inRest = seg?.kind === 'rest';

  let bigClock = mmss(segLeft);
  let subLine = '';
  if (format === 'forTime') {
    bigClock = mmss(elapsedSec);
    subLine = `CAP ${mmss(capSec)} · ROUND ${Math.min(roundTaps + 1, mission.rounds || 1)}/${mission.rounds || 1}`;
  } else if (format === 'amrap' && !multiBlock) {
    bigClock = mmss(totalLeft);
    subLine = `AMRAP ${Math.round(clockSec / 60)}`;
  } else if (format === 'amrap') {
    subLine = `${seg?.label || 'AMRAP'} · ${mmss(totalLeft)} LEFT`;
  } else if (format === 'emom') {
    subLine = `${seg?.label || ''} · ${(at?.index ?? 0) + 1} / ${timeline.length}`;
  } else if (format === 'intervals') {
    const works = timeline.filter(s => s.kind === 'work').length;
    const n = timeline.slice(0, (at?.index ?? 0) + 1).filter(s => s.kind === 'work').length;
    subLine = `${seg?.label || ''} · ${Math.max(1, n)} / ${works}`;
  }
  // Wiper calls, large, so the sweeps keep their pace without a voice.
  const call = seg?.kind === 'work' && seg.calls?.length && phase !== 'ready'
    ? seg.calls.filter(q => q.t <= elapsedF - at.startSec).pop()?.say || null
    : null;

  const showRounds = (format === 'amrap' || format === 'forTime') && !inRest;
  const tapsLive = phase === 'running' || phase === 'paused';
  const addRound = () => {
    if (!tapsLive) return;
    if (format === 'forTime' && roundTaps >= (mission.rounds || 1)) return;
    setRoundTaps(n => n + 1);
    if (multiBlock) setBlockTaps(list => list.map((v, i) => (i === block ? v + 1 : v)));
  };
  const undoRound = () => {
    if (!tapsLive || roundTaps <= 0) return;
    if (multiBlock) {
      if (!(blockTaps?.[block] > 0)) return;
      setBlockTaps(list => list.map((v, i) => (i === block ? v - 1 : v)));
    }
    setRoundTaps(n => Math.max(0, n - 1));
  };

  const highlightOf = (row) => (phase !== 'score' && seg?.kind === 'work'
    ? row.swapKey === seg.swapKey || seg.stepKeys.includes(row.swapKey)
    : false);
  const onPick = (moveId) => {
    const key = swapKeyOpen;
    setSwapKeyOpen(null);
    if (key) setMission(m => swapMissionMove(m, key, moveId, { gear }));
  };
  const onUndo = (row) => setMission(m => swapMissionMove(m, row.swapKey, row.defaultMoveId, { gear }));

  const levelLabel = mission.levelLabel || '';
  const strip = `${FORMAT_LABEL[format] || ''} · ${levelLabel}${mission.scaled ? ' · SCALED' : ''}`;
  const muted11 = { font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.4 };
  const cardBox = { borderRadius: 14, background: CARD, border: `1px solid ${CARD_BORDER}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 };
  const canStop = phase !== 'score';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14,
        padding: '10px 16px 24px', boxSizing: 'border-box', minHeight: '100dvh',
      }}>
        {/* Top bar: back opens the STOP confirm; SOLO over the mission title. */}
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center' }}>
          <button type="button" className="fk-back" aria-label="Back" aria-disabled={canStop ? undefined : 'true'}
            onClick={canStop ? () => setConfirmStop(true) : undefined}
            style={{ width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#fff', cursor: canStop ? 'pointer' : 'default', opacity: canStop ? 1 : 0.45, padding: 0 }}>
            <ChevronLeft size={22}/>
          </button>
          <div style={{ minWidth: 0, textAlign: 'center' }}>
            <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>SOLO</div>
            <div style={{ font: `700 16px ${HEAD}`, letterSpacing: '0.06em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mission.title}</div>
          </div>
          <span/>
        </div>

        <div style={{ textAlign: 'center', font: `600 11px ${HEAD}`, letterSpacing: '0.14em', color: MUTED, marginTop: -8 }}>{strip}</div>

        {phase === 'score' ? (
          <ScorePanel
            mission={mission} draft={scoreDraft} finishSec={finishSec} rpr={rpr}
            onDraft={setScoreDraft} onSave={handleSave} onNotYet={handleNotYet}
          />
        ) : (
          <>
            {/* The clock */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 0 2px' }}>
              {phase === 'ready' ? (
                <>
                  <div style={{ font: `600 13px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>GET READY</div>
                  <div style={{ font: `700 64px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{readyLeft}</div>
                </>
              ) : (
                <>
                  <div role="timer" style={{ font: `700 64px ${HEAD}`, lineHeight: 1, color: inRest ? '#C4A8FF' : '#fff', fontVariantNumeric: 'tabular-nums', opacity: phase === 'paused' ? 0.6 : 1 }}>{bigClock}</div>
                  <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.12em', color: MUTED, textAlign: 'center' }}>{subLine}</div>
                  {call && <div style={{ font: `700 28px ${HEAD}`, letterSpacing: '0.12em', color: GOLD, textTransform: 'uppercase', marginTop: 2 }}>{call}</div>}
                  {phase === 'paused' && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: GOLD }}>PAUSED</div>}
                  {format !== 'forTime' && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.14em', color: MUTED }}>ELAPSED {mmss(elapsedSec)}</div>}
                </>
              )}
            </div>

            {/* + ROUND: the athlete's own round count (never through integrity). */}
            {showRounds && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" aria-label="Undo round" onClick={undoRound} disabled={!tapsLive || roundTaps <= 0} style={{
                    width: 44, height: 44, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    background: CARD, border: '1px solid rgba(255,255,255,0.14)', color: '#fff',
                    cursor: tapsLive && roundTaps > 0 ? 'pointer' : 'default', opacity: tapsLive && roundTaps > 0 ? 1 : 0.45,
                  }}><Minus size={18}/></button>
                  <GoldButton label="+ ROUND" height={56} onClick={addRound} disabled={!tapsLive} style={{ flex: 1, width: 'auto', minWidth: 0 }}/>
                </div>
                <div style={{ textAlign: 'center', font: `600 12px ${HEAD}`, letterSpacing: '0.14em', color: '#fff' }}>
                  {multiBlock ? `ROUNDS ${blockTaps?.[block] ?? 0} · TOTAL ${roundTaps}` : `ROUNDS ${roundTaps}`}
                </div>
              </div>
            )}

            {/* The moves. Swaps stay live for the whole run. */}
            <section style={cardBox}>
              {mission.missionLine && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', lineHeight: 1.35 }}>{mission.missionLine}</div>}
              <ol style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rows.map((row, i) => (
                  <MoveRow key={row.swapKey} row={row} index={i} highlight={highlightOf(row)}
                    onSwap={(r) => setSwapKeyOpen(r.swapKey)} onUndo={onUndo}/>
                ))}
              </ol>
            </section>

            {/* Pace targets */}
            <section style={cardBox}>
              <Label>PACE</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {pace.map(p => {
                  const passed = format === 'forTime' && typeof mission.pace?.[p.tier] === 'number' && elapsedSec > mission.pace[p.tier];
                  return (
                    <div key={p.tier} style={{ display: 'flex', alignItems: 'baseline', gap: 10, opacity: passed ? 0.45 : 1 }}>
                      <span style={{ width: 84, flexShrink: 0, font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: p.tier === 'elite' ? GOLD : '#fff' }}>{p.label}</span>
                      <span style={{ font: `600 13px ${HEAD}`, color: p.tier === 'elite' ? GOLD : '#CFC9E4' }}>{p.text}</span>
                    </div>
                  );
                })}
              </div>
              {mission.paceBasis && <div style={muted11}>{mission.paceBasis}</div>}
              <div style={muted11}>Keep the screen on for the beeps.</div>
            </section>

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {format === 'forTime' && <GoldButton label="FINISH" height={56} onClick={handleFinish} disabled={!tapsLive}/>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <GhostButton label={phase === 'paused' ? 'RESUME' : 'PAUSE'} onClick={handlePauseToggle} style={phase === 'ready' ? { opacity: 0.45, cursor: 'default' } : undefined}/>
                <GhostButton label="STOP" onClick={() => setConfirmStop(true)} style={{ border: `1px solid ${RED_BORDER}` }}/>
              </div>
            </div>
          </>
        )}

        {(mission.load || mission.note) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {mission.load && <div style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.12em', color: MUTED }}>LOAD · {mission.load}</div>}
            {mission.note && <div style={muted11}>{mission.note}</div>}
          </div>
        )}
      </div>

      {swapKeyOpen && phase !== 'score' && (
        <MoveSwapSheet mission={mission} swapKey={swapKeyOpen} gear={gear} onPick={onPick} onClose={() => setSwapKeyOpen(null)}/>
      )}

      {confirmStop && canStop && (
        <Modal title="END MISSION?" onClose={() => setConfirmStop(false)} footer={(
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <GoldButton label="KEEP GOING" height={46} onClick={() => setConfirmStop(false)} style={{ fontSize: 13, letterSpacing: '0.12em' }}/>
            <GhostButton label="END" onClick={handleStopEnd} style={{ border: `1px solid ${RED_BORDER}`, color: '#FCA5A5' }}/>
          </div>
        )}>
          <div style={{ font: `500 14px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 }}>XP counts once you pass a quarter of the mission.</div>
        </Modal>
      )}
    </PhoneFrame>
  );
}

// YOUR SCORE: an in-page panel (not a modal: no scrim to tap away, no close
// button). It replaces the clock, rows, pace and controls until SAVE.
function ScorePanel({ mission, draft, finishSec, rpr, onDraft, onSave, onNotYet }) {
  const rule = mission.scoreRule || {};
  const set = (patch) => onDraft(d => ({ ...d, ...patch }));
  const setBlock = (b, patch) => onDraft(d => ({ ...d, blocks: d.blocks.map((x, i) => (i === b ? { ...x, ...patch } : x)) }));
  const repsMax = Math.max(0, rpr - 1);
  const score = scoreFromDraft(mission, draft, finishSec);

  let body = null;
  if (!draft) {
    body = null;
  } else if (draft.end === 'finish') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>TIME</span>
        <span style={{ font: `700 44px ${HEAD}`, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{mmss(finishSec)}</span>
      </div>
    );
  } else if (draft.end === 'cap') {
    body = (
      <>
        <div style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.14em', color: GOLD }}>TIME CAP · {mmss(mission.capSec || 0)}</div>
        <ScoreStepper label="REPS AT THE CAP" value={draft.reps} max={rpr * (mission.rounds || 1)} onChange={(v) => set({ reps: v })}/>
      </>
    );
  } else if (rule.kind === 'roundsReps' && Array.isArray(draft.blocks)) {
    body = (
      <>
        {draft.blocks.map((b, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.14em', color: GOLD }}>BLOCK {i + 1}</div>
            <ScoreStepper label="ROUNDS" name={`block ${i + 1} rounds`} value={b.rounds} onChange={(v) => setBlock(i, { rounds: v })}/>
            <ScoreStepper label="REPS" name={`block ${i + 1} reps`} value={b.reps} max={repsMax} onChange={(v) => setBlock(i, { reps: v })}/>
          </div>
        ))}
        <div style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.12em', color: '#fff' }}>TOTAL {formatScore(score)}</div>
      </>
    );
  } else if (rule.kind === 'roundsReps') {
    body = (
      <>
        <ScoreStepper label="ROUNDS" value={draft.rounds} onChange={(v) => set({ rounds: v })}/>
        <ScoreStepper label="REPS" value={draft.reps} max={repsMax} onChange={(v) => set({ reps: v })}/>
      </>
    );
  } else if (rule.kind === 'minutesHeld') {
    body = <ScoreStepper label="MINUTES HELD" value={draft.minutesHeld} max={draft.of} onChange={(v) => set({ minutesHeld: v })}/>;
  } else if (rule.kind === 'reps') {
    body = <ScoreStepper label={rule.label || 'REPS'} name="reps" value={draft.reps} onChange={(v) => set({ reps: v })}/>;
  }

  return (
    <section style={{ borderRadius: 14, background: CARD, border: '1px solid rgba(242,190,69,0.45)', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ font: `700 17px ${HEAD}`, letterSpacing: '0.12em', color: '#fff' }}>YOUR SCORE</div>
      {body}
      <GoldButton label="SAVE" height={56} onClick={onSave}/>
      {draft?.end === 'finish' && <GhostButton label="NOT YET" onClick={onNotYet}/>}
    </section>
  );
}
