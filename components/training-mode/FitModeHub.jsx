import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { ChevronLeft, ChevronRight, Home, Shuffle, SlidersHorizontal, Heart, Play } from 'lucide-react';
import { loadProfile } from './data/userProfile';
import { loadStats } from './data/userStats';
import { getFitMiniSuggestion } from './data/recommendations';
import { quickMissionConfig, surpriseQuickMission, quickMissionLine } from './data/quickMissionConfig';
import { hasAnyRunGhost } from './data/runGhosts';

// Fit Mode — the Simplify revamp layout.
//
// The old screen was four art banners of equal weight and a sentence telling
// you to tap one. Nothing on it said what to do today, so every visit started
// with the same decision. This one leads with the mission the app already
// picks for you and puts one gold START on it; the three ways to make your own
// workout sit underneath as a numbered list, quiet on purpose.
//
// Workout Codex is gone. It had been a dimmed "COMING SOON" tile since launch
// and appears nowhere in the revamp.
const GOLD = '#F2BE45';
const VIOLET = '#C4A8FF';
const MUTED = '#A9A3C4';

const hubCSS = `
.fm-row { transition: border-color .18s ease, box-shadow .18s ease, background .18s ease; }
.fm-row:hover, .fm-row:focus-visible { border-color: ${GOLD} !important; box-shadow: 0 0 0 1px rgba(242,190,69,.28), 0 0 22px rgba(157,108,255,.4); }
.fm-row:active { transform: scale(0.995); }
.fm-quiet { transition: color .18s ease; }
.fm-quiet:hover, .fm-quiet:focus-visible { color: #FFFFFF; }
.fm-go { transition: filter .18s ease, box-shadow .18s ease, transform .1s ease; }
.fm-go:hover, .fm-go:focus-visible { filter: brightness(1.1); box-shadow: 0 0 30px rgba(242,190,69,.55); }
.fm-go:active { transform: scale(0.985); }
.fm-hero img { opacity: .62; filter: brightness(.85); transition: opacity .25s ease, filter .25s ease, transform .3s ease; }
.fm-hero:hover img { opacity: .85; filter: brightness(1) saturate(1.1); transform: scale(1.02); }
`;

