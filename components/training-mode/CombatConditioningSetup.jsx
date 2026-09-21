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
import { loadWarmup } from './shared/WarmupRow';

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
    focusLabel: 'Conditioning',
    focusShort: 'Endurance',
    icon: '🔥',
    tint: '#ff5a2a',
    desc: 'Bag work + bursts. Build fight endurance.',
    defaults: { rounds: 5, workSec: 40, restSec: 15, difficulty: 'Normal', equipment: 'BAG', blend: 50 },
  },
  {
    id: 'power',
    label: 'POWER & EXPLOSION',
    focusLabel: 'Power',
    focusShort: 'Power',
    icon: '💥',
    tint: '#ff3448',
    desc: 'Plyo + strikes for knockout force.',
    defaults: { rounds: 5, workSec: 30, restSec: 30, difficulty: 'Hard', equipment: 'NONE', blend: 40 },
  },
  {
    id: 'strike-strength',
    label: 'STRIKE & STRENGTH',
    focusLabel: 'Strength',
    focusShort: 'Strength',
    icon: '🥊',
    tint: '#a855f7',
    desc: 'Alternating combos + resistance.',
    defaults: { rounds: 5, workSec: 45, restSec: 20, difficulty: 'Normal', equipment: 'WEIGHTS', blend: 65 },
  },
  {
    id: 'fight-athlete',
    label: 'FIGHT ATHLETE',
    focusLabel: 'Athletic',
    focusShort: 'Athletic',
    icon: '🏃',
    tint: '#a855f7',
    desc: 'Full body. High output. No limits.',
    defaults: { rounds: 5, workSec: 40, restSec: 20, difficulty: 'Hard', equipment: 'BAG', blend: 55 },
  },
];
function getPreset(id) { return PRESETS.find(p => p.id === id); }

// Intensity progresses green → red as the difficulty climbs. Only the
// selected chip wears its colour; the rest stay dark violet.
const INTENSITIES = [
  { id: 'Easy',     label: 'LOW',    color: GREEN,  short: 'Low' },
  { id: 'Normal',   label: 'MED',    color: YELLOW, short: 'Medium' },
  { id: 'Hard',     label: 'HIGH',   color: ORANGE, short: 'High' },
  { id: 'Advanced', label: 'SAVAGE', color: RED,    short: 'Savage' },
];
function getIntensity(id) { return INTENSITIES.find(i => i.id === id) || INTENSITIES[1]; }

const EQUIPMENT = [
  { id: 'NONE', label: 'NONE' },
  { id: 'BAG', label: 'BAG' },
  { id: 'WEIGHTS', label: 'WEIGHTS' },
];
const EQUIPMENT_TIER = { NONE: 'Bodyweight', BAG: 'Bags & Combat Gear', WEIGHTS: 'Basic Gym' };

const setupCSS = `
.cc-tap { transition: transform 0.15s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.cc-tap:hover { filter: brightness(1.08); }
.cc-tap:active { transform: scale(0.97); }
.cc-preset:active { transform: scale(0.96); }
.cc-customize { overflow: hidden; transition: max-height 220ms ease, opacity 200ms ease, margin-top 200ms ease; }
.cc-customize.closed { max-height: 0; opacity: 0; margin-top: 0 !important; }
.cc-customize.open { max-height: 1200px; opacity: 1; }
.cc-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.cc-scroll::-webkit-scrollbar { display: none; }
`;

// ── Tiny building blocks ────────────────────────────────────────────────
function SectionMicroLabel({ children }) {
  return (
    <div style={{
      fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: '#c4a4d8',
      fontSize: 6.8, letterSpacing: '0.14em', marginBottom: 2, textAlign: 'center',
    }}>{children}</div>
  );
}

// A tight +/- stepper for the TIMING row. Small enough that ROUNDS/WORK/REST
// all sit on one line beside the icon + label.
function MicroStepper({ label, value, unit, min, max, step, onChange }) {
  const btn = {
    width: 22, height: 22, borderRadius: 6,
    border: 'none', color: '#fff',
    background: RED,
    fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 12, lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
      <SectionMicroLabel>{label}</SectionMicroLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <button className="cc-tap" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - step))} style={btn}>−</button>
        <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13, color: '#fff', minWidth: 24, textAlign: 'center' }}>
          {value}{unit && <span style={{ fontSize: 7.5, color: '#c4a4d8', marginLeft: 0 }}>{unit}</span>}
        </span>
        <button className="cc-tap" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + step))} style={btn}>+</button>
      </div>
    </div>
  );
}

