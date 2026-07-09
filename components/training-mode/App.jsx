import { useState, useCallback, useEffect, useRef } from 'react';
import { STYLE, C } from './Styles';
import ScreenRouter from './ScreenRouter';
import { addFightFocusSession, addComboCoachSession, addFitModeSession, addQuickMissionSession, addCombatConditioningSession, addDailyMissionBonus, addHybridTrainingBonus, loadStats, getLevel } from './data/userStats';
import { loadProfile, saveProfile } from './data/userProfile';
import { generateCombatConditioningMission } from './data/combatConditioningGenerator';
import { stopVoiceSession } from './voiceCoach';
import { trackEvent } from './data/analytics';

if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const _imgPaths = [
    '/static/brand/background-w-logo.png',
    '/static/brand/tm-logo-gold.png',
    '/static/fitmode/cardio-mode-banner.webp',
    '/static/fitmode/cardio-finisher-sub-banner.png',
  ];
  _imgPaths.forEach(p => {
    const img = new Image();
    img.onerror = () => console.warn('Missing Training Mode image:', p);
    img.src = p;
  });
}

const ACTIVE_SESSION_SCREENS = new Set([
  'timer', 'combo_active', 'qm_active', 'fit_workout', 'cc_active', 'arcade_session',
]);

// Stable per-combo key so the Hybrid Training Bonus is awarded only once for a
// given workout + cardio finisher, even across double-fires, refresh, or reopen.
function makeHybridBonusKey(mode) {
  const sid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return `tm_hybrid_bonus_${mode}_${sid}`;
}

function tryCompleteDailyMission(completedActionType) {
  if (typeof localStorage === 'undefined') return;
  const today = new Date().toISOString().slice(0, 10);
  const isActive = localStorage.getItem('dailyMissionActive') === 'true';
  const alreadyDone = localStorage.getItem('dailyMissionCompleted') === 'true';
  const missionDate = localStorage.getItem('dailyMissionDate');
  if (!isActive || alreadyDone || missionDate !== today) return;

  let missionData;
  try { missionData = JSON.parse(localStorage.getItem('dailyMissionActiveData') || 'null'); }
  catch { return; }
  if (!missionData || !missionData.action) return;

  const actionMap = {
    quickMission: 'quickMission',
    fightFocus: 'fightFocus',
    comboCoach: 'comboCoach',
    fitSetup: 'fitMode',
    practice: 'startHere',
    startHere: 'startHere',
    combatConditioning: 'combatConditioning',
  };
  const expectedType = actionMap[missionData.action];
  if (completedActionType !== expectedType) return;

  localStorage.setItem('dailyMissionCompleted', 'true');
  localStorage.setItem('dailyMissionActive', 'false');
  localStorage.removeItem('dailyMissionActiveData');
  addDailyMissionBonus();
  trackEvent('daily_mission_complete', { action: completedActionType });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('training-mode-stats-updated'));
  }
}

const ONBOARDING_KEY = 'trainingModeOnboardingComplete';

