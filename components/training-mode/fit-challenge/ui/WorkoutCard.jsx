import { Shuffle, Folder, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react';
import SafeImage from '../../SafeImage';
import { MoveRow } from '../../shared/MoveSwapSheet';
import { Tag, HEAD, BODY, MUTED, GOLD, VIOLET_TEXT } from '../../shared/FitSetupKit';
import { QmGold, QmStyle, qmRaised, qmSeg, qmStrip } from '../../shared/QmButtons';
import RoundsPicker from './RoundsPicker';
import TotalsStrip from './TotalsStrip';
import RoundsStepper from './RoundsStepper';
import CardSettings from './CardSettings';

// THE WORKOUT CARD: one card for Quick Mission's open card, a library mission
// and a program day. Top to bottom:
//
//   eyebrow · TITLE · tags          what it is (an optional `header` under the
//                                   tags: a program's day pips)
//   SHUFFLE | CHOOSE                new moves at the same level, gear, focus and
//                                   rounds | the library, by category
//   ROUNDS                          the looks: 2 | 3 | 4 | 5 and the totals strip;
//                                   wired (`stepper`): − N + beside the sum
//   the moves                       shared/MoveRow, a swap on every one
//   balance line                    "3 push · 2 pull · legs · core · arms"
//   ADJUST / PULL-UP BAR            level, focus, gear | the bar switch
//   GUIDED | AT YOUR PACE · START
//
// Wired on Quick Mission (`onToggle`), the card opens closed, as today's card
// does: the rounds and the sum, the first moves (no swap), ▾ SEE ALL, the
// run switch and START, all on the first screen. SEE ALL opens every move
// with its swap, the BALANCED line and the settings, where the card is.
//
// Plain props only: the caller works the totals out (data/fitCard,
// data/challengeTotals) and builds MoveRow rows. Every tap target is 44px or
// more. The card stays in the Fit kit's palette (Chakra Petch, #F2BE45).

// GUIDED | AT YOUR PACE, Quick Mission's own switch (QuickMissionSetup's
// RunModeSwitch look): two 44px raised segments (shared/QmButtons), the chosen
// one brighter with a gold hairline; `off` dims one
// (a mission only offered at your pace, a classic run with the coach).
const RUN_MODES = [{ id: 'guided', label: 'GUIDED' }, { id: 'solo', label: 'AT YOUR PACE' }];
function RunModeSwitch({ value, onPick, off = {} }) {
  return (
    <div role="radiogroup" aria-label="Run mode" style={{ ...qmStrip, flexShrink: 0 }}>
      <QmStyle/>
      {RUN_MODES.map(({ id, label }) => {
        const on = id === value;
        const dim = !!off[id];
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} aria-disabled={dim ? 'true' : undefined} className="qm-raised"
            onClick={dim ? undefined : () => onPick?.(id)} style={{ ...qmSeg(on, { off: dim }), letterSpacing: '0.12em' }}>{label}</button>
        );
      })}
    </div>
  );
}

// SHUFFLE (the deal) and CHOOSE (the library), 44px, raised slate. With no
// onChoose (a program day) SHUFFLE takes the whole row; with no onShuffle (a
// library mission) CHOOSE does.
function DealRow({ onShuffle, onChoose, shuffleLabel = 'SHUFFLE' }) {
  const base = {
    ...qmRaised('slate', { lift: 4, radius: 12 }), height: 44, minWidth: 0, cursor: 'pointer', padding: '0 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
    font: `700 13px ${HEAD}`, letterSpacing: '0.14em', color: '#fff',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: onChoose && onShuffle ? '1fr 1fr' : '1fr', gap: 8 }}>
      {onShuffle && (
        <button type="button" className="qm-raised" onClick={onShuffle} style={base}>
          <Shuffle size={17} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>{shuffleLabel}
        </button>
      )}
      {onChoose && (
        <button type="button" className="qm-raised" onClick={onChoose} aria-haspopup="dialog" style={base}>
          <Folder size={16} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>CHOOSE
        </button>
      )}
    </div>
  );
}

// A closed card's quiet move row (QuickMissionSetup's PlainMove): number,
// name, dose; no swap (SEE ALL has them). A long name (a program day's
// library names run to forty letters) wraps instead of being cut.
function PlainMove({ index, row }) {
  return (
    <li style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 22, font: `500 14px ${BODY}`, lineHeight: 1.25, color: '#fff' }}>
      <span style={{ width: 18, flexShrink: 0, font: `700 11px ${HEAD}`, color: GOLD }}>{String(index + 1).padStart(2, '0')}</span>
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>{row.name}</span>
      {row.dose && <span style={{ flexShrink: 0, font: `600 12px ${HEAD}`, color: '#CFC9E4', whiteSpace: 'nowrap' }}>{row.dose}</span>}
    </li>
  );
}

