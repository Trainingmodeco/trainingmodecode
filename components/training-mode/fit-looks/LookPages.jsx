import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import PhoneFrame from '../PhoneFrame';
import ModeTabs from '../shared/ModeTabs';
import { SetupHeader, SetupPage, GoldButton, HEAD, BODY, MUTED, VIOLET_TEXT } from '../shared/FitSetupKit';
import { CountPill } from '../MissionLibrarySheet';
import WorkoutCard from '../fit-challenge/ui/WorkoutCard';
import ChooseSheet from '../fit-challenge/ui/ChooseSheet';
import ChallengeSwapSheet from '../fit-challenge/ui/ChallengeSwapSheet';
import BonusBlock from '../fit-challenge/ui/BonusBlock';
import CheckOffRun from '../fit-challenge/ui/CheckOffRun';
import DiscardConfirm from '../fit-challenge/ui/DiscardConfirm';
import ChallengeResults from '../fit-challenge/ui/ChallengeResults';
import WorkoutHistoryList from '../fit-challenge/ui/WorkoutHistoryList';
import ProgramDayHeader from '../fit-challenge/ui/ProgramDayHeader';
import { PatternTag, NoBarTag } from '../fit-challenge/ui/Tags';
import {
  challengeTotals, withoutBar, balanceLine, doseWord, emptyTicks, setTick, tickProgress, mmss,
} from '../data/challengeTotals';
import {
  WARRIOR, SHUFFLED, SHUFFLED_TITLE, PROGRAM, PULL_DAY, PULL_UP_SWAPS, CHOOSE_GROUPS, BONUS, TRACKER, RESULT, HISTORY,
} from './sampleData';

// The looks' pages: sample data on the Fit Challenge components, with just
// enough live state to tap around (rounds, the bar, SHUFFLE, swaps, ticks).
// Nothing is saved and nothing reaches the app's stores.

export const go = (s) => { try { window.location.assign(`?s=${s}`); } catch { /* not in a browser */ } };
const noop = () => {};

// MoveRow rows from moves: dose, a swap on every move, the SWAPPED tag + UNDO
// on a swapped one, a NO BAR tag under a stand-in, pattern tags when asked.
function rowsOf(moves, { swaps = {}, patterns = false, key = 'm' } = {}) {
  return moves.map((m, i) => ({
    swapKey: `${key}-${i}-${m.id}`, i, name: m.name, dose: doseWord(m), canSwap: true, undoable: !!swaps[i],
    prefix: patterns ? <PatternTag pattern={m.pattern}/> : null,
    note: m.noBarFor ? (
      // The caption in the dose's colour at 12px: MoveRow's note grey at 11px
      // read too dim beside the tag.
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: `500 12px ${BODY}`, color: '#CFC9E4' }}><NoBarTag/>for {m.noBarFor}</span>
    ) : null,
  }));
}

const RUN_HELP = {
  solo: 'Tick each move as you go. No coach, your pace.',
  guided: 'The coach calls every move and counts the reps.',
};

// The page's way to the history (it stands where MISSION LIBRARY stands today:
// the library moved into CHOOSE).
function HistoryRow({ n, onClick }) {
  return (
    <button type="button" className="fk-row" onClick={onClick} style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px', width: '100%', boxSizing: 'border-box',
      borderRadius: 14, background: '#0F0B1E', border: '1px solid rgba(157,108,255,0.4)', color: '#fff', textAlign: 'left', cursor: 'pointer',
    }}>
      <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: 'rgba(157,108,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <History size={18} color={VIOLET_TEXT}/>
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ font: `700 15px ${HEAD}`, letterSpacing: '0.1em' }}>YOUR WORKOUTS</span>
        <span style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>Past workouts. Tap one to repeat it.</span>
      </span>
      <CountPill n={n}/>
    </button>
  );
}

