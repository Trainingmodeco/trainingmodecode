import { Shuffle, Folder } from 'lucide-react';
import SafeImage from '../../SafeImage';
import { MoveRow } from '../../shared/MoveSwapSheet';
import { GoldButton, Tag, HEAD, BODY, MUTED, GOLD, VIOLET, VIOLET_TEXT, CARD, CARD_BORDER, chf } from '../../shared/FitSetupKit';
import RoundsPicker from './RoundsPicker';
import TotalsStrip from './TotalsStrip';
import CardSettings from './CardSettings';

// THE WORKOUT CARD: one card for Quick Mission's open card, a library mission
// and a program day. Top to bottom:
//
//   eyebrow · TITLE · tags          what it is (an optional `header` under the
//                                   tags: a program's day pips)
//   SHUFFLE | CHOOSE                new moves at the same level, gear, focus and
//                                   rounds | the library, by category
//   ROUNDS 2 | 3 | 4 | 5            chosen directly
//   99 × 4 = 396 · about 27 min     the live totals
//   the moves                       shared/MoveRow, a swap on every one
//   balance line                    "3 push · 2 pull · legs · core · arms"
//   ADJUST / PULL-UP BAR            level, focus, gear | the bar switch
//   GUIDED | AT YOUR PACE · START
//
// Plain props only, so it can be wired later: the caller works the totals out
// (data/challengeTotals) and builds MoveRow rows. Every tap target is 44px or
// more. The card stays in the Fit kit's palette (Chakra Petch, #F2BE45).

// GUIDED | AT YOUR PACE, Quick Mission's own switch (QuickMissionSetup's
// RunModeSwitch look): two 44px segments, the chosen one gold.
const RUN_MODES = [{ id: 'guided', label: 'GUIDED' }, { id: 'solo', label: 'AT YOUR PACE' }];
function RunModeSwitch({ value, onPick }) {
  return (
    <div role="radiogroup" aria-label="Run mode" style={{ ...chf, display: 'flex', height: 44, flexShrink: 0, background: CARD, boxShadow: `inset 0 0 0 1px ${CARD_BORDER}` }}>
      {RUN_MODES.map(({ id, label }) => {
        const on = id === value;
        return (
          <button key={id} type="button" role="radio" aria-checked={on ? 'true' : 'false'} className="fk-seg" onClick={() => onPick?.(id)} style={{
            flex: '1 1 0', minWidth: 0, height: 44, border: 'none', padding: '0 4px', whiteSpace: 'nowrap', cursor: 'pointer',
            font: `700 12px ${HEAD}`, letterSpacing: '0.12em', color: on ? '#1A1204' : MUTED, background: on ? GOLD : 'transparent',
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// SHUFFLE (violet: the deal) and CHOOSE (the library), 48px. With no
// onChoose (a program day) SHUFFLE takes the whole row.
function DealRow({ onShuffle, onChoose, shuffleLabel = 'SHUFFLE' }) {
  const base = {
    ...chf, height: 48, minWidth: 0, cursor: 'pointer', padding: '0 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, whiteSpace: 'nowrap',
    font: `700 13px ${HEAD}`, letterSpacing: '0.14em', color: '#fff',
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: onChoose ? '1fr 1fr' : '1fr', gap: 8 }}>
      <button type="button" className="fk-ghost" onClick={onShuffle} style={{ ...base, background: 'rgba(157,108,255,0.24)', border: `1px solid ${VIOLET}` }}>
        <Shuffle size={17} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>{shuffleLabel}
      </button>
      {onChoose && (
        <button type="button" className="fk-ghost" onClick={onChoose} aria-haspopup="dialog" style={{ ...base, background: CARD, border: '1px solid rgba(255,255,255,0.14)' }}>
          <Folder size={16} color={VIOLET_TEXT} style={{ flexShrink: 0 }}/>CHOOSE
        </button>
      )}
    </div>
  );
}

export default function WorkoutCard({
  eyebrow, title, tags = [], notice, header,
  onShuffle, onChoose, shuffleLabel,
  rounds, onRounds, totals,
  rows = [], onSwap, onUndo, balance,
  adjust, bar,
  runMode = 'solo', onRunMode, runHelp,
  onStart, art = '/static/fitmode/banner-gym-quick.webp', guide,
}) {
  return (
    <section data-guide={guide} aria-label={title} style={{
      position: 'relative', borderRadius: 16, overflow: 'hidden', flexShrink: 0,
      border: '1px solid rgba(242,190,69,0.35)', background: '#0D0A18',
    }}>
      {/* The open card's banner and its darker scrim (the doses and swap
          icons sit on the right edge), as Quick Mission's open card. */}
      <SafeImage src={art} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '55% 0%' }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(7,6,12,0.96) 0%, rgba(7,6,12,0.9) 55%, rgba(7,6,12,0.8) 100%)' }}/>
      <div style={{ position: 'relative', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }}>{eyebrow}</span>
          <h1 style={{ margin: 0, font: `700 23px ${HEAD}`, lineHeight: 1.05, textTransform: 'uppercase', color: '#fff' }}>{title}</h1>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {tags.map((t) => <Tag key={t.label} accent={t.accent}>{t.label}</Tag>)}
            </div>
          )}
          {notice && <div role="status" style={{ font: `600 12px ${BODY}`, lineHeight: 1.35, color: GOLD }}>{notice}</div>}
          {header}
        </div>

        {onShuffle && <DealRow onShuffle={onShuffle} onChoose={onChoose} shuffleLabel={shuffleLabel}/>}

        <RoundsPicker value={rounds} onPick={onRounds}/>
        <TotalsStrip totals={totals}/>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ol aria-label="Moves" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => <MoveRow key={row.swapKey} row={row} index={i} onSwap={onSwap} onUndo={onUndo}/>)}
          </ol>
          {balance && (
            <div style={{ font: `500 12px ${BODY}`, color: MUTED, lineHeight: 1.4 }}>
              <span style={{ font: `600 10px ${HEAD}`, letterSpacing: '0.14em', color: VIOLET_TEXT }}>BALANCED </span>{balance}
            </div>
          )}
        </div>

        {(adjust || bar) && <CardSettings adjust={adjust} bar={bar}/>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <RunModeSwitch value={runMode} onPick={onRunMode}/>
          {runHelp && <div style={{ font: `500 11px ${BODY}`, color: MUTED, lineHeight: 1.35 }}>{runHelp}</div>}
        </div>
        <GoldButton label="START" icon="play" onClick={onStart} height={54} style={{ fontSize: 18, letterSpacing: '0.22em' }}/>
      </div>
    </section>
  );
}
