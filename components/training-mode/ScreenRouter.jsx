import { useRef, useState, useEffect, useMemo, lazy } from 'react';
import { reportError } from './data/analytics';
import SplashScreen from './SplashScreen';
import XpVerdictPlate, { useVerdictFlash } from './shared/XpVerdictPlate';
import Onboarding from './Onboarding';
import Paywall from './Paywall';
import GameLink from './GameLink';
import ManageSubscription from './ManageSubscription';
import Notifications from './Notifications';
import HomeDashboard from './HomeDashboard';
import FightModeHub from './FightModeHub';
import FightFocusSetup from './FightFocusSetup';
import JustTrainSetup from './JustTrainSetup';
import FightFocusTimer from './FightFocusTimer';
import SessionSummary from './SessionSummary';
import { resolveOutcome } from './shared/sessionOutcome';
import GhostVsScreen from './shared/GhostVsScreen';
import GhostResultScreen from './shared/GhostResultScreen';
import { getLastBattle, getMyBestGhost, getLastRecordedGhost } from './data/ghostBattles';
import MissionComplete from './shared/MissionComplete';
import { retentionOn } from './data/retentionFlags';
import { openNextUp, arcadeEndStars, campSessionEndStars } from './data/pathNextUp';
import StageStarsCard from './retention/ui/StageStarsCard';
import { playStarTone } from './data/audioEngine';
import { arcadeRetryKey, campRetryKey } from './data/retrySafety';
import { arcadeStageBoss, requestCampRetry } from './data/nearMissStore';
import { getSeriesById } from './data/trainingArcadeData';
import CampTransitionCard from './shared/CampTransitionCard';
import CampFitRunner from './CampFitRunner';
import CampFitSetRunner from './CampFitSetRunner';
import CampFullSession from './CampFullSession';
import ComboCoachSetup from './ComboCoachSetup';
import ComboCoachActive from './ComboCoachActive';
import FitModeHub from './FitModeHub';
import ProgramsScreen from './ProgramsScreen';
import TapesScreen from './TapesScreen';
import { tapesEnabled } from './data/tapes';
import CardioMode from './CardioMode';
import FitBuilderSetup from './FitBuilderSetup';
import { maxOutHandoff } from './data/loadoutMissions';
import FitBuilderWorkout from './FitBuilderWorkout';
import FitWorkoutComplete from './FitWorkoutComplete';
import QuickMissionScreen from './fit-challenge/QuickMissionScreen';
import FitCheckOffSolo from './fit-challenge/FitCheckOffSolo';
import FitCardResults from './fit-challenge/FitCardResults';
import { snapshotMission } from './data/fitCard';
import QuickMissionActive from './QuickMissionActive';
import QuickMissionSolo from './QuickMissionSolo';
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
const TrainingArcade = lazy(() => import('./TrainingArcade'));
const StrikeLab = lazy(() => import('./StrikeLab'));
const ConceptScreen = lazy(() => import('./ConceptScreen'));
const TrainingCampMap = lazy(() => import('./TrainingCampMap'));
const ArcadeSeriesIntroPage = lazy(() => import('./ArcadeSeriesIntroPage'));
const ArcadeSeriesDetail = lazy(() => import('./ArcadeSeriesDetail'));
const ArcadeSessionPlayer = lazy(() => import('./ArcadeSessionPlayer'));

// The row above the tab bar on a screen that scrolls: the BETA pill (fixed at
// 72px, App's FeedbackChip) and the scroll chevron sit on it, and the page
// scrolls under it as it does under the tab bar, so neither ever covers a card,
// a button or text (owner, 2026-11-23). SHELF_FADE is its soft top edge; the
// pill's top (96px up) is inside its solid part. SCROLL_PAD is the room the
// page's last content keeps under it: clear of the shelf, scrolled to the end.
const SHELF_H = 46;
const SHELF_FADE = 6;
const SCROLL_PAD = 118;
// The BETA pill's top (72 + its 24px) and a gap: what a one-screen page keeps clear.
const BETA_ROW_TOP = 102;

// Where the page's last card ends on screen. A frame as tall as the screen
// (PhoneFrame's 100dvh) is looked into, not taken as content; pieces placed
// absolutely (art, embers) are decoration. Only boxes that tall are walked
// into, so it touches a few dozen elements. `watch` is told each box measured,
// so a card that grows later (a picture loading, the share card coming in)
// moves the chevron too.
function contentEnd(root, watch) {
  let end = -Infinity;
  const tall = root.clientHeight - 1;
  const walk = (el) => {
    for (const c of el.children) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      watch?.(c);
      const r = c.getBoundingClientRect();
      if (r.height <= 0) continue;
      if (r.height >= tall) walk(c);
      else end = Math.max(end, r.bottom);
    }
  };
  walk(root);
  return end;
}