// A row-shaped card used for every customize row: icon on the left, label +
// sub in the centre, controls (children) on the right. Matches the reference.
function ControlRow({ icon, iconTint, label, sub, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 10px 7px 8px',
      borderRadius: 11,
      border: '1px solid rgba(168,85,247,0.28)',
      background: 'rgba(10,3,22,0.75)',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: `${iconTint}22`,
        border: `1px solid ${iconTint}55`,
        color: iconTint,
        fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ minWidth: 0, flex: '0 0 auto', width: 92 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9.5,
          color: '#fff', letterSpacing: '0.06em', lineHeight: 1.1,
        }}>{label}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 8,
          color: '#9a90b8', marginTop: 1, lineHeight: 1.1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

// Segmented button used in DISCIPLINE / INTENSITY / EQUIPMENT rows.
function Chip({ active, activeColor, activeText, label, onClick, style }) {
  return (
    <button
      type="button"
      className="cc-tap"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '6px 7px',
        borderRadius: 7,
        cursor: 'pointer',
        fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 7.5, letterSpacing: '0.05em',
        lineHeight: 1.1, minWidth: 0, whiteSpace: 'normal', textAlign: 'center',
        background: active ? activeColor : 'rgba(16,4,30,0.8)',
        border: active ? 'none' : '1px solid rgba(168,85,247,0.3)',
        color: active ? (activeText || '#fff') : '#d9d1ef',
        boxShadow: active ? `0 0 10px ${activeColor}55` : 'none',
        ...style,
      }}
    >{label}</button>
  );
}

// ── Hero banner ─────────────────────────────────────────────────────────
function CombatHeroBanner({ preset, rounds, difficulty, durationMin }) {
  const intensity = getIntensity(difficulty);
  const summaryLine = preset
    ? `${preset.label} · ${rounds} ROUNDS · ${intensity.label}`
    : 'PICK A CIRCUIT BELOW';

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(168,85,247,0.35)',
      boxShadow: '0 6px 22px rgba(0,0,0,0.55), 0 0 22px rgba(168,85,247,0.15)',
      aspectRatio: '390 / 150',
      background: '#0a0116',
    }}>
      <img
        src={HERO_ART}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          // The banner's CONDITION HARDER title lives in the artwork itself
          // (baked into the WebP), so bias the crop slightly left of centre.
          // A pure 'center' crop cuts the leading C off the title at portrait
          // widths — 32% keeps the whole word intact while still showing the
          // fighter, and only trims the far-right "GO FOR BROKE" graffiti.
          objectFit: 'cover', objectPosition: '32% center',
          pointerEvents: 'none',
        }}
      />
      {/* Slight dim + a violet wash to tie the banner to the app frame.
          The CONDITION HARDER / NEXT ROUND GO FOR BROKE text lives inside
          the artwork, so nothing here overlays it — just a soft tint. */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(60,10,100,0.10) 0%, rgba(30,4,60,0.18) 100%)',
        mixBlendMode: 'multiply',
      }}/>
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(88,28,135,0.18) 0%, rgba(6,0,18,0.05) 55%, rgba(6,0,18,0.35) 100%)',
      }}/>

      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        height: '100%',
        padding: '9px 11px',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 6.5,
            color: '#ff9a9a',
            border: '1px solid rgba(239,68,68,0.6)', borderRadius: 4,
            padding: '2.5px 6px', letterSpacing: '0.14em', flexShrink: 0,
            background: 'rgba(20,4,10,0.55)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}>HYBRID</span>
          <span style={{
            fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 8,
            color: '#ffd7d7', letterSpacing: '0.08em',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}>{summaryLine}</span>
        </div>

        {/* Middle band left empty — the banner artwork carries the
            CONDITION HARDER title itself, so overlaying HTML text on top
            would double up and misalign at responsive widths. */}
        <div/>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 5,
        }}>
          <HeroStat icon={preset ? preset.icon : '🎯'} label={preset ? preset.label.split(' ')[0] : 'PICK'} sub={preset ? preset.focusShort : 'Below'} accent={preset ? preset.tint : C.faint}/>
          <HeroStat icon="▮▮▮" label={`${rounds} ROUNDS`} sub={intensity.short} accent={intensity.color}/>
          <HeroStat icon="⏱" label={`~${durationMin} MIN`} sub="Est. time" accent={GOLD}/>
        </div>
      </div>
    </div>
  );
}

