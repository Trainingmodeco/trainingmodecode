import { useState, useMemo, useCallback, useRef, Fragment } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import MoveSwapSheet, { MoveRow } from './shared/MoveSwapSheet';
import MissionLibrarySheet, { CountPill } from './MissionLibrarySheet';
import { Shuffle, Folder, ChevronDown, ChevronLeft } from 'lucide-react';
import {
  QM_LENGTHS, QM_FOCI, QM_INTENSITY, QM_TYPES, quickMissionConfig, loadQuickMissionKeys, saveQuickMissionKeys,
} from './data/quickMissionConfig';
import { generateQuickMission, estimateQuickMissionSeconds, quickMissionDose } from './fit-mode/quickMissionGenerator';
import AddCardioSheet from './AddCardioSheet';
import { namedWorkoutById, buildNamedMission } from './data/namedWorkouts';
import { isPro } from './data/entitlements';
import { summarizeCardioAddon } from './data/cardioAddon';
import { qmV2Enabled } from './data/qmV2';
import {
  SOLO_HELP, SOLO_ONLY_HELP,
  missionDefById, levelsOf, gearProfile, buildLoadoutMission, missionCardModel,
  classicMeta, shelfEntries, loadShelfPrefs, saveShelfPrefs,
} from './data/loadoutMissions';
import {
  fitKitCSS, SetupHeader, SetupPage, GoldButton, Tag, ChipGroup, CardioToggleCard, Label,
  HEAD, BODY, MUTED, VIOLET, VIOLET_TEXT, GOLD, CARD, CARD_BORDER, chf,
} from './shared/FitSetupKit';

// Quick Mission — the mission first, then the keys, then the library.
//
// The card at the top is the mission START runs: today's mission, built by
// the generator from the keys under it, with its name, its moves and their
// doses. SURPRISE on the card deals a different one. BUILD YOUR OWN is the
// keys themselves, on the page: GEAR (bodyweight / weighted / hybrid), LEVEL,
// TIME and FOCUS. The card rebuilds on every tap and the keys are remembered
// for the next visit. What the card shows is exactly what runs: the previewed
// mission travels with the config.
//
// Everything else lives behind one folder row, MISSION LIBRARY: a sheet with
// the launch missions and the classics in one vertical list
// (MissionLibrarySheet). PUT ON CARD brings one back here, where a launch
// mission's card carries its LOADOUT / MISSION / SCORE lines, a LEVEL, GUIDED
// or SOLO, and a swap on every move; any key (or the card's own way back)
// returns to today's mission. Everything on that card comes from
// data/loadoutMissions; this screen only holds the choices. With the v2 gate
// off (data/qmV2) the library holds only the classics.
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const focusLabel = (f) => (f === 'FULL BODY' ? 'Full Body' : cap(f));
const GENERATED = { kind: 'generated' };
// The owner's words on the keys. 'NORMAL' stays the stored id (the generator,
// DIFFICULTY_CONFIG and saved sessions read it); MEDIUM is what it says here.
const LEVEL_WORD = { EASY: 'EASY', NORMAL: 'MEDIUM', HARD: 'HARD' };
const GEAR_TAG = { Bodyweight: 'NO GEAR', Weighted: 'WEIGHTED', Hybrid: 'HYBRID' };
const CARD_MOVES = 5; // the rest fold into "+ N more", so the keys stay on screen

// LOADOUT · value rows on a v2 card (and the classic card's one LOADOUT line).
function HeaderLines({ lines }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(64px, auto) 1fr', gap: '2px 10px', alignItems: 'baseline' }}>
      {lines.map(([k, v]) => (
        <Fragment key={k}>
          <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{k}</span>
          <span style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#fff' }}>{v}</span>
        </Fragment>
      ))}
    </div>
  );
}

