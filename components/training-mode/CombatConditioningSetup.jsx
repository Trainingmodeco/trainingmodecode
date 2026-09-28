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
import { StepperRow } from './shared/Stepper';
import DisciplineTabs, { useDiscipline } from './shared/DisciplineTabs';
import { ChevronDown } from 'lucide-react';

const GOLD = C.gold;
const RED = '#ef4444';
const HERO_ART = '/static/hub/combat-hero.webp';

// The shared tabs offer four disciplines; the conditioning generator has
// three styles, with Kickboxing and Muay Thai as one. Mapping here keeps the
// generator untouched: both tabs give the same kick-and-knee pool they
// always did.
const ccStyleFor = (discipline) =>
  (discipline === 'Kickboxing' || discipline === 'Muay Thai') ? 'Kickboxing / Muay Thai'
    : discipline === 'MMA' ? 'MMA' : 'Boxing';

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

// Intensity climbs from soft blue to deep red, and the top two carry a bolt,
// so how hard a circuit is reads before the word. Only the selected option
// wears its colour. `color` is the accent the hero banner uses for the level.
const INTENSITIES = [
  { id: 'Easy',     label: 'LOW',    color: '#8FB4FF', short: 'Low' },
  { id: 'Normal',   label: 'MED',    color: '#6E9BFF', short: 'Medium' },
  { id: 'Hard',     label: 'HIGH',   color: '#F2BE45', short: 'High' },
  { id: 'Advanced', label: 'SAVAGE', color: '#FDE047', short: 'Savage' },
];
function getIntensity(id) { return INTENSITIES.find(i => i.id === id) || INTENSITIES[1]; }
const INTENSITY_ON = {
  Easy: { bg: 'rgba(143,180,255,0.16)', border: '#8FB4FF', color: '#E3ECFF', shadow: '0 0 12px rgba(143,180,255,0.35)' },
  Normal: { bg: 'linear-gradient(180deg,#4F8BFF,#2458E0)', border: '#6E9BFF', color: '#FFFFFF', shadow: '0 0 14px rgba(61,123,255,0.6)' },
  Hard: { bg: 'linear-gradient(180deg,#F87171,#DC2626 55%,#991B1B)', border: '#F2BE45', color: '#FFFFFF', shadow: '0 0 14px rgba(239,68,68,0.6)', bolt: true },
  Advanced: { bg: 'linear-gradient(180deg,#EF4444,#991B1B 60%,#450A0A)', border: '#FDE047', color: '#FDE047', shadow: '0 0 16px rgba(239,68,68,0.8), 0 0 10px rgba(242,190,69,0.6)', bolt: true },
};
const OPT_OFF = { bg: '#0F1328', border: 'rgba(143,180,255,0.2)', color: '#A9B4D6', shadow: 'none' };
const OPT_SELECTED = { bg: 'rgba(61,123,255,0.28)', border: '#3D7BFF', color: '#FFFFFF', shadow: '0 0 12px rgba(61,123,255,0.45)' };

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
.cc-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.cc-scroll::-webkit-scrollbar { display: none; }
.cc-opt, .cc-custom { transition: border-color .18s ease, box-shadow .18s ease; }
.cc-opt:hover, .cc-opt:focus-visible, .cc-custom:hover, .cc-custom:focus-visible { border-color: #F2BE45 !important; }
`;

const Bolt = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 11, height: 11, fill: 'currentColor', flexShrink: 0 }}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>
);

// One Customize row: label, then the options as equal buttons. Same 46px,
// red-bordered row as the timing steppers under it, so the panel reads as one
// stack.
function OptionRow({ label, options, value, onChange, styleFor }) {
  return (
    <div style={{ height: 46, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8, padding: '0 5px 0 14px', borderRadius: 12, background: '#0B0F22', border: '1px solid rgba(239,68,68,0.32)' }}>
      <span style={{ width: 84, flexShrink: 0, font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: '#fff' }}>{label}</span>
      <div role="radiogroup" aria-label={label} style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
        {options.map(o => {
          const on = o.id === value;
          const s = styleFor(o, on);
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on} className="cc-opt" onClick={() => onChange(o.id)} style={{
              flex: 1, minWidth: 0, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              borderRadius: 8, background: s.bg, border: `1px solid ${s.border}`, color: s.color, boxShadow: s.shadow,
              font: "700 10px 'Chakra Petch',sans-serif", letterSpacing: '0.08em', cursor: 'pointer', padding: '0 2px',
            }}>{s.bolt && <Bolt/>}{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

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
      // Match the artwork's own 3:1 ratio (2172 x 724) so both baked-in
      // titles — CONDITION HARDER on the left and NEXT ROUND · GO FOR
      // BROKE on the right — sit inside the frame without either side
      // getting cropped away.
      aspectRatio: '2172 / 724',
      background: '#0a0116',
    }}>
      <img
        src={HERO_ART}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          // The banner container is 3:1 (the artwork's own ratio), so cover
          // needs no bias — the whole picture fits and neither edge crops.
          objectFit: 'cover', objectPosition: 'center center',
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
function CircuitPresetSelector({ selected, onSelect, compact }) {
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
          <PresetCard key={p.id} preset={p} active={selected === p.id} onSelect={() => onSelect(p.id)} compact={compact}/>
        ))}
      </div>
    </div>
  );
}

// The cards stay exactly as they were, per the design. While Customize is
// open they compact to icon + name so the whole panel fits on one screen;
// the description and round count come back when it closes.
function PresetCard({ preset, active, onSelect, compact }) {
  return (
    <button
      type="button"
      className="cc-tap cc-preset"
      onClick={onSelect}
      aria-pressed={active}
      aria-label={compact ? `${preset.label} — ${preset.desc}` : undefined}
      style={{
        position: 'relative',
        borderRadius: 10,
        cursor: 'pointer',
        textAlign: 'center',
        padding: compact ? '8px 4px' : '10px 4px 8px',
        minHeight: compact ? 58 : 122,
        justifyContent: compact ? 'center' : undefined,
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
        fontSize: compact ? 16 : 20, lineHeight: 1,
        filter: active ? 'drop-shadow(0 0 8px rgba(239,68,68,0.55))' : 'none',
      }}>{preset.icon}</span>
      <span style={{
        fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 9,
        color: active ? '#ff9a9a' : '#fff', letterSpacing: '0.02em', lineHeight: 1.1,
        padding: '0 2px',
      }}>{preset.label}</span>
      {!compact && (
        <>
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
        </>
      )}
    </button>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────
export default function CombatConditioningSetup({ onBack, onStart, onCardioOnly: _onCardioOnly, profile: _profile }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // The discipline is the shared one from the tabs (and the Fight hub), not a
  // separate pick buried in Customize.
  const [disc, pickDisc] = useDiscipline();
  const style = ccStyleFor(disc);
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
  const open = hasPreset && customizeOpen;

  // Warm-up + work × rounds + rest × (rounds-1) + cardio addon minutes,
  // rounded up to whole minutes so the banner reads what the timer will run.
  const durationMin = useMemo(() => {
    const restBetween = Math.max(0, rounds - 1) * restSec;
    const work = rounds * workSec;
    const cardioMin = cardioAddon?.enabled ? Math.max(0, Number(cardioAddon.durationMin) || 0) : 0;
    const total = warmupMin * 60 + work + restBetween + cardioMin * 60;
    return Math.max(1, Math.round(total / 60));
  }, [warmupMin, rounds, workSec, restSec, cardioAddon]);

  // Picking a circuit loads its defaults but leaves Customize shut: the
  // preset is a complete workout, and most people should just start it.
  const handleSelectPreset = (id) => {
    setFocus(id);
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
        <DisciplineTabs value={disc} onChange={pickDisc} guide="ccs-discipline"/>

        {/* The hero steps aside while Customize is open, so the whole panel
            and START stay on one screen. */}
        {!open && (
          <CombatHeroBanner
            preset={preset}
            rounds={rounds}
            difficulty={difficulty}
            durationMin={durationMin}
          />
        )}

        <div data-guide="ccs-style">
          <CircuitPresetSelector selected={focus} onSelect={handleSelectPreset} compact={open}/>
        </div>

        {/* Collapsed until tapped: the preset is already a full workout. The
            gold estimate says what START will run without opening it. */}
        {hasPreset && (
          <button
            type="button"
            onClick={() => setCustomizeOpen(v => !v)}
            aria-expanded={open}
            aria-controls="cc-customize"
            className="cc-custom"
            data-guide="ccs-customize"
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px', height: 38, cursor: 'pointer', borderRadius: 10, color: '#fff',
              border: '1px solid rgba(239,68,68,0.45)',
              background: 'linear-gradient(90deg, rgba(239,68,68,0.12), #0B0F22 60%)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ font: "700 13px 'Chakra Petch',sans-serif", letterSpacing: '0.12em' }}>CUSTOMIZE</span>
              <span style={{ font: "600 10px 'Chakra Petch',sans-serif", letterSpacing: '0.12em', color: '#8E98BC' }}>(OPTIONAL)</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: "700 12px 'Chakra Petch',sans-serif", color: '#F2BE45' }}>~{durationMin} MIN</span>
              <ChevronDown size={16} color="#8FB4FF" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}/>
            </span>
          </button>
        )}

        {open && (
          <div id="cc-customize" style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <OptionRow
              label="INTENSITY" options={INTENSITIES} value={difficulty} onChange={setDifficulty}
              styleFor={(o, on) => (on ? INTENSITY_ON[o.id] : OPT_OFF)}
            />
            <OptionRow
              label="EQUIPMENT" options={EQUIPMENT} value={equipment} onChange={setEquipment}
              styleFor={(_o, on) => (on ? OPT_SELECTED : OPT_OFF)}
            />
            <StepperRow tone="red" label="ROUNDS" value={rounds} min={2} max={12} step={1} parse={s => parseInt(s, 10)} onChange={setRounds}/>
            <StepperRow tone="red" label="WORK" value={workSec} unit="S" min={10} max={120} step={5} parse={s => parseInt(s, 10)} onChange={setWorkSec}/>
            <StepperRow tone="red" label="REST" value={restSec} unit="S" min={0} max={90} step={5} parse={s => parseInt(s, 10)} onChange={setRestSec}/>
          </div>
        )}

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