function HeroStat({ icon, label, sub, accent }) {
  return (
    <div style={{
      background: 'rgba(6,0,18,0.72)',
      border: `1px solid ${accent}55`,
      borderRadius: 7,
      padding: '4px 6px',
      display: 'flex', alignItems: 'center', gap: 5,
      minWidth: 0,
    }}>
      <span style={{
        color: accent,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 7.5,
          color: '#fff', letterSpacing: '0.03em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{label}</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 7.5,
          color: '#c4a4d8', marginTop: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{sub}</div>
      </div>
    </div>
  );
}

// ── Presets row (four across, one line) ────────────────────────────────
function CircuitPresetSelector({ selected, onSelect }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 5 }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
          color: '#fff', letterSpacing: '0.08em',
        }}>CIRCUIT PRESETS</div>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8,
          color: C.faint, letterSpacing: '0.14em', whiteSpace: 'nowrap',
        }}>PICK A WORKOUT. GET TO WORK. ›</div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 5,
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
      className="cc-tap cc-preset"
      onClick={onSelect}
      aria-pressed={active}
      style={{
        position: 'relative',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'center',
        padding: '10px 4px 8px',
        minHeight: 122,
        background: active
          ? `linear-gradient(160deg, rgba(239,68,68,0.14) 0%, rgba(8,2,18,0.9) 70%)`
          : 'rgba(16,4,30,0.8)',
        border: active ? `1.5px solid ${RED}` : '1px solid rgba(168,85,247,0.3)',
        boxShadow: active
          ? `0 0 14px rgba(239,68,68,0.4), inset 0 0 22px rgba(239,68,68,0.08)`
          : 'none',
        color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      }}
    >
      {active && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: 5, right: 5,
          width: 15, height: 15, borderRadius: '50%',
          background: RED, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8,
          boxShadow: '0 0 8px rgba(239,68,68,0.55)',
        }}>✓</span>
      )}
      <span style={{
        fontSize: 20, lineHeight: 1,
        filter: active ? 'drop-shadow(0 0 8px rgba(239,68,68,0.55))' : 'none',
      }}>{preset.icon}</span>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9,
        color: active ? '#ff9a9a' : '#fff', letterSpacing: '0.02em', lineHeight: 1.1,
        padding: '0 2px',
      }}>{preset.label}</span>
      <span style={{
        fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 8.5,
        color: '#a89bc8', lineHeight: 1.22, flex: 1,
        padding: '0 2px',
      }}>{preset.desc}</span>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 3,
        marginTop: 1,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 6.5,
        color: active ? '#ff9a9a' : '#c4a4d8',
        letterSpacing: '0.12em',
      }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', border: `1.4px solid ${active ? RED : preset.tint}`, background: 'transparent' }}/>
        {preset.defaults.rounds} R · {preset.focusLabel.toUpperCase()}
      </span>
    </button>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────
