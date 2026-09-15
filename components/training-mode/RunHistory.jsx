import { useState, useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import RouteMap, { RouteThumb } from './shared/RouteMap';
import RunSplits from './shared/RunSplits';
import {
  loadRuns, runRoute, runTotals, runMeters, runsInWeek, weekByDay,
  loadWeekGoal, saveWeekGoal, personalBests, deleteRun, RUN_LOG_UPDATED,
} from './data/runLog';
import { metersPerUnit, fmtClock, fmtPace } from './data/runCoach';

// PROGRESS → RUNS. The half of a running app that lives outside the run.
//
// Cardio used to finish and vanish: XP was awarded, a line went into a log
// nothing rendered, and the route the phone had just drawn was dropped. A run
// is worth keeping — so this is the career page. Totals at the top, the week
// against a goal, personal bests, then every run with the map of where it went.
//
// The list is the point. A row you can recognise by SHAPE — that loop round the
// park, that out-and-back along the river — is how an athlete finds a run
// again, which is why the thumbnail is the route and not an icon.

const GOLD = '#fde047';
const mono = "'Orbitron',sans-serif";
const body = "'Rajdhani',sans-serif";

const fmtDist = (meters, unit) => (meters / metersPerUnit(unit)).toFixed(meters / metersPerUnit(unit) >= 100 ? 0 : 2);

function fmtHours(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`;
}

function fmtDay(ts) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yest = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  if (sameDay) return 'TODAY';
  if (yest) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase();
}

function Card({ children, style }) {
  return <div style={{ background: 'rgba(8,2,18,0.85)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 12, padding: '12px 14px', marginBottom: 11, ...style }}>{children}</div>;
}

function Stat({ label, value, sub, color = '#fff' }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 68, textAlign: 'center' }}>
      <div style={{ font: `900 17px ${mono}`, color, lineHeight: 1.05 }}>{value}</div>
      <div style={{ font: `700 7px ${mono}`, color: '#8b83a8', letterSpacing: '0.13em', marginTop: 3 }}>{label}</div>
      {sub ? <div style={{ font: `600 8.5px ${body}`, color: '#6f6790', marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}

export default function RunHistory({ preferredUnit = 'mi' }) {
  const [runs, setRuns] = useState(() => loadRuns());
  const [openId, setOpenId] = useState(null);
  const [goalEdit, setGoalEdit] = useState(false);
  const [goal, setGoal] = useState(() => loadWeekGoal());

  useEffect(() => {
    const refresh = () => { setRuns(loadRuns()); setGoal(loadWeekGoal()); };
    window.addEventListener(RUN_LOG_UPDATED, refresh);
    window.addEventListener('storage', refresh);
    return () => { window.removeEventListener(RUN_LOG_UPDATED, refresh); window.removeEventListener('storage', refresh); };
  }, []);

  const totals = useMemo(() => runTotals(runs), [runs]);
  const days = useMemo(() => weekByDay(runs), [runs]);
  const bests = useMemo(() => personalBests(runs).slice(0, 3), [runs]);
  // Decode every stored route once per change of the list, not once per render:
  // a tuple-to-object pass over sixty tracks on every keystroke in the goal
  // field would be felt on a phone.
  const routes = useMemo(() => {
    const m = new Map();
    runs.forEach(r => m.set(r.id, runRoute(r)));
    return m;
  }, [runs]);

  const weekMeters = useMemo(() => runsInWeek(runs).reduce((a, r) => a + runMeters(r), 0), [runs]);
  const doneUnits = weekMeters / metersPerUnit(goal.unit);
  const week = {
    doneUnits,
    pct: goal.value > 0 ? Math.min(1, doneUnits / goal.value) : 0,
    remaining: Math.max(0, goal.value - doneUnits),
    hit: doneUnits >= goal.value && goal.value > 0,
  };
  // Totals read in whichever unit the athlete last ran in, falling back to the
  // one their goal is set in — never a mix on the same line.
  const unit = runs[0]?.unit || goal.unit || preferredUnit;

  if (runs.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '26px 18px' }}>
        <div style={{ fontSize: 26, marginBottom: 8 }}>🗺️</div>
        <div style={{ font: `900 12px ${mono}`, color: GOLD, letterSpacing: '0.08em' }}>NO RUNS YET</div>
        <div style={{ font: `600 11.5px ${body}`, color: '#a99cc4', marginTop: 7, lineHeight: 1.45 }}>
          Finish a run in Cardio Mode with GPS on and it lands here — the map of where you went, your splits, and your pace on every stretch.
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* Career totals — the four numbers a running app opens with. */}
      <Card style={{ display: 'flex', gap: 6, padding: '13px 10px' }}>
        <Stat label={`TOTAL ${unit.toUpperCase()}`} value={fmtDist(totals.meters, unit)} color={GOLD} />
        <Stat label="TIME" value={fmtHours(totals.seconds)} />
        <Stat label="RUNS" value={totals.count} />
        <Stat label="KCAL" value={totals.calories >= 1000 ? `${(totals.calories / 1000).toFixed(1)}K` : totals.calories} sub="est" color="#ff9a52" />
      </Card>

      {/* Weekly goal — distance this week against a target you set. */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ font: `700 8px ${mono}`, color: GOLD, letterSpacing: '0.16em' }}>WEEKLY GOAL</span>
          <button
            onClick={() => setGoalEdit(v => !v)}
            style={{ padding: '2px 10px', borderRadius: 7, cursor: 'pointer', background: 'rgba(253,224,71,0.1)', border: '1px solid rgba(253,224,71,0.45)', color: GOLD, font: `700 8px ${mono}`, letterSpacing: '0.08em' }}
          >{goalEdit ? 'DONE' : 'EDIT'}</button>
        </div>

        {goalEdit ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
            <input
              type="number" inputMode="decimal" min="0.5" step="0.5" value={goal.value}
              onChange={e => { const g = { ...goal, value: parseFloat(e.target.value) || 0 }; setGoal(g); }}
              onBlur={() => saveWeekGoal(goal)}
              aria-label="Weekly distance goal"
              style={{ width: 74, padding: '6px 9px', borderRadius: 8, background: 'rgba(6,0,16,0.8)', border: '1px solid rgba(168,85,247,0.35)', color: '#fff', font: `800 14px ${mono}`, outline: 'none' }}
            />
            {['km', 'mi'].map(u => (
              <button
                key={u}
                onClick={() => { const g = { ...goal, unit: u }; setGoal(g); saveWeekGoal(g); }}
                style={{ padding: '5px 12px', borderRadius: 8, cursor: 'pointer', background: goal.unit === u ? 'rgba(253,224,71,0.12)' : 'rgba(6,0,16,0.7)', border: goal.unit === u ? '1.5px solid rgba(253,224,71,0.55)' : '1px solid rgba(168,85,247,0.3)', color: goal.unit === u ? GOLD : '#8b83a8', font: `700 9px ${mono}` }}
              >{u.toUpperCase()}</button>
            ))}
            <span style={{ font: `600 9.5px ${body}`, color: '#8b83a8', marginLeft: 'auto' }}>per week</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 8 }}>
            <span style={{ font: `900 24px ${mono}`, color: '#fff' }}>{week.doneUnits.toFixed(1)}</span>
            <span style={{ font: `700 11px ${mono}`, color: '#8b83a8' }}>/ {goal.value} {goal.unit}</span>
            <span style={{ marginLeft: 'auto', font: `700 9px ${mono}`, color: week.hit ? '#8fe8ac' : GOLD, letterSpacing: '0.08em' }}>
              {week.hit ? '★ GOAL HIT' : `${week.remaining.toFixed(1)} ${goal.unit} TO GO`}
            </span>
          </div>
        )}

        <div style={{ height: 7, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(2, week.pct * 100)}%`, height: '100%', background: week.hit ? 'linear-gradient(90deg,#22c55e,#8fe8ac)' : 'linear-gradient(90deg,#7c3aed,#fde047)' }} />
        </div>

        {/* Seven bars, Monday first — which days you actually got out. */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 30, marginTop: 8 }}>
          {days.map((m, i) => {
            const maxDay = Math.max(1, ...days);
            const h = m > 0 ? Math.max(4, (m / maxDay) * 26) : 2;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{ width: '100%', height: h, borderRadius: 3, background: m > 0 ? 'linear-gradient(180deg,#fde047,#b06aff)' : 'rgba(255,255,255,0.08)' }} />
                <span style={{ font: `700 7px ${mono}`, color: m > 0 ? '#c4a4d8' : '#4e4868' }}>{'MTWTFSS'[i]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Personal bests — the fastest verified run at each distance. */}
      {bests.length > 0 && (
        <Card>
          <div style={{ font: `700 8px ${mono}`, color: GOLD, letterSpacing: '0.16em', marginBottom: 7 }}>PERSONAL BESTS</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {bests.map(b => (
              <div key={b.id} style={{ flex: 1, textAlign: 'center', borderRadius: 9, border: '1px solid rgba(253,224,71,0.25)', background: 'rgba(253,224,71,0.05)', padding: '7px 4px' }}>
                <div style={{ font: `700 8px ${mono}`, color: '#c4a4d8', letterSpacing: '0.08em' }}>{b.goal} {b.unit.toUpperCase()}</div>
                <div style={{ font: `900 14px ${mono}`, color: GOLD, marginTop: 2 }}>{fmtClock(b.seconds)}</div>
                <div style={{ font: `600 8px ${body}`, color: '#8b83a8' }}>{fmtPace(b.avgPaceSec, b.unit)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ font: `700 8px ${mono}`, color: GOLD, letterSpacing: '0.16em', margin: '2px 2px 7px' }}>
        YOUR RUNS · {runs.length}
      </div>

      {runs.map(run => {
        const open = openId === run.id;
        const route = routes.get(run.id) || [];
        const pace = run.avgPaceSec;
        return (
          <div key={run.id} style={{ background: 'rgba(8,2,18,0.85)', border: `1px solid ${open ? 'rgba(253,224,71,0.4)' : 'rgba(168,85,247,0.25)'}`, borderRadius: 12, marginBottom: 9, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenId(open ? null : run.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <RouteThumb route={route} size={50} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ font: `900 17px ${mono}`, color: '#fff' }}>{run.distance.toFixed(2)}</span>
                  <span style={{ font: `700 9px ${mono}`, color: GOLD }}>{run.unit.toUpperCase()}</span>
                  {run.newBest && <span style={{ font: `700 7.5px ${mono}`, color: GOLD, letterSpacing: '0.1em' }}>★ BEST</span>}
                  {run.ghost?.outcome === 'victory' && <span style={{ font: `700 7.5px ${mono}`, color: '#8fe8ac' }}>👻 BEATEN</span>}
                </div>
                <div style={{ font: `600 10px ${body}`, color: '#a99cc4', marginTop: 2 }}>
                  {fmtDay(run.at)} · {fmtClock(run.seconds)} · {pace ? fmtPace(pace, run.unit) : '--'}
                  {run.calories ? ` · ${run.calories} kcal` : ''}
                </div>
              </div>
              <span style={{ font: `700 8px ${mono}`, color: run.gps ? '#8fe8ac' : '#6f6790', letterSpacing: '0.08em', flexShrink: 0 }}>
                {run.gps ? 'GPS' : 'EST'}
              </span>
            </button>

            {open && (
              <div style={{ padding: '0 11px 11px' }}>
                {route.length >= 2 ? (
                  <RouteMap
                    route={route}
                    height={175}
                    unit={run.unit}
                    targetPaceSec={run.targetSec && run.goal ? run.targetSec / run.goal : null}
                    label={new Date(run.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
                    style={{ marginBottom: 9 }}
                  />
                ) : (
                  <div style={{ font: `600 10px ${body}`, color: '#8b83a8', padding: '6px 0 9px' }}>
                    No route for this one — it was logged without a GPS fix.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
                  <Stat label="AVG PACE" value={pace ? fmtPace(pace, run.unit) : '--'} color="#8fe8ac" />
                  {run.targetSec ? <Stat label="VS TARGET" value={`${run.seconds - run.targetSec <= 0 ? '−' : '+'}${fmtClock(Math.abs(run.seconds - run.targetSec))}`} color={run.beatTarget ? '#8fe8ac' : '#ff9a52'} /> : null}
                  {run.calories ? <Stat label="KCAL" value={run.calories} sub="est" color="#ff9a52" /> : null}
                </div>

                <RunSplits splits={run.splits} totalDist={run.distance} totalSec={run.seconds} unit={run.unit} />

                <button
                  onClick={() => { deleteRun(run.id); setOpenId(null); setRuns(loadRuns()); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ff8a8a', font: `700 8.5px ${mono}`, letterSpacing: '0.08em' }}
                >
                  <Trash2 size={12} /> DELETE RUN
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ font: `600 10px ${body}`, color: '#6f6790', textAlign: 'center', margin: '6px 0 4px', lineHeight: 1.4 }}>
        Routes are recorded and stored on this device only.
      </div>
    </>
  );
}
