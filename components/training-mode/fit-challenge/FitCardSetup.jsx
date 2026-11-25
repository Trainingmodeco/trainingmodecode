import { useState, useMemo, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import PhoneFrame from '../PhoneFrame';
import Embers from '../Embers';
import ModeTabs from '../shared/ModeTabs';
import ScreenGuide from '../shared/ScreenGuide';
import { SCREEN_GUIDES } from '../shared/screenGuides';
import MoveSwapSheet from '../shared/MoveSwapSheet';
import QuickMissionAdjustSheet from '../QuickMissionAdjustSheet';
import { QM_CSS, GearRow, TimeSlider } from '../QuickMissionSetup';
import {
  QM_FOCI, QM_INTENSITY, QM_LEVEL_WORD, quickMissionConfig, loadQuickMissionKeys, saveQuickMissionKeys,
} from '../data/quickMissionConfig';
import { loadStats } from '../data/userStats';
import { athleteTier, rollSurpriseTier } from '../data/athleteLevel';
import { namedWorkoutById, buildNamedMission } from '../data/namedWorkouts';
import { isPro } from '../data/entitlements';
import {
  GUIDED_HELP, SOLO_ONLY_HELP, CLASSIC_HELP, missionDefById, levelsOf, gearProfile, buildLoadoutMission, missionCardModel,
  shelfEntries, shelfEntryLine, loadShelfPrefs, saveShelfPrefs,
} from '../data/loadoutMissions';
import {
  fitKitCSS, SetupHeader, SetupPage, Label, HEAD, BODY, MUTED, GOLD_FILL,
} from '../shared/FitSetupKit';
import WorkoutCard from './ui/WorkoutCard';
import ChooseSheet from './ui/ChooseSheet';
import ChallengeSwapSheet from './ui/ChallengeSwapSheet';
import BonusBlock from './ui/BonusBlock';
import { NoBarTag } from './ui/Tags';
import WorkoutsPage, { WorkoutsRow, useWorkoutRows } from './WorkoutsPage';
import {
  cardMission, cardTotals, cardBalance, cardSwapOptions, stepRounds, doseOf, gearNoteOf, snapshotOf,
  daySeed, WARRIOR_TITLE, WARRIOR_ID, CARD_MIN_ROUNDS, CARD_MAX_ROUNDS, BONUS_ITEMS, coolDownAddon, cardMoveInfo, barAppliesTo,
} from '../data/fitCard';
import { checkOffOn, setCheckOff, loadSavedWorkouts, cardRunById } from '../data/fitCardStore';
import { libraryDrop, exercisesDrop } from '../data/libraryDrop';

// Quick Mission with THE WORKOUT CARD (switch `fitCard`, data/retentionFlags;
// with it off QuickMissionSetup draws the page exactly as before). Top to
// bottom:
//
//   the card    today's deal (a fresh balanced deal each day), FULL BODY
//               WARRIOR, a saved workout or a library mission. Closed, as
//               today's card: the name, SHUFFLE | CHOOSE, the rounds and the
//               sum with − / +, the first moves, ▾ SEE ALL, GUIDED | AT YOUR
//               PACE (+ CHECK-OFF) and START, all on the first screen. SEE ALL:
//               every move with a swap, the BALANCED line, ADJUST and the
//               PULL-UP BAR switch.
//   GEAR, TIME  the page's two choices, as today: the time is the input, the
//               rounds and reps are dealt for it (data/fitCard).
//   BONUS TRAINING  folded; the cardio cool-down first (the workout goes
//               straight into it), never in the totals or the XP.
//   YOUR WORKOUTS  past workouts of every mode (where MISSION LIBRARY stood:
//               the library is CHOOSE now).
//
// What the card shows is what START runs: the mission travels with the config,
// with a snapshot of the card (cfg.card) for the results and YOUR WORKOUTS.
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const focusLabel = (f) => (f === 'FULL BODY' ? 'Full Body' : cap(f));
const GEAR_TAG = { Weighted: 'WEIGHTED', Hybrid: 'HYBRID' };
const OPEN_KEY = 'tm_fit_card_open_v1';
const loadOpen = () => { try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; } };
const saveOpen = (v) => { try { localStorage.setItem(OPEN_KEY, v ? '1' : '0'); } catch { /* storage full or blocked */ } };
const notes = (a) => /^[+×]\s/.test(a);
// A library row's line in sentence case, the clock words in capitals
// (QuickMissionSetup's sentence()): "~16 min · barbell · EMOM".
const CAPS = new Set(['AMRAP', 'EMOM', 'DB', 'MMA']);
const sentence = (line) => {
  const s = String(line || '').split(' ').map((w) => (CAPS.has(w) ? w : w.toLowerCase())).join(' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// The card's own CSS on top of the page's (QM_CSS: the slider, the toggle).
// A phone under about 800px tall keeps the closed card and START above the
// tab bar: the card packs tighter and shows its first two moves.
const CARD_CSS = `
@media (max-height: 800px) {
  .fc-stack { gap: 8px !important; padding-top: 10px !important; }
  .fc-in { padding: 10px 14px 10px !important; gap: 8px !important; }
  .fc-head { gap: 5px !important; }
  .fc-in h1 { font-size: 21px !important; }
  .fc-tags { gap: 4px !important; }
  .fc-tags > span { padding: 4px 6px !important; letter-spacing: 0.1em !important; }
  .fc-moves-closed > li:nth-child(n+3) { display: none !important; }
  .fc-how { gap: 4px !important; }
}
/* 360x640: the raised run switch keeps a lip under it, so START is a touch
   shorter, and the closed card shows its first move only (SEE ALL has them
   all), so START stays on the first screen with CHECK-OFF showing too. */
@media (max-height: 700px) {
  .fc-how { gap: 2px !important; }
  .fc-in { gap: 6px !important; }
  .fc-moves-closed > li:nth-child(n+2) { display: none !important; }
  .fc-start button { height: 46px !important; }
}
`;

// CHECK-OFF, a remembered choice inside AT YOUR PACE: one 44px row under the
// run switch (in place of its help line).
function CheckOffRow({ on, onToggle }) {
  return (
    <button type="button" role="switch" aria-checked={on ? 'true' : 'false'} onClick={onToggle} className="fk-row" data-guide="fc-checkoff" style={{
      display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, width: '100%', padding: '0 2px', boxSizing: 'border-box',
      background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer',
    }}>
      <span aria-hidden="true" style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
        background: on ? GOLD_FILL : 'transparent', border: on ? 'none' : '2px solid rgba(255,255,255,0.35)',
      }}>{on && <Check size={15} strokeWidth={3} color="#1A1204"/>}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ font: `700 11px ${HEAD}`, letterSpacing: '0.14em', color: '#fff' }}>CHECK-OFF</span>
        <span style={{ font: `500 11px ${BODY}`, lineHeight: 1.3, color: MUTED }}>{on ? 'Tick each move as you go.' : 'Off: tap ROUND after each round.'}</span>
      </span>
    </button>
  );
}

