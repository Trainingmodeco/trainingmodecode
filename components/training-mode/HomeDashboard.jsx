import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Play, Shuffle, SlidersHorizontal, ChevronRight, Zap, Timer, Activity, X } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import { sessionLabel } from './FloatingResumeButton';
import HomeHeader from './shared/HomeHeader';
import NudgeToast from './shared/NudgeToast';
import ScreenGuide from './shared/ScreenGuide';
import { homeGuide } from './shared/screenGuides';
import SafeImage from './SafeImage';
import ReminderCard from './shared/ReminderCard';
import { loadStats, getLevel, getLevelProgress } from './data/userStats';
import { getCurrentTier } from './data/tiers';
import { syncCombo, consumeComboFlash, getComboNudge, snoozeNudge, dismissNudgeToday } from './data/comboStreak';
import { getTodayBout } from './data/gamePlan';
import { firstPick } from './data/recommendations';
import { loadLastSession, describeSession, programFor } from './data/lastSession';
import { surpriseQuickMission, quickMissionConfig, levelWord } from './data/quickMissionConfig';
import { qmV2Enabled } from './data/qmV2';
import { loadShelfPrefs } from './data/loadoutMissions';
import { startsAtYourPace } from './data/soloFromGenerated';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { getActiveChallenge, consumeGhostNudge, GHOST_CHANGE_EVENT } from './data/ghostChallenges';
import ConceptFeatureCard from './shared/ConceptFeatureCard';
import { retentionOn } from './data/retentionFlags';
import { loadWeekStreak, takeHomeNotice, markWeekMoments } from './data/weekStreakStore';
import { noticeCopy, localIso } from './data/weekStreak';
import { todaysBout, holdBout, rerollBout, pickTodaysBout, surpriseBout, boutMeta, armTodaysBout } from './data/dailyMission';
import WeekChip from './retention/ui/WeekChip';
import OneUpMark from './retention/ui/OneUpMark';
import TodaysBoutCard from './retention/ui/TodaysBoutCard';
import { SIDES, HOME } from './retention/ui/tokens';
import NextUpRow from './retention/ui/NextUpRow';
import { loadNextUp } from './data/pathNextUp';
import { nextUpCopy, nextUpLine } from './data/pathStars';
import { loadPower, takePowerNotice, markPowerMoments, dueRustyPopup } from './data/powerStore';
import { powerNoticeCopy } from './data/power';
import PowerLine from './retention/ui/PowerLine';
import RustyPopup from './retention/ui/RustyPopup';

// Home — the Simplify revamp hub.
//
// One thing to do, then everywhere else to go. The Continue card at the top is
// the one gold button: the session you have paused, else the last one you
// started (one tap runs it again with the same settings), else today's pick
// for someone with no history. Under it, the two modes, the Arcade, and three
// shortcuts.
//
// With the week streak switch on, that card (when nothing is paused) is
// TODAY'S BOUT: the same pick, held for the day, with the daily bonus and a
// done state (data/dailyMission, retention/ui/TodaysBoutCard).
//
// With the POWER switch on (data/power): a slim POWER line under the header
// once the fighter is below full, a quiet notice when it runs low (once per
// drain) and after a revive, and, on the open App gives it the turn for, the
// RUSTY pop-up (once per rusty spell) whose REVIVE is the top card's START.
//
// What moved rather than vanished: the paused-session banner is now the
// Continue card itself (it turns into RESUME); the come-back reminder and the
// streak nudge show one at a time as a toast over the header, the way the
// design shows its nudges; weekly progress lives on the PROGRESS tab. The
// Arcade card is always shown now — it used to appear only after a saga was
// started, and with "Choose Your Path" gone it would otherwise have been the
// only way in.

const FIT = SIDES.fit;
const FIGHT = SIDES.fight;
const ARCADE = { accent: '#5FE3FF', accentText: '#5FE3FF', label: 'Training Arcade', art: '/static/bout-bg.png', filter: 'none' };

// Which side of the app a paused session belongs to, for the card's colour.
const FIT_SCREENS = new Set(['qm_active', 'fit_workout', 'cardio_mode', 'cardio_finisher']);
const sideOfScreen = (screen) => (screen === 'arcade_session' ? ARCADE : FIT_SCREENS.has(screen) ? FIT : FIGHT);

const MUTED = '#A9A3C4';

// TODAY'S BOUT (week streak switch): the day's held bout, or a fresh pick from
// Home's own pick engine when none is held yet (holdBout saves it, from an
// effect). The same order as the card: the last session (folded with the
// path's NEXT UP), else the Game Plan, else the setup's first pick; on every
// other day (after a repeat day) someone with a last session is dealt
// something fresh instead (data/dailyMission freshBout).
function readTodaysBout({ at, stats, profile, pathOn }) {
  const t = todaysBout({ now: at, stats });
  if (t.bout) return t;
  const last = loadLastSession();
  const next = pathOn ? loadNextUp(last) : null;
  return {
    ...t,
    bout: pickTodaysBout({
      date: t.date, last, lastInfo: describeSession(last), next, nextLine: nextUpLine(next),
      plan: getTodayBout({ ignoreTrainedToday: true }),
      suggestion: firstPick({ profile: profile || {}, stats, dailyMission: null }),
      prevTurn: t.prevTurn, profile: profile || {}, stats,
    }),
  };
}

// The locked hub (owner, 2026-11-24: Home must fit one screen, never slide).
// Every size is a clamp() of the screen's height: today's sizes on a tall
// phone, smaller together on a short one. The art tiles give first (they are
// the only blocks that shrink in the column), then the gaps, then the card's
// padding and the gold button; text sizes hardly move. Written once in vh (a
// browser without dvh) and again in dvh where it is supported.
const lockCSS = (u) => `.hm-col {
  height: 100${u};
  --hm-top: clamp(8px, 1.6${u}, 14px);
  --hm-gap: clamp(6px, calc(2.4${u} - 8px), 14px);
  --hm-tap: clamp(40px, 7${u}, 44px);
  --hm-card-min: clamp(128px, calc(22${u} - 10px), 176px);
  --hm-card-pt: clamp(9px, 1.9${u}, 16px);
  --hm-card-pb: clamp(10px, 2.1${u}, 18px);
  --hm-card-gap: clamp(3px, 0.7${u}, 6px);
  --hm-go-h: clamp(44px, 6.2${u}, 52px);
  --hm-title: clamp(22px, 3.4${u}, 28px);
  --hm-quick-h: clamp(var(--hm-tap), calc(10${u} - 24px), 64px);
  --hm-drop-h: clamp(60px, calc(13${u} - 14px), 92px);
  --hm-next-pad: clamp(2px, calc(2${u} - 7px), 10px);
  --hm-next-min: clamp(46px, calc(4${u} + 30px), 64px);
}`;
// The lane above the tab bar belongs to the BETA pill (FitModeHub's rule).
const BOTTOM_LANE = 'calc(max(96px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))';