function useScrollIndicator(containerRef, shelfRef, children) {
  const [showScroll, setShowScroll] = useState(false);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => check()) : null;
    const watched = new Set();
    const watch = (el) => { if (ro && !watched.has(el)) { watched.add(el); ro.observe(el); } };
    // More lies below while the page's last card still ends under the shelf
    // (or, with none, past the bottom of the screen): once it is in view the
    // chevron goes. (scrollHeight counts the tab bar's padding and the frame's
    // empty height, so it cannot say where the cards end.)
    function check() {
      const shelf = shelfRef?.current;
      const limit = shelf ? shelf.getBoundingClientRect().top : root.getBoundingClientRect().bottom;
      setShowScroll(contentEnd(root, watch) > limit + 2);
    }
    check();
    const timer = setTimeout(check, 300);
    root.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    watch(root);
    return () => {
      clearTimeout(timer);
      root.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
      ro?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  return showScroll;
}

// 2.4b — camp block runner: an S7 "NEXT UP" interstitial leads into the round
// timer. As multi-block sessions land, this is where blocks chain — each block
// gets its transition card, then its timer.
function CampSessionRunner({ discipline, cfg, label, sub, detail, onEnd, fit, isResuming, onStateChange, resumeData }) {
  // A restored session skips straight past the NEXT UP card — it is an
  // interstitial for a session about to start, not one already underway.
  const [running, setRunning] = useState(!!resumeData);
  if (!running) return <CampTransitionCard label={label} sub={sub} detail={detail} onDone={() => setRunning(true)} />;
  // S2 (PM conditioning) runs the dedicated fit runner; skill blocks use the
  // shared striking ring timer. Both produce the same onEnd shape.
  // Spec 27 — a prescribed Arcade fit stage runs the COUNTED-SETS runner (reps
  // counted, weighted review, finishers); legacy timed circuits keep CampFitRunner.
  // Conditioning blocks restore the same way: the counted-sets runner brings
  // back its movement, set, reps and resolved plan; the timed runner its round
  // and clock. Both open held so nothing is banked while the phone was away.
  const resumeProps = { initialPaused: !!isResuming, onStateChange, initialResumeData: resumeData };
  if (fit) return cfg.prescription?.length
    ? <CampFitSetRunner cfg={cfg} onEnd={onEnd} {...resumeProps} />
    : <CampFitRunner cfg={cfg} onEnd={onEnd} {...resumeProps} />;
  // Skill blocks are the shared round timer, so a camp round restores its round
  // number and its clock exactly the way Fight Focus does.
  return (
    <FightFocusTimer
      discipline={discipline} cfg={cfg} onEnd={onEnd}
      initialPaused={!!isResuming} onStateChange={onStateChange} initialResumeData={resumeData}
    />
  );
}

