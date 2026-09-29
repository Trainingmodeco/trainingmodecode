import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import Embers from './Embers';
import SafeImage from './SafeImage';
import ModeTabs from './shared/ModeTabs';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { ChevronLeft, ChevronRight, Home, Play } from 'lucide-react';
import { PROGRAMS, programDayIndex, loadCurrentProgram, startProgramDay } from './data/workoutPrograms';
import { PLAN_PROGRAMS, planDayIndex, planDayMinutes, startPlanDay } from './data/workoutLibrary';
import { quickMissionConfig } from './data/quickMissionConfig';
import { isPro } from './data/entitlements';
import BottomSheet from './shared/BottomSheet';

// Programs — promoted from a sheet inside the Workout Builder to its own Fit
// Mode destination (row 03 on the hub).
//
// The programs themselves were always there: four splits with a rotating day
// counter. They were just three taps deep behind BUILD → PROGRAMMING, so
// "follow a plan" meant rebuilding the plan every visit. Here the plan you are
// on is the first thing you see, with one button to do its next day.
//
// The design mock shows "Week 2 of 8". Our programs rotate days within a split
// and have no week structure, so this shows what is real — which day is next
// and where it sits in the rotation — rather than inventing a calendar.
const GOLD = '#F2BE45';
const VIOLET = '#C4A8FF';
const MUTED = '#A9A3C4';

// The generator's equipment values, in the builder's own labels.
const EQUIPMENT = [
  { id: 'Bodyweight', label: 'BODYWEIGHT' },
  { id: 'Weighted', label: 'WEIGHTS' },
  { id: 'Hybrid', label: 'HYBRID' },
];
const EQUIP_KEY = 'tm_programs_equipment';
const loadEquip = () => {
  try { const v = localStorage.getItem(EQUIP_KEY); return EQUIPMENT.some(e => e.id === v) ? v : 'Weighted'; } catch { return 'Weighted'; }
};

const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase());

const css = `
.pg-row { transition: border-color .18s ease, background .18s ease; }
.pg-row:hover, .pg-row:focus-visible { background: rgba(157,108,255,.1) !important; }
.pg-seg { transition: color .18s ease, background .18s ease, box-shadow .18s ease; }
.pg-seg:not([aria-pressed="true"]):hover { color: #fff; background: rgba(157,108,255,.14); }
.pg-go { transition: filter .18s ease, box-shadow .18s ease, transform .1s ease; }
.pg-go:hover, .pg-go:focus-visible { filter: brightness(1.1); box-shadow: 0 0 30px rgba(242,190,69,.55); }
.pg-go:active { transform: scale(0.985); }
.pg-more { transition: border-color .18s, color .18s, background .18s; }
.pg-more:hover, .pg-more:focus-visible { border-color: #F2BE45 !important; color: #F2BE45 !important; background: rgba(157,108,255,.08) !important; }
.pg-plan { transition: border-color .18s, background .18s; }
.pg-plan:hover, .pg-plan:focus-visible { border-color: #F2BE45 !important; background: rgba(157,108,255,.1) !important; }
.pg-hero img { opacity: .55; filter: brightness(.85); transition: opacity .25s ease, filter .25s ease, transform .3s ease; }
.pg-hero:hover img { opacity: .85; filter: brightness(1) saturate(1.1); transform: scale(1.02); }
`;

