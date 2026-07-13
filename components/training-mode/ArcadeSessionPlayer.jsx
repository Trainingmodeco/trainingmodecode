import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PhoneFrame from './PhoneFrame';
import { ChevronLeft, Play, Pause, SkipForward, CircleCheck as CheckCircle, Clock } from 'lucide-react';
import { C } from './Styles';
import { markBlockComplete, completeStage, getSeriesProgress } from './data/arcadeProgress';
import { addFitModeSession, addFightFocusSession } from './data/userStats';
import { IntegritySession, MODE_RULES, isStageFullyValid } from './utils/missionIntegrity';
import CardioProtocolSelector from './CardioProtocolSelector';
import { CARDIO_METHODS } from './data/cardioProtocolData';
import ArcadeStageIntroOverlay from './ArcadeStageIntroOverlay';
import ArcadeBenchmarkPlayer from './ArcadeBenchmarkPlayer';
import ArcadeStageClearOverlay from './ArcadeStageClearOverlay';
import ArcadeCadenceRepPlayer from './ArcadeCadenceRepPlayer';
import ArcadeBackBalanceChooser from './ArcadeBackBalanceChooser';
import ArcadeCardioPlayer from './ArcadeCardioPlayer';
import CardioSummary from './CardioSummary';

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildTaskList(stage, blockKey, arcadeSettings) {
  const block = blockKey === 'fit' ? stage.fitBlock : stage.fightBlock;
  if (!block) return [];

  let tasks = [];

  if (block.tasks) {
    tasks = [...block.tasks];
  } else if (block.tasksPerRound && block.rounds) {
    const isBoss = stage.stageType === 'bossCircuit';
    const isVariation = block.variationByRound;

    for (let r = 0; r < block.rounds; r++) {
      let roundTasks;
      if (isVariation) {
        roundTasks = block.tasksPerRound.filter(t => t.roundNumber === r + 1);
      } else {
        roundTasks = block.tasksPerRound;
      }

      roundTasks.forEach((t, idx) => {
        let cadenceMs = t.cadenceMs;
        if (isBoss && block.cadenceByRound) {
          const cadenceRule = block.cadenceByRound.find(cr => cr.rounds.includes(r + 1));
          if (cadenceRule) cadenceMs = cadenceRule.cadenceMs;
        }
        tasks.push({
          ...t,
          id: `${t.id}-r${r + 1}`,
          title: `${t.title}${block.rounds > 1 && !isVariation ? ` (Round ${r + 1})` : ''}`,
          cadenceMs,
          _round: r + 1,
        });
      });

      if (isBoss && block.backBalanceInsertAfterRounds?.includes(r + 1)) {
        const bbOptions = block.backBalanceInsert?.chooseOne || [];
        if (bbOptions.length > 0) {
          tasks.push({
            id: `bb-insert-r${r + 1}`,
            type: 'backBalance',
            title: 'Back-Balance Work',
            instructions: 'Choose one pulling or posterior-chain option to balance the push-up volume.',
            reps: bbOptions[0].reps || 0,
            durationSeconds: bbOptions[0].durationSeconds || 0,
            equipment: 'Pull-up bar optional',
            category: 'back',
            options: bbOptions,
            _round: r + 1,
          });
        }
      }
    }
  }

  // Add back-balance block if defined at stage level and not already integrated
  if (stage.backBalanceBlock && stage.backBalanceBlock.type !== 'integrated') {
    const bbOpts = stage.backBalanceBlock.options || [];
    if (bbOpts.length > 0) {
      tasks.push({
        id: `bb-stage-${stage.id}`,
        type: 'backBalance',
        title: 'Back-Balance Work',
        instructions: 'Choose one pulling or posterior-chain option to balance the push-up volume.',
        reps: 0,
        equipment: 'Pull-up bar optional',
        category: 'back',
        options: bbOpts,
      });
    }
  }

  // Add integrated back-balance (insert after last fit task)
  if (stage.backBalanceBlock && stage.backBalanceBlock.type === 'integrated') {
    const bbOpts = stage.backBalanceBlock.options || [];
    if (bbOpts.length > 0) {
      tasks.push({
        id: `bb-integrated-${stage.id}`,
        type: 'backBalance',
        title: 'Back-Balance Work',
        instructions: 'Choose one pulling or posterior-chain option to balance the push-up volume.',
        reps: 0,
        equipment: 'Pull-up bar optional',
        category: 'back',
        options: bbOpts,
      });
    }
  }

  // Add cardio block if defined at stage level. Stage 1 has no cardioBlock (benchmark
  // only), so cardio never appears there. For stages where cardio is optional
  // (Stage 2-3), respect the Cardio Finisher toggle; required stages (Stage 4+) always include it.
  if (stage.cardioBlock && blockKey === 'fit') {
    const cardioRequired = stage.cardioBlock.cardioRequired === true;
    const cardioEnabled = cardioRequired || arcadeSettings?.cardioFinisher !== false;
    if (cardioEnabled) {
      const cardioOpts = stage.cardioBlock.options || [];
      const duration = (stage.cardioBlock.durationMinutes || 15) * 60;
      tasks.push({
        id: `cardio-stage-${stage.id}`,
        type: 'cardio',
        title: 'Cardio Protocol',
        instructions: stage.cardioBlock.distanceEquivalent
          ? `Complete cardio equivalent to ${stage.cardioBlock.distanceEquivalent}`
          : `Complete ${stage.cardioBlock.durationMinutes || 15} minutes of cardio`,
        durationSeconds: duration,
        distanceLabel: stage.cardioBlock.distanceEquivalent || null,
        cardioAllowedIds: cardioOpts.length ? cardioOpts.map(o => o.id) : null,
        cardioFormat: 'steady',
        category: 'cardio',
      });
    }
  }

  return tasks;
}

