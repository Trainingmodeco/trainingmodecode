import { useState, useMemo, Fragment } from 'react';
import PhoneFrame from './PhoneFrame';
import SafeImage from './SafeImage';
import Embers from './Embers';
import ModeTabs from './shared/ModeTabs';
import ScreenGuide from './shared/ScreenGuide';
import { SCREEN_GUIDES } from './shared/screenGuides';
import MoveSwapSheet, { MoveRow } from './shared/MoveSwapSheet';
import { Shuffle, SlidersHorizontal } from 'lucide-react';
import { QM_LENGTHS, QM_FOCI, QM_INTENSITY, quickMissionConfig } from './data/quickMissionConfig';
import { generateQuickMission, estimateQuickMissionSeconds, quickMissionDose } from './fit-mode/quickMissionGenerator';
import AddCardioSheet from './AddCardioSheet';
import { NAMED_WORKOUTS, namedWorkoutById, buildNamedMission } from './data/namedWorkouts';
import { isPro } from './data/entitlements';
import { summarizeCardioAddon } from './data/cardioAddon';
import { qmV2Enabled } from './data/qmV2';
import {
  LOADOUTS, THEMES, SOLO_HELP, SOLO_ONLY_HELP,
  missionDefById, levelsOf, gearProfile, buildLoadoutMission, missionCardModel,
  classicMeta, shelfEntries, filterShelf, themeCounts, emptyShelfCopy, loadShelfPrefs, saveShelfPrefs,
} from './data/loadoutMissions';
import {
  fitKitCSS, SetupHeader, SetupPage, GoldButton, GhostButton, Tag, ChipGroup, Modal, CardioToggleCard, Label,
  HEAD, BODY, MUTED, VIOLET_TEXT, GOLD, CARD, CARD_BORDER, chf,
} from './shared/FitSetupKit';

// Quick Mission — the Revamp layout (QuickMission.dc.html).
//
// The old screen was a form: pick a length, a focus, an intensity, then START
// something you had not seen. This one shows the mission first — its name,
// its moves and their doses — with one gold START on it. SURPRISE ME deals a
// new one in place; ADJUST opens the three choices in a modal. What the card
// shows is exactly what runs: the previewed mission travels with the config.
//
// Quick Mission v2 (owner-only until data/qmV2 flips) turns the classics row
// into MISSION SELECT: LOADOUT and THEME filters over the launch missions and
// the classics. A launch mission's card carries its LOADOUT / MISSION / SCORE
// lines, a LEVEL, GUIDED or SOLO, and a swap on every move. Everything on
// that card comes from data/loadoutMissions; this screen only holds the
// choices. With the gate off the screen is exactly the one above.
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const focusLabel = (f) => (f === 'FULL BODY' ? 'Full Body' : cap(f));
const GENERATED = { kind: 'generated' };

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

// A LOADOUT / THEME filter chip: the kit's violet radio chip, dimmed (still
// tappable) when its count is 0.
function FilterChip({ on, dim, onClick, children }) {
  return (
    <button type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={onClick} style={{
      flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
      background: on ? 'rgba(157,108,255,0.22)' : '#16131F', border: `1px solid ${on ? 'rgba(157,108,255,0.55)' : 'transparent'}`,
      color: on ? VIOLET_TEXT : '#E6E2F5', font: `700 11px ${HEAD}`, letterSpacing: '0.12em', opacity: dim ? 0.45 : 1,
      display: 'flex', alignItems: 'center', gap: 6,
    }}>{children}</button>
  );
}

// "LOADOUT  [ALL] [NO GEAR] …" — the label inline, the chips scrolling beside it.
function FilterRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 58, flexShrink: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{label}</span>
      <div className="no-scrollbar" role="radiogroup" aria-label={cap(label)} style={{ flex: 1, minWidth: 0, display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {children}
      </div>
    </div>
  );
}

const pill = (label, background, color) => (
  <span style={{ font: `800 8px ${HEAD}`, letterSpacing: '0.1em', color, background, borderRadius: 3, padding: '2px 4px' }}>{label}</span>
);

