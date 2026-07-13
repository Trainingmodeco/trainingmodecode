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
const ArcadeSeriesIntroPage = lazy(() => import('./ArcadeSeriesIntroPage'));
const ArcadeSeriesDetail = lazy(() => import('./ArcadeSeriesDetail'));
const ArcadeSessionPlayer = lazy(() => import('./ArcadeSessionPlayer'));

function useScrollIndicator(containerRef, children) {
  const [showScroll, setShowScroll] = useState(false);

  const check = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const overflows = root.scrollHeight > root.clientHeight + 12;
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

export default function ScreenRouter({ screen, disc, cfg, session, comboCfg, fitCfg, qmCfg, qmResult, ccMission, ccResult, cardioContext, cardioResult, arcadeSeries, arcadeStage, arcadeMode, arcadeOrder, arcadeSettings, profile, updateProfile, levelUp, pausedSession, onResume, onDiscardPaused, reportSessionState, resumeData, actions }) {
  const { goHome, goProgress, goTrainingHub, goFightHub, goFitHub, goFitSetup, goCardioMode, goWorkoutCodec, goQuickMissionSetup, goQuickMissionActive, goQuickMissionComplete, goCombatCondSetup, goCombatCondActive, goCombatCondComplete, goProfile, goBetaFeedback, goPaywall, goGameLink, goSubscription, goSetup, goComboSetup, goTimer, goSummary, goComboActive, goComboEnd, goFitWorkout, goFitComplete, goPractice, goStartHere, goStartDailyMission, goAfterSplash, completeOnboarding, startFeatureTour, skipOnboardingToHome, goTrainingArcade, goArcadeSeries, goArcadeDetail, goArcadeSession, goArcadeComplete, finishCardioFinisher, skipCardioFinisher, finishLevelUp, goNotifications } = actions;

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
        <FightModeHub onHome={goHome} onBack={goTrainingHub} onFightFocus={goSetup} onComboCoach={goComboSetup} onPractice={goPractice} onStartHere={goStartHere} onCombatConditioning={goCombatCondSetup} onQuickFight={goTimer} onQuickCombo={goComboActive}/>
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
        <FightFocusTimer discipline={disc} cfg={cfg} onEnd={(rounds, c, completed, integrityResult) => goSummary(rounds, c, completed, integrityResult)} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
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
        <ComboCoachActive discipline={disc} cfg={comboCfg} onEnd={goComboEnd} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
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
        <FitBuilderSetup onBack={goFitHub} onGenerate={goFitWorkout} onCardioOnly={goCardioMode} profileSex={profile?.sex || 'male'}/>
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
        <CombatConditioningActive mission={ccMission} profile={profile} onEnd={goCombatCondComplete} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
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
