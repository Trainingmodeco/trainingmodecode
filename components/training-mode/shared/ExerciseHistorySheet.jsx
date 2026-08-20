import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, NAV_H } from '../Styles';
import { getWeightHistory, exerciseKey, classifyType, unitLabel, normUnit } from '../data/weightLog';

// Spec 12 (WB-F) — the Exercise History sheet: tap an exercise's last-time
// line and see your whole story with that lift. Display layer only — every
// number comes straight out of the weight log (bodyweight sessions log with
// weight 0). Portalled to body to escape PhoneFrame's stacking context, and
// stopped at NAV_H so it rests ON the tab bar instead of covering it.
const GOLD = C.gold;
const VIOLET = '#a855f7';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmtDay = (ts) => { const d = new Date(ts || 0); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };

// Group raw log entries into per-day sessions, oldest first. PR = a session's
// top value beats every prior session — the first session is always a PR.
function sessionsFor(exId) {
  const byDay = new Map();
  getWeightHistory(exId).forEach(e => {
    const key = new Date(e.timestamp || 0).toDateString();
    if (!byDay.has(key)) byDay.set(key, { ts: e.timestamp || 0, reps: [], weight: 0, bodyweight: true, unit: 'lb' });
    const s = byDay.get(key);
    s.reps.push(e.reps || 0);
    if ((e.weight || 0) > 0) { s.bodyweight = false; s.weight = Math.max(s.weight, e.weight); s.unit = normUnit(e.unit); }
  });
  const sessions = [...byDay.values()].sort((a, b) => a.ts - b.ts);
  let best = -Infinity;
  sessions.forEach(s => {
    s.reps = s.reps.slice(-6); // same cap as the LAST lines
    s.top = s.bodyweight ? Math.max(0, ...s.reps) : s.weight;
    s.isPR = s.top > best;
    best = Math.max(best, s.top);
  });
  return { sessions, best: best === -Infinity ? 0 : best };
}

// The hero: last 8 sessions as gold dots on a faint violet dot-grid, thin
// gold line between them, dashed line at BEST, PR dots bigger + glowing.
// First/last date labels only — glanceable in one second, no legend.
function TrendChart({ sessions, best }) {
  const pts = sessions.slice(-8);
  const W = 320, H = 118, PX = 20, PT = 16, PB = 26;
  const tops = pts.map(s => s.top);
  const lo = Math.min(...tops), hi = Math.max(...tops, best);
  const span = hi - lo || 1;
  const x = (i) => pts.length === 1 ? W / 2 : PX + (i * (W - 2 * PX)) / (pts.length - 1);
  const y = (v) => PT + (1 - (v - lo) / span) * (H - PT - PB);
  const grid = [];
  for (let gx = PX; gx <= W - PX; gx += 25) for (let gy = PT; gy <= H - PB; gy += 22) grid.push([gx, gy]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {grid.map(([gx, gy], i) => <circle key={i} cx={gx} cy={gy} r={1} fill="rgba(168,85,247,0.18)"/>)}
      <line x1={PX} x2={W - PX} y1={y(best)} y2={y(best)} stroke="rgba(253,224,71,0.4)" strokeWidth={1} strokeDasharray="4 4"/>
      {pts.length > 1 && (
        <polyline points={pts.map((s, i) => `${x(i)},${y(s.top)}`).join(' ')} fill="none" stroke={GOLD} strokeWidth={1.5}/>
      )}
      {pts.map((s, i) => (
        <g key={i}>
          {s.isPR && <circle cx={x(i)} cy={y(s.top)} r={9} fill="rgba(253,224,71,0.22)"/>}
          <circle cx={x(i)} cy={y(s.top)} r={s.isPR ? 5 : 3.5} fill={GOLD}/>
        </g>
      ))}
      <text x={PX} y={H - 8} fontFamily="'Rajdhani',sans-serif" fontSize={8} fill="#9a90b8">{fmtDay(pts[0].ts)}</text>
      <text x={W - PX} y={H - 8} textAnchor="end" fontFamily="'Rajdhani',sans-serif" fontSize={8} fill="#9a90b8">{fmtDay(pts[pts.length - 1].ts)}</text>
    </svg>
  );
}

export default function ExerciseHistorySheet({ exercise, onClose }) {
  const exId = exerciseKey(exercise);
  const { sessions, best } = useMemo(() => sessionsFor(exId), [exId]);
  const isBW = sessions.length ? sessions[sessions.length - 1].bodyweight : classifyType(exercise) === 'bodyweight';
  const unit = unitLabel(sessions.find(s => !s.bodyweight)?.unit || 'lb');
  const newest = [...sessions].reverse();

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: NAV_H, zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.7)' }}/>
      <div style={{
        width: '100%', maxWidth: 440, margin: '0 auto', boxSizing: 'border-box', maxHeight: '100%',
        background: 'rgba(14,5,26,0.97)', borderRadius: '16px 16px 0 0',
        border: `1px solid ${VIOLET}66`, borderBottom: 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Grab handle + header */}
        <div style={{ flexShrink: 0, padding: '8px 16px 10px' }}>
          <div style={{ width: 44, height: 4, borderRadius: 999, background: 'rgba(168,85,247,0.55)', margin: '0 auto 10px' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 13.5, color: '#fff', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {exercise?.name || 'EXERCISE'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                {exercise?.muscle && (
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 700, fontSize: 7, color: '#c9a6ff', border: '1px solid rgba(168,85,247,0.4)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.1em' }}>{String(exercise.muscle).toUpperCase()}</span>
                )}
                {sessions.length > 0 && (
                  <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 8, color: '#0a0014', background: GOLD, borderRadius: 5, padding: '3px 8px', letterSpacing: '0.06em', boxShadow: '0 0 10px rgba(253,224,71,0.4)' }}>
                    🏆 BEST {best}{isBW ? ' REPS' : ` ${unit}`}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close history" style={{ background: 'none', border: 'none', color: '#c9a6ff', cursor: 'pointer', display: 'flex', padding: 6, margin: -6, flexShrink: 0 }}>
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Trend chart — rich / single / empty */}
        <div style={{ flexShrink: 0, margin: '0 16px', borderRadius: 12, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.7)', padding: '8px 6px', minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {sessions.length >= 2 ? (
            <TrendChart sessions={sessions} best={best}/>
          ) : sessions.length === 1 ? (
            <div style={{ textAlign: 'center', padding: '14px 0' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: GOLD, boxShadow: '0 0 16px rgba(253,224,71,0.7)', margin: '0 auto 10px' }}/>
              <div style={{ fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11, color: '#9a90b8' }}>one more session unlocks the trend</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0', fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 11.5, color: '#9a90b8' }}>
              📜 Your first session writes the first line.
            </div>
          )}
        </div>

        {/* Session list — newest first, scrolls inside the sheet */}
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 16px 14px' }}>
          {newest.map((s, i) => (
            <div key={s.ts || i} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, borderBottom: i < newest.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontWeight: 800, fontSize: 8.5, color: '#c9a6ff', letterSpacing: '0.08em', width: 52, flexShrink: 0 }}>{fmtDay(s.ts)}</span>
              <span style={{ flex: 1, fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: 12, color: '#e7ddf7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {s.reps.join('·')}{s.bodyweight ? '' : ` @ ${s.weight} ${unitLabel(s.unit)}`}
              </span>
              {s.isPR && (
                <span style={{ flexShrink: 0, fontFamily: "'Orbitron',sans-serif", fontWeight: 900, fontSize: 7, color: '#0a0014', background: GOLD, borderRadius: 4, padding: '2px 6px', letterSpacing: '0.1em' }}>PR</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
