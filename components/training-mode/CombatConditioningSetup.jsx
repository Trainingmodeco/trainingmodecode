import { useState, useMemo, useEffect, useRef } from 'react';
import PhoneFrame from './PhoneFrame';
import TrainingHeader from './TrainingHeader';
import { HelpButton } from './shared/WorkoutHelpPanel';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import Embers from './Embers';
import { C } from './Styles';
import { CADENCE_PRESETS } from './shared/CadenceSlider';
import { summarizeCardioAddon } from './data/cardioAddon';
import AddCardioSheet from './AddCardioSheet';
import TrainingCTA from './shared/TrainingCTA';
import WarmupRow, { loadWarmup } from './shared/WarmupRow';

const GOLD = C.gold;
const RED = '#ef4444';
const GREEN = '#2ecc71';
const YELLOW = '#e4d43a';
const ORANGE = '#ff8a2a';
const HERO_ART = '/static/hub/combat-hero.webp';

const STYLES = [
  { id: 'Boxing', label: 'BOXING' },
  { id: 'Kickboxing / Muay Thai', label: 'KICKBOXING / MUAY THAI' },
  { id: 'MMA', label: 'MMA' },
];

// Four circuit presets. Each carries the defaults the caller expects on
// select. focus + blend feed the generator; the rest seed the customize
// controls so they read as the tile's shape and can still be overridden.
const PRESETS = [
  {
    id: 'gas-tank',
    label: 'GAS TANK',
    focusLabel: 'Endurance',
    icon: '🔥',
    tint: '#ff5a2a',
    desc: 'Bag work + bursts. Build fight endurance.',
    defaults: { rounds: 5, workSec: 40, restSec: 15, difficulty: 'Normal', equipment: 'BAG', blend: 50 },
  },
  {
    id: 'power',
    label: 'POWER & EXPLOSION',
    focusLabel: 'Power',
    icon: '💥',
    tint: '#ff3448',
    desc: 'Plyo + strikes for knockout force.',
    defaults: { rounds: 6, workSec: 30, restSec: 30, difficulty: 'Hard', equipment: 'NONE', blend: 40 },
  },
  {
    id: 'strike-strength',
    label: 'STRIKE & STRENGTH',
    focusLabel: 'Strength',
    icon: '🥊',
    tint: '#a855f7',
    desc: 'Alternating combos + resistance.',
    defaults: { rounds: 4, workSec: 45, restSec: 20, difficulty: 'Normal', equipment: 'WEIGHTS', blend: 65 },
  },
  {
    id: 'fight-athlete',
    label: 'FIGHT ATHLETE',
    focusLabel: 'Athletic',
    icon: '🏃',
    tint: '#22d3ee',
    desc: 'Full body. High output. No limits.',
    defaults: { rounds: 8, workSec: 40, restSec: 20, difficulty: 'Hard', equipment: 'BAG', blend: 55 },
  },
];
function getPreset(id) { return PRESETS.find(p => p.id === id); }

// Intensity progresses green → red as the difficulty climbs. Only the
// selected chip wears its colour; the rest stay dark violet.
const INTENSITIES = [
  { id: 'Easy',     label: 'LOW',    color: GREEN },
  { id: 'Normal',   label: 'MED',    color: YELLOW },
  { id: 'Hard',     label: 'HIGH',   color: ORANGE },
  { id: 'Advanced', label: 'SAVAGE', color: RED },
];
function getIntensity(id) { return INTENSITIES.find(i => i.id === id) || INTENSITIES[1]; }

const EQUIPMENT = [
  { id: 'NONE', label: 'NONE' },
  { id: 'BAG', label: 'BAG' },
  { id: 'WEIGHTS', label: 'WEIGHTS' },
];
// Map the on-screen equipment choice to a generator equipment tier.
const EQUIPMENT_TIER = { NONE: 'Bodyweight', BAG: 'Bags & Combat Gear', WEIGHTS: 'Basic Gym' };

const setupCSS = `
.cc-pill { transition: all 0.2s ease; cursor: pointer; }
.cc-pill:hover { filter: brightness(1.1); }
.cc-pill:active { transform: scale(0.96); }
.cc-preset { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
.cc-preset:active { transform: scale(0.97); }
.cc-customize { overflow: hidden; transition: max-height 220ms ease, opacity 200ms ease; }
.cc-customize.closed { max-height: 0; opacity: 0; }
.cc-customize.open { max-height: 1200px; opacity: 1; }
`;

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8',
      fontSize: 8, letterSpacing: '0.16em', marginBottom: 5, ...style,
    }}>{children}</div>
  );
}