export default function ProgramsScreen({ onBack, onHome, onFightMode, onStart, onStartMission, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreCat, setMoreCat] = useState('fit');

  // A plan day runs on the Quick Mission timer (fixed moves, voice calls).
  // Pro plans are only locked once the paywall is on.
  const startPlan = (p) => {
    if (p.pro && !isPro()) { setMoreOpen(false); onPaywall?.(); return; }
    const mission = startPlanDay(p);
    setMoreOpen(false);
    onStartMission?.({ ...quickMissionConfig({ duration: mission.duration, focus: mission.focus, difficulty: 'Hard' }), workoutType: mission.workoutType, mission });
  };
  const [equipment, setEquipment] = useState(loadEquip);
  const [current] = useState(() => loadCurrentProgram());

  const pickEquipment = (id) => {
    setEquipment(id);
    try { localStorage.setItem(EQUIP_KEY, id); } catch { /* best-effort */ }
  };

  const start = (p) => onStart?.(startProgramDay(p, { equipment }));

  // With no program yet, the card offers the simplest one instead of an empty
  // state — the point of this screen is that there is always a next workout.
  const featured = current || PROGRAMS[0];
  const idx = programDayIndex(featured);
  const day = featured.days[idx];
  const isSplit = featured.days.length > 1;

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: css }}/>
      <Embers count={3}/>
      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        height: '100dvh', boxSizing: 'border-box', overflow: 'hidden',
        paddingBottom: 'calc(max(96px, var(--tm-resume-top, 0px)) + env(safe-area-inset-bottom,0px))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px 12px', flexShrink: 0 }}>
          <button onClick={onBack} aria-label="Back to Fit Mode" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 8, margin: -8 }}><ChevronLeft size={22}/></button>
          <div style={{ flex: 1, font: "700 18px 'Chakra Petch',sans-serif", letterSpacing: '0.14em', color: '#fff' }}>PROGRAMS</div>
          <HelpButton onClick={() => setHelpOpen(true)}/>
          <button onClick={onHome} aria-label="Home" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c4a4d8', display: 'flex', padding: 0 }}><Home size={18}/></button>
        </div>

        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        {/* Scrolls only when the phone is too short for the library (SE, or
            with the resume row reserved) instead of clipping MORE PROGRAMS. */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 16px 0' }}>

          {/* What the program is generated with. Programs are rep schemes over
              muscle days; the equipment decides which exercises fill them. */}
          <div role="group" aria-label="Train with" data-guide="pg-equipment" style={{
            display: 'flex', padding: 3, gap: 3, flexShrink: 0, borderRadius: 10,
            background: '#110E1C', border: '1px solid rgba(255,255,255,0.09)',
          }}>
            {EQUIPMENT.map(e => {
              const on = e.id === equipment;
              return (
                <button key={e.id} type="button" className="pg-seg" aria-pressed={on ? 'true' : 'false'} onClick={() => pickEquipment(e.id)} style={{
                  flex: 1, height: 38, border: 'none', borderRadius: 8, cursor: 'pointer',
                  font: "600 12px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
                  color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.22)' : 'transparent',
                  boxShadow: on ? 'inset 0 0 0 1px #9D6CFF' : 'none',
                }}>{e.label}</button>
              );
            })}
          </div>

          <section className="pg-hero" data-guide="pg-continue" style={{
            position: 'relative', flexShrink: 0, borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(157,108,255,0.4)', background: '#0D0A18',
            padding: 18, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* The design's continue card sits on art; ours was a flat gradient
                and read as unfinished. */}
            <SafeImage src="/static/fitmode/banner-gym-programs.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '75% 50%' }}/>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.82) 60%, rgba(7,6,12,0.3) 100%)' }}/>
            <div style={{ position: 'relative', font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }}>
              {current ? 'Continue program' : 'Start a program'}
            </div>
            <h1 style={{ position: 'relative', margin: 0, font: "700 26px 'Chakra Petch',sans-serif", lineHeight: 1.1, color: '#fff' }}>{titleCase(featured.title)}</h1>
            <div style={{ position: 'relative', fontSize: 15, color: '#DCD7EE' }}>
              {isSplit ? `Next: ${titleCase(day.label)} day` : 'Every muscle group, every session'}
            </div>
            {isSplit && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                <div style={{ flex: 1, display: 'flex', gap: 4 }}>
                  {featured.days.map((d, i) => (
                    <span key={d.label} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= idx ? GOLD : 'rgba(255,255,255,0.12)' }}/>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: MUTED }}>Day {idx + 1} of {featured.days.length}</span>
              </div>
            )}
            <button type="button" className="pg-go" onClick={() => start(featured)} style={{
              position: 'relative', height: 52, marginTop: 8, borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'linear-gradient(180deg,#FFE9A8 0%,#F2BE45 50%,#C98A1C 100%)', color: '#1A1204',
              font: "700 17px 'Chakra Petch',sans-serif", letterSpacing: '0.2em',
              boxShadow: '0 0 24px rgba(242,190,69,0.3)',
            }}><Play size={16} fill="currentColor" strokeWidth={0}/>{current ? 'RESUME' : 'START'}</button>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            <span style={{ font: "600 11px 'Chakra Petch',sans-serif", letterSpacing: '0.16em', textTransform: 'uppercase', color: MUTED }}>Program library</span>
            <div data-guide="pg-library" style={{ borderRadius: 14, background: '#110E1C', border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden' }}>
              {PROGRAMS.map((p, i) => {
                const isCurrent = current?.id === p.id;
                const next = p.days.length > 1 ? p.days[programDayIndex(p)].label : null;
                return (
                  <button key={p.id} type="button" className="pg-row" onClick={() => start(p)} style={{
                    width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: 'transparent', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#fff' }}>{titleCase(p.title)}</span>
                      <span style={{ display: 'block', fontSize: 12, color: '#8E88A8', marginTop: 2 }}>{p.meta}</span>
                    </span>
                    {(isCurrent || next) && (
                      <span style={{
                        font: "600 9.5px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', padding: '4px 7px',
                        border: `1px solid ${isCurrent ? 'rgba(242,190,69,0.5)' : 'rgba(196,168,255,0.35)'}`,
                        color: isCurrent ? GOLD : VIOLET, whiteSpace: 'nowrap',
                      }}>{isCurrent ? 'CURRENT' : `NEXT: ${next}`}</span>
                    )}
                    <ChevronRight size={18} color="#7D7799"/>
                  </button>
                );
              })}
            </div>
            {/* The owner's own plans — they don't fit the split-builder mould
                above (fixed exercises, fight days), so they open in a list. */}
            <button type="button" className="pg-more" data-guide="pg-more" onClick={() => setMoreOpen(true)} style={{
              height: 48, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'transparent', border: '1px dashed rgba(196,168,255,0.5)', color: VIOLET,
              font: "700 12px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
            }}>MORE PROGRAMS · {PLAN_PROGRAMS.length}<ChevronRight size={16}/></button>
          </div>
        </div>
      </div>

      {moreOpen && (
        <BottomSheet variant="float" title="MORE PROGRAMS" accent="#9D6CFF" onClose={() => setMoreOpen(false)} maxHeight="76dvh">
          <div role="tablist" aria-label="Program type" style={{ display: 'flex', padding: 3, gap: 3, marginBottom: 10, borderRadius: 10, background: '#110E1C', border: '1px solid rgba(255,255,255,0.09)' }}>
            {[['fit', 'FIT'], ['fight', 'FIGHT']].map(([id, label]) => {
              const on = moreCat === id;
              return (
                <button key={id} type="button" role="tab" aria-selected={on} className="pg-seg" aria-pressed={on ? 'true' : 'false'} onClick={() => setMoreCat(id)} style={{
                  flex: 1, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer',
                  font: "600 12px 'Chakra Petch',sans-serif", letterSpacing: '0.14em',
                  color: on ? '#fff' : MUTED, background: on ? (id === 'fight' ? 'rgba(61,123,255,0.28)' : 'rgba(157,108,255,0.22)') : 'transparent',
                  boxShadow: on ? `inset 0 0 0 1px ${id === 'fight' ? '#3D7BFF' : '#9D6CFF'}` : 'none',
                }}>{label} · {PLAN_PROGRAMS.filter(p => p.category === id).length}</button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PLAN_PROGRAMS.filter(p => p.category === moreCat).map(p => {
              const idx = planDayIndex(p);
              return (
                <button key={p.id} type="button" className="pg-plan" onClick={() => startPlan(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: '#110E1C', border: '1px solid rgba(255,255,255,0.09)',
                }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ minWidth: 0, font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.04em', lineHeight: 1.2, color: '#fff' }}>{p.title}</span>
                      {p.pro && <span style={{ flexShrink: 0, font: "800 8px 'Chakra Petch',sans-serif", letterSpacing: '0.1em', color: '#1A1204', background: GOLD, borderRadius: 3, padding: '2px 4px' }}>PRO</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: '#8E88A8', marginTop: 2 }}>{p.meta}</span>
                    <span style={{ display: 'block', fontSize: 12, color: VIOLET, marginTop: 2 }}>
                      Next: Day {idx + 1} · {titleCase(p.days[idx].label)} · ~{planDayMinutes(p, idx)} min
                    </span>
                  </span>
                  <Play size={16} color={GOLD} fill={GOLD} strokeWidth={0}/>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.programs} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
