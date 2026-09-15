import { useState } from 'react';
import { fmtClock, fmtPace } from '../data/runCoach';

// The splits table — distance, the clock at that point, and the pace run over
// that stretch. Every running app has one, and the pace column is the reason:
// a list of finish times says nothing about whether the second half fell apart.
//
// The player records a split at every HALF unit, so the coarser views are
// subsets, not estimates. The last row is always the finish, even when it lands
// between markers, because that is the number the athlete just ran.

const STEPS = [0.5, 1, 2];

export function buildSplitRows({ splits = [], step = 1, totalDist = 0, totalSec = 0, unit = 'mi' }) {
  const marks = [...splits].sort((a, b) => a.marker - b.marker);
  const rows = [];
  let prevDist = 0;
  let prevSec = 0;
  for (const s of marks) {
    // A 1-unit view keeps only whole markers; a 2-unit view every second one.
    const k = s.marker / step;
    if (Math.abs(k - Math.round(k)) > 1e-6) continue;
    const seg = s.marker - prevDist;
    rows.push({
      label: `${s.marker} ${unit}`,
      elapsedSec: s.elapsedSec,
      paceSec: seg > 0 ? (s.elapsedSec - prevSec) / seg : null,
      partial: false,
    });
    prevDist = s.marker;
    prevSec = s.elapsedSec;
  }
  const tail = totalDist - prevDist;
  if (tail > 0.02 && totalSec > prevSec) {
    rows.push({
      label: `${totalDist.toFixed(2)} ${unit}`,
      elapsedSec: totalSec,
      paceSec: (totalSec - prevSec) / tail,
      partial: tail < step - 1e-6,
    });
  }
  return rows;
}

export default function RunSplits({ splits = [], totalDist = 0, totalSec = 0, unit = 'mi', defaultStep = 1, compact = false }) {
  const [step, setStep] = useState(defaultStep);
  const rows = buildSplitRows({ splits, step, totalDist, totalSec, unit });
  if (!rows.length) return null;

  const fastest = rows.reduce((best, r) => (r.paceSec && (!best || r.paceSec < best) ? r.paceSec : best), null);
  const head = { font: "700 7px 'Orbitron',sans-serif", color: '#8b83a8', letterSpacing: '0.14em' };
  const cell = { font: "700 10px 'Orbitron',sans-serif", color: '#fff' };

  return (
    <div style={{ width: '100%', borderRadius: 10, border: '1px solid rgba(168,85,247,0.25)', background: 'rgba(8,2,18,0.6)', padding: '8px 11px 9px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}>
        <span style={{ font: "700 8px 'Orbitron',sans-serif", color: '#fde047', letterSpacing: '0.16em' }}>SPLITS</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map(s => (
            <button
              key={s}
              onClick={() => setStep(s)}
              style={{
                padding: '2px 9px', borderRadius: 6, cursor: 'pointer',
                background: step === s ? 'rgba(253,224,71,0.14)' : 'rgba(6,0,16,0.7)',
                border: step === s ? '1.5px solid rgba(253,224,71,0.55)' : '1px solid rgba(168,85,247,0.3)',
                color: step === s ? '#fde047' : '#8b83a8',
                font: "700 8px 'Orbitron',sans-serif", letterSpacing: '0.04em',
              }}
            >{s} {unit.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0 14px', alignItems: 'center' }}>
        <span style={head}>DIST</span>
        <span style={{ ...head, textAlign: 'right' }}>TIME</span>
        <span style={{ ...head, textAlign: 'right' }}>PACE</span>
        {rows.slice(0, compact ? 6 : 40).map((r, i) => (
          <Row key={`${r.label}-${i}`} r={r} unit={unit} fastest={fastest} cell={cell} />
        ))}
      </div>
      {compact && rows.length > 6 && (
        <div style={{ font: "600 9px 'Rajdhani',sans-serif", color: '#8b83a8', marginTop: 5 }}>
          +{rows.length - 6} more in your run history.
        </div>
      )}
    </div>
  );
}

function Row({ r, unit, fastest, cell }) {
  const isFastest = r.paceSec && fastest && Math.abs(r.paceSec - fastest) < 0.001;
  return (
    <>
      <span style={{ ...cell, color: r.partial ? '#c4a4d8' : '#fff', paddingTop: 4 }}>
        {r.label}{r.partial ? ' ·' : ''}
      </span>
      <span style={{ ...cell, textAlign: 'right', color: '#d6c2ff', paddingTop: 4 }}>{fmtClock(r.elapsedSec)}</span>
      <span style={{ ...cell, textAlign: 'right', color: isFastest ? '#fde047' : '#8fe8ac', paddingTop: 4 }}>
        {r.paceSec ? fmtPace(r.paceSec, unit) : '--'}
      </span>
    </>
  );
}
