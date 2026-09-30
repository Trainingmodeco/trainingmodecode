import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { STYLE, C, fixedColumnLeft } from './Styles';
import ScreenRouter from './ScreenRouter';
import { addFightFocusSession, addComboCoachSession, addFitModeSession, addQuickMissionSession, addCombatConditioningSession, addDailyMissionBonus, addHybridTrainingBonus, addCampSession, addBonusXp, loadStats, getLevel } from './data/userStats';
import { stakesFor } from './data/xpStakes';
import { pickXpBanner } from './data/xpBanners';
import { settleFightXp } from './data/fightSessionXp';
import { completeCampLevel, markCampComplete } from './data/campProgress';
import { campSessionState, markCampSessionDone } from './data/campSessions';
import { campSessionXp } from './protocol/content';
import { clearArcadeStage } from './data/arcadeCampaignProgress';
import { onStageClear, onSessionComplete } from './data/achievementTriggers';
import { completeStage as completeArcadeStage, recordBossAttempt, getBossRecord } from './data/arcadeProgress';
import { arcadeCfg, isFinalBoss } from './protocol/campaigns';
import { resolveFitPrescription, announcerLine, stageFinishers } from './data/arcadeSession';
import { packIdForCampaign } from './data/voicePacks';
import { recordFightSession } from './data/fightStats';
import { loadProfile, saveProfile } from './data/userProfile';
import { generateCombatConditioningMission } from './data/combatConditioningGenerator';
import { stopVoiceSession } from './voiceCoach';
import { trackEvent, setErrorScreen, trackSessionStart } from './data/analytics';
import { refreshEntitlement } from './data/entitlements';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import FeedbackChip from './shared/FeedbackChip';
// Already in the main bundle via HomeDashboard's Continue Challenge card, so
// this import adds nothing to the entry chunk.
import { TRAINING_ARCADE_SERIES, isSeriesPlayable, getSeriesById } from './data/trainingArcadeData';
import { preloadCriticalArt } from './shared/preloadImages';
import { challengeFromLocation, resolveChallenge, clearChallengeFromURL } from './data/challengeCodes';
import { migrateArcadeIds } from './data/arcadeIdMigration';
import ChallengeInboundModal from './shared/ChallengeInboundModal';
import ParQSheet from './shared/ParQSheet';
import { loadParq, saveParq } from './data/parq';
import { startCloudSync } from './data/cloudSync';
import { rememberSession, loadLastSession, programFor } from './data/lastSession';
import { startProgramDay, completeProgramDay } from './data/workoutPrograms';
import { completePlanDay } from './data/workoutLibrary';
import PracticeInvite from './PracticeInvite';
import HauntWelcome from './HauntWelcome';
import { shouldShowIntro, markIntroShown, shouldShowWeekly, markWeeklyShown } from './data/practiceInvite';
import GhostChallenge from './GhostChallenge';
import Comeback from './Comeback';
import { maybeOfferChallenge, declineChallenge, settleChallenge, getActiveChallenge, hauntFromLocation, takeHaunt, unseenHaunt, markChallengeSeen, prefetchStranger } from './data/ghostChallenges';
import { dueComeback, markComebackShown, remindComebackNextWeek } from './data/comeback';
import { getLastBattle } from './data/ghostBattles';

// 2.10 — v2 campaign stars: completion-quality is the gate (you only earn stars
// by fully + validly clearing), difficulty sets the count. FULL ARC gets +1 for
// doing both blocks. Recorded via completeArcadeStage so the ladder (which reads
// arcadeProgress) unlocks the next stage and lights up the ★.
const STAR_BY_DIFF = { easy: 1, normal: 2, hard: 3 };

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

// Every screen that can have a clock running on it. Being in this set is what
// makes a session survive the OS: it is stashed on the way out and comes back
// on the next launch. Leaving a player out of it is invisible until the day the
// phone rings mid-session and the athlete lands on the splash screen.
//
// Training Camp (single and full) and the post-workout Cardio Finisher were
// both outside it — they rebuild from campCtx / cardioContext, which the
// snapshot did not carry, so a camp round lost to a phone call was gone. Both
// now stash with the context they need to come back.
const ACTIVE_SESSION_SCREENS = new Set([
  'timer', 'combo_active', 'qm_active', 'fit_workout', 'cc_active', 'arcade_session', 'cardio_mode',
  'camp_session', 'camp_full', 'cardio_finisher',
]);
// cardio_mode is a setup screen most of the time and a session only while a
// run is live. The run player reports { live: true } through onSessionState;
// without it the screen is not stashed and the boot restore leaves it alone.
function isSessionScreenLive(screen, internalState) {
  if (screen === 'cardio_mode') return !!internalState?.live;
  return true;
}

// Whether a program / plan day counts as done, so its rotation moves on:
// finished outright, or at least three quarters of the exercises done (one
// skipped move is not a quit). Quitting halfway keeps the same day up next.
function dayCounts(done, total, completed) {
  if (completed) return true;
  return total > 0 && done >= Math.ceil(total * 0.75);
}

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
// Set while a haunt-link newcomer is doing their battle before setup; the
// welcome page takes over as soon as they leave the battle screens.
const HAUNT_NEWCOMER_KEY = 'tm_haunt_newcomer';
const HAUNT_BATTLE_SCREENS = new Set(['start', 'onboarding', 'setup', 'timer', 'summary', 'level_up']);
const TOUR_KEY = 'trainingModeTourComplete';

// Arcade ids were renamed off their source franchises (ARC_BAKI → ARC_GRAPPLER,
// `berserk-struggler` → `struggler-protocol`, and the stage ids inside them).
// Those ids are ALSO progress keys, so stored progress has to be rewritten
// before anything reads it — hence module scope, which runs before the first
// render rather than after it. Idempotent, so this is free on every later boot.
migrateArcadeIds();

const PAUSED_SESSION_KEY = 'trainingModePausedSession';
// A paused session older than this gets dropped instead of offered as
// "Continue." Ninety minutes is a middle-ground between the athlete's
// 1-2 hour ask and what other fitness apps do: Peloton auto-ends after
// 2 h idle, Fitbod at 3 h, Nike Run Club auto-pauses at 15 min but the
// session itself persists. Ninety minutes catches "left it up overnight"
// cleanly and still gives room for a legitimately long session — a 60
// min strength block plus a stretch and a shower is under it.
const PAUSED_SESSION_MAX_AGE_MS = 90 * 60 * 1000;
// How often a running session writes itself to storage. The OS can kill a
// backgrounded PWA without warning (memory pressure during a phone call is the
// common one), and no lifecycle event is guaranteed to fire first — so the
// session also saves on a timer. At 5s the worst case is losing five seconds.
const SESSION_AUTOSAVE_MS = 5000;

// Two paused sessions can wait at once — a Quick Mission AND a Build Workout
// — one per kind of session (its screen). Pausing a third of a new kind
// drops the older one; pausing the same kind again replaces it. Slot 0 is
// the most recent: it drives the Continue card, the floating pill and the
// boot restore; slot 1 shows as "also paused" on Home.
const PAUSED_SLOTS = 2;