export default function FitCardSetup({ entry, onBack, onFightMode, onStart, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [keys, setKeys] = useState(() => loadQuickMissionKeys());
  const { workoutType, duration: savedDuration, focus } = keys;
  const bar = keys.bar !== false;
  const start = useState(() => athleteTier(loadStats(), 'fit'))[0];
  const [picked, setPicked] = useState(null);
  const difficulty = picked ?? start;
  const [live, setLive] = useState(null);
  const duration = live ?? savedDuration;
  // A fresh balanced deal each day (one seed a day); SHUFFLE deals the next.
  const [seed] = useState(() => daySeed(new Date()));
  const [shuffles, setShuffles] = useState(() => (entry?.newDeal ? 1 : 0));
  // What is on the card: today's deal, FULL BODY WARRIOR, a saved or repeated
  // workout (a snapshot), or a library mission (v2 / classic). YOUR WORKOUTS
  // on Progress opens the page on a kept run (entry.cardRunId).
  // Back from AT YOUR PACE's WORKOUTS screen (entry.reopen): the library mission picked there, with its level and swaps.
  const [reopen] = useState(() => (entry?.reopen && missionDefById(entry.reopen.missionId) ? entry.reopen : null));
  const [source, setSource] = useState(() => {
    if (reopen) return { kind: 'v2', id: reopen.missionId };
    const kept = entry?.cardRunId ? cardRunById(entry.cardRunId) : null;
    return kept ? { kind: 'saved', snapshot: kept, from: 'history' } : { kind: 'deal' };
  });
  const [rounds, setRounds] = useState(null);
  const [swaps, setSwaps] = useState({ key: '', map: {} });
  const [open, setOpen] = useState(loadOpen);
  const [sheet, setSheet] = useState(null); // 'choose' | 'adjust' | { swap: i } | { v2swap: key }
  const [view, setView] = useState('card'); // 'card' | 'workouts'
  const [bonusOpen, setBonusOpen] = useState(false);
  const [bonusTicks, setBonusTicks] = useState({});
  const [checkOff, setCheckOffState] = useState(checkOffOn);
  const [prefs, setPrefs] = useState(() => loadShelfPrefs());
  const [mode, setMode] = useState(() => (reopen ? 'solo' : prefs.mode || 'guided'));
  const gear = useState(() => gearProfile())[0];
  const [shelf] = useState(() => shelfEntries());
  const [saved] = useState(() => loadSavedWorkouts());
  const historyRows = useWorkoutRows();
  // A library mission on the card: its level and its own swaps.
  const [level, setLevel] = useState(() => {
    const def = reopen ? missionDefById(reopen.missionId) : null;
    return def ? (def.levels?.[reopen.level] ? reopen.level : def.defaultLevel || 'standard') : 'standard';
  });
  const [v2swaps, setV2swaps] = useState(() => (reopen?.swaps || {}));
  const [notice, setNotice] = useState(() => (entry?.newDeal ? 'A new deal: new moves, same everything else.' : null));

  const cfg = useMemo(() => quickMissionConfig({ duration, focus, difficulty, workoutType }), [duration, focus, difficulty, workoutType]);
  const cardKind = source.kind === 'deal' || source.kind === 'warrior' || source.kind === 'saved';
  const src = source.kind === 'deal' ? { kind: 'deal', seed, shuffles } : source;
  // Swaps belong to one deal: a new deal (time, gear, level, focus, SHUFFLE,
  // CHOOSE) starts with none.
  const dealKey = JSON.stringify([cfg.duration, cfg.workoutType, cfg.difficulty, cfg.focus, source.kind, shuffles, source.id || source.snapshot?.title || '']);
  const swapMap = swaps.key === dealKey ? swaps.map : {};
  const mission = useMemo(() => (cardKind ? cardMission(cfg, { source: src, rounds, bar, swaps: swapMap }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardKind, cfg, source, seed, shuffles, rounds, bar, dealKey, swaps]);
  const totals = useMemo(() => (mission ? cardTotals(mission) : null), [mission]);
  const balance = useMemo(() => (mission ? cardBalance(mission) : null), [mission]);

  // A library mission (the shelf's v2 missions and classics, through CHOOSE).
  const v2Mission = useMemo(() => (source.kind === 'v2' ? buildLoadoutMission(source.id, { level, swaps: v2swaps, gear }) : null), [source, level, v2swaps, gear]);
  const libCard = useMemo(() => (v2Mission ? missionCardModel(v2Mission, { gear }) : null), [v2Mission, gear]);
  const levels = useMemo(() => (v2Mission ? levelsOf(missionDefById(v2Mission.id)) : []), [v2Mission]);
  const named = source.kind === 'classic' ? namedWorkoutById(source.id) : null;

  const runMode = libCard?.soloOnly ? 'solo' : named ? 'guided' : mode;
  const savePrefs = (patch) => setPrefs(saveShelfPrefs(patch));
  const pickMode = (m) => { if (libCard?.soloOnly || named || m === mode) return; setMode(m); savePrefs({ mode: m }); };

  // ── the page's choices ──────────────────────────────────────────────────
  const backToDeal = () => { setSource({ kind: 'deal' }); setRounds(null); setV2swaps({}); setNotice(null); };
  const pickKey = (patch) => { saveQuickMissionKeys({ ...loadQuickMissionKeys(), ...patch }); setKeys((k) => ({ ...k, ...patch })); };
  // GEAR brings today's deal back (WARRIOR is bodyweight, a library mission
  // has its own gear). TIME keeps WARRIOR (its rounds come from the time) and
  // brings the deal back from anything else; either way the rounds are the
  // time's again.
  const pickGear = (v) => { backToDeal(); pickKey({ workoutType: v }); };
  const pickTime = (v) => {
    setLive(null);
    setRounds(null);
    if (source.kind !== 'deal' && source.kind !== 'warrior') backToDeal();
    if (v !== savedDuration) pickKey({ duration: v });
  };
  const followTime = (v) => {
    if (v == null) { setLive(null); return; }
    if (source.kind !== 'deal' && source.kind !== 'warrior') backToDeal();
    setRounds(null);
    setLive(v);
  };
  const toggleBar = () => pickKey({ bar: !bar });
  // SHUFFLE: a new balanced deal at the same level, gear, focus and rounds.
  const shuffle = () => {
    const keepRounds = mission?.rounds ?? null;
    setSource({ kind: 'deal' }); setShuffles((n) => n + 1); setSheet(null); setV2swaps({});
    setRounds(rounds == null ? null : keepRounds);
    setNotice('Shuffled: new moves, same everything else.');
  };
  // CHOOSE's SURPRISE ME: any category, a new level (one step either side of
  // the athlete's) and focus, as the old SURPRISE did. Nothing is saved.
  const surprise = () => {
    let f = focus, i = difficulty, guard = 0;
    while (f === focus && i === difficulty && guard++ < 40) { f = QM_FOCI[Math.floor(Math.random() * QM_FOCI.length)]; i = rollSurpriseTier(start); }
    setKeys((k) => ({ ...k, focus: f })); setPicked(i);
    setSource({ kind: 'deal' }); setShuffles((n) => n + 1); setRounds(null); setSheet(null);
    setNotice(null);
  };
  const stepRound = (d) => setRounds(stepRounds(mission.rounds, d));

  // ── swaps ────────────────────────────────────────────────────────────────
  const swapIdx = typeof sheet?.swap === 'number' ? sheet.swap : null;
  const swapOptions = useMemo(() => (mission && swapIdx != null ? cardSwapOptions(mission, swapIdx, { bar }) : []), [mission, swapIdx, bar]);
  const pickSwap = (name) => {
    if (swapIdx == null) return;
    setSwaps({ key: dealKey, map: { ...swapMap, [swapIdx]: name } });
    setSheet(null);
  };
  const undoSwap = (row) => { const map = { ...swapMap }; delete map[row.i]; setSwaps({ key: dealKey, map }); };

  // ── CHOOSE ───────────────────────────────────────────────────────────────
  const onCardId = source.kind === 'warrior' ? WARRIOR_ID : source.kind === 'saved' ? source.id : source.kind === 'v2' || source.kind === 'classic' ? source.id : 'today';
  const chooseGroups = useMemo(() => {
    // The library by body part: a mission's own focus (Upper, Lower, Core,
    // Combat or striking); everything else is Full Body.
    const partOf = (e) => {
      const f = String((e.kind === 'v2' ? missionDefById(e.id) : namedWorkoutById(e.id))?.focus || '').toLowerCase();
      if ((e.themes || []).includes('striking') || /combat/.test(f)) return 'combat';
      return /upper/.test(f) ? 'upper' : /lower/.test(f) ? 'lower' : /core/.test(f) ? 'core' : 'full';
    };
    // Every row's + drops its whole workout down (`drop`, built only when opened).
    const lib = shelf.map((e) => ({ id: e.id, kind: e.kind, title: e.title, line: sentence(shelfEntryLine(e)), onCard: onCardId === e.id, part: partOf(e), drop: () => libraryDrop(e, { gear }) }));
    const part = (p) => lib.filter((x) => x.part === p);
    const cardDrop = (source, summary) => () => { const m = cardMission(cfg, { source, bar }); return exercisesDrop(m.exercises, { rounds: m.rounds, gear: m.workoutType, summary }); };
    const groups = [
      { id: 'card', label: 'On the card', items: [
        { id: 'today', kind: 'today', title: "TODAY'S DEAL", line: 'A fresh balanced deal for your time', onCard: onCardId === 'today', drop: cardDrop({ kind: 'deal', seed, shuffles }, 'A balanced deal for your time. SHUFFLE deals new moves.') },
        { id: WARRIOR_ID, kind: 'warrior', title: WARRIOR_TITLE, line: '8 moves · 99 reps a round', onCard: onCardId === WARRIOR_ID, drop: cardDrop({ kind: 'warrior' }, '99 reps a round. The rounds come from your time.') },
      ] },
      ...(saved.length ? [{ id: 'saved', label: 'Your saved', items: saved.map((s) => ({ id: s.id, kind: 'saved', title: s.title, line: `${s.exercises.length} moves · ${s.rounds} ${s.rounds === 1 ? 'round' : 'rounds'}`, onCard: onCardId === s.id, s, drop: () => exercisesDrop(s.exercises, { rounds: s.rounds, gear: s.workoutType }) })) }] : []),
      { id: 'full', label: 'Full Body', items: part('full') },
      { id: 'upper', label: 'Upper Body', items: part('upper') },
      { id: 'lower', label: 'Lower Body', items: part('lower') },
      { id: 'core', label: 'Core & Abs', items: part('core') },
      { id: 'combat', label: 'Combat Conditioning', items: part('combat') },
    ];
    return groups.filter((g) => g.items.length);
  }, [shelf, saved, onCardId, cfg, seed, shuffles, bar, gear]);
  const levelFor = (id) => { const def = missionDefById(id); const st = prefs.levels?.[id]; return st && def?.levels?.[st] ? st : def?.defaultLevel; };
  const choose = (item) => {
    setSheet(null); setNotice(null); setRounds(null); setV2swaps({});
    if (item.kind === 'today') setSource({ kind: 'deal' });
    else if (item.kind === 'warrior') setSource({ kind: 'warrior', id: WARRIOR_ID });
    else if (item.kind === 'saved') setSource({ kind: 'saved', id: item.id, snapshot: item.s });
    else if (item.kind === 'v2') { if (!missionDefById(item.id)) return; setLevel(levelFor(item.id)); setSource({ kind: 'v2', id: item.id }); } else if (item.kind === 'classic') setSource({ kind: 'classic', id: item.id });
    cardRef.current?.closest('.no-scrollbar')?.scrollTo({ top: 0 });
  };

  // ── START ────────────────────────────────────────────────────────────────
  const cardioAddon = bonusTicks.cardio ? coolDownAddon() : null;
  const handleStart = () => {
    if (v2Mission) {
      const m = v2Mission;
      onStart?.({ ...cfg, cardioAddon, workoutType: m.workoutType, duration: m.duration, difficulty: m.difficulty, focus: m.focus, mission: m, v2: true, mode: m.guided ? runMode : 'solo', missionId: m.id, level: m.level, scaled: m.scaled, swaps: m.swaps });
      return;
    }
    if (named) {
      if (named.pro && !isPro()) { onPaywall?.(); return; }
      const m = buildNamedMission(named.id);
      onStart?.({ ...cfg, cardioAddon, workoutType: m.workoutType, countType: 'Bodyweight', duration: m.duration, difficulty: m.difficulty || 'Hard', focus: m.focus, mission: m });
      return;
    }
    // The card's own run: the mission as shown, a snapshot for the results
    // and YOUR WORKOUTS, and CHECK-OFF when AT YOUR PACE has it on.
    const card = snapshotOf(mission, {
      kind: source.kind, startedAt: Date.now(),
      ...(source.kind === 'deal' ? { deal: { seed, shuffles, bar } } : {}),
      gen: { workoutType: cfg.workoutType, duration: cfg.duration, difficulty: cfg.difficulty, focus: cfg.focus },
    });
    const solo = runMode === 'solo';
    onStart?.({
      ...cfg, cardioAddon, workoutType: mission.workoutType, duration: mission.duration, difficulty: mission.difficulty, focus: mission.focus,
      mission, mode: runMode, card, ...(solo && checkOff ? { checkOff: true } : {}),
    });
  };

  // ▾ SEE ALL / ▴ SHOW LESS: opening scrolls just enough to bring the card in.
  const cardRef = useRef(null);
  const adjustRef = useRef(null);
  const scrollOnOpen = useRef(false);
  const toggleOpen = () => { const next = !open; scrollOnOpen.current = next; setOpen(next); saveOpen(next); };
  useEffect(() => {
    if (!open || !scrollOnOpen.current) return;
    scrollOnOpen.current = false;
    const el = cardRef.current;
    const scroller = el?.closest('.no-scrollbar');
    if (!el || !scroller) return;
    const r = el.getBoundingClientRect(), s = scroller.getBoundingClientRect();
    const by = Math.min(r.bottom + 12 - (s.bottom - (parseFloat(getComputedStyle(scroller).paddingBottom) || 0)), r.top - s.top - 8);
    if (by > 0) scroller.scrollBy({ top: by, behavior: 'smooth' });
  }, [open]);

  const back = () => { if (sheet) setSheet(null); else if (view !== 'card') setView('card'); else onBack?.(); };

  // ── what the card shows ─────────────────────────────────────────────────
  const levelWordOf = (d) => QM_LEVEL_WORD[String(d).toUpperCase()] || String(d).toUpperCase();
  let title, eyebrow, tags, rows, details = null, adjust = null, runHelp, runOff = {};
  if (mission) {
    title = mission.title;
    eyebrow = source.kind === 'warrior' ? 'Challenge · Full body' : source.kind === 'saved' ? (source.from === 'history' ? 'From your workouts' : 'Your saved workout') : 'Today’s Quick Mission';
    tags = [
      { label: levelWordOf(mission.difficulty) },
      { label: focusLabel(String(mission.focus || 'Full Body').toUpperCase()), accent: true },
      { label: GEAR_TAG[mission.workoutType] || 'Bodyweight' },
      ...(cardioAddon ? [{ label: '+ COOL-DOWN', accent: true }] : []),
    ];
    rows = mission.exercises.map((e, i) => {
      const gearLine = gearNoteOf(e.name);
      return {
        swapKey: `c${i}-${e.name}`, i, name: e.name, dose: doseOf(e),
        canSwap: cardSwapOptions(mission, i, { bar }).length > 0, undoable: !!swapMap[i],
        note: e.noBarFor ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `500 12px ${BODY}`, color: '#CFC9E4' }}><NoBarTag/>for {e.noBarFor}</span>
        ) : gearLine,
      };
    });
    adjust = { value: source.kind === 'deal' ? 'Level · focus · run mode' : 'Level · run mode', onClick: () => setSheet('adjust') };
    runHelp = runMode === 'solo' ? null : GUIDED_HELP;
  } else if (libCard) {
    title = libCard.title;
    eyebrow = libCard.eyebrow;
    tags = [{ label: libCard.tags[0] }, ...(libCard.accentTag ? [{ label: libCard.accentTag, accent: true }] : []), { label: levels.length > 1 ? v2Mission.levelLabel : levelWordOf(libCard.tags[1]) }, ...libCard.tags.slice(2).map((t) => ({ label: t, accent: t === 'SCALED' }))];
    rows = libCard.rows;
    details = libCard.missionLine ? <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{libCard.missionLine.toLowerCase().replace(/^./, (c) => c.toUpperCase())}</div> : null;
    adjust = { value: levels.length > 1 ? 'Level · run mode' : 'Run mode', onClick: () => setSheet('adjust') };
    runHelp = libCard.soloOnly ? SOLO_ONLY_HELP : runMode === 'solo' ? null : libCard.guidedHelp || GUIDED_HELP;
    runOff = { guided: !!libCard.soloOnly };
  } else if (named) {
    title = named.title;
    eyebrow = `Classic · ${named.tag}`;
    tags = [{ label: `~${named.estMin} min` }, { label: named.focus, accent: true }, ...(named.needs ? [{ label: named.needs }] : [])];
    rows = named.lines.filter(([a]) => !notes(a)).map(([a, b], i) => ({ swapKey: `n${i}`, name: a, dose: b, canSwap: false }));
    details = <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{named.note}</div>;
    runHelp = CLASSIC_HELP;
    runOff = { solo: true };
  }
  const onLibrary = !mission;
  const standIns = mission ? mission.exercises.filter((e) => e.noBarFor).length : 0;
  // TIME is the input; the line opposite its label says why the card's time
  // can differ from the slider's: rounds added or taken off with + / −, or
  // whole rounds that land near the time (WARRIOR's fixed doses).
  const handRounds = mission && rounds != null ? mission.rounds - mission.card.baseRounds : 0;
  const cardMin = <b style={{ color: '#fff', fontWeight: 600 }}>about {totals?.estMinutes} min</b>;
  const timeNote = onLibrary || source.kind === 'saved' ? 'for today’s deal'
    : handRounds ? <>{handRounds > 0 ? '+' : '−'}{Math.abs(handRounds)} {Math.abs(handRounds) === 1 ? 'round' : 'rounds'} · {cardMin}</>
      : totals && totals.estMinutes !== duration ? <>whole rounds · {cardMin}</> : 'rounds follow';
  const solo = runMode === 'solo';
  const runExtra = solo && !libCard?.soloOnly ? (
    <CheckOffRow on={checkOff} onToggle={() => { const v = !checkOff; setCheckOffState(v); setCheckOff(v); }}/>
  ) : null;

  // ADJUST: what this card lets you change (the cardio is BONUS TRAINING's).
  const adjustSheet = mission ? {
    level: { options: QM_INTENSITY.map((d) => ({ id: d, label: QM_LEVEL_WORD[d] })), value: String(difficulty).toUpperCase(), onPick: (v) => { setPicked(v); setRounds(null); }, mark: start, markLabel: 'YOUR LEVEL', detail: 'The workout starts at your level. Your pick lasts for this visit.' },
    focus: source.kind === 'deal' ? { options: QM_FOCI.map((f) => ({ id: f, label: f === 'FULL BODY' ? 'FULL' : f })), value: focus, onPick: (v) => { pickKey({ focus: v }); setRounds(null); } } : null,
    how: { value: runMode, soloOnly: false, onPick: pickMode, help: solo ? 'Just the moves and a timer. CHECK-OFF is on the card.' : GUIDED_HELP },
  } : libCard ? {
    level: levels.length > 1 ? { options: levels.map((l) => ({ id: l.id, label: l.label })), value: v2Mission.level, onPick: (l) => { setLevel(l); savePrefs({ levels: { [v2Mission.id]: l } }); }, detail: v2Mission.levelDetail } : null,
    focus: null,
    how: { value: runMode, soloOnly: libCard.soloOnly, onPick: pickMode, help: runHelp || 'Just the moves and a timer.' },
  } : null;

  const guideSteps = useMemo(() => SCREEN_GUIDES.quick_mission_card.filter((s) => (s.target !== 'fc-rounds' || !onLibrary) && (s.target !== 'fc-adjust' || open) && (s.target !== 'fc-checkoff' || (solo && !libCard?.soloOnly))), [onLibrary, open, solo, libCard]);

  if (view === 'workouts') {
    return (
      <WorkoutsPage rows={historyRows} onBack={() => setView('card')} onOpen={(r) => {
        const kept = cardRunById(r.cardId);
        if (!kept) return;
        setSource({ kind: 'saved', snapshot: kept, from: 'history', id: r.cardId }); setRounds(null); setNotice(null); setView('card');
      }}/>
    );
  }

  const bonusItems = BONUS_ITEMS.map((it) => ({
    ...it,
    ...(it.cardio ? { onLine: 'On: your workout goes straight into it.' } : {}),
    ...(it.link === 'fight' ? { link: { label: 'FIGHT', onClick: onFightMode } } : { link: undefined }),
  }));

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + QM_CSS + CARD_CSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={back} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>

        <div data-fc="page" className="fc-stack" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 0' }}>
          <WorkoutCard
            cardRef={cardRef} guide="fc-card"
            eyebrow={eyebrow}
            eyebrowAction={source.kind !== 'deal' ? { label: 'TODAY', aria: "Back to today's deal", onClick: backToDeal } : null}
            title={title} tags={tags} notice={notice}
            onShuffle={onLibrary ? null : shuffle} onChoose={() => setSheet('choose')}
            totals={totals} stepper={totals ? { min: CARD_MIN_ROUNDS, max: CARD_MAX_ROUNDS, onStep: stepRound } : null}
            rows={rows}
            onSwap={mission ? (row) => setSheet({ swap: row.i }) : libCard ? (row) => setSheet({ v2swap: row.swapKey }) : null}
            onUndo={mission ? undoSwap : libCard ? (row) => setV2swaps((s) => { const n = { ...s }; delete n[row.swapKey]; return n; }) : null}
            balance={balance?.line || null} details={details}
            adjust={adjust ? { ...adjust } : null}
            bar={mission && barAppliesTo(source.kind) && mission.workoutType !== 'Weighted' ? { on: bar, onToggle: toggleBar, summary: bar ? 'Bar moves stay in.' : standIns ? `${standIns} ${standIns === 1 ? 'stand-in' : 'stand-ins'}` : 'No bar moves' } : null}
            runMode={runMode} onRunMode={pickMode} runOff={runOff} runHelp={runHelp} runExtra={runExtra}
            onStart={handleStart}
            open={open} onToggle={toggleOpen}
          />

          {/* GEAR and TIME: the page's two choices; the time is the input
              (the rounds and reps are dealt for it). */}
          <div data-guide="fc-gear" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <Label right={onLibrary ? <span style={{ font: `500 12px ${BODY}`, color: MUTED }}>for today’s deal</span> : null}>Gear</Label>
            <GearRow value={onLibrary || source.kind === 'saved' ? null : workoutType} onPick={pickGear}/>
          </div>
          <div data-guide="fc-time" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
            <Label right={<span data-fc="time-note" style={{ font: `500 12px ${BODY}`, color: MUTED, whiteSpace: 'nowrap' }}>{timeNote}</span>}>Time</Label>
            <TimeSlider value={duration} dim={onLibrary || source.kind === 'saved'} onLive={followTime} onCommit={pickTime}/>
          </div>

          <div data-guide="fc-bonus">
            <BonusBlock open={bonusOpen} onToggle={() => setBonusOpen((o) => !o)} items={bonusItems} ticked={bonusTicks}
              onTick={(id) => setBonusTicks((t) => ({ ...t, [id]: !t[id] }))}/>
          </div>
          <WorkoutsRow n={historyRows.length} onClick={() => setView('workouts')} guide="fc-workouts"/>
        </div>
      </SetupPage>

      {sheet === 'choose' && (
        <ChooseSheet groups={chooseGroups} onPick={choose} onSurprise={surprise} onClose={() => setSheet(null)}/>
      )}
      {mission && swapIdx != null && (
        <ChallengeSwapSheet
          row={{ name: mission.exercises[swapIdx]?.name, dose: doseOf(mission.exercises[swapIdx] || {}), gearLabel: cardMoveInfo(mission.exercises[swapIdx]?.name)?.bar ? 'PULL-UP BAR' : cardMoveInfo(mission.exercises[swapIdx]?.name)?.table ? 'TABLE' : null }}
          options={swapOptions} rounds={mission.rounds}
          onPick={pickSwap} onClose={() => setSheet(null)}
        />
      )}
      {v2Mission && sheet?.v2swap && (
        <MoveSwapSheet mission={v2Mission} swapKey={sheet.v2swap} gear={gear} onClose={() => setSheet(null)}
          onPick={(moveId) => {
            const row = libCard?.rows.find((r) => r.swapKey === sheet.v2swap);
            setV2swaps((s) => { const n = { ...s }; if (row && moveId === row.defaultMoveId) delete n[sheet.v2swap]; else n[sheet.v2swap] = moveId; return n; });
            setSheet(null);
          }}/>
      )}
      {sheet === 'adjust' && adjustSheet && (
        <QuickMissionAdjustSheet title={title} level={adjustSheet.level} focus={adjustSheet.focus} how={adjustSheet.how} notes={null} cardio={null}
          returnFocus={adjustRef} onClose={() => setSheet(null)}/>
      )}
      {helpOpen && <ScreenGuide steps={guideSteps} onClose={() => setHelpOpen(false)}/>}
    </PhoneFrame>
  );
}