const homeCSS = `
@keyframes hm-ghost { 0%, 100% { opacity: 0; transform: translateY(0) } 50% { opacity: 1; transform: translateY(-4px) } }
.hm-ghost { animation: hm-ghost 3.2s ease-in-out infinite; transition: filter .2s; }
.hm-ghost:hover, .hm-ghost:focus-visible { animation-play-state: paused; opacity: 1; filter: drop-shadow(0 0 8px rgba(196,168,255,.9)); }
@media (prefers-reduced-motion: reduce) { .hm-ghost { animation: none; opacity: 1; } }
.hm-go { transition: filter .18s ease, box-shadow .18s ease, transform .1s ease; }
.hm-go:hover, .hm-go:focus-visible { filter: brightness(1.1); box-shadow: 0 0 30px rgba(242,190,69,.55) !important; }
.hm-go:active { transform: scale(0.985); }
.hm-quiet { transition: color .18s ease; }
.hm-quiet:hover, .hm-quiet:focus-visible { color: #FFFFFF !important; }
.hm-tile { transition: border-color .2s, box-shadow .2s; }
.hm-tile:hover, .hm-tile:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 0 1px rgba(242,190,69,.3), 0 0 18px rgba(157,108,255,.4); }
.hm-tile:hover svg, .hm-tile:focus-visible svg { color: #F2BE45 !important; }
.mc { transition: border-color .2s, box-shadow .2s; }
.mc:hover, .mc:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 0 1px rgba(242,190,69,.3), 0 0 22px rgba(157,108,255,.45); }
.mc .rev { opacity: 0; transform: scale(1.04); transition: opacity .35s ease, transform .5s ease; }
.mc .sil { opacity: .6; filter: brightness(.75); transition: opacity .35s ease; }
.mc:hover .rev, .mc:active .rev, .mc:focus-visible .rev { opacity: .85; transform: scale(1); }
.mc:hover .sil, .mc:active .sil, .mc:focus-visible .sil { opacity: 0; }
.mc .msub { max-height: 0; opacity: 0; overflow: hidden; transition: max-height .3s ease, opacity .3s ease; }
.mc:hover .msub, .mc:active .msub, .mc:focus-visible .msub { max-height: 30px; opacity: 1; }
.hm-arcade { transition: border-color .2s, box-shadow .2s; }
.hm-arcade:hover, .hm-arcade:focus-visible { border-color: #F2BE45 !important; box-shadow: 0 0 22px rgba(242,190,69,.35); }
/* The Arcade card rests dimmed — art and title alike — and wakes on hover,
   when the STAGES · BOSSES · XP line also appears. Same idea as the mode
   cards' silhouette → reveal. */
.hm-arcade img { opacity: .45; filter: brightness(.7); transition: opacity .3s ease, filter .3s ease, transform .4s ease; }
.hm-arcade .hm-arcade-title { opacity: .55; transition: opacity .3s ease, filter .3s ease; }
.hm-arcade .hm-arcade-sub { max-height: 0; opacity: 0; overflow: hidden; transition: max-height .3s ease, opacity .3s ease; }
.hm-arcade:hover img, .hm-arcade:active img, .hm-arcade:focus-visible img { opacity: 1; filter: brightness(1.05) saturate(1.15); transform: scale(1.03); }
.hm-arcade:hover .hm-arcade-title, .hm-arcade:active .hm-arcade-title, .hm-arcade:focus-visible .hm-arcade-title { opacity: 1; }
.hm-arcade:hover .hm-arcade-sub, .hm-arcade:active .hm-arcade-sub, .hm-arcade:focus-visible .hm-arcade-sub { max-height: 20px; opacity: 1; }
@media (hover: none) { .hm-arcade .hm-arcade-title { opacity: .8; } }
.hm-scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px); }
${lockCSS('vh')}
@supports (height: 100dvh) { ${lockCSS('dvh')} }
.hm-col { display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; position: relative; z-index: 10;
  padding: var(--hm-top) 16px ${BOTTOM_LANE}; }
.hm-stack { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; display: flex; flex-direction: column; gap: var(--hm-gap); }
.hm-stack > * { flex-shrink: 0; }
.hm-tap { height: var(--hm-tap); }
.hm-tiles { flex: 0 4 auto !important; min-height: calc(50px + 44px + var(--hm-gap)); display: flex; flex-direction: column; gap: var(--hm-gap); }
.hm-modes { flex: 1 1 150px; min-height: 50px; max-height: 150px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.hm-modes > button { height: auto !important; min-height: 0; }
.hm-tiles > .hm-arcade { flex: 0 1 96px; min-height: 44px; }
.hm-arcade-big { font-size: 26px; }
/* Never squeezed below its own heading and 44px tiles: the art gives first. */
.hm-quick { flex: 0 0.2 auto !important; display: flex; flex-direction: column; gap: 8px; min-height: calc(var(--hm-tap) + 22px); }
.hm-l1 .hm-quick { min-height: var(--hm-tap); }
.hm-quick-grid { flex: 1 1 var(--hm-quick-h); min-height: var(--hm-tap); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.hm-drop { flex: 0 1 var(--hm-drop-h) !important; min-height: 60px; }
.hm-under { display: flex; flex-direction: column; gap: var(--hm-gap); }
/* No room for the icons above the Quick Access labels: the label alone. */
@media (max-height: 759px) { .hm-quick-tile svg { display: none; } }
/* Tighter steps, taken one at a time only while the hub still does not fit
   (HomeDashboard's fit check): */
/* 1. FIT, FIGHT and the ARCADE share one row of three tiles; the Quick Access
   heading goes (its three tiles stay). */
.hm-l1 .hm-tiles { flex-direction: row; flex-basis: 112px !important; min-height: 52px; }
.hm-l1 .hm-tiles > .hm-modes { flex: 2 1 0; min-height: 0; max-height: none; gap: var(--hm-gap); }
.hm-l1 .hm-tiles > .hm-arcade { flex: 1 1 0; min-height: 0; padding: 0 8px !important; gap: 4px !important; }
.hm-l1 .hm-mode-label { font-size: 14px !important; line-height: 1.05 !important; }
.hm-l1 .hm-arcade-big { font-size: 15px; }
.hm-l1 .hm-arcade .hm-arcade-title:first-child { letter-spacing: .2em !important; font-size: 9px !important; }
.hm-l1 .hm-arcade > svg { display: none; }
/* The narrow tile has no room for the STAGES · BOSSES · XP line: the art and
   the title still wake on hover or press. */
.hm-l1 .hm-arcade .hm-arcade-sub { display: none; }
.hm-l1 .hm-quick-head { display: none; }
/* 2. The card at its tightest; NEXT UP gets slimmer. */
.hm-l2 { --hm-card-pt: 8px; --hm-card-pb: 8px; --hm-card-gap: 2px; --hm-title: 20px; --hm-gap: 5px; --hm-top: 6px; --hm-go-h: max(40px, var(--hm-tap)); --hm-next-min: 46px; --hm-next-pad: 2px; }
.hm-l2 .hm-next > span:first-of-type { width: 32px !important; height: 32px !important; }
.hm-l2 [data-lock="pick"] { margin: calc(-1 * var(--hm-gap)) 0; }
/* 3. NEXT UP and the drop side by side. */
.hm-pair { display: contents; }
.hm-l3 .hm-pair { display: flex; gap: var(--hm-gap); min-height: 60px; }
.hm-l3 .hm-pair > * { flex: 1 1 0 !important; min-width: 0; height: auto !important; }
.hm-l3 .hm-pair .hm-next { gap: 8px !important; padding-left: 8px !important; padding-right: 8px !important; }
.hm-l3 .hm-pair .hm-next > span:last-child { display: none; }
/* 4. A 1UP or POWER notice sits over the header (level, streak, ?) until it is
   closed, instead of pushing the hub down. It never covers the card: the
   card's title is what START will run. */
.hm-l4 .hm-under { position: absolute; top: var(--hm-top); left: 16px; right: 16px; z-index: 20; }
`;