function loadPausedSessions() {
  if (typeof localStorage === 'undefined') return [];
  try {
    // The single-session key from before the second slot migrates once.
    let raw = localStorage.getItem(PAUSED_SESSION_KEY);
    if (raw && raw.trim().startsWith('{')) raw = `[${raw}]`;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = (Array.isArray(parsed) ? parsed : [parsed])
      .filter(x => x && x.timestamp && Date.now() - x.timestamp <= PAUSED_SESSION_MAX_AGE_MS)
      .slice(0, PAUSED_SLOTS);
    if (!list.length) localStorage.removeItem(PAUSED_SESSION_KEY);
    return list;
  } catch {
    return [];
  }
}

function savePausedSessions(list) {
  if (typeof localStorage === 'undefined') return;
  if (list && list.length) {
    try { localStorage.setItem(PAUSED_SESSION_KEY, JSON.stringify(list.slice(0, PAUSED_SLOTS))); }
    catch { /* quota or serialization error */ }
  } else {
    localStorage.removeItem(PAUSED_SESSION_KEY);
  }
}

// A new snapshot goes to the front; an older one of the SAME kind is replaced.
function mergePaused(snap, list) {
  return [snap, ...list.filter(x => x.screen !== snap.screen)].slice(0, PAUSED_SLOTS);
}