const PAUSED_SESSION_KEY = 'trainingModePausedSession';
const PAUSED_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function loadPausedSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PAUSED_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp) return null;
    if (Date.now() - parsed.timestamp > PAUSED_SESSION_MAX_AGE_MS) {
      localStorage.removeItem(PAUSED_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function savePausedSession(session) {
  if (typeof localStorage === 'undefined') return;
  if (session) {
    try { localStorage.setItem(PAUSED_SESSION_KEY, JSON.stringify(session)); }
    catch { /* quota or serialization error */ }
  } else {
    localStorage.removeItem(PAUSED_SESSION_KEY);
  }
}

export default function App() {
  const [screen,   setScreen  ] = useState('start');
  const [disc,     setDisc    ] = useState('Boxing');
  const [cfg,      setCfg     ] = useState(null);
  const [session,  setSession ] = useState(null);
  const [comboCfg, setComboCfg] = useState(null);
  const [fitCfg,   setFitCfg  ] = useState(null);
  const [qmCfg,    setQmCfg   ] = useState(null);
  const [qmResult, setQmResult] = useState(null);
  const [ccMission, setCcMission] = useState(null);
  const [ccResult,  setCcResult ] = useState(null);
  const [cardioContext, setCardioContext] = useState(null);
  const [cardioResult,  setCardioResult ] = useState(null);
  const [arcadeSeries, setArcadeSeries] = useState(null);
  const [arcadeStage,  setArcadeStage ] = useState(null);
  const [arcadeMode,   setArcadeMode  ] = useState(null);
  const [arcadeOrder,  setArcadeOrder ] = useState(null);
  const [arcadeSettings, setArcadeSettings] = useState(null);
  const [profile,  setProfile ] = useState(() => loadProfile());
  const [pausedSession, setPausedSession] = useState(() => loadPausedSession());
  const [resumeData, setResumeData] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const activeSessionStateRef = useRef(null);
  const postGuideRef = useRef(null);
  // Level captured at the start of a session so the cardio finisher (which adds
  // more XP after the main block) can still detect a level-up against it.
  const sessionStartLevelRef = useRef(null);

  // After a session awards XP, show the Level Up reveal (design 6a) before the
  // completion screen when the player crossed a level boundary; otherwise go
  // straight to the completion screen.
  const routeAfterXp = (beforeLevel, nextScreen) => {
    const afterLevel = getLevel(loadStats().xp);
    if (afterLevel > beforeLevel) {
      setLevelUp({ fromLevel: beforeLevel, toLevel: afterLevel, nextScreen });
      setScreen('level_up');
    } else {
      setScreen(nextScreen);
    }
  };

  const updateProfile = (nextProfile) => {
    const merged = { ...profile, ...nextProfile };
    saveProfile(merged);
    setProfile(merged);
  };

  const pauseCurrentSession = useCallback(() => {
    if (!ACTIVE_SESSION_SCREENS.has(screen)) return null;
    stopVoiceSession();
    const internalState = activeSessionStateRef.current
      ? { ...activeSessionStateRef.current }
      : null;
    const paused = {
      screen,
      disc,
      cfg,
      comboCfg,
      fitCfg,
      qmCfg,
      ccMission,
      arcadeSeries,
      arcadeStage,
      arcadeMode,
      arcadeOrder,
      arcadeSettings,
      internalState,
      timestamp: Date.now(),
    };
    setPausedSession(paused);
    savePausedSession(paused);
    activeSessionStateRef.current = null;
    return paused;
  }, [screen, disc, cfg, comboCfg, fitCfg, qmCfg, ccMission, arcadeSeries, arcadeStage, arcadeMode, arcadeOrder, arcadeSettings]);

  const resumeSession = useCallback(() => {
    if (!pausedSession) return;
    setDisc(pausedSession.disc);
    setCfg(pausedSession.cfg);
    setComboCfg(pausedSession.comboCfg);
    setFitCfg(pausedSession.fitCfg);
    setQmCfg(pausedSession.qmCfg);
    setCcMission(pausedSession.ccMission);
    setArcadeSeries(pausedSession.arcadeSeries);
    setArcadeStage(pausedSession.arcadeStage);
    setArcadeMode(pausedSession.arcadeMode);
    setArcadeOrder(pausedSession.arcadeOrder);
    setArcadeSettings(pausedSession.arcadeSettings || null);
    setResumeData(pausedSession.internalState || null);
    setScreen(pausedSession.screen);
  }, [pausedSession]);

  const discardPausedSession = useCallback(() => {
    setPausedSession(null);
    savePausedSession(null);
    setResumeData(null);
  }, []);

  // Clear pausedSession after successfully resuming (next render after screen matches)
  useEffect(() => {
    if (pausedSession && screen === pausedSession.screen) {
      setPausedSession(null);
      savePausedSession(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Reset scroll to the top on every screen change so a new page never opens
  // mid-scroll carried over from the previous one.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.scrollTo(0, 0);
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [screen]);

  const reportSessionState = useCallback((state) => {
    activeSessionStateRef.current = state;
  }, []);

  const actions = {
    goStart:       () => setScreen('start'),
    goHome:        () => { pauseCurrentSession(); setScreen('home'); },
    goProgress:    () => { pauseCurrentSession(); setScreen('progress'); },
    goTrainingHub: () => { pauseCurrentSession(); setScreen('training_hub'); },
    goFightHub:    () => setScreen('fight_hub'),
    goFitHub:      () => setScreen('fit_hub'),
    goFitSetup:    () => setScreen('fit_setup'),
    goCardioMode:  () => setScreen('cardio_mode'),
    goWorkoutCodec: () => setScreen('workout_codec'),
    goQuickMissionSetup: () => setScreen('qm_setup'),
    goQuickMissionActive: (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setQmCfg(c); setScreen('qm_active'); },
    goQuickMissionComplete: (result) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null);
      savePausedSession(null);
      setResumeData(null);
      addQuickMissionSession(result.exercisesCompleted, result.totalExercises, result.completed);
      tryCompleteDailyMission('quickMission');
      trackEvent('session_complete', { mode: 'quickMission', exercises: result.exercisesCompleted });
      setQmResult(result);
      const addon = qmCfg?.cardioAddon;
      if (addon?.enabled) {
        sessionStartLevelRef.current = beforeLevel;
        setCardioResult(null);
        setCardioContext({ mode: 'qm', addon, mainCompleted: !!result.completed, hybridBonusKey: makeHybridBonusKey('qm') });
        setScreen('cardio_finisher');
      } else {
        setCardioResult(null);
        routeAfterXp(beforeLevel, 'qm_complete');
      }
    },
    goCombatCondSetup: () => setScreen('cc_setup'),
    goTrainingArcade: () => setScreen('arcade'),
    goArcadeSeries: (series) => { setArcadeSeries(series); setArcadeSettings(null); setScreen(series?.id === 'one-punch-protocol' ? 'arcade_series' : 'arcade_intro'); },
    goArcadeDetail: (series, settings) => { setArcadeSeries(series); setArcadeSettings(settings || null); setScreen('arcade_series'); },
    goArcadeSession: (series, stage, mode, order, settings) => {
      setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null;
      setArcadeSeries(series); setArcadeStage(stage); setArcadeMode(mode); setArcadeOrder(order);
      setArcadeSettings(settings || arcadeSettings || null);
      setScreen('arcade_session');
    },
    goArcadeComplete: () => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setScreen('arcade_series'); },
    goCombatCondActive: (config) => {
      setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null;
      const mission = generateCombatConditioningMission(config);
      if (config?.cardioAddon?.enabled) mission.cardioAddon = config.cardioAddon;
      setCcMission(mission);
      setScreen('cc_active');
    },
    goCombatCondComplete: (result) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      addCombatConditioningSession(result.drillsCompleted, result.totalDrills, result.roundsCompleted, result.totalRounds, result.completed);
      tryCompleteDailyMission('combatConditioning');
      trackEvent('session_complete', { mode: 'combatConditioning', drills: result.drillsCompleted });
      setCcResult(result);
      const addon = ccMission?.cardioAddon;
      if (addon?.enabled) {
        sessionStartLevelRef.current = beforeLevel;
        setCardioResult(null);
        setCardioContext({ mode: 'cc', addon, mainCompleted: !!result.completed, hybridBonusKey: makeHybridBonusKey('cc') });
        setScreen('cardio_finisher');
      } else {
        setCardioResult(null);
        routeAfterXp(beforeLevel, 'cc_complete');
      }
    },
    goProfile:     () => { pauseCurrentSession(); setScreen('profile'); },
    goBetaFeedback: () => setScreen('beta_feedback'),
    goPaywall:      () => setScreen('paywall'),
    goGameLink:     () => setScreen('game_link'),
    goSubscription: () => setScreen('subscription'),
    goSetup:       (d) => { setDisc(d); setScreen('setup'); },
    goComboSetup:  (d) => { setDisc(d); setScreen('combo_setup'); },
    goTimer:       (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setCfg(c); setScreen('timer'); },
    goSummary:     (rounds, c, completed, integrityResult) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const total = c.rounds || rounds.length;
      const done = typeof completed === 'number' ? completed : rounds.length;
      addFightFocusSession(done, total);
      tryCompleteDailyMission('fightFocus');
      trackEvent('session_complete', { mode: 'fightFocus', rounds: done });
      setSession({ rounds, cfg: c, completedRounds: completed, sessionSource: 'fightFocus', integrityResult });
      routeAfterXp(beforeLevel, 'summary');
    },
    goComboActive: (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setComboCfg(c); setScreen('combo_active'); },
    goComboEnd:    (roundsDone, totalRounds, integrityResult) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const done = typeof roundsDone === 'number' ? roundsDone : 0;
      const total = typeof totalRounds === 'number' ? totalRounds : 1;
      addComboCoachSession(done, total);
      tryCompleteDailyMission('comboCoach');
      trackEvent('session_complete', { mode: 'comboCoach', rounds: done });
      const comboCfgSnapshot = comboCfg;
      setSession({
        rounds: Array.from({ length: done }, (_, i) => ({
          round_title: `${disc} Combo Round`,
          coach_prompt: `${comboCfgSnapshot?.speedLabel || 'MEDIUM'} speed combos`,
          session_type: 'Combo Coach',
        })),
        cfg: {
          rounds: total,
          roundMin: comboCfgSnapshot?.roundMin || 3,
          restSec: 60,
          difficulty: comboCfgSnapshot?.difficulty || 'Normal',
          mode: 'Combo Coach',
        },
        completedRounds: done,
        sessionSource: 'comboCoach',
        integrityResult,
      });
      routeAfterXp(beforeLevel, 'summary');
    },
    goFitWorkout:  (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setFitCfg(c); setScreen('fit_workout'); },
    goFitComplete: (c, done, total) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      addFitModeSession(done, total);
      tryCompleteDailyMission('fitMode');
      trackEvent('session_complete', { mode: 'fitMode', exercises: done });
      setFitCfg(c);
      setSession({ exerciseCount: done, totalCount: total });
      const addon = c?.cardioAddon;
      if (addon?.enabled) {
        sessionStartLevelRef.current = beforeLevel;
        setCardioResult(null);
        setCardioContext({ mode: 'fit', addon, mainCompleted: total > 0 && done >= total, hybridBonusKey: makeHybridBonusKey('fit') });
        setScreen('cardio_finisher');
      } else {
        setCardioResult(null);
        routeAfterXp(beforeLevel, 'fit_complete');
      }
    },
    finishCardioFinisher: (result) => {
      const ctx = cardioContext;
      let hybridBonusXp = 0;
      if (result?.completed && ctx?.mainCompleted) {
        const key = ctx.hybridBonusKey;
        const alreadyAwarded = typeof localStorage !== 'undefined' && key
          ? localStorage.getItem(key) === 'true'
          : false;
        if (!alreadyAwarded) {
          hybridBonusXp = addHybridTrainingBonus();
          if (typeof localStorage !== 'undefined' && key) localStorage.setItem(key, 'true');
          trackEvent('hybrid_bonus', { mode: ctx?.mode });
        }
      }
      setCardioResult({ ...result, hybridBonusXp });
      const mode = ctx?.mode;
      setCardioContext(null);
      const dest = mode === 'qm' ? 'qm_complete' : mode === 'cc' ? 'cc_complete' : 'fit_complete';
      const beforeLevel = sessionStartLevelRef.current ?? getLevel(loadStats().xp);
      sessionStartLevelRef.current = null;
      routeAfterXp(beforeLevel, dest);
    },
    skipCardioFinisher: () => {
      const mode = cardioContext?.mode;
      setCardioResult(null);
      setCardioContext(null);
      const dest = mode === 'qm' ? 'qm_complete' : mode === 'cc' ? 'cc_complete' : 'fit_complete';
      const beforeLevel = sessionStartLevelRef.current ?? getLevel(loadStats().xp);
      sessionStartLevelRef.current = null;
      routeAfterXp(beforeLevel, dest);
    },
    finishLevelUp: () => {
      const dest = levelUp?.nextScreen || 'home';
      setLevelUp(null);
      setScreen(dest);
    },
    goPractice:    (d) => { setDisc(d); setScreen('practice'); },
    goStartHere:   () => { setDisc('Boxing'); setScreen('practice_starthere'); },
    goStartDailyMission: (mission) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dailyMissionActive', 'true');
        localStorage.setItem('dailyMissionActiveData', JSON.stringify(mission));
      }
      if (mission.action === 'practice' || mission.action === 'startHere') {
        setDisc('Boxing');
        setScreen('practice_starthere');
      } else if (mission.action === 'fightFocus') {
        setDisc('Boxing');
        setScreen('setup');
      } else if (mission.action === 'comboCoach') {
        setDisc('Boxing');
        setScreen('combo_setup');
      } else if (mission.action === 'combatConditioning') {
        setScreen('cc_setup');
      } else if (mission.action === 'fitSetup') {
        setScreen('fit_setup');
      } else {
        setScreen('qm_setup');
      }
    },
    goOnboarding:  () => setScreen('onboarding'),
    goAfterSplash: () => {
      const done = typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_KEY) === 'true';
      setScreen(done ? 'home' : 'onboarding');
    },
    completeOnboarding: ({ goal, experience, recommendation, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      trackEvent('onboarding_complete', { goal, experience });
      // Show the first-run "How It Works" guide once, then route to the
      // onboarding recommendation (stashed until the guide is dismissed).
      postGuideRef.current = recommendation || null;
      setScreen('how_it_works');
    },
    finishGuide: () => {
      const recommendation = postGuideRef.current;
      postGuideRef.current = null;
      if (recommendation?.type === 'startHere') {
        setDisc('Boxing');
        setScreen('practice_starthere');
      } else if (recommendation?.type === 'practice') {
        setDisc('Boxing');
        setScreen('practice');
      } else if (recommendation?.type === 'fightFocus') {
        setDisc('Boxing');
        setScreen('setup');
      } else {
        setScreen('qm_setup');
      }
    },
    skipOnboardingToHome: ({ goal, experience, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      setScreen('home');
    },
  };

  return (
    <>
      <style>{STYLE}</style>
      <div style={{ minHeight: '100dvh', background: C.bg }}>
        <ScreenRouter
          screen={screen} disc={disc} cfg={cfg} session={session}
          comboCfg={comboCfg} fitCfg={fitCfg} qmCfg={qmCfg} qmResult={qmResult}
          ccMission={ccMission} ccResult={ccResult}
          cardioContext={cardioContext} cardioResult={cardioResult}
          arcadeSeries={arcadeSeries} arcadeStage={arcadeStage} arcadeMode={arcadeMode} arcadeOrder={arcadeOrder} arcadeSettings={arcadeSettings}
          profile={profile} updateProfile={updateProfile} levelUp={levelUp}
          pausedSession={pausedSession} onResume={resumeSession} onDiscardPaused={discardPausedSession}
          reportSessionState={reportSessionState} resumeData={resumeData}
          actions={actions}
        />
      </div>
    </>
  );
}