// ── the Quick Mission page with the WORKOUT CARD ────────────────────────────
// init: { rounds, bar, deal: 'warrior' | 'shuffled', sheet: null | 'choose' | 'swap', bonusOpen }
export function CardPage({ init = {} }) {
  const [rounds, setRounds] = useState(init.rounds ?? 4);
  const [bar, setBar] = useState(init.bar ?? true);
  const [deal, setDeal] = useState(init.deal ?? 'warrior');
  const [swaps, setSwaps] = useState({});
  const [sheet, setSheet] = useState(init.sheet === 'swap' ? { swap: 2 } : init.sheet ?? null);
  const [bonusOpen, setBonusOpen] = useState(!!init.bonusOpen);
  const [bonusTicks, setBonusTicks] = useState({});
  const [runMode, setRunMode] = useState('solo');

  const shuffled = deal === 'shuffled';
  const dealt = useMemo(() => (shuffled ? SHUFFLED : WARRIOR).map((m, i) => swaps[i] || m), [shuffled, swaps]);
  const moves = useMemo(() => (bar ? dealt : withoutBar(dealt)), [bar, dealt]);
  const totals = challengeTotals(moves, rounds);
  const rows = rowsOf(moves, { swaps, patterns: shuffled, key: deal });
  const swapped = bar ? 0 : moves.filter((m) => m.noBarFor).length;

  const shuffle = () => { setSwaps({}); setDeal((d) => (d === 'warrior' ? 'shuffled' : 'warrior')); setSheet(null); };
  const swapIdx = sheet?.swap;
  const swapMove = swapIdx != null ? moves[swapIdx] : null;
  const pickSwap = (id) => {
    const o = PULL_UP_SWAPS.find((x) => x.id === id);
    if (o && swapIdx != null) setSwaps((s) => ({ ...s, [swapIdx]: { id: o.id, name: o.name, reps: Number(o.doseTo), pattern: dealt[swapIdx].pattern } }));
    setSheet(null);
  };
  const undo = (row) => setSwaps((s) => { const n = { ...s }; delete n[row.i]; return n; });

  return (
    <PhoneFrame useBrandBg>
      <SetupPage scroll>
        <SetupHeader title="QUICK MISSION" onBack={noop}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={noop}/>
        </div>
        <div data-look="page" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
          <WorkoutCard
            eyebrow="Today’s Quick Mission"
            title={shuffled ? SHUFFLED_TITLE : 'FULL BODY WARRIOR'}
            tags={[{ label: 'MEDIUM' }, { label: 'Full Body', accent: true }, { label: 'Bodyweight' }]}
            notice={shuffled ? 'Shuffled: new moves, same everything else.' : null}
            onShuffle={shuffle} onChoose={() => setSheet('choose')}
            rounds={rounds} onRounds={setRounds} totals={totals}
            rows={rows} onSwap={(row) => setSheet({ swap: row.i })} onUndo={undo}
            balance={balanceLine(moves)}
            adjust={{ value: 'Level · focus · gear', onClick: noop }}
            bar={{ on: bar, onToggle: () => setBar((b) => !b), summary: bar ? 'Bar moves stay in.' : `${swapped} ${swapped === 1 ? 'move' : 'moves'} swapped.` }}
            runMode={runMode} onRunMode={setRunMode} runHelp={RUN_HELP[runMode]}
            onStart={() => go('tracker')}
          />
          <BonusBlock open={bonusOpen} onToggle={() => setBonusOpen((o) => !o)} items={BONUS} ticked={bonusTicks}
            onTick={(id) => setBonusTicks((t) => ({ ...t, [id]: !t[id] }))}/>
          <HistoryRow n={HISTORY.length} onClick={() => go('history')}/>
        </div>
      </SetupPage>

      {sheet === 'choose' && (
        <ChooseSheet groups={CHOOSE_GROUPS} onPick={() => setSheet(null)} onSurprise={shuffle} onClose={() => setSheet(null)}/>
      )}
      {swapMove && (
        <ChallengeSwapSheet
          row={{ name: swapMove.name, dose: doseWord(swapMove), gearLabel: swapMove.bar ? 'PULL-UP BAR' : null }}
          options={swapMove.id === 'pull' ? PULL_UP_SWAPS : []} rounds={rounds}
          onPick={pickSwap} onClose={() => setSheet(null)}
        />
      )}
    </PhoneFrame>
  );
}

// ── a program day on the same card ───────────────────────────────────────────
export function ProgramPage() {
  const [rounds, setRounds] = useState(4);
  const [bar, setBar] = useState(true);
  const [runMode, setRunMode] = useState('solo');
  const moves = bar ? PULL_DAY : withoutBar(PULL_DAY);
  const totals = challengeTotals(moves, rounds);
  const swapped = moves.filter((m) => m.noBarFor).length;
  return (
    <PhoneFrame useBrandBg>
      <SetupPage scroll>
        <SetupHeader title="PROGRAMS" onBack={noop}/>
        <div style={{ flexShrink: 0, padding: '0 16px' }}>
          <ModeTabs active="fit" onFight={noop}/>
        </div>
        <div data-look="page" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 0' }}>
          <WorkoutCard
            eyebrow="Continue program"
            title={PROGRAM.title}
            tags={[{ label: 'MEDIUM' }, { label: 'Back · arms', accent: true }, { label: 'Bodyweight' }]}
            header={<ProgramDayHeader program={PROGRAM.name} dayIndex={PROGRAM.dayIndex} days={PROGRAM.days}/>}
            onShuffle={noop} shuffleLabel="SHUFFLE THIS DAY"
            rounds={rounds} onRounds={setRounds} totals={totals}
            rows={rowsOf(moves, { key: 'pull' })} onSwap={noop}
            bar={{ on: bar, onToggle: () => setBar((b) => !b), summary: bar ? 'Bar moves stay in.' : `${swapped} moves swapped.` }}
            adjust={{ value: 'Level · gear', onClick: noop }}
            runMode={runMode} onRunMode={setRunMode} runHelp={RUN_HELP[runMode]}
            onStart={() => go('tracker')} art="/static/fitmode/banner-gym-programs.webp"
          />
        </div>
      </SetupPage>
    </PhoneFrame>
  );
}

