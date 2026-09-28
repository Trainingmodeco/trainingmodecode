import { useState, useRef, useEffect } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import BottomSheet from './shared/BottomSheet';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import { Shuffle, Zap, Bookmark, ChevronRight, X } from 'lucide-react';
import AddCardioSheet from './AddCardioSheet';
import { summarizeCardioAddon } from './data/cardioAddon';
import { resolveScheme, CHIP_GROUPS, SET_SCHEMES, DURATIONS, DEFAULT_DURATION } from './data/workoutPrograms';
import { trainAgainPlan } from './data/builderProgression';
import { loadRoutines, deleteRoutine, MAX_ROUTINES } from './data/savedRoutines';
import {
  fitKitCSS, SetupHeader, SetupPage, SegRow, SettingsCard, SettingRow, GoldButton, GhostButton, ChoiceSheet, Label,
  HEAD, BODY, MUTED, GOLD, VIOLET_TEXT, CARD, CARD_BORDER,
} from './shared/FitSetupKit';

// Build Workout — the Revamp layout (BuildWorkout.dc.html).
//
// One screen, no scroll: DURATION and DIFFICULTY as segmented rows, then a
// settings card whose rows open a picker — TARGET (the muscle chips and the
// body maps live in the sheet now), EQUIPMENT, SET SCHEME, CARDIO — then a
// gold GENERATE with SURPRISE ME under it and the saved-routines shelf at
// the foot. The old WORKOUT PROGRAMS sub-page is gone: programs have their
// own screen on the hub, and everything else it held is a row here.
const CHIP_IDS = Object.keys(CHIP_GROUPS);
const EQUIPMENT = [
  { id: 'BODYWEIGHT', label: 'BODYWEIGHT', value: 'Bodyweight', note: 'No gear at all' },
  { id: 'WEIGHTED', label: 'WEIGHTED', value: 'Weighted', note: 'Dumbbells, a bar, kettlebells, bands' },
  { id: 'HYBRID', label: 'HYBRID', value: 'Hybrid', note: 'A mix of both' },
];
const DIFFICULTY = ['EASY', 'NORMAL', 'HARD'];

const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Beta ND-09 — the anatomy panels rendered as bare dark boxes while the art
// decoded, which read as broken. A pulsing silhouette placeholder holds the
// space until SafeImage reports the figure has real pixels.
function BodyMapFigure({ v, sex, spots }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div style={{ flex: 1, position: 'relative', borderRadius: 11, overflow: 'hidden', border: '1px solid rgba(157,108,255,0.3)', background: '#050010', display: 'flex', justifyContent: 'center' }}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, animation: 'wb-map-pulse 1.3s ease-in-out infinite' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid rgba(157,108,255,0.4)' }}/>
          <div style={{ width: 52, height: 74, borderRadius: 12, border: '2px solid rgba(157,108,255,0.4)' }}/>
        </div>
      )}
      <div style={{ position: 'relative', height: 150, opacity: loaded ? 1 : 0, transition: 'opacity 0.25s ease' }}>
        <SafeImage src={`/static/bodymap/${sex}-${v}.webp`} alt={v} onLoaded={() => setLoaded(true)} style={{ height: 150, width: 'auto', objectFit: 'contain', display: 'block' }}/>
        {spots.map(([x, y], i) => <MuscleGlow key={i} x={x} y={y}/>)}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', font: `600 9px ${HEAD}`, color: VIOLET_TEXT, letterSpacing: '0.16em', background: 'linear-gradient(0deg,rgba(8,1,15,.9),transparent)', padding: '5px 0 3px' }}>{v.toUpperCase()}</div>
    </div>
  );
}

// Glow spots per muscle chip, as %-of-figure coordinates on the front/back
// anatomy (the 450x600 body maps place the figure centred in-frame). Same
// layout works for the male and female art. Bilateral muscles get two spots.
const GLOW_MAP = {
  CHEST:     { front: [[42, 30], [58, 30]], back: [] },
  BACK:      { front: [], back: [[42, 33], [58, 33], [50, 44]] },
  SHOULDERS: { front: [[32, 25], [68, 25]], back: [[33, 26], [67, 26]] },
  ARMS:      { front: [[25, 40], [75, 40]], back: [[26, 41], [74, 41]] },
  CORE:      { front: [[50, 45]], back: [[50, 47]] },
  LEGS:      { front: [[43, 65], [57, 65]], back: [[43, 66], [57, 66]] },
  GLUTES:    { front: [], back: [[43, 55], [57, 55]] },
};