function WithNav({ activeTab, onNavigate, pausedSession, onResume, onDiscardPaused, children, lock = false }) {
  const containerRef = useRef(null);
  const shelfRef = useRef(null);
  const showScroll = useScrollIndicator(containerRef, shelfRef, children);

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
    // Count the content alone, not the nav clearance this container adds once
    // it scrolls: that padding is part of scrollHeight, so a screen that fits
    // would otherwise stay "overflowing" for good after one that did not. The
    // same WithNav instance carries from Home (which overflows on a 412x811
    // phone) into the hubs, and the hubs came up scrollable by 110px.
    const check = () => {
      const pad = parseFloat(getComputedStyle(el).paddingBottom) || 0;
      setOverflowing(el.scrollHeight - pad > el.clientHeight + 4);
    };
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
          // Top edge of the row above the tab bar (plus a small gap): the
          // BETA pill's, and the resume pill's while a session is paused.
          // One-screen pages take max(their own clearance, this) as bottom
          // padding, so neither pill ever sits on their last card or button
          // (owner, 2026-11-23: it was 0 with nothing paused, and the BETA
          // pill covered the bottom of the Quick Mission and Build Workout
          // pages, the camp ladder and the Fight hub on a short phone).
          '--tm-resume-top': pausedSession ? '116px' : `${BETA_ROW_TOP}px`,
          // Beta TM-09 — when the resume pill floats over this screen, buy the
          // last rows of content enough clearance to scroll out from under it.
          // The last content keeps clear of the tab bar and the shelf above it.
          paddingBottom: scrolls
            ? (pausedSession ? 'calc(150px + env(safe-area-inset-bottom, 0px))' : `calc(${SCROLL_PAD}px + env(safe-area-inset-bottom, 0px))`)
            : 0,
        }}
      >
        {children}
      </div>
      <FloatingResumeButton pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} onDiscard={onDiscardPaused} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 440,
        zIndex: 100,
      }}>
        {/* The shelf (a screen that scrolls): the page passes under it as it
            does under the tab bar; the BETA pill sits on its left, the scroll
            chevron in its middle. A one-screen page has none: it keeps its
            own clearance above the tab bar.
            While a session is paused its RESUME pill takes the right of the
            row, and it reaches past the middle (RESUME · FIGHT FOCUS runs
            162..344 at 360 wide, RESUME · COMBAT CONDITIONING 107..344 at
            360 and 177..414 at 430), so the chevron would sit under it. The
            pill is what the row is for then: the chevron stays off. */}
        {scrolls && (
          <div ref={shelfRef} data-ui="nav-shelf" data-fade={SHELF_FADE} style={{
            height: SHELF_H, boxSizing: 'border-box', paddingTop: SHELF_FADE,
            background: `linear-gradient(to bottom, rgba(6,1,14,0) 0px, rgba(6,1,14,0.95) ${SHELF_FADE}px)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ScrollDownIndicator visible={showScroll && !pausedSession} />
          </div>
        )}
        <BottomNav active={activeTab} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// The stage's XP plate — crown on a clear, reaper on a stop — fired once when
// the complete screen mounts.
function StagePlate({ plate }) {
  const [flash, fire] = useVerdictFlash();
  useEffect(() => { if (plate) fire(plate); }, [plate, fire]);
  return <XpVerdictPlate flash={flash} />;
}

export default function ScreenRouter({ conceptView, tapesFrom, screen, disc, cfg, session, ghostLaunch, ccPreset, comboCfg, fitCfg, qmCfg, qmResult, qmEntry, ccMission, ccResult, cardioContext, cardioResult, cardioEntry, arcadeSeries, arcadeStage, arcadeMode, arcadeOrder, arcadeSettings, campCtx, campResult, profile, updateProfile, levelUp, pausedSession, onResume, onDiscardPaused, pausedAlt, onResumeAlt, onDiscardAlt, rustyTurn, onRustyDone, appPopupOpen, reportSessionState, resumeData, actions }) {
  const { goHome, goProgress, goFightHub, goFitHub, goFitSetup, goPrograms, goCardioMode, goQuickMissionSetup, goQuickMissionActive, goQuickMissionAtPace, goQuickMissionComplete, goCombatCondSetup, goCombatCondActive, goCombatCondComplete, goProfile, goBetaFeedback, goPaywall, goGameLink, goSubscription, goSetup, goComboSetup, goJustTrain, goTimer, goSummary, goComboActive, goComboEnd, goFitWorkout, goFitComplete, goPractice, goStartHere, goStartDailyMission, goAfterSplash, completeOnboarding, startFeatureTour, skipOnboardingToHome, goTrainingArcade, goArcadeSeries, goArcadeDetail, goArcadeSession, goArcadeComplete, finishCardioFinisher, skipCardioFinisher, finishLevelUp, goNotifications, goTrainingCamp, goCampSession, goCampComplete, goCampMap, goCampFullComplete , goConcept, startConceptFit, startConceptFight, goTapes } = actions;

  const isResuming = pausedSession?.screen === screen;

  // Item 11 — ghost battle flow gates. `vsAccepted` clears whenever a new
  // session config arrives so the VS screen shows once per fight; the result
  // screen is dismissed for the rest of that summary.
  const [vsAccepted, setVsAccepted] = useState(false);
  const [ghostResultSeen, setGhostResultSeen] = useState(false);
  useEffect(() => { setVsAccepted(false); }, [cfg]);
  useEffect(() => { if (screen !== 'summary') setGhostResultSeen(false); }, [screen]);
  // Retention feature 2 (switch `path`): an arcade v2 stage's end screen gets
  // a small stars row when the stage has stars (as stored after the clear).
  const [pathOn] = useState(() => retentionOn('path'));
  const arcadeStars = useMemo(() => (pathOn && campResult?.arcade && campResult.cleared ? arcadeEndStars(campResult) : null), [pathOn, campResult]);
  // Training Camp's own stars row (a valid session on a cleared level).
  const campStars = useMemo(() => (pathOn && campResult && !campResult.arcade ? campSessionEndStars(campResult) : null), [pathOn, campResult]);

  const handleNavigate = (tab) => {
    if (tab === 'home') goHome();
    else if (tab === 'train') goFitHub();
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
      // Locked like the setup screens: the redesigned Home fits one screen, and
      // unlocked it took the container's scroll padding on top of its own —
      // enough to scroll, and to inherit the previous screen's scroll position
      // with the header cut off. Lock still scrolls if a short phone needs it.
      <WithNav activeTab="home" onNavigate={handleNavigate} lock>
        <HomeDashboard onOpenConcept={(tab) => goConcept(tab, null, 'home')} onHome={goHome} onFightMode={goFightHub} onFitMode={goFitHub} onJustTrain={goJustTrain} onPrograms={goPrograms} onStartQuickMission={goQuickMissionActive} onReplayLast={actions.replayLastSession} onProfile={goProfile} profile={profile} onPractice={goPractice} onFightFocus={goSetup} onQuickMission={goQuickMissionSetup} onFitSetup={goFitSetup} onComboCoach={goComboSetup} onStartHere={goStartHere} onStartDailyMission={goStartDailyMission} onCombatConditioning={goCombatCondSetup} onBetaFeedback={goBetaFeedback} onTrainingArcade={goTrainingArcade} onTrain={goFitHub} onOpenGhost={actions.openGhostChallenge} onNextUp={(n) => openNextUp(n, { goArcadeDetail, goTrainingCamp })} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} pausedAlt={pausedAlt} onResumeAlt={onResumeAlt} onDiscardAlt={onDiscardAlt} rustyTurn={rustyTurn} onRustyDone={onRustyDone} appPopupOpen={appPopupOpen}/>
      </WithNav>
    );
  }
  if (screen === 'fight_hub') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <FightModeHub onTapes={tapesEnabled() ? () => goTapes('fight') : undefined} onOpenConcept={(tab) => goConcept(tab, null, 'fight')} onHome={goHome} onBack={goHome} onFitMode={goFitHub} onFightFocus={goSetup} onComboCoach={goComboSetup} onPractice={goPractice} onStartHere={goStartHere} onCombatConditioning={goCombatCondSetup} onJustTrain={goJustTrain} onTrainingCamp={goTrainingCamp}/>
      </WithNav>
    );
  }
  if (screen === 'training_camp') {
    // Locked (non-scrolling) so the whole 45a ladder fits above the bottom nav
    // footer; header lives in the screen, back chevron returns to the Fight hub.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
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
        isResuming={isResuming} onStateChange={reportSessionState} resumeData={resumeData}
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
            <WithWarmup minutes={cfg.warmupMin} enabled={!isResuming} title={`WARM UP · ${campCtx?.slot === 's2' ? 'CONDITIONING' : 'SKILL'}`}>
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
    const fullSession = <CampFullSession discipline={disc} cfgSkill={campCtx.cfgSkill} cfgFit={campCtx.cfgFit} onComplete={goCampFullComplete} initialPaused={!!isResuming} onStateChange={reportSessionState} initialResumeData={resumeData} />;
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <AnswerTheBellHost
          active={bossBellFull} bossName={campCtx.cfgSkill.bossName} campaignName={campCtx?.arcade?.campaignName}
          fit={false} rounds={campCtx.cfgSkill.rounds}
          seriesId={campCtx?.arcade?.seriesId} stageId={campCtx?.arcade?.stageId}
        >
          {bossBellFull ? fullSession : (
            <WithWarmup minutes={campCtx.cfgSkill.warmupMin} enabled={!isResuming} title="WARM UP · FULL CAMP">
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
      // Retention feature 3: the near-miss panel's facts and the same stage again
      // (same saga, stage, path and difficulty) through the arcade's own start.
      const a = campCtx?.arcade || null;
      const aSeries = a ? (getSeriesById(a.seriesId) || (arcadeSeries?.id === a.seriesId ? arcadeSeries : null)) : null;
      const aStage = aSeries?.stages?.find((st) => st.id === a.stageId) || null;
      const aNearMiss = a ? {
        key: arcadeRetryKey(a.seriesId, a.stageId), token: r, outcome: r.cleared ? 'pass' : aVerdict.outcome,
        unit: 'rounds', done: r.rounds, total: r.total, boss: arcadeStageBoss(r.campaignId, a.stageId, aSeries),
        onRetry: aSeries && aStage ? () => goArcadeSession(aSeries, aStage, a.path || 'fight', null, { difficulty: r.difficulty || 'normal', voiceCoach: true, sound: 'on' }) : null,
        onLeave: goHome,
      } : null;
      return (
        <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
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
            summary={arcadeStars ? <StageStarsCard stars={arcadeStars.stars} max={arcadeStars.max} line={arcadeStars.line} onLand={playStarTone}/> : null}
            shareData={{ title: aTitle, subtitle: aSub, mode: 'Training Arcade' }}
            nearMiss={aNearMiss}
            actions={[
              { label: 'BACK TO ARCADE', onClick: goArcadeComplete, kind: 'primary' },
              { label: 'HOME', onClick: goHome, kind: 'ghost', role: 'home' },
            ]}
          />
          <StagePlate plate={r.plate} />
        </WithNav>
      );
    }
    // Three outcomes: level cleared · one split mission done (level pending) ·
    // stopped/invalid (GOOD EFFORT, nothing counted). A replayed Session 1 of a
    // cleared level (switch `path`) reads as a mission done: its run waits for
    // Session 2, so it is not "LEVEL n CLEAR".
    const missionDone = r.split && r.sessionValid && (!r.cleared || !!r.replayS1);
    const clearedShown = r.cleared && !r.replayS1;
    const slotNum = r.slot === 's2' ? 2 : 1;
    const kindLbl = r.slot === 's2' ? 'CONDITIONING' : 'SKILL';
    // Item 13b — winning L12 is not "level 12 clear", it is the end of the camp.
    const titleFightWon = r.level === 12 && r.cleared;
    const eyebrow = titleFightWon ? '🏆 TITLE FIGHT WON'
      : clearedShown ? 'LEVEL CLEARED' : missionDone ? `SESSION ${slotNum} COMPLETE` : 'SESSION STOPPED';
    const title = titleFightWon ? 'CAMP COMPLETE'
      : clearedShown ? `LEVEL ${r.level} CLEAR` : missionDone ? `S${slotNum} · ${kindLbl} ✓` : 'GOOD EFFORT';
    const subtitle = titleFightWon
      ? `TRAINING CAMP · ${r.discipline} · ALL 12 LEVELS`
      : missionDone && slotNum === 1
        ? `TRAINING CAMP · ${r.discipline} · S2 tonight — leave 4–8 h`
        : `TRAINING CAMP · ${r.discipline} · ${r.difficulty}`;
    const cVerdict = resolveOutcome({
      completed: r.rounds, total: r.total, difficulty: r.difficulty, integrityResult: r.integrityResult,
    });
    // Retention feature 3: RETRY goes back to the camp map on this level's card,
    // so the readiness and gear checks run as on any start.
    const cNearMiss = {
      key: campRetryKey(r.discipline, r.level, r.slot), token: r, outcome: r.cleared || missionDone ? 'pass' : cVerdict.outcome,
      unit: 'rounds', done: r.rounds, total: r.total, boss: r.level === 12 ? 'title' : false,
      onRetry: () => { requestCampRetry(r.level); goCampMap(); }, onLeave: goHome,
    };
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
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
          summary={campStars ? <StageStarsCard title="LEVEL STARS" stars={campStars.stars} max={campStars.max} line={campStars.line} onLand={playStarTone}/> : null}
          nearMiss={cNearMiss}
          actions={titleFightWon
            ? [
                { label: 'BACK TO CAMP', onClick: goCampMap, kind: 'primary' },
                { label: 'HOME', onClick: goHome, kind: 'ghost' },
              ]
            : [
                r.unlockedTo && !r.replayS1
                  ? { label: `CONTINUE → L${r.unlockedTo}`, onClick: goCampMap, kind: 'primary' }
                  : { label: 'BACK TO CAMP', onClick: goCampMap, kind: 'primary' },
                { label: 'HOME', onClick: goHome, kind: 'ghost', role: 'home' },
              ]}
        />
        <StagePlate plate={r.plate} />
      </WithNav>
    );
  }
  if (screen === 'start_here' || screen === 'practice_starthere' || screen === 'practice') {
    // The Ladder: locked, its list of moves scrolls on its own. The Start
    // Here entries open straight onto the next move's card.
    // Keyed so switching between the two entries remounts onto the right view.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <PracticeMode key={screen} openLesson={screen !== 'practice'} onBack={goFightHub} onComboCoach={goComboSetup}/>
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
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <FightFocusSetup key={ghostLaunch?.id || 'plain'} discipline={disc} challenge={ghostLaunch} onBack={goFightHub} onStart={c => goTimer(c)} onPaywall={goPaywall} profile={profile}/>
      </WithNav>
    );
  }
  if (screen === 'just_train') {
    // Just Train starts the same live timer as Fight Focus, with its own rounds.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <JustTrainSetup discipline={disc} onBack={goFightHub} onStart={c => goTimer(c)} onPaywall={goPaywall} profile={profile}/>
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
        <WithWarmup minutes={cfg.warmupMin} enabled={!isResuming} title={cfg.mode === 'Just Train' ? 'JUST TRAIN' : 'FIGHT FOCUS'}>
          <FightFocusTimer discipline={disc} cfg={cfg} onEnd={goSummary} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
        </WithWarmup>
      </WithNav>
    );
  }
  if (screen === 'summary' && session) {
    const isCombo = session.sessionSource === 'comboCoach';
    const isJustTrain = session.cfg?.mode === 'Just Train';
    const handleRetry = isCombo
      ? () => goComboSetup(disc)
      : isJustTrain ? () => goJustTrain(disc) : () => goSetup(disc);
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
    // Not after Just Train: racing a Fight Focus ghost with a bag timer isn't
    // a fair race, and Just Train has no ghost battles of its own yet.
    const myBest = (session.cfg?.ghost || isJustTrain) ? null : getMyBestGhost('fight_focus', disc);
    const ghostRematchAction = myBest
      ? [{ label: '👻 BEAT THIS RUN', kind: 'secondary', onClick: () => goTimer({ ...session.cfg, ghost: myBest }) }]
      : [];
    // Haunt a Friend — only when THIS session made a verified Fight Focus
    // ghost (recorded within the last hour), since that is what gets sent.
    const madeGhost = !isJustTrain ? getLastRecordedGhost() : null;
    const hauntAction = madeGhost?.source?.mode === 'fight_focus' && Date.now() - (madeGhost.createdAt || 0) < 60 * 60 * 1000
      ? [{ label: '👻 HAUNT A FRIEND', kind: 'secondary', onClick: () => actions.openHaunt(madeGhost) }]
      : [];

    if (battleIsThisSession) {
      return (
        <GhostResultScreen
          battle={battle}
          challenge={session.challengeWin}
          onRematch={() => { setGhostResultSeen(true); handleRetry(); }}
          onDone={() => setGhostResultSeen(true)}
        />
      );
    }
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <SessionSummary
          discipline={disc}
          rounds={session.rounds}
          cfg={session.cfg}
          extraActions={[...hauntAction, ...ghostRematchAction]}
          completedRounds={session.completedRounds}
          integrityResult={session.integrityResult}
          fightStats={session.fightStats}
          board={session.board || null}
          onAgain={handleRetry}
          onBack={goFightHub}
          onHome={goHome}
          retry={{
            token: session, onLeave: goHome,
            onRetry: isCombo ? (comboCfg ? () => goComboActive(comboCfg) : null) : () => goTimer({ ...session.cfg }),
          }}
        />
      </WithNav>
    );
  }
  if (screen === 'combo_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <ComboCoachSetup discipline={disc} onBack={goFightHub} onStart={goComboActive} onPaywall={goPaywall} profile={profile}/>
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
    // Locked like Fight Mode's hub: the hub is exactly one screen tall and
    // scrolls its own stack, so the container's 110px of nav padding made the
    // whole page drag up and leave a gap under it.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <FitModeHub onTapes={tapesEnabled() ? () => goTapes('fit') : undefined} onOpenConcept={(tab) => goConcept(tab, null, 'fit')} onHome={goHome} onBack={goHome} onFightMode={goFightHub} onWorkoutBuilder={goFitSetup} onQuickMission={goQuickMissionSetup} onStartQuickMission={goQuickMissionActive} onPrograms={goPrograms} onCombatConditioning={goCombatCondSetup} onCardioMode={() => goCardioMode()} onGhostMode={() => goCardioMode({ ghost: 'best' })}/>
      </WithNav>
    );
  }
  if (screen === 'cardio_mode') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        {/* TM-16 census caught this: CardioMode only accepts onBack — the
            onHome prop was passed and silently dropped. */}
        <CardioMode onBack={goFitHub} onFightMode={goFightHub} onSessionState={reportSessionState} onStarted={actions.rememberCardio} entry={cardioEntry} resumeData={resumeData}/>
      </WithNav>
    );
  }
  if (screen === 'fit_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <FitBuilderSetup onBack={goFitHub} onFightMode={goFightHub} onGenerate={goFitWorkout} profileSex={profile?.sex || 'male'} onMaxOut={(pick) => goQuickMissionSetup({ openLibrary: true, ...maxOutHandoff(pick) })}/>
      </WithNav>
    );
  }
  if (screen === 'programs') {
    // A program day goes to the same generated-workout screen the builder
    // produces, so reviewing, editing and starting it work exactly as there.
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <ProgramsScreen onBack={goFitHub} onHome={goHome} onFightMode={goFightHub} onStart={goFitWorkout} onStartMission={goQuickMissionActive} onPaywall={goPaywall}/>
      </WithNav>
    );
  }
  if (screen === 'fit_workout' && fitCfg) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <FitBuilderWorkout cfg={fitCfg} profile={profile} onPaywall={goPaywall} onBack={fitCfg?.conceptId ? () => goConcept('fit', fitCfg.conceptId, 'fit') : fitCfg?.programId ? goPrograms : goFitSetup} onHome={goHome} onDone={(done, total) => goFitComplete(fitCfg, done, total)} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
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
        onStateChange={reportSessionState}
        initialResumeData={resumeData}
      />
    );
  }
  if (screen === 'fit_complete' && fitCfg) {
    // Its own WithNav (the key): the workout list hands over the same
    // scroll container otherwise, and a list scrolled down to FINISH WORKOUT
    // or COMPLETE WORKOUT opened the summary with its top cut off.
    return (
      <WithNav key="fit_complete" activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <FitWorkoutComplete cfg={fitCfg} completedCount={session?.exerciseCount || 0} totalCount={session?.totalCount || 0} cardioResult={cardioResult} onHome={goHome}
          retry={{ token: session, onRetry: () => goFitWorkout(fitCfg), onLeave: goHome }}/>
      </WithNav>
    );
  }
  if (screen === 'qm_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <QuickMissionScreen entry={qmEntry} onBack={goFitHub} onFightMode={goFightHub} onStart={goQuickMissionActive} onCardioOnly={goCardioMode} onPaywall={goPaywall}/>
      </WithNav>
    );
  }
  if (screen === 'qm_active' && qmCfg) {
    // SOLO runs on the same screen id, so pause / autosave / Continue all work
    // unchanged. Routed on the cfg and the stash, never on the v2 flag: a SOLO
    // stash must come back into SOLO even if preview was turned off since
    // (QuickMissionActive would hang on a SOLO stash's phase).
    // The workout card's CHECK-OFF (switch fitCard) is AT YOUR PACE with tick
    // boxes: a cfg or a stash that says so. No other start ever carries it.
    const checkOff = (qmCfg.mode === 'solo' && qmCfg.checkOff === true) || (resumeData?.kind === 'solo' && resumeData.checkOff === true);
    const Runner = checkOff ? FitCheckOffSolo : qmCfg.mode === 'solo' || resumeData?.kind === 'solo' ? QuickMissionSolo : QuickMissionActive;
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate}>
        <Runner missionCfg={qmCfg} profile={profile} onEnd={goQuickMissionComplete} onBack={(back) => goQuickMissionSetup(back)} onSwitchRun={goQuickMissionAtPace} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
      </WithNav>
    );
  }
  if (screen === 'qm_complete' && qmResult?.card) {
    // A workout card run (switch fitCard): its own results. REPEAT runs the
    // card that ran (after an in-run SHUFFLE, the new one); NEW CHALLENGE opens
    // the page on a new deal.
    const again = () => goQuickMissionActive({ ...qmCfg, mission: snapshotMission(qmResult.card), card: { ...qmResult.card, startedAt: Date.now() }, mode: qmResult.mode === 'solo' ? 'solo' : 'guided', ...(qmResult.checkOff ? { checkOff: true } : {}) });
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <FitCardResults result={qmResult} onRepeat={again} onNew={() => goQuickMissionSetup({ newDeal: true })} onBack={goFitHub}/>
      </WithNav>
    );
  }
  if (screen === 'qm_complete' && qmResult) {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <QuickMissionComplete result={qmResult} cardioResult={cardioResult} onRetry={goQuickMissionSetup} onFitHub={goFitHub} onHome={goHome}
          retry={{ token: qmResult, onRetry: qmCfg ? () => goQuickMissionActive(qmCfg.mission ? qmCfg : { ...qmCfg, mission: qmResult.mission }) : null, onLeave: goHome }}/>
      </WithNav>
    );
  }
  if (screen === 'cc_setup') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <CombatConditioningSetup key={ccPreset || 'plain'} initialPreset={ccPreset} onBack={goFightHub} onStart={goCombatCondActive} onCardioOnly={goCardioMode} profile={profile}/>
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
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <CombatConditioningComplete mission={ccMission} result={ccResult} cardioResult={cardioResult} onNewMission={goCombatCondSetup} onFightHub={goFightHub} onHome={goHome}
          retry={{ token: ccResult, onRetry: actions.retryCombatCond, onLeave: goHome }}/>
      </WithNav>
    );
  }
  if (screen === 'progress') {
    return (
      <WithNav activeTab="progress" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <ProgressScreen onHome={goHome} profile={profile} onOpenCardRun={(id) => goQuickMissionSetup({ cardRunId: id })}/>
      </WithNav>
    );
  }
  if (screen === 'profile') {
    return (
      // lock: the overview fits one screen now. The edit and settings views
      // are longer and still scroll — lock falls back to scrolling on overflow.
      <WithNav activeTab="profile" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <Profile onHome={goHome} onBack={goHome} onSave={goHome} profile={profile} updateProfile={updateProfile} onBetaFeedback={goBetaFeedback} onPaywall={goPaywall} onGameLink={goGameLink} onSubscription={goSubscription} onNotifications={goNotifications} onReplayTour={startFeatureTour}/>
      </WithNav>
    );
  }
  if (screen === 'concept') {
    const back = conceptView?.from === 'fit' ? goFitHub : conceptView?.from === 'fight' ? goFightHub : conceptView?.from === 'arcade' ? goTrainingArcade : goHome;
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <ConceptScreen
          key={`${conceptView?.id || 'featured'}:${conceptView?.tab || 'fit'}`}
          conceptId={conceptView?.id || null}
          initialTab={conceptView?.tab || 'fit'}
          onBack={back}
          onStartFit={startConceptFit}
          onStartFight={startConceptFight}
          onOpenGauntlet={actions.goConceptSaga}
          onPaywall={goPaywall}
        />
      </WithNav>
    );
  }
  if (screen === 'tapes') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <TapesScreen key={tapesFrom || 'all'} initialKind={tapesFrom} onBack={tapesFrom === 'fight' ? goFightHub : tapesFrom === 'fit' ? goFitHub : goHome}/>
      </WithNav>
    );
  }
  if (screen === 'strike_lab') {
    return <StrikeLab onExit={goHome} onOpenConcept={(id) => goConcept('fit', id, 'home')} onOpenTapes={() => goTapes('all')} />;
  }
  if (screen === 'beta_feedback') {
    return (
      <WithNav activeTab="profile" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
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
    return <ManageSubscription onBack={goProfile} onPaywall={goPaywall}/>;
  }
  if (screen === 'arcade') {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <TrainingArcade onHome={goHome} onBack={goHome} onSelectSeries={goArcadeSeries} onChallengeCode={actions.startChallenge} onStartGuide={actions.startArcadeGuide}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_intro' && arcadeSeries) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused}>
        <ArcadeSeriesIntroPage series={arcadeSeries} onHome={goHome} onBack={goTrainingArcade} onContinue={(series, settings) => goArcadeDetail(series, settings)}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_series' && arcadeSeries) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <ArcadeSeriesDetail onHome={goHome} series={arcadeSeries} onBack={goTrainingArcade} onStartStage={goArcadeSession} onPaywall={goPaywall} arcadeSettings={arcadeSettings}/>
      </WithNav>
    );
  }
  if (screen === 'arcade_session' && arcadeSeries && arcadeStage) {
    return (
      <WithNav activeTab="train" onNavigate={handleNavigate} pausedSession={pausedSession} onResume={onResume} onDiscardPaused={onDiscardPaused} lock>
        <ArcadeSessionPlayer series={arcadeSeries} stage={arcadeStage} selectedMode={arcadeMode} modeOrder={arcadeOrder} arcadeSettings={arcadeSettings} onHome={goHome} onComplete={goArcadeComplete} onExit={goArcadeComplete} onDoneForToday={actions.goArcadeDoneToday} initialPaused={isResuming} onStateChange={reportSessionState} initialResumeData={resumeData}/>
      </WithNav>
    );
  }
  // No branch matched (a restored session whose state was never saved, a screen name from an older
  // version): go Home instead of leaving a blank screen with no way out.
  return <BlankScreenHome screen={screen} onHome={goHome}/>;
}

function BlankScreenHome({ screen, onHome }) {
  useEffect(() => { reportError(new Error(`blank screen: ${screen}`), 'router'); onHome(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
