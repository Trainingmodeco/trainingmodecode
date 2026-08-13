import { useRef, useState, useEffect, useCallback, lazy } from 'react';
import SplashScreen from './SplashScreen';
import Onboarding from './Onboarding';
import Paywall from './Paywall';
import GameLink from './GameLink';
import ManageSubscription from './ManageSubscription';
import Notifications from './Notifications';
import HomeDashboard from './HomeDashboard';
import TrainingHub from './TrainingHub';
import FightModeHub from './FightModeHub';
import MoveLab from './MoveLab';
import FightFocusSetup from './FightFocusSetup';
import FightFocusTimer from './FightFocusTimer';
import SessionSummary from './SessionSummary';
import { resolveOutcome } from './shared/sessionOutcome';
import GhostVsScreen from './shared/GhostVsScreen';
import GhostResultScreen from './shared/GhostResultScreen';
import { getLastBattle, getMyBestGhost } from './data/ghostBattles';
import MissionComplete from './shared/MissionComplete';
import CampTransitionCard from './shared/CampTransitionCard';
import CampFitRunner from './CampFitRunner';
import CampFitSetRunner from './CampFitSetRunner';
import CampFullSession from './CampFullSession';
import ComboCoachSetup from './ComboCoachSetup';
import ComboCoachActive from './ComboCoachActive';
import FitModeHub from './FitModeHub';
import CardioMode from './CardioMode';
import FitBuilderSetup from './FitBuilderSetup';
import FitBuilderWorkout from './FitBuilderWorkout';
import FitWorkoutComplete from './FitWorkoutComplete';
import QuickMissionSetup from './QuickMissionSetup';
import QuickMissionActive from './QuickMissionActive';
import QuickMissionComplete from './QuickMissionComplete';
import CombatConditioningSetup from './CombatConditioningSetup';
import CombatConditioningActive from './CombatConditioningActive';
import WithWarmup from './shared/WithWarmup';
import { AnswerTheBellHost } from './shared/AnswerTheBell';
import CombatConditioningComplete from './CombatConditioningComplete';
import CardioFinisherPlayer from './CardioFinisherPlayer';
import Profile from './Profile';
import BetaFeedback from './BetaFeedback';
import PracticeMode from './PracticeMode';
import ProgressScreen from './ProgressScreen';
import BottomNav from './BottomNav';
import ScrollDownIndicator from './ScrollDownIndicator';
import FloatingResumeButton from './FloatingResumeButton';
import LevelUpReveal from './LevelUpReveal';

// Code-split the heavy, rarely-first screens so they're not in the initial bundle.
const CodecApp = lazy(() => import('../workout-codec/CodecApp'));
const TrainingArcade = lazy(() => import('./TrainingArcade'));
const TrainingCampMap = lazy(() => import('./TrainingCampMap'));
const ArcadeSeriesIntroPage = lazy(() => import('./ArcadeSeriesIntroPage'));
const ArcadeSeriesDetail = lazy(() => import('./ArcadeSeriesDetail'));
const ArcadeSessionPlayer = lazy(() => import('./ArcadeSessionPlayer'));

function useScrollIndicator(containerRef, children) {
  const [showScroll, setShowScroll] = useState(false);

  const check = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    // scrollHeight includes the bottom padding we reserve for the tab bar, so
    // comparing it directly flagged every screen as scrollable and showed the
    // chevron over nothing. Measure where the content actually ends instead.
    const padBottom = parseFloat(getComputedStyle(root).paddingBottom) || 0;
    const contentBottom = root.scrollHeight - padBottom;
    const overflows = contentBottom > root.clientHeight + 12;
    const nearBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 24;
    setShowScroll(overflows && !nearBottom);
  }, [containerRef]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    check();
    const timer = setTimeout(check, 300);
    root.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(root);
    return () => {
      clearTimeout(timer);
      root.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      ro.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check, children]);

  return showScroll;
}

