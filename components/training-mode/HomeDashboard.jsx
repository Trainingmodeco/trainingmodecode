import { useState, useEffect } from 'react';
import { Play, Shuffle, SlidersHorizontal, ChevronRight, Zap, Timer, Activity, X } from 'lucide-react';
import PhoneFrame from './PhoneFrame';
import { sessionLabel } from './FloatingResumeButton';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import SafeImage from './SafeImage';
import ReminderCard from './shared/ReminderCard';
import { loadStats, getLevel, getLevelProgress } from './data/userStats';
import { getCurrentTier } from './data/tiers';
import { syncCombo, consumeComboFlash, getComboNudge, snoozeNudge, dismissNudgeToday } from './data/comboStreak';
import { getTodayBout } from './data/gamePlan';
import { firstPick } from './data/recommendations';
import { loadLastSession, describeSession, programFor } from './data/lastSession';
import { surpriseQuickMission, quickMissionConfig } from './data/quickMissionConfig';
import { primeSpeech, setVoiceGender } from './voiceCoach';
import { getActiveChallenge, consumeGhostNudge, GHOST_CHANGE_EVENT } from './data/ghostChallenges';

// Home — the Simplify revamp hub.
//
// One thing to do, then everywhere else to go. The Continue card at the top is
// the one gold button: the session you have paused, else the last one you
// started (one tap runs it again with the same settings), else today's pick
// for someone with no history. Under it, the two modes, the Arcade, and three
// shortcuts.
//
// What moved rather than vanished: the paused-session banner is now the
// Continue card itself (it turns into RESUME); the come-back reminder and the
// streak nudge show one at a time as a toast over the header, the way the
// design shows its nudges; weekly progress lives on the PROGRESS tab. The
// Arcade card is always shown now — it used to appear only after a saga was
// started, and with "Choose Your Path" gone it would otherwise have been the
// only way in.

const FIT = { accent: '#9D6CFF', accentText: '#C4A8FF', label: 'Fit Mode', art: '/static/banner-bg.png', filter: 'none' };
const FIGHT = { accent: '#3D7BFF', accentText: '#8FB4FF', label: 'Fight Mode', art: '/static/bout-bg.png', filter: 'hue-rotate(-48deg) saturate(1.1)' };
const ARCADE = { accent: '#5FE3FF', accentText: '#5FE3FF', label: 'Training Arcade', art: '/static/bout-bg.png', filter: 'none' };

// Which side of the app a paused session belongs to, for the card's colour.
const FIT_SCREENS = new Set(['qm_active', 'fit_workout', 'cardio_mode', 'cardio_finisher']);
const sideOfScreen = (screen) => (screen === 'arcade_session' ? ARCADE : FIT_SCREENS.has(screen) ? FIT : FIGHT);