// One key: its label in a 52px column, then the kit's chamfered radio strip
// (SegRow's look; SegRow puts its label above, the keys want it beside).
// The options share the strip equally, but never shrink below their word:
// on a 360px phone BODYWEIGHT and COMBAT take a little more than the rest.
function KeyRow({ label, options, value, onPick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 52, flexShrink: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{label}</span>
      <div role="radiogroup" aria-label={cap(label)} style={{ ...chf, flex: 1, minWidth: 0, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
        {options.map(o => {
          const on = o.id === value;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-seg" onClick={() => onPick(o.id)} style={{
              flex: '1 1 0', height: 34, border: 'none', cursor: 'pointer', font: `600 11px ${HEAD}`, letterSpacing: '0.08em',
              color: on ? '#fff' : MUTED, background: on ? 'rgba(157,108,255,0.24)' : 'transparent',
              boxShadow: on ? `inset 0 0 0 1px ${VIOLET}` : 'none', whiteSpace: 'nowrap', padding: '0 3px',
            }}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

export default function QuickMissionSetup({ onBack, onHome, onFightMode, onStart, onCardioOnly, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  // The keys (GEAR · LEVEL · TIME · FOCUS), back from the last visit.
  const [keys, setKeys] = useState(() => loadQuickMissionKeys());
  const { workoutType, difficulty, duration, focus } = keys;
  const [seed, setSeed] = useState(0);
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // What the card shows: the generated mission, a named classic (Murph,
  // Sally Up…) or a v2 launch mission. A library pick replaces the generated
  // mission until a key, SURPRISE or the card's way back hands it back to
  // the generator.
  const [sel, setSel] = useState(GENERATED);
  const named = sel.kind === 'classic' ? namedWorkoutById(sel.id) : null;
  void onHome; void onCardioOnly;

  // Quick Mission v2 — read once per mount. Its choices: the run mode comes
  // back from the last visit, the level per mission (the library keeps its
  // own LOADOUT / THEME); the selected mission and its swaps never do.
  const v2 = useState(() => qmV2Enabled())[0];
  const [prefs, setPrefs] = useState(() => loadShelfPrefs());
  const [mode, setMode] = useState(() => prefs.mode || 'guided');
  const [level, setLevel] = useState('standard');
  const [swaps, setSwaps] = useState({}); // { [swapKey]: moveId }, the athlete's own picks only
  const [swapKeyOpen, setSwapKeyOpen] = useState(null);
  // Captured once, so the card, its rows, the swap sheet and the library all
  // filter alike.
  const gear = useState(() => (v2 ? gearProfile() : null))[0];
  const [shelf] = useState(() => shelfEntries().filter(e => v2 || e.kind === 'classic'));
  const missionCount = shelf.filter(e => e.kind === 'v2').length;

  // The mission on the card. Regenerated whenever a key changes, or when
  // SURPRISE bumps the seed with the same keys.
  const cfg = useMemo(() => quickMissionConfig({ duration, focus, difficulty, workoutType, cardioAddon }), [duration, focus, difficulty, workoutType, cardioAddon]);
  const mission = useMemo(() => generateQuickMission(cfg), [cfg, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const estMin = Math.max(1, Math.round(estimateQuickMissionSeconds(mission) / 60));

  // A v2 card is rebuilt from the authored mission on every choice, so a
  // level change drops any swap that no longer applies.
  const v2Mission = useMemo(() => (v2 && sel.kind === 'v2' ? buildLoadoutMission(sel.id, { level, swaps, gear }) : null), [v2, sel, level, swaps, gear]);
  const card = useMemo(() => (v2Mission ? missionCardModel(v2Mission, { gear }) : null), [v2Mission, gear]);
  const levels = useMemo(() => (v2Mission ? levelsOf(missionDefById(v2Mission.id)) : []), [v2Mission]);
  const runMode = card?.soloOnly ? 'solo' : mode;
  const onLibrary = sel.kind !== 'generated';
  // RESET SWAPS shows while one of the athlete's picks is on the card. A pick
  // the current level dropped stays in the map (it comes back with its level)
  // but has nothing to reset.
  const hasSwaps = Object.keys(swaps).length > 0 && !!card?.rows.some(r => r.undoable);

  const clearPick = () => { setSel(GENERATED); setSwaps({}); };
  // A key tap is a choice: it is saved, and it always brings today's mission
  // back to the card.
  const pickKey = (patch) => { clearPick(); setKeys(saveQuickMissionKeys({ ...keys, ...patch })); };
  // SURPRISE deals a new length, level and focus with the same GEAR (what you
  // have with you is not a surprise). It is not a choice, so it is not saved:
  // the next visit opens on the keys the athlete picked.
  const surprise = () => {
    clearPick();
    let d = duration, f = focus, i = difficulty;
    while (d === duration && f === focus && i === difficulty) { d = rand(QM_LENGTHS); f = rand(QM_FOCI); i = rand(QM_INTENSITY); }
    setKeys(k => ({ ...k, duration: d, focus: f, difficulty: i })); setSeed(s => s + 1);
  };

  const savePrefs = (patch) => setPrefs(saveShelfPrefs(patch));
  // The level a launch mission's card opens on: the athlete's last pick for
  // it, else its default.
  const levelFor = useCallback((id) => {
    const def = missionDefById(id);
    const stored = prefs.levels?.[id];
    return stored && def?.levels?.[stored] ? stored : def?.defaultLevel;
  }, [prefs]);
  const pickClassic = (id) => { setSel({ kind: 'classic', id }); setSwaps({}); };
  const pickV2 = (id) => {
    if (!missionDefById(id)) return;
    setLevel(levelFor(id));
    setSwaps({});
    setSel({ kind: 'v2', id });
  };
  const pickLevel = (l) => { setLevel(l); if (v2Mission) savePrefs({ levels: { [v2Mission.id]: l } }); };
  // A SOLO-only mission shows SOLO without overwriting the stored choice.
  const pickMode = (m) => { if (card?.soloOnly || m === mode) return; setMode(m); savePrefs({ mode: m }); };
  // The sheet only offers moves reachable from the authored base, and the
  // build derives the dose from the base, so a chained pick needs nothing
  // special. Picking the card's own default is the same as UNDO.
  const pickSwap = (swapKey, moveId) => {
    const row = card?.rows.find(r => r.swapKey === swapKey);
    setSwaps(s => {
      const n = { ...s };
      if (row && moveId === row.defaultMoveId) delete n[swapKey]; else n[swapKey] = moveId;
      return n;
    });
    setSwapKeyOpen(null);
  };
  const undoSwap = (row) => setSwaps(s => { const n = { ...s }; delete n[row.swapKey]; return n; });

  const startV2 = (m, runAs) => {
    onStart?.({
      ...cfg,
      workoutType: m.workoutType, duration: m.duration, difficulty: m.difficulty, focus: m.focus,
      mission: m, v2: true, mode: m.guided ? runAs : 'solo',
      missionId: m.id, level: m.level, scaled: m.scaled, swaps: m.swaps,
    });
  };
  const startClassic = (w) => {
    // Pro classics: only enforced once the paywall is on (isPro() is true
    // for everyone until then).
    if (w.pro && !isPro()) { onPaywall?.(); return; }
    const m = buildNamedMission(w.id);
    // The classic's own workoutType drives the brief, the prep lines and the
    // status strip; countType keeps the count exactly as before (bodyweight,
    // whatever the GEAR key says).
    onStart?.({ ...cfg, workoutType: m.workoutType, countType: 'Bodyweight', duration: m.duration, difficulty: 'Hard', focus: m.focus, mission: m });
  };
  const handleStart = () => {
    if (v2Mission) { startV2(v2Mission, runMode); return; }
    if (named) { startClassic(named); return; }
    onStart?.({ ...cfg, mission });
  };

  // The library's two actions. Both close it first, so a sheet never opens
  // on top of it. PUT ON CARD also scrolls the page back up, so a short phone
  // shows the card from its top.
  const cardRef = useRef(null);
  const putOnCard = (entry) => {
    setLibraryOpen(false);
    if (entry.kind === 'v2') pickV2(entry.id); else pickClassic(entry.id);
    cardRef.current?.closest('.no-scrollbar')?.scrollTo({ top: 0 });
  };
  const startFromLibrary = (entry) => {
    setLibraryOpen(false);
    if (entry.kind === 'v2') {
      const m = buildLoadoutMission(entry.id, { level: levelFor(entry.id), gear });
      if (m) startV2(m, mode);
      return;
    }
    const w = namedWorkoutById(entry.id);
    if (w) startClassic(w);
  };
  // Back closes the library before it leaves the screen.
  const back = () => { if (libraryOpen) setLibraryOpen(false); else onBack?.(); };

  const cardioSummary = cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run · off by default';

  // Steps whose anchor is not on screen are skipped (a missing anchor stalls
  // the guide): GUIDED · SOLO and LEVEL need a v2 card, SURPRISE today's
  // mission.
  const guideSteps = useMemo(() => {
    const steps = v2 ? SCREEN_GUIDES.quick_mission_setup_v2 : SCREEN_GUIDES.quick_mission_setup;
    return steps.filter(s => (s.target !== 'qm-mode' || !!card) && (s.target !== 'qm-level' || levels.length > 0) && (s.target !== 'qm-surprise' || !onLibrary));
  }, [v2, card, levels, onLibrary]);

  const classic = v2 && named ? classicMeta(named) : null;
  const movesAll = [...mission.exercises, ...mission.finisherExercises];
  const movesMore = Math.max(0, movesAll.length - CARD_MOVES);
  const roundsWord = `${mission.rounds} ${mission.rounds === 1 ? 'round' : 'rounds'}`;
  // How long it really takes, and how it runs: a loaded set is never counted,
  // so it ends on DONE (the runner's safe-weight brief says the same).
  const aboutLine = workoutType === 'Weighted'
    ? `About ${estMin} min · ${roundsWord}. Pick a safe weight; tap DONE after each set.`
    : workoutType === 'Hybrid'
      ? `About ${estMin} min · ${roundsWord}. Pick a safe weight; tap DONE after a loaded set.`
      : `About ${estMin} min · ${roundsWord}, with the coach's count and rest.`;
  const librarySub = v2
    ? `${missionCount} missions · ${shelf.length - missionCount} classics · Murph, Sally Up, Best of 3`
    : `${shelf.length} classics · Murph, Sally Up, Deadly Seven`;

  // A library mission's eyebrow, with the small way back to today's mission.
  const libraryEyebrow = (text) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 }}>
      <span style={{ minWidth: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      <button type="button" className="fk-quiet" onClick={clearPick} style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, height: 28, padding: '0 2px', margin: '-4px -2px -4px 0',
        background: 'transparent', border: 'none', cursor: 'pointer', font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: VIOLET_TEXT,
      }}><ChevronLeft size={14}/>TODAY&apos;S MISSION</button>
    </div>
  );

  const renderV2Card = () => (
    <>
      {libraryEyebrow(card.eyebrow)}
      <h1 style={{ margin: 0, font: `700 21px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 300 }}>{card.title}</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag>{card.tags[0]}</Tag>
        {card.accentTag && <Tag accent>{card.accentTag}</Tag>}
        {card.tags.slice(1).map(t => <Tag key={t} accent={t === 'SCALED'}>{t}</Tag>)}
      </div>
      <HeaderLines lines={[['LOADOUT', card.loadoutLine], ['MISSION', card.missionLine], ['SCORE', card.scoreLine]]}/>

      <div data-guide="qm-mode" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
        <div role="radiogroup" aria-label="Run mode" style={{ ...chf, display: 'flex', padding: 3, gap: 3, background: CARD, border: `1px solid ${CARD_BORDER}` }}>
          {['guided', 'solo'].map(id => {
            const on = runMode === id;
            const off = id === 'guided' && card.soloOnly;
            return (
              <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-disabled={off ? 'true' : undefined} className="fk-seg"
                onClick={off ? undefined : () => pickMode(id)} style={{
                  flex: 1, height: 36, border: 'none', padding: 0, cursor: off ? 'default' : 'pointer', whiteSpace: 'nowrap',
                  font: `600 12px ${HEAD}`, letterSpacing: '0.14em', opacity: off ? 0.45 : 1,
                  color: on ? GOLD : MUTED, background: on ? 'rgba(242,190,69,0.12)' : 'transparent',
                  boxShadow: on ? `inset 0 0 0 1px ${GOLD}` : 'none',
                }}>{id.toUpperCase()}</button>
            );
          })}
        </div>
        <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
          {card.soloOnly ? SOLO_ONLY_HELP : runMode === 'solo' ? SOLO_HELP : card.guidedHelp}
        </div>
      </div>

      {levels.length > 0 && (
        <div data-guide="qm-level" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ChipGroup ariaLabel="Level" options={levels.map(l => ({ id: l.id, label: l.label }))} value={v2Mission.level} onPick={pickLevel}/>
          <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{v2Mission.levelDetail}</div>
        </div>
      )}

      {card.banner && (
        <div style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(157,108,255,0.12)', border: '1px solid rgba(157,108,255,0.4)', font: `500 12px ${BODY}`, color: '#fff', lineHeight: 1.4 }}>{card.banner}</div>
      )}

      <ol style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {card.rows.map((row, i) => (
          <MoveRow key={row.swapKey} row={row} index={i} onSwap={(r) => setSwapKeyOpen(r.swapKey)} onUndo={undoSwap}/>
        ))}
      </ol>
      {hasSwaps && (
        <button type="button" className="fk-quiet" onClick={() => setSwaps({})} style={{
          alignSelf: 'flex-start', height: 32, padding: 0, marginTop: -2, background: 'transparent', border: 'none', cursor: 'pointer',
          font: `700 11px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT,
        }}>RESET SWAPS</button>
      )}

      <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
        <span style={{ font: `600 12px ${HEAD}`, letterSpacing: '0.08em' }}>SCALE:</span> {card.scale}
      </div>
      {card.note && <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{card.note}</div>}
    </>
  );

  const renderClassicCard = () => (
    <>
      {libraryEyebrow(`Classic · ${named.tag}`)}
      <h1 style={{ margin: 0, font: `700 21px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 300 }}>{named.title}</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag>~{named.estMin} min</Tag>
        <Tag accent>{named.focus}</Tag>
        {classic?.accentTag && <Tag accent>{classic.accentTag}</Tag>}
        {named.needs && <Tag>{named.needs}</Tag>}
        {named.pro && <Tag>PRO</Tag>}
      </div>
      {classic && <HeaderLines lines={[['LOADOUT', classic.loadoutLabel]]}/>}
      <ol style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {named.lines.map(([a, b], i) => /^[+×]\s/.test(a) ? (
          // "+ 3 more" / "× 2 rounds" are notes on the list, not steps.
          <li key={i} style={{ paddingLeft: 28, font: `600 12px ${HEAD}`, letterSpacing: '0.06em', color: MUTED }}>{a}</li>
        ) : (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 13px ${BODY}`, color: '#fff' }}>
            <span style={{ width: 18, font: `700 11px ${HEAD}`, color: GOLD }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{a}</span>
            {b && <span style={{ font: `600 12px ${HEAD}`, color: '#CFC9E4' }}>{b}</span>}
          </li>
        ))}
      </ol>
      <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{named.note}</div>
    </>
  );

  const renderTodayCard = () => (
    <>
      <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: VIOLET_TEXT }}>Today’s Quick Mission</span>
      <h1 style={{ margin: 0, font: `700 21px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 300 }}>{mission.title}</h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag>{duration} min</Tag>
        <Tag>{LEVEL_WORD[difficulty]}</Tag>
        <Tag accent>{focusLabel(focus)}</Tag>
        <Tag>{GEAR_TAG[workoutType]}</Tag>
      </div>
      <ol style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {movesAll.slice(0, CARD_MOVES).map((ex, i) => (
          <li key={`${ex.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 13px ${BODY}`, color: ex.isFinisher ? GOLD : '#fff' }}>
            <span style={{ width: 18, font: `700 11px ${HEAD}`, color: ex.isFinisher ? GOLD : '#9D6CFF' }}>{ex.isFinisher ? '❤' : String(i + 1).padStart(2, '0')}</span>
            <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
            <span style={{ font: `600 12px ${HEAD}`, color: ex.isFinisher ? GOLD : '#CFC9E4' }}>{quickMissionDose(ex)}</span>
          </li>
        ))}
        {movesMore > 0 && <li style={{ paddingLeft: 28, font: `600 12px ${HEAD}`, letterSpacing: '0.06em', color: MUTED }}>+ {movesMore} more</li>}
      </ol>
      <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{aboutLine}</div>
    </>
  );

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={back} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
          {/* The mission card — what START runs. */}
          <section ref={cardRef} className="fk-hero" data-guide="qm-length" style={{
            position: 'relative', borderRadius: 16, overflow: 'hidden', flexShrink: 0,
            border: '1px solid rgba(157,108,255,0.35)', background: '#0D0A18',
          }}>
            <SafeImage src="/static/fitmode/banner-gym-quick.webp" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '55% 50%' }}/>
            {/* A v2 card is long and carries doses and swap icons on its right
                edge, so its scrim stays darker across the whole card. */}
            <div style={{ position: 'absolute', inset: 0, background: card
              ? 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.9) 55%, rgba(7,6,12,0.74) 100%)'
              : 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.82) 55%, rgba(7,6,12,0.4) 100%)' }}/>
            <div style={{ position: 'relative', padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {card ? renderV2Card() : named ? renderClassicCard() : renderTodayCard()}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                <div data-guide="qm-start" style={{ flex: 1, minWidth: 0 }}>
                  <GoldButton label="START" icon="play" onClick={handleStart} height={46} style={{ fontSize: 18, letterSpacing: '0.2em' }}/>
                </div>
                {/* SURPRISE — the randomizer, beside START on today's mission. */}
                {!onLibrary && (
                  <button type="button" data-guide="qm-surprise" className="fk-ghost" onClick={surprise} style={{
                    ...chf, width: 64, height: 46, flexShrink: 0, padding: 0, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                    background: CARD, border: '1px solid rgba(255,255,255,0.12)', color: '#fff', font: `700 8px ${HEAD}`, letterSpacing: '0.12em',
                  }}><Shuffle size={16} color={GOLD}/>SURPRISE</button>
                )}
              </div>
            </div>
          </section>

          {/* BUILD YOUR OWN — the keys. */}
          <div data-guide="qm-keys" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label right={<span style={{ font: `500 12px ${BODY}`, color: MUTED }}>the card rebuilds as you tap</span>}>Build your own</Label>
            <KeyRow label="GEAR" options={QM_TYPES.map(t => ({ id: t, label: t.toUpperCase() }))} value={workoutType} onPick={(v) => pickKey({ workoutType: v })}/>
            <KeyRow label="LEVEL" options={QM_INTENSITY.map(d => ({ id: d, label: LEVEL_WORD[d] }))} value={difficulty} onPick={(v) => pickKey({ difficulty: v })}/>
            <KeyRow label="TIME" options={QM_LENGTHS.map(l => ({ id: l, label: String(l) }))} value={duration} onPick={(v) => pickKey({ duration: v })}/>
            <KeyRow label="FOCUS" options={QM_FOCI.map(f => ({ id: f, label: f === 'FULL BODY' ? 'FULL' : f }))} value={focus} onPick={(v) => pickKey({ focus: v })}/>
          </div>

          {/* MISSION LIBRARY — the folder: every launch mission and classic,
              in a sheet. */}
          <button type="button" data-guide="qm-library" className="fk-row" onClick={() => setLibraryOpen(true)} aria-haspopup="dialog" aria-expanded={libraryOpen ? 'true' : 'false'} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: 62, padding: '0 14px', width: '100%', boxSizing: 'border-box',
            borderRadius: 14, background: '#0F0B1E', border: '1px solid rgba(157,108,255,0.3)', color: '#fff', textAlign: 'left', cursor: 'pointer',
          }}>
            <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 10, background: 'rgba(157,108,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Folder size={18} color={VIOLET_TEXT}/>
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>MISSION LIBRARY</span>
              <span style={{ font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{librarySub}</span>
            </span>
            <CountPill n={shelf.length}/>
            <ChevronDown size={18} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>
          </button>

          <CardioToggleCard
            guide="qm-cardio"
            on={!!cardioAddon}
            summary={cardioSummary}
            onToggle={() => { if (cardioAddon) setCardioAddon(null); else setCardioSheetOpen(true); }}
            onEdit={() => setCardioSheetOpen(true)}
          />
        </div>
      </SetupPage>

      {libraryOpen && (
        <MissionLibrarySheet
          shelf={shelf} onTop={onLibrary ? sel : null} gear={gear} levelFor={levelFor}
          onPutOnCard={putOnCard} onStart={startFromLibrary} onClose={() => setLibraryOpen(false)}
        />
      )}
      {cardioSheetOpen && (
        <AddCardioSheet
          context={{ source: 'Quick Mission', difficulty: cap(difficulty), durationMin: duration }}
          initialAddon={cardioAddon}
          onAdd={(addon) => { setCardioAddon(addon); setCardioSheetOpen(false); }}
          onClose={() => setCardioSheetOpen(false)}
        />
      )}
      {v2Mission && swapKeyOpen && (
        <MoveSwapSheet
          mission={v2Mission} swapKey={swapKeyOpen} gear={gear}
          onPick={(moveId) => pickSwap(swapKeyOpen, moveId)}
          onClose={() => setSwapKeyOpen(null)}
        />
      )}
      {helpOpen && <ScreenGuide steps={guideSteps} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