// 2.4b — camp block runner: an S7 "NEXT UP" interstitial leads into the round
// timer. As multi-block sessions land, this is where blocks chain — each block
// gets its transition card, then its timer.
function CampSessionRunner({ discipline, cfg, label, sub, detail, onEnd, fit }) {
  const [running, setRunning] = useState(false);
  if (!running) return <CampTransitionCard label={label} sub={sub} detail={detail} onDone={() => setRunning(true)} />;
  // S2 (PM conditioning) runs the dedicated fit runner; skill blocks use the
  // shared striking ring timer. Both produce the same onEnd shape.
  // Spec 27 — a prescribed Arcade fit stage runs the COUNTED-SETS runner (reps
  // counted, weighted review, finishers); legacy timed circuits keep CampFitRunner.
  if (fit) return cfg.prescription?.length ? <CampFitSetRunner cfg={cfg} onEnd={onEnd} /> : <CampFitRunner cfg={cfg} onEnd={onEnd} />;
  return <FightFocusTimer discipline={discipline} cfg={cfg} onEnd={onEnd} initialPaused={false} />;
}

function WithNav({ activeTab, onNavigate, pausedSession, onResume, children, lock = false }) {
  const containerRef = useRef(null);
  const showScroll = useScrollIndicator(containerRef, children);

  // `lock` means "this screen sizes itself, don't scroll it" — right for a
  // fixed-layout session screen, wrong the moment the content genuinely does
  // not fit. On a 375x667 phone the Workout Builder and Combat Conditioning
  // setups ran taller than the viewport, and because a locked container is
  // `overflow: hidden` with no bottom padding, their gold CTAs (GENERATE
  // WORKOUT / START CIRCUIT) sat under the tab bar with nothing able to scroll
  // them clear. Each screen's own paddingBottom could not help: padding only
  // buys clearance if something can scroll.
  //
  // So lock is a preference, not a cage. If the content overflows anyway, the
  // container scrolls and takes the standard nav clearance. This settles in one
  // pass rather than oscillating: adding the padding only makes the content
  // taller, so an overflowing screen stays overflowing.
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !lock) { setOverflowing(false); return undefined; }
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 4);
    check();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(el);
      if (el.firstElementChild) ro.observe(el.firstElementChild);
    }
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [lock, children]);

  const scrolls = !lock || overflowing;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 440,
      height: '100dvh',
      margin: '0 auto',
      background: '#0a0014',
      overflow: 'hidden',
    }}>
      <div
        ref={containerRef}
        className="no-scrollbar"
        style={{
          height: '100dvh',
          overflowY: scrolls ? 'auto' : 'hidden',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          // Beta TM-09 — when the resume pill floats over this screen, buy the
          // last rows of content enough clearance to scroll out from under it.
          paddingBottom: scrolls
            ? (pausedSession ? 'calc(150px + env(safe-area-inset-bottom, 0px))' : 'calc(110px + env(safe-area-inset-bottom, 0px))')
            : 0,
        }}
      >
        {children}
      </div>
      <ScrollDownIndicator visible={showScroll && scrolls} />
      <FloatingResumeButton pausedSession={pausedSession} onResume={onResume} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 440,
        zIndex: 100,
      }}>
        <BottomNav active={activeTab} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export default function ScreenRouter({ screen, disc, cfg, session, comboCfg, fitCfg, qmCfg, qmResult, ccMission, ccResult, cardioContext, cardioResult, arcadeSeries, arcadeStage, arcadeMode, arcadeOrder, arcadeSettings, campCtx, campResult, profile, updateProfile, levelUp, pausedSession, onResume, onDiscardPaused, reportSessionState, resumeData, actions }) {
  const { goHome, goProgress, goTrainingHub, goFightHub, goFitHub, goFitSetup, goCardioMode, goWorkoutCodec, goQuickMissionSetup, goQuickMissionActive, goQuickMissionComplete, goCombatCondSetup, goCombatCondActive, goCombatCondComplete, goProfile, goBetaFeedback, goPaywall, goGameLink, goSubscription, goSetup, goComboSetup, goTimer, goSummary, goComboActive, goComboEnd, goFitWorkout, goFitComplete, goPractice, goStartHere, goStartDailyMission, goAfterSplash, completeOnboarding, startFeatureTour, skipOnboardingToHome, goTrainingArcade, goArcadeSeries, goArcadeDetail, goArcadeSession, goArcadeComplete, finishCardioFinisher, skipCardioFinisher, finishLevelUp, goNotifications, goTrainingCamp, goCampSession, goCampComplete, goCampMap, goCampFullComplete, goMoveLab, startPathTour } = actions;

  const isResuming = pausedSession?.screen === screen;

  // Item 11 — ghost battle flow gates. `vsAccepted` clears whenever a new
  // session config arrives so the VS screen shows once per fight; the result
  // screen is dismissed for the rest of that summary.
  const [vsAccepted, setVsAccepted] = useState(false);
  const [ghostResultSeen, setGhostResultSeen] = useState(false);
  useEffect(() => { setVsAccepted(false); }, [cfg]);
  useEffect(() => { if (screen !== 'summary') setGhostResultSeen(false); }, [screen]);

  const handleNavigate = (tab) => {
    if (tab === 'home') goHome();
    else if (tab === 'train') goTrainingHub();
    else if (tab === 'progress') goProgress();
    else if (tab === 'profile') goProfile();
  };

  if (screen === 'start') {
    return <SplashScreen onStart={goAfterSplash}/>;
  }
  if (screen === 'onboarding') {
    return <Onboarding onComplete={completeOnboarding} onHome={skipOnboardingToHome}/>;
  }
  if (screen === 'home') {
    // Beta TM-09 — Home gets the in-flow SESSION PAUSED banner instead of the
    // floating pill (no pausedSession into WithNav = no pill here); the pill
    // stays the global affordance on every other tab screen.
    return (
      <WithNav activeTab="home" onNavigate={handleNavigate}>
        <HomeDashboard onHome={goHome} onFightMode={goFightHub} onFitBuilder={goFitHub} onProfile={goProfile} profile={profile} onPractice={goPractice} onFightFocus={goSetup} onQuickMission={goQuickMissionSetup} onFitSetup={goFitSetup} onComboCoach={goComboSetup} onStartHere={goStartHere} onStartDailyMission={goStartDailyMission} onCombatConditioning={goCombatCondSetup} onBetaFeedback={goBetaFeedback} onTrainingArcade={goTrainingArcade} onTrain={goTrainingHub} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}/>
      </WithNav>
    );
  }
  if (screen === 'training_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <TrainingHub onHome={goHome} onFightMode={goFightHub} onFitMode={goFitHub} onTrainingArcade={goTrainingArcade} onCombatConditioning={goCombatCondSetup} onProfile={goProfile} onStartGuide={startPathTour} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'fight_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <FightModeHub onHome={goHome} onBack={goTrainingHub} onFightFocus={goSetup} onComboCoach={goComboSetup} onPractice={goPractice} onStartHere={goStartHere} onCombatConditioning={goCombatCondSetup} onQuickFight={goTimer} onQuickCombo={goComboActive} onTrainingCamp={goTrainingCamp} onMoveLab={goMoveLab}/>
      </WithNav>
    );
  }
  if (screen === 'move_lab') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <MoveLab discipline={disc} onBack={goFightHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'training_camp') {
    // Locked (non-scrolling) so the whole 45a ladder fits above the bottom nav
    // footer; header lives in the screen, back chevron returns to the Fight hub.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <TrainingCampMap discipline={disc} onBack={goFightHub} onStartSession={goCampSession} onPaywall={goPaywall}/>
      </WithNav>
    );
  }
  if (screen === 'camp_session' && cfg) {
    // 2.4 — a camp session: S7 transition card, then the shared Fight Focus
    // round timer driven by the engine's round template; onEnd → completion.
    const slotNum = campCtx?.slot === 's2' ? 2 : 1;
    const kind = campCtx?.slot === 's2' ? 'CONDITIONING' : 'SKILL';
    const roundSec = Math.round((cfg.roundMin || 1) * 60);
    const mmss = `${Math.floor(roundSec / 60)}:${String(roundSec % 60).padStart(2, '0')}`;
    // 49a/49b — the Answer the Bell gate fronts ARCADE boss stages only
    // (Training Camp keeps its normal warm-up flow). Per the design the bell
    // goes straight into round 1, so the warm-up is skipped on a boss run.
    const isFitSlot = !!campCtx?.split && campCtx?.slot === 's2';
    const bossBell = !!cfg.bossFinale && !!campCtx?.arcade;
    const runner = (
      <CampSessionRunner
        discipline={disc} cfg={cfg}
        fit={isFitSlot}
        label={campCtx?.split ? `S${slotNum} · ${kind}` : `LEVEL ${campCtx?.level ?? ''}`}
        sub={campCtx?.split ? `LEVEL ${campCtx?.level} · ${slotNum === 2 ? 'EVENING MISSION' : 'MORNING MISSION'}` : 'TRAINING CAMP'}
        detail={`${cfg.rounds} × ${mmss} · ${cfg.restSec}s rest`}
        onEnd={goCampComplete}
      />
    );
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <AnswerTheBellHost
          active={bossBell} bossName={cfg.bossName} campaignName={campCtx?.arcade?.campaignName}
          fit={isFitSlot} rounds={cfg.rounds}
          seriesId={campCtx?.arcade?.seriesId} stageId={campCtx?.arcade?.stageId}
        >
          {bossBell ? runner : (
            /* 2.4 — a warm-up phase leads into every camp session (skippable). */
            <WithWarmup minutes={cfg.warmupMin} title={`WARM UP · ${campCtx?.slot === 's2' ? 'CONDITIONING' : 'SKILL'}`}>
              {runner}
            </WithWarmup>
          )}
        </AnswerTheBellHost>
      </WithNav>
    );
  }
  if (screen === 'camp_full' && campCtx?.cfgSkill && campCtx?.cfgFit) {
    // FULL CAMP — warm-up, then skill block → transition → conditioning block.
    const bossBellFull = !!campCtx.cfgSkill.bossFinale && !!campCtx?.arcade;
    const fullSession = <CampFullSession discipline={disc} cfgSkill={campCtx.cfgSkill} cfgFit={campCtx.cfgFit} onComplete={goCampFullComplete} />;
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <AnswerTheBellHost
          active={bossBellFull} bossName={campCtx.cfgSkill.bossName} campaignName={campCtx?.arcade?.campaignName}
          fit={false} rounds={campCtx.cfgSkill.rounds}
          seriesId={campCtx?.arcade?.seriesId} stageId={campCtx?.arcade?.stageId}
        >
          {bossBellFull ? fullSession : (
            <WithWarmup minutes={campCtx.cfgSkill.warmupMin} title="WARM UP · FULL CAMP">
              {fullSession}
            </WithWarmup>
          )}
        </AnswerTheBellHost>
      </WithNav>
    );
  }
  if (screen === 'camp_complete' && campResult) {
    const r = campResult;
    // 2.10 — arcade v2 stage completion reuses this screen with arcade wording +
    // routing: trophy → the saga select (carousel); yellow → back to the arcade
    // ladder; a share card on both outcomes.
    if (r.arcade) {
      const aEyebrow = r.cleared ? 'STAGE CLEARED' : 'STAGE STOPPED';
      const aTitle = r.cleared ? `STAGE ${r.stageNumber || r.level} CLEAR` : 'GOOD EFFORT';
      const aSub = `TRAINING ARCADE · ${r.campaignName || 'Arcade'} · ${r.difficulty}`;
      // Item 9 — the outcome comes from the engine, so an arcade stage can end
      // on fail / validation_failed here too, not just cleared / stopped.
      const aVerdict = resolveOutcome({
        completed: r.rounds, total: r.total, difficulty: r.difficulty, integrityResult: r.integrityResult,
      });
      return (
        <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
          <MissionComplete
            variant={r.cleared ? 'success' : aVerdict.preset.variant}
            eyebrow={aEyebrow}
            title={aTitle}
            subtitle={aSub}
            failReason={r.cleared ? null : aVerdict.response}
            achievements={r.achievements || []}
            xp={r.xpEarned}
            heroImage="/static/trophies/mission-complete-fight.webp"
            partialBadge="/static/trophies/good-effort.png"
            onHero={goTrainingArcade}
            integrityResult={r.integrityResult}
            stats={[{ value: `${r.rounds}/${r.total}`, label: 'ROUNDS' }]}
            shareData={{ title: aTitle, subtitle: aSub, mode: 'Training Arcade' }}
            actions={[
              { label: 'BACK TO ARCADE', onClick: goArcadeComplete, kind: 'primary' },
              { label: 'HOME', onClick: goHome, kind: 'ghost' },
            ]}
          />
        </WithNav>
      );
    }
    // Three outcomes: level cleared · one split mission done (level pending) ·
    // stopped/invalid (GOOD EFFORT, nothing counted).
    const missionDone = r.split && r.sessionValid && !r.cleared;
    const slotNum = r.slot === 's2' ? 2 : 1;
    const kindLbl = r.slot === 's2' ? 'CONDITIONING' : 'SKILL';
    // Item 13b — winning L12 is not "level 12 clear", it is the end of the camp.
    const titleFightWon = r.level === 12 && r.cleared;
    const eyebrow = titleFightWon ? '🏆 TITLE FIGHT WON'
      : r.cleared ? 'LEVEL CLEARED' : missionDone ? `SESSION ${slotNum} COMPLETE` : 'SESSION STOPPED';
    const title = titleFightWon ? 'CAMP COMPLETE'
      : r.cleared ? `LEVEL ${r.level} CLEAR` : missionDone ? `S${slotNum} · ${kindLbl} ✓` : 'GOOD EFFORT';
    const subtitle = titleFightWon
      ? `TRAINING CAMP · ${r.discipline} · ALL 12 LEVELS`
      : missionDone && slotNum === 1
        ? `TRAINING CAMP · ${r.discipline} · S2 tonight — leave 4–8 h`
        : `TRAINING CAMP · ${r.discipline} · ${r.difficulty}`;
    const cVerdict = resolveOutcome({
      completed: r.rounds, total: r.total, difficulty: r.difficulty, integrityResult: r.integrityResult,
    });
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <MissionComplete
          variant={r.cleared || missionDone ? 'success' : cVerdict.preset.variant}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          failReason={r.cleared || missionDone ? null : cVerdict.response}
          achievements={r.achievements || []}
          xp={r.xpEarned}
          heroImage="/static/trophies/mission-complete-fight.webp"
          partialBadge="/static/trophies/good-effort.png"
          integrityResult={r.integrityResult}
          stats={titleFightWon
            ? [{ value: `${r.rounds}/${r.total}`, label: 'ROUNDS' }, { value: '12', label: 'LEVELS', highlight: true }]
            : [{ value: `${r.rounds}/${r.total}`, label: 'ROUNDS' }]}
          shareData={titleFightWon ? { mode: 'Training Camp', eyebrow: 'TITLE FIGHT WON', workoutName: 'CAMP COMPLETE', difficulty: r.difficulty } : undefined}
          actions={titleFightWon
            ? [
                { label: 'BACK TO CAMP', onClick: goCampMap, kind: 'primary' },
                { label: 'HOME', onClick: goHome, kind: 'ghost' },
              ]
            : [
                r.unlockedTo
                  ? { label: `CONTINUE → L${r.unlockedTo}`, onClick: goCampMap, kind: 'primary' }
                  : { label: 'BACK TO CAMP', onClick: goCampMap, kind: 'primary' },
                { label: 'HOME', onClick: goHome, kind: 'ghost' },
              ]}
        />
      </WithNav>
    );
  }
  if (screen === 'start_here' || screen === 'practice_starthere') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <PracticeMode initialDisc={disc} initialView="startHere" onBack={goFightHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'practice') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <PracticeMode initialDisc={disc} initialView="library" onBack={goFightHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'level_up') {
    // Reveal (design 6a) shown after a session crosses a level boundary. Both
    // CTAs advance to the pending completion screen (finishLevelUp); if reached
    // without level-up context, the component renders standalone defaults.
    return (
      <LevelUpReveal
        fromLevel={levelUp?.fromLevel}
        toLevel={levelUp?.toLevel}
        sex={profile?.sex}
        onEquip={finishLevelUp || goProfile}
        onContinue={finishLevelUp || goHome}
      />
    );
  }
  if (screen === 'setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <FightFocusSetup discipline={disc} onBack={goFightHub} onStart={c => goTimer(c)} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'timer' && cfg) {
    // Item 11a — a ghost battle opens on the VS screen. Resuming a paused
    // session skips it: the fight was already made.
    if (cfg.ghost && !isResuming && !vsAccepted) {
      return (
        <GhostVsScreen
          ghost={cfg.ghost}
          onAccept={() => setVsAccepted(true)}
          onBack={() => goSetup(disc)}
        />
      );
    }
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <WithWarmup minutes={cfg.warmupMin} enabled={!isResuming} title="FIGHT FOCUS">
          <FightFocusTimer discipline={disc} cfg={cfg} onEnd={(rounds, c, completed, integrityResult) => goSummary(rounds, c, completed, integrityResult)} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
        </WithWarmup>
      </WithNav>
    );
  }
  if (screen === 'summary' && session) {
    const isCombo = session.sessionSource === 'comboCoach';
    const handleRetry = isCombo
      ? () => goComboSetup(disc)
      : () => goSetup(disc);
    // Item 11c — if this session raced a ghost, the battle result reads first.
    // The battle is matched by session, not just "the last one ever recorded",
    // so an old battle can't reappear on an unrelated summary.
    const battle = session.cfg?.ghost ? getLastBattle() : null;
    const battleIsThisSession = battle?.ghost?.ghostId
      && battle.ghost.ghostId === session.cfg?.ghost?.ghostId
      && !ghostResultSeen;
    // Item 11 — second entry point: after a plain session, offer to race the
    // run that was just banked. Only when a verified ghost exists and this
    // session wasn't already a battle.
    const myBest = session.cfg?.ghost ? null : getMyBestGhost('fight_focus', disc);
    const ghostRematchAction = myBest
      ? [{ label: '👻 BEAT THIS RUN', kind: 'secondary', onClick: () => goTimer({ ...session.cfg, ghost: myBest }) }]
      : [];

    if (battleIsThisSession) {
      return (
        <GhostResultScreen
          battle={battle}
          onRematch={() => { setGhostResultSeen(true); handleRetry(); }}
          onDone={() => setGhostResultSeen(true)}
        />
      );
    }
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <SessionSummary
          discipline={disc}
          rounds={session.rounds}
          cfg={session.cfg}
          extraActions={ghostRematchAction}
          completedRounds={session.completedRounds}
          integrityResult={session.integrityResult}
          fightStats={session.fightStats}
          onAgain={handleRetry}
          onBack={goFightHub}
          onHome={goHome}
        />
      </WithNav>
    );
  }
  if (screen === 'combo_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <ComboCoachSetup discipline={disc} onBack={goFightHub} onStart={goComboActive} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'combo_active' && comboCfg) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <WithWarmup minutes={comboCfg.warmupMin} enabled={!isResuming} title="COMBO COACH">
          <ComboCoachActive discipline={disc} cfg={comboCfg} onEnd={goComboEnd} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
        </WithWarmup>
      </WithNav>
    );
  }
  if (screen === 'fit_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <FitModeHub onHome={goHome} onBack={goTrainingHub} onWorkoutBuilder={goFitSetup} onQuickMission={goQuickMissionSetup} onCombatConditioning={goCombatCondSetup} onCardioMode={goCardioMode} onWorkoutCodec={goWorkoutCodec}/>
      </WithNav>
    );
  }
  if (screen === 'cardio_mode') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        {/* TM-16 census caught this: CardioMode only accepts onBack — the
            onHome prop was passed and silently dropped. */}
        <CardioMode onBack={goFitHub}/>
      </WithNav>
    );
  }
  if (screen === 'workout_codec') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <CodecApp onBack={goFitHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'fit_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <FitBuilderSetup onBack={goFitHub} onGenerate={goFitWorkout} profileSex={profile?.sex || 'male'}/>
      </WithNav>
    );
  }
  if (screen === 'fit_workout' && fitCfg) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <FitBuilderWorkout cfg={fitCfg} profile={profile} onPaywall={goPaywall} onBack={goFitSetup} onHome={goHome} onDone={(done, total) => goFitComplete(fitCfg, done, total)} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
      </WithNav>
    );
  }
  if (screen === 'cardio_finisher' && cardioContext?.addon) {
    return (
      <CardioFinisherPlayer
        addon={cardioContext.addon}
        sourceMode={cardioContext.mode}
        onComplete={finishCardioFinisher}
        onSkip={skipCardioFinisher}
      />
    );
  }
  if (screen === 'fit_complete' && fitCfg) {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <FitWorkoutComplete cfg={fitCfg} completedCount={session?.exerciseCount || 0} totalCount={session?.totalCount || 0} cardioResult={cardioResult} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'qm_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <QuickMissionSetup onBack={goFitHub} onStart={goQuickMissionActive} onCardioOnly={goCardioMode}/>
      </WithNav>
    );
  }
  if (screen === 'qm_active' && qmCfg) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <QuickMissionActive missionCfg={qmCfg} profile={profile} onEnd={goQuickMissionComplete} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
      </WithNav>
    );
  }
  if (screen === 'qm_complete' && qmResult) {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <QuickMissionComplete result={qmResult} cardioResult={cardioResult} onRetry={goQuickMissionSetup} onFitHub={goFitHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'cc_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <CombatConditioningSetup onBack={goTrainingHub} onStart={goCombatCondActive} onCardioOnly={goCardioMode} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'cc_active' && ccMission) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <WithWarmup minutes={ccMission.warmupMin} enabled={!isResuming} title="COMBAT CONDITIONING">
          <CombatConditioningActive mission={ccMission} profile={profile} onEnd={goCombatCondComplete} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
        </WithWarmup>
      </WithNav>
    );
  }
  if (screen === 'cc_complete' && ccMission && ccResult) {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <CombatConditioningComplete mission={ccMission} result={ccResult} cardioResult={cardioResult} onNewMission={goCombatCondSetup} onFitHub={goFitHub} onHome={goHome}/>
      </WithNav>
    );
  }
  if (screen === 'progress') {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <ProgressScreen onHome={goHome} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'profile') {
    return (
      <WithNav activeTab="profile" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <Profile onHome={goHome} onBack={goHome} onSave={goHome} profile={profile} updateProfile={updateProfile} onBetaFeedback={goBetaFeedback} onPaywall={goPaywall} onGameLink={goGameLink} onSubscription={goSubscription} onNotifications={goNotifications} onReplayTour={startFeatureTour}/>
      </WithNav>
    );
  }
  if (screen === 'beta_feedback') {
    return (
      <WithNav activeTab="profile" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <BetaFeedback onBack={goProfile} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'paywall') {
    return <Paywall onClose={goProfile}/>;
  }
  if (screen === 'game_link') {
    return <GameLink onBack={goProfile} profile={profile}/>;
  }
  if (screen === 'notifications') {
    return <Notifications onBack={goProfile}/>;
  }
  if (screen === 'subscription') {
    return <ManageSubscription onBack={goProfile}/>;
  }
  if (screen === 'arcade') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <TrainingArcade onHome={goHome} onBack={goTrainingHub} onSelectSeries={goArcadeSeries} onChallengeCode={actions.startChallenge} onStartGuide={actions.startArcadeGuide}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_intro' && arcadeSeries) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <ArcadeSeriesIntroPage series={arcadeSeries} onHome={goHome} onBack={goTrainingArcade} onContinue={(series, settings) => goArcadeDetail(series, settings)}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_series' && arcadeSeries) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <ArcadeSeriesDetail onHome={goHome} series={arcadeSeries} onBack={goTrainingArcade} onStartStage={goArcadeSession} onPaywall={goPaywall} arcadeSettings={arcadeSettings}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_session' && arcadeSeries && arcadeStage) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <ArcadeSessionPlayer series={arcadeSeries} stage={arcadeStage} selectedMode={arcadeMode} modeOrder={arcadeOrder} arcadeSettings={arcadeSettings} onHome={goHome} onComplete={goArcadeComplete} onExit={goArcadeComplete} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
      </WithNav>
    );
  }
  return null;
}