export default function HomeDashboard({
  onHome, onFightMode, onFitMode, onTrain, profile,
  onPractice, onFightFocus, onQuickMission, onStartQuickMission, onFitSetup, onComboCoach, onJustTrain, onPrograms,
  onStartHere, onCombatConditioning, onTrainingArcade, onReplayLast, onOpenGhost,
  pausedSession, onResume, onDiscardPaused,
  pausedAlt, onResumeAlt, onDiscardAlt, onOpenConcept, onNextUp,
  rustyTurn = false, onRustyDone, appPopupOpen = false,
}) {
  // Retention feature 1 (weekly streak + daily mission), behind its switch.
  const [weeksOn] = useState(() => retentionOn('weeks'));
  // POWER, RUSTY and REVIVE (data/power), behind their own switch.
  const [powerOn] = useState(() => retentionOn('power'));
  const [stats, setStats] = useState(() => loadStats());
  const [helpOpen, setHelpOpen] = useState(false);
  // How many tighter steps the locked hub needs to fit (0 = the roomy look).
  const [fit, setFit] = useState(0);
  const stackRef = useRef(null);
  const [surprise, setSurprise] = useState(null);
  const [last] = useState(() => loadLastSession());
  // Retention feature 2 (the path): NEXT UP, the last saga's current node or
  // the camp's current level, from the last session.
  const [pathOn] = useState(() => retentionOn('path'));
  const [nextUp] = useState(() => (pathOn ? loadNextUp(last) : null));
  // The choice saved on the Quick Mission page. AT YOUR PACE ('solo') makes a
  // Quick Mission START here run the moves and a timer (App
  // goQuickMissionActive reads the same saved choice), so the card says so.
  const [savedMode] = useState(() => (qmV2Enabled() ? loadShelfPrefs().mode : 'guided'));

  useEffect(() => {
    const refreshStats = () => setStats(loadStats());
    refreshStats();
    if (typeof window !== 'undefined') {
      window.addEventListener('training-mode-stats-updated', refreshStats);
      window.addEventListener('storage', refreshStats);
      return () => {
        window.removeEventListener('training-mode-stats-updated', refreshStats);
        window.removeEventListener('storage', refreshStats);
      };
    }
  }, []);

  // Spec 23 — the combo outcome flash and the daily if-then nudge.
  // With the week streak on, the week chip takes the day combo's place: the
  // combo still replays (in an effect, not the render), so its XP and its
  // stored state stay as they are, but its flashes are not shown.
  const [comboFlash, setComboFlash] = useState(() => (weeksOn ? null : consumeComboFlash()));
  const [comboNudge, setComboNudge] = useState(null);
  useEffect(() => { setComboNudge(getComboNudge(profile?.name, { plain: weeksOn })); }, [profile?.name, weeksOn]);
  useEffect(() => {
    if (!weeksOn) return;
    syncCombo();
    consumeComboFlash();
  }, [weeksOn, stats]);

  // The day Home shows. A Home left open across local midnight, or brought
  // back from the background on a new day, moves on to the new day's week and
  // mission: checked when the page shows again or gets focus, and at the next
  // local midnight. Any time within the day reads the same, so it changes only
  // with the date.
  const [dayAt, setDayAt] = useState(() => Date.now());
  useEffect(() => {
    if (!(weeksOn || powerOn) || typeof window === 'undefined' || typeof document === 'undefined') return undefined;
    const check = () => setDayAt((prev) => (localIso(prev) === localIso(Date.now()) ? prev : Date.now()));
    let timer = null;
    const arm = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { check(); arm(); }, Math.max(1000, next.getTime() - now.getTime()));
    };
    arm();
    const onShow = () => { if (document.visibilityState !== 'hidden') check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onShow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onShow);
    };
  }, [weeksOn, powerOn]);

  // The week streak: recomputed from the rows (data/weekStreak), never stored.
  const week = useMemo(() => (weeksOn ? loadWeekStreak(dayAt, stats.sessions) : null), [weeksOn, stats, dayAt]);
  // A freeze that covered last week, or one earned and not yet seen: once,
  // through the nudge slot.
  const [weekNotice, setWeekNotice] = useState(null);
  const weekNoticeShown = useRef(false);
  useEffect(() => {
    if (!weeksOn || !week) return;
    const n = takeHomeNotice(week);
    if (!n) return;
    markWeekMoments({ seen: [n.id] });
    weekNoticeShown.current = true;
    setWeekNotice(n);
  }, [weeksOn, week]);
  // POWER (switch on): recomputed from the rows, never stored. Its notice
  // (a revive not yet shown, else the low notice once per drain) takes the
  // same slot under the header, one notice a visit: never after a 1UP notice.
  const power = useMemo(() => (powerOn ? loadPower(dayAt, stats.sessions) : null), [powerOn, stats, dayAt]);
  const [powerNotice, setPowerNotice] = useState(null);
  useEffect(() => {
    if (!powerOn || !power || weekNoticeShown.current || powerNotice) return;
    const n = takePowerNotice(dayAt, stats.sessions);
    if (!n) return;
    markPowerMoments([n.id]);
    setPowerNotice(n);
  }, [powerOn, power]); // eslint-disable-line react-hooks/exhaustive-deps
  // The RUSTY pop-up, on the open App gave it the turn for (App's one
  // interstitial per open, so it never stacks on another pop-up). Not over a
  // paused session, the guide or an App pop-up: it waits for an open when it
  // can show, and App passes the turn down its queue (onRustyDone(false)).
  // Marked shown when it shows: once per rusty spell. An App pop-up that
  // opens after it (a haunt link resolving late) hides it until that one closes.
  const [rustyPop, setRustyPop] = useState(null);
  useEffect(() => {
    if (!rustyTurn) return;
    const due = powerOn && !pausedSession && !helpOpen && !appPopupOpen ? dueRustyPopup() : null;
    if (due) { markPowerMoments([due.id]); setRustyPop(due); }
    onRustyDone?.(!!due);
  }, [rustyTurn]); // eslint-disable-line react-hooks/exhaustive-deps
  // TODAY'S BOUT: picked once a day and held (saved from the effect); re-read
  // after every stats write, so the card turns done when its bonus is paid.
  const [today, setToday] = useState(() => (weeksOn ? readTodaysBout({ at: Date.now(), stats: loadStats(), profile, pathOn }) : null));
  useEffect(() => {
    if (!weeksOn) return;
    const t = readTodaysBout({ at: dayAt, stats, profile, pathOn });
    if (!t.saved) holdBout(t.bout);
    setToday(t);
  }, [weeksOn, pathOn, stats, profile, dayAt]);

  // A live ghost challenge haunts the Continue card until it's beaten; its
  // nudges (the decline line, then at most one a day) take the toast slot.
  const [ghostCh, setGhostCh] = useState(() => getActiveChallenge());
  const [ghostNudge, setGhostNudge] = useState(() => consumeGhostNudge());
  // Home is usually already mounted under the challenge screen, so a decline
  // there has to reach it: re-read on every change.
  useEffect(() => {
    const onChange = () => {
      setGhostCh(getActiveChallenge());
      const n = consumeGhostNudge();
      if (n) setGhostNudge(n);
    };
    window.addEventListener(GHOST_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(GHOST_CHANGE_EVENT, onChange);
  }, []);
  useEffect(() => {
    if (!ghostNudge?.auto) return undefined;
    const t = setTimeout(() => setGhostNudge(null), 4500);
    return () => clearTimeout(t);
  }, [ghostNudge]);

  const level = getLevel(stats.xp);
  const { current: levelXp, needed: levelNeeded } = getLevelProgress(stats.xp);
  const xpPercent = Math.max(3, Math.round((levelXp / levelNeeded) * 100));
  const tier = getCurrentTier(stats);
  const combo = weeksOn ? null : syncCombo();
  const disc = profile?.discipline || 'Boxing';

  // Today's pick — the fallback when there is nothing to continue. The same
  // pick the setup questionnaire promised (data/recommendations firstPick):
  // Fit goals get a Fit workout, not a fight timer.
  const suggestion = firstPick({ profile: profile || {}, stats, dailyMission: null });
  const bout = getTodayBout();
  const routeAction = (actionType, payload) => {
    switch (actionType) {
      case 'fightFocus': onFightFocus?.(payload || disc); break;
      case 'comboCoach': onComboCoach?.(payload || disc); break;
      // A suggested mission carries its settings, so START runs exactly the
      // mission named on the card — as the Fit hub's does.
      case 'quickMission':
        if (payload && typeof payload === 'object') primeThen(() => onStartQuickMission?.(quickMissionConfig(payload)));
        else onQuickMission?.();
        break;
      case 'fitMode': onFitSetup?.(); break;
      case 'combatConditioning': onCombatConditioning?.(); break;
      case 'startHere': onStartHere?.(); break;
      case 'practice': onPractice?.(); break;
      default: onTrain?.(); break;
    }
  };
  const handleBoutStart = () => {
    if (bout?.kind === 'train') { routeAction(bout.actionType); return; }
    if (bout?.kind === 'recovery') { onQuickMission?.(); return; }
    if (!suggestion) { onTrain?.(); return; }
    routeAction(suggestion.actionType, suggestion.actionPayload);
  };
  const boutTitle = bout
    ? (bout.kind === 'train' ? bout.session.label
      : bout.kind === 'rest_day' ? 'Planned Rest Day'
      : bout.kind === 'already_trained' ? 'Trained — Nice Work'
      : 'Recovery Round')
    : (suggestion?.title || 'Fight Focus');
  const boutSub = bout
    ? (bout.kind === 'train' ? `Fits your ~${bout.gapMin} min window` : bout.reason)
    : (suggestion?.subtitle || 'Timed rounds with coaching');
  const boutCta = bout
    ? (bout.kind === 'rest_day' ? 'TRAIN ANYWAY' : bout.kind === 'already_trained' ? 'BONUS ROUND' : bout.kind === 'recovery' ? 'QUICK MISSION' : 'START')
    : 'START';

  // Setup screen for the last session, for ADJUST. `l`: the last session
  // (today's bout holds its own copy of it).
  const adjustFor = (l) => {
    if (!l) return;
    const d = l.disc || disc;
    if (l.kind === 'timer') (l.cfg.mode === 'Just Train' ? onJustTrain : onFightFocus)?.(d);
    else if (l.kind === 'combo') onComboCoach?.(d);
    else if (l.kind === 'quick_mission') onQuickMission?.();
    else if (l.kind === 'fit') (programFor(l) ? onPrograms : onFitSetup)?.();
    else if (l.kind === 'cc') onCombatConditioning?.();
    // Camp, Arcade and Cardio: CONTINUE already opens their own setup (map,
    // stage ladder, cardio setup), so ADJUST goes to the same place.
    else if (l.kind === 'camp' || l.kind === 'arcade' || l.kind === 'cardio') onReplayLast?.(l === last ? { adjust: true } : { adjust: true, last: l });
  };
  const adjustLast = () => adjustFor(last);

  // A session start from a tap on Home is still a user gesture, so speech can
  // be unlocked here the same way each setup screen does before it starts.
  const primeThen = async (fn) => {
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    fn();
  };

  // What the card shows, in priority order.
  const lastInfo = describeSession(last);
  const foldNext = !!(pathOn && nextUp && (last?.kind === 'arcade' || last?.kind === 'camp'));
  let card;
  if (pausedSession) {
    card = {
      kind: 'paused', eyebrow: 'Continue', side: sideOfScreen(pausedSession.screen),
      title: sessionLabel(pausedSession), parts: ['Paused — pick up where you left off'],
      cta: 'RESUME', onGo: onResume,
    };
  } else if (surprise) {
    card = {
      kind: 'surprise', eyebrow: 'Surprise', side: FIT,
      title: 'Surprise Mission', parts: [surprise.focus, levelWord(surprise.difficulty).charAt(0) + levelWord(surprise.difficulty).slice(1).toLowerCase(), `${surprise.duration} min`],
      cta: 'START', onGo: () => primeThen(() => onStartQuickMission?.(surprise)), onAdjust: onQuickMission,
      atPace: startsAtYourPace(surprise, savedMode),
    };
  } else if (lastInfo && foldNext) {
    // The path (switch on): the last session is the saga or the camp NEXT UP
    // names, and both open it, so NEXT UP folds in here (one card, one place):
    // the line says the node, and the tap opens the saga or camp on it (the
    // same pop-up / level card and start flow). ADJUST still opens the saga
    // or the camp as before.
    const line = nextUpLine(nextUp);
    card = {
      kind: 'last', next: true, eyebrow: 'Next up', side: lastInfo.mode === 'fit' ? FIT : FIGHT,
      title: lastInfo.title, parts: line.parts, label: line.label,
      cta: lastInfo.cta || 'CONTINUE', onGo: () => primeThen(() => onNextUp?.(nextUp)), onAdjust: adjustLast,
    };
  } else if (lastInfo) {
    card = {
      kind: 'last', eyebrow: 'Continue', side: lastInfo.mode === 'fit' ? FIT : FIGHT,
      title: lastInfo.title, parts: [lastInfo.sub, lastInfo.diff, lastInfo.time].filter(Boolean),
      cta: lastInfo.cta || 'START', onGo: () => primeThen(() => onReplayLast?.()), onAdjust: adjustLast,
      atPace: last.kind === 'quick_mission' && startsAtYourPace(last.cfg, savedMode),
    };
  } else {
    card = {
      kind: 'bout', eyebrow: !bout && suggestion?.mode === 'fit' ? "Today's pick" : "Today's bout",
      side: !bout && suggestion?.mode === 'fit' ? FIT : FIGHT,
      title: boutTitle, parts: [boutSub], cta: boutCta, onGo: handleBoutStart,
      // Only a plain Quick Mission pick starts straight away (the others open a setup screen).
      atPace: !bout && suggestion?.actionType === 'quickMission' && !!suggestion.actionPayload && typeof suggestion.actionPayload === 'object'
        && startsAtYourPace(quickMissionConfig(suggestion.actionPayload), savedMode),
    };
  }

  // TODAY'S BOUT (week streak switch): the one card at the top whenever no
  // session is paused. START runs the held bout by its own route; START or
  // ADJUST arms the day's bonus (data/dailyMission) until it is paid.
  const b = weeksOn && !pausedSession ? today?.bout : null;
  const boutDone = !!today?.done;
  // A fresh day's Quick Mission: built here and tagged with its day, so it is
  // never stored as the last session (data/lastSession rememberSession).
  const freshQmCfg = (r) => ({ ...quickMissionConfig(r.qm), freshBout: b?.date || localIso(Date.now()) });
  const runBout = (r) => {
    if (!r) { onTrain?.(); return; }
    if (r.type === 'replay') primeThen(() => onReplayLast?.({ last: r.last }));
    else if (r.type === 'next') primeThen(() => onNextUp?.(r.next));
    else if (r.type === 'freshQm') primeThen(() => onStartQuickMission?.(freshQmCfg(r)));
    else if (r.type === 'surprise') primeThen(() => onStartQuickMission?.(r.cfg));
    else if (r.type === 'qmSetup') onQuickMission?.();
    else routeAction(r.actionType, r.payload);
  };
  const armBout = () => { if (b && !boutDone) armTodaysBout({ kind: b.kind }); };
  const boutAdjust = !b ? null
    : b.kind === 'surprise' || b.run?.type === 'freshQm' ? onQuickMission
    : (b.kind === 'last' || b.kind === 'next' || b.kind === 'fresh') && b.run?.last ? () => adjustFor(b.run.last)
    : null;
  const boutAtPace = !!b && (
    b.run?.type === 'surprise' ? startsAtYourPace(b.run.cfg, savedMode)
    : b.run?.type === 'freshQm' ? startsAtYourPace(quickMissionConfig(b.run.qm), savedMode)
    : b.run?.type === 'replay' ? b.run.last?.kind === 'quick_mission' && startsAtYourPace(b.run.last.cfg, savedMode)
    : b.run?.type === 'route' && b.run.actionType === 'quickMission' && !!b.run.payload && typeof b.run.payload === 'object'
      ? startsAtYourPace(quickMissionConfig(b.run.payload), savedMode) : false);
  // SURPRISE ME re-rolls today's bout in place (held for the rest of the day).
  const surpriseMe = () => {
    if (!weeksOn) { setSurprise(surpriseQuickMission()); return; }
    const cfg = surpriseQuickMission();
    const w = levelWord(cfg.difficulty);
    const pick = surpriseBout({ date: localIso(Date.now()), cfg, level: w.charAt(0) + w.slice(1).toLowerCase() });
    rerollBout(pick);
    setToday({ ...todaysBout({ stats: loadStats() }), bout: pick, saved: true });
  };
  const ghostButton = ghostCh ? (
    <button type="button" className="hm-ghost" data-guide="home-ghost" onClick={onOpenGhost} aria-label="Your ghost challenge" style={{
      flexShrink: 0, background: 'none', border: 0, padding: 10, margin: -8, cursor: 'pointer', fontSize: 24, lineHeight: 1,
    }}>👻</button>
  ) : null;

  // REVIVE on the RUSTY pop-up: the top card's own START (TODAY'S BOUT's,
  // so its bonus rules apply; the Continue card's with the week streak off).
  const startTop = () => {
    if (b) { armBout(); runBout(b.run); return; }
    card.onGo?.();
  };
  const sex = String(profile?.sex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const showPower = !!power && (power.state === 'draining' || power.state === 'low' || power.state === 'rusty');

  // One nudge at a time, over the header — the combo flash first (it only
  // ever shows once), then the daily nudge, then the come-back reminder.
  // The week streak's 1UP notice and POWER's notice (switches on) sit UNDER
  // the header instead, so the level, the week chip it is about and the "?"
  // stay in view; while one shows, the slot over the header stays empty.
  const underNotice = weekNotice || powerNotice;
  const nudge = underNotice
    ? null
    : comboFlash
    ? { icon: comboFlash.kind === 'milestone' ? '🏅' : comboFlash.kind === 'guarded' ? '🛡' : '🔁', text: comboFlash.text, onClose: () => setComboFlash(null) }
    : ghostNudge
      ? {
        icon: '👻', text: ghostNudge.text,
        onGo: ghostNudge.auto ? undefined : () => { setGhostNudge(null); onOpenGhost?.(); },
        onClose: () => setGhostNudge(null),
      }
    : comboNudge
      ? {
        icon: '⏰', text: comboNudge.text,
        onGo: () => { dismissNudgeToday(); setComboNudge(null); onTrain?.(); },
        onClose: () => { snoozeNudge(30); setComboNudge(null); },
      }
      : null;

  // The fit check: while the column does not fit the screen, take the next
  // tighter step (homeCSS: hm-l1..hm-l4). What is on the hub, or the screen's
  // size, changing starts over from the roomiest look.
  const fitKey = [!!underNotice, !!b, boutDone, !!pausedAlt, card.kind, !!card.next, !!nextUp, !!ghostCh, !!showPower, String(b?.title || card.title || '').length > 18].join();
  const fitStart = useRef(fitKey);
  if (fitStart.current !== fitKey) { fitStart.current = fitKey; if (fit) setFit(0); }
  // Past the last step it still does not fit (a very large phone font):
  // then, and only then, the column scrolls rather than hide anything.
  const [tick, setTick] = useState(0);
  const over = () => { const el = stackRef.current; return !!el && el.scrollHeight > el.clientHeight; };
  const [stuck, setStuck] = useState(false);
  // In the roomy look, FIT and FIGHT squeezed under 80px (or the ARCADE under
  // 64px, too short for its STAGES line) are thin strips: three in a row
  // (step 1) gives each tile more height.
  const slivers = () => {
    const el = stackRef.current; if (!el || fit !== 0) return false;
    const m = el.querySelector('.mc'); const a = el.querySelector('.hm-arcade');
    return (!!m && m.offsetHeight < 80) || (!!a && a.offsetHeight < 64);
  };
  useLayoutEffect(() => {
    if (!over() && !slivers()) setStuck(false);
    else if (fit < 4) setFit(fit + 1);
    else setStuck(true);
  }, [fit, fitKey, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return undefined;
    let w = window.innerWidth; let h = window.innerHeight;
    const onResize = () => { if (window.innerWidth !== w || window.innerHeight !== h) { w = window.innerWidth; h = window.innerHeight; setFit(0); } };
    // A picture or a font arriving late can still make it taller.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => setTick((t) => t + 1)) : null;
    for (const c of el.children) ro?.observe(c);
    window.addEventListener('resize', onResize);
    // A step taken while a font or picture was still loading (the page was
    // taller for a moment) is not kept: once they are in, start over from
    // the roomiest look. The steps run before the screen is painted.
    let live = true;
    const settle = setTimeout(() => setFit(0), 900);
    document.fonts?.ready?.then(() => { if (live) setFit(0); });
    return () => { live = false; clearTimeout(settle); ro?.disconnect(); window.removeEventListener('resize', onResize); };
  }, [fitKey]);

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: homeCSS }}/>

      {/* Exactly one screen tall, like the Fit and Fight hubs. The stack can
          only scroll as a last resort (a very large phone font). */}
      <div className={`hm-col${fit >= 1 ? ' hm-l1' : ''}${fit >= 2 ? ' hm-l2' : ''}${fit >= 3 ? ' hm-l3' : ''}${fit >= 4 ? ' hm-l4' : ''}`}>
      <div ref={stackRef} className="hm-stack no-scrollbar" style={{ overflowY: stuck ? 'auto' : 'hidden' }}>
        {/* Header: level, rank and streak. Profile lives on the tab bar. */}
        <HomeHeader
          level={level} tierName={tier?.name} levelXp={levelXp} levelNeeded={levelNeeded} xpPercent={xpPercent}
          onHome={onHome} onHelp={() => setHelpOpen(true)} compact={weeksOn} helpSlop={6}
          chip={weeksOn ? (
            <WeekChip days={week.thisWeek.days} done={week.thisWeek.done} target={week.thisWeek.target} streak={week.streak} freezes={week.freezes}/>
          ) : (
            <div aria-label={`${combo.combo} day streak`} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 16, background: '#15110A', color: '#F2BE45', flexShrink: 0 }}>
              <span style={{ fontSize: 14 }}>🔥</span>
              <span style={{ font: "700 14px 'Chakra Petch',sans-serif" }}>{combo.combo}</span>
              {combo.guards > 0 && <span style={{ fontSize: 10, color: '#8fe8ac' }}>🛡{combo.guards}</span>}
            </div>
          )}
        />
        {/* POWER below full (switch on): one slim line, part of the level block. */}
        {showPower && <PowerLine pct={power.pct} state={power.state} style={{ marginTop: 'calc(min(8px, var(--hm-gap)) - var(--hm-gap))' }}/>}
        {underNotice && <div className="hm-under">
        {weekNotice && <NudgeToast solid icon={<OneUpMark/>} text={noticeCopy(weekNotice)} onClose={() => setWeekNotice(null)}/>}
        {!weekNotice && powerNotice && (
          <div data-retention="power-notice">
            <NudgeToast
              solid text={powerNoticeCopy(powerNotice)} onClose={() => setPowerNotice(null)}
              icon={<Zap size={20} color={powerNotice.kind === 'low' ? HOME.low : '#fde047'} fill={powerNotice.kind === 'low' ? HOME.low : '#fde047'} strokeWidth={0}/>}
            />
          </div>
        )}
        </div>}

        {/* The one thing to do. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {/* The second paused session — one of each kind can wait. */}
          {pausedAlt && (
            <div className="hm-tile" data-lock="alt" style={{
              order: 2, display: 'flex', alignItems: 'center', gap: 10, height: 'calc(var(--hm-tap) + 2px)', boxSizing: 'border-box', padding: '0 0 0 14px',
              borderRadius: 12, background: '#0E0B18', border: `1px solid ${sideOfScreen(pausedAlt.screen).accent}55`,
            }}>
              <span style={{ font: "600 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: sideOfScreen(pausedAlt.screen).accentText, flexShrink: 0 }}>Also paused</span>
              <span style={{ flex: 1, minWidth: 0, font: "700 14px 'Chakra Petch',sans-serif", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessionLabel(pausedAlt)}</span>
              {/* Both taps take the row's whole height; the pill is the look. */}
              <button type="button" className="hm-quiet" onClick={onResumeAlt} style={{ alignSelf: 'stretch', display: 'flex', alignItems: 'center', padding: 0, margin: '0 -4px 0 0', border: 'none', background: 'none', color: '#F2BE45', cursor: 'pointer' }}>
                <span style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', borderRadius: 8, border: '1px solid rgba(242,190,69,0.5)', background: 'rgba(242,190,69,0.1)', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em' }}>RESUME</span>
              </button>
              <button type="button" onClick={onDiscardAlt} aria-label="Discard this paused session" style={{ alignSelf: 'stretch', width: 40, background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14}/></button>
            </div>
          )}
          {b ? (
            <TodaysBoutCard
              side={b.side === 'fit' ? FIT : FIGHT} title={b.title} parts={b.parts || []} meta={boutMeta(b, { atPace: boutAtPace })}
              cta={b.cta || 'START'} bonusXp={b.bonusXp} done={boutDone} label={b.label}
              retention={b.kind === 'next' ? 'next-up' : 'todays-bout'} ghost={ghostButton}
              onGo={() => { armBout(); runBout(b.run); }}
              // Clear of a two-line toast over the header.
              style={{ marginTop: 6 }}
            />
          ) : (
          <section data-guide="home-continue" data-retention={card.next ? 'next-up' : undefined} style={{
            position: 'relative', minHeight: 'var(--hm-card-min)', flexShrink: 0, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.08)', background: '#0D0A18',
          }}>
            <SafeImage src={card.side.art} alt="" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'auto', maxWidth: 'none', opacity: 0.55, filter: card.side.filter }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.72) 58%, rgba(7,6,12,0.25) 100%)' }}/>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: card.side.accent }}/>
            <div style={{ position: 'relative', flex: 1, boxSizing: 'border-box', padding: 'var(--hm-card-pt) 18px var(--hm-card-pb)', display: 'flex', flexDirection: 'column', gap: 'var(--hm-card-gap)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Play size={12} color="#F2BE45" fill="#F2BE45" strokeWidth={0}/>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: '#F2BE45' }}>{card.eyebrow}</span>
                <span style={{ marginLeft: 'auto', font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: card.side.accentText }}>{card.side.label}</span>
                {card.kind === 'paused' && (
                  <button type="button" onClick={onDiscardPaused} aria-label="Discard paused session" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 15, margin: -13, display: 'flex' }}><X size={14}/></button>
                )}
              </div>
              {/* Short titles at the design's 28px; longer picks ("Fight Focus —
                  3 Round Starter") drop a size and wrap rather than lose words.
                  Longhand, not `font`: the size changes between renders, and a
                  changing shorthand beside lineHeight makes React warn. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <h1 style={{
                  flex: '0 1 auto', minWidth: 0,
                  margin: '2px 0 0', fontWeight: 700, fontSize: card.title.length > 18 ? 'min(22px, var(--hm-title))' : 'var(--hm-title)', fontFamily: "'Chakra Petch',sans-serif", lineHeight: 1.08, color: '#fff',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{card.title}</h1>
                {/* The design's 👻: fades in and out beside the title while a
                    ghost challenge is live, and opens it. */}
                {ghostCh && (
                  <button type="button" className="hm-ghost" data-guide="home-ghost" onClick={onOpenGhost} aria-label="Your ghost challenge" style={{
                    flexShrink: 0, background: 'none', border: 0, padding: 10, margin: -8, cursor: 'pointer', fontSize: 24, lineHeight: 1,
                  }}>👻</button>
                )}
              </div>
              {/* With the week streak on (this card is then only a paused
                  session's) and for NEXT UP, the line takes two lines before
                  it is cut. */}
              <div style={weeksOn || card.next
                ? { fontSize: 14, lineHeight: 1.3, color: MUTED, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
                : { fontSize: 14, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.parts.join(' · ')}</div>
              {/* START follows the saved choice: AT YOUR PACE is the moves and a timer. */}
              {card.atPace && <div style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', color: '#F2BE45' }}>AT YOUR PACE</div>}
              <div style={{ flexGrow: 1 }}/>
              <button type="button" className="hm-go" onClick={card.onGo} aria-label={card.label} style={{
                height: 'var(--hm-go-h)', flexShrink: 0, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
                font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', boxShadow: '0 0 24px rgba(242,190,69,0.3)',
              }}><Play size={16} fill="currentColor" strokeWidth={0}/>{card.cta}</button>
            </div>
          </section>
          )}

          {/* Shown only when they'd do something different from START: a
              paused session has nothing to surprise or adjust. */}
          {card.kind !== 'paused' && (
            <div data-lock="pick" style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <button type="button" className="hm-quiet" onClick={surpriseMe} style={{
                height: 'var(--hm-tap)', display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
              }}><Shuffle size={15}/>SURPRISE ME</button>
              {(b ? boutAdjust : card.onAdjust) && (
                <button type="button" className="hm-quiet" onClick={b ? () => { armBout(); boutAdjust(); } : card.onAdjust} style={{
                  height: 'var(--hm-tap)', display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                  color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
                }}><SlidersHorizontal size={15}/>ADJUST</button>
              )}
            </div>
          )}
        </div>

        {/* NEXT UP on the path (switch on): straight onto the current node.
            Folded into the Continue card when that card is the same saga or
            camp; left out under a paused session or a surprise pick (the
            card above is the one thing to do). What is left: a concept
            stage's last run (Continue replays that stage's timer), and,
            under Today's Bout held from earlier in the day, a saga or the
            camp played since. */}
        {/* NEXT UP and the drop: one under the other, or side by side at the
            tightest step (homeCSS .hm-pair). */}
        <div className="hm-pair">
        {pathOn && nextUp && (b ? b.kind === 'last' : card.kind === 'last' && !card.next) && (
          <NextUpRow {...nextUpCopy(nextUp)} number={nextUp.number} boss={nextUp.boss} onGo={() => onNextUp?.(nextUp)} className="hm-next" style={{ minHeight: 'var(--hm-next-min)', paddingTop: 'var(--hm-next-pad)', paddingBottom: 'var(--hm-next-pad)' }}/>
        )}

        {/* The featured concept drop, when one is live. */}
        <ConceptFeatureCard mode="home" center onOpen={onOpenConcept} style={{ height: 'auto', minHeight: 60, flex: '0 1 var(--hm-drop-h)' }}/>
        </div>

        {/* The two modes. Silhouettes until pointed at, then the art. */}
        {/* The art tiles: the blocks that give height back on a shorter phone. */}
        <div className="hm-tiles">
        <div data-guide="home-modes" className="hm-modes">
          {[
            { key: 'fit', label: 'FIT MODE', color: '#D2BCFF', border: 'rgba(176,140,255,0.35)', sub: 'Strength, quick workouts & conditioning', go: onFitMode || onTrain },
            { key: 'fight', label: 'FIGHT MODE', color: '#8FB4FF', border: 'rgba(91,141,255,0.35)', sub: 'Combat skills, techniques & fight-ready conditioning', go: onFightMode },
          ].map(m => (
            <button key={m.key} type="button" className="mc" aria-label={m.label} onClick={m.go} style={{
              position: 'relative', display: 'block', height: 150, borderRadius: 14, overflow: 'hidden', padding: 0, cursor: 'pointer',
              background: '#07060C', border: `1px solid ${m.border}`, textAlign: 'left',
            }}>
              <SafeImage className="sil" src={`/static/revamp/hub-${m.key}-silhouette.webp`} alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}/>
              <SafeImage className="rev" src={`/static/revamp/hub-${m.key}-reveal.webp`} alt="" style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(.95)' }}/>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,6,16,0) 58%, rgba(8,6,16,.7) 80%, rgba(8,6,16,.92) 100%)' }}/>
              <div style={{ position: 'absolute', left: 10, right: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="hm-mode-label" style={{ flex: 1, font: "700 17px 'Chakra Petch',sans-serif", lineHeight: 1, letterSpacing: '0.04em', color: m.color }}>{m.label}</span>
                  <ChevronRight size={15} color="#E6E2F5"/>
                </div>
                <span className="msub" style={{ font: "600 7.5px 'Chakra Petch',sans-serif", lineHeight: 1.3, letterSpacing: '0.08em', color: '#D9D4EC', textTransform: 'uppercase', width: 140 }}>{m.sub}</span>
              </div>
            </button>
          ))}
        </div>

        <button type="button" className="hm-arcade" data-guide="home-arcade" onClick={() => onTrainingArcade?.()} title="Training Arcade" style={{
          position: 'relative', borderRadius: 14, overflow: 'hidden', padding: '0 14px', cursor: 'pointer', textAlign: 'left',
          border: '1px solid rgba(242,190,69,0.35)', background: '#0B0718', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        }}>
          <SafeImage src="/static/revamp/arcade-banner.webp" alt="" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'auto', maxWidth: 'none' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0B0718 0%, rgba(11,7,24,.95) 38%, rgba(11,7,24,.55) 58%, rgba(11,7,24,0) 72%)' }}/>
          <div className="hm-scan"/>
          <span style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="hm-arcade-title" style={{ font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.42em', color: '#5FE3FF', textShadow: '0 0 8px rgba(95,227,255,.6)' }}>TRAINING</span>
            <span className="hm-arcade-title" style={{
              fontStyle: 'italic', fontWeight: 900, fontFamily: "'Orbitron',sans-serif", lineHeight: 1, letterSpacing: '0.04em',
              background: 'linear-gradient(180deg, #FFF6C8 0%, #FDE047 45%, #E0A21C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(253,224,71,.35)) drop-shadow(2px 2px 0 #4C1D95)',
            }} data-big="1"><span className="hm-arcade-big">ARCADE</span></span>
            <span className="hm-arcade-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#E6E2F5' }}>
              STAGES<span style={{ color: '#5FE3FF' }}>◆</span>BOSSES<span style={{ color: '#5FE3FF' }}>◆</span>XP
            </span>
          </span>
          <ChevronRight size={22} color="#F2BE45" style={{ position: 'relative', flexShrink: 0 }}/>
        </button>
        </div>

        <div data-guide="home-quick" className="hm-quick">
          <span className="hm-quick-head" style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Quick access</span>
          <div className="hm-quick-grid">
            {[
              { key: 'qm', label: 'QUICK MISSION', Icon: Zap, go: onQuickMission },
              { key: 'jt', label: 'JUST TRAIN', Icon: Timer, go: () => onJustTrain?.(disc) },
              { key: 'cc', label: 'COMBAT CONDITIONING', Icon: Activity, go: onCombatConditioning },
            ].map(t => (
              <button key={t.key} type="button" className="hm-tile hm-quick-tile" onClick={t.go} style={{
                borderRadius: 14, background: '#0E0B18', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 6px', color: '#fff',
              }}>
                <t.Icon size={20} color={MUTED}/>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Nudges: one at a time, over the header, always dismissible. */}
      {!underNotice && <div style={{ position: 'absolute', zIndex: 20, left: 16, right: 16, top: 10 }}>
        {nudge ? (
          <NudgeToast icon={nudge.icon} text={nudge.text} onGo={nudge.onGo} onClose={nudge.onClose} solid={weeksOn}/>
        ) : (
          <ReminderCard
            compact
            // The week streak (switch on): its streak case is the week streak's.
            weeks={weeksOn}
            // Opaque over the week streak's busier header, like the toast.
            style={weeksOn ? { background: '#140C26' } : undefined}
            onAction={(type) => {
              if (type === 'quickMission') onQuickMission?.();
              else if (type === 'fightFocus') onFightFocus?.(disc);
              else onTrain?.();
            }}
          />
        )}
      </div>}

      {helpOpen && <ScreenGuide steps={homeGuide({ weeks: weeksOn, power: powerOn })} onClose={() => setHelpOpen(false)}/>}
      {rustyPop && !appPopupOpen && !helpOpen && (
        <RustyPopup
          sex={sex} tierId={tier?.id} daysSince={rustyPop.daysSince}
          onRevive={() => { setRustyPop(null); startTop(); }}
          onLater={() => setRustyPop(null)}
        />
      )}
    </PhoneFrame>
  );
}