const builderCSS = `
@keyframes bm-glow {
  0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.9); }
  50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.12); }
}
@keyframes wb-map-pulse { 0%, 100% { opacity: .25 } 50% { opacity: .6 } }
@keyframes wb-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}
.wb-again { transition: border-color .2s, box-shadow .2s; }
.wb-again:hover, .wb-again:focus-visible { border-color: ${GOLD} !important; box-shadow: 0 0 0 1px rgba(242,190,69,.3), 0 0 22px rgba(157,108,255,.45); }
.wb-routine { transition: border-color .2s, background .2s; }
.wb-routine:hover, .wb-routine:focus-visible { border-color: ${GOLD} !important; background: rgba(157,108,255,.1) !important; }
`;

function MuscleGlow({ x, y }) {
  return (
    <span aria-hidden style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      width: 22, height: 27, borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(253,224,71,0.95) 0%, rgba(253,224,71,0.4) 45%, transparent 72%)',
      filter: 'blur(0.5px)', mixBlendMode: 'screen', pointerEvents: 'none',
      animation: 'bm-glow 1.8s ease-in-out infinite',
    }}/>
  );
}

const numInput = {
  width: '100%', boxSizing: 'border-box', padding: '9px 6px', textAlign: 'center', borderRadius: 8,
  background: '#16131F', border: '1px solid rgba(157,108,255,0.45)', color: '#fff', font: `700 14px ${HEAD}`, outline: 'none',
};

