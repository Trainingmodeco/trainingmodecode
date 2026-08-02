import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, RotateCcw, Square, SkipForward, CircleCheck as CheckCircle } from 'lucide-react';
import { generateFightFocusSession } from './data/sessionGenerator';
import { speakAsync, speakOrDelay, cancelSpeech, primeSpeech, stopVoiceSession, delay } from './voiceCoach';
import useWakeLock from './hooks/useWakeLock';
import useIntegritySession from './hooks/useIntegritySession';
import useAutoPauseOnHidden from './hooks/useAutoPauseOnHidden';
import { playBell, playBeep, playRiser, unlockAudio } from './data/audioEngine';
import { nextCueDelaySec, RUSH_ACTIVATION, RUSH_COMPLETE } from './data/rushVoice';
import { createRushCaller } from './data/rushMoves';
import { BossHpBar } from './shared/BossFinale';
import { BossSlam } from './shared/AnswerTheBell';
import { packOpts, packLine } from './data/voicePacks';
import { recordGhostFromSession, finishGhostBattle, ghostCountAtTime } from './data/ghostBattles';
import VoiceMixer from './shared/VoiceMixer';
import useStrikeCounter from './hooks/useStrikeCounter';
import StrikeHud from './shared/StrikeHud';
import StrikeCounterSheet from './shared/StrikeCounterSheet';
import { C } from './Styles';
import { getCoachCopy } from './data/coachCopy';
import { RushOverlay, RushPersistentEffects, RushTimerAura, RushGlowBurst } from './RushEffects';
import { isRushAt, rushPatternLabel } from './shared/rushSchedule';
import { scheduleEncouragements, pickEncouragement } from './data/coachEncouragement';
import { formatCall } from './data/strikeNumbering';
import { loadProfile as loadUserProfile } from './data/userProfile';
import CoachCaption from './CoachCaption';
import TrainingCTA from './shared/TrainingCTA';

const GOLD = C.gold;
const RING_SIZE = 394;
// Radius tuned so the progress arc sits on the outer edge of ring-fight.png.
const RING_R = 162;
const RING_STROKE = 12;

function getPhaseColor(remaining, phase, rush) {
  if (phase === 'rest') return '#4f8cff';
  if (remaining <= 30) return '#ef4444';
  if (rush) return C.rush;
  if (remaining > 60) return '#a855f7';
  return '#f59e0b';
}

function getTipPosition(offset, circ, R, cx, cy) {
  const angle = ((circ - offset) / circ) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) };
}