export default function ArcadeSessionPlayer({ series, stage, selectedMode, modeOrder, arcadeSettings, onComplete, onExit, onHome, initialPaused, onStateChange, initialResumeData }) {
  const firstBlock = selectedMode === 'both'
    ? (modeOrder === 'fight-first' ? 'fight' : 'fit')
    : selectedMode;
  const secondBlock = selectedMode === 'both'
    ? (firstBlock === 'fit' ? 'fight' : 'fit')
    : null;

  const [currentBlock, setCurrentBlock] = useState(initialResumeData?.currentBlock ?? firstBlock);
  const [taskIdx, setTaskIdx] = useState(initialResumeData?.taskIdx ?? 0);
  const [timer, setTimer] = useState(initialResumeData?.timer ?? 0);
  const [timerActive, setTimerActive] = useState(false);
  const [currentSet, setCurrentSet] = useState(initialResumeData?.currentSet ?? 1);
  const [resting, setResting] = useState(false);
  const [, setBlockComplete] = useState(false);
  const [promptNextBlock, setPromptNextBlock] = useState(false);
  const [cardioPhase, setCardioPhase] = useState('select');
  const [cardioMethod, setCardioMethod] = useState(null);
  const [cardioResult, setCardioResult] = useState(null);
  const [backBalancePhase, setBackBalancePhase] = useState('choose');
  const [rapidWarning, setRapidWarning] = useState(null);
  const [benchmarkTimer, setBenchmarkTimer] = useState(0);
  const [benchmarkActive, setBenchmarkActive] = useState(false);
  const [sessionPhase, setSessionPhase] = useState(() => {
    if (initialPaused || initialResumeData) return 'active';
    // All stages (benchmark included) open with the shared briefing intro.
    return 'intro';
  });
  const [stageResult, setStageResult] = useState(null);
  const timerRef = useRef(null);
  const benchmarkRef = useRef(null);
  const integrityRef = useRef(null);

  const progress = getSeriesProgress(series?.id);
  const currentStageNum = progress?.currentStage || stage?.stageNumber || 1;
  const completedStageIds = Object.keys(progress?.completedStages || {}).filter(
    id => progress.completedStages[id]?.completed
  );
  const totalXpBefore = progress?.xpEarned || 0;

  const handleIntroComplete = useCallback(() => setSessionPhase('active'), []);

  const handleBenchmarkComplete = useCallback((result) => {
    setStageResult(result);
    setSessionPhase('clear');
  }, []);

  const handleNormalStageComplete = useCallback(() => {
    const xp = stage?.rewards?.xp || 0;
    setStageResult({
      invalid: false,
      rank: null,
      points: xp,
      xpEarned: xp,
      statRewards: stage?.rewards?.statRewards || null,
    });
    setSessionPhase('clear');
  }, [stage]);

  const handleRetryStage = useCallback(() => {
    setStageResult(null);
    setSessionPhase('intro');
    setTaskIdx(0);
    setTimer(0);
    setTimerActive(false);
    setCurrentSet(1);
    setResting(false);
    setBlockComplete(false);
    setPromptNextBlock(false);
    setCardioPhase('select');
    setCardioMethod(null);
    setCardioResult(null);
    setBackBalancePhase('choose');
    setRapidWarning(null);
    setCurrentBlock(firstBlock);
    integrityRef.current?.destroy();
    integrityRef.current = null;
  }, [firstBlock]);

  const tasks = useMemo(() => buildTaskList(stage, currentBlock, arcadeSettings), [stage, currentBlock, arcadeSettings]);

  if (!integrityRef.current) {
    const totalTasks = tasks.length * (secondBlock ? 2 : 1);
    integrityRef.current = new IntegritySession('trainingArcade', totalTasks, MODE_RULES.trainingArcade);
    integrityRef.current.startUnit('hybrid');
  }

  const task = tasks[taskIdx];
  const isTimerTask = task?.type === 'timer' || task?.type === 'rounds' || task?.type === 'cardioTimer';
  const isCardioTask = task?.type === 'cardio' || task?.type === 'cardioTimer';
  const isMainCardio = task?.type === 'cardio';
  const isBenchmark = stage.stageType === 'benchmark';
  const isCadenceTask = task?.type === 'cadenceReps';
  const isBackBalance = task?.type === 'backBalance';

  useEffect(() => {
    if (!timerActive) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  useEffect(() => {
    if (!benchmarkActive) { clearInterval(benchmarkRef.current); return; }
    benchmarkRef.current = setInterval(() => setBenchmarkTimer(t => t + 1), 1000);
    return () => clearInterval(benchmarkRef.current);
  }, [benchmarkActive]);

  useEffect(() => {
    if (isBenchmark && !benchmarkActive && taskIdx === 0) {
      setBenchmarkActive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBenchmark]);

  useEffect(() => {
    return () => { integrityRef.current?.destroy(); };
  }, []);

  useEffect(() => {
    if (typeof onStateChange === 'function') {
      onStateChange({ currentBlock, taskIdx, timer, currentSet });
    }
  }, [currentBlock, taskIdx, timer, currentSet, onStateChange]);

  function handleCompleteTask() {
    setTimerActive(false);
    setTimer(0);
    setResting(false);
    setCurrentSet(1);
    setCardioPhase('select');
    setCardioMethod(null);
    setCardioResult(null);
    setBackBalancePhase('choose');

    const actionResult = integrityRef.current?.recordAction('complete');
    if (actionResult?.suspicious) {
      setRapidWarning(actionResult.message);
      setTimeout(() => setRapidWarning(null), 2500);
    }
    integrityRef.current?.completeUnit();

    if (taskIdx + 1 >= tasks.length) {
      if (isBenchmark) setBenchmarkActive(false);
      markBlockComplete(series.id, stage.id, currentBlock);
      if (currentBlock === 'fit') addFitModeSession(tasks.length, tasks.length);
      else addFightFocusSession(tasks.length, tasks.length);

      if (secondBlock && currentBlock === firstBlock) {
        setBlockComplete(true);
        setPromptNextBlock(true);
      } else {
        const stageValid = integrityRef.current ? isStageFullyValid(integrityRef.current) : true;
        if (stageValid) {
          completeStage(series.id, stage.id, stage.rewards.xp, stage.rewards?.badge, stage.rewards?.title, stage.rewards?.statRewards);
          handleNormalStageComplete();
        } else {
          setStageResult({
            invalid: true,
            reason: 'Mission Validation Failed — No XP Awarded',
            points: 0,
            xpEarned: 0,
            statRewards: null,
          });
          setSessionPhase('clear');
        }
      }
    } else {
      integrityRef.current?.startUnit('hybrid');
      setTaskIdx(taskIdx + 1);
    }
  }

  function handleNextSet() {
    if (currentSet < (task.sets || 1)) {
      setCurrentSet(currentSet + 1);
      setResting(true);
      setTimer(0);
      setTimerActive(true);
    } else {
      handleCompleteTask();
    }
  }

  function handleStartSecondBlock() {
    setCurrentBlock(secondBlock);
    setTaskIdx(0);
    setTimer(0);
    setTimerActive(false);
    setCurrentSet(1);
    setResting(false);
    setBlockComplete(false);
    setPromptNextBlock(false);
    integrityRef.current?.startUnit('hybrid');
  }

  function handleSaveForLater() {
    onExit();
  }

  // Stage intro overlay
  if (sessionPhase === 'intro') {
    return (
      <ArcadeStageIntroOverlay
        series={series}
        stage={stage}
        currentStage={currentStageNum}
        completedStageIds={completedStageIds}
        potentialXp={stage?.rewards?.xp}
        voiceEnabled={arcadeSettings?.voiceCoach !== false && arcadeSettings?.sound !== 'off'}
        onComplete={handleIntroComplete}
      />
    );
  }

  // Dedicated benchmark player for benchmark stages
  if (isBenchmark && sessionPhase === 'active') {
    return (
      <ArcadeBenchmarkPlayer
        series={series}
        stage={stage}
        arcadeSettings={arcadeSettings}
        skipIntro
        onHome={onHome}
        onComplete={handleBenchmarkComplete}
        onExit={onExit}
        onStateChange={onStateChange}
      />
    );
  }

  // Cadence sets (stages 2-10) render full-screen through the Battle HUD too.
  if (isCadenceTask && sessionPhase === 'active') {
    return (
      <ArcadeCadenceRepPlayer
        task={task}
        taskIdx={taskIdx}
        totalTasks={tasks.length}
        stage={stage}
        series={series}
        arcadeSettings={arcadeSettings}
        nextTaskTitle={taskIdx + 1 < tasks.length ? tasks[taskIdx + 1]?.title : null}
        onComplete={() => handleCompleteTask()}
        onSkip={() => { integrityRef.current?.skipUnit(); handleCompleteTask(); }}
        onExit={handleSaveForLater}
        onHome={onHome}
      />
    );
  }

  // Stage Clear overlay
  if (sessionPhase === 'clear' && stageResult) {
    return (
      <ArcadeStageClearOverlay
        series={series}
        stage={stage}
        result={stageResult}
        pointsEarned={stageResult.points || stageResult.xpEarned || 0}
        xpEarned={stageResult.xpEarned || 0}
        statRewards={stageResult.statRewards}
        totalArcadeXpBefore={totalXpBefore}
        completedStageIds={completedStageIds}
        onContinue={onComplete}
        onRetry={handleRetryStage}
        onReturnToArcade={onExit}
        onNextStage={!stageResult.invalid ? onComplete : null}
      />
    );
  }

  // Prompt to start second block
  if (promptNextBlock) {
    const completedMode = firstBlock === 'fit' ? 'Fit Mode' : 'Fight Mode';
    const nextMode = secondBlock === 'fit' ? 'Fit Mode' : 'Fight Mode';
    return (
      <PhoneFrame useBrandBg>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100dvh', padding: 24, textAlign: 'center',
        }}>
          <CheckCircle size={40} color="#22c55e" style={{ marginBottom: 12 }}/>
          <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 14, color: C.text, margin: '0 0 8px' }}>
            Stage complete. Ready for {nextMode}?
          </h2>
          <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: '0 0 20px' }}>
            {completedMode} portion finished.
          </p>
          <div style={{ display: 'flex', gap: 10, flexDirection: 'column', width: '100%', maxWidth: 240 }}>
            <button onClick={handleStartSecondBlock} style={{
              padding: '12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.yellow}, #facc15)`,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: '#0a0014',
            }}>START {nextMode.toUpperCase()}</button>
            <button onClick={handleSaveForLater} style={{
              padding: '12px', borderRadius: 8, border: `1px solid ${C.muted}40`, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 12, color: C.muted,
            }}>Save for Later</button>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  // Active session
  const progressPct = ((taskIdx) / tasks.length) * 100;
  const restTarget = resting ? (task?.restSeconds || 30) : 0;
  const timerTarget = isTimerTask ? (task?.durationSeconds || 60) : 0;

  return (
    <PhoneFrame useBrandBg>
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
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        minHeight: '100dvh', padding: '20px 16px calc(160px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={handleSaveForLater} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <ChevronLeft size={20} color={C.text}/>
          </button>
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 9, color: C.yellow, fontWeight: 700, letterSpacing: '0.1em' }}>
              {stage.isFinalRound ? 'FINAL BOSS' : `STAGE ${stage.stageNumber}`}
            </span>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, fontWeight: 500 }}>
              {isBenchmark ? 'Benchmark' : currentBlock === 'fit' ? 'Fit Mode' : 'Fight Mode'}
            </div>
          </div>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 11, color: C.muted, fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
            {taskIdx + 1}/{tasks.length}
          </span>
        </div>

        {/* Benchmark running timer */}
        {isBenchmark && benchmarkActive && (
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 6, background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.15)' }}>
              <Clock size={10} color={C.yellow}/>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 11, color: C.yellow, fontWeight: 700 }}>
                {formatTime(benchmarkTimer)}
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', marginBottom: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.yellow, width: `${progressPct}%`, transition: 'width 0.3s', borderRadius: 2 }}/>
        </div>

        {/* Session Settings Badges */}
        {arcadeSettings && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12, justifyContent: 'center' }}>
            {arcadeSettings.difficulty && (
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }}>
                {arcadeSettings.difficulty.toUpperCase()}
              </span>
            )}
            {arcadeSettings.cadence && (
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7' }}>
                {arcadeSettings.cadence.toUpperCase()}
              </span>
            )}
            {arcadeSettings.rest && (
              <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                REST: {arcadeSettings.rest.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {/* Task Display */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {resting ? (
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 10, color: C.neon, fontWeight: 700, letterSpacing: '0.15em' }}>REST</span>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 48, color: C.text, fontWeight: 900, margin: '10px 0' }}>
                {formatTime(Math.max(0, restTarget - timer))}
              </div>
              {timer >= restTarget && (
                <button onClick={() => { setResting(false); setTimer(0); setTimerActive(false); }} style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: C.neon, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff',
                }}>NEXT SET</button>
              )}
            </div>
          ) : isCadenceTask ? (
            <ArcadeCadenceRepPlayer
              task={task}
              taskIdx={taskIdx}
              totalTasks={tasks.length}
              stage={stage}
              arcadeSettings={arcadeSettings}
              nextTaskTitle={taskIdx + 1 < tasks.length ? tasks[taskIdx + 1]?.title : null}
              onComplete={() => handleCompleteTask()}
              onSkip={() => {
                integrityRef.current?.skipUnit();
                handleCompleteTask();
              }}
              onExit={handleSaveForLater}
            />
          ) : isBackBalance && backBalancePhase === 'choose' ? (
            <ArcadeBackBalanceChooser
              options={task.options || []}
              noPullUpBarAlternatives={stage?.backBalanceBlock?.noPullUpBarAlternatives}
              onSelect={(option) => {
                setBackBalancePhase('active');
                // Mutate task in place for display
                if (option) {
                  task._selectedOption = option;
                }
              }}
            />
          ) : isCardioTask && cardioPhase === 'select' ? (
            <CardioProtocolSelector
              selectedMethod={cardioMethod}
              allowedMethods={task?.cardioAllowedIds || undefined}
              onSelectMethod={(method) => { setCardioMethod(method); setCardioPhase('play'); }}
              subtitle={task?.distanceLabel || stage?.cardioBlock?.distanceEquivalent || null}
            />
          ) : isCardioTask && cardioPhase === 'play' ? (
            <ArcadeCardioPlayer
              method={cardioMethod}
              methodLabel={cardioMethod ? (CARDIO_METHODS.find(m => m.id === cardioMethod)?.label || cardioMethod) : null}
              durationSeconds={task?.durationSeconds || (stage?.cardioBlock?.durationMinutes ? stage.cardioBlock.durationMinutes * 60 : 300)}
              distanceLabel={task?.distanceLabel || stage?.cardioBlock?.distanceEquivalent}
              speedBoosts={stage?.cardioBlock?.speedBoosts || { enabled: true, minBoosts: 3, maxBoosts: 6, minDurationSeconds: 20, maxDurationSeconds: 60 }}
              onComplete={(result) => {
                if (isMainCardio) {
                  setCardioResult(result || null);
                  setCardioPhase('log');
                } else {
                  handleCompleteTask();
                }
              }}
              onSkip={() => {
                integrityRef.current?.skipUnit();
                handleCompleteTask();
              }}
              onExit={handleSaveForLater}
            />
          ) : isMainCardio && cardioPhase === 'log' ? (
            <CardioSummary
              sourceMode="trainingArcade"
              method={cardioMethod || 'custom-cardio'}
              methodLabel={cardioMethod ? (CARDIO_METHODS.find(m => m.id === cardioMethod)?.label || cardioMethod) : 'Cardio'}
              cardioType={cardioMethod || 'custom-cardio'}
              targetType={(task?.distanceLabel || stage?.cardioBlock?.distanceEquivalent) ? 'distance' : 'time'}
              targetTimeSeconds={task?.durationSeconds || null}
              targetDistance={task?.distanceLabel || stage?.cardioBlock?.distanceEquivalent || null}
              initialTimeSeconds={cardioResult?.elapsed || 0}
              awardXp={false}
              onDone={() => handleCompleteTask()}
            />
          ) : isBackBalance && backBalancePhase === 'active' && task?._selectedOption ? (
            <ArcadeCadenceRepPlayer
              task={{
                ...task,
                title: task._selectedOption.label,
                reps: task._selectedOption.reps || 0,
                durationSeconds: task._selectedOption.durationSeconds || 0,
                cadenceMs: task._selectedOption.cadenceMs || 2500,
                restSeconds: task.restSeconds || 15,
                instructions: task._selectedOption.equipment ? `Equipment: ${task._selectedOption.equipment}` : 'Complete with good form.',
              }}
              taskIdx={taskIdx}
              totalTasks={tasks.length}
              stage={stage}
              arcadeSettings={arcadeSettings}
              nextTaskTitle={taskIdx + 1 < tasks.length ? tasks[taskIdx + 1]?.title : null}
              onComplete={() => handleCompleteTask()}
              onSkip={() => {
                integrityRef.current?.skipUnit();
                handleCompleteTask();
              }}
              onExit={handleSaveForLater}
            />
          ) : (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <h3 style={{
                fontFamily: "'Orbitron',sans-serif", fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 8px',
              }}>{isBackBalance && task?._selectedOption ? task._selectedOption.label : task?.title}</h3>
              <p style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, margin: '0 0 16px', lineHeight: 1.5,
              }}>{task?.instructions}</p>

              {/* Task details */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                {(isBackBalance && task?._selectedOption?.reps || task?.reps > 0) && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, color: C.yellow, fontWeight: 900 }}>
                      {isBackBalance && task?._selectedOption?.reps ? task._selectedOption.reps : task.reps}
                    </div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>REPS</div>
                  </div>
                )}
                {(isBackBalance && task?._selectedOption?.durationSeconds || task?.durationSeconds > 0) && !task?.reps && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, color: C.neon, fontWeight: 900 }}>
                      {isBackBalance && task?._selectedOption?.durationSeconds ? task._selectedOption.durationSeconds : task.durationSeconds}s
                    </div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>HOLD</div>
                  </div>
                )}
                {task?.sets > 1 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, color: C.neon, fontWeight: 900 }}>{currentSet}/{task.sets}</div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>SET</div>
                  </div>
                )}
                {task?.rounds > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, color: '#ef4444', fontWeight: 900 }}>{task.rounds}</div>
                    <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted }}>ROUNDS</div>
                  </div>
                )}
              </div>

              {/* Timer for timed tasks */}
              {isTimerTask && !isCardioTask && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 40, color: C.text, fontWeight: 900, marginBottom: 8 }}>
                    {formatTime(timerActive ? timer : 0)}
                  </div>
                  <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.muted, marginBottom: 10 }}>
                    Target: {formatTime(timerTarget)}
                  </div>
                  <button onClick={() => setTimerActive(!timerActive)} style={{
                    width: 48, height: 48, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: timerActive ? 'rgba(239,68,68,0.2)' : `${C.yellow}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                  }}>
                    {timerActive ? <Pause size={20} color="#ef4444"/> : <Play size={20} color={C.yellow}/>}
                  </button>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {task?.sets > 1 && currentSet < task.sets ? (
                  <button onClick={handleNextSet} style={{
                    padding: '12px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: C.neon, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: '#fff',
                  }}>COMPLETE SET {currentSet}</button>
                ) : (
                  <button onClick={handleCompleteTask} style={{
                    padding: '12px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${C.yellow}, #facc15)`,
                    fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 11, color: '#0a0014',
                  }}>
                    {taskIdx + 1 >= tasks.length ? 'COMPLETE STAGE' : 'DONE'}
                  </button>
                )}
                <button onClick={handleCompleteTask} style={{
                  padding: '12px 16px', borderRadius: 8, border: `1px solid rgba(255,255,255,0.1)`, cursor: 'pointer',
                  background: 'transparent', display: 'flex', alignItems: 'center', gap: 4,
                  fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: 11, color: C.muted,
                }}>
                  <SkipForward size={12}/> Skip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Next task preview */}
        {!resting && taskIdx + 1 < tasks.length && (
          <div style={{
            marginTop: 16, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 9, color: C.muted, fontWeight: 600, letterSpacing: '0.1em' }}>NEXT:</span>
            <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.text, fontWeight: 600, marginLeft: 8 }}>
              {tasks[taskIdx + 1]?.title}
            </span>
          </div>
        )}
      </div>
    </PhoneFrame>
  );
}
