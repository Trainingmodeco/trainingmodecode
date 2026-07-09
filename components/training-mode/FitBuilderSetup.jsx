import { useState } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import SafeImage from './SafeImage';
import Embers from './Embers';
import { Dumbbell, HeartPulse } from 'lucide-react';
import { C } from './Styles';
import CardioFinisherSetup from './CardioFinisherSetup';

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders',
  'Biceps', 'Triceps', 'Core',
  'Quads', 'Hamstrings', 'Glutes',
];

const EQUIPMENT = ['Weighted', 'Bodyweight', 'Hybrid'];
const DIFFICULTIES = ['Easy', 'Normal', 'Hard'];
const FOCUS_OPTIONS = ['Strength', 'Hypertrophy', 'Endurance', 'Hybrid', 'Cardio Only'];
const DURATIONS = [15, 20, 25, 30, 40, 50, 60];

const GOLD = C.gold;

const BODY_MAP_IMAGES = {
  front: '/static/bodymap/male-front.webp',
  back: '/static/bodymap/male-back.webp',
};

const REGION_TO_CHIP = {
  chest: 'Chest',
  shoulders_front: 'Shoulders',
  shoulders_back: 'Shoulders',
  biceps: 'Biceps',
  triceps_front: 'Triceps',
  triceps_back: 'Triceps',
  core: 'Core',
  upper_back: 'Back',
  lower_back: 'Back',
  quads: 'Quads',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
};

const FRONT_HOTSPOTS = [
  { id: 'shoulders_front', label: 'Shoulders', top: '18%', left: '10%', width: '80%', height: '8%' },
  { id: 'chest', label: 'Chest', top: '26%', left: '22%', width: '56%', height: '12%' },
  { id: 'biceps', label: 'Biceps', top: '30%', left: '5%', width: '18%', height: '14%' },
  { id: 'biceps_r', label: 'Biceps', top: '30%', left: '77%', width: '18%', height: '14%', maps: 'Biceps' },
  { id: 'core', label: 'Core', top: '38%', left: '28%', width: '44%', height: '16%' },
  { id: 'quads', label: 'Quads', top: '56%', left: '20%', width: '60%', height: '18%' },
];

const BACK_HOTSPOTS = [
  { id: 'shoulders_back', label: 'Shoulders', top: '18%', left: '10%', width: '80%', height: '8%' },
  { id: 'upper_back', label: 'Back', top: '26%', left: '22%', width: '56%', height: '10%' },
  { id: 'lower_back', label: 'Back', top: '36%', left: '26%', width: '48%', height: '10%' },
  { id: 'triceps_back', label: 'Triceps', top: '28%', left: '5%', width: '18%', height: '14%' },
  { id: 'triceps_back_r', label: 'Triceps', top: '28%', left: '77%', width: '18%', height: '14%', maps: 'Triceps' },
  { id: 'glutes', label: 'Glutes', top: '46%', left: '25%', width: '50%', height: '10%' },
  { id: 'hamstrings', label: 'Hamstrings', top: '56%', left: '20%', width: '60%', height: '18%' },
];

const FRONT_GLOWS = {
  Shoulders: [{ cx: '30%', cy: '22%', rx: '6%', ry: '4%' }, { cx: '70%', cy: '22%', rx: '6%', ry: '4%' }],
  Chest: [{ cx: '39%', cy: '30%', rx: '7%', ry: '5%' }, { cx: '61%', cy: '30%', rx: '7%', ry: '5%' }],
  Biceps: [{ cx: '22%', cy: '35%', rx: '4%', ry: '6%' }, { cx: '78%', cy: '35%', rx: '4%', ry: '6%' }],
  Core: [{ cx: '50%', cy: '44%', rx: '8%', ry: '7%' }],
  Quads: [{ cx: '42%', cy: '63%', rx: '6%', ry: '9%' }, { cx: '58%', cy: '63%', rx: '6%', ry: '9%' }],
};

const BACK_GLOWS = {
  Shoulders: [{ cx: '30%', cy: '22%', rx: '6%', ry: '4%' }, { cx: '70%', cy: '22%', rx: '6%', ry: '4%' }],
  Back: [{ cx: '40%', cy: '30%', rx: '7%', ry: '5%' }, { cx: '60%', cy: '30%', rx: '7%', ry: '5%' }, { cx: '50%', cy: '40%', rx: '8%', ry: '4%' }],
  Triceps: [{ cx: '22%', cy: '35%', rx: '4%', ry: '6%' }, { cx: '78%', cy: '35%', rx: '4%', ry: '6%' }],
  Glutes: [{ cx: '42%', cy: '52%', rx: '6%', ry: '4%' }, { cx: '58%', cy: '52%', rx: '6%', ry: '4%' }],
  Hamstrings: [{ cx: '42%', cy: '65%', rx: '6%', ry: '9%' }, { cx: '58%', cy: '65%', rx: '6%', ry: '9%' }],
};