export default function FitModeHub({
  onHome, onBack, onFightMode, onWorkoutBuilder, onQuickMission, onStartQuickMission,
  onCombatConditioning, onCardioMode, onGhostMode, onPrograms,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [surprise, setSurprise] = useState(null);
  const [profile] = useState(() => loadProfile());
  const [stats] = useState(() => loadStats());
  // "GHOST ACTIVE" is a claim that a ghost is waiting, so it only shows when
  // there is a recorded run to race. With none, Cardio Mode's own ghost
  // picker is where you'd start one anyway.
  const [hasGhost] = useState(() => hasAnyRunGhost());

  // The same engine Home uses for TODAY'S BOUT, asked for its fit-side pick.
  // Held in state so a re-render never swaps the card out from under a tap.
  const [pick] = useState(() => getFitMiniSuggestion({ profile: profile || {}, stats, dailyMission: null }));

  // What START will run. A Quick Mission pick carries its own length and
  // intensity, so the card's line and the workout it starts always match.
  // SURPRISE ME re-rolls this card in place rather than launching anything:
  // a timed session should never begin from a tap whose outcome you haven't
  // seen.
  const mission = surprise
    || (pick?.actionType === 'quickMission' ? quickMissionConfig(pick.actionPayload || {}) : null);
  const title = surprise ? 'Surprise Mission' : (pick?.title || 'Quick Mission');
  const line = mission ? quickMissionLine(mission) : (pick?.subtitle || '');

  const startPick = () => {
    if (mission) onStartQuickMission?.(mission);
    else if (pick?.actionType === 'fitSetup') onWorkoutBuilder?.();
    else if (pick?.actionType === 'combatConditioning') onCombatConditioning?.();
    else onQuickMission?.();
  };

  const ROWS = [
    { n: '01', key: 'quick', title: 'Quick Mission', sub: 'Ready-made workout', onClick: onQuickMission },
    { n: '02', key: 'builder', title: 'Build Workout', sub: 'Customize everything', onClick: onWorkoutBuilder },
    { n: '03', key: 'programs', title: 'Programs', sub: 'Follow a plan', onClick: onPrograms },
  ].filter(r => r.onClick);

  const row = (r) => (
    <button
      key={r.key} type="button" className="fm-row" data-guide={'fit-' + r.key} onClick={r.onClick}
      style={{
        height: 60, borderRadius: 14, background: '#0E0B18', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', cursor: 'pointer',
        textAlign: 'left', width: '100%', flexShrink: 0, WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ font: "600 13px 'Chakra Petch',sans-serif", color: '#8E88A8', width: 20 }}>{r.n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', color: '#fff' }}>{r.title}</span>
        <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2 }}>{r.sub}</span>
      </span>
      <ChevronRight size={18} color="#8E88A8"/>
    </button>
  );

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>
      <Embers count={3}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: '100dvh', boxSizing: 'border-box', overflow: 'hidden',
        paddingBottom: 'calc(96px + env(safe-area-inset-bottom,0px))',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 12px', flexShrink: 0 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={22}/></button>
          <div style={{ flex: 1 }}><SafeImage src="/static/title-fit.png" alt="Fit Mode" style={{ height: 30, width: 'auto', maxWidth: '100%', display: 'block' }}/></div>
          <HelpButton dataGuide="help-icon" onClick={() => setHelpOpen(true)}/>
          <button onClick={onHome} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={18}/></button>
        </div>

        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px 16px 0' }}>

          {/* Today's mission — the one thing on this screen with a gold button. */}
          <section className="fm-hero" data-guide="fit-today" style={{
            position: 'relative', height: 224, flexShrink: 0, borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)', background: '#0D0A18',
          }}>
            {/* Real art, not the page background: with app-bg here the card
                read as empty, which beta called "the banner is missing". */}
            <SafeImage src="/static/fitmode/banner-gym-mission.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% 50%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.8) 52%, rgba(7,6,12,0.18) 100%)' }}/>
            <div style={{ position: 'relative', height: '100%', boxSizing: 'border-box', padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Today&apos;s mission</span>
                {/* Ghost is a state of today's mission now, not a separate row
                    below it — it only shows when a ghost is actually waiting. */}
                {onGhostMode && hasGhost && (
                  <button type="button" onClick={onGhostMode} style={{
                    height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 6px',
                    borderRadius: 14, cursor: 'pointer', background: 'rgba(157,108,255,0.22)',
                    border: '1px solid rgba(196,168,255,0.6)', color: '#D2BCFF',
                    font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
                  }}>
                    <span style={{ fontSize: 15, lineHeight: 1, letterSpacing: 0 }}>👻</span>GHOST ACTIVE
                  </button>
                )}
              </div>
              <h1 style={{ margin: 0, font: "700 26px 'Chakra Petch',sans-serif", lineHeight: 1.05, maxWidth: 270, color: '#fff' }}>{title}</h1>
              <div style={{ fontSize: 14, color: MUTED }}>{line}</div>
              <div style={{ flexGrow: 1 }}/>
              <button type="button" className="fm-go" onClick={startPick} style={{
                height: 52, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
                font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.2em',
                boxShadow: '0 0 28px rgba(242,190,69,0.35)',
              }}><Play size={17} fill="currentColor" strokeWidth={0}/>START</button>
            </div>
          </section>

          {/* SURPRISE ME at the far left, ADJUST at the far right — the design
              parks them at the card's corners, not side by side in the middle. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', marginTop: 4, flexShrink: 0 }}>
            <button type="button" className="fm-quiet" onClick={() => setSurprise(surpriseQuickMission())} style={{
              height: 40, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
              cursor: 'pointer', color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
            }}><Shuffle size={15}/>SURPRISE ME</button>
            <button type="button" className="fm-quiet" onClick={onQuickMission} style={{
              height: 40, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
              cursor: 'pointer', color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
            }}><SlidersHorizontal size={15}/>ADJUST</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, flexShrink: 0 }}>
            {ROWS.map(row)}
          </div>

          <button type="button" className="fm-row" data-guide="fit-cardio" onClick={onCardioMode} style={{
            marginTop: 12, height: 60, flexShrink: 0, borderRadius: 14, background: '#0E0B18',
            border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 14,
            padding: '0 8px 0 16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <Heart size={20} color={VIOLET}/>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', color: '#fff' }}>Cardio</span>
              {/* Machine, not Cycle — the indoor option covers bike, rower and
                  elliptical, and "Cycle" undersold it. */}
              <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2 }}>Run · Walk · Machine · GPS</span>
            </span>
            <span style={{ height: 44, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, color: VIOLET, font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em' }}>
              <Play size={13} fill="currentColor" strokeWidth={0}/>START
            </span>
          </button>
        </div>
      </div>

      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.fit_hub} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