export default function FitBuilderSetup({ onBack, onHome, onFightMode, onGenerate, profileSex }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [chips, setChips] = useState(['CHEST', 'BACK']);
  const [equipment, setEquipment] = useState('BODYWEIGHT');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [schemeId, setSchemeId] = useState('auto');
  const [customScheme, setCustomScheme] = useState({ sets: 4, reps: 10, restSeconds: 60 });
  const [cardioAddon, setCardioAddon] = useState(null);
  const [sheet, setSheet] = useState(null); // 'target' | 'equipment' | 'scheme' | 'routines' | 'cardio'
  const [routines, setRoutines] = useState(() => loadRoutines());
  // Spec 11 — one-tap repeat of the last workout with progression baked in.
  // Null when there's no history: the card simply doesn't exist.
  const [trainPlan] = useState(() => trainAgainPlan());
  // GENERATE with zero muscles: shake + tell them why (never a silent no-op).
  const [genNudge, setGenNudge] = useState(false);
  const genNudgeTimer = useRef(0);
  useEffect(() => () => clearTimeout(genNudgeTimer.current), []);
  void onHome;

  const sex = String(profileSex || 'male').toLowerCase() === 'female' ? 'female' : 'male';
  const equip = EQUIPMENT.find(e => e.id === equipment) || EQUIPMENT[0];
  const scheme = SET_SCHEMES.find(s => s.id === schemeId) || SET_SCHEMES[0];
  const schemeValue = schemeId === 'auto' ? 'Auto · generator picks'
    : schemeId === 'custom' ? `${customScheme.sets}×${customScheme.reps} · ${customScheme.restSeconds}s rest`
      : `${scheme.label} · ${scheme.sub}`;
  const targetValue = chips.length ? chips.map(cap).join(', ') : 'Pick muscles';

  const toggleChip = (id) => setChips(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const buildCfg = (ids, eq, diff) => ({
    muscleGroups: ids.flatMap(id => CHIP_GROUPS[id] || []),
    equipment: eq, difficulty: diff, focus: 'Strength', duration,
    cardioAddon, addCardio: false, setScheme: resolveScheme(schemeId, customScheme),
  });

  const generate = () => {
    if (!chips.length) {
      setGenNudge(true);
      clearTimeout(genNudgeTimer.current);
      genNudgeTimer.current = setTimeout(() => setGenNudge(false), 1800);
      return;
    }
    onGenerate?.(buildCfg(chips, equip.value, cap(difficulty)));
  };

  // Roll the muscles and the gear, keep the athlete's time and difficulty.
  const surprise = () => {
    const n = 1 + Math.floor(Math.random() * 3);
    const ids = [...CHIP_IDS].sort(() => Math.random() - 0.5).slice(0, n);
    const eq = rand(EQUIPMENT);
    setChips(ids); setEquipment(eq.id);
    onGenerate?.(buildCfg(ids, eq.value, cap(difficulty)));
  };

  const cardioSummary = cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Off';

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + builderCSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="BUILD WORKOUT" onBack={onBack} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0', flex: 1 }}>
          {/* Spec 11 — TRAIN AGAIN: straight to the generated list with every
              nudge applied. Hidden entirely without history. */}
          {trainPlan && (
            <button type="button" className="wb-again" data-guide="wb-trainagain" onClick={() => onGenerate?.({ ...trainPlan.cfg, savedExercises: trainPlan.exercises })} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 14, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'linear-gradient(100deg, rgba(157,108,255,0.18), rgba(242,190,69,0.12) 70%)', border: '1px solid rgba(157,108,255,0.55)',
            }}>
              <Zap size={18} color={GOLD} fill={GOLD} style={{ flexShrink: 0 }}/>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', font: `700 10px ${HEAD}`, letterSpacing: '0.16em', color: VIOLET_TEXT }}>TRAIN AGAIN · <span style={{ color: GOLD }}>PROGRESSION APPLIED</span></span>
                <span style={{ display: 'block', font: `700 15px ${HEAD}`, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{trainPlan.title}</span>
                <span style={{ display: 'block', font: `500 12px ${BODY}`, color: MUTED, marginTop: 1 }}>{trainPlan.agoPhrase} · {trainPlan.meta}</span>
              </span>
              <ChevronRight size={18} color={GOLD}/>
            </button>
          )}

          <SegRow label="Duration" guide="wb-duration" value={duration} onPick={setDuration}
            options={DURATIONS.map(d => ({ id: d, label: d === duration ? `${d} MIN` : String(d) }))}/>
          <SegRow label="Difficulty" guide="wb-difficulty" value={difficulty} onPick={setDifficulty} options={DIFFICULTY}/>

          <SettingsCard>
            <SettingRow first guide="wb-muscles" label="Target" value={targetValue} accent={chips.length ? undefined : '#f87171'} onClick={() => setSheet('target')}/>
            <SettingRow guide="wb-equipment" label="Equipment" value={equip.value} onClick={() => setSheet('equipment')}/>
            <SettingRow guide="wb-programming" label="Set scheme" value={schemeValue} onClick={() => setSheet('scheme')}/>
            <SettingRow guide="wb-cardio" label="Cardio" value={cardioSummary} accent={cardioAddon ? GOLD : undefined} onClick={() => setSheet('cardio')}/>
          </SettingsCard>

          {genNudge && (
            <div style={{ textAlign: 'center', font: `600 13px ${BODY}`, color: '#f87171' }}>Pick at least one muscle group.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: genNudge ? 'wb-shake 0.45s ease' : 'none' }}>
            <GoldButton guide="wb-generate" label="GENERATE WORKOUT" icon={<Zap size={18} fill="currentColor" strokeWidth={0}/>} onClick={generate} height={58} style={{ letterSpacing: '0.16em' }}/>
            <GhostButton label="SURPRISE ME" icon={<Shuffle size={17} color={GOLD}/>} onClick={surprise} height={50}/>
          </div>

          <div style={{ flex: 1 }}/>

          <button type="button" className="wb-routine" data-guide="wb-routines" onClick={() => setSheet('routines')} style={{
            height: 60, flexShrink: 0, borderRadius: 14, border: '1px dashed rgba(196,168,255,0.45)', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px', cursor: 'pointer', textAlign: 'left', width: '100%', color: '#fff',
          }}>
            <Bookmark size={20} color={VIOLET_TEXT}/>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: `700 14px ${HEAD}`, letterSpacing: '0.1em' }}>SAVED ROUTINES</span>
              <span style={{ display: 'block', font: `500 12px ${BODY}`, color: MUTED }}>{routines.length ? `${routines.length} saved · tap to load one` : 'Save a workout from its list to shelf it here'}</span>
            </span>
            <ChevronRight size={18} color={VIOLET_TEXT}/>
          </button>
        </div>
      </SetupPage>

      {sheet === 'target' && (
        <ChoiceSheet title="TARGET MUSCLES" multi options={CHIP_IDS} value={chips} onPick={toggleChip} onClose={() => setSheet(null)}
          note="Tap the groups you want to hit — they light up on the body map. Fewer groups means more volume on each.">
          <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
            {['front', 'back'].map(v => (
              <BodyMapFigure key={v} v={v} sex={sex} spots={chips.flatMap(id => GLOW_MAP[id]?.[v] || [])}/>
            ))}
          </div>
        </ChoiceSheet>
      )}
      {sheet === 'equipment' && (
        <ChoiceSheet title="EQUIPMENT" options={EQUIPMENT} value={equipment} onPick={setEquipment} onClose={() => setSheet(null)}
          note={EQUIPMENT.find(e => e.id === equipment)?.note}/>
      )}
      {sheet === 'scheme' && (
        <ChoiceSheet title="SET SCHEME" options={SET_SCHEMES.map(s => ({ id: s.id, label: s.id === 'custom' ? 'CUSTOM' : `${s.label} · ${s.sub}` }))} value={schemeId} onPick={setSchemeId} onClose={() => setSheet(null)}
          note="Applied to every weighted lift. AUTO lets the generator pick; bodyweight moves keep their own numbers either way.">
          {schemeId === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {[['SETS', 'sets', 1, 8], ['REPS', 'reps', 1, 50], ['REST s', 'restSeconds', 15, 300]].map(([lab, key, min, max]) => (
                <div key={key} style={{ flex: 1 }}>
                  <Label style={{ marginBottom: 5 }}>{lab}</Label>
                  <input type="number" inputMode="numeric" value={customScheme[key]} aria-label={lab}
                    onChange={e => { const n = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)); setCustomScheme(cs => ({ ...cs, [key]: n })); }}
                    style={numInput}/>
                </div>
              ))}
            </div>
          )}
        </ChoiceSheet>
      )}
      {sheet === 'routines' && (
        <BottomSheet title="SAVED ROUTINES" accent={GOLD} onClose={() => setSheet(null)} maxHeight="72dvh">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ font: `500 13px ${BODY}`, color: MUTED }}>Tap a routine to load it exactly as you saved it.</span>
            <span style={{ font: `700 11px ${HEAD}`, color: routines.length >= MAX_ROUTINES ? '#f87171' : GOLD }}>{routines.length}/{MAX_ROUTINES}</span>
          </div>
          {routines.length === 0 ? (
            <div style={{ borderRadius: 12, border: '1px dashed rgba(157,108,255,0.35)', padding: '14px 12px', font: `500 13px ${BODY}`, color: MUTED }}>
              No saved routines yet — generate a workout and tap SAVE ROUTINE on its list.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {routines.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, border: `1px solid ${CARD_BORDER}`, background: CARD, padding: '10px 12px' }}>
                  <button type="button" onClick={() => onGenerate?.({ ...r.cfg, savedExercises: r.exercises })} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: '#fff' }}>
                    <span style={{ display: 'block', font: `700 14px ${HEAD}`, letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                    <span style={{ display: 'block', font: `500 12px ${BODY}`, color: MUTED, marginTop: 2 }}>{r.exercises?.length || 0} exercises · {r.cfg?.equipment || ''} · {r.cfg?.difficulty || ''}</span>
                  </button>
                  <button type="button" onClick={() => setRoutines(list => { deleteRoutine(r.id); return list.filter(x => x.id !== r.id); })} aria-label={`Delete ${r.name}`}
                    style={{ width: 30, height: 30, borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={14}/></button>
                </div>
              ))}
            </div>
          )}
        </BottomSheet>
      )}
      {sheet === 'cardio' && (
        <AddCardioSheet
          context={{ source: 'Workout Builder', difficulty: cap(difficulty), durationMin: duration }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}
      {helpOpen && <ScreenGuide steps={SCREEN_GUIDES.workout_builder} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