export default function FightFocusTimer({ discipline, cfg, onEnd, initialPaused, onStateChange, initialResumeData }) {
  useWakeLock(true);
  // 2.4b — a camp block injects its own per-round titles/prompts (real skill or
  // conditioning goals). When present they drive the session instead of the
  // generated fight combos; the normal Fight Focus path is untouched.
  const rounds = useMemo(
    () => (cfg.blockRounds && cfg.blockRounds.length
      ? cfg.blockRounds
      : generateFightFocusSession({ discipline, difficulty: cfg.difficulty, rounds: cfg.rounds })),
    [discipline, cfg.difficulty, cfg.rounds, cfg.blockRounds],
  );
  const baseRoundSec = cfg.roundMin * 60;

  // The setup screen stores display casing ('Easy' | 'Normal' | 'Hard'), so any
  // comparison has to lowercase at the boundary. Derived once here because the
  // combo-gap test below silently matched nothing when it compared 'hard'
  // against 'Hard' — Easy and Hard both fell through to the Normal spacing.
  const diff = String(cfg.difficulty || 'normal').toLowerCase();

  const integrity = useIntegritySession('fightFocus', cfg.rounds);
  const integrityStartedRef = useRef(false);
  const [rapidWarning, setRapidWarning] = useState(null);

  const [phase, setPhase] = useState(initialResumeData?.phase ?? 'round');
  const [roundIdx, setRoundIdx] = useState(initialResumeData?.roundIdx ?? 0);
  // Boss finale — a block round may carry its own length (3-min fight-focus
  // rounds into 5-min MMA rounds); everything downstream reads THIS round's
  // length, so mixed-length sessions just work.
  const roundSec = rounds[Math.min(roundIdx, rounds.length - 1)]?.length_sec || baseRoundSec;
  const restSecOf = (i) => rounds[Math.min(i, rounds.length - 1)]?.rest_sec ?? cfg.restSec;
  const [remaining, setRemaining] = useState(initialResumeData?.remaining ?? roundSec);
  const [paused, setPaused] = useState(!!initialPaused);
  const [rush, setRush] = useState(false);
  const [done, setDone] = useState(false);
  const [countdown, setCountdown] = useState(initialPaused ? null : '3');
  const [countdownSub, setCountdownSub] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false);
  // 49c — the boss slam. Fires ONCE per session on the reveal round's first
  // WORK call (round 10 on a 12-round finale; the final circuit on the
  // 9-round gauntlet) and HOLDS THE ROUND CLOCK while it plays, so the
  // cutscene never costs the athlete reps.
  const [bossRevealDone, setBossRevealDone] = useState(false);
  const [slamOpen, setSlamOpen] = useState(false);
  const bossRevealIdx = cfg.rounds >= 12 ? 9 : cfg.rounds - 1;
  useEffect(() => {
    if (!cfg.bossFinale || bossRevealDone) return;
    if (phase !== 'round' || countdown !== null) return;   // never mid-rest
    if (roundIdx !== bossRevealIdx) return;
    setBossRevealDone(true);
    setSlamOpen(true);
  }, [cfg.bossFinale, bossRevealDone, phase, countdown, roundIdx, bossRevealIdx]);
  const [showRushOverlay, setShowRushOverlay] = useState(false);
  const [captionText, setCaptionText] = useState('');
  // 1.4 — motion-verified thrown strikes, counted only during a live work round.
  const [strikeSheetOpen, setStrikeSheetOpen] = useState(false);
  const rushSpoken = useRef(false);
  // 46b — the surge caller: explosive movements / strikes / both per the
  // athlete's CALL MIX, with a hype line every third call.
  const rushVoice = useRef(createRushCaller({ mix: cfg.rushMix, discipline }));
  const rushCueIn = useRef(0);
  const lastRushCountdownSecond = useRef(null);
  const lastBeepSecondRef = useRef(null);
  const roundStartBellPlayedRef = useRef(false);
  const roundEndBellPlayedRef = useRef(false);
  const roundVersion = useRef(0);
  const encourageSchedule = useRef([]);
  const encourageUsedIds = useRef(new Set());
  const encourageFiredSet = useRef(new Set());
  const skipInitialIntro = useRef(!!initialPaused);

  const phaseRef     = useRef('round');
  const roundIdxRef  = useRef(0);
  const rushRef      = useRef(false);
  const doneRef      = useRef(false);

  useEffect(() => { phaseRef.current    = phase;    }, [phase]);
  useEffect(() => { roundIdxRef.current = roundIdx; }, [roundIdx]);
  useEffect(() => { rushRef.current     = rush;     }, [rush]);
  useEffect(() => { doneRef.current     = done;     }, [done]);

  // 1.4 — accelerometer strike counter, live only during a work round.
  const roundActive = phase === 'round' && countdown === null && !paused && !done;
  const strike = useStrikeCounter({ active: roundActive });
  const thrownRef = useRef(0);
  const motionRef = useRef(false);
  thrownRef.current = strike.count;
  motionRef.current = strike.motionSeen;

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ phase, roundIdx, remaining });
    }
  }, [phase, roundIdx, remaining, onStateChange]);

  // Spec 22 — voice pack (per campaign via cfg.voicePack): flavors tone +
  // greeting/rest/done phrasing. 'coach' keeps the original neutral lines;
  // counts, movement names, and safety wording stay literal regardless.
  const packId = cfg.voicePack || 'coach';
  const vOpts = useMemo(() => packOpts(packId), [packId]);
  const flavored = packId !== 'coach';
  const halfwayRef = useRef(null);

  // Specs/27 B1.5 — arcade combo calling. When a round entry carries
  // pre-rendered combo calls (cfg.blockRounds[i].combos, seeded from the
  // stage's combo_spec), voice them on a cadence during the round — Combo
  // Coach style. Normal Fight Focus rounds (no combos field) are untouched.
  const [curCombo, setCurCombo] = useState(null);
  const comboIdxRef = useRef(0);
  const comboRoundRef = useRef(-1);
  const lastComboAtRef = useRef(-999);

  // Ghost Battles — record this session's pace (strike timestamps in WORK
  // seconds + per-round totals) so a verified run becomes a ghost; when
  // cfg.ghost is set, race its replay live and resolve at the final bell.
  const ghost = cfg.ghost || null;
  const workElapsedRef = useRef(0);
  const strikeTimesRef = useRef([]);
  const lastThrownAtTickRef = useRef(0);
  const roundStartThrownRef = useRef(0);
  const perRoundStrikesRef = useRef([]);
  const [ghostVerdict, setGhostVerdict] = useState(null);

  // Spec 27 B2 — bodyweight FINISHER at session end (cfg.finishers, difficulty-
  // scaled from the fight module). After the final bell, run each capped burst
  // (movement + work_sec) with voice, then hand off to the normal end sequence.
  const [finisher, setFinisher] = useState(null); // { idx, remaining } | null
  const endArgsRef = useRef(null);
  const finishers = cfg.finishers || [];

  const runIntro = useCallback(async (rIdx) => {
    cancelSpeech();
    const version = ++roundVersion.current;
    const aborted = () => version !== roundVersion.current;
    const voice = cfg.voiceOn;

    const cur = rounds[rIdx];
    const focus = cur?.round_title || 'Free flow';

    setCountdownSub(`ROUND ${rIdx + 1}`);

    setCountdown('3');
    await speakOrDelay('3', 1000, { voice, ...vOpts });
    if (aborted()) return;

    setCountdown('2');
    await speakOrDelay('2', 1000, { voice, ...vOpts });
    if (aborted()) return;

    setCountdown('1');
    await speakOrDelay('1', 1000, { voice, ...vOpts });
    if (aborted()) return;

    playBell(1);
    roundStartBellPlayedRef.current = true;
    await delay(400);
    if (aborted()) return;

    setCountdown(`ROUND ${rIdx + 1}`);
    setCountdownSub(focus);
    const startLine = rIdx === 0 && flavored ? packLine(packId, 'start') : null;
    await speakOrDelay(`${startLine ? `${startLine} ` : ''}Round ${rIdx + 1}. ${focus}.${cur?.coach_prompt ? ` ${cur.coach_prompt}` : ''}`, 1200, { voice, ...vOpts });
    if (aborted()) return;

    setCountdown('GO');
    setCountdownSub('');
    await speakOrDelay('Go!', 600, { voice, ...vOpts });
    if (aborted()) return;

    setCountdown(null);
    setCountdownSub('');
  }, [rounds, cfg.voiceOn, packId, vOpts, flavored]);

  // Close out the session: resolve a ghost battle (if racing), speak the closing
  // line, then hand back to the host via onEnd. Called either straight after the
  // final bell, or after the end-of-session finisher (spec 27 B2) completes.
  const endNow = useCallback((integrityResult) => {
    let ghostDelay = 1500;
    if (ghost) {
      const { result, headline } = finishGhostBattle(ghost, {
        totalStrikes: thrownRef.current,
        bestRound: Math.max(0, ...perRoundStrikesRef.current),
        completionSec: workElapsedRef.current,
        // Item 11c — the result screen shows your round breakdown, so bank it
        // with the battle. The ghost has no per-round data (GhostRecord keeps
        // 10s buckets, not rounds), which is why the screen compares totals and
        // best round rather than inventing a round-for-round matchup.
        perRoundStrikes: [...perRoundStrikesRef.current],
      });
      setGhostVerdict({ outcome: result.outcome, headline });
      ghostDelay = 3600;
      if (cfg.voiceOn) setTimeout(() => speakAsync(result.outcome === 'victory' ? 'Ghost defeated.' : result.outcome === 'defeat' ? 'The ghost takes this one. Run it back.' : 'Dead heat. A draw.', vOpts), 1400);
    }
    setTimeout(() => { if (cfg.voiceOn) speakAsync((flavored && packLine(packId, 'done')) || getCoachCopy('fightComplete'), vOpts); }, 400);
    setTimeout(() => { stopVoiceSession(); onEnd(rounds, cfg, cfg.rounds, integrityResult, { thrown: thrownRef.current, motionUsed: motionRef.current }); }, ghostDelay);
  }, [ghost, cfg, vOpts, flavored, packId, rounds, onEnd]);

  useEffect(() => {
    rushSpoken.current = false;
    lastRushCountdownSecond.current = null;
    lastBeepSecondRef.current = null;
    roundStartBellPlayedRef.current = false;
    roundEndBellPlayedRef.current = false;
    encourageSchedule.current = scheduleEncouragements(roundSec, cfg.encouragement || 'normal');
    encourageFiredSet.current = new Set();
    setRemaining(roundSec);

    if (!integrityStartedRef.current) {
      integrityStartedRef.current = true;
      integrity.startUnit('rounds');
    }

    if (skipInitialIntro.current) {
      skipInitialIntro.current = false;
      return;
    }

    let cancelled = false;
    const start = async () => {
      unlockAudio();
      if (cfg.voiceOn) await primeSpeech();
      if (!cancelled) runIntro(roundIdx);
    };
    start();
    return () => { cancelled = true; cancelSpeech(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx]);

  useEffect(() => {
    // slamOpen holds the clock: the 49c cutscene must not burn round time.
    if (paused || done || countdown !== null || slamOpen) return;
    const id = setInterval(() => setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, done, countdown, slamOpen]);

  useEffect(() => {
    if (phase !== 'round' || paused || done || countdown !== null) return;
    if (cfg.encouragement === 'off' || !cfg.voiceOn) return;
    const elapsed = roundSec - remaining;
    const schedule = encourageSchedule.current;
    for (const t of schedule) {
      if (elapsed === t && !encourageFiredSet.current.has(t)) {
        encourageFiredSet.current.add(t);
        const quote = pickEncouragement(discipline, elapsed, roundSec, encourageUsedIds.current);
        if (quote) {
          encourageUsedIds.current.add(quote.id);
          setCaptionText(quote.text);
          speakAsync(quote.text, { rate: 0.95 });
        }
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase, paused, done, countdown]);

  useEffect(() => {
    if (doneRef.current || remaining > 0) {
      // Ghost recording tick: advance the WORK clock and timestamp new strikes.
      if (phaseRef.current === 'round' && !doneRef.current) {
        workElapsedRef.current += 1;
        const delta = thrownRef.current - lastThrownAtTickRef.current;
        if (delta > 0) for (let i = 0; i < delta; i++) strikeTimesRef.current.push(workElapsedRef.current);
        lastThrownAtTickRef.current = thrownRef.current;
      }
      // Boss finale — a block round can carry its own rush spec; it activates
      // the surge even when the athlete didn't toggle Rush Mode on.
      const roundRush = rounds[roundIdxRef.current]?.rush;
      const rushPatternNow = roundRush?.pattern || cfg.rushPattern || 'endRound';
      if (phaseRef.current === 'round' && (cfg.rushMode || roundRush)) {
        const elapsed = roundSec - remaining;
        const wantRush = isRushAt(rushPatternNow, elapsed, remaining, roundSec, roundIdxRef.current);
        if (wantRush && !rushRef.current) {
          setRush(true);
          setShowRushOverlay(true);
          if (cfg.voiceOn && !rushSpoken.current) {
            rushSpoken.current = true;
            playRiser();
            speakAsync(RUSH_ACTIVATION);
            rushVoice.current.reset();
            rushCueIn.current = nextCueDelaySec();
          }
        } else if (!wantRush && rushRef.current) {
          setRush(false);
          setShowRushOverlay(false);
          rushSpoken.current = false;
          // "Rush mode complete" only makes sense if there's session left — at
          // the final bell the bell itself is the closing statement.
          const moreToCome = remaining > 3 || roundIdxRef.current + 1 < cfg.rounds;
          if (cfg.voiceOn && moreToCome) speakAsync(RUSH_COMPLETE);
        }

        // Push cues while the surge runs, spaced 8-10s, never during the
        // final-10s number countdown.
        if (rushRef.current && cfg.voiceOn) {
          rushCueIn.current -= 1;
          const inFinalCountdown = rushPatternNow.startsWith('end') && remaining <= 10;
          if (rushCueIn.current <= 0) {
            if (!inFinalCountdown && remaining > 3) {
              speakAsync(rushVoice.current.nextLine());
              rushCueIn.current = nextCueDelaySec();
            } else {
              rushCueIn.current = 1;
            }
          }
        }
      }
      if (
        phaseRef.current === 'round' && (cfg.rushMode || roundRush) && rushRef.current &&
        rushPatternNow.startsWith('end') &&
        remaining >= 1 && remaining <= 10 &&
        cfg.voiceOn && lastRushCountdownSecond.current !== remaining
      ) {
        lastRushCountdownSecond.current = remaining;
        speakAsync(String(remaining));
      }
      // Spec 22 — halfway call on longer rounds (skipped in rush countdowns).
      if (
        phaseRef.current === 'round' && cfg.voiceOn && roundSec >= 90 &&
        remaining === Math.ceil(roundSec / 2) && !rushRef.current &&
        halfwayRef.current !== roundIdxRef.current
      ) {
        halfwayRef.current = roundIdxRef.current;
        speakAsync('Halfway.', vOpts);
      }
      // Specs/27 B1.5 — cadence-called combos while an arcade round runs.
      if (phaseRef.current === 'round' && countdown === null) {
        const curR = rounds[roundIdxRef.current];
        if (curR?.combos?.length) {
          if (comboRoundRef.current !== roundIdxRef.current) {
            comboRoundRef.current = roundIdxRef.current;
            comboIdxRef.current = 0;
            lastComboAtRef.current = -999;
            setCurCombo(null);
          }
          const comboElapsed = roundSec - remaining;
          const gap = diff === 'hard' ? 7 : diff === 'easy' ? 11 : 9;
          if (comboElapsed >= 2 && remaining > 6 && !rushRef.current &&
              comboElapsed - lastComboAtRef.current >= gap) {
            lastComboAtRef.current = comboElapsed;
            const call = curR.combos[comboIdxRef.current % curR.combos.length];
            comboIdxRef.current += 1;
            // PROMPT N — campaign combos stay words in the data; the athlete's
            // CALL STYLE converts them here (covers Arcade AND Camp).
            const styled = formatCall(call, loadUserProfile()?.callStyle);
            setCurCombo(styled.display);
            if (cfg.voiceOn) speakAsync(styled.speech, vOpts);
          }
        }
      }
      if (
        phaseRef.current === 'round' &&
        remaining >= 1 && remaining <= 3 &&
        lastBeepSecondRef.current !== remaining
      ) {
        lastBeepSecondRef.current = remaining;
        playBeep();
      }
      return;
    }
    if (phaseRef.current === 'round') {
      integrity.completeUnit();
      setRush(false);
      lastRushCountdownSecond.current = null;
      if (roundIdxRef.current + 1 >= cfg.rounds) {
        if (!roundEndBellPlayedRef.current) {
          roundEndBellPlayedRef.current = true;
          playBell(3);
        }
        setDone(true);
        const integrityResult = integrity.finalize({ thrown: thrownRef.current, motionUsed: motionRef.current });
        // Ghost Battles — close the last round, save this run as a ghost when
        // it's verified, and (if racing) resolve the battle at the final bell.
        perRoundStrikesRef.current.push(thrownRef.current - roundStartThrownRef.current);
        const ghostVerified = (!integrityResult || integrityResult.isFullyValid) && thrownRef.current > 0;
        recordGhostFromSession({
          mode: 'fight_focus', discipline, difficulty: diff,
          roundsConfig: { rounds: cfg.rounds, roundSec, restSec: cfg.restSec },
          strikeTimesSec: strikeTimesRef.current, totalSec: Math.max(1, workElapsedRef.current),
          perRoundStrikes: perRoundStrikesRef.current, completionSec: workElapsedRef.current,
          verified: ghostVerified,
        });
        // Spec 27 B2 — run the bodyweight finisher (if any) before the close.
        if (finishers.length) {
          endArgsRef.current = integrityResult;
          const f0 = finishers[0];
          setFinisher({ idx: 0, remaining: f0.work_sec });
          if (cfg.voiceOn) setTimeout(() => speakAsync(`Finisher. ${f0.movement}. ${f0.work_sec} seconds. Go!`, vOpts), 300);
        } else {
          endNow(integrityResult);
        }
      } else {
        if (!roundEndBellPlayedRef.current) {
          roundEndBellPlayedRef.current = true;
          playBell(2);
        }
        // Ghost recording — bank this round's strikes before the rest phase.
        perRoundStrikesRef.current.push(thrownRef.current - roundStartThrownRef.current);
        roundStartThrownRef.current = thrownRef.current;
        setPhase('rest');
        setRemaining(restSecOf(roundIdxRef.current));
        // Rest + next-up (spec 22): name the coming round so nothing needs reading.
        const nxt = rounds[roundIdxRef.current + 1];
        setTimeout(() => { if (cfg.voiceOn) speakAsync(`${(flavored && packLine(packId, 'rest')) || 'Rest.'}${nxt?.round_title ? ` Up next: ${nxt.round_title}.` : ''}`, vOpts); }, 400);
      }
    } else {
      setPhase('round');
      integrity.startUnit('rounds');
      setRoundIdx(i => i + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Spec 27 B2 — finisher countdown: each burst runs its work_sec, then advances
  // to the next finisher or closes the session via endNow.
  useEffect(() => {
    if (!finisher || paused) return;
    if (finisher.remaining <= 0) {
      const next = finisher.idx + 1;
      if (next < finishers.length) {
        const fn = finishers[next];
        playBell(1);
        setFinisher({ idx: next, remaining: fn.work_sec });
        if (cfg.voiceOn) speakAsync(`${fn.movement}. ${fn.work_sec} seconds. Go!`, vOpts);
      } else {
        playBell(2);
        setFinisher(null);
        endNow(endArgsRef.current);
      }
      return;
    }
    if (finisher.remaining <= 3) playBeep();
    const id = setTimeout(() => setFinisher(f => (f ? { ...f, remaining: f.remaining - 1 } : f)), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finisher, paused]);

  const handleRewind = () => {
    cancelSpeech();
    roundVersion.current++;
    setRush(false);
    lastRushCountdownSecond.current = null;
    lastBeepSecondRef.current = null;
    roundStartBellPlayedRef.current = false;
    roundEndBellPlayedRef.current = false;
    setPhase('round');
    if (roundIdx > 0) {
      setRoundIdx(i => i - 1);
    } else {
      setRemaining(roundSec);
      setCountdown('3');
      runIntro(0);
    }
  };

  const handleNext = () => {
    cancelSpeech();
    roundVersion.current++;
    const actionResult = integrity.recordAction('next');
    if (actionResult.suspicious) {
      setRapidWarning(actionResult.message);
      setTimeout(() => setRapidWarning(null), 2500);
    }
    if (roundIdx + 1 < cfg.rounds) {
      integrity.completeUnit();
      setRush(false);
      roundStartBellPlayedRef.current = false;
      roundEndBellPlayedRef.current = false;
      setPhase('round');
      integrity.startUnit('rounds');
      setRoundIdx(i => i + 1);
    } else {
      // FINISH on the last round: still run the end-of-session finisher (spec 27
      // B2) before closing, so tapping FINISH doesn't skip it.
      setDone(true);
      const integrityResult = integrity.finalize({ thrown: thrownRef.current, motionUsed: motionRef.current });
      if (finishers.length) {
        endArgsRef.current = integrityResult;
        const f0 = finishers[0];
        setFinisher({ idx: 0, remaining: f0.work_sec });
        if (cfg.voiceOn) setTimeout(() => speakAsync(`Finisher. ${f0.movement}. ${f0.work_sec} seconds. Go!`, vOpts), 300);
      } else {
        endNow(integrityResult);
      }
    }
  };

  const handlePause = () => {
    if (!paused) {
      cancelSpeech();
      integrity.pause();
    } else {
      integrity.resume();
    }
    setPaused(p => !p);
  };

  // Auto-pause when the app is backgrounded (honest pause, not a cheat flag).
  useAutoPauseOnHidden(!paused && !done && countdown === null && !finisher, handlePause, integrity);

  const handleEndConfirm = () => {
    stopVoiceSession();
    roundVersion.current++;
    const completed = Math.min(phase === 'rest' ? roundIdx + 1 : roundIdx, cfg.rounds);
    const integrityResult = integrity.finalize({ thrown: thrownRef.current, motionUsed: motionRef.current });
    onEnd(rounds, cfg, completed, integrityResult, { thrown: thrownRef.current, motionUsed: motionRef.current });
  };

  const isFinalRound = roundIdx + 1 >= cfg.rounds;
  const maxTime = phase === 'rest' ? restSecOf(roundIdx) : roundSec;
  const pct = (remaining / maxTime) * 100;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const circ = 2 * Math.PI * RING_R;
  const offset = circ - (pct / 100) * circ;
  const ringColor = getPhaseColor(remaining, phase, rush);
  const cur = rounds[roundIdx];
  const tip = getTipPosition(offset, circ, RING_R, cx, cy);
  const dangerPulse = phase === 'round' && remaining <= 30 && remaining > 0;
  const last10 = phase === 'round' && remaining <= 10 && remaining > 0;
  const stripeClass = dangerPulse ? 'danger-stripes' : rush ? 'rush-stripes' : '';

  const totalElapsed = roundIdx * (roundSec + cfg.restSec) + (maxTime - remaining);
  const elapsedMins = Math.floor(totalElapsed / 60);
  const elapsedSecs = totalElapsed % 60;
  const roundsLeft = cfg.rounds - roundIdx - (phase === 'rest' ? 1 : 0);

  return (
    <PhoneFrame useBrandBg extraClass={stripeClass}>
      {/* Countdown overlay */}
      {countdown !== null && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(10,0,20,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="anim-fade-up" key={countdown} style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: /^\d$/.test(countdown) ? 180 : countdown === 'GO' ? 120 : 42,
            color: countdown === 'GO' ? '#22c55e' : GOLD,
            lineHeight: 1, textAlign: 'center', padding: '0 20px',
            textShadow: countdown === 'GO'
              ? '0 0 60px rgba(34,197,94,0.8)'
              : '0 0 60px rgba(253,224,71,0.8)',
          }}>{countdown}</div>
          {countdownSub && (
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 22, fontWeight: 600,
              color: '#fff', letterSpacing: '0.1em', marginTop: 14, textAlign: 'center',
              opacity: 0.85,
            }}>{countdownSub}</div>
          )}
        </div>
      )}

      {/* Spec 27 B2 — end-of-session finisher overlay */}
      {finisher && finishers[finisher.idx] && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 130, background: 'rgba(10,0,20,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: 10, color: '#f59e0b', letterSpacing: '0.1em', marginBottom: 16 }}>🔥 FINISHER {finisher.idx + 1}/{finishers.length}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 24, color: '#fff', textAlign: 'center', marginBottom: 12, letterSpacing: '0.04em' }}>{String(finishers[finisher.idx].movement).toUpperCase()}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 76, color: '#f59e0b', lineHeight: 1, textShadow: '0 0 34px rgba(245,158,11,0.7)' }}>{finisher.remaining}</div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 700, color: '#c4a4d8', letterSpacing: '0.14em', marginTop: 10 }}>SECONDS · GO!</div>
        </div>
      )}

      {/* Danger pulse overlay */}
      {dangerPulse && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, rgba(239,68,68,0.08) 0%, transparent 70%)',
          animation: 'danger-pulse 2s ease-in-out infinite',
        }} />
      )}

      <RushPersistentEffects active={rush} remaining={remaining} />
      {showRushOverlay && <RushOverlay onDone={() => setShowRushOverlay(false)} />}
      {slamOpen && (
        <BossSlam
          bossName={cfg.bossName} round={bossRevealIdx + 1} total={cfg.rounds}
          skippable={!!cfg.bossCleared} onDone={() => setSlamOpen(false)}
        />
      )}

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '100dvh', padding: '12px 14px calc(140px + env(safe-area-inset-bottom, 0px))',
      }}>

        {/* Ghost Battles — live VS strip: you vs the ghost's replay at the same
            point in WORK time. Green when you lead, red when the ghost does. */}
        {ghost && !ghostVerdict && (() => {
          const gCount = Math.round(ghostCountAtTime(ghost, workElapsedRef.current));
          const lead = thrownRef.current - gCount;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '6px 12px', marginBottom: 6, background: 'rgba(20,6,40,0.85)', border: '1px solid rgba(176,106,255,0.5)' }}>
              <span style={{ font: "900 10px 'Orbitron',sans-serif", color: '#fff' }}>YOU {thrownRef.current}</span>
              <span style={{ font: "800 8px 'Orbitron',sans-serif", color: '#9a90b8' }}>VS</span>
              <span style={{ font: "900 10px 'Orbitron',sans-serif", color: '#c9a6ff' }}>👻 {gCount}</span>
              <span style={{ marginLeft: 'auto', font: "900 9px 'Orbitron',sans-serif", color: lead >= 0 ? '#22c55e' : '#ef4444' }}>{lead >= 0 ? `▲ +${lead}` : `▼ ${lead}`}</span>
            </div>
          );
        })()}

        {/* Ghost verdict — the final-bell beat before the summary screen */}
        {ghostVerdict && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(6,0,14,0.82)' }}>
            <div style={{ textAlign: 'center', padding: '22px 26px', borderRadius: 16, border: `1.5px solid ${ghostVerdict.outcome === 'victory' ? 'rgba(34,197,94,0.7)' : ghostVerdict.outcome === 'defeat' ? 'rgba(239,68,68,0.7)' : 'rgba(253,224,71,0.6)'}`, background: 'rgba(14,4,28,0.96)', boxShadow: '0 18px 50px rgba(0,0,0,0.7)' }}>
              <div style={{ fontSize: 34, marginBottom: 6 }}>{ghostVerdict.outcome === 'victory' ? '🏆' : ghostVerdict.outcome === 'defeat' ? '👻' : '🤝'}</div>
              <div style={{ font: "900 15px 'Orbitron',sans-serif", color: ghostVerdict.outcome === 'victory' ? '#22c55e' : ghostVerdict.outcome === 'defeat' ? '#fca5a5' : '#fde047', letterSpacing: '0.06em' }}>
                {ghostVerdict.outcome === 'victory' ? 'GHOST DEFEATED' : ghostVerdict.outcome === 'defeat' ? 'GHOST WINS' : 'DEAD HEAT'}
              </div>
              <div style={{ font: "700 10px 'Rajdhani',sans-serif", color: '#c4a4d8', marginTop: 6 }}>{ghostVerdict.headline}</div>
              {ghostVerdict.outcome === 'victory' && <div style={{ font: "800 9px 'Orbitron',sans-serif", color: '#fde047', marginTop: 8 }}>+75 BONUS XP</div>}
            </div>
          </div>
        )}

        {/* LT-1 — cue level, adjustable mid-round without pausing. */}
        <VoiceMixer top={10} right={10}/>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
          <button onClick={() => setConfirmEnd(true)} style={{ background: 'none', border: 'none', color: '#fff', padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
            color: GOLD, letterSpacing: '0.12em',
            textShadow: '0 0 10px rgba(253,224,71,0.3)',
          }}>FIGHT FOCUS</div>
          <div style={{ width: 30 }}/>
        </div>

        {/* Boss finale — the persisting boss HP bar; every cleared round chips it. */}
        {cfg.bossFinale && (
          <div style={{ width: '100%', marginBottom: 7 }}>
            <BossHpBar bossName={cfg.bossName} total={cfg.rounds} cleared={done ? cfg.rounds : roundIdx + (phase === 'rest' ? 1 : 0)}/>
          </div>
        )}

        {/* Status chips (design 13a) */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginBottom: 7 }}>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#facc15', border: '1px solid rgba(253,224,71,0.5)', borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em' }}>
            ROUND {roundIdx + 1}/{cfg.rounds}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#c4a4d8', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em' }}>
            {String(discipline).toUpperCase()}
          </span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#c4a4d8', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 6, padding: '4px 9px', letterSpacing: '0.04em' }}>
            {String(cfg.difficulty).toUpperCase()}
          </span>
        </div>

        {/* 1.4 — live motion strike counter */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, minHeight: 22 }}>
          <StrikeHud supported={strike.supported} permission={strike.permission} count={strike.count} onOpen={() => setStrikeSheetOpen(true)}/>
        </div>

        {/* Ring Timer with dimmed art background — responsive so it never clips on
            narrow screens; the SVG viewBox keeps all ring coordinates valid. */}
        <div style={{ position: 'relative', width: 'min(62vw, 250px)', maxWidth: '100%', aspectRatio: '1 / 1', margin: '0 auto 8px' }}>
          {/* Dimmed ring art behind */}
          <img
            src="/static/ring-fight.png"
            alt=""
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', borderRadius: '50%',
              opacity: 0.2,
              pointerEvents: 'none',
            }}
          />

          {rush && <RushTimerAura intenseFinal={remaining <= 10} />}
          {rush && <RushGlowBurst intenseFinal={remaining <= 10} />}

          <svg width="100%" height="100%" viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ display: 'block', overflow: 'visible' }}>
            <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={RING_STROKE} />
            <circle cx={cx} cy={cy} r={RING_R + 14} fill="none"
              stroke={ringColor} opacity="0.15" strokeWidth="1"
              strokeDasharray="3 7"
              className="anim-slow-rotate"
              style={{ transformOrigin: `${cx}px ${cy}px` }} />
            <circle cx={cx} cy={cy} r={RING_R} fill="none"
              stroke={ringColor} strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{
                filter: last10
                  ? `drop-shadow(0 0 18px ${ringColor}) drop-shadow(0 0 36px ${ringColor})`
                  : dangerPulse
                    ? `drop-shadow(0 0 14px ${ringColor}) drop-shadow(0 0 28px ${ringColor})`
                    : `drop-shadow(0 0 8px ${ringColor})`,
                transition: 'stroke-dashoffset 0.9s linear, stroke 0.8s ease, filter 0.8s ease',
                animation: last10 ? 'ring-flash 0.5s ease-in-out infinite alternate' : 'none',
              }} />
            {pct > 0 && pct < 100 && (
              <circle cx={tip.x} cy={tip.y} r={5} fill="#fff"
                stroke={ringColor} strokeWidth="2"
                style={{ filter: `drop-shadow(0 0 10px ${ringColor})` }} />
            )}
          </svg>

          {/* Center content */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: 9,
              color: phase === 'rest' ? '#7fb0ff' : rush ? '#ef4444' : '#facc15',
              letterSpacing: '0.12em', marginBottom: 8, transition: 'color 0.8s ease',
            }}>
              {phase === 'rest' ? '☕ REST' : rush ? '⚡ RUSH' : '🔔 WORK'}
            </div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 46,
              color: '#fff', lineHeight: 1, letterSpacing: '0.02em',
              textShadow: `0 0 20px ${ringColor}`,
              transition: 'text-shadow 0.8s ease',
            }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 10, fontWeight: 700,
              color: '#8b83a8', letterSpacing: '0.1em', marginTop: 8,
            }}>
              OF {Math.floor(maxTime / 60)}:{String(maxTime % 60).padStart(2, '0')}
            </div>
            {phase === 'rest' && (
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 600,
                color: '#4f8cff', letterSpacing: '0.1em', marginTop: 4, opacity: 0.9,
              }}>
                NEXT: ROUND {roundIdx + 2}
              </div>
            )}
            {dangerPulse && phase !== 'rest' && (
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 600,
                color: '#ef4444', letterSpacing: '0.2em', marginTop: 4, opacity: 0.85,
              }}>FINAL 30</div>
            )}
          </div>
        </div>

        {/* Elapsed / rounds-left line (design 13a) */}
        <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#8b83a8', letterSpacing: '0.05em', marginBottom: 7, textAlign: 'center' }}>
          ⏱ {String(elapsedMins).padStart(2, '0')}:{String(elapsedSecs).padStart(2, '0')} ELAPSED · {roundsLeft} ROUND{roundsLeft === 1 ? '' : 'S'} LEFT{cfg.rushMode ? ` · ⚡ ${rushPatternLabel(cfg.rushPattern)}` : ''}
        </div>

        {/* Round indicator dots */}
        <div style={{ display: 'flex', gap: cfg.rounds > 6 ? 4 : 6, justifyContent: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
          {Array.from({ length: cfg.rounds }, (_, i) => {
            const isCompleted = i < roundIdx;
            const isCurrent = i === roundIdx;
            const compact = cfg.rounds > 6;
            return (
              <div key={i} style={{
                width: compact ? 20 : 24, height: compact ? 20 : 24, borderRadius: compact ? 4 : 5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: compact ? 8 : 9,
                background: isCurrent ? 'rgba(253,224,71,0.15)' : isCompleted ? 'rgba(253,224,71,0.06)' : 'rgba(255,255,255,0.03)',
                border: isCurrent ? '1.5px solid rgba(253,224,71,0.7)' : isCompleted ? '1px solid rgba(253,224,71,0.25)' : '1px solid rgba(255,255,255,0.08)',
                color: isCurrent ? GOLD : isCompleted ? 'rgba(253,224,71,0.5)' : 'rgba(255,255,255,0.2)',
                boxShadow: isCurrent ? '0 0 8px rgba(253,224,71,0.3)' : 'none',
              }}>
                {i + 1}
              </div>
            );
          })}
        </div>

        {/* Up next chip (design 13a) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(79,140,255,0.1)', border: '1px solid rgba(79,140,255,0.35)', borderRadius: 99, padding: '7px 15px' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: '#7fb0ff', letterSpacing: '0.08em' }}>UP NEXT</span>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 800, color: '#fff' }}>
              {phase === 'rest'
                ? `ROUND ${roundIdx + 2}`
                : roundIdx + 1 < cfg.rounds
                  ? `REST · ${Math.floor(cfg.restSec / 60)}:${String(cfg.restSec % 60).padStart(2, '0')}`
                  : 'FINAL ROUND'}
            </span>
          </div>
        </div>

        {/* Focus command card */}
        {cur && phase === 'round' && countdown === null && (
          <div className="anim-fade-up" style={{
            textAlign: 'center', marginBottom: 6, padding: '8px 16px', borderRadius: 10,
            background: 'rgba(10,0,20,0.7)', border: `1px solid ${ringColor}33`,
            width: '100%', maxWidth: 340,
          }}>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#fff', fontSize: 12, letterSpacing: '0.1em' }}>
              {cur.round_title.toUpperCase()}
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, fontWeight: 500, color: C.faint, marginTop: 4 }}>
              {cur.coach_prompt}
            </div>
            {curCombo && (
              <div className="anim-fade-up" style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, color: '#ffd75e', fontSize: 14, marginTop: 6, letterSpacing: '0.06em' }}>
                {curCombo.toUpperCase()}
              </div>
            )}
          </div>
        )}

        {/* Controls (design 13a) */}
        <div style={{ width: '100%', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <TrainingCTA
            variant={paused ? 'gold' : 'violet'}
            label={paused ? 'RESUME' : 'PAUSE'}
            icon={paused ? '▶' : '❚❚'}
            height={56}
            onClick={handlePause}
            style={{ fontSize: 16, letterSpacing: '0.12em' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRewind} aria-label="Rewind 10s" style={{
              width: 52, height: 46, borderRadius: 12, cursor: 'pointer',
              border: '1px solid rgba(168,85,247,0.3)', background: '#130e20', color: C.violet,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RotateCcw size={18} />
            </button>
            <button onClick={handleNext} style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer',
              border: isFinalRound ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.14)',
              background: isFinalRound ? 'rgba(34,197,94,0.1)' : '#130e20',
              color: isFinalRound ? '#22c55e' : '#c9bff0',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {isFinalRound ? <>FINISH <CheckCircle size={15} /></> : <>SKIP ROUND <SkipForward size={15} /></>}
            </button>
            <button onClick={() => setConfirmEnd(true)} style={{
              flex: 1, height: 46, borderRadius: 12, cursor: 'pointer',
              border: '1px solid rgba(255,90,90,0.4)', background: 'rgba(255,90,90,0.09)', color: '#ff8a8a',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <Square size={13} /> END
            </button>
          </div>
        </div>
      </div>

      {/* Rapid action warning */}
      {rapidWarning && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 150, padding: '10px 18px', borderRadius: 10,
          background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700,
            color: '#f59e0b', letterSpacing: '0.1em', textAlign: 'center',
          }}>{rapidWarning}</div>
        </div>
      )}

      {/* End confirm modal */}
      {confirmEnd && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 200,
          background: 'rgba(5,0,15,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: 'rgba(12,2,24,0.95)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '28px 24px', textAlign: 'center',
            maxWidth: 300, width: '85%',
            boxShadow: '0 0 40px rgba(239,68,68,0.1)',
          }}>
            <div style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
              color: '#fff', letterSpacing: '0.12em', marginBottom: 10,
            }}>END SESSION?</div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 13, fontWeight: 500,
              color: C.faint, lineHeight: 1.5, marginBottom: 20,
            }}>
              Are you sure you want to end this training session?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmEnd(false)} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>CANCEL</button>
              <button onClick={handleEndConfirm} style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)',
                color: '#ef4444', fontFamily: "'Orbitron',sans-serif", fontWeight: 700,
                fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer',
              }}>END SESSION</button>
            </div>
          </div>
        </div>
      )}

      <CoachCaption text={captionText} />
      {strikeSheetOpen && (
        <StrikeCounterSheet
          supported={strike.supported}
          permission={strike.permission}
          onEnable={strike.requestPermission}
          onClose={() => setStrikeSheetOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}