export default function QuickMissionSetup({ onBack, onHome, onFightMode, onStart, onCardioOnly, onPaywall }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [duration, setDuration] = useState(10);
  const [focus, setFocus] = useState('FULL BODY');
  const [difficulty, setDifficulty] = useState('NORMAL');
  const [seed, setSeed] = useState(0);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [cardioAddon, setCardioAddon] = useState(null);
  const [cardioSheetOpen, setCardioSheetOpen] = useState(false);
  // What the card shows: the generated mission, a named classic (Murph,
  // Sally Up…) or a v2 launch mission. A pick replaces the generated mission
  // until SURPRISE ME or ADJUST hands it back to the generator.
  const [sel, setSel] = useState(GENERATED);
  const named = sel.kind === 'classic' ? namedWorkoutById(sel.id) : null;
  void onHome; void onCardioOnly;

  // Quick Mission v2 — read once per mount. Its choices: the filters and the
  // run mode come back from the last visit, the level per mission; the
  // selected mission and its swaps never do.
  const v2 = useState(() => qmV2Enabled())[0];
  const [prefs, setPrefs] = useState(() => (v2 ? loadShelfPrefs() : null));
  const [loadout, setLoadout] = useState(() => prefs?.loadout || 'all');
  const [theme, setTheme] = useState(() => prefs?.theme || 'all');
  const [mode, setMode] = useState(() => prefs?.mode || 'guided');
  const [level, setLevel] = useState('standard');
  const [swaps, setSwaps] = useState({}); // { [swapKey]: moveId }, the athlete's own picks only
  const [swapKeyOpen, setSwapKeyOpen] = useState(null);
  // Captured once, so the card, its rows and the swap sheet all filter alike.
  const gear = useState(() => (v2 ? gearProfile() : null))[0];
  const [shelf] = useState(() => (v2 ? shelfEntries() : []));

  // The mission on the card. Regenerated whenever a choice changes, or when
  // SURPRISE ME bumps the seed with the same choices.
  const cfg = useMemo(() => quickMissionConfig({ duration, focus, difficulty, cardioAddon }), [duration, focus, difficulty, cardioAddon]);
  const mission = useMemo(() => generateQuickMission(cfg), [cfg, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const estMin = Math.max(1, Math.round(estimateQuickMissionSeconds(mission) / 60));

  // A v2 card is rebuilt from the authored mission on every choice, so a
  // level change drops any swap that no longer applies.
  const v2Mission = useMemo(() => (v2 && sel.kind === 'v2' ? buildLoadoutMission(sel.id, { level, swaps, gear }) : null), [v2, sel, level, swaps, gear]);
  const card = useMemo(() => (v2Mission ? missionCardModel(v2Mission, { gear }) : null), [v2Mission, gear]);
  const levels = useMemo(() => (v2Mission ? levelsOf(missionDefById(v2Mission.id)) : []), [v2Mission]);
  const runMode = card?.soloOnly ? 'solo' : mode;
  // RESET SWAPS shows while one of the athlete's picks is on the card. A pick
  // the current level dropped stays in the map (it comes back with its level)
  // but has nothing to reset.
  const hasSwaps = Object.keys(swaps).length > 0 && !!card?.rows.some(r => r.undoable);

  const clearPick = () => { setSel(GENERATED); setSwaps({}); };
  const surprise = () => {
    clearPick();
    let d = duration, f = focus, i = difficulty;
    while (d === duration && f === focus && i === difficulty) { d = rand(QM_LENGTHS); f = rand(QM_FOCI); i = rand(QM_INTENSITY); }
    setDuration(d); setFocus(f); setDifficulty(i); setSeed(s => s + 1);
  };

  const savePrefs = (patch) => setPrefs(saveShelfPrefs(patch));
  const pickClassic = (id) => { setSel({ kind: 'classic', id }); setSwaps({}); };
  const pickV2 = (id) => {
    const def = missionDefById(id);
    if (!def) return;
    const stored = prefs?.levels?.[id];
    setLevel(stored && def.levels?.[stored] ? stored : def.defaultLevel);
    setSwaps({});
    setSel({ kind: 'v2', id });
  };
  const pickLevel = (l) => { setLevel(l); if (v2Mission) savePrefs({ levels: { [v2Mission.id]: l } }); };
  // A SOLO-only mission shows SOLO without overwriting the stored choice.
  const pickMode = (m) => { if (card?.soloOnly || m === mode) return; setMode(m); savePrefs({ mode: m }); };
  const pickLoadout = (id) => { setLoadout(id); savePrefs({ loadout: id }); };
  const pickTheme = (id) => { setTheme(id); savePrefs({ theme: id }); };
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

  const handleStart = () => {
    if (v2Mission) {
      const m = v2Mission;
      onStart?.({
        ...cfg,
        workoutType: m.workoutType, duration: m.duration, difficulty: m.difficulty, focus: m.focus,
        mission: m, v2: true, mode: m.guided ? runMode : 'solo',
        missionId: m.id, level: m.level, scaled: m.scaled, swaps: m.swaps,
      });
      return;
    }
    // Pro classics: only enforced once the paywall is on (isPro() is true
    // for everyone until then).
    if (named?.pro && !isPro()) { onPaywall?.(); return; }
    if (named) {
      const m = buildNamedMission(named.id);
      // The classic's own workoutType drives the brief, the prep lines and the
      // status strip; countType keeps the count exactly as before.
      onStart?.({ ...cfg, workoutType: m.workoutType, countType: cfg.workoutType, duration: m.duration, difficulty: 'Hard', focus: m.focus, mission: m });
      return;
    }
    onStart?.({ ...cfg, mission });
  };

  const cardioSummary = cardioAddon ? summarizeCardioAddon(cardioAddon) : 'Finish with a run · off by default';

  // The v2 guide skips GUIDED · SOLO and LEVEL unless a v2 card is up: a step
  // whose anchor is missing stalls the guide.
  const guideSteps = useMemo(() => {
    if (!v2) return SCREEN_GUIDES.quick_mission_setup;
    return SCREEN_GUIDES.quick_mission_setup_v2.filter(s => (s.target !== 'qm-mode' || !!card) && (s.target !== 'qm-level' || levels.length > 0));
  }, [v2, card, levels]);

  const classic = v2 && named ? classicMeta(named) : null;
  const counts = useMemo(() => (v2 ? themeCounts(shelf, loadout) : null), [v2, shelf, loadout]);
  const shelfList = useMemo(() => (v2 ? filterShelf(shelf, { loadout, theme }) : []), [v2, shelf, loadout, theme]);
  const emptyCopy = v2 && !shelfList.length ? emptyShelfCopy({ loadout, theme }) : null;

  const renderV2Card = () => (
    <>
      <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD }}>{card.eyebrow}</span>
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

  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS }}/>
      <Embers count={2}/>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={onBack} onHelp={() => setHelpOpen(true)}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={onFightMode}/>
        </div>
        {v2 && <div style={{ flexShrink: 0, padding: '10px 16px 0', font: `500 13px ${BODY}`, color: MUTED }}>Short notice? Pick your loadout.</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
          {/* The mission card — what START runs. */}
          <section className="fk-hero" data-guide="qm-length" style={{
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
              {card ? renderV2Card() : (
              <>
              <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.16em', textTransform: 'uppercase', color: named ? GOLD : VIOLET_TEXT }}>{named ? `Classic · ${named.tag}` : 'Today’s Quick Mission'}</span>
              <h1 style={{ margin: 0, font: `700 21px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff', maxWidth: 300 }}>{named ? named.title : mission.title}</h1>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {named ? (
                  <>
                    <Tag>~{named.estMin} min</Tag>
                    <Tag accent>{named.focus}</Tag>
                    {classic?.accentTag && <Tag accent>{classic.accentTag}</Tag>}
                    {named.needs && <Tag>{named.needs}</Tag>}
                    {named.pro && <Tag>PRO</Tag>}
                  </>
                ) : (
                  <>
                    <Tag>{duration} min</Tag>
                    <Tag>{cap(difficulty)}</Tag>
                    <Tag accent>{focusLabel(focus)}</Tag>
                    <Tag>{mission.rounds} {mission.rounds === 1 ? 'round' : 'rounds'}</Tag>
                  </>
                )}
              </div>
              {named ? (
                <>
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
              ) : (
              <>
              <ol style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mission.exercises.map((ex, i) => (
                  <li key={`${ex.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 13px ${BODY}`, color: '#fff' }}>
                    <span style={{ width: 18, font: `700 11px ${HEAD}`, color: '#9D6CFF' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ flex: 1, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</span>
                    <span style={{ font: `600 12px ${HEAD}`, color: '#CFC9E4' }}>{quickMissionDose(ex)}</span>
                  </li>
                ))}
                {mission.finisherExercises.map((ex, i) => (
                  <li key={`fin-${ex.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, font: `500 13px ${BODY}`, color: GOLD }}>
                    <span style={{ width: 18, font: `700 11px ${HEAD}`, color: GOLD }}>❤</span>
                    <span style={{ flex: 1, fontWeight: 600 }}>{ex.name}</span>
                    <span style={{ font: `600 12px ${HEAD}` }}>{quickMissionDose(ex)}</span>
                  </li>
                ))}
              </ol>
              <div style={{ font: `500 12px ${BODY}`, color: MUTED }}>About {estMin} min with the coach&apos;s count and rest.</div>
              </>
              )}
              </>
              )}
              <div data-guide="qm-start" style={{ marginTop: 2 }}>
                <GoldButton label="START" icon="play" onClick={handleStart} height={46} style={{ fontSize: 18, letterSpacing: '0.2em' }}/>
              </div>
            </div>
          </section>

          <div data-guide="qm-intensity" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <GhostButton label="SURPRISE ME" icon={<Shuffle size={17} color={GOLD}/>} onClick={surprise}/>
            <GhostButton label="ADJUST" icon={<SlidersHorizontal size={17} color={VIOLET_TEXT}/>} onClick={() => { clearPick(); setAdjustOpen(true); }} ariaExpanded={adjustOpen ? 'true' : 'false'}
              style={adjustOpen ? { borderColor: '#9D6CFF', background: 'rgba(157,108,255,0.16)' } : undefined}/>
          </div>

          {v2 ? (
            // MISSION SELECT — pick a LOADOUT, narrow by THEME, then a mission.
            // Launch missions first, then the classics; tap the lit chip again
            // (or SURPRISE ME / ADJUST) to go back to a generated mission.
            <div data-guide="qm-classics" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <Label>MISSION SELECT</Label>
              <div data-guide="qm-loadout">
                <FilterRow label="LOADOUT">
                  {LOADOUTS.map(l => <FilterChip key={l.id} on={l.id === loadout} onClick={() => pickLoadout(l.id)}>{l.label}</FilterChip>)}
                </FilterRow>
              </div>
              <div data-guide="qm-theme" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <FilterRow label="THEME">
                  {THEMES.map(th => (
                    <FilterChip key={th.id} on={th.id === theme} dim={counts[th.id] === 0} onClick={() => pickTheme(th.id)}>
                      {th.label} {counts[th.id]}
                    </FilterChip>
                  ))}
                </FilterRow>
                <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{(THEMES.find(th => th.id === theme) || THEMES[0]).help}</div>
              </div>
              {shelfList.length ? (
                <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {shelfList.map(e => {
                    const on = sel.kind === e.kind && sel.id === e.id;
                    const pick = () => { if (on) clearPick(); else if (e.kind === 'v2') pickV2(e.id); else pickClassic(e.id); };
                    return (
                      <button key={`${e.kind}-${e.id}`} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={pick} style={{
                        flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: on ? 'rgba(242,190,69,0.16)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.7)' : 'transparent'}`,
                        color: on ? GOLD : '#E6E2F5', font: `700 11px ${HEAD}`, letterSpacing: '0.1em',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {e.title}
                        {e.soloOnly && pill('SOLO', '#9D6CFF', '#0D0A18')}
                        {e.pro && pill('PRO', GOLD, '#1A1204')}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ font: `500 13px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>{emptyCopy.text}</div>
                  {emptyCopy.action && <GhostButton label={emptyCopy.action.label} height={40} onClick={() => pickLoadout(emptyCopy.action.loadout)}/>}
                </div>
              )}
            </div>
          ) : (
          // CLASSICS — the workouts people ask for by name. Tap one to put
          // it on the card; tap it again (or SURPRISE ME / ADJUST) to go
          // back to a generated mission.
          <div data-guide="qm-classics" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Classics</Label>
            <div className="no-scrollbar" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {NAMED_WORKOUTS.map(w => {
                const on = sel.kind === 'classic' && w.id === sel.id;
                return (
                  <button key={w.id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-chip" onClick={() => (on ? clearPick() : pickClassic(w.id))} style={{
                    flexShrink: 0, height: 36, padding: '0 12px', borderRadius: 3, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: on ? 'rgba(242,190,69,0.16)' : '#16131F', border: `1px solid ${on ? 'rgba(242,190,69,0.7)' : 'transparent'}`,
                    color: on ? GOLD : '#E6E2F5', font: `700 11px ${HEAD}`, letterSpacing: '0.1em',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>{w.title}{w.pro && <span style={{ font: `800 8px ${HEAD}`, letterSpacing: '0.1em', color: '#1A1204', background: GOLD, borderRadius: 3, padding: '2px 4px' }}>PRO</span>}</button>
                );
              })}
            </div>
          </div>
          )}

          <CardioToggleCard
            guide="qm-cardio"
            on={!!cardioAddon}
            summary={cardioSummary}
            onToggle={() => { if (cardioAddon) setCardioAddon(null); else setCardioSheetOpen(true); }}
            onEdit={() => setCardioSheetOpen(true)}
          />
        </div>
      </SetupPage>

      {adjustOpen && (
        <Modal title="ADJUST MISSION" onClose={() => setAdjustOpen(false)} footer={<GoldButton label="DONE" height={50} onClick={() => setAdjustOpen(false)} style={{ fontSize: 16 }}/>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label style={{ fontSize: 10 }}>Focus</Label>
            <ChipGroup ariaLabel="Focus" options={QM_FOCI.map(f => ({ id: f, label: focusLabel(f) }))} value={focus} onPick={setFocus}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Duration</Label>
            <ChipGroup ariaLabel="Duration" options={QM_LENGTHS.map(l => ({ id: l, label: `${l}m` }))} value={duration} onPick={setDuration}/>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Label>Intensity</Label>
            <ChipGroup ariaLabel="Intensity" options={QM_INTENSITY.map(d => ({ id: d, label: cap(d) }))} value={difficulty} onPick={setDifficulty}/>
          </div>
        </Modal>
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