function Stepper({ label, value, unit, min, max, step, onChange }) {
  const btn = {
    width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(168,85,247,0.4)', color: RED,
    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', flexShrink: 0,
  };
  return (
    <div style={{ flex: 1 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,2,18,0.8)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 9, padding: '7px 11px' }}>
        <button className="cc-pill" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))} style={btn}>−</button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff' }}>
          {value}{unit && <span style={{ fontSize: 8, color: C.faint, marginLeft: 1 }}>{unit}</span>}
        </span>
        <button className="cc-pill" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))} style={btn}>+</button>
      </div>
    </div>
  );
}

function EquipmentSegmented({ value, onChange }) {
  return (
    <div>
      <SectionLabel>EQUIPMENT</SectionLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {EQUIPMENT.map(o => {
          const active = o.id === value;
          return (
            <button key={o.id} className="cc-pill" aria-pressed={active} onClick={() => onChange(o.id)} style={{
              flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '0.06em',
              background: active ? GOLD : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
              color: active ? '#0a0014' : '#d9d1ef',
              boxShadow: active ? '0 0 12px rgba(253,224,71,0.35)' : 'none',
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

function IntensitySegmented({ value, onChange }) {
  return (
    <div>
      <SectionLabel>INTENSITY</SectionLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {INTENSITIES.map(o => {
          const active = o.id === value;
          return (
            <button key={o.id} className="cc-pill" aria-pressed={active} onClick={() => onChange(o.id)} style={{
              flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 9, letterSpacing: '0.06em',
              background: active ? o.color : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
              color: active ? '#0a0014' : '#d9d1ef',
              boxShadow: active ? `0 0 14px ${o.color}66` : 'none',
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

function DisciplineSegmented({ value, onChange }) {
  return (
    <div>
      <SectionLabel>DISCIPLINE</SectionLabel>
      <div style={{ display: 'flex', gap: 4 }}>
        {STYLES.map(s => {
          const active = s.id === value;
          return (
            <button key={s.id} className="cc-pill" aria-pressed={active} onClick={() => onChange(s.id)} style={{
              flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 8, cursor: 'pointer',
              fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, letterSpacing: '0.04em',
              lineHeight: 1.2, minWidth: 0,
              background: active ? RED : 'rgba(16,4,30,0.8)',
              border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
              color: active ? '#fff' : '#d9d1ef',
              boxShadow: active ? '0 0 12px rgba(239,68,68,0.35)' : 'none',
            }}>{s.label}</button>
          );
        })}
      </div>
    </div>
  );
}

// The cinematic hero. The fighter art is the background and stays put — the
// workout summary above it is HTML and reads current state, so nothing about
// the picture changes when the athlete changes rounds or intensity. That is
// what §4 asks for.
function CombatHeroBanner({ preset, rounds, difficulty, durationMin, discipline }) {
  const intensity = getIntensity(difficulty);
  const showChip = !!preset;
  const summaryLine = preset
    ? `${preset.label} · ${rounds} ROUNDS · ${intensity.label}`
    : `PICK A CIRCUIT TO PROGRAM ${discipline.split(' ')[0].toUpperCase()}`;

  return (
    <div style={{
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      border: '1px solid rgba(168,85,247,0.35)',
      boxShadow: '0 6px 22px rgba(0,0,0,0.55), 0 0 24px rgba(168,85,247,0.18)',
      marginBottom: 12,
      // Aspect ratio close to the reference — tall enough to be cinematic,
      // short enough to leave presets above the fold on 375x667.
      aspectRatio: '1440 / 640',
      background: '#0a0116',
    }}>
      <img
        src={HERO_ART}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          objectPosition: 'right center',
          pointerEvents: 'none',
        }}
      />
      {/* Left-heavy dark gradient so text reads without hiding the fighter. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, rgba(6,0,18,0.92) 0%, rgba(6,0,18,0.72) 42%, rgba(6,0,18,0.15) 78%, rgba(6,0,18,0) 100%)',
      }}/>
      {/* A soft violet vignette that ties it to the app frame. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 0% 50%, rgba(168,85,247,0.14) 0%, transparent 55%)',
      }}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        height: '100%',
        padding: '11px 13px 10px',
        color: '#fff',
      }}>
        {/* Top row — HYBRID chip + live summary line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {showChip && (
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7,
              color: '#ff9a9a',
              border: '1px solid rgba(239,68,68,0.5)', borderRadius: 4,
              padding: '3px 7px', letterSpacing: '0.1em', flexShrink: 0,
              background: 'rgba(239,68,68,0.08)',
            }}>HYBRID</span>
          )}
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8.5,
            color: '#ffd7d7', letterSpacing: '0.08em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
          }}>{summaryLine}</span>
        </div>

        {/* Middle — hero name + tagline. Kept on the left half so the fighter
            stays readable on the right. */}
        <div style={{ maxWidth: '68%', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 900,
            fontSize: 'clamp(20px, 6.4vw, 30px)',
            lineHeight: 1.02, letterSpacing: '0.01em',
            color: '#fff',
            textShadow: '0 2px 14px rgba(0,0,0,0.75)',
          }}>
            CONDITION<br/>HARDER
          </div>
          <div style={{
            fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 10,
            color: '#e6dcff', letterSpacing: '0.14em',
            textShadow: '0 1px 8px rgba(0,0,0,0.85)',
          }}>
            FIT FIGHTER · STRONGER YOU.
          </div>
        </div>

        {/* Bottom — three stat cards: focus / rounds / est. time. Only their
            accent moves with intensity; the rest stays neutral. */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
        }}>
          <HeroStat
            icon={preset ? preset.icon : '🎯'}
            label={preset ? preset.label.split(' ')[0] : 'PICK ONE'}
            sub={preset ? preset.focusLabel : 'Below'}
            accent={preset ? preset.tint : C.faint}
          />
          <HeroStat
            icon="▮▮▮"
            label={`${rounds} ROUNDS`}
            sub={intensity.label}
            accent={intensity.color}
          />
          <HeroStat
            icon="⏱"
            label={`~${durationMin} MIN`}
            sub="Est. Time"
            accent={GOLD}
          />
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, sub, accent }) {
  return (
    <div style={{
      background: 'rgba(6,0,18,0.7)',
      border: `1px solid ${accent}55`,
      borderRadius: 8,
      padding: '6px 7px',
      display: 'flex', alignItems: 'center', gap: 6,
      minWidth: 0,
    }}>
      <span style={{
        color: accent,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8,
          color: '#fff', letterSpacing: '0.04em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8,
          color: '#c4a4d8', marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</div>
      </div>
    </div>
  );
}

function CircuitPresetSelector({ selected, onSelect }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
          color: '#fff', letterSpacing: '0.08em',
        }}>CIRCUIT PRESETS</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9,
          color: C.faint, letterSpacing: '0.14em', whiteSpace: 'nowrap',
        }}>PICK A WORKOUT. GET TO WORK.</div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 7,
      }}>
        {PRESETS.map(p => (
          <PresetCard key={p.id} preset={p} active={selected === p.id} onSelect={() => onSelect(p.id)} />
        ))}
      </div>
    </div>
  );
}

function PresetCard({ preset, active, onSelect }) {
  return (
    <button
      type="button"
      className="cc-preset"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        position: 'relative',
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'left',
        padding: '11px 11px 10px',
        minHeight: 118,
        background: active
          ? `linear-gradient(160deg, rgba(239,68,68,0.14) 0%, rgba(8,2,18,0.9) 70%)`
          : 'rgba(16,4,30,0.8)',
        border: active ? `1.5px solid ${RED}` : '1px solid rgba(168,85,247,0.3)',
        boxShadow: active
          ? `0 0 18px rgba(239,68,68,0.35), inset 0 0 28px rgba(239,68,68,0.08)`
          : 'inset 0 0 0 transparent',
        color: '#fff',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      {active && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: '50%',
          background: RED, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9,
          boxShadow: '0 0 10px rgba(239,68,68,0.55)',
        }}>✓</span>
      )}
      <span style={{
        fontSize: 22, lineHeight: 1,
        filter: active ? 'drop-shadow(0 0 8px rgba(239,68,68,0.55))' : 'none',
      }}>{preset.icon}</span>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
        color: active ? '#ff9a9a' : '#fff', letterSpacing: '0.03em', lineHeight: 1.15,
      }}>{preset.label}</span>
      <span style={{
        fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 10,
        color: '#a89bc8', lineHeight: 1.28, flex: 1,
      }}>{preset.desc}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 4,
        marginTop: 2,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
        color: active ? '#ff9a9a' : '#c4a4d8',
        letterSpacing: '0.14em',
      }}>
        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${active ? RED : preset.tint}`, background: 'transparent' }}/>
        {preset.defaults.rounds} ROUNDS · {preset.focusLabel.toUpperCase()}
      </span>
    </button>
  );
}

export default function CombatConditioningSetup({ onBack, onStart, onCardioOnly: _onCardioOnly, profile: _profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [style, setStyle] = useState('Boxing');
  const [difficulty, setDifficulty] = useState('Normal');
  const [rounds, setRounds] = useState(5);
  const [workSec, setWorkSec] = useState(40);
  const [restSec, setRestSec] = useState(15);
  // Nothing selected on mount — the page reads as "pick a preset first"
  // (§8) and the customize block stays folded up.
  const [focus, setFocus] = useState(null);
  const [equipment, setEquipment] = useState('NONE');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const cadencePreset = 'moderate';
  const cadenceMs = CADENCE_PRESETS.moderate;
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [warmupMin, setWarmupMin] = useState(() => loadWarmup('combatConditioning'));

  const scrollRef = useRef(null);
  // §19 — every entry into this page starts at the top, so a return trip
  // from Add Cardio or Progress does not land the user mid-form.
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, []);

  const preset = useMemo(() => getPreset(focus), [focus]);
  const hasPreset = !!preset;

  // The banner reads warm-up + work × rounds + rest × (rounds − 1) + the
  // cardio addon minutes when the athlete opts into one. This is the same
  // shape the existing session generator budgets against, so the summary
  // matches what the round timer will actually run.
  const durationMin = useMemo(() => {
    const restBetween = Math.max(0, rounds - 1) * restSec;
    const work = rounds * workSec;
    const cardioMin = cardioAddon?.enabled ? Math.max(0, Number(cardioAddon.durationMin) || 0) : 0;
    const total = warmupMin * 60 + work + restBetween + cardioMin * 60;
    return Math.max(1, Math.round(total / 60));
  }, [warmupMin, rounds, workSec, restSec, cardioAddon]);

  const handleSelectPreset = (id) => {
    setFocus(id);
    setCustomizeOpen(true);
    const d = getPreset(id)?.defaults;
    if (d) {
      setRounds(d.rounds);
      setWorkSec(d.workSec);
      setRestSec(d.restSec);
      setDifficulty(d.difficulty);
      setEquipment(d.equipment);
    }
  };

  const canStart = hasPreset;
  const handleStart = () => {
    if (!hasPreset) return;
    onStart({
      style,
      duration: durationMin,
      difficulty,
      equipment: EQUIPMENT_TIER[equipment] || 'Any',
      format: 'Auto',
      voiceOn: true,
      formPreviewOn: true,
      cadenceCount: true,
      cadencePreset,
      cadenceMs,
      cardioAddon,
      rounds,
      workSec,
      restSec,
      focus,
      blend: preset?.defaults.blend ?? 50,
      warmupMin,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={3}/>

      <TrainingHeader
        title="COMBAT CONDITIONING"
        subtitle="Fit × Fight · ring-ready circuits"
        onHome={onBack}
        showBack
        onBack={onBack}
        rightSlot={<HelpButton onClick={() => setHelpOpen(true)}/>}
      />

      <div
        ref={scrollRef}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column',
          padding: '8px 12px 0',
          paddingBottom: 'calc(30dvh + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <CombatHeroBanner
          preset={preset}
          rounds={rounds}
          difficulty={difficulty}
          durationMin={durationMin}
          discipline={style}
        />

        <div data-guide="ccs-style" style={{ marginBottom: 12 }}>
          <CircuitPresetSelector selected={focus} onSelect={handleSelectPreset}/>
        </div>

        {/* Customize header row — visible only once a preset is picked
            (§8/§9). Tap toggles the fold. */}
        {hasPreset && (
          <button
            type="button"
            onClick={() => setCustomizeOpen(v => !v)}
            aria-expanded={customizeOpen}
            aria-controls="cc-customize"
            className="cc-pill"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
              border: '1px solid rgba(168,85,247,0.3)',
              background: 'rgba(16,4,30,0.7)', borderRadius: 10,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12,
                color: '#fff', letterSpacing: '0.08em',
              }}>CUSTOMIZE</span>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9,
                color: C.faint, letterSpacing: '0.12em',
              }}>(OPTIONAL)</span>
            </span>
            <span style={{
              fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
              color: C.faint,
              transform: customizeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 200ms ease',
            }}>▼</span>
          </button>
        )}

        <div
          id="cc-customize"
          className={`cc-customize ${hasPreset && customizeOpen ? 'open' : 'closed'}`}
          aria-hidden={!(hasPreset && customizeOpen)}
        >
          <div data-guide="ccs-discipline" style={{ marginBottom: 10 }}>
            <DisciplineSegmented value={style} onChange={setStyle}/>
          </div>

          <div data-guide="ccs-config">
            <div style={{ marginBottom: 10 }}>
              <WarmupRow feature="combatConditioning" value={warmupMin} onChange={setWarmupMin}/>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <Stepper label="ROUNDS" value={rounds} min={2} max={12} step={1} onChange={setRounds}/>
              <Stepper label="WORK" value={workSec} unit="s" min={10} max={120} step={5} onChange={setWorkSec}/>
              <Stepper label="REST" value={restSec} unit="s" min={0} max={90} step={5} onChange={setRestSec}/>
            </div>
            <div style={{ marginBottom: 10 }}>
              <IntensitySegmented value={difficulty} onChange={setDifficulty}/>
            </div>
            <div style={{ marginBottom: 10 }}>
              <EquipmentSegmented value={equipment} onChange={setEquipment}/>
            </div>
          </div>
        </div>

        {/* Add cardio — visible even before a preset is chosen. */}
        <div
          onClick={() => setCardioSheetOpen(true)}
          className="cc-pill"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCardioSheetOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, padding: '10px 13px', marginBottom: 12, cursor: 'pointer',
            border: '1px solid rgba(253,224,71,0.4)',
            background: cardioAddon
              ? 'linear-gradient(90deg,rgba(253,224,71,0.14),rgba(239,68,68,0.10))'
              : 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(239,68,68,0.06))',
            boxShadow: cardioAddon ? '0 0 14px rgba(253,224,71,0.18)' : 'none',
          }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>❤</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 10.5, color: GOLD, letterSpacing: '0.05em' }}>{cardioAddon ? 'CARDIO ADDED' : 'ADD CARDIO'}</div>
              {!cardioAddon && (
                <span style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7,
                  color: GOLD, border: '1px solid rgba(253,224,71,0.45)', borderRadius: 4,
                  padding: '2px 5px', letterSpacing: '0.1em',
                }}>OPTIONAL</span>
              )}
            </div>
            <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 9.5, color: '#c4a4d8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run — bonus XP'}
            </div>
          </div>
          {cardioAddon ? (
            <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '4px 9px', cursor: 'pointer', flexShrink: 0,
              fontFamily: "'Orbitron',sans-serif", fontSize: 8, fontWeight: 700, color: C.red,
            }}>REMOVE</button>
          ) : (
            <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14, color: GOLD, flexShrink: 0 }}>›</span>
          )}
        </div>

        <div data-guide="ccs-start">
          <TrainingCTA
            variant="red"
            label={canStart ? 'START CIRCUIT' : 'PICK A CIRCUIT'}
            icon="⚔️"
            onClick={handleStart}
            height={54}
            style={{
              width: '100%', fontSize: 14, letterSpacing: '0.1em',
              opacity: canStart ? 1 : 0.55, pointerEvents: canStart ? 'auto' : 'none',
            }}
          />
          {canStart && (
            <div style={{
              textAlign: 'center', marginTop: 4,
              fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
              color: C.faint, letterSpacing: '0.16em',
            }}>SAME WORK · A STRONGER YOU</div>
          )}
        </div>
      </div>

      {cardioSheetOpen && (
        <AddCardioSheet
          context={{ source: 'Combat Conditioning', difficulty, durationMin }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.combat_conditioning_setup} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
