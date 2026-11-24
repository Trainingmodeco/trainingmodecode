import { Check } from 'lucide-react';
import { HEAD, BODY, MUTED, GOLD, VIOLET_TEXT, CARD, CARD_BORDER } from '../../shared/FitSetupKit';
import { tickProgress, roundComplete, roundTotals, doseWord, holdWord, mmss } from '../../data/challengeTotals';

// CHECK-OFF, an AT YOUR PACE option: the rounds as rows instead of one ROUND
// tap.
//
//   progress    a bar with the share done, reps done and left (a hold counts
//               in seconds, never in reps)
//   done        a round with every move ticked folds to one row: a check, its
//               reps and its time
//   current     the first round not done, open: each move a tick button,
//               the next move lit gold (MoveRow's highlight); a 40px box
//               in a 52px row, the whole row the button
//   later       dim, one row each
//
// A round counts only when all its moves are ticked (data/challengeTotals).
// Only the current round takes ticks, so a round can never be skipped.
// Silent and tap-driven like AT YOUR PACE: no coach lines, so no clips.
//
// moves: [{ name, reps | seconds }]  ticks: ticks[round][move]
// roundTimes: seconds each finished round took (index = round)
export function ProgressBar({ pct }) {
  return (
    <div aria-hidden="true" style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${GOLD}, #f59e0b)`, boxShadow: '0 0 10px rgba(242,190,69,0.5)', transition: 'width .4s ease' }}/>
    </div>
  );
}

// The visible box is 40px (the whole 52px row is the button): a 30px box read
// as a small target on the phone. The next move's empty box is outlined gold.
function TickBox({ on, next }) {
  return (
    <span aria-hidden="true" style={{
      width: 40, height: 40, flexShrink: 0, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: on ? GOLD : 'rgba(255,255,255,0.04)', border: on ? 'none' : `2px solid ${next ? GOLD : 'rgba(255,255,255,0.32)'}`, boxSizing: 'border-box',
      boxShadow: on ? '0 0 10px rgba(242,190,69,0.45)' : 'none',
    }}>{on && <Check size={24} strokeWidth={3} color="#1A1204"/>}</span>
  );
}

function TickRow({ move, index, on, next, onTick }) {
  return (
    <li style={{ listStyle: 'none' }}>
      <button type="button" role="checkbox" aria-checked={on ? 'true' : 'false'} aria-label={`${move.name}, ${doseWord(move)}`} data-now={next ? 'true' : undefined} onClick={onTick} style={{
        width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8,
        boxSizing: 'border-box', border: 'none', cursor: 'pointer', textAlign: 'left',
        background: next ? 'linear-gradient(90deg, rgba(242,190,69,0.26) 0%, rgba(242,190,69,0.08) 100%)' : 'transparent', boxShadow: next ? `inset 4px 0 0 ${GOLD}, 0 0 16px rgba(242,190,69,0.28)` : 'none', opacity: on ? 0.55 : 1,
      }}>
        <TickBox on={on} next={next}/>
        <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: on ? MUTED : GOLD }}>{String(index + 1).padStart(2, '0')}</span>
        {/* A done move is dimmed, not struck through: the gold check says done,
            and a strike made the name hard to read. */}
        {/* Readable from a couple of feet (owner, 2026-11-24): the name 20 px bold, the dose 20 px gold. */}
        <span style={{ flex: 1, minWidth: 0, font: `700 20px ${HEAD}`, lineHeight: 1.15, color: on ? MUTED : '#fff', overflowWrap: 'anywhere' }}>{move.name}</span>
        <span style={{ flexShrink: 0, font: `800 20px ${HEAD}`, color: on ? MUTED : GOLD, whiteSpace: 'nowrap' }}>{doseWord(move)}</span>
      </button>
    </li>
  );
}

// One folded round: done (a gold check, its work and time) or still to come (dim).
function RoundLine({ n, work, time, done }) {
  return (
    <li style={{
      listStyle: 'none', minHeight: 48, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', borderRadius: 10,
      background: CARD, border: `1px solid ${done ? 'rgba(242,190,69,0.35)' : CARD_BORDER}`, opacity: done ? 1 : 0.5,
    }}>
      <span aria-hidden="true" style={{
        width: 24, height: 24, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: done ? GOLD : 'transparent', border: done ? 'none' : '1.5px solid rgba(255,255,255,0.3)', boxSizing: 'border-box',
      }}>{done && <Check size={15} strokeWidth={3} color="#1A1204"/>}</span>
      <span style={{ flex: 1, minWidth: 0, font: `700 13px ${HEAD}`, letterSpacing: '0.12em', color: done ? '#fff' : MUTED }}>ROUND {n}{done ? ' DONE' : ''}</span>
      <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: done ? '#CFC9E4' : MUTED, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {work}{time ? ` · ${time}` : ''}
      </span>
    </li>
  );
}

export default function CheckOffTracker({ moves, ticks, roundTimes = [], onTick }) {
  const p = tickProgress(moves, ticks);
  const per = roundTotals(moves);
  // A folded round's work: its reps (a hold's seconds would read as a time
  // beside the round's own time, so they stay in the open round's rows).
  const work = per.reps ? `${per.reps} reps` : `${holdWord(per.seconds)} hold`;
  const current = p.currentRound ? p.currentRound - 1 : -1;
  const row = current >= 0 ? ticks[current] : null;
  const nextIdx = row ? row.findIndex((v) => !v) : -1;
  const tickedHere = row ? row.filter(Boolean).length : 0;
  return (
    <div data-look="tracker" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress */}
      <div role="group" aria-label={`${p.pct}% done. ${p.repsDone} reps done, ${p.repsLeft} left.`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ font: `600 11px ${HEAD}`, letterSpacing: '0.16em', color: MUTED }}>{p.roundsDone} OF {p.rounds} ROUNDS</span>
          <span style={{ font: `700 18px ${HEAD}`, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{p.pct}%</span>
        </div>
        <ProgressBar pct={p.pct}/>
        <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: `500 12px ${BODY}`, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
          <span><span style={{ color: '#fff', fontWeight: 600 }}>{p.repsDone}</span> reps done</span>
          <span><span style={{ color: '#fff', fontWeight: 600 }}>{p.repsLeft}</span> left</span>
        </div>
      </div>

      <ol aria-label="Rounds" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ticks.map((r, i) => {
          if (i !== current) {
            const done = roundComplete(r);
            return <RoundLine key={i} n={i + 1} work={work} time={done && roundTimes[i] ? mmss(roundTimes[i]) : null} done={done}/>;
          }
          return (
            <li key={i} style={{ listStyle: 'none', borderRadius: 12, background: 'rgba(242,190,69,0.05)', border: '1.5px solid rgba(242,190,69,0.55)', padding: '10px 6px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 6px' }}>
                <span style={{ font: `700 16px ${HEAD}`, letterSpacing: '0.1em', color: GOLD }}>ROUND {i + 1}</span>
                <span style={{ font: `700 10px ${HEAD}`, letterSpacing: '0.12em', padding: '3px 6px', borderRadius: 3, background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT }}>IN PROGRESS</span>
                <span style={{ marginLeft: 'auto', font: `600 12px ${HEAD}`, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{tickedHere} OF {moves.length}</span>
              </div>
              <ul aria-label={`Round ${i + 1}`} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {moves.map((m, k) => (
                  <TickRow key={k} move={m} index={k} on={!!r[k]} next={k === nextIdx} onTick={() => onTick?.(i, k)}/>
                ))}
              </ul>
              <div style={{ padding: '6px 6px 0', font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>
                Round {i + 1} counts when all {moves.length} moves are ticked.
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
