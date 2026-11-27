import { useState } from 'react';
import { ChevronLeft, Check, ArrowRightLeft, Info, Play } from 'lucide-react';
import PhoneFrame from '../PhoneFrame';
import TrainingCTA from './TrainingCTA';
import { runHead, RUN_CSS, RUN_BAR_CLEAR, RunBackdrop, RunWatermark, RunStartBar } from './RunBar';
import { fitKitCSS, Modal, HEAD, BODY, GOLD, MUTED, VIOLET_TEXT } from './FitSetupKit';
import { formatLabelOf } from '../data/loadoutMissions';
import { paceTargets, isUntilDown, isMaxReps, missionClockSec, soloTimeline } from '../data/missionSolo';
import { mmss } from '../data/missionMoves';

// The pieces of AT YOUR PACE's start that more than one runner uses (owner,
// 2026-11-26: the Fit card's CHECK-OFF run starts the way QuickMissionSolo
// does): a move row, the format in one line, and the WORKOUTS screen. They
// were QuickMissionSolo's own; moved here as they were, so that screen looks
// and behaves exactly as before. The warm-up is shared/WarmupTimer and the
// lines are data/paceVoice.

// One move of the run, readable from a couple of feet: the name 20 px bold
// white, the reps 20 px gold. The one in hand is lit (a gold glow and an
// accent bar), the ones done this round ticked and dimmed, the rest plain.
// The swap arrows stay, quiet. A move's how-to note shows on the lit row (or
// on every row of a circuit, where no single row is lit).
// loudSwap (WORKOUTS, before the run): SWAP is a labelled button, not the quiet arrows.
export function RunMoveRow({ row, index, lit, done, showNote, noSwap, onSwap, onUndo, loudSwap = false }) {
  const showUndo = !!(row.undoable && onUndo);
  return (
    <li data-now={lit ? 'true' : undefined} style={{
      listStyle: 'none', position: 'relative', borderRadius: 12, padding: '8px 6px 8px 14px', boxSizing: 'border-box',
      background: lit ? 'linear-gradient(90deg, rgba(242,190,69,0.26) 0%, rgba(242,190,69,0.08) 100%)' : 'rgba(17,14,28,0.82)',
      border: lit ? '1.5px solid rgba(242,190,69,0.85)' : '1px solid rgba(255,255,255,0.1)',
      boxShadow: lit ? '0 0 18px rgba(242,190,69,0.3)' : 'none', opacity: done ? 0.5 : 1, transition: 'background .2s ease, opacity .2s ease',
    }}>
      {lit && <span aria-hidden="true" style={{ position: 'absolute', left: 4, top: 8, bottom: 8, width: 4, borderRadius: 2, background: GOLD, boxShadow: `0 0 8px ${GOLD}` }}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        <span aria-label={done ? 'Done' : undefined} style={{
          width: 26, height: 26, flexShrink: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: done ? GOLD : lit ? 'rgba(242,190,69,0.2)' : 'rgba(255,255,255,0.06)', border: done ? 'none' : `1.5px solid ${lit ? GOLD : 'rgba(255,255,255,0.25)'}`,
          font: `700 12px ${HEAD}`, color: GOLD, boxSizing: 'border-box',
        }}>{done ? <Check size={16} strokeWidth={3} color="#1A1204"/> : index + 1}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {row.prefix && <span style={{ font: `700 12px ${HEAD}`, letterSpacing: '0.1em', color: VIOLET_TEXT, whiteSpace: 'nowrap' }}>{row.prefix}</span>}
          <span style={{ font: `700 20px ${HEAD}`, lineHeight: 1.15, color: '#fff', overflowWrap: 'break-word', wordBreak: 'normal', hyphens: 'manual' }}>{row.name}</span>
          {/* WORKOUTS: the dose and SWAP sit on their own line under the name, so the name keeps the row's whole width (never split mid-word at 320-360 wide). */}
          {loudSwap && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span style={{ flex: 1, minWidth: 0, font: `800 20px ${HEAD}`, lineHeight: 1.15, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{row.dose}</span>
              {!noSwap && row.canSwap && (
                <button type="button" onClick={() => onSwap?.(row)} aria-label={`Swap ${row.name}`} style={{
                  height: 40, flexShrink: 0, padding: '0 10px', marginRight: 2, display: 'flex', alignItems: 'center', gap: 5, borderRadius: 10, cursor: 'pointer',
                  background: 'rgba(157,108,255,0.18)', border: '1.5px solid rgba(196,168,255,0.7)', color: '#fff', font: `700 12px ${HEAD}`, letterSpacing: '0.1em',
                }}><ArrowRightLeft size={14} color={VIOLET_TEXT}/>SWAP</button>
              )}
            </span>
          )}
          {showUndo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ font: `700 10px ${HEAD}`, letterSpacing: '0.1em', padding: '2px 5px', borderRadius: 3, background: 'rgba(157,108,255,0.22)', color: VIOLET_TEXT }}>SWAPPED</span>
              <button type="button" onClick={() => onUndo(row)} aria-label={`Undo swap ${row.name}`} style={{
                height: 28, padding: '0 6px', background: 'transparent', border: 'none', cursor: 'pointer', font: `700 11px ${HEAD}`, letterSpacing: '0.14em', color: GOLD,
              }}>UNDO</button>
            </span>
          )}
        </span>
        {!loudSwap && <span style={{ flexShrink: 0, maxWidth: '38%', textAlign: 'right', font: `800 20px ${HEAD}`, lineHeight: 1.15, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{row.dose}</span>}
        {!noSwap && !loudSwap && (
          <button type="button" onClick={row.canSwap ? () => onSwap?.(row) : undefined} disabled={!row.canSwap} aria-label={`Swap ${row.name}`} style={{
            width: 36, height: 44, flexShrink: 0, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent', border: 'none', cursor: row.canSwap ? 'pointer' : 'default', opacity: 0.6,
          }}>
            {row.canSwap && <ArrowRightLeft size={16} color={VIOLET_TEXT}/>}
          </button>
        )}
      </div>
      {showNote && row.note && <div style={{ padding: '2px 0 0 36px', font: `600 15px ${BODY}`, color: '#E6E0F7', lineHeight: 1.3 }}>{row.note}</div>}
    </li>
  );
}

// The format in one short line for WORKOUTS: 'EMOM · 21 MIN',
// 'FOR TIME · 3 ROUNDS · CAP 20:00', 'AMRAP · 11 MIN · REST 1:00'.
export function formatSummary(mission) {
  const label = formatLabelOf(mission) || 'AT YOUR PACE';
  const parts = [label];
  const countUp = mission.format === 'forTime' || isUntilDown(mission) || isMaxReps(mission);
  if (countUp) {
    const n = mission.rounds || 1;
    if (!isUntilDown(mission) && n > 1) parts.push(`${n} ROUNDS`);
    if (mission.capSec > 0) parts.push(`CAP ${mmss(mission.capSec)}`);
  } else {
    const clock = missionClockSec(mission);
    if (clock > 0) parts.push(`${Math.round(clock / 60)} MIN`);
    const rest = soloTimeline(mission).filter(sg => sg.kind === 'rest' && sg.sec >= 30).map(sg => sg.sec);
    if (rest.length) parts.push(`REST ${mmss(Math.max(...rest))}`);
  }
  return parts.join(' · ');
}

// WORKOUTS (owner, 2026-11-24: "a screen that shows all the different
// workouts"; "have the switch-out be there beforehand"): every move of the
// mission in order, as bright as the run's rows, with SWAP and UNDO on each,
// the notes that left the run screen behind "i", and a big gold START that
// goes to GET READY. Back goes to the setup. Today's generated mission cannot
// swap (noSwap: data/soloFromGenerated builds it from the generator's own
// slots, which have no library alternatives).
export function WorkoutsScreen({ mission, rows, noSwap, onBack, onStart, onSwap, onUndo, sheet, formatLine, infoMission }) {
  const [info, setInfo] = useState(false);
  // The "i" sheet reads `infoMission` when a runner has other words for the buttons (CHECK-OFF); formatLine replaces the format line.
  const about = infoMission || mission;
  const pace = paceTargets(about).filter(p => about.pace?.[p.tier] != null);
  const label = { font: `700 12px ${HEAD}`, letterSpacing: '0.16em', color: GOLD };
  const body = { font: `500 15px ${BODY}`, color: '#E6E2F5', lineHeight: 1.45 };
  return (
    <PhoneFrame useBrandBg>
      <style dangerouslySetInnerHTML={{ __html: fitKitCSS + RUN_CSS }}/>
      <div data-pace-workouts="true" style={{
        position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12,
        padding: `0 16px ${RUN_BAR_CLEAR}px`, boxSizing: 'border-box',
      }}>
        <RunWatermark/>
        <div data-run-head="true" style={{ ...runHead, gap: 6 }}>
          <RunBackdrop tint={GOLD}/>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '44px 1fr 44px', alignItems: 'center' }}>
            <button type="button" className="fk-back" aria-label="Back" onClick={onBack}
              style={{ width: 44, height: 44, marginLeft: -12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
              <ChevronLeft size={22}/>
            </button>
            <div style={{ minWidth: 0, textAlign: 'center' }}>
              <div style={{ font: `700 11px ${HEAD}`, letterSpacing: '0.16em', color: GOLD, whiteSpace: 'nowrap' }}>AT YOUR PACE · WORKOUTS</div>
              <div style={{ font: `700 20px ${HEAD}`, letterSpacing: '0.06em', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 0 12px rgba(181,123,255,0.45)' }}>{mission.title}</div>
            </div>
            <button type="button" aria-label="About this workout" onClick={() => setInfo(true)} style={{
              width: 40, height: 40, justifySelf: 'end', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(242,190,69,0.14)', border: `1.5px solid ${GOLD}`, color: GOLD, cursor: 'pointer', padding: 0,
            }}><Info size={22}/></button>
          </div>
          <div data-pace-format="true" style={{ position: 'relative', font: `800 16px ${HEAD}`, letterSpacing: '0.1em', color: GOLD, textAlign: 'center', textShadow: '0 0 12px rgba(242,190,69,0.4)' }}>{formatLine || formatSummary(mission)}</div>
          <div style={{ position: 'relative', font: `700 15px ${BODY}`, color: '#EDE8FF', textAlign: 'center', lineHeight: 1.3 }}>
            {noSwap ? 'Every move, in order. Tap START when you are ready.' : 'Swap any move now, before the clock starts.'}
          </div>
        </div>

        <ol data-run-list="true" aria-label="The moves" style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row, i) => (
            <RunMoveRow key={row.swapKey} row={row} index={i} lit={false} done={false} showNote={false} noSwap={noSwap} loudSwap onSwap={onSwap} onUndo={onUndo}/>
          ))}
        </ol>
      </div>

      <RunStartBar>
        <TrainingCTA label="START" variant="gold" depth height={54} icon={<Play size={18} fill="currentColor" strokeWidth={0}/>} onClick={onStart}
          style={{ fontSize: 19, letterSpacing: '0.18em', borderRadius: 14 }}/>
      </RunStartBar>

      {sheet}

      {info && (
        <Modal title="ABOUT THIS WORKOUT" onClose={() => setInfo(false)}>
          <div data-pace-info="true" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pace.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={label}>PACE TARGETS</div>
                {pace.map(p => (
                  <div key={p.tier} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, font: `700 15px ${HEAD}`, color: '#fff' }}>
                    <span style={{ letterSpacing: '0.1em' }}>{p.label}</span><span style={{ color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{p.text}</span>
                  </div>
                ))}
                {about.paceBasis && <div style={{ ...body, fontSize: 13, color: MUTED }}>{about.paceBasis}</div>}
              </div>
            )}
            {about.load && <div><div style={label}>LOAD</div><div style={body}>{about.load}</div></div>}
            {about.safety && <div><div style={label}>SAFETY</div><div style={body}>{about.safety}</div></div>}
            {about.note && <div><div style={label}>NOTES</div><div style={body}>{about.note}</div></div>}
            {about.tapHint && <div><div style={label}>THE BUTTONS</div><div style={body}>{about.tapHint}</div></div>}
            <div style={{ ...body, fontSize: 13, color: MUTED }}>Beeps play while the screen is on.</div>
          </div>
        </Modal>
      )}
    </PhoneFrame>
  );
}
