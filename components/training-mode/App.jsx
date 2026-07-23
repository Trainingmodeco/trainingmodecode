import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { STYLE, C } from './Styles';
import ScreenRouter from './ScreenRouter';
import { addFightFocusSession, addComboCoachSession, addFitModeSession, addQuickMissionSession, addCombatConditioningSession, addDailyMissionBonus, addHybridTrainingBonus, addCampSession, loadStats, getLevel } from './data/userStats';
import { completeCampLevel } from './data/campProgress';
import { campSessionState, markCampSessionDone } from './data/campSessions';
import { campSessionXp } from './protocol/content';
import { recordFightSession } from './data/fightStats';
import { loadProfile, saveProfile } from './data/userProfile';
import { generateCombatConditioningMission } from './data/combatConditioningGenerator';
import { stopVoiceSession } from './voiceCoach';
import { trackEvent } from './data/analytics';
import { refreshEntitlement } from './data/entitlements';
import FeatureTour, { TOUR_STEPS } from './shared/FeatureTour';
import { preloadCriticalArt } from './shared/preloadImages';

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
const TOUR_KEY = 'trainingModeTourComplete';

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
  const [campCtx,    setCampCtx   ] = useState(null);   // 2.4 — active camp session ctx
  const [campResult, setCampResult] = useState(null);   // 2.4 — camp completion result
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
  const [showOffline, setShowOffline] = useState(false);
  const [tourStep, setTourStep] = useState(null); // design 33 feature tour (null = off)
  const activeSessionStateRef = useRef(null);
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

  // Real connectivity detection. The app is local-first, so going offline just
  // flashes a small bottom-left toast for ~4s rather than blocking anything.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let hideTimer;
    const flash = () => { setShowOffline(true); clearTimeout(hideTimer); hideTimer = setTimeout(() => setShowOffline(false), 4000); };
    const on = () => { setShowOffline(false); clearTimeout(hideTimer); };
    const off = () => { flash(); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (navigator.onLine === false) flash();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearTimeout(hideTimer); };
  }, []);

  const reportSessionState = useCallback((state) => {
    activeSessionStateRef.current = state;
  }, []);

  // Warm the cache for upcoming art (hub banners, saga posters, backdrops)
  // once, at idle priority, so screens open with images already loaded.
  useEffect(() => { preloadCriticalArt(); }, []);

  // Returning from Stripe checkout (?checkout=success): re-sync the Pro
  // entitlement from Supabase and clean the query string. Purely additive —
  // does nothing on a normal load.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      refreshEntitlement();
      trackEvent('checkout_return_success');
      params.delete('checkout');
      const qs = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  // ── Design 33: first-run feature tour (spotlight coach marks) ──
  // The overlay lives at app level; each step declares which screen it runs on.
  const markTourDone = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOUR_KEY, 'true');
  };
  const advanceTour = () => {
    const next = (tourStep ?? 0) + 1;
    if (next >= TOUR_STEPS.length) {
      markTourDone();
      setTourStep(null);
      setScreen('home');
      trackEvent('feature_tour_complete');
    } else {
      setScreen(TOUR_STEPS[next].screen);
      setTourStep(next);
    }
  };
  const skipTour = () => {
    markTourDone();
    setTourStep(null);
    trackEvent('feature_tour_skipped', { step: tourStep });
  };

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
    goArcadeSeries: (series) => { setArcadeSeries(series); setArcadeSettings(null); setScreen(['one-punch-protocol', 'demon-back-protocol'].includes(series?.id) ? 'arcade_series' : 'arcade_intro'); },
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
    goNotifications: () => setScreen('notifications'),
    goSetup:       (d) => { setDisc(d); setScreen('setup'); },
    goComboSetup:  (d) => { setDisc(d); setScreen('combo_setup'); },
    goTrainingCamp: (d) => { if (d) setDisc(d); setScreen('training_camp'); },
    // 2.4 — launch a camp level's session (ctx = {discipline, level, difficulty, cfg}).
    goCampSession: (ctx) => {
      setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null;
      setCampCtx(ctx); setDisc(ctx.discipline);
      // FULL CAMP runs both blocks in one sitting; cfg holds the skill block so
      // the warm-up wrapper still reads warmupMin.
      setCfg(ctx.format === 'full' ? ctx.cfgSkill : ctx.cfg);
      setScreen(ctx.format === 'full' ? 'camp_full' : 'camp_session');
    },
    // 2.4 — camp session finished (same onEnd shape as FightFocusTimer). Award
    // XP, then advance: single levels clear on a valid full completion; split
    // levels (L4–11) mark S1/S2 done independently and clear only at ✓✓.
    goCampComplete: (rounds, c, completed, integrityResult) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const total = c.rounds || (Array.isArray(rounds) ? rounds.length : 1);
      const done = typeof completed === 'number' ? completed : (Array.isArray(rounds) ? rounds.length : 0);
      const level = campCtx?.level;
      const split = !!campCtx?.split;
      const slot = campCtx?.slot || 's1';
      // Camp progression respects the 1.6 anti-cheat: a session flagged invalid
      // (too fast / suspicious) earns no XP and does NOT count toward the level.
      const ir = integrityResult;
      const awarded = !ir || ir.awardXp !== false;
      const fullyValid = !ir || ir.isFullyValid;
      const sessionValid = done >= total && awarded && fullyValid;
      // 2.8 — XP from the engine ruleset (active-min × difficulty × completion).
      // The anti-cheat gate is preserved: not awarded → no XP, no record.
      const diff = c?.difficulty || campCtx?.difficulty || 'normal';
      const xpEarned = awarded
        ? addCampSession(level, done, total, campSessionXp({
            difficulty: diff, roundMin: c?.roundMin ?? 2,
            doneRounds: done, totalRounds: total, valid: true,
          }))
        : 0;
      let cleared;
      if (split) {
        let st = campSessionState(level);
        if (sessionValid && level != null) st = markCampSessionDone(level, slot);
        cleared = !!(st.s1 && st.s2);
      } else {
        cleared = sessionValid;
      }
      const unlockedTo = (cleared && level != null) ? completeCampLevel(level) : null;
      trackEvent('session_complete', { mode: 'trainingCamp', level, slot: split ? slot : undefined, rounds: done });
      setCampResult({ level, difficulty: campCtx?.difficulty, discipline: campCtx?.discipline, rounds: done, total, xpEarned, integrityResult, cleared, unlockedTo, split, slot, sessionValid });
      routeAfterXp(beforeLevel, 'camp_complete');
    },
    goCampMap: () => setScreen('training_camp'),
    // 2.4 — FULL CAMP finished (both blocks). Each valid block earns XP and
    // marks its slot; the level clears when both are ✓✓.
    goCampFullComplete: ({ skill, fit }) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const level = campCtx?.level;
      const s = skill || { total: 1, done: 0, valid: false };
      const f = fit || { total: 1, done: 0, valid: false };
      // 2.8 — real XP per block; both-block completion earns the full-arc bonus.
      const diff = campCtx?.difficulty || 'normal';
      const bothValid = s.valid && f.valid;
      let xpEarned = 0;
      if (level != null) {
        if (s.valid) { xpEarned += addCampSession(level, s.done, s.total, campSessionXp({ difficulty: diff, roundMin: campCtx?.cfgSkill?.roundMin ?? 2, doneRounds: s.done, totalRounds: s.total, valid: true, fullArc: bothValid })); markCampSessionDone(level, 's1'); }
        if (f.valid) { xpEarned += addCampSession(level, f.done, f.total, campSessionXp({ difficulty: diff, roundMin: campCtx?.cfgFit?.roundMin ?? 2, doneRounds: f.done, totalRounds: f.total, valid: true, fullArc: bothValid })); markCampSessionDone(level, 's2'); }
      }
      const st = level != null ? campSessionState(level) : {};
      const cleared = !!(st.s1 && st.s2);
      const unlockedTo = cleared ? completeCampLevel(level) : null;
      trackEvent('session_complete', { mode: 'trainingCamp', level, format: 'full' });
      setCampResult({ level, difficulty: campCtx?.difficulty, discipline: campCtx?.discipline, rounds: s.done + f.done, total: s.total + f.total, xpEarned, integrityResult: null, cleared, unlockedTo, split: false, sessionValid: s.valid || f.valid });
      routeAfterXp(beforeLevel, 'camp_complete');
    },
    goTimer:       (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setCfg(c); setScreen('timer'); },
    goSummary:     (rounds, c, completed, integrityResult, fightSessionStats) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const total = c.rounds || rounds.length;
      const done = typeof completed === 'number' ? completed : rounds.length;
      addFightFocusSession(done, total);
      // 1.4/1.5 — Fight Focus has no called combos, so any strike count comes
      // from the accelerometer (motion-verified thrown strikes) or is zero.
      const fs = fightSessionStats || {};
      recordFightSession({ rounds: done, strikes: fs.motionUsed ? (fs.thrown || 0) : 0 });
      tryCompleteDailyMission('fightFocus');
      trackEvent('session_complete', { mode: 'fightFocus', rounds: done });
      setSession({ rounds, cfg: c, completedRounds: completed, sessionSource: 'fightFocus', integrityResult, fightStats: { thrown: fs.thrown || 0, motionUsed: !!fs.motionUsed } });
      routeAfterXp(beforeLevel, 'summary');
    },
    goComboActive: (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setComboCfg(c); setScreen('combo_active'); },
    goComboEnd:    (roundsDone, totalRounds, integrityResult, fightSessionStats) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      const done = typeof roundsDone === 'number' ? roundsDone : 0;
      const total = typeof totalRounds === 'number' ? totalRounds : 1;
      addComboCoachSession(done, total);
      // 1.5 — Combo Coach carries strike + streak tallies; roll them into the
      // lifetime totals and hand the session numbers to the summary screen.
      // 1.4 — when the accelerometer counted real thrown strikes, that number
      // (motion-verified) is the one that counts; otherwise the called count.
      const cs = fightSessionStats || {};
      const strikeTotal = cs.motionUsed ? (cs.thrown || 0) : (cs.strikes || 0);
      recordFightSession({ rounds: done, strikes: strikeTotal, peakStreak: cs.peakStreak || 0 });
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
        fightStats: { strikes: cs.strikes || 0, peakStreak: cs.peakStreak || 0, thrown: cs.thrown || 0, motionUsed: !!cs.motionUsed },
      });
      routeAfterXp(beforeLevel, 'summary');
    },
    goFitWorkout:  (c) => { setPausedSession(null); savePausedSession(null); setResumeData(null); activeSessionStateRef.current = null; setFitCfg(c); setScreen('fit_workout'); },
    goFitComplete: (c, done, total) => {
      const beforeLevel = getLevel(loadStats().xp);
      setPausedSession(null); savePausedSession(null); setResumeData(null);
      addFitModeSession(done, total, c?.difficulty);
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
    completeOnboarding: ({ goal, experience, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      trackEvent('onboarding_complete', { goal, experience });
      // Design 33: land on the REAL Home and run the one-time interactive
      // feature tour (replaces the static 27a guide). Never auto-show again.
      setScreen('home');
      const tourDone = typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'true';
      if (!tourDone) setTourStep(0);
    },
    startFeatureTour: () => {
      // Settings → "Replay intro guide".
      setScreen('home');
      setTourStep(0);
      trackEvent('feature_tour_replay');
    },
    skipOnboardingToHome: ({ goal, experience, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      // The feature tour runs right after the questionnaire no matter how it
      // ended — skipping the wizard doesn't skip the tour.
      setScreen('home');
      const tourDone = typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'true';
      if (!tourDone) setTourStep(0);
    },
  };

  return (
    <>
      <style>{STYLE}</style>
      <style>{`@keyframes tm-offline-toast{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(8px)}}`}</style>
      {showOffline && (
        <div style={{ position: 'fixed', left: 12, bottom: 'calc(74px + env(safe-area-inset-bottom,0px))', zIndex: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 99, background: 'rgba(20,6,38,0.95)', border: '1px solid rgba(253,224,71,0.35)', boxShadow: '0 6px 18px -8px rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', pointerEvents: 'none', animation: 'tm-offline-toast 4s ease forwards' }}>
          <span style={{ fontSize: 11 }}>📡</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#fde047', letterSpacing: '0.08em' }}>OFFLINE</span>
        </div>
      )}
      <div style={{ minHeight: '100dvh', background: C.bg }}>
        <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: '0.2em' }}>LOADING…</div>}>
          <ScreenRouter
            screen={screen} disc={disc} cfg={cfg} session={session}
            comboCfg={comboCfg} fitCfg={fitCfg} qmCfg={qmCfg} qmResult={qmResult}
            ccMission={ccMission} ccResult={ccResult}
            cardioContext={cardioContext} cardioResult={cardioResult}
            arcadeSeries={arcadeSeries} arcadeStage={arcadeStage} arcadeMode={arcadeMode} arcadeOrder={arcadeOrder} arcadeSettings={arcadeSettings}
            campCtx={campCtx} campResult={campResult}
            profile={profile} updateProfile={updateProfile} levelUp={levelUp}
            pausedSession={pausedSession} onResume={resumeSession} onDiscardPaused={discardPausedSession}
            reportSessionState={reportSessionState} resumeData={resumeData}
            actions={actions}
          />
        </Suspense>
        {tourStep != null && (
          <FeatureTour step={tourStep} onNext={advanceTour} onSkip={skipTour} />
        )}
      </div>
    </>
  );
}