export default function CombatConditioningSetup({ onBack, onStart, onCardioOnly: _onCardioOnly, profile: _profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [style, setStyle] = useState('Boxing');
  const [difficulty, setDifficulty] = useState('Normal');
  const [rounds, setRounds] = useState(5);
  const [workSec, setWorkSec] = useState(40);
  const [restSec, setRestSec] = useState(15);
  const [focus, setFocus] = useState(null); // §8 — nothing preselected on mount
  const [equipment, setEquipment] = useState('NONE');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const cadencePreset = 'moderate';
  const cadenceMs = CADENCE_PRESETS.moderate;
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [warmupMin] = useState(() => loadWarmup('combatConditioning'));

  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: 0 });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }, []);

  const preset = useMemo(() => getPreset(focus), [focus]);
  const hasPreset = !!preset;

  // Warm-up + work × rounds + rest × (rounds-1) + cardio addon minutes,
  // rounded up to whole minutes so the banner reads what the timer will run.
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
      style, duration: durationMin, difficulty,
      equipment: EQUIPMENT_TIER[equipment] || 'Any',
      format: 'Auto',
      voiceOn: true, formPreviewOn: true, cadenceCount: true,
      cadencePreset, cadenceMs, cardioAddon,
      rounds, workSec, restSec, focus,
      blend: preset?.defaults.blend ?? 50, warmupMin,
    });
  };

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: setupCSS }}/>
      <Embers count={2}/>

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
          padding: '8px 12px calc(88px + env(safe-area-inset-bottom, 0px))',
          gap: 8,
        }}
      >
        <CombatHeroBanner
          preset={preset}
          rounds={rounds}
          difficulty={difficulty}
          durationMin={durationMin}
        />

        <div data-guide="ccs-style">
          <CircuitPresetSelector selected={focus} onSelect={handleSelectPreset}/>
        </div>

        {hasPreset && (
          <button
            type="button"
            onClick={() => setCustomizeOpen(v => !v)}
            aria-expanded={customizeOpen}
            aria-controls="cc-customize"
            className="cc-tap"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', cursor: 'pointer',
              border: '1px solid rgba(168,85,247,0.3)',
              background: 'rgba(16,4,30,0.7)', borderRadius: 10,
              minHeight: 32,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 11,
                color: '#fff', letterSpacing: '0.08em',
              }}>CUSTOMIZE</span>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8,
                color: C.faint, letterSpacing: '0.12em',
              }}>(OPTIONAL)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{
                fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 8,
                color: '#8f8ab8', letterSpacing: '0.14em', whiteSpace: 'nowrap',
              }}>FINE-TUNE YOUR SESSION</span>
              <span style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 10,
                color: C.faint,
                transform: customizeOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
              }}>▼</span>
            </span>
          </button>
        )}

        <div
          id="cc-customize"
          className={`cc-customize ${hasPreset && customizeOpen ? 'open' : 'closed'}`}
          aria-hidden={!(hasPreset && customizeOpen)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* DISCIPLINE */}
            <ControlRow icon="🥊" iconTint="#ef4444" label="DISCIPLINE" sub="Training style">
              <div style={{ display: 'flex', gap: 3, minWidth: 0, width: '100%', justifyContent: 'flex-end' }}>
                {STYLES.map(s => (
                  <Chip
                    key={s.id}
                    active={style === s.id}
                    activeColor={RED}
                    activeText="#fff"
                    label={s.label}
                    onClick={() => setStyle(s.id)}
                    style={{ flex: 1, maxWidth: 82 }}
                  />
                ))}
              </div>
            </ControlRow>

            {/* TIMING */}
            <ControlRow icon="⏱" iconTint="#a855f7" label="TIMING" sub="Work / rest">
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'flex-end' }}>
                <MicroStepper label="ROUNDS" value={rounds} min={2} max={12} step={1} onChange={setRounds}/>
                <MicroStepper label="WORK"   value={workSec} unit="s" min={10} max={120} step={5} onChange={setWorkSec}/>
                <MicroStepper label="REST"   value={restSec} unit="s" min={0}  max={90}  step={5} onChange={setRestSec}/>
              </div>
            </ControlRow>

            {/* INTENSITY */}
            <ControlRow icon="▮▮" iconTint="#a855f7" label="INTENSITY" sub="How hard">
              <div style={{ display: 'flex', gap: 3, minWidth: 0, width: '100%', justifyContent: 'flex-end' }}>
                {INTENSITIES.map(o => (
                  <Chip
                    key={o.id}
                    active={difficulty === o.id}
                    activeColor={o.color}
                    activeText="#0a0014"
                    label={o.label}
                    onClick={() => setDifficulty(o.id)}
                    style={{ flex: 1, maxWidth: 60 }}
                  />
                ))}
              </div>
            </ControlRow>

            {/* EQUIPMENT */}
            <ControlRow icon="🏋" iconTint="#a855f7" label="EQUIPMENT" sub="What you have">
              <div style={{ display: 'flex', gap: 3, minWidth: 0, width: '100%', justifyContent: 'flex-end' }}>
                {EQUIPMENT.map(o => (
                  <Chip
                    key={o.id}
                    active={equipment === o.id}
                    activeColor={GOLD}
                    activeText="#0a0014"
                    label={o.label}
                    onClick={() => setEquipment(o.id)}
                    style={{ flex: 1, maxWidth: 82 }}
                  />
                ))}
              </div>
            </ControlRow>
          </div>
        </div>

        {/* ADD CARDIO — always visible */}
        <div
          onClick={() => setCardioSheetOpen(true)}
          className="cc-tap"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCardioSheetOpen(true); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '7px 10px 7px 8px', borderRadius: 11, cursor: 'pointer',
            border: '1px solid rgba(253,224,71,0.4)',
            background: cardioAddon
              ? 'linear-gradient(90deg,rgba(253,224,71,0.14),rgba(239,68,68,0.10))'
              : 'linear-gradient(90deg,rgba(253,224,71,0.08),rgba(239,68,68,0.06))',
            boxShadow: cardioAddon ? '0 0 12px rgba(253,224,71,0.18)' : 'none',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'rgba(253,224,71,0.10)',
            border: '1px solid rgba(253,224,71,0.35)',
            color: GOLD, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>❤</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9.5,
                color: GOLD, letterSpacing: '0.06em',
              }}>{cardioAddon ? 'CARDIO ADDED' : 'ADD CARDIO'}</div>
              {!cardioAddon && (
                <span style={{
                  fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 6.5,
                  color: GOLD, border: '1px solid rgba(253,224,71,0.45)', borderRadius: 3,
                  padding: '1.5px 4px', letterSpacing: '0.12em',
                }}>OPTIONAL</span>
              )}
            </div>
            <div style={{
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 500, fontSize: 8.5,
              color: '#c4a4d8', marginTop: 1, lineHeight: 1.1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run — bonus XP'}</div>
          </div>
          {cardioAddon ? (
            <button onClick={(e) => { e.stopPropagation(); setCardioAddon(null); }} style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
              fontFamily: "'Orbitron',sans-serif", fontSize: 7.5, fontWeight: 700, color: C.red,
              letterSpacing: '0.08em',
            }}>REMOVE</button>
          ) : (
            // A little toggle-shaped affordance to match the reference; opening
            // the sheet is what actually configures the addon.
            <div aria-hidden="true" style={{
              width: 32, height: 18, borderRadius: 999,
              border: '1px solid rgba(253,224,71,0.4)',
              background: 'rgba(8,2,18,0.55)',
              display: 'flex', alignItems: 'center', padding: 2,
              flexShrink: 0,
            }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff' }}/>
            </div>
          )}
        </div>

        {/* START CIRCUIT */}
        <div data-guide="ccs-start">
          <StartCircuitButton canStart={canStart} onClick={handleStart}/>
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

// A bespoke START button with corner brackets to match the reference. The
// standard TrainingCTA styles cleanly but does not carry the bracket motif.
function StartCircuitButton({ canStart, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canStart}
      className="cc-tap"
      style={{
        position: 'relative', width: '100%',
        padding: '13px 18px 15px',
        borderRadius: 12,
        border: canStart ? '1.5px solid rgba(239,68,68,0.9)' : '1.5px solid rgba(239,68,68,0.3)',
        background: canStart
          ? 'linear-gradient(180deg, rgba(239,68,68,0.85) 0%, rgba(180,20,32,0.85) 100%)'
          : 'linear-gradient(180deg, rgba(60,10,20,0.6) 0%, rgba(30,4,10,0.6) 100%)',
        color: '#fff', cursor: canStart ? 'pointer' : 'not-allowed',
        boxShadow: canStart ? '0 6px 22px rgba(239,68,68,0.35), inset 0 0 22px rgba(255,255,255,0.05)' : 'none',
        opacity: canStart ? 1 : 0.7,
        overflow: 'hidden',
      }}
    >
      <Bracket at="tl"/><Bracket at="tr"/><Bracket at="bl"/><Bracket at="br"/>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 14,
        letterSpacing: '0.12em',
      }}>
        <span style={{ fontSize: 15 }}>⚔️</span>
        <span>{canStart ? 'START CIRCUIT' : 'PICK A CIRCUIT'}</span>
        <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, opacity: 0.85 }}>›</span>
      </div>
      <div style={{
        marginTop: 3, textAlign: 'center',
        fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7.5,
        color: '#ffe6e6', letterSpacing: '0.18em', opacity: 0.9,
      }}>SAME WORK · A STRONGER YOU</div>
    </button>
  );
}

function Bracket({ at }) {
  const size = 12;
  const stroke = 1.5;
  const color = 'rgba(255,255,255,0.85)';
  const base = { position: 'absolute', width: size, height: size, pointerEvents: 'none' };
  const map = {
    tl: { top: 5, left: 5, borderTop: `${stroke}px solid ${color}`, borderLeft: `${stroke}px solid ${color}` },
    tr: { top: 5, right: 5, borderTop: `${stroke}px solid ${color}`, borderRight: `${stroke}px solid ${color}` },
    bl: { bottom: 5, left: 5, borderBottom: `${stroke}px solid ${color}`, borderLeft: `${stroke}px solid ${color}` },
    br: { bottom: 5, right: 5, borderBottom: `${stroke}px solid ${color}`, borderRight: `${stroke}px solid ${color}` },
  };
  return <span aria-hidden="true" style={{ ...base, ...map[at] }}/>;
}