function getChipForRegion(regionId) {
  if (REGION_TO_CHIP[regionId]) return REGION_TO_CHIP[regionId];
  const hotspot = [...FRONT_HOTSPOTS, ...BACK_HOTSPOTS].find(h => h.id === regionId);
  return hotspot?.maps || hotspot?.label || null;
}

const setupCSS = `
@keyframes glowPulse { 0%,100%{opacity:0.85} 50%{opacity:1} }
.fit-pill { transition: all 0.2s ease; cursor: pointer; }
.fit-pill:hover { filter: brightness(1.15); }
.fit-chip { transition: all 0.2s ease; cursor: pointer; }
.fit-chip:hover { filter: brightness(1.1); transform: scale(1.03); }
.fit-seg { transition: all 0.2s ease; cursor: pointer; }
.fit-seg:hover { filter: brightness(1.1); }
.fit-cta { transition: all 0.2s ease; }
.fit-cta:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.1); }
.fit-cta:active:not(:disabled) { transform: scale(0.97); }
`;

function BodyMapPanel({ view, imageSrc, hotspots, glows, selectedGroups, onToggle }) {
  const [hoveredChip, setHoveredChip] = useState(null);
  const highlightColor = '#a855f7';

  const activeGlows = Object.entries(glows)
    .filter(([chip]) => selectedGroups.includes(chip))
    .flatMap(([, markers]) => markers.map(m => ({ ...m, selected: true })));

  const hoverGlows = hoveredChip && !selectedGroups.includes(hoveredChip)
    ? (glows[hoveredChip] || []).map(m => ({ ...m, selected: false }))
    : [];

  const allGlows = [...activeGlows, ...hoverGlows];

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <SafeImage
        src={imageSrc}
        alt={`Body ${view}`}
        loading="lazy"
        decoding="async"
        style={{
          width: '100%', height: 'auto', display: 'block',
          borderRadius: 8, opacity: 0.93,
          filter: 'brightness(0.95) contrast(1.08)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {allGlows.map((g, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `calc(${g.cx} - ${g.rx})`,
            top: `calc(${g.cy} - ${g.ry})`,
            width: `calc(${g.rx} * 2)`,
            height: `calc(${g.ry} * 2)`,
            borderRadius: '50%',
            background: g.selected
              ? `radial-gradient(ellipse at center, ${highlightColor}bb 0%, ${highlightColor}66 40%, ${highlightColor}22 65%, transparent 85%)`
              : `radial-gradient(ellipse at center, ${highlightColor}44 0%, ${highlightColor}18 50%, transparent 80%)`,
            boxShadow: g.selected ? `0 0 8px ${highlightColor}55` : 'none',
            opacity: g.selected ? 0.9 : 0.45,
            mixBlendMode: 'screen',
            animation: g.selected ? 'glowPulse 2.4s ease-in-out infinite' : 'none',
          }}/>
        ))}
      </div>
      <div style={{ position: 'absolute', inset: 0 }}>
        {hotspots.map(h => {
          const chip = getChipForRegion(h.id);
          return (
            <button
              key={h.id}
              onClick={() => chip && onToggle(chip)}
              onMouseEnter={() => chip && setHoveredChip(chip)}
              onMouseLeave={() => setHoveredChip(null)}
              aria-label={chip || h.id}
              style={{
                position: 'absolute',
                top: h.top, left: h.left, width: h.width, height: h.height,
                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function FitBuilderSetup({ onBack, onGenerate, onCardioOnly, profileSex }) {
  const [groups, setGroups] = useState([]);
  const [equipment, setEquipment] = useState('Bodyweight');
  const [difficulty, setDifficulty] = useState('Normal');
  const [focus, setFocus] = useState('Strength');
  const [duration, setDuration] = useState(30);
  const [maxMsg, setMaxMsg] = useState(false);
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [bodyView, setBodyView] = useState('front');

  const cardioOnly = focus === 'Cardio Only';

  const toggleGroup = (g) => {
    if (groups.includes(g)) {
      setGroups(prev => prev.filter(x => x !== g));
    } else if (groups.length < 4) {
      setGroups(prev => [...prev, g]);
    } else {
      setMaxMsg(true);
      setTimeout(() => setMaxMsg(false), 2000);
    }
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={2}/>

      <TrainingHeader
        title="WORKOUT BUILDER"
        subtitle="Build your custom session"
        onHome={onBack}
        showBack
        onBack={onBack}
      />

      <div style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column',
        padding: '14px 14px 0',
        paddingBottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
        overflowX: 'hidden',
      }}>

        {/* === FOCUS PILLS === */}
        <SectionLabel>FOCUS</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {FOCUS_OPTIONS.map(f => {
            const active = f === focus;
            return (
              <button key={f} className="fit-pill" onClick={() => setFocus(f)} style={{
                padding: '8px 14px', borderRadius: 20,
                fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                letterSpacing: '0.06em',
                background: active ? 'rgba(253,224,71,0.18)' : 'rgba(10,0,20,0.6)',
                border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.08)',
                color: active ? GOLD : C.faint,
                boxShadow: active ? '0 0 10px rgba(253,224,71,0.25)' : 'none',
              }}>
                {f.toUpperCase()}
              </button>
            );
          })}
        </div>

        {cardioOnly ? (
          <div style={{
            background: C.cardBg, borderRadius: 12, padding: '22px 18px',
            border: `1px solid ${C.cardBorder}`, textAlign: 'center',
          }}>
            <HeartPulse size={30} color={C.violet} style={{ margin: '0 auto 10px', display: 'block' }}/>
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, color: '#fff', fontSize: 15, letterSpacing: '0.08em', marginBottom: 6 }}>
              CARDIO ONLY
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 18 }}>
              Skip strength and go straight to a timed cardio session.
            </div>
            <button className="fit-cta" onClick={() => onCardioOnly?.()} style={{
              width: '100%', padding: '14px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${C.violet}, #7c3aed)`,
              color: '#fff', fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: '0.14em',
              boxShadow: '0 0 20px rgba(168,85,247,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <HeartPulse size={16}/> START CARDIO
            </button>
          </div>
        ) : (
        <>
          {/* === MUSCLE TARGETING === */}
          <SectionLabel extra={
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontSize: 9, fontWeight: 700, color: C.faint,
              padding: '2px 8px', borderRadius: 4,
              background: 'rgba(253,224,71,0.06)', border: '1px solid rgba(253,224,71,0.15)',
            }}>{groups.length}/4</span>
          }>MUSCLE GROUPS</SectionLabel>

          {/* Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {MUSCLE_GROUPS.map(g => {
              const active = groups.includes(g);
              return (
                <button key={g} className="fit-chip" onClick={() => toggleGroup(g)} style={{
                  padding: '7px 12px', borderRadius: 8,
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9,
                  letterSpacing: '0.04em',
                  background: active ? 'rgba(168,85,247,0.15)' : 'rgba(10,0,20,0.6)',
                  border: active ? `1.5px solid ${C.violet}` : '1.5px solid rgba(168,85,247,0.12)',
                  color: active ? C.violet : C.faint,
                  boxShadow: active ? '0 0 10px rgba(168,85,247,0.3)' : 'none',
                }}>
                  {g.toUpperCase()}
                </button>
              );
            })}
          </div>
          {maxMsg && (
            <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 8, color: C.red, textAlign: 'center', marginBottom: 6 }}>
              Max 4 muscle groups selected.
            </div>
          )}

          {/* Body Map with front/back toggle */}
          <div style={{
            borderRadius: 12, overflow: 'hidden', marginBottom: 16,
            background: 'rgba(8,2,18,0.7)', border: `1px solid ${C.cardBorder}`,
            padding: '10px 10px 6px',
          }}>
            {/* Toggle */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
              {['front', 'back'].map(v => (
                <button key={v} onClick={() => setBodyView(v)} style={{
                  padding: '5px 16px', borderRadius: 6, cursor: 'pointer',
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 9, letterSpacing: '0.08em',
                  background: bodyView === v ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color: bodyView === v ? C.violet : C.faint,
                  border: bodyView === v ? `1px solid ${C.violet}` : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ maxWidth: 200, margin: '0 auto' }}>
              <BodyMapPanel
                view={bodyView}
                imageSrc={BODY_MAP_IMAGES[bodyView]}
                hotspots={bodyView === 'front' ? FRONT_HOTSPOTS : BACK_HOTSPOTS}
                glows={bodyView === 'front' ? FRONT_GLOWS : BACK_GLOWS}
                selectedGroups={groups}
                onToggle={toggleGroup}
              />
            </div>
          </div>

          {/* === DIFFICULTY === */}
          <SectionLabel>DIFFICULTY</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {DIFFICULTIES.map(d => {
              const active = d === difficulty;
              return (
                <button key={d} className="fit-seg" onClick={() => setDifficulty(d)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                  letterSpacing: '0.06em', textAlign: 'center',
                  background: active ? 'rgba(253,224,71,0.14)' : 'rgba(10,0,20,0.6)',
                  border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                  color: active ? GOLD : C.faint,
                  boxShadow: active ? '0 0 8px rgba(253,224,71,0.2)' : 'none',
                }}>
                  {d.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* === EQUIPMENT === */}
          <SectionLabel>EQUIPMENT</SectionLabel>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {EQUIPMENT.map(e => {
              const active = e === equipment;
              return (
                <button key={e} className="fit-seg" onClick={() => setEquipment(e)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8,
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 10,
                  letterSpacing: '0.06em', textAlign: 'center',
                  background: active ? 'rgba(253,224,71,0.14)' : 'rgba(10,0,20,0.6)',
                  border: active ? `1.5px solid ${GOLD}` : '1.5px solid rgba(255,255,255,0.06)',
                  color: active ? GOLD : C.faint,
                  boxShadow: active ? '0 0 8px rgba(253,224,71,0.2)' : 'none',
                }}>
                  {e.toUpperCase()}
                </button>
              );
            })}
          </div>

          {/* === DURATION SLIDER === */}
          <SectionLabel>{duration} MIN</SectionLabel>
          <div style={{ marginBottom: 16 }}>
            <input
              type="range"
              min={0}
              max={DURATIONS.length - 1}
              value={DURATIONS.indexOf(duration)}
              onChange={(e) => setDuration(DURATIONS[Number(e.target.value)])}
              style={{ width: '100%', accentColor: GOLD }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {DURATIONS.map(d => (
                <span key={d} style={{
                  fontFamily: "'Rajdhani',sans-serif", fontSize: 9, fontWeight: 600,
                  color: d === duration ? GOLD : C.faint,
                }}>{d}</span>
              ))}
            </div>
          </div>

          {/* === ADD CARDIO BANNER === */}
          <div
            onClick={() => setCardioSheetOpen(true)}
            style={{
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              background: cardioAddon
                ? 'rgba(255,138,74,0.12)'
                : 'rgba(255,138,74,0.06)',
              border: `1px solid ${cardioAddon ? 'rgba(255,138,74,0.5)' : 'rgba(255,138,74,0.25)'}`,
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{ fontSize: 18 }}>&#127939;</span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10,
                color: C.cardio, letterSpacing: '0.06em',
              }}>
                {cardioAddon ? 'CARDIO FINISHER ADDED' : 'ADD CARDIO FINISHER'}
              </div>
              <div style={{
                fontFamily: "'Rajdhani',sans-serif", fontSize: 10, color: C.faint, marginTop: 1,
              }}>
                {cardioAddon ? `${cardioAddon.method} \u00B7 ${cardioAddon.duration || cardioAddon.intervals || ''}` : 'Tap to configure'}
              </div>
            </div>
            {cardioAddon && (
              <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 6, padding: '4px 8px', cursor: 'pointer',
                fontFamily: "'Orbitron',sans-serif", fontSize: 7, fontWeight: 700, color: C.red,
              }}>REMOVE</button>
            )}
          </div>

          {/* === GENERATE CTA === */}
          <button
            className="fit-cta"
            onClick={() => groups.length > 0 && onGenerate({ muscleGroups: groups, equipment, difficulty, focus, duration, cardioAddon, addCardio: false })}
            disabled={groups.length === 0}
            style={{
              width: '100%', padding: '15px 0', borderRadius: 12, border: 'none',
              background: groups.length > 0
                ? `linear-gradient(135deg, ${GOLD}, #f59e0b)`
                : 'rgba(253,224,71,0.08)',
              color: groups.length > 0 ? '#0a0014' : 'rgba(253,224,71,0.3)',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: '0.14em',
              boxShadow: groups.length > 0 ? '0 0 24px rgba(253,224,71,0.45)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              cursor: groups.length > 0 ? 'pointer' : 'not-allowed',
            }}
          >
            <Dumbbell size={17}/>
            GENERATE WORKOUT
          </button>
        </>
        )}
      </div>

      {cardioSheetOpen && (
        <CardioFinisherSetup
          initialAddon={cardioAddon}
          sourceMode="Workout Builder"
          onSave={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
    </PhoneFrame>
  );
}

function SectionLabel({ children, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <div style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: GOLD,
        fontSize: 9, letterSpacing: '0.15em',
      }}>{children}</div>
      {extra}
    </div>
  );
}
