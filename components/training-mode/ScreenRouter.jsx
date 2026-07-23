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
import FightFocusSetup from './FightFocusSetup';
import FightFocusTimer from './FightFocusTimer';
import SessionSummary from './SessionSummary';
import MissionComplete from './shared/MissionComplete';
import CampTransitionCard from './shared/CampTransitionCard';
import CampFitRunner from './CampFitRunner';
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
  return fit
    ? <CampFitRunner cfg={cfg} onEnd={onEnd} />
    : <FightFocusTimer discipline={discipline} cfg={cfg} onEnd={onEnd} initialPaused={false} />;
}

function WithNav({ activeTab, onNavigate, pausedSession, onResume, children, lock = false }) {
  const containerRef = useRef(null);
  const showScroll = useScrollIndicator(containerRef, children);

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
          overflowY: lock ? 'hidden' : 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
          paddingBottom: lock ? 0 : 'calc(110px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {children}
      </div>
      <ScrollDownIndicator visible={showScroll && !lock} />
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
  const { goHome, goProgress, goTrainingHub, goFightHub, goFitHub, goFitSetup, goCardioMode, goWorkoutCodec, goQuickMissionSetup, goQuickMissionActive, goQuickMissionComplete, goCombatCondSetup, goCombatCondActive, goCombatCondComplete, goProfile, goBetaFeedback, goPaywall, goGameLink, goSubscription, goSetup, goComboSetup, goTimer, goSummary, goComboActive, goComboEnd, goFitWorkout, goFitComplete, goPractice, goStartHere, goStartDailyMission, goAfterSplash, completeOnboarding, startFeatureTour, skipOnboardingToHome, goTrainingArcade, goArcadeSeries, goArcadeDetail, goArcadeSession, goArcadeComplete, finishCardioFinisher, skipCardioFinisher, finishLevelUp, goNotifications, goTrainingCamp, goCampSession, goCampComplete, goCampMap } = actions;

  const isResuming = pausedSession?.screen === screen;

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
    return (
      <WithNav activeTab="home" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <HomeDashboard onHome={goHome} onFightMode={goFightHub} onFitBuilder={goFitHub} onProfile={goProfile} profile={profile} onPractice={goPractice} onFightFocus={goSetup} onQuickMission={goQuickMissionSetup} onFitSetup={goFitSetup} onComboCoach={goComboSetup} onStartHere={goStartHere} onStartDailyMission={goStartDailyMission} onCombatConditioning={goCombatCondSetup} onBetaFeedback={goBetaFeedback} onTrainingArcade={goTrainingArcade} onTrain={goTrainingHub}/>
      </WithNav>
    );
  }
  if (screen === 'training_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <TrainingHub onHome={goHome} onFightMode={goFightHub} onFitMode={goFitHub} onTrainingArcade={goTrainingArcade} onCombatConditioning={goCombatCondSetup} onProfile={goProfile} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'fight_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <FightModeHub onHome={goHome} onBack={goTrainingHub} onFightFocus={goSetup} onComboCoach={goComboSetup} onPractice={goPractice} onStartHere={goStartHere} onCombatConditioning={goCombatCondSetup} onQuickFight={goTimer} onQuickCombo={goComboActive} onTrainingCamp={goTrainingCamp}/>
      </WithNav>
    );
  }
  if (screen === 'training_camp') {
    // Locked (non-scrolling) so the whole 45a ladder fits above the bottom nav
    // footer; header lives in the screen, back chevron returns to the Fight hub.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} lock>
        <TrainingCampMap discipline={disc} onBack={goFightHub} onStartSession={goCampSession}/>
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
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <CampSessionRunner
          discipline={disc} cfg={cfg}
          fit={!!campCtx?.split && campCtx?.slot === 's2'}
          label={campCtx?.split ? `S${slotNum} · ${kind}` : `LEVEL ${campCtx?.level ?? ''}`}
          sub={campCtx?.split ? `LEVEL ${campCtx?.level} · ${slotNum === 2 ? 'EVENING MISSION' : 'MORNING MISSION'}` : 'TRAINING CAMP'}
          detail={`${cfg.rounds} × ${mmss} · ${cfg.restSec}s rest`}
          onEnd={goCampComplete}
        />
      </WithNav>
    );
  }
  if (screen === 'camp_complete' && campResult) {
    const r = campResult;
    // Three outcomes: level cleared · one split mission done (level pending) ·
    // stopped/invalid (GOOD EFFORT, nothing counted).
    const missionDone = r.split && r.sessionValid && !r.cleared;
    const slotNum = r.slot === 's2' ? 2 : 1;
    const kindLbl = r.slot === 's2' ? 'CONDITIONING' : 'SKILL';
    const eyebrow = r.cleared ? 'LEVEL CLEARED' : missionDone ? `SESSION ${slotNum} COMPLETE` : 'SESSION STOPPED';
    const title = r.cleared ? `LEVEL ${r.level} CLEAR` : missionDone ? `S${slotNum} · ${kindLbl} ✓` : 'GOOD EFFORT';
    const subtitle = missionDone && slotNum === 1
      ? `TRAINING CAMP · ${r.discipline} · S2 tonight — leave 4–8 h`
      : `TRAINING CAMP · ${r.discipline} · ${r.difficulty}`;
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <MissionComplete
          variant={r.cleared || missionDone ? 'success' : 'partial'}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
          xp={r.xpEarned}
          heroImage="/static/trophies/mission-complete-fight.webp"
          partialBadge="/static/trophies/good-effort.png"
          integrityResult={r.integrityResult}
          stats={[{ value: `${r.rounds}/${r.total}`, label: 'ROUNDS' }]}
          actions={[
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
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume}>
        <SessionSummary
          discipline={disc}
          rounds={session.rounds}
          cfg={session.cfg}
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
        <CardioMode onBack={goFitHub} onHome={goHome}/>
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
        <FitBuilderWorkout cfg={fitCfg} profile={profile} onDone={(done, total) => goFitComplete(fitCfg, done, total)} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
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
        <CombatConditioningSetup onBack={goFitHub} onStart={goCombatCondActive} onCardioOnly={goCardioMode} profile={profile}/>
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
        <TrainingArcade onHome={goHome} onBack={goTrainingHub} onSelectSeries={goArcadeSeries}/>
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
        <ArcadeSeriesDetail onHome={goHome} series={arcadeSeries} onBack={() => arcadeSeries.id === 'one-punch-protocol' ? goTrainingArcade() : goArcadeSeries(arcadeSeries)} onStartStage={goArcadeSession} arcadeSettings={arcadeSettings}/>
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
