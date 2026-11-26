import { Check, RotateCcw } from 'lucide-react';
import MissionComplete from '../../shared/MissionComplete';
import { GOLD as KIT_GOLD } from '../../shared/FitSetupKit';
import { QmGold, QmGhost } from '../../shared/QmButtons';
import { mmss } from '../../data/challengeTotals';

// The results: the app's own end screen (shared/MissionComplete, as
// QuickMissionComplete feeds it), with rounds, total reps and time in its
// stats row, and the completion and each round's time in its recap (the
// summary, which shows on every phone).
//
// The session is banked once, automatically, before this screen opens (as
// every Fit run is), so the screen does not say it: a "Saved to YOUR WORKOUTS"
// line beside a SAVE button read as a contradiction. SAVE WORKOUT keeps the
// moves as a routine to run again from CHOOSE (data/savedRoutines): it never
// writes stats or XP a second time. Once tapped it reads SAVED and the recap
// says where to find it.
//
// The buttons are the Fit kit's (chamfered, Chakra Petch), as on the card and
// the run, through MissionComplete's `ctas` slot: REPEAT, then NEW CHALLENGE
// and SAVE WORKOUT side by side, so the screen holds two rows, not three.
const GOLD = '#fde047';

function Recap({ pct, ticked, cells, splits, totalSec, saved, doneWord = 'ticked', note }) {
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
      <div style={line}>{ticked} of {cells} moves {doneWord}</div>
      {splits.length > 0 && <div style={line}>{splits.map((s, i) => `R${i + 1} ${mmss(s)}`).join(' · ')}</div>}
      {note && <div style={{ ...line, color: '#9a90b8' }}>{note}</div>}
      {saved && <div role="status" style={{ ...line, color: GOLD }}>Saved. Find it in CHOOSE.</div>}
    </div>
  );
}

function Ctas({ onRepeat, onNew, onSave, saved }) {
  return (
    // Raised (shared/QmButtons): the lips make the room between the rows, so
    // the gaps are smaller and the screen is no taller than with the flat ones.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <QmGold label="REPEAT" icon={<RotateCcw size={18} strokeWidth={2.6}/>} height={48} onClick={onRepeat} style={{ fontSize: 16 }}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {/* Two words each, no icon before SAVE WORKOUT and a little less
            tracking than the kit's: at 360px a half-width button holds them
            with room to spare. */}
        <QmGhost label="NEW CHALLENGE" height={44} onClick={onNew} style={{ letterSpacing: '0.1em' }}/>
        <QmGhost
          label={saved ? 'SAVED' : 'SAVE WORKOUT'} height={44} onClick={saved ? undefined : onSave}
          icon={saved ? <Check size={16} strokeWidth={3} color={KIT_GOLD}/> : null}
          style={{ letterSpacing: '0.1em', ...(saved ? { color: KIT_GOLD, cursor: 'default' } : {}) }}
        />
      </div>
    </div>
  );
}

// Wired (fit-challenge/FitCardResults): `variant` / `eyebrow` / `failReason`
// come from the run's own settle (a run under the too-fast floor reads
// VALIDATION FAILED, as every AT YOUR PACE run does); `doneWord` says
// "ticked" for CHECK-OFF and "done" otherwise; `note` adds a quiet line.
export default function ChallengeResults({
  title, subtitle, rounds, totalRounds, reps, elapsedSec, pct, ticked, cells, splits = [], xp,
  onRepeat, onNew, onSave, onBack, saved = false, variant, eyebrow, failReason, doneWord, note, timeLabel = 'TIME',
}) {
  return (
    <MissionComplete
      variant={variant || (pct >= 100 ? 'success' : 'partial')}
      eyebrow={eyebrow}
      failReason={failReason}
      title={title}
      subtitle={subtitle}
      accent={GOLD}
      xp={xp}
      heroImage="/static/trophies/mission-complete-fit.webp"
      onBack={onBack}
      stats={[
        { value: `${rounds}/${totalRounds}`, label: 'ROUNDS', color: GOLD },
        { value: String(reps), label: 'TOTAL REPS', color: '#fff' },
        { value: mmss(elapsedSec), label: timeLabel, color: '#fff' },
      ]}
      summary={<Recap pct={pct} ticked={ticked} cells={cells} splits={splits} totalSec={elapsedSec} saved={saved} doneWord={doneWord} note={note}/>}
      ctas={<Ctas onRepeat={onRepeat} onNew={onNew} onSave={onSave} saved={saved}/>}
    />
  );
}
