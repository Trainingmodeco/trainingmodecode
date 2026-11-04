import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
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
import { qmV2Enabled } from './data/qmV2';
import ConceptFeatureCard from './shared/ConceptFeatureCard';
import { featuredEntry } from './data/concepts';

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

// The vertical budget. The stack under the tabs is one flex column of blocks
// that all size from the REAL height left on this phone (not from a device
// list): each block asks for its comfortable size and gives some back when the
// column runs short, down to a floor that still reads and still taps. The
// quiet blocks give first (the gaps, then the concept card, Build, Programs,
// Tapes and Cardio); the Quick Mission row gives last; today's mission card
// never shrinks, it sizes by its own content. Only below roughly 700px tall,
// where even the floors cannot fit, does the column scroll, and it always
// scrolls fully clear of the tab bar.
const ROW_BASIS = 'clamp(48px, 6.6dvh, 56px)'; // caps at 56 on a tall phone
const ROW_MIN = 44;
const GAP_BASIS = 'clamp(8px, 1.4dvh, 12px)';
const GAP_MIN = 6;
// The lane above the tab bar belongs to the floating BETA chip and, while a
// session is paused, the resume pill (--tm-resume-top). The stack stops above it.
const BOTTOM_LANE = 'calc(max(96px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom, 0px))';

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
.fm-ghost { position: relative; }
.fm-ghost::after { content: ''; position: absolute; inset: -8px -6px; } /* a 28px pill with a 44px tap */
.fm-hero:hover img { opacity: .85; filter: brightness(1) saturate(1.1); transform: scale(1.02); }
`;

export default function FitModeHub({
  onHome, onBack, onFightMode, onWorkoutBuilder, onQuickMission, onStartQuickMission,
  onCombatConditioning, onCardioMode, onGhostMode, onPrograms, onOpenConcept, onTapes,
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [surprise, setSurprise] = useState(null);
  const [profile] = useState(() => loadProfile());
  const [stats] = useState(() => loadStats());
  // "GHOST ACTIVE" is a claim that a ghost is waiting, so it only shows when
  // there is a recorded run to race. With none, Cardio Mode's own ghost
  // picker is where you'd start one anyway.
  const [hasGhost] = useState(() => hasAnyRunGhost());
  // Quick Mission v2 (owner-only until it ships): read once per mount.
  const v2 = useState(() => qmV2Enabled())[0];

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
  const line = mission ? quickMissionLine(mission, { v2 }) : (pick?.subtitle || '');

  const startPick = () => {
    if (mission) onStartQuickMission?.(mission);
    else if (pick?.actionType === 'fitSetup') onWorkoutBuilder?.();
    else if (pick?.actionType === 'combatConditioning') onCombatConditioning?.();
    else onQuickMission?.();
  };

  const ROWS = [
    { n: '01', key: 'quick', title: 'Quick Mission', sub: v2 ? 'Short notice · any gear · any room' : 'Ready-made workout', onClick: onQuickMission },
    { n: '02', key: 'builder', title: 'Build Workout', sub: 'Customize everything', onClick: onWorkoutBuilder },
    { n: '03', key: 'programs', title: 'Programs', sub: 'Follow a plan', onClick: onPrograms },
    // Coach's Tapes — only passed in while the shelf is owner-only (data/tapes).
    { n: '04', key: 'tapes', title: "Coach's Tapes", sub: 'Follow along · on YouTube', onClick: onTapes, badge: 'NEW' },
  ].filter(r => r.onClick);

  // Concept drop on? The card renders nothing when none is featured, so the
  // gap that would sit beside it and the guide's last step both go with it.
  const [hasConcept] = useState(() => !!featuredEntry());
  const guideSteps = useMemo(
    () => SCREEN_GUIDES[v2 ? 'fit_hub_v2' : 'fit_hub'].filter(st => hasConcept || st.target !== 'fit-concept'),
    [v2, hasConcept],
  );

  // One gap between every block on the hub, so the stack reads evenly. A gap is
  // a flex item that gives back first when the column runs short.
  const gap = (k) => <div key={k} aria-hidden="true" style={{ flex: `0 4 ${GAP_BASIS}`, minHeight: GAP_MIN }}/>;
  const row = (r) => (
    <button
      key={r.key} type="button" className="fm-row" data-guide={'fit-' + r.key} onClick={r.onClick}
      style={{
        // Quick Mission is the priority row: it shrinks a fraction as fast.
        flex: `0 ${r.key === 'quick' ? 0.4 : 1} ${ROW_BASIS}`, minHeight: ROW_MIN, boxSizing: 'border-box',
        borderRadius: 14, background: '#0E0B18', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', cursor: 'pointer',
        textAlign: 'left', width: '100%', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ font: "600 13px 'Chakra Petch',sans-serif", color: '#8E88A8', width: 20 }}>{r.n}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', color: '#fff' }}>{r.title}</span>
        <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</span>
      </span>
      {r.badge && <span style={{ padding: '2px 7px', borderRadius: 99, background: '#F2BE45', color: '#1a1204', font: "700 9.5px 'Chakra Petch',sans-serif", letterSpacing: '0.14em' }}>{r.badge}</span>}
      <ChevronRight size={18} color="#8E88A8"/>
    </button>
  );

  // When even the floors cannot fit (about 700px tall and under) the stack
  // scrolls. A fade on its lower edge says there is more; it goes at the end.
  const stackRef = useRef(null);
  const heroRef = useRef(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = stackRef.current;
    if (!el) return undefined;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 6);
    check();
    el.addEventListener('scroll', check, { passive: true });
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(check);
      ro.observe(el);
      if (heroRef.current) ro.observe(heroRef.current); // a wrapped title grows the card
    }
    return () => { el.removeEventListener('scroll', check); ro?.disconnect(); };
  }, [surprise, hasGhost, hasConcept]);

  // The guide's spotlight sits on the real element; on a short phone that
  // element may be under the fade, so bring it into the column first.
  const onGuideStep = (_i, st) => {
    if (!st?.target) return;
    requestAnimationFrame(() => {
      try { document.querySelector(`[data-guide="${st.target}"]`)?.scrollIntoView({ block: 'nearest' }); } catch { /* noop */ }
    });
  };

  const fade = more ? 'linear-gradient(to bottom, #000 calc(100% - 28px), transparent)' : 'none';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: hubCSS }}/>
      <Embers count={3}/>
      {/* Exactly one screen tall: header, tabs, then the stack, which is the
          only thing that can scroll. The lane at the bottom stays clear. */}
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: '100dvh', boxSizing: 'border-box', overflow: 'hidden',
        paddingBottom: BOTTOM_LANE,
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

        <div ref={stackRef} className="no-scrollbar" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column',
          padding: '0 16px 4px', WebkitMaskImage: fade, maskImage: fade,
        }}>
          <div aria-hidden="true" style={{ flex: '0 4 clamp(8px, 2dvh, 16px)', minHeight: GAP_MIN }}/>

          {/* Today's mission — the one thing on this screen with a gold button.
              It sizes by its own content (label row, title, detail + START), so
              a long title or the GHOST ACTIVE badge makes it taller instead of
              cutting the title. The minimum is the look on a tall phone. */}
          <section ref={heroRef} className="fm-hero" data-guide="fit-today" style={{
            position: 'relative', flexShrink: 0, display: 'flex', flexDirection: 'column',
            minHeight: 'clamp(112px, 15.5dvh, 134px)', borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)', background: '#0D0A18',
          }}>
            {/* Real art, not the page background: with app-bg here the card
                read as empty, which beta called "the banner is missing". */}
            <SafeImage src="/static/fitmode/banner-gym-mission.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% 50%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.8) 52%, rgba(7,6,12,0.18) 100%)' }}/>
            <div style={{ position: 'relative', flex: '1 0 auto', boxSizing: 'border-box', padding: '8px 14px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Today&apos;s mission</span>
                {/* Ghost is a state of today's mission now, not a separate row
                    below it — it only shows when a ghost is actually waiting. */}
                {onGhostMode && hasGhost && (
                  <button type="button" className="fm-ghost" onClick={onGhostMode} style={{
                    height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 0 6px',
                    borderRadius: 14, cursor: 'pointer', background: 'rgba(157,108,255,0.22)',
                    border: '1px solid rgba(196,168,255,0.6)', color: '#D2BCFF',
                    font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
                  }}>
                    <span style={{ fontSize: 15, lineHeight: 1, letterSpacing: 0 }}>👻</span>GHOST ACTIVE
                  </button>
                )}
              </div>
              {/* Never shrinks, and the box ends a hair below the last line so a
                  descender is not sliced; two lines at most, then an ellipsis. */}
              <h1 style={{ margin: 0, flexShrink: 0, paddingBottom: 2, font: "700 19px 'Chakra Petch',sans-serif", lineHeight: 1.12, color: '#fff', textWrap: 'balance', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</h1>
              {/* The detail line and a compact START share the bottom row, so the
                  card stays short now that the drop card sits below it. */}
              <div style={{ marginTop: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: MUTED, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{line}</div>
                <button type="button" className="fm-go" onClick={startPick} style={{
                  height: 44, padding: '0 18px', borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
                  font: "700 14px 'Chakra Petch',sans-serif", letterSpacing: '0.18em',
                  boxShadow: '0 0 22px rgba(242,190,69,0.35), inset 0 1px 0 rgba(255,255,255,0.6)',
                }}><Play size={14} fill="currentColor" strokeWidth={0}/>START</button>
              </div>
            </div>
          </section>

          {/* SURPRISE ME at the far left, ADJUST at the far right — the design
              parks them at the card's corners, not side by side in the middle.
              The row is 32 tall in the flow; the buttons are 44 tall and reach
              6px over each side of it, so the taps are full size for free. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginTop: 2, marginBottom: -6, height: 32, flexShrink: 0 }}>
            <button type="button" className="fm-quiet" onClick={() => setSurprise(surpriseQuickMission())} style={{
              height: 44, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
              cursor: 'pointer', color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
            }}><Shuffle size={15}/>SURPRISE ME</button>
            <button type="button" className="fm-quiet" onClick={onQuickMission} style={{
              height: 44, display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none',
              cursor: 'pointer', color: MUTED, font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em',
            }}><SlidersHorizontal size={15}/>ADJUST</button>
          </div>

          {hasConcept && (
            <>
              {gap('g-concept')}
              <ConceptFeatureCard mode="fit" onOpen={onOpenConcept} style={{ flex: '0 2 88px', height: 'auto', minHeight: 76 }}/>
            </>
          )}

          {ROWS.map(r => <Fragment key={r.key}>{gap('g-' + r.key)}{row(r)}</Fragment>)}

          {gap('g-cardio')}
          <button type="button" className="fm-row" data-guide="fit-cardio" onClick={onCardioMode} style={{
            flex: `0 1 ${ROW_BASIS}`, minHeight: ROW_MIN, boxSizing: 'border-box', borderRadius: 14, background: '#0E0B18',
            border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 14,
            padding: '0 8px 0 16px', cursor: 'pointer', textAlign: 'left', width: '100%',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <Heart size={20} color={VIOLET}/>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', color: '#fff' }}>Cardio</span>
              {/* Machine, not Cycle — the indoor option covers bike, rower and
                  elliptical, and "Cycle" undersold it. */}
              <span style={{ display: 'block', fontSize: 14, color: MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Run · Jog · Machine · GPS</span>
            </span>
            <span style={{ padding: '0 4px 0 8px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, color: VIOLET, font: "700 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em' }}>
              <Play size={13} fill="currentColor" strokeWidth={0}/>START
            </span>
          </button>
        </div>
      </div>

      {helpOpen && <ScreenGuide steps={guideSteps} onStep={onGuideStep} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