export default function WorkoutCard({
  eyebrow, eyebrowAction, title, tags = [], notice, header,
  onShuffle, onChoose, shuffleLabel,
  rounds, onRounds, totals, stepper,
  rows = [], onSwap, onUndo, balance, details,
  adjust, bar,
  runMode = 'solo', onRunMode, runOff, runHelp, runExtra,
  onStart, startLabel = 'START', art = '/static/fitmode/banner-gym-quick.webp', guide,
  open = true, onToggle, closedCount = 3, cardRef,
}) {
  const collapsible = typeof onToggle === 'function';
  const showAll = !collapsible || open;
  const hidden = rows.length > closedCount;
  return (
    <section ref={cardRef} data-guide={guide} aria-label={title} className="fc-card" style={{
      position: 'relative', borderRadius: 16, overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(242,190,69,0.35)', background: '#0D0A18',
    }}>
      {/* The open card's banner and its darker scrim (the doses and swap
          icons sit on the right edge), as Quick Mission's open card. */}
      <SafeImage src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '55% 0%' }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.9) 55%, rgba(7,6,12,0.8) 100%)' }}/>
      <div className="fc-in" style={{ position: 'relative', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="fc-head" style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: eyebrowAction ? 20 : 14 }}>
            <span style={{ minWidth: 0, font: `600 10px ${HEAD}`, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eyebrow}</span>
            {eyebrowAction && (
              <button type="button" className="fk-quiet" onClick={eyebrowAction.onClick} aria-label={eyebrowAction.aria || eyebrowAction.label} style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, height: 44, padding: '0 10px', margin: '-12px -10px -12px 0',
                background: 'transparent', border: 'none', cursor: 'pointer', font: `700 10px ${HEAD}`, letterSpacing: '0.12em', color: VIOLET_TEXT,
              }}><ChevronLeft size={14}/>{eyebrowAction.label}</button>
            )}
          </div>
          <h1 style={{ margin: 0, font: `700 23px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff' }}>{title}</h1>
          {tags.length > 0 && (
            <div className="fc-tags" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((t) => <Tag key={t.label} accent={t.accent}>{t.label}</Tag>)}
            </div>
          )}
          {notice && <div role="status" style={{ font: `600 12px ${BODY}`, lineHeight: 1.35, color: GOLD }}>{notice}</div>}
          {header}
        </div>

        {(onShuffle || onChoose) && (
          <div data-guide={guide ? 'fc-deal' : undefined}>
            <DealRow onShuffle={onShuffle} onChoose={onChoose} shuffleLabel={shuffleLabel}/>
          </div>
        )}

        {totals && (stepper
          ? (
            <div data-guide={guide ? 'fc-rounds' : undefined}>
              <RoundsStepper totals={totals} min={stepper.min} max={stepper.max} onStep={stepper.onStep} note={stepper.note}/>
            </div>
          )
          : (
            <>
              <RoundsPicker value={rounds} onPick={onRounds}/>
              <TotalsStrip totals={totals}/>
            </>
          ))}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {showAll && !onSwap ? (
            // No swaps (a program day, a classic): the quiet rows, every one.
            <ol id="fc-moves" aria-label="Moves" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((row, i) => <PlainMove key={row.swapKey} row={row} index={i}/>)}
            </ol>
          ) : showAll ? (
            <ol id="fc-moves" aria-label="Moves" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
              {rows.map((row, i) => <MoveRow key={row.swapKey} row={row} index={i} onSwap={onSwap} onUndo={onUndo} noSwap={!onSwap}/>)}
            </ol>
          ) : (
            <ol id="fc-moves" aria-label="Moves" className="fc-moves-closed" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {rows.slice(0, closedCount).map((row, i) => <PlainMove key={row.swapKey} row={row} index={i}/>)}
            </ol>
          )}
          {showAll && balance && (
            <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
              <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT }}>BALANCED </span>{balance}
            </div>
          )}
          {showAll && details}
        </div>

        {showAll && (adjust || bar) && <div data-guide={guide ? 'fc-adjust' : undefined}><CardSettings adjust={adjust} bar={bar}/></div>}

        {/* ▾ SEE ALL / ▴ SHOW LESS: one button, so focus stays on it. */}
        {collapsible && (
          <button type="button" data-guide={guide ? 'fc-expand' : undefined} className="qm-toggle" onClick={onToggle} aria-expanded={open ? 'true' : 'false'} aria-controls="fc-moves" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, margin: '-4px 0 -4px', padding: 0, width: '100%',
            background: 'transparent', border: 'none', borderTop: '1px dashed rgba(255,255,255,0.12)', cursor: 'pointer',
            font: `700 12px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT,
          }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid rgba(157,108,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {open ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </span>
            {open ? 'SHOW LESS' : hidden ? `SEE ALL ${rows.length} MOVES` : 'SEE MORE'}
          </button>
        )}

        {/* No onRunMode (a program day: the builder runs it): no switch, only the line. */}
        {onRunMode ? (
          <div data-guide={guide ? 'fc-how' : undefined} className="fc-how" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <RunModeSwitch value={runMode} onPick={onRunMode} off={runOff}/>
            {runExtra || (runHelp && <div style={{ font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{runHelp}</div>)}
          </div>
        ) : runHelp && <div style={{ font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{runHelp}</div>}
        <div data-guide={guide ? 'fc-start' : undefined} className="fc-start">
          <QmGold label={startLabel} icon="play" onClick={onStart} height={collapsible ? 50 : 54} style={{ fontSize: 18, letterSpacing: '0.22em' }}/>
        </div>
      </div>
    </section>
  );
}