const MUTED = '#A9A3C4';

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
`;

export default function HomeDashboard({
  onHome, onFightMode, onFitMode, onTrain, profile,
  onPractice, onFightFocus, onQuickMission, onStartQuickMission, onFitSetup, onComboCoach, onJustTrain, onPrograms,
  onStartHere, onCombatConditioning, onTrainingArcade, onReplayLast, onOpenGhost,
  pausedSession, onResume, onDiscardPaused,
  pausedAlt, onResumeAlt, onDiscardAlt,
}) {
  const [stats, setStats] = useState(() => loadStats());
  const [helpOpen, setHelpOpen] = useState(false);
  const [surprise, setSurprise] = useState(null);
  const [last] = useState(() => loadLastSession());

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
  const [comboFlash, setComboFlash] = useState(() => consumeComboFlash());
  const [comboNudge, setComboNudge] = useState(null);
  useEffect(() => { setComboNudge(getComboNudge(profile?.name)); }, [profile?.name]);

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
  const combo = syncCombo();
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
        if (payload && typeof payload === 'object') onStartQuickMission?.(quickMissionConfig(payload));
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

  // Setup screen for the last session, for ADJUST.
  const adjustLast = () => {
    if (!last) return;
    const d = last.disc || disc;
    if (last.kind === 'timer') (last.cfg.mode === 'Just Train' ? onJustTrain : onFightFocus)?.(d);
    else if (last.kind === 'combo') onComboCoach?.(d);
    else if (last.kind === 'quick_mission') onQuickMission?.();
    else if (last.kind === 'fit') (programFor(last) ? onPrograms : onFitSetup)?.();
    else if (last.kind === 'cc') onCombatConditioning?.();
  };

  // A session start from a tap on Home is still a user gesture, so speech can
  // be unlocked here the same way each setup screen does before it starts.
  const primeThen = async (fn) => {
    setVoiceGender(profile?.voiceCoach || 'FEMALE');
    await primeSpeech().catch(() => {});
    fn();
  };

  // What the card shows, in priority order.
  const lastInfo = describeSession(last);
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
      title: 'Surprise Mission', parts: [surprise.focus, surprise.difficulty, `${surprise.duration} min`],
      cta: 'START', onGo: () => primeThen(() => onStartQuickMission?.(surprise)), onAdjust: onQuickMission,
    };
  } else if (lastInfo) {
    card = {
      kind: 'last', eyebrow: 'Continue', side: lastInfo.mode === 'fit' ? FIT : FIGHT,
      title: lastInfo.title, parts: [lastInfo.sub, lastInfo.diff, lastInfo.time].filter(Boolean),
      cta: 'START', onGo: () => primeThen(() => onReplayLast?.()), onAdjust: adjustLast,
    };
  } else {
    card = {
      kind: 'bout', eyebrow: !bout && suggestion?.mode === 'fit' ? "Today's pick" : "Today's bout",
      side: !bout && suggestion?.mode === 'fit' ? FIT : FIGHT,
      title: boutTitle, parts: [boutSub], cta: boutCta, onGo: handleBoutStart,
    };
  }

  // One nudge at a time, over the header — the combo flash first (it only
  // ever shows once), then the daily nudge, then the come-back reminder.
  const nudge = comboFlash
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

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: homeCSS }}/>

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 14,
        padding: '14px 16px 0', paddingBottom: 'calc(96px + env(safe-area-inset-bottom,0px))', boxSizing: 'border-box',
      }}>
        {/* Header: level, rank and streak. Profile lives on the tab bar. */}
        <header data-guide="home-level" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button type="button" onClick={onHome} aria-label="Training Mode" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}>
            <SafeImage src="/static/logo-mark.png" alt="" style={{ width: 30, height: 34, objectFit: 'contain' }}/>
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ font: "700 14px 'Chakra Petch',sans-serif", color: '#F2BE45', letterSpacing: '0.08em' }}>LV {level}</span>
              <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>{tier?.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{levelXp.toLocaleString()} / {levelNeeded.toLocaleString()} XP</span>
            </div>
            <div style={{ height: 4, background: '#1B1730', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${xpPercent}%`, height: '100%', background: '#F2BE45' }}/>
            </div>
          </div>
          <div aria-label={`${combo.combo} day streak`} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', borderRadius: 16, background: '#15110A', color: '#F2BE45', flexShrink: 0 }}>
            <span style={{ fontSize: 14 }}>🔥</span>
            <span style={{ font: "700 14px 'Chakra Petch',sans-serif" }}>{combo.combo}</span>
            {combo.guards > 0 && <span style={{ fontSize: 10, color: '#8fe8ac' }}>🛡{combo.guards}</span>}
          </div>
          <HelpButton dataGuide="help-icon" onClick={() => setHelpOpen(true)}/>
        </header>

        {/* The one thing to do. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {/* The second paused session — one of each kind can wait. */}
          {pausedAlt && (
            <div className="hm-tile" style={{
              order: 2, display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 8px 0 14px',
              borderRadius: 12, background: '#0E0B18', border: `1px solid ${sideOfScreen(pausedAlt.screen).accent}55`,
            }}>
              <span style={{ font: "600 10px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: sideOfScreen(pausedAlt.screen).accentText, flexShrink: 0 }}>Also paused</span>
              <span style={{ flex: 1, minWidth: 0, font: "700 14px 'Chakra Petch',sans-serif", color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessionLabel(pausedAlt)}</span>
              <button type="button" className="hm-quiet" onClick={onResumeAlt} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(242,190,69,0.5)', background: 'rgba(242,190,69,0.1)', color: '#F2BE45', cursor: 'pointer', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em' }}>RESUME</button>
              <button type="button" onClick={onDiscardAlt} aria-label="Discard this paused session" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={14}/></button>
            </div>
          )}
          <section data-guide="home-continue" style={{
            position: 'relative', minHeight: 176, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column',
            border: '1px solid rgba(255,255,255,0.08)', background: '#0D0A18',
          }}>
            <SafeImage src={card.side.art} alt="" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'auto', maxWidth: 'none', opacity: 0.55, filter: card.side.filter }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.72) 58%, rgba(7,6,12,0.25) 100%)' }}/>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, background: card.side.accent }}/>
            <div style={{ position: 'relative', flex: 1, boxSizing: 'border-box', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Play size={12} color="#F2BE45" fill="#F2BE45" strokeWidth={0}/>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: '#F2BE45' }}>{card.eyebrow}</span>
                <span style={{ marginLeft: 'auto', font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: card.side.accentText }}>{card.side.label}</span>
                {card.kind === 'paused' && (
                  <button type="button" onClick={onDiscardPaused} aria-label="Discard paused session" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 2, display: 'flex' }}><X size={14}/></button>
                )}
              </div>
              {/* Short titles at the design's 28px; longer picks ("Fight Focus —
                  3 Round Starter") drop a size and wrap rather than lose words.
                  Longhand, not `font`: the size changes between renders, and a
                  changing shorthand beside lineHeight makes React warn. */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <h1 style={{
                  flex: '0 1 auto', minWidth: 0,
                  margin: '2px 0 0', fontWeight: 700, fontSize: card.title.length > 18 ? 22 : 28, fontFamily: "'Chakra Petch',sans-serif", lineHeight: 1.08, color: '#fff',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>{card.title}</h1>
                {/* The design's 👻: fades in and out beside the title while a
                    ghost challenge is live, and opens it. */}
                {ghostCh && (
                  <button type="button" className="hm-ghost" data-guide="home-ghost" onClick={onOpenGhost} aria-label="Your ghost challenge" style={{
                    flexShrink: 0, background: 'none', border: 0, padding: 2, cursor: 'pointer', fontSize: 24, lineHeight: 1,
                  }}>👻</button>
                )}
              </div>
              <div style={{ fontSize: 14, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.parts.join(' · ')}</div>
              <div style={{ flexGrow: 1 }}/>
              <button type="button" className="hm-go" onClick={card.onGo} style={{
                height: 52, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
                font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.2em', boxShadow: '0 0 24px rgba(242,190,69,0.3)',
              }}><Play size={16} fill="currentColor" strokeWidth={0}/>{card.cta}</button>
            </div>
          </section>

          {/* Shown only when they'd do something different from START: a
              paused session has nothing to surprise or adjust. */}
          {card.kind !== 'paused' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
              <button type="button" className="hm-quiet" onClick={() => setSurprise(surpriseQuickMission())} style={{
                height: 40, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
              }}><Shuffle size={15}/>SURPRISE ME</button>
              {card.onAdjust && (
                <button type="button" className="hm-quiet" onClick={card.onAdjust} style={{
                  height: 40, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', cursor: 'pointer',
                  color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
                }}><SlidersHorizontal size={15}/>ADJUST</button>
              )}
            </div>
          )}
        </div>

        {/* The two modes. Silhouettes until pointed at, then the art. */}
        <div data-guide="home-modes" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, flexShrink: 0 }}>
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
                  <span style={{ flex: 1, font: "700 17px 'Chakra Petch',sans-serif", lineHeight: 1, letterSpacing: '0.04em', color: m.color }}>{m.label}</span>
                  <ChevronRight size={15} color="#E6E2F5"/>
                </div>
                <span className="msub" style={{ font: "600 7.5px 'Chakra Petch',sans-serif", lineHeight: 1.3, letterSpacing: '0.08em', color: '#D9D4EC', textTransform: 'uppercase', width: 140 }}>{m.sub}</span>
              </div>
            </button>
          ))}
        </div>

        <button type="button" className="hm-arcade" data-guide="home-arcade" onClick={() => onTrainingArcade?.()} title="Training Arcade" style={{
          position: 'relative', height: 96, flexShrink: 0, borderRadius: 14, overflow: 'hidden', padding: '0 14px', cursor: 'pointer', textAlign: 'left',
          border: '1px solid rgba(242,190,69,0.35)', background: '#0B0718', display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        }}>
          <SafeImage src="/static/revamp/arcade-banner.webp" alt="" style={{ position: 'absolute', top: 0, right: 0, height: '100%', width: 'auto', maxWidth: 'none' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0B0718 0%, rgba(11,7,24,.95) 38%, rgba(11,7,24,.55) 58%, rgba(11,7,24,0) 72%)' }}/>
          <div className="hm-scan"/>
          <span style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="hm-arcade-title" style={{ font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.42em', color: '#5FE3FF', textShadow: '0 0 8px rgba(95,227,255,.6)' }}>TRAINING</span>
            <span className="hm-arcade-title" style={{
              font: "italic 900 26px 'Orbitron',sans-serif", lineHeight: 1, letterSpacing: '0.04em',
              background: 'linear-gradient(180deg, #FFF6C8 0%, #FDE047 45%, #E0A21C 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              filter: 'drop-shadow(0 0 10px rgba(253,224,71,.35)) drop-shadow(2px 2px 0 #4C1D95)',
            }}>ARCADE</span>
            <span className="hm-arcade-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.18em', color: '#E6E2F5' }}>
              STAGES<span style={{ color: '#5FE3FF' }}>◆</span>BOSSES<span style={{ color: '#5FE3FF' }}>◆</span>XP
            </span>
          </span>
          <ChevronRight size={22} color="#F2BE45" style={{ position: 'relative' }}/>
        </button>

        <div data-guide="home-quick" style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Quick access</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {[
              { key: 'qm', label: 'QUICK MISSION', Icon: Zap, go: onQuickMission },
              { key: 'jt', label: 'JUST TRAIN', Icon: Timer, go: () => onJustTrain?.(disc) },
              { key: 'cc', label: 'COMBAT CONDITIONING', Icon: Activity, go: onCombatConditioning },
            ].map(t => (
              <button key={t.key} type="button" className="hm-tile" onClick={t.go} style={{
                height: 64, borderRadius: 14, background: '#0E0B18', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 6px', color: '#fff',
              }}>
                <t.Icon size={20} color={MUTED}/>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.2 }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nudges: one at a time, over the header, always dismissible. */}
      <div style={{ position: 'absolute', zIndex: 20, left: 16, right: 16, top: 10 }}>
        {nudge ? (
          <div role="status" style={{
            minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 8px 12px', borderRadius: 14,
            background: 'rgba(20,12,38,0.96)', border: '1px solid rgba(196,168,255,0.6)',
            boxShadow: '0 10px 30px rgba(0,0,0,.6), 0 0 18px rgba(157,108,255,.35)',
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{nudge.icon}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#E7DDF7', lineHeight: 1.3 }}>{nudge.text}</span>
            {nudge.onGo && (
              <button type="button" onClick={nudge.onGo} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F2BE45', font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', padding: 4 }}>GO</button>
            )}
            <button type="button" onClick={nudge.onClose} aria-label="Dismiss" style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, padding: 4, display: 'flex' }}><X size={14}/></button>
          </div>
        ) : (
          <ReminderCard
            compact
            onAction={(type) => {
              if (type === 'quickMission') onQuickMission?.();
              else if (type === 'fightFocus') onFightFocus?.(disc);
              else onTrain?.();
            }}
          />
        )}
      </div>

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.home} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