// Storage-only write from the lifecycle saver: keeps the other slot intact.
function stashPausedSession(snap) {
  savePausedSessions(mergePaused(snap, loadPausedSessions()));
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
  const [cardioEntry,   setCardioEntry  ] = useState(null); // e.g. { ghost: 'best' } from the hub
  const [cardioResult,  setCardioResult ] = useState(null);
  const [arcadeSeries, setArcadeSeries] = useState(null);
  const [arcadeStage,  setArcadeStage ] = useState(null);
  const [arcadeMode,   setArcadeMode  ] = useState(null);
  const [arcadeOrder,  setArcadeOrder ] = useState(null);
  const [arcadeSettings, setArcadeSettings] = useState(null);
  const [profile,  setProfile ] = useState(() => loadProfile());
  const [pausedSlots, setPausedSlots] = useState(() => loadPausedSessions());
  const pausedSession = pausedSlots[0] || null;
  const pausedAlt = pausedSlots[1] || null;
  // Drop the paused session of one kind (the screen it ran on), keep the other.
  const dropPausedFor = useCallback((scr) => {
    setPausedSlots(list => {
      if (!list.some(x => x.screen === scr)) return list;
      const next = list.filter(x => x.screen !== scr);
      savePausedSessions(next);
      return next;
    });
  }, []);
  const [resumeData, setResumeData] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [showOffline, setShowOffline] = useState(false);
  // Which app-level guide is running: 'full_intro' (first-run + replay),
  // 'arcade_saga_select' (the ? on
  // the arcade), or null. Lives up here rather than inside a screen because
  // cross-screen guides navigate, and a guide rendered inside a screen dies
  // the moment that screen unmounts.
  const [pathTour, setPathTour] = useState(null);
  const pathTourLastRef = useRef(false); // reached the final step?
  // Beta ND-06 — the PAR-Q now runs once at the END of onboarding (both the
  // completed and the skipped questionnaire path), before the intro tour, so
  // every mode is covered for new users. Camp keeps its own gate and the
  // Arcade gains one as the safety net for pre-existing profiles.
  const [showParqGate, setShowParqGate] = useState(false);
  // Practice posters: 'intro' once after first-run setup, 'weekly' on open.
  const [practiceInvite, setPracticeInvite] = useState(null);
  // Ghost challenge screen: { view: 'challenge' | 'haunt', challenge?, ghost?, xpLine? }.
  const [ghostView, setGhostView] = useState(null);
  // The challenge Fight Focus setup was opened for (null = a plain setup).
  const [ghostLaunch, setGhostLaunch] = useState(null);
  // A due comeback cutscene, and a Combat Conditioning preset it asked for.
  const [comeback, setComeback] = useState(null);
  // A newcomer who arrived by a friend's haunt link (no setup yet): the
  // two-page welcome, then the battle or the app, then the 'welcome' page.
  // { page: 'intro' | 'battle' | 'welcome', challenge, beaten? }
  const [hauntIntro, setHauntIntro] = useState(null);
  const [ccPreset, setCcPreset] = useState(null);
  // A friend's haunt link (?h=): it becomes the live challenge straight away.
  // Someone already set up sees it now; a first-run user after onboarding,
  // at the next open (goAfterSplash).
  // A short code (?h=HX7K2Q) is looked up on the server first, so this is
  // async. Also keeps a stranger's ghost on hand for the next challenge.
  useEffect(() => {
    hauntFromLocation().then((g) => {
      if (!g) {
        // A newcomer who reloads before battling or setting up gets the
        // welcome pages back, as long as that friend's ghost is still waiting.
        try {
          const id = localStorage.getItem(HAUNT_NEWCOMER_KEY);
          const live = getActiveChallenge();
          if (id && live?.id === id && localStorage.getItem(ONBOARDING_KEY) !== 'true') setHauntIntro({ page: 'intro', challenge: live });
        } catch { /* best-effort */ }
        return;
      }
      const ch = takeHaunt(g);
      markChallengeSeen();
      if (typeof localStorage !== 'undefined' && localStorage.getItem(ONBOARDING_KEY) === 'true') {
        setGhostView({ view: 'challenge', challenge: ch });
      } else {
        // Never used the app: explain it, and the challenge, first.
        try { localStorage.setItem(HAUNT_NEWCOMER_KEY, ch.id); } catch { /* best-effort */ }
        setHauntIntro({ page: 'intro', challenge: ch });
      }
    });
    prefetchStranger(loadProfile()?.discipline || 'Boxing');
  }, []);
  const afterParqRef = useRef(null);
  useEffect(() => {
    if (hauntIntro || typeof localStorage === 'undefined') return;
    const id = localStorage.getItem(HAUNT_NEWCOMER_KEY);
    if (!id || localStorage.getItem(ONBOARDING_KEY) === 'true' || HAUNT_BATTLE_SCREENS.has(screen)) return;
    const live = getActiveChallenge();
    setHauntIntro({ page: 'welcome', challenge: live || null, beaten: !live || live.id !== id });
  }, [screen, hauntIntro]);
  const [pendingChallenge, setPendingChallenge] = useState(null); // inbound challenge (deep link)
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

  // Merged onto the STORED profile, not this component's copy: the
  // discipline tabs (and Practice) save straight to storage, and merging onto
  // a stale copy quietly put the old discipline back.
  const updateProfile = (nextProfile) => {
    const merged = { ...loadProfile(), ...nextProfile };
    saveProfile(merged);
    setProfile(merged);
  };

  // A pure snapshot of everything needed to rebuild the running session. No
  // side effects, so the lifecycle saver below can call it without stopping the
  // voice or clearing the live state ref — the session may well continue.
  // `reason` separates a deliberate exit ('nav', which leaves the resume banner
  // for later) from the OS taking the app away ('lifecycle', which comes back
  // into the player automatically on next launch).
  const buildSessionSnapshot = useCallback((reason) => {
    if (!ACTIVE_SESSION_SCREENS.has(screen)) return null;
    if (!isSessionScreenLive(screen, activeSessionStateRef.current)) return null;
    const internalState = activeSessionStateRef.current
      ? { ...activeSessionStateRef.current }
      : null;
    return {
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
      // camp_session / camp_full rebuild from campCtx, and cardio_finisher from
      // cardioContext. Without them in the snapshot those screens restore into
      // a router branch whose guard is false and fall through to the splash.
      campCtx,
      cardioContext,
      internalState,
      reason: reason || 'nav',
      timestamp: Date.now(),
    };
  }, [screen, disc, cfg, comboCfg, fitCfg, qmCfg, ccMission, arcadeSeries, arcadeStage, arcadeMode, arcadeOrder, arcadeSettings, campCtx, cardioContext]);

  const pauseCurrentSession = useCallback(() => {
    const paused = buildSessionSnapshot('nav');
    if (!paused) return null;
    stopVoiceSession();
    setPausedSlots(list => { const next = mergePaused(paused, list); savePausedSessions(next); return next; });
    activeSessionStateRef.current = null;
    return paused;
  }, [buildSessionSnapshot]);

  // Resume one slot. It is promoted to the front first, so isResuming (which
  // reads slot 0) and the clear-on-arrival effect both see it.
  const resumeSlot = useCallback((ps) => {
    if (!ps) return;
    setPausedSlots(list => { const next = [ps, ...list.filter(x => x !== ps)]; savePausedSessions(next); return next; });
    setDisc(ps.disc);
    setCfg(ps.cfg);
    setComboCfg(ps.comboCfg);
    setFitCfg(ps.fitCfg);
    setQmCfg(ps.qmCfg);
    setCcMission(ps.ccMission);
    setArcadeSeries(ps.arcadeSeries);
    setArcadeStage(ps.arcadeStage);
    setArcadeMode(ps.arcadeMode);
    setArcadeOrder(ps.arcadeOrder);
    setArcadeSettings(ps.arcadeSettings || null);
    if (ps.campCtx) setCampCtx(ps.campCtx);
    if (ps.cardioContext) setCardioContext(ps.cardioContext);
    setResumeData(ps.internalState || null);
    setScreen(ps.screen);
  }, []);
  const resumeSession = useCallback(() => resumeSlot(pausedSession), [resumeSlot, pausedSession]);
  const resumeAltSession = useCallback(() => resumeSlot(pausedAlt), [resumeSlot, pausedAlt]);

  // ── Surviving the OS ──────────────────────────────────────────────────────
  // The ONLY writer of the paused session used to be pauseCurrentSession(),
  // which fires from in-app navigation (goHome, goProfile…). Nothing wrote on
  // the way OUT of the app, so a phone call that got the PWA evicted lost the
  // whole session: on return the page reloaded, found an empty key, and booted
  // to the splash screen. useAutoPauseOnHidden paused the timer in memory, but
  // memory is exactly what the OS reclaims.
  //
  // So a running session now saves itself when the app is hidden, when the page
  // is being torn down, and on a timer in between (no lifecycle event is
  // guaranteed to fire before a kill). It writes storage ONLY — never
  // the paused-session state — because the state setter drives the resume banner, and
  // a session that is merely backgrounded has not been left.
  const snapshotRef = useRef(buildSessionSnapshot);
  useEffect(() => { snapshotRef.current = buildSessionSnapshot; }, [buildSessionSnapshot]);

  useEffect(() => {
    if (!ACTIVE_SESSION_SCREENS.has(screen)) return undefined;
    if (typeof document === 'undefined') return undefined;
    const stash = () => {
      const snap = snapshotRef.current?.('lifecycle');
      if (snap) stashPausedSession(snap);
    };
    const onVisibility = () => { if (document.hidden) stash(); };
    stash(); // close the gap between entering a session and the first tick
    const timer = setInterval(stash, SESSION_AUTOSAVE_MS);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stash);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stash);
    };
  }, [screen]);

  const discardPausedSession = useCallback(() => {
    setPausedSlots(list => { const next = list.slice(1); savePausedSessions(next); return next; });
    setResumeData(null);
  }, []);
  const discardAltSession = useCallback(() => {
    setPausedSlots(list => { const next = list.slice(0, 1); savePausedSessions(next); return next; });
  }, []);

  // Prune stale paused sessions on visibility → 'visible' and once a minute
  // while the app is open. loadPausedSessions already applies the age
  // filter on cold boot; this is the live-app equivalent so an athlete who
  // left the app open on Home doesn't keep seeing a stale Continue card
  // for a session they last touched 90 minutes ago.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prune = () => {
      setPausedSlots(list => {
        const fresh = list.filter(x => x && x.timestamp && Date.now() - x.timestamp <= PAUSED_SESSION_MAX_AGE_MS);
        if (fresh.length === list.length) return list;   // nothing to do, keep same ref
        savePausedSessions(fresh);
        return fresh;
      });
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') prune(); };
    const timer = setInterval(prune, 60_000);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Boot: a session the OS interrupted comes straight back INTO its player,
  // paused, rather than dumping the athlete on the splash screen. Only for
  // 'lifecycle' stashes — a session the athlete deliberately navigated away
  // from keeps the existing resume-banner behaviour, because leaving was their
  // choice. resumeSession() feeds isResuming, which starts the player paused
  // and skips the warm-up, so they land exactly where they were with the clock
  // held and tap RESUME to carry on.
  const bootRestoredRef = useRef(false);
  useEffect(() => {
    if (bootRestoredRef.current) return;
    bootRestoredRef.current = true;
    const stashed = pausedSession;
    if (!stashed || stashed.reason !== 'lifecycle') return;
    if (!ACTIVE_SESSION_SCREENS.has(stashed.screen)) return;
    resumeSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving on a session screen — by RESUME or by starting fresh — retires
  // the paused session of that kind; the other slot waits on.
  useEffect(() => { dropPausedFor(screen); }, [screen, dropPausedFor]);
  // Crash reports say which screen the athlete was on.
  useEffect(() => { setErrorScreen(screen); }, [screen]);

  // Cloud progress sync. No-ops entirely while signed out; once an account
  // exists it mirrors local progress up and restores it on a fresh device.
  useEffect(() => startCloudSync(), []);

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

  // Challenge deep link (?ch=<code>): a friend's scan-to-start link. Resolve it
  // to a real series+stage and offer to jump in; strip the param so a reload
  // doesn't re-fire. Invalid/unknown codes are ignored silently.
  useEffect(() => {
    const decoded = challengeFromLocation();
    if (!decoded) return;
    // Consume each code once per session so a persisted ?ch= (or a reload) can't
    // re-fire the prompt, even if the URL isn't cleared by the environment.
    const key = `${decoded.seriesId}|${decoded.stageId}|${decoded.mode}|${decoded.difficulty}`;
    try { if (sessionStorage.getItem('tm_challenge_seen') === key) { clearChallengeFromURL(); return; } } catch { /* noop */ }
    const resolved = resolveChallenge(decoded);
    try { sessionStorage.setItem('tm_challenge_seen', key); } catch { /* noop */ }
    clearChallengeFromURL();
    if (resolved) { setPendingChallenge(resolved); trackEvent('challenge_opened', { series: resolved.series.id, mode: resolved.mode }); }
  }, []);

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

  // ── First-run intro + cross-screen guides (spotlight coach marks) ──
  // One ScreenGuide host at app level, keyed by which guide is running.
  // 'full_intro' replaces the old FeatureTour: it fires after the
  // questionnaire and from Profile → Replay intro guide, and nowhere else.
  const markTourDone = () => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOUR_KEY, 'true');
  };
  const startFullIntro = () => { setScreen('home'); setPathTour('full_intro'); };
  // Practice Mode's welcome poster, for new learners, once — the last step
  // of first-run setup (after the walkthrough, so the two never overlap).
  const maybePracticeIntro = () => {
    if (!shouldShowIntro(loadProfile())) return;
    markIntroShown();
    setPracticeInvite('intro');
  };
  const closePathTour = (finished) => {
    const key = pathTour;
    setPathTour(null);
    if (key === 'full_intro') {
      markTourDone();
      trackEvent(finished ? 'feature_tour_complete' : 'feature_tour_skipped');
      setScreen('home');
      maybePracticeIntro();
    } else if (key === 'arcade_saga_select') {
      // Per spec: however the arcade guide ends, land back on the saga page.
      setScreen('arcade');
    }
  };

  const actions = {
    goStart:       () => setScreen('start'),
    goHome:        () => { pauseCurrentSession(); setScreen('home'); },
    goProgress:    () => { pauseCurrentSession(); setScreen('progress'); },
    startArcadeGuide: () => setPathTour('arcade_saga_select'),
    goFightHub:    () => setScreen('fight_hub'),
    // 3c — backing out of a live builder/quick-mission session PAUSES it (the
    // app's normal resume flow picks it up) instead of silently abandoning it.
    goFitHub:      () => { pauseCurrentSession(); setScreen('fit_hub'); },
    goFitSetup:    () => { pauseCurrentSession(); setScreen('fit_setup'); },
    goPrograms:    () => { pauseCurrentSession(); setScreen('programs'); },
    // Cardio Mode is a SETUP screen that becomes a session, so unlike every
    // other session entry it was not clearing resumeData. Now that an interval
    // session restores from it, a stale one would drop somebody who tapped
    // CARDIO MODE straight back into a Tabata they finished yesterday.
    goCardioMode:  (opts) => { setResumeData(null); activeSessionStateRef.current = null; setCardioEntry(opts && typeof opts === 'object' ? opts : null); setScreen('cardio_mode'); },
    // Cardio records itself for Home's Continue card when a session starts.
    rememberCardio: (setup) => { rememberSession('cardio', { setup }); trackSessionStart('cardio', { kind: setup?.categoryId || null }); },
    goQuickMissionSetup: () => setScreen('qm_setup'),
    goQuickMissionActive: (c) => { rememberSession('quick_mission', c); trackSessionStart('quickMission', c?.mission?.planId ? { plan: c.mission.planId } : undefined); dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null; setQmCfg(c); setScreen('qm_active'); },
    goQuickMissionComplete: (result) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen);
      setResumeData(null);
      addQuickMissionSession(result.exercisesCompleted, result.totalExercises, result.completed);
      // A plan day only moves the rotation on once it is (mostly) done — quit
      // halfway and the same day is still up next.
      if (dayCounts(result.exercisesCompleted, result.totalExercises, result.completed)) completePlanDay(qmCfg?.mission);
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
    goCombatCondSetup: () => { setCcPreset(null); setScreen('cc_setup'); },
    // A pasted/scanned challenge code resolved to a real series+stage — surface
    // the same accept-and-start modal the deep link uses.
    startChallenge: (resolved) => setPendingChallenge(resolved),
    // 2.10 — arcade keeps its original carousel + ladder UI; the 5 campaigns are
    // adapted into it as extra series (data/arcadeCampaignSeries). START on a
    // campaign stage routes to the camp engine from goArcadeSession (below).
    goTrainingArcade: () => setScreen('arcade'),
    // 2.10 — playable series (the two originals + the v2 campaigns) go straight
    // to the stage ladder; unfinished placeholders still show the intro page.
    goArcadeSeries: (series) => { setArcadeSeries(series); setArcadeSettings(null); setScreen((series?.v2Campaign || ['one-punch-protocol', 'demon-back-protocol'].includes(series?.id)) ? 'arcade_series' : 'arcade_intro'); },
    goArcadeDetail: (series, settings) => { setArcadeSeries(series); setArcadeSettings(settings || null); setScreen('arcade_series'); },
    goArcadeSession: (series, stage, mode, order, settings) => {
      dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null;
      if (series?.id) trackSessionStart('arcade', { series: series.id, stage: stage?.stageNumber || null });
      if (series?.id) rememberSession('arcade', { seriesId: series.id, title: series.title || null, stageNumber: stage?.stageNumber || null, mode: mode || null, settings: settings || null });
      // 2.10 — a v2 campaign stage runs on the camp round-timer engine (not the
      // old player). PATH → fit/fight/full arc; difficulty → easy/normal/hard.
      if (series?.v2Campaign) {
        const campaignId = series.v2Campaign;
        const path = mode === 'both' ? 'full_arc' : (mode === 'fit' ? 'fit' : 'fight');
        const diff = ['easy', 'normal', 'hard'].includes(settings?.difficulty) ? settings.difficulty : 'normal';
        const stageNumber = stage?.stageNumber || 1;
        const arcade = { campaignId, seriesId: series.id, stageId: stage.id, stageNumber, campaignName: series.title };
        // Spec 22 — each campaign speaks with its assigned voice pack.
        const voicePack = packIdForCampaign(campaignId);
        // Spec 27 — layer the Arcade session standard onto the cfg: a FIT stage
        // gets its counted prescription (+ weighted review + announcer); a FIGHT
        // stage gets per-round combos/cues (combo_spec → Combo Coach); both get
        // difficulty-scaled finishers.
        const withFit = (base) => {
          // Boss finale: the scripted 12-round burnout IS the session — no
          // prescription layer, no bolted-on finisher.
          if (base.bossFinale) return base;
          const plan = resolveFitPrescription(campaignId, stage.id, diff);
          if (plan?.exercises?.length) {
            base.prescription = plan.exercises;
            base.weighted = plan.weighted;
            base.announcer = announcerLine(campaignId, stage.id, diff, plan.exercises);
          }
          base.finishers = stageFinishers(campaignId, stage.id, 'fit', diff);
          return base;
        };
        // FIGHT round content (combos + cues) is surfaced by campaigns.ts
        // (arcadeBlockRounds) and voiced on a cadence by FightFocusTimer, so the
        // fight cfg uses arcadeCfg directly for rounds — but we still attach the
        // difficulty-scaled finishers so FightFocusTimer can run them at the end
        // (blockRounds is NOT touched — that stays arcadeBlockRounds' combos).
        const withFightFinishers = (base) => {
          // Boss finale: round 9 IS the finisher (5 minutes of hell) — skip the layer.
          if (!base.bossFinale) base.finishers = stageFinishers(campaignId, stage.id, 'fight', diff);
          return base;
        };
        // 49c — a veteran who has already put this boss down can tap the slam
        // away; a first-timer watches it.
        const markBossSeen = (base) => {
          if (base?.bossFinale) base.bossCleared = getBossRecord(series.id, stage.id).wins > 0;
          return base;
        };
        if (path === 'full_arc') {
          const cfgSkill = markBossSeen(withFightFinishers({ ...arcadeCfg(campaignId, stage.id, 'fight', diff), voicePack }));
          const cfgFit = markBossSeen(withFit({ ...arcadeCfg(campaignId, stage.id, 'fit', diff), voicePack }));
          setCampCtx({ discipline: 'Boxing', level: stageNumber, difficulty: diff, format: 'full', cfgSkill, cfgFit, arcade });
          setCfg(cfgSkill); setScreen('camp_full');
        } else {
          const cfg = markBossSeen(path === 'fit'
            ? withFit({ ...arcadeCfg(campaignId, stage.id, 'fit', diff), voicePack })
            : withFightFinishers({ ...arcadeCfg(campaignId, stage.id, 'fight', diff), voicePack }));
          setCampCtx({ discipline: 'Boxing', level: stageNumber, difficulty: diff, cfg, split: path === 'fit', slot: path === 'fit' ? 's2' : 's1', arcade });
          setCfg(cfg); setScreen('camp_session');
        }
        return;
      }
      setArcadeSeries(series); setArcadeStage(stage); setArcadeMode(mode); setArcadeOrder(order);
      setArcadeSettings(settings || arcadeSettings || null);
      setScreen('arcade_session');
    },
    goArcadeComplete: () => { dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null; setScreen('arcade_series'); },
    goCombatCondActive: (config) => {
      rememberSession('cc', config);
      trackSessionStart('combatConditioning');
      dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null;
      const mission = generateCombatConditioningMission(config);
      if (config?.cardioAddon?.enabled) mission.cardioAddon = config.cardioAddon;
      setCcMission(mission);
      setScreen('cc_active');
    },
    goCombatCondComplete: (result) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen); setResumeData(null);
      addCombatConditioningSession(result.drillsCompleted, result.totalDrills, result.roundsCompleted, result.totalRounds, result.completed);
      if (result.cleanRoundXp && result.integrityResult?.awardXp !== false) addBonusXp(result.cleanRoundXp);
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
    goSetup:       (d) => { setDisc(d); setGhostLaunch(null); setScreen('setup'); },
    // Home's 👻: the live challenge's screen again.
    openGhostChallenge: () => { const ch = getActiveChallenge(); if (ch) setGhostView({ view: 'challenge', challenge: ch }); },
    // Haunt a Friend, from a session summary.
    openHaunt: (ghost, xpLine) => setGhostView({ view: 'haunt', ghost, xpLine }),
    goComboSetup:  (d) => { setDisc(d); setScreen('combo_setup'); },
    goJustTrain:   (d) => { if (d) setDisc(d); setScreen('just_train'); },
    // Home's Continue card: run the last started session again with the
    // settings it ran with. A program starts its next day instead.
    // opts.adjust (ADJUST): open the setup without starting — only Cardio
    // would otherwise start by itself.
    replayLastSession: (opts) => {
      const last = loadLastSession();
      if (!last) return false;
      const c = last.cfg;
      switch (last.kind) {
        case 'timer':
          if (last.disc) setDisc(last.disc);
          actions.goTimer(c);
          // goTimer records with the discipline it closed over; the replay's
          // own discipline is the right one.
          rememberSession('timer', c, last.disc);
          return true;
        case 'combo':
          if (last.disc) setDisc(last.disc);
          actions.goComboActive(c);
          return true;
        case 'quick_mission':
          actions.goQuickMissionActive(c);
          return true;
        case 'fit': {
          const p = programFor(last);
          actions.goFitWorkout(p ? startProgramDay(p, { equipment: c.equipment, difficulty: c.difficulty }) : c);
          return true;
        }
        case 'cc':
          actions.goCombatCondActive(c);
          return true;
        // Camp and Arcade continue on their own path: the map / stage ladder
        // opens on the next session rather than repeating the last one.
        case 'camp':
          actions.goTrainingCamp(last.disc || c.discipline);
          return true;
        case 'arcade': {
          const series = getSeriesById(c.seriesId);
          if (!series) return false;
          actions.goArcadeDetail(series, c.settings || null);
          return true;
        }
        case 'cardio':
          actions.goCardioMode({ setup: c.setup, autoStart: !opts?.adjust });
          return true;
        default:
          return false;
      }
    },
    goTrainingCamp: (d) => { if (d) setDisc(d); setScreen('training_camp'); },
    // 2.4 — launch a camp level's session (ctx = {discipline, level, difficulty, cfg}).
    goCampSession: (ctx) => {
      trackSessionStart('trainingCamp', { level: ctx?.level, format: ctx?.format || 'single' });
      dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null;
      setCampCtx(ctx); setDisc(ctx.discipline);
      rememberSession('camp', { level: ctx.level, difficulty: ctx.difficulty, format: ctx.format || 'single', archetypeName: ctx.archetypeName || null }, ctx.discipline);
      // FULL CAMP runs both blocks in one sitting; cfg holds the skill block so
      // the warm-up wrapper still reads warmupMin.
      setCfg(ctx.format === 'full' ? ctx.cfgSkill : ctx.cfg);
      setScreen(ctx.format === 'full' ? 'camp_full' : 'camp_session');
    },
    // 2.4 — camp session finished (same onEnd shape as FightFocusTimer). Award
    // XP, then advance: single levels clear on a valid full completion; split
    // levels (L4–11) mark S1/S2 done independently and clear only at ✓✓.
    goCampComplete: (rounds, c, completed, integrityResult, fightSessionStats) => {
      const beforeLevel = getLevel(loadStats().xp);
      // Stage stakes: a cleared stage pops the crown with the XP it earned; a
      // stage the athlete stopped short of costs the tier's loss (the reaper).
      // Rush and clean-round verdicts from the block ride along. Nothing moves
      // on a session the integrity gate refused.
      const vs = fightSessionStats || {};
      const verdictXp = (vs.rush?.xp || 0) + (vs.cleanRoundXp || 0);
      const stagePlate = (cleared, awarded, done, total, diff, earned) => {
        if (!awarded) return { xp: earned, plate: null };
        let xp = earned + (verdictXp ? addBonusXp(verdictXp) : 0);
        if (cleared) return { xp, plate: { pass: true, xp, banner: pickXpBanner('gain', { mode: 'fight', tier: diff }) } };
        if (done < total) {
          const loss = addBonusXp(-stakesFor(diff).loss);
          xp += loss;
          return { xp, plate: { pass: false, xp: -loss, banner: pickXpBanner('loss', { mode: 'fight', tier: diff, camp: true }) } };
        }
        return { xp, plate: null };
      };
      dropPausedFor(screen); setResumeData(null);
      const total = c.rounds || (Array.isArray(rounds) ? rounds.length : 1);
      const done = typeof completed === 'number' ? completed : (Array.isArray(rounds) ? rounds.length : 0);
      // 2.10 — arcade v2 stage completion reuses this pipeline but updates arcade
      // progress instead of camp progress. Same 1.6 anti-cheat gate + 2.8 XP.
      if (campCtx?.arcade) {
        const a = campCtx.arcade;
        const irA = integrityResult;
        const awardedA = !irA || irA.awardXp !== false;
        const validA = done >= total && awardedA && (!irA || irA.isFullyValid);
        const diffA = c?.difficulty || campCtx?.difficulty || 'normal';
        // Boss finale — double XP (47c "×2 XP MULT").
        const bossMultA = isFinalBoss(a.campaignId, a.stageId) ? 2 : 1;
        const xpA = awardedA ? addCampSession(a.stageNumber, done, total, campSessionXp({ difficulty: diffA, roundMin: c?.roundMin ?? 2, doneRounds: done, totalRounds: total, valid: true }) * bossMultA) : 0;
        const nextStage = validA ? clearArcadeStage(a.campaignId, a.stageNumber) : null;
        // Item 10b — achievements ride the clear that just happened. award() is
        // idempotent, so replaying a stage never re-fires the unlock toast.
        const unlockedA = validA
          ? onStageClear({ campaignId: a.campaignId, stageNumber: a.stageNumber, path: a.path || campCtx?.path, outcome: 'pass' })
          : [];
        // Record the clear + ★ in arcadeProgress (the store the ladder reads) so
        // the stage unlocks the next node and earns stars. Stars = difficulty.
        const starsA = STAR_BY_DIFF[diffA] || 2;
        if (validA && a.seriesId) completeArcadeStage(a.seriesId, a.stageId, 0, null, null, null, { stars: starsA });
        // Boss runs record win OR loss — the Answer-the-Bell gate reads this
        // for its record pill, so a failed attempt has to leave a mark too.
        if (a.seriesId && bossMultA > 1) recordBossAttempt(a.seriesId, a.stageId, { cleared: validA, roundsDone: done, roundsTotal: total });
        trackEvent('session_complete', { mode: 'arcade', campaign: a.campaignId, stage: a.stageNumber });
        const stakedA = stagePlate(validA, awardedA, done, total, diffA, xpA);
        setCampResult({ arcade: true, campaignId: a.campaignId, campaignName: a.campaignName, stageNumber: a.stageNumber, level: a.stageNumber, difficulty: diffA, discipline: 'Arcade', rounds: done, total, xpEarned: stakedA.xp, plate: stakedA.plate, integrityResult: irA, cleared: validA, stars: validA ? starsA : 0, unlockedTo: nextStage && nextStage > a.stageNumber ? nextStage : null, split: false, slot: 's1', sessionValid: validA, achievements: unlockedA });
        routeAfterXp(beforeLevel, 'camp_complete');
        return;
      }
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
      // Item 13b — clearing L12 wins the title fight and finishes the camp.
      const titleWon = cleared && level === 12 && markCampComplete();
      trackEvent('session_complete', { mode: 'trainingCamp', level, slot: split ? slot : undefined, rounds: done });
      const staked = stagePlate(cleared || sessionValid, awarded, done, total, diff, xpEarned);
      setCampResult({ level, difficulty: campCtx?.difficulty, discipline: campCtx?.discipline, rounds: done, total, xpEarned: staked.xp, plate: staked.plate, integrityResult, cleared, unlockedTo, split, slot, sessionValid, titleWon });
      routeAfterXp(beforeLevel, 'camp_complete');
    },
    goCampMap: () => setScreen('training_camp'),
    // 2.4 — FULL CAMP finished (both blocks). Each valid block earns XP and
    // marks its slot; the level clears when both are ✓✓.
    goCampFullComplete: ({ skill, fit }) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen); setResumeData(null);
      const s = skill || { total: 1, done: 0, valid: false };
      const f = fit || { total: 1, done: 0, valid: false };
      // 2.10 — FULL ARC arcade stage: both blocks over the shared runner.
      if (campCtx?.arcade) {
        const a = campCtx.arcade;
        const diffA = campCtx?.difficulty || 'normal';
        const bothValidA = s.valid && f.valid;
        // Boss finale — double XP (47c "×2 XP MULT").
        const bossMultA = isFinalBoss(a.campaignId, a.stageId) ? 2 : 1;
        let xpA = 0;
        xpA += addCampSession(a.stageNumber, s.done, s.total, campSessionXp({ difficulty: diffA, roundMin: campCtx?.cfgSkill?.roundMin ?? 2, doneRounds: s.done, totalRounds: s.total, valid: s.valid, fullArc: bothValidA }) * bossMultA);
        xpA += addCampSession(a.stageNumber, f.done, f.total, campSessionXp({ difficulty: diffA, roundMin: campCtx?.cfgFit?.roundMin ?? 2, doneRounds: f.done, totalRounds: f.total, valid: f.valid, fullArc: bothValidA }) * bossMultA);
        const nextStage = bothValidA ? clearArcadeStage(a.campaignId, a.stageNumber) : null;
        const unlockedA = bothValidA
          ? onStageClear({ campaignId: a.campaignId, stageNumber: a.stageNumber, path: 'full_arc', outcome: 'pass' })
          : [];
        // FULL ARC does both blocks → completion-quality bonus of +1 star (cap 3).
        const starsA = Math.min(3, (STAR_BY_DIFF[diffA] || 2) + 1);
        if (bothValidA && a.seriesId) completeArcadeStage(a.seriesId, a.stageId, 0, null, null, null, { stars: starsA });
        if (a.seriesId && bossMultA > 1) recordBossAttempt(a.seriesId, a.stageId, { cleared: bothValidA, roundsDone: s.done + f.done, roundsTotal: s.total + f.total });
        trackEvent('session_complete', { mode: 'arcade', campaign: a.campaignId, stage: a.stageNumber, format: 'full' });
        setCampResult({ arcade: true, campaignId: a.campaignId, campaignName: a.campaignName, stageNumber: a.stageNumber, level: a.stageNumber, difficulty: diffA, discipline: 'Arcade', rounds: s.done + f.done, total: s.total + f.total, xpEarned: xpA, integrityResult: null, cleared: bothValidA, stars: bothValidA ? starsA : 0, unlockedTo: nextStage && nextStage > a.stageNumber ? nextStage : null, split: false, sessionValid: bothValidA, achievements: unlockedA });
        routeAfterXp(beforeLevel, 'camp_complete');
        return;
      }
      const level = campCtx?.level;
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
      const titleWon = cleared && level === 12 && markCampComplete();
      trackEvent('session_complete', { mode: 'trainingCamp', level, format: 'full' });
      const unlockedC = onSessionComplete({ outcome: cleared ? 'pass' : 'partial', path: 'full_arc' });
      setCampResult({ level, difficulty: campCtx?.difficulty, discipline: campCtx?.discipline, rounds: s.done + f.done, total: s.total + f.total, xpEarned, integrityResult: null, cleared, unlockedTo, split: false, sessionValid: s.valid || f.valid, achievements: unlockedC, titleWon });
      routeAfterXp(beforeLevel, 'camp_complete');
    },
    goTimer:       (c) => { rememberSession('timer', c, disc); trackSessionStart(c?.mode === 'Just Train' ? 'justTrain' : 'fightFocus'); dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null; setCfg(c); setScreen('timer'); },
    goSummary:     (rounds, c, completed, integrityResult, fightSessionStats) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen); setResumeData(null);
      const total = c.rounds || rounds.length;
      const done = typeof completed === 'number' ? completed : rounds.length;
      // Bank what the summary will show — the outcome engine's number, not
      // the flat per-round rate (an early END used to save four times more
      // than the screen said).
      const justTrain = c.mode === 'Just Train';
      // Live verdicts (rushes held or dropped, clean rounds) ride the settled
      // number — the same helper the summary reads, so the two agree.
      const fs = fightSessionStats || {};
      const bonusXp = (fs.rush?.xp || 0) + (fs.cleanRoundXp || 0);
      const { xp } = settleFightXp({ completed: done, total, difficulty: c.difficulty, integrityResult, mode: justTrain ? 'justTrain' : 'fight', bonusXp });
      addFightFocusSession(done, total, { justTrain, xp });
      // 1.4/1.5 — Fight Focus has no called combos, so any strike count comes
      // from the accelerometer (motion-verified thrown strikes) or is zero.
      recordFightSession({ rounds: done, strikes: fs.motionUsed ? (fs.thrown || 0) : 0 });
      tryCompleteDailyMission('fightFocus');
      trackEvent('session_complete', { mode: justTrain ? 'justTrain' : 'fightFocus', rounds: done });
      // A win over the live ghost challenge settles it (the battle itself was
      // resolved by the timer at the final bell).
      const battle = c.ghost ? getLastBattle() : null;
      const challengeWin = battle?.ghost?.ghostId && battle.ghost.ghostId === c.ghost.ghostId
        ? settleChallenge('fight', c.ghost, battle.result?.outcome) : null;
      setSession({ rounds, cfg: c, completedRounds: completed, sessionSource: 'fightFocus', integrityResult, fightStats: { thrown: fs.thrown || 0, motionUsed: !!fs.motionUsed, rush: fs.rush || null, cleanRounds: fs.cleanRounds || 0, cleanRoundXp: fs.cleanRoundXp || 0 }, challengeWin });
      routeAfterXp(beforeLevel, 'summary');
    },
    goComboActive: (c) => { rememberSession('combo', c, c?.discipline || disc); trackSessionStart('comboCoach'); dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null; setComboCfg(c); setScreen('combo_active'); },
    goComboEnd:    (roundsDone, totalRounds, integrityResult, fightSessionStats) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen); setResumeData(null);
      const done = typeof roundsDone === 'number' ? roundsDone : 0;
      const total = typeof totalRounds === 'number' ? totalRounds : 1;
      const cs = fightSessionStats || {};
      const bonusXp = (cs.rush?.xp || 0) + (cs.cleanRoundXp || 0);
      const { xp } = settleFightXp({ completed: done, total, difficulty: comboCfg?.difficulty || 'Normal', integrityResult, mode: 'combo', bonusXp });
      addComboCoachSession(done, total, { xp });
      // 1.5 — Combo Coach carries strike + streak tallies; roll them into the
      // lifetime totals and hand the session numbers to the summary screen.
      // 1.4 — when the accelerometer counted real thrown strikes, that number
      // (motion-verified) is the one that counts; otherwise the called count.
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
        fightStats: { strikes: cs.strikes || 0, peakStreak: cs.peakStreak || 0, thrown: cs.thrown || 0, motionUsed: !!cs.motionUsed, rush: cs.rush || null, cleanRounds: cs.cleanRounds || 0, cleanRoundXp: cs.cleanRoundXp || 0 },
      });
      routeAfterXp(beforeLevel, 'summary');
    },
    goFitWorkout:  (c) => { rememberSession('fit', c); dropPausedFor(screen); setResumeData(null); activeSessionStateRef.current = null; setFitCfg(c); setScreen('fit_workout'); },
    goFitComplete: (c, done, total) => {
      const beforeLevel = getLevel(loadStats().xp);
      dropPausedFor(screen); setResumeData(null);
      addFitModeSession(done, total, c?.difficulty);
      if (dayCounts(done, total)) completeProgramDay(c?.programId ? c : fitCfg);
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
    goPractice:    (d) => { if (d) setDisc(d); setScreen('practice'); },
    // Practice, opened on the current lesson of the shared discipline.
    goStartHere:   (d) => { if (d) setDisc(d); setScreen('practice_starthere'); },
    // The same, switching the shared discipline first (the Practice posters).
    goPracticeLesson: (d) => {
      if (d) { try { saveProfile({ ...loadProfile(), discipline: d }); } catch { /* best-effort */ } setDisc(d); }
      setScreen('practice_starthere');
    },
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
      if (!done) return;
      // One full-screen interstitial per open, most personal first: a
      // friend's haunt, a ghost challenge, a comeback, the weekly lesson.
      const haunt = unseenHaunt();
      if (haunt) { markChallengeSeen(); setGhostView({ view: 'challenge', challenge: haunt }); return; }
      const offer = maybeOfferChallenge(loadProfile()?.discipline || 'Boxing');
      if (offer) { setGhostView({ view: 'challenge', challenge: offer }); return; }
      const cb = dueComeback();
      if (cb) { markComebackShown(cb.view); setComeback(cb); return; }
      // The weekly practice reminder, at most once a week, on opening the app.
      if (shouldShowWeekly(loadProfile())) { markWeeklyShown(); setPracticeInvite('weekly'); }
    },
    completeOnboarding: ({ goal, experience, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      trackEvent('onboarding_complete', { goal, experience });
      // Land on the REAL Home and run the one-time full walkthrough.
      // Never auto-show again.
      const finish = () => {
        const tourDone = typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'true';
        if (!tourDone) startFullIntro(); else { setScreen('home'); maybePracticeIntro(); }
      };
      // ND-06 — PAR-Q closes out onboarding (once ever), then the tour runs.
      if (!loadParq().done) { setScreen('home'); afterParqRef.current = finish; setShowParqGate(true); }
      else finish();
    },
    startFeatureTour: () => {
      // Settings → "Replay intro guide".
      trackEvent('feature_tour_replay');
      startFullIntro();
    },
    skipOnboardingToHome: ({ goal, experience, profile: onboardingProfile }) => {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ONBOARDING_KEY, 'true');
      updateProfile(onboardingProfile || { goal, experience });
      // The full walkthrough runs right after the questionnaire no matter how
      // it ended — skipping the wizard doesn't skip the intro (or the PAR-Q).
      const finish = () => {
        const tourDone = typeof localStorage !== 'undefined' && localStorage.getItem(TOUR_KEY) === 'true';
        if (!tourDone) startFullIntro(); else { setScreen('home'); maybePracticeIntro(); }
      };
      if (!loadParq().done) { setScreen('home'); afterParqRef.current = finish; setShowParqGate(true); }
      else finish();
    },
  };

  return (
    <>
      <style>{STYLE}</style>
      <style>{`@keyframes tm-offline-toast{0%{opacity:0;transform:translateY(8px)}12%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(8px)}}`}</style>
      {/* ND-06 — one-time PAR-Q at the end of onboarding, above everything
          (the tour starts only after it closes, so no z-order contest). */}
      {showParqGate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1300 }}>
          <ParQSheet ctaLabel="▶ CONTINUE ON EASY" onDone={(anyYes) => {
            saveParq(anyYes);
            setShowParqGate(false);
            const f = afterParqRef.current; afterParqRef.current = null;
            if (f) f();
          }}/>
        </div>
      )}
      {hauntIntro && (
        <HauntWelcome
          page={hauntIntro.page}
          challenge={hauntIntro.challenge}
          beaten={hauntIntro.beaten}
          onNext={() => setHauntIntro(h => ({ ...h, page: 'battle' }))}
          onBack={() => setHauntIntro(h => ({ ...h, page: 'intro' }))}
          onAccept={() => {
            const ch = hauntIntro.challenge;
            setHauntIntro(null);
            const launch = () => { setDisc(ch.disc || 'Boxing'); setGhostLaunch(ch); setScreen('setup'); };
            // The one-time health check comes before a newcomer's first round.
            if (!loadParq().done) { afterParqRef.current = launch; setShowParqGate(true); }
            else launch();
          }}
          onDecline={() => setHauntIntro(h => ({ ...h, page: 'welcome', beaten: false }))}
          onExplore={() => {
            try { localStorage.removeItem(HAUNT_NEWCOMER_KEY); } catch { /* best-effort */ }
            setHauntIntro(null);
            setScreen('onboarding');
          }}
        />
      )}
      {ghostView && (
        <GhostChallenge
          view={ghostView.view}
          challenge={ghostView.challenge}
          ghost={ghostView.ghost}
          xpLine={ghostView.xpLine}
          gender={(() => { const p = loadProfile() || {}; const pref = String(p.avatarPreference || '').toLowerCase(); return pref === 'female' || pref === 'male' ? pref : String(p.sex || '').toLowerCase() === 'female' ? 'female' : 'male'; })()}
          onAccept={() => {
            const ch = ghostView.challenge;
            setGhostView(null);
            if (ch.kind === 'cardio') {
              actions.goCardioMode({ ghost: 'best', unit: ch.run.unit, goal: ch.run.goal, surface: ch.run.surface });
            } else {
              setDisc(ch.disc || disc);
              setGhostLaunch(ch);
              setScreen('setup');
            }
          }}
          onDecline={() => { declineChallenge(); setGhostView(null); setScreen('home'); }}
          onClose={() => setGhostView(null)}
        />
      )}
      {comeback && (
        <Comeback
          comeback={comeback}
          onGo={() => {
            const v = comeback.view;
            setComeback(null);
            if (v === 'arcade') actions.goTrainingArcade();
            else if (v === 'cc') { setCcPreset('gas-tank'); setScreen('cc_setup'); }
            else actions.goTrainingCamp();
          }}
          onSkip={() => setComeback(null)}
          onRemind={() => { remindComebackNextWeek(comeback.view); setComeback(null); }}
        />
      )}
      {practiceInvite && (
        <PracticeInvite
          view={practiceInvite}
          discipline={loadProfile()?.discipline || 'Boxing'}
          onStart={(d) => { setPracticeInvite(null); actions.goPracticeLesson(d); }}
          onClose={() => setPracticeInvite(null)}
        />
      )}
      {showOffline && (
        <div style={{ position: 'fixed', ...fixedColumnLeft(12), bottom: 'calc(74px + env(safe-area-inset-bottom,0px))', zIndex: 600, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 99, background: 'rgba(20,6,38,0.95)', border: '1px solid rgba(253,224,71,0.35)', boxShadow: '0 6px 18px -8px rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', pointerEvents: 'none', animation: 'tm-offline-toast 4s ease forwards' }}>
          <span style={{ fontSize: 11 }}>📡</span>
          <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8, color: '#fde047', letterSpacing: '0.08em' }}>OFFLINE</span>
        </div>
      )}
      <div style={{ minHeight: '100dvh', background: C.bg }}>
        <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: '0.2em' }}>LOADING…</div>}>
          <ScreenRouter
            screen={screen} disc={disc} cfg={cfg} session={session} ghostLaunch={ghostLaunch} ccPreset={ccPreset}
            comboCfg={comboCfg} fitCfg={fitCfg} qmCfg={qmCfg} qmResult={qmResult}
            ccMission={ccMission} ccResult={ccResult}
            cardioContext={cardioContext} cardioResult={cardioResult} cardioEntry={cardioEntry}
            arcadeSeries={arcadeSeries} arcadeStage={arcadeStage} arcadeMode={arcadeMode} arcadeOrder={arcadeOrder} arcadeSettings={arcadeSettings}
            campCtx={campCtx} campResult={campResult}
            profile={profile} updateProfile={updateProfile} levelUp={levelUp}
            pausedSession={pausedSession} onResume={resumeSession} onDiscardPaused={discardPausedSession}
            pausedAlt={pausedAlt} onResumeAlt={resumeAltSession} onDiscardAlt={discardAltSession}
            reportSessionState={reportSessionState} resumeData={resumeData}
            actions={actions}
          />
        </Suspense>
        {/* Beta TM-05 — global feedback, two taps from anywhere. Hidden only
            on the entry gate and questionnaire, where there is nothing to
            report yet and the chip would read as chrome. */}
        {screen !== 'start' && screen !== 'onboarding' && !pathTour && (
          <FeedbackChip screen={screen} />
        )}
        {pathTour && (
          <ScreenGuide
            steps={SCREEN_GUIDES[pathTour]}
            onClose={(finished) => closePathTour(finished || pathTourLastRef.current)}
            onStep={(i, cfg) => {
              pathTourLastRef.current = i === SCREEN_GUIDES[pathTour].length - 1;
              if (!cfg?.screen) return;
              // Ladder steps need a saga loaded before the screen can
              // render — walk into the first playable one.
              if (cfg.screen === 'arcade_series') {
                const s = TRAINING_ARCADE_SERIES.find(isSeriesPlayable);
                if (s) { setArcadeSeries(s); setArcadeSettings(null); }
                setScreen(s ? 'arcade_series' : 'arcade');
                return;
              }
              setScreen(cfg.screen);
            }}
          />
        )}
        {pendingChallenge && screen !== 'start' && screen !== 'onboarding' && (
          <ChallengeInboundModal
            resolved={pendingChallenge}
            onStart={() => { const c = pendingChallenge; setPendingChallenge(null); actions.goArcadeSession(c.series, c.stage, c.mode, null, { difficulty: c.difficulty, voiceCoach: true, sound: 'on' }); }}
            onDismiss={() => setPendingChallenge(null)}
          />
        )}
      </div>
    </>
  );
}
