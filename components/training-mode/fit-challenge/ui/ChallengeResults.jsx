import MissionComplete from '../../shared/MissionComplete';
import { mmss } from '../../data/challengeTotals';

// The results: the app's own end screen (shared/MissionComplete, as
// QuickMissionComplete feeds it), with rounds, total reps and time in its
// stats row, and the completion and each round's time in its recap (the
// summary, which shows on every phone).
//
// The session is banked once, automatically, before this screen opens (as
// every Fit run is). SAVE AS MY WORKOUT keeps the moves as a routine to run
// again (data/savedRoutines): it never writes stats or XP a second time.
const GOLD = '#fde047';

function Recap({ pct, ticked, cells, splits, totalSec, saved }) {
  const box = { background: 'rgba(8,2,18,0.88)', border: '1px solid rgba(253,224,71,0.3)', borderRadius: 10, padding: '8px 10px' };
  const line = { font: "600 11px 'Rajdhani',sans-serif", color: '#e9e3f7', lineHeight: 1.4, fontVariantNumeric: 'tabular-nums' };
  return (
    <div data-look="results" style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, font: "700 9px 'Orbitron',sans-serif", letterSpacing: '0.12em', color: GOLD, marginBottom: 5 }}>
        <span>{pct}% COMPLETE</span><span style={{ color: '#fff' }}>TOTAL {mmss(totalSec)}</span>
      </div>
      <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#f59e0b,#fde047)' }}/>
      </div>
      <div style={line}>{ticked} of {cells} moves ticked</div>
      <div style={line}>{splits.map((s, i) => `R${i + 1} ${mmss(s)}`).join(' · ')}</div>
      {saved && <div style={{ ...line, color: '#9a90b8' }}>{saved}</div>}
    </div>
  );
}

export default function ChallengeResults({
  title, subtitle, rounds, totalRounds, reps, elapsedSec, pct, ticked, cells, splits = [], xp,
  onRepeat, onNew, onSave, onBack, savedLine = 'Saved to YOUR WORKOUTS.',
}) {
  return (
    <MissionComplete
      variant={pct >= 100 ? 'success' : 'partial'}
      title={title}
      subtitle={subtitle}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fit.webp"
      onBack={onBack}
      stats={[
        { value: `${rounds}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: String(reps), label: 'TOTAL REPS', color: '#fff' },
        { value: mmss(elapsedSec), label: 'TIME', color: '#fff' },
      ]}
      summary={<Recap pct={pct} ticked={ticked} cells={cells} splits={splits} totalSec={elapsedSec} saved={savedLine}/>}
      actions={[
        { label: 'REPEAT', onClick: onRepeat, kind: 'primary', role: 'retry' },
        { label: 'NEW CHALLENGE', onClick: onNew, kind: 'secondary' },
        { label: 'SAVE AS MY WORKOUT', onClick: onSave, kind: 'secondary' },
      ]}
    />
  );
}