// ── the CHECK-OFF run ─────────────────────────────────────────────────────────
function trackerTicks() {
  let t = emptyTicks(TRACKER.rounds, WARRIOR.length);
  for (let r = 0; r < TRACKER.doneRounds; r++) for (let i = 0; i < WARRIOR.length; i++) t = setTick(t, r, i, true);
  for (let i = 0; i < TRACKER.tickedInCurrent; i++) t = setTick(t, TRACKER.doneRounds, i, true);
  return t;
}

export function TrackerPage({ confirm = false }) {
  const [ticks, setTicks] = useState(trackerTicks);
  const [asking, setAsking] = useState(confirm);
  const [paused, setPaused] = useState(false);
  const p = tickProgress(WARRIOR, ticks);
  const elapsed = TRACKER.roundTimes.reduce((a, b) => a + b, 0) + TRACKER.thisRoundSec;
  const onTick = (r, k) => { if (r === (p.currentRound ?? 0) - 1) setTicks((t) => setTick(t, r, k)); };
  const movesDone = p.ticked - p.roundsDone * WARRIOR.length;
  return (
    <PhoneFrame useBrandBg>
      <CheckOffRun
        title="FULL BODY WARRIOR" strip={`CHECK-OFF · MEDIUM · ${TRACKER.rounds} ROUNDS`}
        elapsedSec={elapsed} thisRoundSec={TRACKER.thisRoundSec}
        moves={WARRIOR} ticks={ticks} roundTimes={TRACKER.roundTimes} rounds={TRACKER.rounds}
        onTick={onTick} onBack={noop} onShuffle={() => setAsking(true)} onRounds={noop}
        onPause={() => setPaused((v) => !v)} onStop={noop} paused={paused}
      />
      {p.done && (
        <div style={{ position: 'relative', zIndex: 10, padding: '0 16px 24px' }}>
          <GoldButton label="FINISH" height={56} onClick={() => go('results')}/>
        </div>
      )}
      {asking && (
        <DiscardConfirm
          title="START OVER?"
          body={(
            <>
              SHUFFLE deals new moves and clears your ticks.{' '}
              <span style={{ whiteSpace: 'nowrap' }}>So far: <b style={{ color: '#fff', fontWeight: 600 }}>{p.roundsDone} rounds and {movesDone} moves</b>.</span>
            </>
          )}
          confirmLabel="SHUFFLE"
          onKeep={() => setAsking(false)} onConfirm={() => go('shuffled')}
        />
      )}
    </PhoneFrame>
  );
}

// ── the results ───────────────────────────────────────────────────────────────
export function ResultsPage({ saved: saved0 = false }) {
  const [saved, setSaved] = useState(saved0);
  const elapsed = RESULT.splits.reduce((a, b) => a + b, 0);
  const t = challengeTotals(WARRIOR, 5);
  return (
    <ChallengeResults
      title="FULL BODY WARRIOR" subtitle="Circuit · Medium · At your pace"
      rounds={5} totalRounds={5} reps={t.totalReps} elapsedSec={elapsed} pct={100} ticked={40} cells={40}
      splits={RESULT.splits} xp={RESULT.xp}
      saved={saved}
      onRepeat={() => go('select')} onNew={() => go('shuffled')} onSave={() => setSaved(true)} onBack={noop}
    />
  );
}

// ── YOUR WORKOUTS ─────────────────────────────────────────────────────────────
export function HistoryPage() {
  // The last 7 days (today is Monday 23 November): the first three rows.
  const week = HISTORY.slice(0, 3);
  const reps = week.reduce((a, r) => a + r.reps, 0);
  const secs = week.reduce((a, r) => a + r.elapsedSec, 0);
  return (
    <PhoneFrame useBrandBg>
      <SetupPage scroll>
        <SetupHeader title="YOUR WORKOUTS" onBack={() => go('select')}/>
        <div data-look="page" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 16px 0' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[[String(week.length), 'LAST 7 DAYS'], [reps.toLocaleString('en-US'), 'REPS'], [mmss(secs), 'TIME']].map(([v, l]) => (
              <div key={l} style={{ flex: 1, minWidth: 0, borderRadius: 12, background: 'rgba(7,6,12,0.72)', border: '1px solid rgba(242,190,69,0.3)', padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ font: `700 20px ${HEAD}`, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                <div style={{ font: `600 9px ${HEAD}`, letterSpacing: '0.14em', color: MUTED }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>Newest first. Tap one to put it back on the card.</div>
          <WorkoutHistoryList rows={HISTORY} onOpen={() => go('select')}/>
        </div>
      </SetupPage>
    </PhoneFrame>
  );
}
